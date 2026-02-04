/**
 * WeaponSystem - ECS system for managing weapons.
 *
 * Implements IWeaponSystem interface. Handles:
 * - Weapon registration and definition management
 * - Adding/removing weapons from entities
 * - Weapon upgrades and stat scaling
 * - Weapon evolution
 * - Automatic weapon firing (cooldown management)
 * - Manual weapon firing (for networked input)
 */

import { defineQuery, hasComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus } from '../shared/interfaces/IEventBus';
import type {
  IWeaponSystem,
  IWeaponDefinition,
  IWeaponInstance,
  IWeaponStats,
} from '../shared/interfaces/IWeapon';
import { WeaponCategory, WeaponTargeting } from '../shared/interfaces/IWeapon';
import { Position, Velocity, Health, Tags, StatModifiers } from '../shared/types/components';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { WeaponFactory } from '../weapons/WeaponFactory';
import { CollisionLayer } from '../shared/interfaces/IPhysics';

/**
 * WeaponSystem - Manages all weapon logic.
 */
export class WeaponSystem implements ISystem, IWeaponSystem {
  public readonly name = 'WeaponSystem';
  public readonly priority = 30; // After projectile system
  public readonly dependencies: string[] = ['ProjectileSystem'];
  public enabled = true;

  private world!: IWorld;
  private spatialHash!: SpatialHash;
  private weaponFactory!: WeaponFactory;

  // Weapon definitions registry
  private definitions: Map<string, IWeaponDefinition> = new Map();

  // Entity weapon instances
  private entityWeapons: Map<EntityId, Map<string, IWeaponInstance>> = new Map();

  // Query for entities that can have weapons (players)
  private playerQuery!: ReturnType<typeof defineQuery>;

  // Query for potential targets (enemies) - reserved for future use
  // @ts-ignore - Reserved for advanced targeting
  private enemyQuery!: ReturnType<typeof defineQuery>;

  constructor(
    _eventBus: IEventBus,
    spatialHash: SpatialHash
  ) {
    this.spatialHash = spatialHash;
  }

  /**
   * Set the weapon factory (called after factory is created).
   */
  setWeaponFactory(factory: WeaponFactory): void {
    this.weaponFactory = factory;
  }

  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.playerQuery = defineQuery([Position, Health, Tags.Player]);
    this.enemyQuery = defineQuery([Position, Health, Tags.Enemy]);
  }

  /**
   * Main update - process weapon cooldowns and auto-firing.
   */
  update(dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;
    const players = this.playerQuery(rawWorld);

    for (const entity of players) {
      const weapons = this.entityWeapons.get(entity);
      if (!weapons) continue;

      // Update each weapon
      for (const [_weaponId, instance] of weapons) {
        // Update cooldown
        if (instance.currentCooldown > 0) {
          instance.currentCooldown -= dt;
        }

        // Auto-fire if ready
        if (instance.currentCooldown <= 0) {
          this.autoFireWeapon(entity, instance);
        }
      }
    }
  }

  /**
   * Auto-fire a weapon based on its targeting type.
   */
  private autoFireWeapon(entity: EntityId, instance: IWeaponInstance): void {
    const definition = this.definitions.get(instance.definitionId);
    if (!definition) return;

    const x = Position.x[entity];
    const y = Position.y[entity];

    // Find target based on targeting type
    let target: { x: number; y: number } | null = null;

    switch (definition.targeting) {
      case WeaponTargeting.Closest:
        target = this.findClosestEnemy(x, y, instance.stats.range);
        break;

      case WeaponTargeting.Random:
        target = this.findRandomEnemy(x, y, instance.stats.range);
        break;

      case WeaponTargeting.HighestHP:
        target = this.findHighestHPEnemy(x, y, instance.stats.range);
        break;

      case WeaponTargeting.LowestHP:
        target = this.findLowestHPEnemy(x, y, instance.stats.range);
        break;

      case WeaponTargeting.Directional:
        target = this.getDirectionalTarget(entity);
        break;

      case WeaponTargeting.Area:
        // Area weapons don't need a specific target
        target = { x, y };
        break;
    }

    // Fire if we have a valid target (or it's an area weapon)
    if (target || definition.targeting === WeaponTargeting.Area) {
      this.executeWeaponFire(entity, instance, target ?? { x, y });
    }
  }

  /**
   * Execute weapon firing logic.
   */
  private executeWeaponFire(
    entity: EntityId,
    instance: IWeaponInstance,
    target: { x: number; y: number }
  ): void {
    const definition = this.definitions.get(instance.definitionId);
    if (!definition || !this.weaponFactory) return;

    const x = Position.x[entity];
    const y = Position.y[entity];

    // Calculate direction to target
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 0;
    const dirY = dist > 0 ? dy / dist : 1;

    // Apply stat modifiers from entity
    const stats = this.getModifiedStats(entity, instance.stats);

    // Fire based on weapon category
    switch (definition.category) {
      case WeaponCategory.Projectile:
        this.weaponFactory.createProjectilesForWeapon(
          entity,
          definition,
          stats,
          { x, y },
          { x: dirX, y: dirY }
        );
        break;

      case WeaponCategory.Melee:
        this.weaponFactory.createMeleeHitbox(
          entity,
          definition,
          stats,
          { x: dirX, y: dirY }
        );
        break;

      case WeaponCategory.Area:
        this.weaponFactory.createAreaEffect(
          entity,
          definition,
          stats
        );
        break;

      case WeaponCategory.Passive:
        // Passive weapons are handled differently (auras, thorns, etc.)
        this.weaponFactory.createPassiveEffect(
          entity,
          definition,
          stats
        );
        break;

      case WeaponCategory.Summon:
        // Summon weapons create minions
        this.weaponFactory.createSummon(
          entity,
          definition,
          stats,
          { x, y }
        );
        break;
    }

    // Apply cooldown (with cooldown reduction)
    const cooldownReduction = this.getCooldownReduction(entity);
    const adjustedCooldown = stats.cooldown * (1 - cooldownReduction);
    instance.currentCooldown = Math.max(0.1, adjustedCooldown);
  }

  /**
   * Get stat modifiers from entity.
   */
  private getModifiedStats(entity: EntityId, baseStats: IWeaponStats): IWeaponStats {
    const rawWorld = this.world.raw;
    const stats = { ...baseStats };

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], StatModifiers, entity)) {
      const damageMultiplier = StatModifiers.damageMultiplier[entity] || 1;
      const areaMultiplier = StatModifiers.areaMultiplier[entity] || 1;
      const projectileBonus = StatModifiers.projectileCountBonus[entity] || 0;
      const critChanceBonus = StatModifiers.critChance[entity] || 0;
      const critMultiplierBonus = StatModifiers.critMultiplier[entity] || 0;

      stats.damage *= damageMultiplier;

      if (stats.area !== undefined) {
        stats.area *= areaMultiplier;
      }

      if (stats.projectileCount !== undefined) {
        stats.projectileCount += projectileBonus;
      }

      if (stats.critChance !== undefined) {
        stats.critChance += critChanceBonus;
      }

      if (stats.critMultiplier !== undefined) {
        stats.critMultiplier += critMultiplierBonus;
      }
    }

    return stats;
  }

  /**
   * Get cooldown reduction from entity.
   */
  private getCooldownReduction(entity: EntityId): number {
    const rawWorld = this.world.raw;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], StatModifiers, entity)) {
      return Math.min(0.9, StatModifiers.cooldownReduction[entity] || 0);
    }

    return 0;
  }

  /**
   * Find closest enemy within range.
   */
  private findClosestEnemy(x: number, y: number, range: number): { x: number; y: number } | null {
    const nearby = this.spatialHash.queryRadiusWithLayer(x, y, range, CollisionLayer.Enemy);

    let closest: EntityId | null = null;
    let closestDistSq = Infinity;

    for (const entity of nearby) {
      if (this.isValidTarget(entity)) {
        const dx = Position.x[entity] - x;
        const dy = Position.y[entity] - y;
        const distSq = dx * dx + dy * dy;

        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closest = entity;
        }
      }
    }

    if (closest !== null) {
      return { x: Position.x[closest], y: Position.y[closest] };
    }

    return null;
  }

  /**
   * Find random enemy within range.
   */
  private findRandomEnemy(x: number, y: number, range: number): { x: number; y: number } | null {
    const nearby = this.spatialHash.queryRadiusWithLayer(x, y, range, CollisionLayer.Enemy);
    const validTargets: EntityId[] = [];

    for (const entity of nearby) {
      if (this.isValidTarget(entity)) {
        validTargets.push(entity);
      }
    }

    if (validTargets.length > 0) {
      const target = validTargets[Math.floor(Math.random() * validTargets.length)];
      return { x: Position.x[target], y: Position.y[target] };
    }

    return null;
  }

  /**
   * Find enemy with highest HP within range.
   */
  private findHighestHPEnemy(x: number, y: number, range: number): { x: number; y: number } | null {
    const nearby = this.spatialHash.queryRadiusWithLayer(x, y, range, CollisionLayer.Enemy);

    let best: EntityId | null = null;
    let highestHP = -Infinity;

    for (const entity of nearby) {
      if (this.isValidTarget(entity)) {
        const hp = Health.current[entity];
        if (hp > highestHP) {
          highestHP = hp;
          best = entity;
        }
      }
    }

    if (best !== null) {
      return { x: Position.x[best], y: Position.y[best] };
    }

    return null;
  }

  /**
   * Find enemy with lowest HP within range.
   */
  private findLowestHPEnemy(x: number, y: number, range: number): { x: number; y: number } | null {
    const nearby = this.spatialHash.queryRadiusWithLayer(x, y, range, CollisionLayer.Enemy);

    let best: EntityId | null = null;
    let lowestHP = Infinity;

    for (const entity of nearby) {
      if (this.isValidTarget(entity)) {
        const hp = Health.current[entity];
        if (hp < lowestHP) {
          lowestHP = hp;
          best = entity;
        }
      }
    }

    if (best !== null) {
      return { x: Position.x[best], y: Position.y[best] };
    }

    return null;
  }

  /**
   * Get directional target based on entity's velocity/aim.
   */
  private getDirectionalTarget(entity: EntityId): { x: number; y: number } {
    const rawWorld = this.world.raw;
    const x = Position.x[entity];
    const y = Position.y[entity];

    let dirX = 1;
    let dirY = 0;

    // Use velocity as direction if entity is moving
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Velocity, entity)) {
      const vx = Velocity.x[entity];
      const vy = Velocity.y[entity];
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed > 0.1) {
        dirX = vx / speed;
        dirY = vy / speed;
      }
    }

    // Return a point in the direction
    return { x: x + dirX * 100, y: y + dirY * 100 };
  }

  /**
   * Check if entity is a valid target.
   */
  private isValidTarget(entity: EntityId): boolean {
    const rawWorld = this.world.raw;

    // Must have health
    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      return false;
    }

    // Must not be dead
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, entity)) {
      return false;
    }

    return true;
  }

  // ============================================
  // IWeaponSystem Interface Implementation
  // ============================================

  /**
   * Add weapon to entity.
   */
  addWeapon(entity: EntityId, weaponId: string): IWeaponInstance {
    const definition = this.definitions.get(weaponId);
    if (!definition) {
      throw new Error(`Unknown weapon definition: ${weaponId}`);
    }

    // Get or create entity's weapon map
    let weapons = this.entityWeapons.get(entity);
    if (!weapons) {
      weapons = new Map();
      this.entityWeapons.set(entity, weapons);
    }

    // Check if already has this weapon
    if (weapons.has(weaponId)) {
      // Upgrade instead
      this.upgradeWeapon(entity, weaponId);
      return weapons.get(weaponId)!;
    }

    // Create new weapon instance
    const instance: IWeaponInstance = {
      definitionId: weaponId,
      level: 1,
      currentCooldown: 0,
      stats: { ...definition.baseStats },
      owner: entity,
      canEvolve: false,
    };

    weapons.set(weaponId, instance);

    // Check evolution eligibility
    this.updateEvolutionStatus(entity, instance);

    return instance;
  }

  /**
   * Remove weapon from entity.
   */
  removeWeapon(entity: EntityId, weaponId: string): void {
    const weapons = this.entityWeapons.get(entity);
    if (weapons) {
      weapons.delete(weaponId);
      if (weapons.size === 0) {
        this.entityWeapons.delete(entity);
      }
    }
  }

  /**
   * Get all weapons for entity.
   */
  getWeapons(entity: EntityId): IWeaponInstance[] {
    const weapons = this.entityWeapons.get(entity);
    return weapons ? Array.from(weapons.values()) : [];
  }

  /**
   * Upgrade weapon (increase level, recalculate stats).
   */
  upgradeWeapon(entity: EntityId, weaponId: string): boolean {
    const weapons = this.entityWeapons.get(entity);
    if (!weapons) return false;

    const instance = weapons.get(weaponId);
    if (!instance) return false;

    const definition = this.definitions.get(weaponId);
    if (!definition) return false;

    // Check max level
    if (instance.level >= definition.maxLevel) {
      return false;
    }

    // Increase level
    instance.level++;

    // Recalculate stats with level scaling
    instance.stats = this.calculateLeveledStats(definition, instance.level);

    // Update evolution status
    this.updateEvolutionStatus(entity, instance);

    return true;
  }

  /**
   * Calculate stats for a given level.
   */
  private calculateLeveledStats(definition: IWeaponDefinition, level: number): IWeaponStats {
    const baseStats = definition.baseStats;
    const scaling = definition.levelScaling;
    const levelsGained = level - 1;

    const stats: IWeaponStats = {
      damage: baseStats.damage + (scaling.damage ?? 0) * levelsGained,
      damageType: baseStats.damageType,
      cooldown: Math.max(0.1, baseStats.cooldown - (scaling.cooldown ?? 0) * levelsGained),
      range: baseStats.range + (scaling.range ?? 0) * levelsGained,
    };

    // Optional stats
    if (baseStats.projectileCount !== undefined) {
      stats.projectileCount = baseStats.projectileCount + (scaling.projectileCount ?? 0) * levelsGained;
    }

    if (baseStats.projectileSpeed !== undefined) {
      stats.projectileSpeed = baseStats.projectileSpeed + (scaling.projectileSpeed ?? 0) * levelsGained;
    }

    if (baseStats.pierce !== undefined) {
      stats.pierce = baseStats.pierce + (scaling.pierce ?? 0) * levelsGained;
    }

    if (baseStats.area !== undefined) {
      stats.area = baseStats.area + (scaling.area ?? 0) * levelsGained;
    }

    if (baseStats.duration !== undefined) {
      stats.duration = baseStats.duration + (scaling.duration ?? 0) * levelsGained;
    }

    if (baseStats.knockback !== undefined) {
      stats.knockback = baseStats.knockback + (scaling.knockback ?? 0) * levelsGained;
    }

    if (baseStats.critChance !== undefined) {
      stats.critChance = baseStats.critChance + (scaling.critChance ?? 0) * levelsGained;
    }

    if (baseStats.critMultiplier !== undefined) {
      stats.critMultiplier = baseStats.critMultiplier + (scaling.critMultiplier ?? 0) * levelsGained;
    }

    return stats;
  }

  /**
   * Check if weapon can evolve.
   */
  canEvolve(entity: EntityId, weaponId: string): boolean {
    const weapons = this.entityWeapons.get(entity);
    if (!weapons) return false;

    const instance = weapons.get(weaponId);
    return instance?.canEvolve ?? false;
  }

  /**
   * Evolve weapon if possible.
   */
  evolveWeapon(entity: EntityId, weaponId: string): boolean {
    if (!this.canEvolve(entity, weaponId)) {
      return false;
    }

    const weapons = this.entityWeapons.get(entity);
    if (!weapons) return false;

    const instance = weapons.get(weaponId);
    if (!instance) return false;

    const definition = this.definitions.get(weaponId);
    if (!definition || !definition.evolutionInto) return false;

    const evolvedDefinition = this.definitions.get(definition.evolutionInto);
    if (!evolvedDefinition) return false;

    // Remove old weapon
    weapons.delete(weaponId);

    // Add evolved weapon at level 1
    const evolvedInstance: IWeaponInstance = {
      definitionId: definition.evolutionInto,
      level: 1,
      currentCooldown: 0,
      stats: { ...evolvedDefinition.baseStats },
      owner: entity,
      canEvolve: false,
    };

    weapons.set(definition.evolutionInto, evolvedInstance);

    return true;
  }

  /**
   * Fire weapon manually (for networked input).
   */
  fireWeapon(entity: EntityId, weaponId: string, targetX: number, targetY: number): void {
    const weapons = this.entityWeapons.get(entity);
    if (!weapons) return;

    const instance = weapons.get(weaponId);
    if (!instance) return;

    // Only fire if cooldown is ready
    if (instance.currentCooldown <= 0) {
      this.executeWeaponFire(entity, instance, { x: targetX, y: targetY });
    }
  }

  /**
   * Get weapon definition.
   */
  getDefinition(weaponId: string): IWeaponDefinition | undefined {
    return this.definitions.get(weaponId);
  }

  /**
   * Register new weapon definition.
   */
  registerWeapon(definition: IWeaponDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * Update evolution status for a weapon instance.
   */
  private updateEvolutionStatus(_entity: EntityId, instance: IWeaponInstance): void {
    const definition = this.definitions.get(instance.definitionId);
    if (!definition) {
      instance.canEvolve = false;
      return;
    }

    // Weapon must be at max level
    if (instance.level < definition.maxLevel) {
      instance.canEvolve = false;
      return;
    }

    // Must have evolution target
    if (!definition.evolutionInto || !definition.evolutionWith) {
      instance.canEvolve = false;
      return;
    }

    // Check if entity has required passive items (simplified - would need passive item system)
    // For now, just check max level
    instance.canEvolve = true;
  }

  /**
   * Get all registered weapon definitions.
   */
  getAllDefinitions(): IWeaponDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Check if entity has a specific weapon.
   */
  hasWeapon(entity: EntityId, weaponId: string): boolean {
    const weapons = this.entityWeapons.get(entity);
    return weapons?.has(weaponId) ?? false;
  }

  /**
   * Get weapon instance.
   */
  getWeaponInstance(entity: EntityId, weaponId: string): IWeaponInstance | undefined {
    const weapons = this.entityWeapons.get(entity);
    return weapons?.get(weaponId);
  }

  destroy(): void {
    this.entityWeapons.clear();
    this.definitions.clear();
  }
}
