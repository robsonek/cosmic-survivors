/**
 * WeaponManager - High-level weapon management system for Cosmic Survivors.
 *
 * Manages player's weapon arsenal with:
 * - 6 predefined cosmic weapons with unique behaviors
 * - 5-level upgrade system per weapon
 * - Auto-firing with intelligent targeting
 * - Support for piercing, homing, orbital, chain, and area weapons
 *
 * Designed to work alongside existing WeaponSystem/WeaponFactory or standalone.
 */

import Phaser from 'phaser';

// ============================================
// Interfaces
// ============================================

/**
 * Weapon definition interface (as per requirements).
 */
export interface IWeaponDefinition {
  /** Unique weapon identifier */
  id: string;

  /** Display name */
  name: string;

  /** Weapon description */
  description: string;

  /** Base damage per hit */
  damage: number;

  /** Shots per second */
  fireRate: number;

  /** Projectile speed in pixels/second */
  projectileSpeed: number;

  /** Number of projectiles per shot */
  projectileCount: number;

  /** Spread angle in degrees (for multi-projectile weapons) */
  spread: number;

  /** Can projectile pass through multiple enemies */
  piercing: boolean;

  /** Do projectiles track enemies */
  homing: boolean;

  /** Texture key for projectile sprite */
  projectileTexture: string;

  /** Special weapon behavior type */
  behaviorType: WeaponBehaviorType;

  /** Additional behavior-specific config */
  behaviorConfig?: Record<string, unknown>;
}

/**
 * Weapon behavior types for special attack patterns.
 */
export enum WeaponBehaviorType {
  /** Standard projectile - fires at closest enemy */
  Standard = 'standard',

  /** Spread shot - fires multiple projectiles in a fan pattern */
  Spread = 'spread',

  /** Homing - projectiles track enemies */
  Homing = 'homing',

  /** Orbital - projectiles orbit around player */
  Orbital = 'orbital',

  /** Chain - instant hit that chains to multiple enemies */
  Chain = 'chain',

  /** Area - continuous damage in close range */
  Area = 'area',
}

/**
 * Runtime weapon instance with current level and stats.
 */
export interface IWeaponInstance {
  definition: IWeaponDefinition;
  level: number;
  currentCooldown: number;

  /** Computed stats after upgrades */
  computedDamage: number;
  computedFireRate: number;
  computedProjectileCount: number;
  computedProjectileSpeed: number;
  computedSpread: number;

  /** For orbital weapons - current rotation angle */
  orbitalAngle?: number;

  /** For area weapons - active targets being damaged */
  areaTargets?: Set<number>;
}

/**
 * Enemy interface for targeting.
 */
export interface IEnemy {
  x: number;
  y: number;
  id: number;
  health: number;
  maxHealth: number;
  active: boolean;
}

/**
 * Projectile data structure.
 */
export interface IProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  weaponId: string;
  pierceCount: number;
  lifetime: number;
  hitEnemies: Set<number>;
  sprite?: Phaser.GameObjects.Sprite;
  homingTarget?: IEnemy;
  isOrbital?: boolean;
  orbitalAngle?: number;
  orbitalDistance?: number;
  ownerX?: number;
  ownerY?: number;
}

/**
 * Upgrade multipliers for each level (1-5).
 */
interface IUpgradeScaling {
  damageMultiplier: number;
  fireRateMultiplier: number;
  projectileCountBonus: number;
  projectileSpeedMultiplier: number;
  spreadReduction: number;
  pierceBonus: number;
}

// ============================================
// Upgrade Scaling Configuration
// ============================================

/**
 * Upgrade scaling per level (level 1 = base stats).
 */
const UPGRADE_SCALING: Record<number, IUpgradeScaling> = {
  1: {
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.0,
    projectileCountBonus: 0,
    projectileSpeedMultiplier: 1.0,
    spreadReduction: 0,
    pierceBonus: 0,
  },
  2: {
    damageMultiplier: 1.25,
    fireRateMultiplier: 1.1,
    projectileCountBonus: 0,
    projectileSpeedMultiplier: 1.05,
    spreadReduction: 0,
    pierceBonus: 0,
  },
  3: {
    damageMultiplier: 1.5,
    fireRateMultiplier: 1.2,
    projectileCountBonus: 1,
    projectileSpeedMultiplier: 1.1,
    spreadReduction: 5,
    pierceBonus: 1,
  },
  4: {
    damageMultiplier: 2.0,
    fireRateMultiplier: 1.35,
    projectileCountBonus: 1,
    projectileSpeedMultiplier: 1.2,
    spreadReduction: 10,
    pierceBonus: 1,
  },
  5: {
    damageMultiplier: 2.75,
    fireRateMultiplier: 1.5,
    projectileCountBonus: 2,
    projectileSpeedMultiplier: 1.3,
    spreadReduction: 15,
    pierceBonus: 2,
  },
};

// ============================================
// Predefined Weapon Definitions
// ============================================

/**
 * Basic Laser - targets closest enemy, fast fire rate.
 */
export const BasicLaserDefinition: IWeaponDefinition = {
  id: 'basic_laser',
  name: 'Basic Laser',
  description: 'A reliable energy beam that targets the closest enemy. Fast and accurate.',
  damage: 8,
  fireRate: 3.0, // 3 shots per second
  projectileSpeed: 600,
  projectileCount: 1,
  spread: 0,
  piercing: false,
  homing: false,
  projectileTexture: 'projectile_laser',
  behaviorType: WeaponBehaviorType.Standard,
};

/**
 * Spread Shot - fires 3 projectiles in a fan pattern.
 */
export const SpreadShotDefinition: IWeaponDefinition = {
  id: 'spread_shot',
  name: 'Spread Shot',
  description: 'Fires a burst of energy pellets in a wide arc. Great for crowd control.',
  damage: 5,
  fireRate: 1.5,
  projectileSpeed: 450,
  projectileCount: 3,
  spread: 30, // 30 degrees total spread
  piercing: false,
  homing: false,
  projectileTexture: 'projectile_spread',
  behaviorType: WeaponBehaviorType.Spread,
};

/**
 * Homing Missiles - slower projectiles that track enemies.
 */
export const HomingMissilesDefinition: IWeaponDefinition = {
  id: 'homing_missiles',
  name: 'Homing Missiles',
  description: 'Smart missiles that seek out enemies. Slower but never miss.',
  damage: 15,
  fireRate: 0.8,
  projectileSpeed: 250,
  projectileCount: 1,
  spread: 0,
  piercing: false,
  homing: true,
  projectileTexture: 'projectile_missile',
  behaviorType: WeaponBehaviorType.Homing,
  behaviorConfig: {
    turnSpeed: 5.0, // Radians per second
    maxLifetime: 5.0, // Seconds before self-destruct
  },
};

/**
 * Orbital Shield - projectiles orbit around the player.
 */
export const OrbitalShieldDefinition: IWeaponDefinition = {
  id: 'orbital_shield',
  name: 'Orbital Shield',
  description: 'Energy orbs that circle around you, damaging enemies on contact.',
  damage: 12,
  fireRate: 0.5, // Spawns new orbs slowly
  projectileSpeed: 180, // Orbital rotation speed (degrees/second)
  projectileCount: 3,
  spread: 120, // Orbs are evenly distributed (360/3 = 120)
  piercing: true,
  homing: false,
  projectileTexture: 'projectile_orb',
  behaviorType: WeaponBehaviorType.Orbital,
  behaviorConfig: {
    orbitRadius: 80,
    maxOrbitals: 8,
    orbitSpeed: 180, // degrees per second
    hitCooldown: 0.5, // seconds between hitting same enemy
  },
};

/**
 * Lightning - instant hit, chains to multiple enemies.
 */
export const LightningDefinition: IWeaponDefinition = {
  id: 'lightning',
  name: 'Lightning',
  description: 'Electric bolt that instantly strikes and chains to nearby enemies.',
  damage: 20,
  fireRate: 0.6,
  projectileSpeed: 0, // Instant
  projectileCount: 1,
  spread: 0,
  piercing: true,
  homing: false,
  projectileTexture: 'effect_lightning',
  behaviorType: WeaponBehaviorType.Chain,
  behaviorConfig: {
    chainCount: 3, // Jumps to 3 additional enemies
    chainRange: 150, // Max distance for chain jump
    chainDamageDecay: 0.7, // Each chain does 70% of previous damage
  },
};

/**
 * Flamethrower - continuous close-range damage.
 */
export const FlamethrowerDefinition: IWeaponDefinition = {
  id: 'flamethrower',
  name: 'Flamethrower',
  description: 'Engulfs nearby enemies in flames. Short range but devastating.',
  damage: 4, // Damage per tick
  fireRate: 10, // Ticks per second (continuous)
  projectileSpeed: 0,
  projectileCount: 1,
  spread: 45, // Cone angle
  piercing: true,
  homing: false,
  projectileTexture: 'effect_flame',
  behaviorType: WeaponBehaviorType.Area,
  behaviorConfig: {
    range: 120,
    coneAngle: 45, // degrees
    tickRate: 10, // damage ticks per second
    burnDuration: 2.0, // seconds of burn after leaving area
    burnDamage: 2, // damage per second while burning
  },
};

/**
 * All predefined weapon definitions.
 */
export const WEAPON_DEFINITIONS: Record<string, IWeaponDefinition> = {
  [BasicLaserDefinition.id]: BasicLaserDefinition,
  [SpreadShotDefinition.id]: SpreadShotDefinition,
  [HomingMissilesDefinition.id]: HomingMissilesDefinition,
  [OrbitalShieldDefinition.id]: OrbitalShieldDefinition,
  [LightningDefinition.id]: LightningDefinition,
  [FlamethrowerDefinition.id]: FlamethrowerDefinition,
};

// ============================================
// WeaponManager Class
// ============================================

/**
 * WeaponManager - Manages player's weapon arsenal.
 *
 * Handles weapon acquisition, upgrades, and firing logic
 * for all active weapons in the player's inventory.
 */
export class WeaponManager {
  /** Active weapons in player's arsenal */
  private weapons: Map<string, IWeaponInstance> = new Map();

  /** All active projectiles */
  private projectiles: IProjectile[] = [];

  /** Registered weapon definitions */
  private definitions: Map<string, IWeaponDefinition> = new Map();

  /** Maximum weapons player can hold */
  private maxWeapons: number = 6;

  /** Callback for when damage is dealt */
  private onDamageCallback?: (
    enemyId: number,
    damage: number,
    weaponId: string,
    position: { x: number; y: number }
  ) => void;

  /** Callback for visual effects */
  private onEffectCallback?: (
    type: string,
    x: number,
    y: number,
    config?: Record<string, unknown>
  ) => void;

  constructor() {
    // Register all predefined weapons
    for (const definition of Object.values(WEAPON_DEFINITIONS)) {
      this.definitions.set(definition.id, definition);
    }
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Add a weapon to the player's arsenal.
   * If weapon already exists, upgrades it instead.
   *
   * @param weaponId - ID of the weapon to add
   * @returns true if weapon was added/upgraded, false if arsenal is full
   */
  addWeapon(weaponId: string): boolean {
    // Check if already owned
    if (this.weapons.has(weaponId)) {
      return this.upgradeWeapon(weaponId);
    }

    // Check max weapons
    if (this.weapons.size >= this.maxWeapons) {
      console.warn(`Cannot add weapon ${weaponId}: arsenal full (max ${this.maxWeapons})`);
      return false;
    }

    // Get definition
    const definition = this.definitions.get(weaponId);
    if (!definition) {
      console.error(`Unknown weapon ID: ${weaponId}`);
      return false;
    }

    // Create weapon instance at level 1
    const instance = this.createWeaponInstance(definition, 1);
    this.weapons.set(weaponId, instance);

    console.log(`Added weapon: ${definition.name} (Level 1)`);
    return true;
  }

  /**
   * Upgrade an existing weapon.
   *
   * @param weaponId - ID of the weapon to upgrade
   * @returns true if upgrade successful, false if max level or not owned
   */
  upgradeWeapon(weaponId: string): boolean {
    const instance = this.weapons.get(weaponId);
    if (!instance) {
      console.warn(`Cannot upgrade weapon ${weaponId}: not owned`);
      return false;
    }

    if (instance.level >= 5) {
      console.warn(`Cannot upgrade weapon ${weaponId}: already max level`);
      return false;
    }

    // Upgrade level
    const newLevel = instance.level + 1;
    const upgraded = this.createWeaponInstance(instance.definition, newLevel);

    // Preserve runtime state
    upgraded.currentCooldown = instance.currentCooldown;
    upgraded.orbitalAngle = instance.orbitalAngle;
    upgraded.areaTargets = instance.areaTargets;

    this.weapons.set(weaponId, upgraded);

    console.log(`Upgraded weapon: ${instance.definition.name} to Level ${newLevel}`);
    return true;
  }

  /**
   * Remove a weapon from the arsenal.
   *
   * @param weaponId - ID of the weapon to remove
   * @returns true if removed, false if not owned
   */
  removeWeapon(weaponId: string): boolean {
    if (!this.weapons.has(weaponId)) {
      return false;
    }

    this.weapons.delete(weaponId);

    // Remove projectiles from this weapon
    this.projectiles = this.projectiles.filter((p) => p.weaponId !== weaponId);

    return true;
  }

  /**
   * Get all active weapons.
   *
   * @returns Array of weapon instances
   */
  getActiveWeapons(): IWeaponInstance[] {
    return Array.from(this.weapons.values());
  }

  /**
   * Get a specific weapon instance.
   *
   * @param weaponId - Weapon ID
   * @returns Weapon instance or undefined
   */
  getWeapon(weaponId: string): IWeaponInstance | undefined {
    return this.weapons.get(weaponId);
  }

  /**
   * Check if player has a weapon.
   */
  hasWeapon(weaponId: string): boolean {
    return this.weapons.has(weaponId);
  }

  /**
   * Reset all weapons (for new game).
   */
  reset(): void {
    this.weapons.clear();
    this.projectiles = [];
  }

  /**
   * Get weapon level.
   */
  getWeaponLevel(weaponId: string): number {
    return this.weapons.get(weaponId)?.level ?? 0;
  }

  /**
   * Fire all weapons that are ready.
   *
   * @param scene - Phaser scene for sprite creation
   * @param playerX - Player X position
   * @param playerY - Player Y position
   * @param enemies - Array of enemies to target
   * @param dt - Delta time in seconds
   */
  fireAll(
    scene: Phaser.Scene,
    playerX: number,
    playerY: number,
    enemies: IEnemy[],
    dt: number = 1 / 60
  ): void {
    // Filter to active enemies
    const activeEnemies = enemies.filter((e) => e.active && e.health > 0);

    // Update cooldowns and fire weapons
    for (const [weaponId, instance] of this.weapons) {
      instance.currentCooldown -= dt;

      if (instance.currentCooldown <= 0) {
        this.fireWeapon(scene, weaponId, instance, playerX, playerY, activeEnemies);
        instance.currentCooldown = 1 / instance.computedFireRate;
      }
    }

    // Update existing projectiles
    this.updateProjectiles(dt, playerX, playerY, activeEnemies);
  }

  /**
   * Update projectiles without firing (for manual control).
   */
  updateProjectiles(
    dt: number,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      proj.lifetime -= dt;

      if (proj.lifetime <= 0) {
        toRemove.push(i);
        continue;
      }

      // Update based on weapon type
      const weapon = this.weapons.get(proj.weaponId);
      if (!weapon) {
        toRemove.push(i);
        continue;
      }

      if (proj.isOrbital) {
        // Orbital projectiles rotate around player
        this.updateOrbitalProjectile(proj, playerX, playerY, dt, weapon);
      } else if (proj.homingTarget && weapon.definition.homing) {
        // Homing projectiles track their target
        this.updateHomingProjectile(proj, dt, weapon, enemies);
      } else {
        // Standard movement
        proj.x += proj.velocityX * dt;
        proj.y += proj.velocityY * dt;
      }

      // Update sprite position
      if (proj.sprite) {
        proj.sprite.setPosition(proj.x, proj.y);
      }

      // Check collisions with enemies
      const hitResult = this.checkProjectileCollisions(proj, enemies);
      if (hitResult.shouldRemove) {
        toRemove.push(i);
      }
    }

    // Remove expired/hit projectiles (in reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const proj = this.projectiles[idx];
      if (proj.sprite) {
        proj.sprite.destroy();
      }
      this.projectiles.splice(idx, 1);
    }
  }

  /**
   * Get all active projectiles.
   */
  getProjectiles(): IProjectile[] {
    return this.projectiles;
  }

  /**
   * Clear all projectiles.
   */
  clearProjectiles(): void {
    for (const proj of this.projectiles) {
      if (proj.sprite) {
        proj.sprite.destroy();
      }
    }
    this.projectiles = [];
  }

  /**
   * Register a custom weapon definition.
   */
  registerWeapon(definition: IWeaponDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * Get weapon definition.
   */
  getDefinition(weaponId: string): IWeaponDefinition | undefined {
    return this.definitions.get(weaponId);
  }

  /**
   * Get all registered weapon definitions.
   */
  getAllDefinitions(): IWeaponDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Set maximum weapons player can hold.
   */
  setMaxWeapons(max: number): void {
    this.maxWeapons = max;
  }

  /**
   * Set damage callback.
   */
  setOnDamageCallback(
    callback: (
      enemyId: number,
      damage: number,
      weaponId: string,
      position: { x: number; y: number }
    ) => void
  ): void {
    this.onDamageCallback = callback;
  }

  /**
   * Set effect callback for visual effects.
   */
  setOnEffectCallback(
    callback: (type: string, x: number, y: number, config?: Record<string, unknown>) => void
  ): void {
    this.onEffectCallback = callback;
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.clearProjectiles();
    this.weapons.clear();
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Create a weapon instance with computed stats for given level.
   */
  private createWeaponInstance(definition: IWeaponDefinition, level: number): IWeaponInstance {
    const scaling = UPGRADE_SCALING[level] ?? UPGRADE_SCALING[1];

    return {
      definition,
      level,
      currentCooldown: 0,
      computedDamage: Math.floor(definition.damage * scaling.damageMultiplier),
      computedFireRate: definition.fireRate * scaling.fireRateMultiplier,
      computedProjectileCount: definition.projectileCount + scaling.projectileCountBonus,
      computedProjectileSpeed: definition.projectileSpeed * scaling.projectileSpeedMultiplier,
      computedSpread: Math.max(0, definition.spread - scaling.spreadReduction),
      orbitalAngle: 0,
      areaTargets: new Set(),
    };
  }

  /**
   * Fire a specific weapon.
   */
  private fireWeapon(
    scene: Phaser.Scene,
    _weaponId: string,
    instance: IWeaponInstance,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    const def = instance.definition;

    switch (def.behaviorType) {
      case WeaponBehaviorType.Standard:
        this.fireStandardWeapon(scene, instance, playerX, playerY, enemies);
        break;

      case WeaponBehaviorType.Spread:
        this.fireSpreadWeapon(scene, instance, playerX, playerY, enemies);
        break;

      case WeaponBehaviorType.Homing:
        this.fireHomingWeapon(scene, instance, playerX, playerY, enemies);
        break;

      case WeaponBehaviorType.Orbital:
        this.fireOrbitalWeapon(scene, instance, playerX, playerY);
        break;

      case WeaponBehaviorType.Chain:
        this.fireChainWeapon(instance, playerX, playerY, enemies);
        break;

      case WeaponBehaviorType.Area:
        this.fireAreaWeapon(instance, playerX, playerY, enemies);
        break;
    }
  }

  /**
   * Fire standard projectile at closest enemy.
   */
  private fireStandardWeapon(
    scene: Phaser.Scene,
    instance: IWeaponInstance,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    const target = this.findClosestEnemy(playerX, playerY, enemies);
    if (!target) return;

    const angle = Math.atan2(target.y - playerY, target.x - playerX);
    const speed = instance.computedProjectileSpeed;

    for (let i = 0; i < instance.computedProjectileCount; i++) {
      // Add small spread for multiple projectiles
      const spreadOffset = instance.computedProjectileCount > 1
        ? ((i / (instance.computedProjectileCount - 1)) - 0.5) * 0.1
        : 0;
      const projAngle = angle + spreadOffset;

      this.createProjectile(
        scene,
        instance,
        playerX,
        playerY,
        Math.cos(projAngle) * speed,
        Math.sin(projAngle) * speed
      );
    }

    this.triggerEffect('muzzle_flash', playerX, playerY);
  }

  /**
   * Fire spread shot in fan pattern.
   */
  private fireSpreadWeapon(
    scene: Phaser.Scene,
    instance: IWeaponInstance,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    const target = this.findClosestEnemy(playerX, playerY, enemies);
    const baseAngle = target
      ? Math.atan2(target.y - playerY, target.x - playerX)
      : 0; // Default to right if no enemies

    const spreadRad = (instance.computedSpread * Math.PI) / 180;
    const count = instance.computedProjectileCount;
    const speed = instance.computedProjectileSpeed;

    for (let i = 0; i < count; i++) {
      const angleOffset = count > 1
        ? ((i / (count - 1)) - 0.5) * spreadRad
        : 0;
      const projAngle = baseAngle + angleOffset;

      this.createProjectile(
        scene,
        instance,
        playerX,
        playerY,
        Math.cos(projAngle) * speed,
        Math.sin(projAngle) * speed
      );
    }

    this.triggerEffect('spread_blast', playerX, playerY);
  }

  /**
   * Fire homing missile.
   */
  private fireHomingWeapon(
    scene: Phaser.Scene,
    instance: IWeaponInstance,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    // Find targets for each missile
    const sortedEnemies = [...enemies].sort((a, b) => {
      const distA = Math.hypot(a.x - playerX, a.y - playerY);
      const distB = Math.hypot(b.x - playerX, b.y - playerY);
      return distA - distB;
    });

    for (let i = 0; i < instance.computedProjectileCount; i++) {
      const target = sortedEnemies[i % sortedEnemies.length];
      if (!target) continue;

      // Launch in direction of target but missile will home in
      const angle = Math.atan2(target.y - playerY, target.x - playerX);
      const speed = instance.computedProjectileSpeed;

      const proj = this.createProjectile(
        scene,
        instance,
        playerX,
        playerY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );

      if (proj) {
        proj.homingTarget = target;
        proj.lifetime = (instance.definition.behaviorConfig?.maxLifetime as number) ?? 5;
      }
    }

    this.triggerEffect('missile_launch', playerX, playerY);
  }

  /**
   * Fire orbital shield orbs.
   */
  private fireOrbitalWeapon(
    scene: Phaser.Scene,
    instance: IWeaponInstance,
    playerX: number,
    playerY: number
  ): void {
    const config = instance.definition.behaviorConfig ?? {};
    const maxOrbitals = (config.maxOrbitals as number) ?? 8;

    // Count current orbital projectiles
    const currentOrbitals = this.projectiles.filter(
      (p) => p.weaponId === instance.definition.id && p.isOrbital
    ).length;

    if (currentOrbitals >= maxOrbitals) return;

    const orbitRadius = (config.orbitRadius as number) ?? 80;
    const baseAngle = instance.orbitalAngle ?? 0;

    for (let i = 0; i < instance.computedProjectileCount; i++) {
      if (currentOrbitals + i >= maxOrbitals) break;

      const angle = baseAngle + (i * (360 / instance.computedProjectileCount)) * (Math.PI / 180);
      const x = playerX + Math.cos(angle) * orbitRadius;
      const y = playerY + Math.sin(angle) * orbitRadius;

      const proj = this.createProjectile(scene, instance, x, y, 0, 0);
      if (proj) {
        proj.isOrbital = true;
        proj.orbitalAngle = angle;
        proj.orbitalDistance = orbitRadius;
        proj.ownerX = playerX;
        proj.ownerY = playerY;
        proj.lifetime = Infinity; // Orbitals persist
        proj.hitEnemies.clear(); // Reset hits for new position
      }
    }

    this.triggerEffect('orbital_spawn', playerX, playerY);
  }

  /**
   * Fire chain lightning.
   */
  private fireChainWeapon(
    instance: IWeaponInstance,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    const config = instance.definition.behaviorConfig ?? {};
    const chainCount = ((config.chainCount as number) ?? 3) + Math.floor(instance.level / 2);
    const chainRange = (config.chainRange as number) ?? 150;
    const damageDecay = (config.chainDamageDecay as number) ?? 0.7;

    // Find initial target
    const target = this.findClosestEnemy(playerX, playerY, enemies);
    if (!target) return;

    const hitEnemies = new Set<number>();
    let currentTarget = target;
    let currentDamage = instance.computedDamage;
    let prevX = playerX;
    let prevY = playerY;

    // Chain through enemies
    for (let i = 0; i <= chainCount; i++) {
      if (!currentTarget || hitEnemies.has(currentTarget.id)) break;

      // Deal damage
      this.dealDamage(currentTarget.id, currentDamage, instance.definition.id, {
        x: currentTarget.x,
        y: currentTarget.y,
      });

      // Trigger lightning effect
      this.triggerEffect('lightning_bolt', prevX, prevY, {
        targetX: currentTarget.x,
        targetY: currentTarget.y,
        damage: currentDamage,
      });

      hitEnemies.add(currentTarget.id);
      prevX = currentTarget.x;
      prevY = currentTarget.y;

      // Reduce damage for next chain
      currentDamage = Math.floor(currentDamage * damageDecay);

      // Find next target
      const nextTarget = this.findClosestEnemyExcluding(
        currentTarget.x,
        currentTarget.y,
        enemies,
        hitEnemies,
        chainRange
      );
      currentTarget = nextTarget ?? null!;
    }
  }

  /**
   * Fire area/flamethrower weapon.
   */
  private fireAreaWeapon(
    instance: IWeaponInstance,
    playerX: number,
    playerY: number,
    enemies: IEnemy[]
  ): void {
    const config = instance.definition.behaviorConfig ?? {};
    const range = (config.range as number) ?? 120;
    const coneAngle = ((config.coneAngle as number) ?? 45) * (Math.PI / 180);

    // Get player facing direction (default right, would use input in real game)
    const facingAngle = 0;

    // Find enemies in cone
    for (const enemy of enemies) {
      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const dist = Math.hypot(dx, dy);

      if (dist > range) continue;

      const angleToEnemy = Math.atan2(dy, dx);
      const angleDiff = Math.abs(this.normalizeAngle(angleToEnemy - facingAngle));

      if (angleDiff <= coneAngle / 2) {
        // Enemy is in flame cone
        this.dealDamage(enemy.id, instance.computedDamage, instance.definition.id, {
          x: enemy.x,
          y: enemy.y,
        });

        this.triggerEffect('flame_hit', enemy.x, enemy.y, {
          intensity: 1 - dist / range,
        });
      }
    }

    this.triggerEffect('flamethrower', playerX, playerY, {
      angle: facingAngle,
      range,
      coneAngle: coneAngle * (180 / Math.PI),
    });
  }

  /**
   * Create a projectile.
   */
  private createProjectile(
    scene: Phaser.Scene,
    instance: IWeaponInstance,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number
  ): IProjectile | null {
    const def = instance.definition;
    const level = instance.level;
    const scaling = UPGRADE_SCALING[level] ?? UPGRADE_SCALING[1];

    // Calculate pierce count
    let pierceCount = 0;
    if (def.piercing) {
      pierceCount = 3 + scaling.pierceBonus; // Base 3 + bonus from level
    }

    const projectile: IProjectile = {
      x,
      y,
      velocityX,
      velocityY,
      damage: instance.computedDamage,
      weaponId: def.id,
      pierceCount,
      lifetime: 3.0, // Default 3 seconds
      hitEnemies: new Set(),
    };

    // Create sprite if scene available
    if (scene && scene.textures.exists(def.projectileTexture)) {
      projectile.sprite = scene.add.sprite(x, y, def.projectileTexture);
      projectile.sprite.setDepth(10);

      // Rotate sprite to face movement direction
      if (velocityX !== 0 || velocityY !== 0) {
        projectile.sprite.setRotation(Math.atan2(velocityY, velocityX));
      }
    }

    this.projectiles.push(projectile);
    return projectile;
  }

  /**
   * Update orbital projectile position.
   */
  private updateOrbitalProjectile(
    proj: IProjectile,
    playerX: number,
    playerY: number,
    dt: number,
    weapon: IWeaponInstance
  ): void {
    const config = weapon.definition.behaviorConfig ?? {};
    const orbitSpeed = ((config.orbitSpeed as number) ?? 180) * (Math.PI / 180); // Convert to radians

    proj.orbitalAngle = (proj.orbitalAngle ?? 0) + orbitSpeed * dt;
    const radius = proj.orbitalDistance ?? 80;

    proj.x = playerX + Math.cos(proj.orbitalAngle) * radius;
    proj.y = playerY + Math.sin(proj.orbitalAngle) * radius;
    proj.ownerX = playerX;
    proj.ownerY = playerY;
  }

  /**
   * Update homing projectile.
   */
  private updateHomingProjectile(
    proj: IProjectile,
    dt: number,
    weapon: IWeaponInstance,
    enemies: IEnemy[]
  ): void {
    // Check if target is still valid
    if (!proj.homingTarget || !proj.homingTarget.active || proj.homingTarget.health <= 0) {
      // Find new target
      proj.homingTarget = this.findClosestEnemy(proj.x, proj.y, enemies) ?? undefined;
    }

    if (!proj.homingTarget) {
      // No target, continue straight
      proj.x += proj.velocityX * dt;
      proj.y += proj.velocityY * dt;
      return;
    }

    const config = weapon.definition.behaviorConfig ?? {};
    const turnSpeed = (config.turnSpeed as number) ?? 5.0;

    // Calculate desired direction
    const dx = proj.homingTarget.x - proj.x;
    const dy = proj.homingTarget.y - proj.y;
    const desiredAngle = Math.atan2(dy, dx);

    // Current angle
    const currentAngle = Math.atan2(proj.velocityY, proj.velocityX);

    // Calculate angle difference
    let angleDiff = desiredAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Turn towards target
    const maxTurn = turnSpeed * dt;
    const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
    const newAngle = currentAngle + actualTurn;

    // Update velocity
    const speed = weapon.computedProjectileSpeed;
    proj.velocityX = Math.cos(newAngle) * speed;
    proj.velocityY = Math.sin(newAngle) * speed;

    // Update position
    proj.x += proj.velocityX * dt;
    proj.y += proj.velocityY * dt;

    // Rotate sprite
    if (proj.sprite) {
      proj.sprite.setRotation(newAngle);
    }
  }

  /**
   * Check projectile collisions with enemies.
   */
  private checkProjectileCollisions(
    proj: IProjectile,
    enemies: IEnemy[]
  ): { shouldRemove: boolean } {
    const hitRadius = 20; // Collision radius

    for (const enemy of enemies) {
      if (proj.hitEnemies.has(enemy.id)) continue;
      if (!enemy.active || enemy.health <= 0) continue;

      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const dist = Math.hypot(dx, dy);

      if (dist < hitRadius) {
        // Hit!
        this.dealDamage(enemy.id, proj.damage, proj.weaponId, { x: proj.x, y: proj.y });
        proj.hitEnemies.add(enemy.id);

        this.triggerEffect('hit_impact', proj.x, proj.y);

        // Check pierce
        if (proj.pierceCount <= 0) {
          return { shouldRemove: true };
        }
        proj.pierceCount--;
      }
    }

    return { shouldRemove: false };
  }

  /**
   * Deal damage to an enemy.
   */
  private dealDamage(
    enemyId: number,
    damage: number,
    weaponId: string,
    position: { x: number; y: number }
  ): void {
    if (this.onDamageCallback) {
      this.onDamageCallback(enemyId, damage, weaponId, position);
    }
  }

  /**
   * Trigger a visual effect.
   */
  private triggerEffect(
    type: string,
    x: number,
    y: number,
    config?: Record<string, unknown>
  ): void {
    if (this.onEffectCallback) {
      this.onEffectCallback(type, x, y, config);
    }
  }

  /**
   * Find closest enemy to a position.
   */
  private findClosestEnemy(x: number, y: number, enemies: IEnemy[]): IEnemy | null {
    let closest: IEnemy | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.active || enemy.health <= 0) continue;

      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
  }

  /**
   * Find closest enemy excluding already hit enemies.
   */
  private findClosestEnemyExcluding(
    x: number,
    y: number,
    enemies: IEnemy[],
    exclude: Set<number>,
    maxRange: number
  ): IEnemy | null {
    let closest: IEnemy | null = null;
    let closestDist = maxRange;

    for (const enemy of enemies) {
      if (!enemy.active || enemy.health <= 0) continue;
      if (exclude.has(enemy.id)) continue;

      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
  }

  /**
   * Normalize angle to -PI to PI range.
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}

// ============================================
// Singleton Export
// ============================================

/**
 * Singleton instance of WeaponManager.
 */
export const weaponManager = new WeaponManager();

/**
 * Default export for convenience.
 */
export default weaponManager;
