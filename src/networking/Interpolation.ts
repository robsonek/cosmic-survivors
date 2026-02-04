/**
 * Entity Interpolation for Cosmic Survivors.
 * Handles smooth rendering of remote entities between network updates.
 */

import { IInterpolation, INetworkEntityState } from '../shared/interfaces/INetworking';
import type { EntityId } from '../shared/interfaces/IWorld';

/**
 * Default interpolation delay in milliseconds.
 */
const DEFAULT_INTERPOLATION_DELAY = 100;

/**
 * Maximum snapshot buffer size per entity.
 */
const MAX_BUFFER_SIZE = 30;

/**
 * Snapshot with timestamp.
 */
interface ITimestampedSnapshot {
  state: INetworkEntityState;
  timestamp: number;
}

/**
 * Entity interpolation buffer.
 */
interface IEntityBuffer {
  entity: EntityId;
  snapshots: ITimestampedSnapshot[];
  lastInterpolatedState: INetworkEntityState | null;
}

/**
 * Interpolation - Entity interpolation system.
 */
export class Interpolation implements IInterpolation {
  private entities: Map<EntityId, IEntityBuffer> = new Map();
  private interpolationDelay: number;
  private maxBufferSize: number;

  constructor(config: {
    interpolationDelay?: number;
    maxBufferSize?: number;
  } = {}) {
    this.interpolationDelay = config.interpolationDelay ?? DEFAULT_INTERPOLATION_DELAY;
    this.maxBufferSize = config.maxBufferSize ?? MAX_BUFFER_SIZE;
  }

  /**
   * Set interpolation delay.
   */
  setInterpolationDelay(delay: number): void {
    this.interpolationDelay = delay;
  }

  /**
   * Get current interpolation delay.
   */
  getInterpolationDelay(): number {
    return this.interpolationDelay;
  }

  /**
   * Add a state snapshot for an entity.
   */
  addSnapshot(entity: EntityId, state: INetworkEntityState, timestamp: number): void {
    let buffer = this.entities.get(entity);

    if (!buffer) {
      buffer = {
        entity,
        snapshots: [],
        lastInterpolatedState: null,
      };
      this.entities.set(entity, buffer);
    }

    // Add snapshot to buffer
    buffer.snapshots.push({ state, timestamp });

    // Keep buffer sorted by timestamp
    buffer.snapshots.sort((a, b) => a.timestamp - b.timestamp);

    // Trim buffer if too large
    while (buffer.snapshots.length > this.maxBufferSize) {
      buffer.snapshots.shift();
    }
  }

  /**
   * Get interpolated state at render time.
   * Render time should be (current time - interpolation delay).
   */
  getState(entity: EntityId, renderTime: number): INetworkEntityState | null {
    const buffer = this.entities.get(entity);
    if (!buffer || buffer.snapshots.length === 0) {
      return null;
    }

    const snapshots = buffer.snapshots;

    // Find the two snapshots to interpolate between
    // We want the latest snapshot before renderTime and the earliest after
    let before: ITimestampedSnapshot | null = null;
    let after: ITimestampedSnapshot | null = null;

    for (let i = 0; i < snapshots.length; i++) {
      if (snapshots[i].timestamp <= renderTime) {
        before = snapshots[i];
      } else {
        after = snapshots[i];
        break;
      }
    }

    // Handle edge cases
    if (!before && !after) {
      return null;
    }

    if (!before) {
      // Render time is before all snapshots - use earliest
      buffer.lastInterpolatedState = { ...after!.state };
      return buffer.lastInterpolatedState;
    }

    if (!after) {
      // Render time is after all snapshots - extrapolate or use latest
      // For safety, we'll just use the latest state (no extrapolation)
      buffer.lastInterpolatedState = { ...before.state };
      return buffer.lastInterpolatedState;
    }

    // Interpolate between before and after
    const t = (renderTime - before.timestamp) / (after.timestamp - before.timestamp);
    const interpolated = this.interpolateStates(before.state, after.state, t);

    buffer.lastInterpolatedState = interpolated;
    return interpolated;
  }

  /**
   * Interpolate between two states.
   */
  private interpolateStates(
    from: INetworkEntityState,
    to: INetworkEntityState,
    t: number
  ): INetworkEntityState {
    // Clamp t to valid range
    t = Math.max(0, Math.min(1, t));

    return {
      entity: to.entity,
      x: this.lerp(from.x, to.x, t),
      y: this.lerp(from.y, to.y, t),
      velocityX: this.lerp(from.velocityX, to.velocityX, t),
      velocityY: this.lerp(from.velocityY, to.velocityY, t),
      health: from.health !== undefined && to.health !== undefined
        ? this.lerp(from.health, to.health, t)
        : to.health,
      rotation: from.rotation !== undefined && to.rotation !== undefined
        ? this.lerpAngle(from.rotation, to.rotation, t)
        : to.rotation,
      state: to.state, // State is not interpolated
    };
  }

  /**
   * Linear interpolation.
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Angle interpolation (handles wrap-around).
   */
  private lerpAngle(a: number, b: number, t: number): number {
    // Normalize angles to -PI to PI
    const normalize = (angle: number): number => {
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    };

    a = normalize(a);
    b = normalize(b);

    // Find shortest path
    let diff = b - a;
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    return normalize(a + diff * t);
  }

  /**
   * Clear old snapshots before a timestamp.
   */
  clearOld(beforeTimestamp: number): void {
    for (const buffer of this.entities.values()) {
      // Keep at least 2 snapshots for interpolation
      while (buffer.snapshots.length > 2 && buffer.snapshots[0].timestamp < beforeTimestamp) {
        buffer.snapshots.shift();
      }
    }
  }

  /**
   * Remove an entity from interpolation.
   */
  removeEntity(entity: EntityId): void {
    this.entities.delete(entity);
  }

  /**
   * Clear all interpolation data.
   */
  clear(): void {
    this.entities.clear();
  }

  /**
   * Get buffer statistics for an entity.
   */
  getBufferStats(entity: EntityId): {
    snapshotCount: number;
    oldestTimestamp: number;
    newestTimestamp: number;
    bufferLength: number;
  } | null {
    const buffer = this.entities.get(entity);
    if (!buffer || buffer.snapshots.length === 0) {
      return null;
    }

    const oldest = buffer.snapshots[0].timestamp;
    const newest = buffer.snapshots[buffer.snapshots.length - 1].timestamp;

    return {
      snapshotCount: buffer.snapshots.length,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      bufferLength: newest - oldest,
    };
  }

  /**
   * Get all tracked entities.
   */
  getTrackedEntities(): EntityId[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Check if entity has enough snapshots for interpolation.
   */
  hasEnoughSnapshots(entity: EntityId): boolean {
    const buffer = this.entities.get(entity);
    return buffer !== null && buffer !== undefined && buffer.snapshots.length >= 2;
  }

  /**
   * Get the latest snapshot for an entity (without interpolation).
   */
  getLatestSnapshot(entity: EntityId): INetworkEntityState | null {
    const buffer = this.entities.get(entity);
    if (!buffer || buffer.snapshots.length === 0) {
      return null;
    }

    return buffer.snapshots[buffer.snapshots.length - 1].state;
  }

  /**
   * Calculate the render time based on current time.
   */
  getRenderTime(currentTime: number): number {
    return currentTime - this.interpolationDelay;
  }

  /**
   * Get global interpolation statistics.
   */
  getStats(): {
    entityCount: number;
    totalSnapshots: number;
    averageBufferSize: number;
  } {
    let totalSnapshots = 0;

    for (const buffer of this.entities.values()) {
      totalSnapshots += buffer.snapshots.length;
    }

    return {
      entityCount: this.entities.size,
      totalSnapshots,
      averageBufferSize: this.entities.size > 0
        ? totalSnapshots / this.entities.size
        : 0,
    };
  }

  /**
   * Extrapolate position for an entity (for when we're ahead of server).
   * Use with caution - extrapolation can cause visual artifacts.
   */
  extrapolatePosition(
    entity: EntityId,
    extrapolationTime: number
  ): { x: number; y: number } | null {
    const buffer = this.entities.get(entity);
    if (!buffer || buffer.snapshots.length === 0) {
      return null;
    }

    const latest = buffer.snapshots[buffer.snapshots.length - 1].state;

    // Extrapolate based on velocity
    const extrapolationSeconds = extrapolationTime / 1000;
    return {
      x: latest.x + latest.velocityX * extrapolationSeconds,
      y: latest.y + latest.velocityY * extrapolationSeconds,
    };
  }

  /**
   * Smoothly blend from current visual position to interpolated position.
   * Useful after large corrections to avoid visual snapping.
   */
  smoothCorrection(
    _entity: EntityId,
    currentVisualPosition: { x: number; y: number },
    targetState: INetworkEntityState,
    blendFactor: number = 0.1
  ): { x: number; y: number } {
    return {
      x: this.lerp(currentVisualPosition.x, targetState.x, blendFactor),
      y: this.lerp(currentVisualPosition.y, targetState.y, blendFactor),
    };
  }
}
