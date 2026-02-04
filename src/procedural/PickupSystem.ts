/**
 * PickupSystem - ECS system for handling pickup collection.
 *
 * Features:
 * - XP orb collection and magnetism
 * - Health pickup healing
 * - Special pickup effects (magnet, bomb, clock)
 * - Collision detection using circle overlap
 *
 * Implements ISystem interface for bitECS integration.
 */

import { defineQuery } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus } from '../shared/interfaces/IEventBus';
import {
  Position,
  Velocity,
  Health,
  XPOrb,
  HealthPickup,
  Pickup,
  Player,
  StatModifiers,
  Tags,
} from '../shared/types/components';
import { distance } from '../shared/utils/math';
import {
  XP_ORB_MAGNET_SPEED,
  PLAYER_BASE_PICKUP_RADIUS,
} from '../shared/constants/game';
import { LootType } from '../shared/interfaces/IProcedural';
import type { XPSystem } from './XPSystem';

/**
 * Pickup collection event data.
 */
export interface PickupCollectedEvent {
  entity: number;        // Pickup entity
  collector: number;     // Player entity that collected
  type: LootType;
  value: number;
}

/**
 * Special effect triggered event.
 */
export interface SpecialEffectEvent {
  type: 'magnet' | 'bomb' | 'clock';
  position: { x: number; y: number };
  triggeredBy: number;
}

/**
 * PickupSystem implementation.
 */
export class PickupSystem implements ISystem {
  readonly name = 'PickupSystem';
  readonly priority = 40; // After physics, before rendering
  readonly dependencies: string[] = ['MovementSystem'];
  enabled = true;

  private world!: IWorld;
  private eventBus!: IEventBus;
  private xpSystem?: XPSystem;

  // Queries
  private playerQuery!: ReturnType<typeof defineQuery>;
  private xpOrbQuery!: ReturnType<typeof defineQuery>;
  private healthPickupQuery!: ReturnType<typeof defineQuery>;
  private genericPickupQuery!: ReturnType<typeof defineQuery>;

  // Entity tracking
  private pickupsToRemove: EntityId[] = [];

  /**
   * Initialize the system.
   */
  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.playerQuery = defineQuery([Position, Player, Tags.Player]);
    this.xpOrbQuery = defineQuery([Position, XPOrb]);
    this.healthPickupQuery = defineQuery([Position, HealthPickup]);
    this.genericPickupQuery = defineQuery([Position, Pickup]);
  }

  /**
   * Set event bus for emitting events.
   */
  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Set XP system for orb collection.
   */
  setXPSystem(xpSystem: XPSystem): void {
    this.xpSystem = xpSystem;
  }

  /**
   * Update system.
   */
  update(dt: number): void {
    const rawWorld = this.world.raw;

    // Get all players
    const players = this.playerQuery(rawWorld);
    if (players.length === 0) return;

    // Clear removal list
    this.pickupsToRemove = [];

    // Process XP orbs
    this.processXPOrbs(rawWorld, players, dt);

    // Process health pickups
    this.processHealthPickups(rawWorld, players);

    // Process generic pickups
    this.processGenericPickups(rawWorld, players, dt);

    // Remove collected pickups
    this.removeCollectedPickups();
  }

  /**
   * Process XP orb collection and magnetism.
   */
  private processXPOrbs(rawWorld: object, players: number[], dt: number): void {
    const xpOrbs = this.xpOrbQuery(rawWorld);

    for (const orb of xpOrbs) {
      const orbX = Position.x[orb];
      const orbY = Position.y[orb];
      const orbValue = XPOrb.value[orb];
      const isMagnetized = XPOrb.magnetized[orb] === 1;
      // Note: targetEntity is available in XPOrb.targetEntity[orb] when magnetized

      // Find closest player
      let closestPlayer = -1;
      let closestDistance = Infinity;
      let closestPickupRadius = PLAYER_BASE_PICKUP_RADIUS;

      for (const player of players) {
        const playerX = Position.x[player];
        const playerY = Position.y[player];
        const dist = distance(orbX, orbY, playerX, playerY);

        // Get player's pickup radius (base + modifiers)
        const bonusRadius = StatModifiers.pickupRadius ? StatModifiers.pickupRadius[player] ?? 0 : 0;
        const pickupRadius = PLAYER_BASE_PICKUP_RADIUS + bonusRadius;

        if (dist < closestDistance) {
          closestDistance = dist;
          closestPlayer = player;
          closestPickupRadius = pickupRadius;
        }
      }

      if (closestPlayer < 0) continue;

      const playerX = Position.x[closestPlayer];
      const playerY = Position.y[closestPlayer];

      // Check for collection (very close)
      if (closestDistance < 15) {
        this.collectXPOrb(orb, closestPlayer, orbValue);
        continue;
      }

      // Check for magnetism
      if (closestDistance <= closestPickupRadius || isMagnetized) {
        // Enable magnetism
        XPOrb.magnetized[orb] = 1;
        XPOrb.targetEntity[orb] = closestPlayer;

        // Calculate velocity toward player
        const dx = playerX - orbX;
        const dy = playerY - orbY;
        const factor = XP_ORB_MAGNET_SPEED / closestDistance;

        // Apply velocity if entity has velocity component
        if (Velocity.x && Velocity.y) {
          Velocity.x[orb] = dx * factor;
          Velocity.y[orb] = dy * factor;
        } else {
          // Direct position update if no velocity
          Position.x[orb] = orbX + dx * factor * dt;
          Position.y[orb] = orbY + dy * factor * dt;
        }
      }
    }
  }

  /**
   * Collect XP orb.
   */
  private collectXPOrb(orb: EntityId, player: EntityId, value: number): void {
    // Award XP through XP system
    if (this.xpSystem) {
      this.xpSystem.collectXPOrb(player, value);
    }

    // Emit collection event
    if (this.eventBus) {
      this.eventBus.emit<PickupCollectedEvent>('pickup:collected', {
        entity: orb,
        collector: player,
        type: LootType.XPOrb,
        value,
      });
    }

    // Mark for removal
    this.pickupsToRemove.push(orb);
  }

  /**
   * Process health pickup collection.
   */
  private processHealthPickups(rawWorld: object, players: number[]): void {
    const healthPickups = this.healthPickupQuery(rawWorld);

    for (const pickup of healthPickups) {
      const pickupX = Position.x[pickup];
      const pickupY = Position.y[pickup];
      const healAmount = HealthPickup.healAmount[pickup];
      const healPercent = HealthPickup.healPercent[pickup];

      for (const player of players) {
        const playerX = Position.x[player];
        const playerY = Position.y[player];

        // Check collision
        const dist = distance(pickupX, pickupY, playerX, playerY);
        const collectionRadius = 20;

        if (dist <= collectionRadius) {
          this.collectHealthPickup(pickup, player, healAmount, healPercent);
          break;
        }
      }
    }
  }

  /**
   * Collect health pickup.
   */
  private collectHealthPickup(
    pickup: EntityId,
    player: EntityId,
    healAmount: number,
    healPercent: number
  ): void {
    // Calculate healing
    const currentHealth = Health.current[player];
    const maxHealth = Health.max[player];
    let totalHeal = healAmount;

    if (healPercent > 0) {
      totalHeal += maxHealth * healPercent;
    }

    // Apply healing
    Health.current[player] = Math.min(currentHealth + totalHeal, maxHealth);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit<PickupCollectedEvent>('pickup:collected', {
        entity: pickup,
        collector: player,
        type: LootType.Health,
        value: totalHeal,
      });
    }

    this.pickupsToRemove.push(pickup);
  }

  /**
   * Process generic pickups (magnet, bomb, clock, etc).
   */
  private processGenericPickups(rawWorld: object, players: number[], dt: number): void {
    const pickups = this.genericPickupQuery(rawWorld);

    for (const pickup of pickups) {
      const pickupX = Position.x[pickup];
      const pickupY = Position.y[pickup];
      const pickupType = Pickup.type[pickup] as unknown as LootType;
      const pickupValue = Pickup.value[pickup];
      let despawnTime = Pickup.despawnTime[pickup];

      // Update despawn timer
      despawnTime -= dt;
      Pickup.despawnTime[pickup] = despawnTime;

      if (despawnTime <= 0) {
        this.pickupsToRemove.push(pickup);
        continue;
      }

      // Check player collision
      for (const player of players) {
        const playerX = Position.x[player];
        const playerY = Position.y[player];
        const dist = distance(pickupX, pickupY, playerX, playerY);
        const collectionRadius = 25;

        if (dist <= collectionRadius) {
          this.collectGenericPickup(pickup, player, pickupType, pickupValue, pickupX, pickupY);
          break;
        }
      }
    }
  }

  /**
   * Collect generic pickup and trigger effect.
   */
  private collectGenericPickup(
    pickup: EntityId,
    player: EntityId,
    type: LootType,
    value: number,
    x: number,
    y: number
  ): void {
    // Handle special pickup effects
    switch (type) {
      case LootType.Magnet:
        this.triggerMagnetEffect(player, x, y);
        break;
      case LootType.Bomb:
        this.triggerBombEffect(player, x, y);
        break;
      case LootType.Clock:
        this.triggerClockEffect(player, x, y);
        break;
      case LootType.Gold:
        // TODO: Add gold to player inventory
        break;
      case LootType.Chest:
        // Chest opens upgrade selection UI
        this.triggerChestOpen(player);
        break;
    }

    // Emit collection event
    if (this.eventBus) {
      this.eventBus.emit<PickupCollectedEvent>('pickup:collected', {
        entity: pickup,
        collector: player,
        type,
        value,
      });
    }

    this.pickupsToRemove.push(pickup);
  }

  /**
   * Trigger magnet effect - collect all XP orbs.
   */
  private triggerMagnetEffect(player: EntityId, x: number, y: number): void {
    const rawWorld = this.world.raw;
    const xpOrbs = this.xpOrbQuery(rawWorld);

    // Magnetize all XP orbs to this player
    for (const orb of xpOrbs) {
      XPOrb.magnetized[orb] = 1;
      XPOrb.targetEntity[orb] = player;
    }

    if (this.eventBus) {
      this.eventBus.emit<SpecialEffectEvent>('pickup:specialEffect', {
        type: 'magnet',
        position: { x, y },
        triggeredBy: player,
      });
    }
  }

  /**
   * Trigger bomb effect - damage all enemies.
   */
  private triggerBombEffect(player: EntityId, x: number, y: number): void {
    // Emit event for combat system to handle
    if (this.eventBus) {
      this.eventBus.emit<SpecialEffectEvent>('pickup:specialEffect', {
        type: 'bomb',
        position: { x, y },
        triggeredBy: player,
      });
    }
  }

  /**
   * Trigger clock effect - freeze enemies.
   */
  private triggerClockEffect(player: EntityId, x: number, y: number): void {
    // Emit event for AI system to handle
    if (this.eventBus) {
      this.eventBus.emit<SpecialEffectEvent>('pickup:specialEffect', {
        type: 'clock',
        position: { x, y },
        triggeredBy: player,
      });
    }
  }

  /**
   * Trigger chest open - show upgrade selection.
   */
  private triggerChestOpen(player: EntityId): void {
    // Emit event for UI system to handle
    if (this.eventBus) {
      this.eventBus.emit('pickup:chestOpen', { player });
    }
  }

  /**
   * Remove all collected pickups.
   */
  private removeCollectedPickups(): void {
    for (const entity of this.pickupsToRemove) {
      if (this.world.entityExists(entity)) {
        this.world.removeEntity(entity);
      }
    }
    this.pickupsToRemove = [];
  }

  /**
   * Cleanup system resources.
   */
  destroy(): void {
    this.pickupsToRemove = [];
  }
}

/**
 * Pickup factory for creating pickup entities.
 */
export class PickupFactory {
  private world: IWorld;

  constructor(world: IWorld) {
    this.world = world;
  }

  /**
   * Create XP orb entity.
   */
  createXPOrb(x: number, y: number, value: number): EntityId {
    const entity = this.world.createEntity();

    this.world.addComponent(entity, Position);
    Position.x[entity] = x;
    Position.y[entity] = y;

    this.world.addComponent(entity, Velocity);
    Velocity.x[entity] = 0;
    Velocity.y[entity] = 0;

    this.world.addComponent(entity, XPOrb);
    XPOrb.value[entity] = value;
    XPOrb.magnetized[entity] = 0;
    XPOrb.targetEntity[entity] = 0;

    this.world.addComponent(entity, Tags.Pickup);

    return entity;
  }

  /**
   * Create health pickup entity.
   */
  createHealthPickup(x: number, y: number, healAmount: number, healPercent: number = 0): EntityId {
    const entity = this.world.createEntity();

    this.world.addComponent(entity, Position);
    Position.x[entity] = x;
    Position.y[entity] = y;

    this.world.addComponent(entity, HealthPickup);
    HealthPickup.healAmount[entity] = healAmount;
    HealthPickup.healPercent[entity] = healPercent;

    this.world.addComponent(entity, Tags.Pickup);

    return entity;
  }

  /**
   * Create generic pickup entity.
   */
  createPickup(x: number, y: number, type: LootType, value: number, lifetime?: number): EntityId {
    const entity = this.world.createEntity();

    this.world.addComponent(entity, Position);
    Position.x[entity] = x;
    Position.y[entity] = y;

    this.world.addComponent(entity, Pickup);
    Pickup.type[entity] = this.getLootTypeValue(type);
    Pickup.value[entity] = value;
    Pickup.despawnTime[entity] = lifetime ?? 30;

    this.world.addComponent(entity, Tags.Pickup);

    return entity;
  }

  /**
   * Convert LootType enum to numeric value.
   */
  private getLootTypeValue(type: LootType): number {
    const values: Record<string, number> = {
      [LootType.XPOrb]: 0,
      [LootType.Health]: 1,
      [LootType.Magnet]: 2,
      [LootType.Chest]: 3,
      [LootType.Bomb]: 4,
      [LootType.Clock]: 5,
      [LootType.Gold]: 6,
    };
    return values[type] ?? 0;
  }
}

/**
 * Create pickup system.
 */
export function createPickupSystem(): PickupSystem {
  return new PickupSystem();
}
