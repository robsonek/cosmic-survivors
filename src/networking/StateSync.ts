/**
 * State Synchronization for Cosmic Survivors.
 * Handles full snapshots, delta compression, and bandwidth optimization.
 */

import {
  IStateSnapshot,
  IStateDelta,
  INetworkEntityState,
  NetMessageType,
} from '../shared/interfaces/INetworking';
import type { EntityId } from '../shared/interfaces/IWorld';
import { NetworkMessages } from './NetworkMessages';

/**
 * Entity priority levels for sync frequency.
 */
export enum SyncPriority {
  Critical = 0,  // Every tick (local player, bosses)
  High = 1,      // Every 2 ticks (nearby enemies, projectiles)
  Medium = 2,    // Every 4 ticks (distant enemies)
  Low = 3,       // Every 8 ticks (pickups, effects)
}

/**
 * Entity sync configuration.
 */
interface IEntitySyncConfig {
  entity: EntityId;
  priority: SyncPriority;
  lastSyncTick: number;
  lastState: INetworkEntityState | null;
  dirty: boolean;
}

/**
 * StateSync - State synchronization system.
 */
export class StateSync {
  private entities: Map<EntityId, IEntitySyncConfig> = new Map();
  private previousSnapshot: IStateSnapshot | null = null;
  private currentTick: number = 0;

  // Configuration
  private readonly snapshotInterval: number;
  private readonly deltaThreshold: number;
  /** Maximum entities per packet (for future packet splitting) */
  readonly maxEntitiesPerPacket: number;
  private readonly positionThreshold: number;
  private readonly velocityThreshold: number;

  // Bandwidth tracking
  private bytesSent: number = 0;
  private bytesReceived: number = 0;
  private snapshotsSent: number = 0;
  private deltasSent: number = 0;

  constructor(config: {
    snapshotInterval?: number;
    deltaThreshold?: number;
    maxEntitiesPerPacket?: number;
    positionThreshold?: number;
    velocityThreshold?: number;
  } = {}) {
    this.snapshotInterval = config.snapshotInterval ?? 100; // Full snapshot every 100 ticks
    this.deltaThreshold = config.deltaThreshold ?? 0.01;
    this.maxEntitiesPerPacket = config.maxEntitiesPerPacket ?? 50;
    this.positionThreshold = config.positionThreshold ?? 0.1;
    this.velocityThreshold = config.velocityThreshold ?? 0.1;
  }

  /**
   * Register an entity for synchronization.
   */
  registerEntity(entity: EntityId, priority: SyncPriority = SyncPriority.Medium): void {
    this.entities.set(entity, {
      entity,
      priority,
      lastSyncTick: 0,
      lastState: null,
      dirty: true,
    });
  }

  /**
   * Unregister an entity from synchronization.
   */
  unregisterEntity(entity: EntityId): void {
    this.entities.delete(entity);
  }

  /**
   * Set entity priority.
   */
  setEntityPriority(entity: EntityId, priority: SyncPriority): void {
    const config = this.entities.get(entity);
    if (config) {
      config.priority = priority;
    }
  }

  /**
   * Mark entity as dirty (needs sync).
   */
  markDirty(entity: EntityId): void {
    const config = this.entities.get(entity);
    if (config) {
      config.dirty = true;
    }
  }

  /**
   * Update entity state.
   */
  updateEntityState(entity: EntityId, state: INetworkEntityState): void {
    const config = this.entities.get(entity);
    if (!config) {
      this.registerEntity(entity);
      this.updateEntityState(entity, state);
      return;
    }

    // Check if state changed significantly
    if (config.lastState) {
      const changed = this.hasSignificantChange(config.lastState, state);
      if (changed) {
        config.dirty = true;
      }
    } else {
      config.dirty = true;
    }

    config.lastState = { ...state };
  }

  /**
   * Check if entity state changed significantly.
   */
  private hasSignificantChange(
    oldState: INetworkEntityState,
    newState: INetworkEntityState
  ): boolean {
    const dx = Math.abs(newState.x - oldState.x);
    const dy = Math.abs(newState.y - oldState.y);
    const dvx = Math.abs(newState.velocityX - oldState.velocityX);
    const dvy = Math.abs(newState.velocityY - oldState.velocityY);

    if (dx > this.positionThreshold || dy > this.positionThreshold) {
      return true;
    }

    if (dvx > this.velocityThreshold || dvy > this.velocityThreshold) {
      return true;
    }

    if (oldState.health !== newState.health) {
      return true;
    }

    if (oldState.state !== newState.state) {
      return true;
    }

    return false;
  }

  /**
   * Create a full state snapshot.
   */
  createSnapshot(
    waveNumber: number,
    xpOrbs: Array<{ x: number; y: number; value: number }>
  ): IStateSnapshot {
    const entities: INetworkEntityState[] = [];

    for (const config of this.entities.values()) {
      if (config.lastState) {
        entities.push({ ...config.lastState });
        config.lastSyncTick = this.currentTick;
        config.dirty = false;
      }
    }

    const snapshot: IStateSnapshot = {
      tick: this.currentTick,
      timestamp: performance.now(),
      entities,
      waveNumber,
      xpOrbs,
    };

    this.previousSnapshot = snapshot;
    this.snapshotsSent++;

    return snapshot;
  }

  /**
   * Create a delta update (only changed entities).
   */
  createDelta(): IStateDelta | null {
    const added: INetworkEntityState[] = [];
    const updated: Array<{ entity: EntityId; changes: Partial<INetworkEntityState> }> = [];
    const removed: EntityId[] = [];

    // Find entities to sync based on priority and dirty flag
    for (const config of this.entities.values()) {
      if (!this.shouldSyncEntity(config)) {
        continue;
      }

      if (config.lastState) {
        if (!this.previousSnapshot) {
          // No previous snapshot - treat as added
          added.push({ ...config.lastState });
        } else {
          // Find in previous snapshot
          const prevState = this.previousSnapshot.entities.find(
            (e) => e.entity === config.entity
          );

          if (!prevState) {
            // New entity
            added.push({ ...config.lastState });
          } else {
            // Check for changes
            const changes = this.getChanges(prevState, config.lastState);
            if (Object.keys(changes).length > 0) {
              updated.push({ entity: config.entity, changes });
            }
          }
        }

        config.lastSyncTick = this.currentTick;
        config.dirty = false;
      }
    }

    // Find removed entities
    if (this.previousSnapshot) {
      for (const prevEntity of this.previousSnapshot.entities) {
        if (!this.entities.has(prevEntity.entity)) {
          removed.push(prevEntity.entity);
        }
      }
    }

    // Only create delta if there are changes
    if (added.length === 0 && updated.length === 0 && removed.length === 0) {
      return null;
    }

    const delta: IStateDelta = {
      tick: this.currentTick,
      timestamp: performance.now(),
      added,
      updated,
      removed,
    };

    this.deltasSent++;
    return delta;
  }

  /**
   * Check if entity should be synced this tick based on priority.
   */
  private shouldSyncEntity(config: IEntitySyncConfig): boolean {
    if (!config.dirty) {
      return false;
    }

    const ticksSinceSync = this.currentTick - config.lastSyncTick;
    const syncInterval = 1 << config.priority; // 1, 2, 4, 8 ticks

    return ticksSinceSync >= syncInterval;
  }

  /**
   * Get changes between two states.
   */
  private getChanges(
    oldState: INetworkEntityState,
    newState: INetworkEntityState
  ): Partial<INetworkEntityState> {
    const changes: Partial<INetworkEntityState> = {};

    if (Math.abs(newState.x - oldState.x) > this.deltaThreshold) {
      changes.x = newState.x;
    }
    if (Math.abs(newState.y - oldState.y) > this.deltaThreshold) {
      changes.y = newState.y;
    }
    if (Math.abs(newState.velocityX - oldState.velocityX) > this.deltaThreshold) {
      changes.velocityX = newState.velocityX;
    }
    if (Math.abs(newState.velocityY - oldState.velocityY) > this.deltaThreshold) {
      changes.velocityY = newState.velocityY;
    }
    if (newState.health !== oldState.health) {
      changes.health = newState.health;
    }
    if (newState.rotation !== oldState.rotation) {
      changes.rotation = newState.rotation;
    }
    if (newState.state !== oldState.state) {
      changes.state = newState.state;
    }

    return changes;
  }

  /**
   * Apply a received snapshot.
   */
  applySnapshot(snapshot: IStateSnapshot): void {
    // Update all entity states from snapshot
    for (const entityState of snapshot.entities) {
      let config = this.entities.get(entityState.entity);
      if (!config) {
        config = {
          entity: entityState.entity,
          priority: SyncPriority.Medium,
          lastSyncTick: snapshot.tick,
          lastState: null,
          dirty: false,
        };
        this.entities.set(entityState.entity, config);
      }

      config.lastState = { ...entityState };
      config.lastSyncTick = snapshot.tick;
    }

    this.previousSnapshot = snapshot;
    this.currentTick = snapshot.tick;
  }

  /**
   * Apply a received delta.
   */
  applyDelta(delta: IStateDelta): void {
    // Add new entities
    for (const entityState of delta.added) {
      this.entities.set(entityState.entity, {
        entity: entityState.entity,
        priority: SyncPriority.Medium,
        lastSyncTick: delta.tick,
        lastState: { ...entityState },
        dirty: false,
      });
    }

    // Update existing entities
    for (const update of delta.updated) {
      const config = this.entities.get(update.entity);
      if (config && config.lastState) {
        Object.assign(config.lastState, update.changes);
        config.lastSyncTick = delta.tick;
      }
    }

    // Remove entities
    for (const entity of delta.removed) {
      this.entities.delete(entity);
    }

    this.currentTick = delta.tick;
  }

  /**
   * Serialize snapshot to binary.
   */
  serializeSnapshot(snapshot: IStateSnapshot): Uint8Array {
    const data = NetworkMessages.encode(NetMessageType.StateSnapshot, snapshot);
    this.bytesSent += data.length;
    return data;
  }

  /**
   * Deserialize snapshot from binary.
   */
  deserializeSnapshot(data: Uint8Array): IStateSnapshot {
    this.bytesReceived += data.length;
    return NetworkMessages.decode(NetMessageType.StateSnapshot, data);
  }

  /**
   * Serialize delta to binary.
   */
  serializeDelta(delta: IStateDelta): Uint8Array {
    const data = NetworkMessages.encode(NetMessageType.StateDelta, delta);
    this.bytesSent += data.length;
    return data;
  }

  /**
   * Deserialize delta from binary.
   */
  deserializeDelta(data: Uint8Array): IStateDelta {
    this.bytesReceived += data.length;
    return NetworkMessages.decode(NetMessageType.StateDelta, data);
  }

  /**
   * Update tick counter.
   */
  tick(): void {
    this.currentTick++;
  }

  /**
   * Get current tick.
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Set current tick (for synchronization).
   */
  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Should send full snapshot this tick?
   */
  shouldSendSnapshot(): boolean {
    return this.currentTick % this.snapshotInterval === 0;
  }

  /**
   * Get all entity states.
   */
  getAllEntityStates(): INetworkEntityState[] {
    const states: INetworkEntityState[] = [];

    for (const config of this.entities.values()) {
      if (config.lastState) {
        states.push({ ...config.lastState });
      }
    }

    return states;
  }

  /**
   * Get entity state by ID.
   */
  getEntityState(entity: EntityId): INetworkEntityState | null {
    return this.entities.get(entity)?.lastState ?? null;
  }

  /**
   * Get bandwidth statistics.
   */
  getStats(): {
    bytesSent: number;
    bytesReceived: number;
    snapshotsSent: number;
    deltasSent: number;
    entityCount: number;
    dirtyEntityCount: number;
  } {
    let dirtyCount = 0;
    for (const config of this.entities.values()) {
      if (config.dirty) dirtyCount++;
    }

    return {
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
      snapshotsSent: this.snapshotsSent,
      deltasSent: this.deltasSent,
      entityCount: this.entities.size,
      dirtyEntityCount: dirtyCount,
    };
  }

  /**
   * Reset bandwidth statistics.
   */
  resetStats(): void {
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.snapshotsSent = 0;
    this.deltasSent = 0;
  }

  /**
   * Clear all sync data.
   */
  clear(): void {
    this.entities.clear();
    this.previousSnapshot = null;
    this.currentTick = 0;
  }

  /**
   * Get entities by priority.
   */
  getEntitiesByPriority(priority: SyncPriority): EntityId[] {
    const entities: EntityId[] = [];

    for (const config of this.entities.values()) {
      if (config.priority === priority) {
        entities.push(config.entity);
      }
    }

    return entities;
  }

  /**
   * Estimate bandwidth usage for current state.
   */
  estimateBandwidth(): {
    snapshotSize: number;
    deltaSize: number;
    estimatedBps: number;
  } {
    // Rough estimates based on entity count
    const entityCount = this.entities.size;
    const entitySize = 21; // Bytes per entity state

    const snapshotSize = 18 + (entityCount * entitySize); // Header + entities
    const dirtyCount = Array.from(this.entities.values())
      .filter((c) => c.dirty).length;
    const deltaSize = 20 + (dirtyCount * 12); // Rough estimate for deltas

    // Assuming 20Hz tick rate
    const tickRate = 20;
    const estimatedBps = (deltaSize * tickRate) + (snapshotSize / this.snapshotInterval * tickRate);

    return {
      snapshotSize,
      deltaSize,
      estimatedBps,
    };
  }
}
