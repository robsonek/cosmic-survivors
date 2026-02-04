/**
 * WeaponFactory - Factory for creating projectiles and weapon effects.
 *
 * Creates:
 * - Projectiles for projectile weapons
 * - Melee hitboxes for melee weapons
 * - Area effects for area weapons
 * - Passive effects for passive weapons
 * - Summons for summon weapons
 */

import { addComponent, hasComponent } from 'bitecs';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus, WeaponFiredEvent } from '../shared/interfaces/IEventBus';
import { DamageType, GameEvents } from '../shared/interfaces/IEventBus';
import type { IWeaponDefinition, IWeaponStats, IProjectileConfig } from '../shared/interfaces/IWeapon';
import { CollisionLayer, CollisionMasks } from '../shared/interfaces/IPhysics';
import {
  Position,
  Velocity,
  Projectile,
  CircleCollider,
  Sprite,
  Tags,
  Health,
} from '../shared/types/components';
import { PROJECTILE_DEFAULT_LIFETIME } from '../shared/constants/game';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { DamageSystem } from '../combat/DamageSystem';

/**
 * Configuration for creating a melee hitbox.
 */
interface MeleeHitboxConfig {
  owner: EntityId;
  damage: number;
  damageType: DamageType;
  width: number;
  height: number;
  duration: number;
  knockback: number;
}

/**
 * Configuration for creating an area effect.
 */
interface AreaEffectConfig {
  owner: EntityId;
  damage: number;
  damageType: DamageType;
  radius: number;
  duration: number;
  tickRate: number; // Damage ticks per second
}

/**
 * WeaponFactory - Creates weapon effects and projectiles.
 */
export class WeaponFactory {
  private world!: IWorld;
  private eventBus!: IEventBus;
  private spatialHash!: SpatialHash;
  private damageSystem!: DamageSystem;

  // Track active area effects for tick processing
  private areaEffects: Map<EntityId, AreaEffectConfig & { lastTick: number }> = new Map();

  // Track active melee hitboxes
  private meleeHitboxes: Map<EntityId, MeleeHitboxConfig & { hitEntities: Set<EntityId>; elapsed: number }> = new Map();

  constructor(
    eventBus: IEventBus,
    spatialHash: SpatialHash,
    damageSystem: DamageSystem
  ) {
    this.eventBus = eventBus;
    this.spatialHash = spatialHash;
    this.damageSystem = damageSystem;
  }

  /**
   * Initialize with world reference.
   */
  init(world: IWorld): void {
    this.world = world;
  }

  /**
   * Update factory (process melee hitboxes and area effects).
   */
  update(dt: number): void {
    this.updateMeleeHitboxes(dt);
    this.updateAreaEffects(dt);
  }

  /**
   * Create projectile from config.
   */
  createProjectile(config: IProjectileConfig): EntityId {
    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    // Add Position component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = config.x;
    Position.y[entity] = config.y;

    // Add Velocity component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Velocity, entity);
    Velocity.x[entity] = config.velocityX;
    Velocity.y[entity] = config.velocityY;

    // Add Projectile component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Projectile, entity);
    Projectile.damage[entity] = config.damage;
    Projectile.damageType[entity] = this.getDamageTypeNumber(config.damageType);
    Projectile.pierce[entity] = config.pierce;
    Projectile.lifetime[entity] = config.lifetime;
    Projectile.ownerEntity[entity] = config.owner;
    Projectile.weaponId[entity] = this.getWeaponIdNumber(config.weaponId);
    Projectile.hitEntities[entity] = 0;

    // Add CircleCollider component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], CircleCollider, entity);
    CircleCollider.radius[entity] = 5; // Default projectile radius
    CircleCollider.offsetX[entity] = 0;
    CircleCollider.offsetY[entity] = 0;
    CircleCollider.layer[entity] = CollisionLayer.PlayerProjectile;
    CircleCollider.mask[entity] = CollisionMasks.PlayerProjectile;
    CircleCollider.isTrigger[entity] = 1;

    // Add Projectile tag
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Projectile, entity);

    // Add Sprite component (optional visual)
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Sprite, entity);
    Sprite.textureId[entity] = this.getSpriteId(config.spriteKey);
    Sprite.width[entity] = 10;
    Sprite.height[entity] = 10;
    Sprite.originX[entity] = 0.5;
    Sprite.originY[entity] = 0.5;
    Sprite.alpha[entity] = 1;
    Sprite.visible[entity] = 1;
    Sprite.layer[entity] = 5; // Projectile layer

    return entity;
  }

  /**
   * Create projectiles for a weapon firing.
   */
  createProjectilesForWeapon(
    owner: EntityId,
    definition: IWeaponDefinition,
    stats: IWeaponStats,
    position: { x: number; y: number },
    direction: { x: number; y: number }
  ): EntityId[] {
    const projectiles: EntityId[] = [];
    const count = stats.projectileCount ?? 1;
    const speed = stats.projectileSpeed ?? 300;
    const damage = stats.damage;
    const pierce = stats.pierce ?? 0;
    const lifetime = PROJECTILE_DEFAULT_LIFETIME;

    // Spread angle for multiple projectiles (in radians)
    const spreadAngle = Math.PI / 8; // 22.5 degrees
    const baseAngle = Math.atan2(direction.y, direction.x);

    for (let i = 0; i < count; i++) {
      // Calculate angle offset for this projectile
      let angle = baseAngle;
      if (count > 1) {
        const offset = (i / (count - 1) - 0.5) * spreadAngle * (count - 1);
        angle = baseAngle + offset;
      }

      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      const config: IProjectileConfig = {
        weaponId: definition.id,
        owner,
        x: position.x,
        y: position.y,
        velocityX,
        velocityY,
        damage,
        damageType: stats.damageType,
        pierce,
        lifetime,
        spriteKey: definition.projectileKey ?? 'projectile_default',
      };

      const entity = this.createProjectile(config);
      projectiles.push(entity);
    }

    // Emit weapon fired event
    this.emitWeaponFired(owner, definition.id, position, direction, count);

    return projectiles;
  }

  /**
   * Create melee hitbox for melee weapon.
   */
  createMeleeHitbox(
    owner: EntityId,
    definition: IWeaponDefinition,
    stats: IWeaponStats,
    direction: { x: number; y: number }
  ): EntityId {
    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    const ownerX = Position.x[owner];
    const ownerY = Position.y[owner];

    // Position hitbox in front of owner
    const offsetDistance = 30;
    const x = ownerX + direction.x * offsetDistance;
    const y = ownerY + direction.y * offsetDistance;

    // Add Position component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = x;
    Position.y[entity] = y;

    // Add CircleCollider component (using circle for simplicity)
    const area = stats.area ?? 40;
    addComponent(rawWorld as Parameters<typeof addComponent>[0], CircleCollider, entity);
    CircleCollider.radius[entity] = area;
    CircleCollider.offsetX[entity] = 0;
    CircleCollider.offsetY[entity] = 0;
    CircleCollider.layer[entity] = CollisionLayer.PlayerProjectile;
    CircleCollider.mask[entity] = CollisionMasks.PlayerProjectile;
    CircleCollider.isTrigger[entity] = 1;

    // Track this hitbox
    const config: MeleeHitboxConfig & { hitEntities: Set<EntityId>; elapsed: number } = {
      owner,
      damage: stats.damage,
      damageType: stats.damageType,
      width: area * 2,
      height: area,
      duration: stats.duration ?? 0.2,
      knockback: stats.knockback ?? 0,
      hitEntities: new Set(),
      elapsed: 0,
    };
    this.meleeHitboxes.set(entity, config);

    // Add to spatial hash
    this.spatialHash.insert(entity, x, y, area, CollisionLayer.PlayerProjectile);

    // Emit weapon fired event
    this.emitWeaponFired(owner, definition.id, { x: ownerX, y: ownerY }, direction, 1);

    return entity;
  }

  /**
   * Create area effect for area weapon.
   */
  createAreaEffect(
    owner: EntityId,
    definition: IWeaponDefinition,
    stats: IWeaponStats
  ): EntityId {
    // Check if owner already has this area effect active
    for (const [entity, config] of this.areaEffects) {
      if (config.owner === owner) {
        // Refresh the duration
        return entity;
      }
    }

    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    const x = Position.x[owner];
    const y = Position.y[owner];
    const radius = stats.area ?? 50;

    // Add Position component (will follow owner)
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = x;
    Position.y[entity] = y;

    // Track this area effect
    const config: AreaEffectConfig & { lastTick: number } = {
      owner,
      damage: stats.damage,
      damageType: stats.damageType,
      radius,
      duration: stats.duration ?? 1,
      tickRate: 4, // 4 times per second
      lastTick: 0,
    };
    this.areaEffects.set(entity, config);

    // Emit weapon fired event
    this.emitWeaponFired(owner, definition.id, { x, y }, { x: 0, y: 0 }, 1);

    return entity;
  }

  /**
   * Create passive effect.
   */
  createPassiveEffect(
    owner: EntityId,
    definition: IWeaponDefinition,
    stats: IWeaponStats
  ): void {
    // Passive effects are handled as persistent area effects
    this.createAreaEffect(owner, definition, stats);
  }

  /**
   * Create summon (placeholder - would create minion entity).
   */
  createSummon(
    owner: EntityId,
    definition: IWeaponDefinition,
    _stats: IWeaponStats,
    position: { x: number; y: number }
  ): EntityId {
    // Placeholder - would create a minion entity with AI
    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    // Add Position
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = position.x + (Math.random() - 0.5) * 50;
    Position.y[entity] = position.y + (Math.random() - 0.5) * 50;

    // Emit weapon fired event
    this.emitWeaponFired(owner, definition.id, position, { x: 0, y: 0 }, 1);

    return entity;
  }

  /**
   * Update melee hitboxes.
   */
  private updateMeleeHitboxes(dt: number): void {
    const rawWorld = this.world.raw;
    const toRemove: EntityId[] = [];

    for (const [entity, config] of this.meleeHitboxes) {
      config.elapsed += dt;

      // Check for hits
      const x = Position.x[entity];
      const y = Position.y[entity];
      const nearby = this.spatialHash.queryRadiusWithLayer(x, y, config.width / 2, CollisionLayer.Enemy);

      for (const target of nearby) {
        if (config.hitEntities.has(target)) continue;

        if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, target) &&
            !hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, target)) {
          // Deal damage
          this.damageSystem.dealDamage(
            config.owner,
            target,
            config.damage,
            config.damageType,
            true
          );
          config.hitEntities.add(target);
        }
      }

      // Check if expired
      if (config.elapsed >= config.duration) {
        toRemove.push(entity);
      }
    }

    // Remove expired hitboxes
    for (const entity of toRemove) {
      this.meleeHitboxes.delete(entity);
      this.spatialHash.remove(entity);
      this.world.removeEntity(entity);
    }
  }

  /**
   * Update area effects.
   */
  private updateAreaEffects(dt: number): void {
    const rawWorld = this.world.raw;
    const toRemove: EntityId[] = [];

    for (const [entity, config] of this.areaEffects) {
      // Follow owner position
      if (this.world.entityExists(config.owner)) {
        Position.x[entity] = Position.x[config.owner];
        Position.y[entity] = Position.y[config.owner];
      } else {
        toRemove.push(entity);
        continue;
      }

      config.lastTick += dt;

      // Apply damage tick
      const tickInterval = 1 / config.tickRate;
      if (config.lastTick >= tickInterval) {
        config.lastTick -= tickInterval;

        const x = Position.x[entity];
        const y = Position.y[entity];
        const nearby = this.spatialHash.queryRadiusWithLayer(x, y, config.radius, CollisionLayer.Enemy);

        for (const target of nearby) {
          if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, target) &&
              !hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, target)) {
            this.damageSystem.dealDamage(
              config.owner,
              target,
              config.damage / config.tickRate, // Damage per tick
              config.damageType,
              false // Area damage doesn't crit
            );
          }
        }
      }
    }

    // Remove invalid effects
    for (const entity of toRemove) {
      this.areaEffects.delete(entity);
      this.world.removeEntity(entity);
    }
  }

  /**
   * Emit weapon fired event.
   */
  private emitWeaponFired(
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

  /**
   * Convert DamageType to number.
   */
  private getDamageTypeNumber(type: DamageType): number {
    const typeMap: Record<DamageType, number> = {
      [DamageType.Physical]: 0,
      [DamageType.Fire]: 1,
      [DamageType.Ice]: 2,
      [DamageType.Lightning]: 3,
      [DamageType.Poison]: 4,
      [DamageType.Arcane]: 5,
    };
    return typeMap[type] ?? 0;
  }

  /**
   * Convert weapon ID string to number (for storage).
   * Uses simple hash function.
   */
  private getWeaponIdNumber(weaponId: string): number {
    let hash = 0;
    for (let i = 0; i < weaponId.length; i++) {
      hash = ((hash << 5) - hash) + weaponId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 65536; // Fit in ui16
  }

  /**
   * Get sprite ID from key (placeholder - would use asset registry).
   */
  private getSpriteId(spriteKey: string): number {
    // Placeholder - would look up in texture atlas
    const spriteMap: Record<string, number> = {
      'projectile_default': 1,
      'projectile_magic': 2,
      'projectile_knife': 3,
      'projectile_fire': 4,
    };
    return spriteMap[spriteKey] ?? 1;
  }

  /**
   * Clean up all active effects.
   */
  destroy(): void {
    // Remove all melee hitboxes
    for (const entity of this.meleeHitboxes.keys()) {
      this.spatialHash.remove(entity);
      this.world.removeEntity(entity);
    }
    this.meleeHitboxes.clear();

    // Remove all area effects
    for (const entity of this.areaEffects.keys()) {
      this.world.removeEntity(entity);
    }
    this.areaEffects.clear();
  }
}
