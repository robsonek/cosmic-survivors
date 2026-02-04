import type { EntityId } from './IWorld';
import type { DamageType } from './IEventBus';

/**
 * Weapon rarity levels.
 */
export enum WeaponRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

/**
 * Weapon targeting types.
 */
export enum WeaponTargeting {
  Closest = 'closest',           // Target closest enemy
  Random = 'random',             // Random enemy in range
  HighestHP = 'highestHP',       // Enemy with most HP
  LowestHP = 'lowestHP',         // Enemy with least HP
  Directional = 'directional',   // Based on movement/aim direction
  Area = 'area',                 // All enemies in area
}

/**
 * Weapon category.
 */
export enum WeaponCategory {
  Projectile = 'projectile',     // Bullets, arrows
  Melee = 'melee',               // Swords, whips
  Area = 'area',                 // Auras, explosions
  Summon = 'summon',             // Minions, turrets
  Passive = 'passive',           // Damage on touch, thorns
}

/**
 * Base weapon stats.
 */
export interface IWeaponStats {
  damage: number;
  damageType: DamageType;
  cooldown: number;             // Seconds between attacks
  range: number;                // Max attack range
  projectileCount?: number;     // Number of projectiles per attack
  projectileSpeed?: number;     // Speed of projectiles
  pierce?: number;              // How many enemies projectile can hit
  area?: number;                // Area of effect radius
  duration?: number;            // For lingering effects
  knockback?: number;           // Knockback force
  critChance?: number;          // Critical hit chance (0-1)
  critMultiplier?: number;      // Critical damage multiplier
}

/**
 * Weapon definition (static data).
 */
export interface IWeaponDefinition {
  id: string;
  name: string;
  description: string;
  category: WeaponCategory;
  rarity: WeaponRarity;
  targeting: WeaponTargeting;
  baseStats: IWeaponStats;

  /** Max upgrade level (usually 8) */
  maxLevel: number;

  /** Stats multiplier per level */
  levelScaling: Partial<IWeaponStats>;

  /** Sprite/animation keys */
  spriteKey: string;
  projectileKey?: string;
  sfxKey?: string;

  /** Weapons that can evolve with this */
  evolutionWith?: string[];      // IDs of passive items needed
  evolutionInto?: string;        // ID of evolved weapon

  /** Weapons this synergizes with */
  synergies?: string[];
}

/**
 * Runtime weapon instance.
 */
export interface IWeaponInstance {
  definitionId: string;
  level: number;
  currentCooldown: number;       // Time until next attack
  stats: IWeaponStats;           // Computed stats with upgrades

  /** Entity ID of owner */
  owner: EntityId;

  /** Whether weapon can be evolved */
  canEvolve: boolean;
}

/**
 * Projectile configuration.
 */
export interface IProjectileConfig {
  weaponId: string;
  owner: EntityId;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  damageType: DamageType;
  pierce: number;
  lifetime: number;             // Max time alive in seconds
  spriteKey: string;
  hitEffect?: string;           // Particle effect on hit
  hitSFX?: string;              // Sound on hit
}

/**
 * Weapon system interface.
 */
export interface IWeaponSystem {
  /**
   * Add weapon to entity.
   */
  addWeapon(entity: EntityId, weaponId: string): IWeaponInstance;

  /**
   * Remove weapon from entity.
   */
  removeWeapon(entity: EntityId, weaponId: string): void;

  /**
   * Get all weapons for entity.
   */
  getWeapons(entity: EntityId): IWeaponInstance[];

  /**
   * Upgrade weapon.
   */
  upgradeWeapon(entity: EntityId, weaponId: string): boolean;

  /**
   * Check if weapon can evolve.
   */
  canEvolve(entity: EntityId, weaponId: string): boolean;

  /**
   * Evolve weapon if possible.
   */
  evolveWeapon(entity: EntityId, weaponId: string): boolean;

  /**
   * Fire weapon manually (for networked input).
   */
  fireWeapon(entity: EntityId, weaponId: string, targetX: number, targetY: number): void;

  /**
   * Get weapon definition.
   */
  getDefinition(weaponId: string): IWeaponDefinition | undefined;

  /**
   * Register new weapon definition.
   */
  registerWeapon(definition: IWeaponDefinition): void;
}

/**
 * Passive item that can trigger weapon evolution.
 */
export interface IPassiveItem {
  id: string;
  name: string;
  description: string;
  rarity: WeaponRarity;
  maxLevel: number;

  /** Stat modifiers */
  modifiers: IStatModifiers;

  /** Modifiers per level */
  levelScaling: Partial<IStatModifiers>;

  /** Weapons this can evolve */
  evolvesWeapons?: string[];
}

/**
 * Stat modifiers from passive items.
 */
export interface IStatModifiers {
  damageMultiplier?: number;     // 1.0 = 100%
  cooldownReduction?: number;    // 0.1 = 10% faster
  areaMultiplier?: number;
  projectileCountBonus?: number;
  speedMultiplier?: number;
  healthBonus?: number;
  regenBonus?: number;
  pickupRadius?: number;
  xpMultiplier?: number;
  critChanceBonus?: number;
  critMultiplierBonus?: number;
  armorBonus?: number;
  dodgeChance?: number;
}
