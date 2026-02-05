/**
 * WeaponEvolution - System for managing weapon evolution mechanics.
 *
 * When a weapon reaches max level AND the player has a specific passive item,
 * the weapon can evolve into a more powerful version.
 *
 * Evolution Recipes:
 * - Basic Laser + Damage boost = "Death Ray" (penetrates all enemies)
 * - Spread Shot + Multishot = "Bullet Storm" (20 projectiles)
 * - Missile + Homing = "Smart Missiles" (perfect tracking + explosions)
 *
 * Features:
 * - Evolution requirement tracking
 * - Unlock condition checking
 * - Evolution notification display
 * - Special visual effects for evolved weapons
 * - Integration with UpgradeSystem
 */

import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus, ISubscription } from '../shared/interfaces/IEventBus';
import { GameEvents } from '../shared/interfaces/IEventBus';
import { UpgradeSystem, type IUpgradeSelectedEvent } from './UpgradeSystem';
import {
  WeaponManager,
  WeaponBehaviorType,
  type IWeaponDefinition as IManagerWeaponDefinition,
} from './WeaponManager';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Evolution recipe definition
 */
export interface IEvolutionRecipe {
  /** Unique ID for this evolution */
  id: string;
  /** Base weapon ID that can evolve */
  baseWeaponId: string;
  /** Required passive upgrade ID */
  requiredPassiveId: string;
  /** Resulting evolved weapon ID */
  evolvedWeaponId: string;
  /** Display name for the evolution */
  evolutionName: string;
  /** Description of the evolution effect */
  description: string;
  /** Icon for notifications */
  icon: string;
  /** Minimum weapon level required (usually max level) */
  minWeaponLevel: number;
  /** Minimum passive level required */
  minPassiveLevel: number;
}

/**
 * Evolution notification data
 */
export interface IEvolutionNotification {
  evolutionName: string;
  description: string;
  icon: string;
  oldWeaponName: string;
  newWeaponName: string;
  timestamp: number;
}

/**
 * Evolution visual effect configuration
 */
export interface IEvolutionEffectConfig {
  /** Particle color (hex) */
  particleColor: number;
  /** Glow color (hex) */
  glowColor: number;
  /** Trail effect enabled */
  hasTrail: boolean;
  /** Projectile scale multiplier */
  projectileScale: number;
  /** Special effect type */
  specialEffect: 'penetration' | 'explosion' | 'tracking' | 'multishot';
}

/**
 * Evolution state for tracking progress
 */
export interface IEvolutionState {
  recipeId: string;
  weaponLevel: number;
  passiveLevel: number;
  isReady: boolean;
  isUnlocked: boolean;
  evolvedAt?: number;
}

/**
 * Event listener types
 */
export type EvolutionReadyListener = (recipe: IEvolutionRecipe, entity: EntityId) => void;
export type EvolutionCompleteListener = (notification: IEvolutionNotification, entity: EntityId) => void;

// ============================================================================
// Evolution Recipes (Predefined)
// ============================================================================

/**
 * Death Ray - Evolved from Basic Laser + Damage Boost
 * Penetrates ALL enemies (infinite pierce)
 */
export const DeathRayDefinition: IManagerWeaponDefinition = {
  id: 'death_ray',
  name: 'Death Ray',
  description: 'A devastating beam that penetrates through ALL enemies. Nothing can stop it.',
  damage: 35,
  fireRate: 2.5,
  projectileSpeed: 1200,
  projectileCount: 1,
  spread: 0,
  piercing: true,
  homing: false,
  projectileTexture: 'projectile_death_ray',
  behaviorType: WeaponBehaviorType.Beam,
  behaviorConfig: {
    beamWidth: 12,
    beamLength: 800,
    infinitePierce: true,
    damageInterval: 0.1,
  },
};

/**
 * Bullet Storm - Evolved from Spread Shot + Multishot
 * Fires 20 projectiles in a devastating spread
 */
export const BulletStormDefinition: IManagerWeaponDefinition = {
  id: 'bullet_storm',
  name: 'Bullet Storm',
  description: 'Unleashes a storm of 20 projectiles, overwhelming enemies with sheer numbers.',
  damage: 8,
  fireRate: 1.0,
  projectileSpeed: 600,
  projectileCount: 20,
  spread: 360, // Full circle
  piercing: false,
  homing: false,
  projectileTexture: 'projectile_storm',
  behaviorType: WeaponBehaviorType.Spread,
  behaviorConfig: {
    randomSpread: true,
    burstFire: true,
    burstCount: 4,
    burstDelay: 0.05,
  },
};

/**
 * Smart Missiles - Evolved from Homing Missiles + Homing passive
 * Perfect tracking with area explosions
 */
export const SmartMissilesDefinition: IManagerWeaponDefinition = {
  id: 'smart_missiles',
  name: 'Smart Missiles',
  description: 'Advanced missiles with perfect tracking and explosive impact.',
  damage: 40,
  fireRate: 0.8,
  projectileSpeed: 400,
  projectileCount: 3,
  spread: 30,
  piercing: false,
  homing: true,
  projectileTexture: 'projectile_smart_missile',
  behaviorType: WeaponBehaviorType.Homing,
  behaviorConfig: {
    turnSpeed: 15.0, // Very fast turning
    maxLifetime: 8.0,
    perfectTracking: true, // Never loses target
    explosionRadius: 60,
    explosionDamage: 20,
    clusterOnImpact: true,
    clusterCount: 3,
  },
};

/**
 * Predefined evolution recipes
 */
export const EVOLUTION_RECIPES: IEvolutionRecipe[] = [
  {
    id: 'evolution_death_ray',
    baseWeaponId: 'basic_laser',
    requiredPassiveId: 'damage_boost',
    evolvedWeaponId: 'death_ray',
    evolutionName: 'Death Ray',
    description: 'Basic Laser evolves into Death Ray - penetrates ALL enemies!',
    icon: '💀',
    minWeaponLevel: 5,
    minPassiveLevel: 3,
  },
  {
    id: 'evolution_bullet_storm',
    baseWeaponId: 'spread_shot',
    requiredPassiveId: 'extra_projectile',
    evolvedWeaponId: 'bullet_storm',
    evolutionName: 'Bullet Storm',
    description: 'Spread Shot evolves into Bullet Storm - 20 projectiles!',
    icon: '🌪️',
    minWeaponLevel: 5,
    minPassiveLevel: 3,
  },
  {
    id: 'evolution_smart_missiles',
    baseWeaponId: 'homing_missiles',
    requiredPassiveId: 'piercing', // Using piercing as "homing boost" passive
    evolvedWeaponId: 'smart_missiles',
    evolutionName: 'Smart Missiles',
    description: 'Homing Missiles evolves into Smart Missiles - perfect tracking + explosions!',
    icon: '🚀',
    minWeaponLevel: 5,
    minPassiveLevel: 1,
  },
];

/**
 * Visual effect configurations for evolved weapons
 */
export const EVOLUTION_EFFECTS: Record<string, IEvolutionEffectConfig> = {
  death_ray: {
    particleColor: 0xff0000,
    glowColor: 0xff4444,
    hasTrail: true,
    projectileScale: 1.5,
    specialEffect: 'penetration',
  },
  bullet_storm: {
    particleColor: 0xffaa00,
    glowColor: 0xffcc44,
    hasTrail: false,
    projectileScale: 0.8,
    specialEffect: 'multishot',
  },
  smart_missiles: {
    particleColor: 0x00ff88,
    glowColor: 0x44ffaa,
    hasTrail: true,
    projectileScale: 1.2,
    specialEffect: 'explosion',
  },
};

// ============================================================================
// WeaponEvolution System Class
// ============================================================================

/**
 * WeaponEvolution - ECS System for weapon evolution mechanics
 */
export class WeaponEvolution implements ISystem {
  public readonly name = 'WeaponEvolution';
  public readonly priority = 35; // After WeaponSystem
  public readonly dependencies: string[] = ['WeaponSystem'];
  public enabled = true;

  private _world!: IWorld;
  private eventBus!: IEventBus;
  private upgradeSystem!: UpgradeSystem;
  private weaponManager!: WeaponManager;

  // Evolution recipes registry
  private recipes: Map<string, IEvolutionRecipe> = new Map();

  // Evolution states per entity
  private entityEvolutionStates: Map<EntityId, Map<string, IEvolutionState>> = new Map();

  // Evolved weapons owned by entities
  private entityEvolvedWeapons: Map<EntityId, Set<string>> = new Map();

  // Pending notifications
  private pendingNotifications: IEvolutionNotification[] = [];

  // Event subscriptions
  private subscriptions: ISubscription[] = [];

  // Event listeners
  private evolutionReadyListeners: EvolutionReadyListener[] = [];
  private evolutionCompleteListeners: EvolutionCompleteListener[] = [];

  // Notification display duration (ms)
  private notificationDuration: number = 5000;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;

    // Register default recipes
    for (const recipe of EVOLUTION_RECIPES) {
      this.recipes.set(recipe.id, recipe);
    }
  }

  // ========================================================================
  // ISystem Implementation
  // ========================================================================

  init(world: IWorld): void {
    this._world = world;
    this.upgradeSystem = UpgradeSystem.getInstance();
    this.weaponManager = new WeaponManager();

    // Register evolved weapon definitions
    this.registerEvolvedWeapons();

    // Subscribe to events
    this.subscribeToEvents();
  }

  update(_dt: number): void {
    if (!this.enabled) return;

    // Process pending notifications (could display UI here)
    this.processPendingNotifications();
  }

  destroy(): void {
    // Unsubscribe from events
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];

    // Clear state
    this.entityEvolutionStates.clear();
    this.entityEvolvedWeapons.clear();
    this.pendingNotifications = [];
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Set weapon manager reference (for integration)
   */
  setWeaponManager(manager: WeaponManager): void {
    this.weaponManager = manager;

    // Register evolved weapons with the manager
    this.registerEvolvedWeapons();
  }

  /**
   * Register evolved weapon definitions with the weapon manager
   */
  private registerEvolvedWeapons(): void {
    if (!this.weaponManager) return;

    this.weaponManager.registerWeapon(DeathRayDefinition);
    this.weaponManager.registerWeapon(BulletStormDefinition);
    this.weaponManager.registerWeapon(SmartMissilesDefinition);
  }

  /**
   * Subscribe to game events
   */
  private subscribeToEvents(): void {
    // Listen for upgrade selections
    this.upgradeSystem.onUpgradeSelected(this.handleUpgradeSelected.bind(this));
  }

  // ========================================================================
  // Event Handlers
  // ========================================================================

  /**
   * Handle upgrade selected event
   */
  private handleUpgradeSelected(event: IUpgradeSelectedEvent): void {
    // Check all entities for evolution opportunities
    // In a full implementation, this would be entity-specific
    // For now, we check the local player (entity 0 placeholder)
    const playerEntity = 0;
    this.checkEvolutionReadiness(playerEntity);
  }

  // ========================================================================
  // Evolution Logic
  // ========================================================================

  /**
   * Register a new evolution recipe
   */
  registerRecipe(recipe: IEvolutionRecipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  /**
   * Get all registered recipes
   */
  getAllRecipes(): IEvolutionRecipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get recipe by ID
   */
  getRecipe(recipeId: string): IEvolutionRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Check if a specific evolution is available for an entity
   */
  canEvolve(entity: EntityId, recipeId: string): boolean {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return false;

    // Check weapon level
    const weaponLevel = this.getWeaponLevel(entity, recipe.baseWeaponId);
    if (weaponLevel < recipe.minWeaponLevel) return false;

    // Check passive level
    const passiveLevel = this.upgradeSystem.getUpgradeLevel(recipe.requiredPassiveId);
    if (passiveLevel < recipe.minPassiveLevel) return false;

    // Check if already evolved
    const evolvedWeapons = this.entityEvolvedWeapons.get(entity);
    if (evolvedWeapons?.has(recipe.evolvedWeaponId)) return false;

    return true;
  }

  /**
   * Get all available evolutions for an entity
   */
  getAvailableEvolutions(entity: EntityId): IEvolutionRecipe[] {
    const available: IEvolutionRecipe[] = [];

    for (const recipe of this.recipes.values()) {
      if (this.canEvolve(entity, recipe.id)) {
        available.push(recipe);
      }
    }

    return available;
  }

  /**
   * Execute weapon evolution
   */
  evolveWeapon(entity: EntityId, recipeId: string): boolean {
    if (!this.canEvolve(entity, recipeId)) {
      return false;
    }

    const recipe = this.recipes.get(recipeId)!;

    // Remove base weapon from weapon manager
    if (this.weaponManager) {
      this.weaponManager.removeWeapon(recipe.baseWeaponId);
    }

    // Add evolved weapon
    if (this.weaponManager) {
      this.weaponManager.addWeapon(recipe.evolvedWeaponId);
    }

    // Track evolution
    let evolvedWeapons = this.entityEvolvedWeapons.get(entity);
    if (!evolvedWeapons) {
      evolvedWeapons = new Set();
      this.entityEvolvedWeapons.set(entity, evolvedWeapons);
    }
    evolvedWeapons.add(recipe.evolvedWeaponId);

    // Update evolution state
    const states = this.getOrCreateEvolutionStates(entity);
    const state = states.get(recipe.id);
    if (state) {
      state.isUnlocked = true;
      state.evolvedAt = Date.now();
    }

    // Create notification
    const notification = this.createEvolutionNotification(recipe);
    this.pendingNotifications.push(notification);

    // Emit evolution complete event
    this.eventBus.emit('evolution:complete', {
      entity,
      recipeId,
      notification,
    });

    // Notify listeners
    for (const listener of this.evolutionCompleteListeners) {
      listener(notification, entity);
    }

    // Play evolution effects
    this.playEvolutionEffects(entity, recipe);

    return true;
  }

  /**
   * Check evolution readiness for all recipes
   */
  checkEvolutionReadiness(entity: EntityId): void {
    for (const recipe of this.recipes.values()) {
      const wasReady = this.isEvolutionReady(entity, recipe.id);
      const isNowReady = this.canEvolve(entity, recipe.id);

      // Update state
      this.updateEvolutionState(entity, recipe);

      // Notify if just became ready
      if (!wasReady && isNowReady) {
        this.onEvolutionReady(entity, recipe);
      }
    }
  }

  /**
   * Called when evolution becomes ready
   */
  private onEvolutionReady(entity: EntityId, recipe: IEvolutionRecipe): void {
    // Emit event
    this.eventBus.emit('evolution:ready', {
      entity,
      recipeId: recipe.id,
      recipe,
    });

    // Notify listeners
    for (const listener of this.evolutionReadyListeners) {
      listener(recipe, entity);
    }

    // Show notification that evolution is available
    this.showEvolutionReadyNotification(entity, recipe);
  }

  /**
   * Show notification that evolution is available
   */
  private showEvolutionReadyNotification(entity: EntityId, recipe: IEvolutionRecipe): void {
    this.eventBus.emit(GameEvents.SHOW_NOTIFICATION, {
      type: 'evolution_ready',
      title: 'Evolution Ready!',
      message: `${recipe.baseWeaponId} can evolve into ${recipe.evolutionName}!`,
      icon: recipe.icon,
      duration: 4000,
      entity,
    });
  }

  // ========================================================================
  // State Management
  // ========================================================================

  /**
   * Get or create evolution states for entity
   */
  private getOrCreateEvolutionStates(entity: EntityId): Map<string, IEvolutionState> {
    let states = this.entityEvolutionStates.get(entity);
    if (!states) {
      states = new Map();
      this.entityEvolutionStates.set(entity, states);
    }
    return states;
  }

  /**
   * Update evolution state for a recipe
   */
  private updateEvolutionState(entity: EntityId, recipe: IEvolutionRecipe): void {
    const states = this.getOrCreateEvolutionStates(entity);

    const weaponLevel = this.getWeaponLevel(entity, recipe.baseWeaponId);
    const passiveLevel = this.upgradeSystem.getUpgradeLevel(recipe.requiredPassiveId);
    const isReady = this.canEvolve(entity, recipe.id);

    const evolvedWeapons = this.entityEvolvedWeapons.get(entity);
    const isUnlocked = evolvedWeapons?.has(recipe.evolvedWeaponId) ?? false;

    let state = states.get(recipe.id);
    if (!state) {
      state = {
        recipeId: recipe.id,
        weaponLevel: 0,
        passiveLevel: 0,
        isReady: false,
        isUnlocked: false,
      };
      states.set(recipe.id, state);
    }

    state.weaponLevel = weaponLevel;
    state.passiveLevel = passiveLevel;
    state.isReady = isReady;
    state.isUnlocked = isUnlocked;
  }

  /**
   * Check if evolution was previously ready
   */
  private isEvolutionReady(entity: EntityId, recipeId: string): boolean {
    const states = this.entityEvolutionStates.get(entity);
    if (!states) return false;

    const state = states.get(recipeId);
    return state?.isReady ?? false;
  }

  /**
   * Get evolution state for a recipe
   */
  getEvolutionState(entity: EntityId, recipeId: string): IEvolutionState | undefined {
    const states = this.entityEvolutionStates.get(entity);
    return states?.get(recipeId);
  }

  /**
   * Get all evolution states for entity
   */
  getAllEvolutionStates(entity: EntityId): IEvolutionState[] {
    const states = this.entityEvolutionStates.get(entity);
    return states ? Array.from(states.values()) : [];
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Get weapon level (integrates with WeaponManager)
   */
  private getWeaponLevel(entity: EntityId, weaponId: string): number {
    if (this.weaponManager) {
      return this.weaponManager.getWeaponLevel(weaponId);
    }
    return 0;
  }

  /**
   * Create evolution notification
   */
  private createEvolutionNotification(recipe: IEvolutionRecipe): IEvolutionNotification {
    const evolvedDef = this.weaponManager?.getDefinition(recipe.evolvedWeaponId);
    const baseDef = this.weaponManager?.getDefinition(recipe.baseWeaponId);

    return {
      evolutionName: recipe.evolutionName,
      description: recipe.description,
      icon: recipe.icon,
      oldWeaponName: baseDef?.name ?? recipe.baseWeaponId,
      newWeaponName: evolvedDef?.name ?? recipe.evolvedWeaponId,
      timestamp: Date.now(),
    };
  }

  /**
   * Process pending notifications
   */
  private processPendingNotifications(): void {
    const now = Date.now();

    // Remove expired notifications
    this.pendingNotifications = this.pendingNotifications.filter(
      (n) => now - n.timestamp < this.notificationDuration
    );
  }

  /**
   * Get pending notifications
   */
  getPendingNotifications(): IEvolutionNotification[] {
    return [...this.pendingNotifications];
  }

  /**
   * Clear notifications
   */
  clearNotifications(): void {
    this.pendingNotifications = [];
  }

  // ========================================================================
  // Visual Effects
  // ========================================================================

  /**
   * Play evolution visual effects
   */
  private playEvolutionEffects(entity: EntityId, recipe: IEvolutionRecipe): void {
    const effectConfig = EVOLUTION_EFFECTS[recipe.evolvedWeaponId];
    if (!effectConfig) return;

    // Emit evolution effect event
    this.eventBus.emit('effect:evolution', {
      entity,
      weaponId: recipe.evolvedWeaponId,
      config: effectConfig,
    });

    // Screen flash
    this.eventBus.emit('screen:flash', {
      color: effectConfig.glowColor,
      duration: 500,
      intensity: 0.8,
    });

    // Screen shake
    this.eventBus.emit('screen:shake', {
      intensity: 8,
      duration: 300,
    });

    // Play sound
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'evolution_complete',
      volume: 1.0,
    });

    // Show notification
    this.showEvolutionCompleteNotification(recipe);
  }

  /**
   * Show evolution complete notification
   */
  private showEvolutionCompleteNotification(recipe: IEvolutionRecipe): void {
    this.eventBus.emit(GameEvents.SHOW_NOTIFICATION, {
      type: 'evolution_complete',
      title: 'WEAPON EVOLVED!',
      message: `${recipe.icon} ${recipe.evolutionName} ${recipe.icon}`,
      subMessage: recipe.description,
      duration: this.notificationDuration,
      style: 'legendary', // Special golden style
    });
  }

  /**
   * Get visual effect config for evolved weapon
   */
  getEvolutionEffectConfig(weaponId: string): IEvolutionEffectConfig | undefined {
    return EVOLUTION_EFFECTS[weaponId];
  }

  /**
   * Check if weapon is an evolved weapon
   */
  isEvolvedWeapon(weaponId: string): boolean {
    return EVOLUTION_EFFECTS[weaponId] !== undefined;
  }

  // ========================================================================
  // Event Listeners
  // ========================================================================

  /**
   * Register evolution ready listener
   */
  onEvolutionReadyEvent(listener: EvolutionReadyListener): void {
    this.evolutionReadyListeners.push(listener);
  }

  /**
   * Unregister evolution ready listener
   */
  offEvolutionReadyEvent(listener: EvolutionReadyListener): void {
    const index = this.evolutionReadyListeners.indexOf(listener);
    if (index !== -1) {
      this.evolutionReadyListeners.splice(index, 1);
    }
  }

  /**
   * Register evolution complete listener
   */
  onEvolutionCompleteEvent(listener: EvolutionCompleteListener): void {
    this.evolutionCompleteListeners.push(listener);
  }

  /**
   * Unregister evolution complete listener
   */
  offEvolutionCompleteEvent(listener: EvolutionCompleteListener): void {
    const index = this.evolutionCompleteListeners.indexOf(listener);
    if (index !== -1) {
      this.evolutionCompleteListeners.splice(index, 1);
    }
  }

  // ========================================================================
  // Progress & Requirements
  // ========================================================================

  /**
   * Get evolution progress (0-1)
   */
  getEvolutionProgress(entity: EntityId, recipeId: string): number {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return 0;

    const weaponLevel = this.getWeaponLevel(entity, recipe.baseWeaponId);
    const passiveLevel = this.upgradeSystem.getUpgradeLevel(recipe.requiredPassiveId);

    const weaponProgress = Math.min(1, weaponLevel / recipe.minWeaponLevel);
    const passiveProgress = Math.min(1, passiveLevel / recipe.minPassiveLevel);

    // Average of both requirements
    return (weaponProgress + passiveProgress) / 2;
  }

  /**
   * Get detailed requirements for evolution
   */
  getEvolutionRequirements(recipeId: string): {
    recipe: IEvolutionRecipe;
    weaponName: string;
    passiveName: string;
    currentWeaponLevel: number;
    requiredWeaponLevel: number;
    currentPassiveLevel: number;
    requiredPassiveLevel: number;
    isReady: boolean;
  } | null {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return null;

    const weaponDef = this.weaponManager?.getDefinition(recipe.baseWeaponId);
    const passive = this.upgradeSystem.getUpgrade(recipe.requiredPassiveId);
    const entity = 0; // Default entity

    const currentWeaponLevel = this.getWeaponLevel(entity, recipe.baseWeaponId);
    const currentPassiveLevel = this.upgradeSystem.getUpgradeLevel(recipe.requiredPassiveId);

    return {
      recipe,
      weaponName: weaponDef?.name ?? recipe.baseWeaponId,
      passiveName: passive?.name ?? recipe.requiredPassiveId,
      currentWeaponLevel,
      requiredWeaponLevel: recipe.minWeaponLevel,
      currentPassiveLevel,
      requiredPassiveLevel: recipe.minPassiveLevel,
      isReady: this.canEvolve(entity, recipeId),
    };
  }

  /**
   * Get all evolution requirements for display
   */
  getAllEvolutionRequirements(): ReturnType<typeof this.getEvolutionRequirements>[] {
    const requirements: ReturnType<typeof this.getEvolutionRequirements>[] = [];

    for (const recipe of this.recipes.values()) {
      const req = this.getEvolutionRequirements(recipe.id);
      if (req) {
        requirements.push(req);
      }
    }

    return requirements;
  }

  // ========================================================================
  // Persistence
  // ========================================================================

  /**
   * Export evolution state for saving
   */
  exportState(): object {
    const entityStates: Record<number, Record<string, IEvolutionState>> = {};

    for (const [entity, states] of this.entityEvolutionStates) {
      entityStates[entity] = Object.fromEntries(states);
    }

    const evolvedWeapons: Record<number, string[]> = {};

    for (const [entity, weapons] of this.entityEvolvedWeapons) {
      evolvedWeapons[entity] = Array.from(weapons);
    }

    return {
      evolutionStates: entityStates,
      evolvedWeapons,
    };
  }

  /**
   * Import evolution state from save
   */
  importState(state: {
    evolutionStates?: Record<number, Record<string, IEvolutionState>>;
    evolvedWeapons?: Record<number, string[]>;
  }): void {
    // Clear current state
    this.entityEvolutionStates.clear();
    this.entityEvolvedWeapons.clear();

    // Import evolution states
    if (state.evolutionStates) {
      for (const [entityStr, states] of Object.entries(state.evolutionStates)) {
        const entity = parseInt(entityStr, 10);
        const stateMap = new Map<string, IEvolutionState>();

        for (const [recipeId, evolutionState] of Object.entries(states)) {
          stateMap.set(recipeId, evolutionState as IEvolutionState);
        }

        this.entityEvolutionStates.set(entity, stateMap);
      }
    }

    // Import evolved weapons
    if (state.evolvedWeapons) {
      for (const [entityStr, weapons] of Object.entries(state.evolvedWeapons)) {
        const entity = parseInt(entityStr, 10);
        this.entityEvolvedWeapons.set(entity, new Set(weapons));
      }
    }
  }

  /**
   * Reset all evolution progress
   */
  reset(): void {
    this.entityEvolutionStates.clear();
    this.entityEvolvedWeapons.clear();
    this.pendingNotifications = [];
  }

  // ========================================================================
  // Integration with UpgradePool
  // ========================================================================

  /**
   * Get evolution recipes in format suitable for UpgradePool registration.
   * Call this and pass the result to UpgradePool.registerEvolutionRecipes()
   */
  getRecipesForUpgradePool(): Array<{
    id: string;
    name: string;
    description: string;
    baseWeaponId: string;
    requiredPassiveId: string;
    evolvedWeaponId: string;
  }> {
    const poolRecipes: Array<{
      id: string;
      name: string;
      description: string;
      baseWeaponId: string;
      requiredPassiveId: string;
      evolvedWeaponId: string;
    }> = [];

    for (const recipe of this.recipes.values()) {
      poolRecipes.push({
        id: recipe.id,
        name: recipe.evolutionName,
        description: recipe.description,
        baseWeaponId: recipe.baseWeaponId,
        requiredPassiveId: recipe.requiredPassiveId,
        evolvedWeaponId: recipe.evolvedWeaponId,
      });
    }

    return poolRecipes;
  }

  /**
   * Integrate with UpgradePool instance.
   * Registers all evolution recipes with the pool.
   */
  integrateWithUpgradePool(upgradePool: {
    registerEvolutionRecipes: (recipes: Array<{
      id: string;
      name: string;
      description: string;
      baseWeaponId: string;
      requiredPassiveId: string;
      evolvedWeaponId: string;
    }>) => void;
  }): void {
    upgradePool.registerEvolutionRecipes(this.getRecipesForUpgradePool());
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

/**
 * Create weapon evolution system instance
 */
export function createWeaponEvolution(eventBus: IEventBus): WeaponEvolution {
  return new WeaponEvolution(eventBus);
}

/**
 * Default export
 */
export default WeaponEvolution;
