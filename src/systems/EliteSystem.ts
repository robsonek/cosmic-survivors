/**
 * EliteSystem - System for elite enemy modifiers
 *
 * Handles:
 * - 5% chance for enemy to spawn as Elite with random modifier
 * - Modifier types: Vampiric, Fast, Giant, Shielded, Explosive
 * - Visual indicators for each type (auras, trails, size changes)
 * - 3x XP multiplier for elites
 * - Modifier stacking on bosses
 * - Integration with WaveManager enemy spawning
 */

import { defineQuery, hasComponent, addComponent, removeComponent, defineComponent, Types } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus, DamageEvent, EntityKilledEvent } from '../shared/interfaces/IEventBus';
import { GameEvents, DamageType } from '../shared/interfaces/IEventBus';
import {
  Health,
  Position,
  Movement,
  Scale,
  Sprite,
  CircleCollider,
  Tags,
} from '../shared/types/components';

// ============================================================================
// ELITE MODIFIERS
// ============================================================================

/**
 * Elite modifier types
 */
export enum EliteModifier {
  None = 0,
  Vampiric = 1,    // Heals on hit (red aura)
  Fast = 2,        // 2x speed (blue trail)
  Giant = 3,       // 2x size, 3x HP (larger sprite)
  Shielded = 4,    // Regenerating shield (blue bubble)
  Explosive = 5,   // Explodes on death (orange glow)
}

/**
 * Elite modifier configuration
 */
export interface IEliteModifierConfig {
  /** Modifier type */
  type: EliteModifier;
  /** Display name */
  name: string;
  /** Visual tint color */
  tintColor: number;
  /** Aura/effect color */
  effectColor: number;
  /** XP multiplier (applied on top of base 3x) */
  xpMultiplier: number;
  /** Health multiplier */
  healthMultiplier: number;
  /** Speed multiplier */
  speedMultiplier: number;
  /** Scale multiplier */
  scaleMultiplier: number;
}

/**
 * Elite modifier configurations
 */
export const ELITE_MODIFIER_CONFIGS: Record<EliteModifier, IEliteModifierConfig> = {
  [EliteModifier.None]: {
    type: EliteModifier.None,
    name: 'None',
    tintColor: 0xFFFFFFFF,
    effectColor: 0xFFFFFF,
    xpMultiplier: 1.0,
    healthMultiplier: 1.0,
    speedMultiplier: 1.0,
    scaleMultiplier: 1.0,
  },
  [EliteModifier.Vampiric]: {
    type: EliteModifier.Vampiric,
    name: 'Vampiric',
    tintColor: 0xFFFF4444,  // Red tint
    effectColor: 0xFF0000,  // Red aura
    xpMultiplier: 1.2,
    healthMultiplier: 1.5,
    speedMultiplier: 1.0,
    scaleMultiplier: 1.1,
  },
  [EliteModifier.Fast]: {
    type: EliteModifier.Fast,
    name: 'Fast',
    tintColor: 0xFF4488FF,  // Blue tint
    effectColor: 0x0088FF,  // Blue trail
    xpMultiplier: 1.1,
    healthMultiplier: 0.8,
    speedMultiplier: 2.0,
    scaleMultiplier: 0.9,
  },
  [EliteModifier.Giant]: {
    type: EliteModifier.Giant,
    name: 'Giant',
    tintColor: 0xFFFF8800,  // Orange tint
    effectColor: 0xFF8800,  // Orange glow
    xpMultiplier: 1.5,
    healthMultiplier: 3.0,
    speedMultiplier: 0.7,
    scaleMultiplier: 2.0,
  },
  [EliteModifier.Shielded]: {
    type: EliteModifier.Shielded,
    name: 'Shielded',
    tintColor: 0xFF88FFFF,  // Cyan tint
    effectColor: 0x00FFFF,  // Cyan bubble
    xpMultiplier: 1.3,
    healthMultiplier: 1.2,
    speedMultiplier: 0.9,
    scaleMultiplier: 1.15,
  },
  [EliteModifier.Explosive]: {
    type: EliteModifier.Explosive,
    name: 'Explosive',
    tintColor: 0xFFFFAA00,  // Orange-yellow tint
    effectColor: 0xFFAA00,  // Orange glow
    xpMultiplier: 1.2,
    healthMultiplier: 1.0,
    speedMultiplier: 1.3,
    scaleMultiplier: 1.0,
  },
};

// ============================================================================
// ELITE COMPONENT
// ============================================================================

/**
 * Elite component - stores elite status and modifiers for an entity.
 * Using bitmask for modifiers allows stacking on bosses.
 */
export const Elite = defineComponent({
  /** Bitmask of active modifiers (1 << EliteModifier) */
  modifiers: Types.ui16,
  /** Base XP value before elite multiplier */
  baseXpValue: Types.ui32,
  /** Shield regeneration timer (for Shielded) */
  shieldRegenTimer: Types.f32,
  /** Shield amount (for Shielded) */
  shieldAmount: Types.f32,
  /** Max shield (for Shielded) */
  shieldMax: Types.f32,
  /** Vampiric heal amount per hit */
  vampiricHealPercent: Types.f32,
  /** Explosion radius (for Explosive) */
  explosionRadius: Types.f32,
  /** Explosion damage (for Explosive) */
  explosionDamage: Types.f32,
  /** Visual effect timer (for animations) */
  effectTimer: Types.f32,
});

// ============================================================================
// CONSTANTS
// ============================================================================

/** Chance for enemy to spawn as elite (5%) */
export const ELITE_SPAWN_CHANCE = 0.05;

/** Base XP multiplier for all elites */
export const ELITE_XP_MULTIPLIER = 3.0;

/** Shield regeneration rate (per second) */
const SHIELD_REGEN_RATE = 10.0;

/** Shield regeneration delay after taking damage (seconds) */
const SHIELD_REGEN_DELAY = 2.0;

/** Vampiric heal percent per hit */
const VAMPIRIC_HEAL_PERCENT = 0.15;

/** Explosion radius base */
const EXPLOSION_RADIUS_BASE = 80;

/** Explosion damage multiplier (of enemy's base damage) */
const EXPLOSION_DAMAGE_MULTIPLIER = 2.0;

/** Number of modifiers to stack on bosses */
const BOSS_MODIFIER_COUNT = 2;

// ============================================================================
// ELITE SYSTEM
// ============================================================================

/**
 * EliteSystem - Manages elite enemy modifiers and their effects.
 */
export class EliteSystem implements ISystem {
  public readonly name = 'EliteSystem';
  public readonly priority = 35; // After AI, before visual effects
  public readonly dependencies: string[] = ['AISystem'];
  public enabled = true;

  private world!: IWorld;
  private eventBus!: IEventBus;

  // Query for elite enemies
  private eliteQuery!: ReturnType<typeof defineQuery>;

  // Query for enemies with health (for damage events)
  private enemyQuery!: ReturnType<typeof defineQuery>;

  // Track entities that need explosion on death
  private pendingExplosions: Map<EntityId, { x: number; y: number; radius: number; damage: number }> = new Map();

  // Visual effect callbacks (set by rendering system)
  private onEliteSpawn?: (entity: EntityId, modifiers: EliteModifier[]) => void;
  private onVampiricHeal?: (entity: EntityId, amount: number) => void;
  private onExplosion?: (x: number, y: number, radius: number) => void;
  private onShieldHit?: (entity: EntityId) => void;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.eliteQuery = defineQuery([Elite, Health, Position]);
    this.enemyQuery = defineQuery([Health, Position, Tags.Enemy]);

    // Subscribe to damage events for vampiric healing
    this.eventBus.on<DamageEvent>(GameEvents.DAMAGE, (event) => {
      this.handleDamageEvent(event);
    });

    // Subscribe to entity killed events for explosions
    this.eventBus.on<EntityKilledEvent>(GameEvents.ENTITY_KILLED, (event) => {
      this.handleEntityKilled(event);
    });
  }

  /**
   * Update elite systems (shield regen, visual effects).
   */
  update(dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;
    const elites = this.eliteQuery(rawWorld);

    for (const entity of elites) {
      // Update effect timer
      Elite.effectTimer[entity] += dt;

      // Handle shield regeneration for Shielded elites
      if (this.hasModifier(entity, EliteModifier.Shielded)) {
        this.updateShieldRegen(entity, dt);
      }
    }

    // Process pending explosions
    this.processExplosions();
  }

  /**
   * Update shield regeneration for a shielded elite.
   */
  private updateShieldRegen(entity: EntityId, dt: number): void {
    const timer = Elite.shieldRegenTimer[entity];

    if (timer > 0) {
      Elite.shieldRegenTimer[entity] = timer - dt;
      return;
    }

    const currentShield = Elite.shieldAmount[entity];
    const maxShield = Elite.shieldMax[entity];

    if (currentShield < maxShield) {
      const newShield = Math.min(currentShield + SHIELD_REGEN_RATE * dt, maxShield);
      Elite.shieldAmount[entity] = newShield;

      // Also update the Health component shield
      Health.shield[entity] = newShield;
    }
  }

  /**
   * Handle damage events for vampiric healing and shield tracking.
   */
  private handleDamageEvent(event: DamageEvent): void {
    const rawWorld = this.world.raw;
    const { source, target, amount } = event;

    // Check if source is a vampiric elite (enemy dealing damage)
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, source)) {
      if (this.hasModifier(source, EliteModifier.Vampiric) && amount > 0) {
        // Heal the vampiric elite
        const healPercent = Elite.vampiricHealPercent[source];
        const healAmount = amount * healPercent;

        const currentHealth = Health.current[source];
        const maxHealth = Health.max[source];
        const newHealth = Math.min(currentHealth + healAmount, maxHealth);

        if (newHealth > currentHealth) {
          Health.current[source] = newHealth;
          this.onVampiricHeal?.(source, newHealth - currentHealth);
        }
      }
    }

    // Check if target is a shielded elite taking damage
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, target)) {
      if (this.hasModifier(target, EliteModifier.Shielded)) {
        // Reset shield regen timer
        Elite.shieldRegenTimer[target] = SHIELD_REGEN_DELAY;
        this.onShieldHit?.(target);
      }
    }
  }

  /**
   * Handle entity killed events for explosions.
   */
  private handleEntityKilled(event: EntityKilledEvent): void {
    const rawWorld = this.world.raw;
    const { entity, position } = event;

    // Check if killed entity is an explosive elite
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, entity)) {
      if (this.hasModifier(entity, EliteModifier.Explosive)) {
        // Queue explosion
        this.pendingExplosions.set(entity, {
          x: position.x,
          y: position.y,
          radius: Elite.explosionRadius[entity],
          damage: Elite.explosionDamage[entity],
        });
      }
    }
  }

  /**
   * Process pending explosions and deal damage.
   */
  private processExplosions(): void {
    if (this.pendingExplosions.size === 0) return;

    const rawWorld = this.world.raw;

    for (const [_entityId, explosion] of this.pendingExplosions) {
      const { x, y, radius, damage } = explosion;

      // Find all entities in explosion radius
      const allEntities = this.enemyQuery(rawWorld);
      const radiusSq = radius * radius;

      for (const targetEntity of allEntities) {
        // Skip if target is also dead
        if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, targetEntity)) {
          continue;
        }

        // Skip enemies (explosion only damages players)
        if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Enemy, targetEntity)) {
          continue;
        }

        const targetX = Position.x[targetEntity];
        const targetY = Position.y[targetEntity];
        const dx = targetX - x;
        const dy = targetY - y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          // Calculate falloff damage (linear falloff from center)
          const dist = Math.sqrt(distSq);
          const falloff = 1 - (dist / radius);
          const finalDamage = damage * falloff;

          // Emit damage event
          const damageEvent: DamageEvent = {
            source: -1, // No source (explosion)
            target: targetEntity,
            amount: finalDamage,
            type: DamageType.Fire,
            isCritical: false,
            position: { x: targetX, y: targetY },
          };
          this.eventBus.emit(GameEvents.DAMAGE, damageEvent);
        }
      }

      // Trigger visual effect
      this.onExplosion?.(x, y, radius);
    }

    this.pendingExplosions.clear();
  }

  // ============================================================================
  // ELITE CREATION
  // ============================================================================

  /**
   * Attempt to make an enemy elite with random modifier(s).
   * Returns true if the enemy became elite.
   *
   * @param entity Enemy entity to potentially make elite
   * @param forceElite Force elite status (ignores chance roll)
   * @param forceBoss Treat as boss (stack multiple modifiers)
   * @param baseXpValue Base XP value of the enemy
   * @param baseDamage Base damage of the enemy (for explosion)
   */
  tryMakeElite(
    entity: EntityId,
    forceElite: boolean = false,
    forceBoss: boolean = false,
    baseXpValue: number = 1,
    baseDamage: number = 10
  ): boolean {
    const rawWorld = this.world.raw;

    // Check if already elite
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, entity)) {
      return false;
    }

    // Check if this is a boss
    const isBoss = forceBoss || hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Boss, entity);

    // Roll for elite chance (bosses always become elite)
    if (!forceElite && !isBoss && Math.random() > ELITE_SPAWN_CHANCE) {
      return false;
    }

    // Add Elite component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Elite, entity);

    // Determine number of modifiers
    const modifierCount = isBoss ? BOSS_MODIFIER_COUNT : 1;

    // Select random modifiers
    const selectedModifiers = this.selectRandomModifiers(modifierCount);

    // Apply modifiers
    let modifierMask = 0;
    let totalHealthMultiplier = 1.0;
    let totalSpeedMultiplier = 1.0;
    let totalScaleMultiplier = 1.0;
    let totalXpMultiplier = ELITE_XP_MULTIPLIER;

    for (const modifier of selectedModifiers) {
      modifierMask |= (1 << modifier);

      const config = ELITE_MODIFIER_CONFIGS[modifier];
      totalHealthMultiplier *= config.healthMultiplier;
      totalSpeedMultiplier *= config.speedMultiplier;
      totalScaleMultiplier *= config.scaleMultiplier;
      totalXpMultiplier *= config.xpMultiplier;
    }

    // Store modifier bitmask
    Elite.modifiers[entity] = modifierMask;
    Elite.baseXpValue[entity] = baseXpValue;
    Elite.effectTimer[entity] = 0;

    // Apply health multiplier
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      const currentMax = Health.max[entity];
      const newMax = Math.floor(currentMax * totalHealthMultiplier);
      Health.max[entity] = newMax;
      Health.current[entity] = newMax;
    }

    // Apply speed multiplier
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entity)) {
      Movement.maxSpeed[entity] *= totalSpeedMultiplier;
      Movement.acceleration[entity] *= totalSpeedMultiplier;
    }

    // Apply scale multiplier
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Scale, entity)) {
      Scale.x[entity] *= totalScaleMultiplier;
      Scale.y[entity] *= totalScaleMultiplier;
    }

    // Update sprite scale as well
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Sprite, entity)) {
      Sprite.width[entity] *= totalScaleMultiplier;
      Sprite.height[entity] *= totalScaleMultiplier;

      // Apply tint based on primary modifier
      if (selectedModifiers.length > 0) {
        const primaryConfig = ELITE_MODIFIER_CONFIGS[selectedModifiers[0]];
        Sprite.tint[entity] = primaryConfig.tintColor;
      }
    }

    // Update collider radius
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
      CircleCollider.radius[entity] *= totalScaleMultiplier;
    }

    // Set up modifier-specific data
    for (const modifier of selectedModifiers) {
      this.initializeModifier(entity, modifier, baseDamage);
    }

    // Trigger visual effect callback
    this.onEliteSpawn?.(entity, selectedModifiers);

    return true;
  }

  /**
   * Select random modifiers for an elite.
   */
  private selectRandomModifiers(count: number): EliteModifier[] {
    const availableModifiers = [
      EliteModifier.Vampiric,
      EliteModifier.Fast,
      EliteModifier.Giant,
      EliteModifier.Shielded,
      EliteModifier.Explosive,
    ];

    const selected: EliteModifier[] = [];

    for (let i = 0; i < count && availableModifiers.length > 0; i++) {
      const index = Math.floor(Math.random() * availableModifiers.length);
      selected.push(availableModifiers[index]);
      availableModifiers.splice(index, 1);
    }

    return selected;
  }

  /**
   * Initialize modifier-specific data.
   */
  private initializeModifier(entity: EntityId, modifier: EliteModifier, baseDamage: number): void {
    const rawWorld = this.world.raw;

    switch (modifier) {
      case EliteModifier.Vampiric:
        Elite.vampiricHealPercent[entity] = VAMPIRIC_HEAL_PERCENT;
        break;

      case EliteModifier.Shielded:
        // Set up regenerating shield
        const maxHealth = Health.max[entity];
        const shieldMax = maxHealth * 0.5; // 50% of max health as shield
        Elite.shieldMax[entity] = shieldMax;
        Elite.shieldAmount[entity] = shieldMax;
        Elite.shieldRegenTimer[entity] = 0;

        // Update Health component
        if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
          Health.shieldMax[entity] = shieldMax;
          Health.shield[entity] = shieldMax;
        }
        break;

      case EliteModifier.Explosive:
        Elite.explosionRadius[entity] = EXPLOSION_RADIUS_BASE;
        Elite.explosionDamage[entity] = baseDamage * EXPLOSION_DAMAGE_MULTIPLIER;
        break;

      default:
        // Other modifiers don't need special initialization
        break;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if an entity has a specific elite modifier.
   */
  hasModifier(entity: EntityId, modifier: EliteModifier): boolean {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, entity)) {
      return false;
    }

    const mask = 1 << modifier;
    return (Elite.modifiers[entity] & mask) !== 0;
  }

  /**
   * Get all modifiers for an entity.
   */
  getModifiers(entity: EntityId): EliteModifier[] {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, entity)) {
      return [];
    }

    const modifierMask = Elite.modifiers[entity];
    const modifiers: EliteModifier[] = [];

    for (let i = 1; i <= 5; i++) {
      if ((modifierMask & (1 << i)) !== 0) {
        modifiers.push(i as EliteModifier);
      }
    }

    return modifiers;
  }

  /**
   * Check if an entity is elite.
   */
  isElite(entity: EntityId): boolean {
    const rawWorld = this.world.raw;
    return hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, entity);
  }

  /**
   * Get the XP multiplier for an elite entity.
   */
  getXpMultiplier(entity: EntityId): number {
    if (!this.isElite(entity)) {
      return 1.0;
    }

    const modifiers = this.getModifiers(entity);
    let multiplier = ELITE_XP_MULTIPLIER;

    for (const modifier of modifiers) {
      multiplier *= ELITE_MODIFIER_CONFIGS[modifier].xpMultiplier;
    }

    return multiplier;
  }

  /**
   * Get the display name for an elite entity.
   */
  getEliteDisplayName(entity: EntityId, baseName: string): string {
    const modifiers = this.getModifiers(entity);

    if (modifiers.length === 0) {
      return baseName;
    }

    const modifierNames = modifiers
      .map(m => ELITE_MODIFIER_CONFIGS[m].name)
      .join(' ');

    return `${modifierNames} ${baseName}`;
  }

  /**
   * Get modifier configuration.
   */
  getModifierConfig(modifier: EliteModifier): IEliteModifierConfig {
    return ELITE_MODIFIER_CONFIGS[modifier];
  }

  // ============================================================================
  // VISUAL EFFECT CALLBACKS
  // ============================================================================

  /**
   * Set callback for when an elite spawns (for visual effects).
   */
  setOnEliteSpawn(callback: (entity: EntityId, modifiers: EliteModifier[]) => void): void {
    this.onEliteSpawn = callback;
  }

  /**
   * Set callback for vampiric healing effect.
   */
  setOnVampiricHeal(callback: (entity: EntityId, amount: number) => void): void {
    this.onVampiricHeal = callback;
  }

  /**
   * Set callback for explosion effect.
   */
  setOnExplosion(callback: (x: number, y: number, radius: number) => void): void {
    this.onExplosion = callback;
  }

  /**
   * Set callback for shield hit effect.
   */
  setOnShieldHit(callback: (entity: EntityId) => void): void {
    this.onShieldHit = callback;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Remove elite status from an entity.
   */
  removeElite(entity: EntityId): void {
    const rawWorld = this.world.raw;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Elite, entity)) {
      removeComponent(rawWorld as Parameters<typeof removeComponent>[0], Elite, entity);
    }
  }

  destroy(): void {
    this.pendingExplosions.clear();
    this.onEliteSpawn = undefined;
    this.onVampiricHeal = undefined;
    this.onExplosion = undefined;
    this.onShieldHit = undefined;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

// Note: The system should be instantiated with an event bus, so we export the class
// rather than a singleton. The game should create the instance.

export default EliteSystem;
