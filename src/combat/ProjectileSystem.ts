/**
 * ProjectileSystem - ECS system for managing projectiles.
 *
 * Handles:
 * - Projectile lifetime and removal
 * - Collision detection with targets
 * - Pierce tracking
 * - Damage application on hit
 * - Hit effects and sounds
 */

import { defineQuery, hasComponent, enterQuery, exitQuery } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus, WeaponFiredEvent } from '../shared/interfaces/IEventBus';
import { GameEvents, DamageType } from '../shared/interfaces/IEventBus';
import { CollisionLayer } from '../shared/interfaces/IPhysics';
import {
  Position,
  Velocity,
  Projectile,
  Health,
  CircleCollider,
  Tags,
} from '../shared/types/components';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { DamageSystem } from './DamageSystem';

/**
 * Track which entities a projectile has already hit.
 */
interface ProjectileHitTracking {
  hitEntities: Set<EntityId>;
}

/**
 * ProjectileSystem - Manages all projectiles in the game.
 */
export class ProjectileSystem implements ISystem {
  public readonly name = 'ProjectileSystem';
  public readonly priority = 25; // After collision, before damage processing
  public readonly dependencies: string[] = ['CollisionSystem'];
  public enabled = true;

  private world!: IWorld;
  private eventBus!: IEventBus;
  private spatialHash!: SpatialHash;
  private damageSystem!: DamageSystem;

  // Query for projectile entities
  private projectileQuery!: ReturnType<typeof defineQuery>;
  private projectileEnterQuery!: ReturnType<typeof enterQuery>;
  private projectileExitQuery!: ReturnType<typeof exitQuery>;

  // Track projectile hits (for pierce functionality)
  private hitTracking: Map<EntityId, ProjectileHitTracking> = new Map();

  // Entities to remove at end of frame
  private entitiesToRemove: EntityId[] = [];

  constructor(
    eventBus: IEventBus,
    spatialHash: SpatialHash,
    damageSystem: DamageSystem
  ) {
    this.eventBus = eventBus;
    this.spatialHash = spatialHash;
    this.damageSystem = damageSystem;
  }

  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.projectileQuery = defineQuery([Position, Velocity, Projectile]);
    this.projectileEnterQuery = enterQuery(this.projectileQuery);
    this.projectileExitQuery = exitQuery(this.projectileQuery);
  }

  /**
   * Main update - process all projectiles.
   */
  update(dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;
    this.entitiesToRemove.length = 0;

    // Handle new projectiles
    this.handleNewProjectiles(rawWorld);

    // Handle removed projectiles
    this.handleRemovedProjectiles(rawWorld);

    // Update all projectiles
    const projectiles = this.projectileQuery(rawWorld);

    for (const entity of projectiles) {
      // Update position based on velocity
      Position.x[entity] += Velocity.x[entity] * dt;
      Position.y[entity] += Velocity.y[entity] * dt;

      // Update spatial hash
      const radius = this.getProjectileRadius(entity);
      this.spatialHash.update(
        entity,
        Position.x[entity],
        Position.y[entity],
        radius,
        this.getProjectileCollisionLayer(entity)
      );

      // Update lifetime
      Projectile.lifetime[entity] -= dt;

      // Check if expired
      if (Projectile.lifetime[entity] <= 0) {
        this.entitiesToRemove.push(entity);
        continue;
      }

      // Check for collisions
      this.checkCollisions(entity, rawWorld);
    }

    // Remove expired/used projectiles
    for (const entity of this.entitiesToRemove) {
      this.removeProjectile(entity);
    }
  }

  /**
   * Handle newly created projectiles.
   */
  private handleNewProjectiles(rawWorld: object): void {
    const entered = this.projectileEnterQuery(rawWorld);

    for (const entity of entered) {
      // Initialize hit tracking
      this.hitTracking.set(entity, { hitEntities: new Set() });

      // Add to spatial hash
      const radius = this.getProjectileRadius(entity);
      this.spatialHash.insert(
        entity,
        Position.x[entity],
        Position.y[entity],
        radius,
        this.getProjectileCollisionLayer(entity)
      );
    }
  }

  /**
   * Handle removed projectiles.
   */
  private handleRemovedProjectiles(rawWorld: object): void {
    const exited = this.projectileExitQuery(rawWorld);

    for (const entity of exited) {
      this.hitTracking.delete(entity);
      this.spatialHash.remove(entity);
    }
  }

  /**
   * Check for collisions with valid targets.
   */
  private checkCollisions(projectile: EntityId, rawWorld: object): void {
    const x = Position.x[projectile];
    const y = Position.y[projectile];
    const radius = this.getProjectileRadius(projectile);
    const ownerEntity = Projectile.ownerEntity[projectile];

    // Determine which layer to check against
    const isPlayerProjectile = hasComponent(
      rawWorld as Parameters<typeof hasComponent>[0],
      Tags.Player,
      ownerEntity
    );
    const targetLayer = isPlayerProjectile
      ? CollisionLayer.Enemy
      : CollisionLayer.Player;

    // Query nearby entities
    const nearby = this.spatialHash.queryRadiusWithLayer(x, y, radius + 50, targetLayer);
    const tracking = this.hitTracking.get(projectile);

    if (!tracking) return;

    for (const targetEntity of nearby) {
      // Skip if already hit this entity
      if (tracking.hitEntities.has(targetEntity)) {
        continue;
      }

      // Skip if target doesn't have health
      if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, targetEntity)) {
        continue;
      }

      // Skip dead targets
      if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, targetEntity)) {
        continue;
      }

      // Perform actual collision check
      const targetX = Position.x[targetEntity];
      const targetY = Position.y[targetEntity];
      const targetRadius = this.getEntityRadius(targetEntity, rawWorld);

      const dx = targetX - x;
      const dy = targetY - y;
      const distSq = dx * dx + dy * dy;
      const combinedRadius = radius + targetRadius;

      if (distSq <= combinedRadius * combinedRadius) {
        // Hit confirmed
        this.handleHit(projectile, targetEntity, tracking, rawWorld);

        // Check if projectile should be destroyed
        if (Projectile.pierce[projectile] <= 0) {
          this.entitiesToRemove.push(projectile);
          break;
        }
      }
    }
  }

  /**
   * Handle projectile hitting a target.
   */
  private handleHit(
    projectile: EntityId,
    target: EntityId,
    tracking: ProjectileHitTracking,
    _rawWorld: object
  ): void {
    // Mark as hit
    tracking.hitEntities.add(target);

    // Update hit entities bitmask (limited tracking via component)
    // This is a simplified bitmask - for more targets, use the Set
    const hitBit = target % 32;
    Projectile.hitEntities[projectile] |= (1 << hitBit);

    // Get damage info
    const damage = Projectile.damage[projectile];
    const damageTypeNum = Projectile.damageType[projectile];
    const damageType = this.getDamageTypeFromNumber(damageTypeNum);
    const ownerEntity = Projectile.ownerEntity[projectile];

    // Deal damage
    this.damageSystem.dealDamage(
      ownerEntity,
      target,
      damage,
      damageType,
      true // Projectiles can crit
    );

    // Decrease pierce count
    Projectile.pierce[projectile]--;
  }

  /**
   * Get projectile collision radius.
   */
  private getProjectileRadius(entity: EntityId): number {
    const rawWorld = this.world.raw;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
      return CircleCollider.radius[entity];
    }

    // Default projectile radius
    return 5;
  }

  /**
   * Get entity's collision radius.
   */
  private getEntityRadius(entity: EntityId, rawWorld: object): number {
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
      return CircleCollider.radius[entity];
    }

    // Default entity radius
    return 16;
  }

  /**
   * Get collision layer for projectile.
   */
  private getProjectileCollisionLayer(entity: EntityId): CollisionLayer {
    const rawWorld = this.world.raw;
    const ownerEntity = Projectile.ownerEntity[entity];

    const isPlayerOwned = hasComponent(
      rawWorld as Parameters<typeof hasComponent>[0],
      Tags.Player,
      ownerEntity
    );

    return isPlayerOwned
      ? CollisionLayer.PlayerProjectile
      : CollisionLayer.EnemyProjectile;
  }

  /**
   * Convert number to DamageType enum.
   */
  private getDamageTypeFromNumber(num: number): DamageType {
    const types: DamageType[] = [
      DamageType.Physical,
      DamageType.Fire,
      DamageType.Ice,
      DamageType.Lightning,
      DamageType.Poison,
      DamageType.Arcane,
    ];
    return types[num] ?? DamageType.Physical;
  }

  /**
   * Remove a projectile from the game.
   */
  private removeProjectile(entity: EntityId): void {
    this.hitTracking.delete(entity);
    this.spatialHash.remove(entity);
    this.world.removeEntity(entity);
  }

  /**
   * Get number of active projectiles.
   */
  getProjectileCount(): number {
    return this.projectileQuery(this.world.raw).length;
  }

  /**
   * Remove all projectiles.
   */
  clearAllProjectiles(): void {
    const projectiles = this.projectileQuery(this.world.raw);

    for (const entity of projectiles) {
      this.removeProjectile(entity);
    }
  }

  /**
   * Emit weapon fired event.
   * Called by WeaponSystem when creating projectiles.
   */
  emitWeaponFired(
    entity: EntityId,
    weaponId: string,
    position: { x: number; y: number },
    direction: { x: number; y: number },
    projectileCount: number
  ): void {
    const event: WeaponFiredEvent = {
      entity,
      weaponId,
      position,
      direction,
      projectileCount,
    };
    this.eventBus.emit(GameEvents.WEAPON_FIRED, event);
  }

  destroy(): void {
    this.hitTracking.clear();
    this.entitiesToRemove.length = 0;
  }
}
