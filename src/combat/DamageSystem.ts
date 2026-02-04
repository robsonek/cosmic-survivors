/**
 * DamageSystem - ECS system for processing damage.
 *
 * Handles:
 * - Damage calculation with armor reduction
 * - Critical hit processing
 * - Shield absorption
 * - Invulnerability frames
 * - Death handling
 * - Damage over time effects
 */

import { defineQuery, hasComponent, addComponent, removeComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus, DamageEvent, EntityKilledEvent } from '../shared/interfaces/IEventBus';
import { DamageType, GameEvents } from '../shared/interfaces/IEventBus';
import {
  Health,
  Position,
  DamageOverTime,
  Player,
  Tags,
  StatModifiers,
} from '../shared/types/components';
import {
  PLAYER_INVULNERABILITY_TIME,
  CRITICAL_HIT_MULTIPLIER,
  MAX_CRITICAL_CHANCE,
} from '../shared/constants/game';

/**
 * Result of a damage calculation.
 */
export interface DamageResult {
  /** Final damage dealt after reductions */
  finalDamage: number;
  /** Whether this was a critical hit */
  isCritical: boolean;
  /** Amount absorbed by shield */
  shieldAbsorbed: number;
  /** Whether the target died */
  killed: boolean;
  /** Was the damage blocked by invulnerability */
  blocked: boolean;
}

/**
 * DamageSystem - Processes all damage in the game.
 */
export class DamageSystem implements ISystem {
  public readonly name = 'DamageSystem';
  public readonly priority = 20; // After collision detection
  public readonly dependencies: string[] = ['CollisionSystem'];
  public enabled = true;

  private world!: IWorld;
  private eventBus!: IEventBus;

  // Query for entities with DoT effects
  private dotQuery!: ReturnType<typeof defineQuery>;

  // Query for entities with Health
  private healthQuery!: ReturnType<typeof defineQuery>;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.dotQuery = defineQuery([Health, DamageOverTime, Position]);
    this.healthQuery = defineQuery([Health, Position]);
  }

  /**
   * Update - process invulnerability timers and DoT effects.
   */
  update(dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;

    // Update invulnerability timers
    this.updateInvulnerability(rawWorld, dt);

    // Process damage over time effects
    this.processDamageOverTime(rawWorld, dt);
  }

  /**
   * Update invulnerability timers.
   */
  private updateInvulnerability(rawWorld: object, dt: number): void {
    const entities = this.healthQuery(rawWorld);

    for (const entity of entities) {
      if (Health.invulnerable[entity] === 1) {
        Health.invulnerableTime[entity] -= dt;

        if (Health.invulnerableTime[entity] <= 0) {
          Health.invulnerable[entity] = 0;
          Health.invulnerableTime[entity] = 0;

          // Remove invulnerable tag if present
          if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Invulnerable, entity)) {
            removeComponent(rawWorld as Parameters<typeof removeComponent>[0], Tags.Invulnerable, entity);
          }
        }
      }
    }
  }

  /**
   * Process damage over time effects.
   */
  private processDamageOverTime(rawWorld: object, dt: number): void {
    const entities = this.dotQuery(rawWorld);

    for (const entity of entities) {
      DamageOverTime.elapsed[entity] += dt;

      // Apply damage per second
      const dps = DamageOverTime.damagePerSecond[entity];
      const damageTypeNum = DamageOverTime.type[entity];
      const sourceEntity = DamageOverTime.sourceEntity[entity];

      // Apply damage tick
      this.dealDamage(
        sourceEntity,
        entity,
        dps * dt,
        this.getDamageTypeFromNumber(damageTypeNum),
        false // DoT doesn't crit
      );

      // Check if DoT duration expired
      if (DamageOverTime.elapsed[entity] >= DamageOverTime.duration[entity]) {
        removeComponent(rawWorld as Parameters<typeof removeComponent>[0], DamageOverTime, entity);
      }
    }
  }

  /**
   * Deal damage to a target.
   * @param source Entity dealing damage
   * @param target Entity receiving damage
   * @param amount Base damage amount
   * @param damageType Type of damage
   * @param canCrit Whether this damage can critically hit
   * @param critChance Override critical chance (0-1)
   * @param critMultiplier Override critical multiplier
   * @returns Damage calculation result
   */
  dealDamage(
    source: EntityId,
    target: EntityId,
    amount: number,
    damageType: DamageType,
    canCrit: boolean = true,
    critChance?: number,
    critMultiplier?: number
  ): DamageResult {
    const result: DamageResult = {
      finalDamage: 0,
      isCritical: false,
      shieldAbsorbed: 0,
      killed: false,
      blocked: false,
    };

    const rawWorld = this.world.raw;

    // Check if target has Health component
    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, target)) {
      return result;
    }

    // Check invulnerability
    if (Health.invulnerable[target] === 1) {
      result.blocked = true;
      return result;
    }

    // Check if target is dead
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, target)) {
      result.blocked = true;
      return result;
    }

    let finalDamage = amount;

    // Calculate critical hit
    if (canCrit) {
      const baseCritChance = critChance ?? this.getSourceCritChance(source);
      const baseCritMultiplier = critMultiplier ?? this.getSourceCritMultiplier(source);

      if (Math.random() < Math.min(baseCritChance, MAX_CRITICAL_CHANCE)) {
        result.isCritical = true;
        finalDamage *= baseCritMultiplier;
      }
    }

    // Apply armor reduction (percentage based)
    const armor = Health.armor[target];
    if (armor > 0) {
      // Armor provides diminishing returns damage reduction
      // Formula: reduction = armor / (armor + 100)
      // 100 armor = 50% reduction, 200 armor = 66% reduction, etc.
      const reduction = armor / (armor + 100);
      finalDamage *= (1 - reduction);
    }

    // Floor the damage (minimum 1 if not blocked)
    finalDamage = Math.max(1, Math.floor(finalDamage));

    // Apply shield absorption first
    const currentShield = Health.shield[target];
    if (currentShield > 0) {
      if (currentShield >= finalDamage) {
        Health.shield[target] = currentShield - finalDamage;
        result.shieldAbsorbed = finalDamage;
        finalDamage = 0;
      } else {
        result.shieldAbsorbed = currentShield;
        finalDamage -= currentShield;
        Health.shield[target] = 0;
      }
    }

    // Apply remaining damage to health
    if (finalDamage > 0) {
      const currentHealth = Health.current[target];
      const newHealth = currentHealth - finalDamage;
      Health.current[target] = Math.max(0, newHealth);
      result.finalDamage = finalDamage;

      // Check for death
      if (newHealth <= 0) {
        result.killed = true;
        this.handleDeath(source, target);
      } else {
        // Apply invulnerability frames for players
        if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Player, target)) {
          this.applyInvulnerability(target, PLAYER_INVULNERABILITY_TIME);
        }
      }
    }

    // Emit damage event
    const position = { x: Position.x[target], y: Position.y[target] };
    const damageEvent: DamageEvent = {
      source,
      target,
      amount: result.finalDamage + result.shieldAbsorbed,
      type: damageType,
      isCritical: result.isCritical,
      position,
    };
    this.eventBus.emit(GameEvents.DAMAGE, damageEvent);

    return result;
  }

  /**
   * Apply invulnerability to an entity.
   */
  applyInvulnerability(entity: EntityId, duration: number): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      return;
    }

    Health.invulnerable[entity] = 1;
    Health.invulnerableTime[entity] = duration;

    // Add invulnerable tag
    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Invulnerable, entity)) {
      addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Invulnerable, entity);
    }
  }

  /**
   * Heal an entity.
   */
  heal(entity: EntityId, amount: number): number {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      return 0;
    }

    const currentHealth = Health.current[entity];
    const maxHealth = Health.max[entity];
    const newHealth = Math.min(currentHealth + amount, maxHealth);
    const healedAmount = newHealth - currentHealth;

    Health.current[entity] = newHealth;

    return healedAmount;
  }

  /**
   * Restore shield to an entity.
   */
  restoreShield(entity: EntityId, amount: number): number {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      return 0;
    }

    const currentShield = Health.shield[entity];
    const maxShield = Health.shieldMax[entity];
    const newShield = Math.min(currentShield + amount, maxShield);
    const restoredAmount = newShield - currentShield;

    Health.shield[entity] = newShield;

    return restoredAmount;
  }

  /**
   * Apply damage over time effect.
   */
  applyDamageOverTime(
    source: EntityId,
    target: EntityId,
    damagePerSecond: number,
    duration: number,
    damageType: DamageType
  ): void {
    const rawWorld = this.world.raw;

    // Add DoT component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], DamageOverTime, target);

    DamageOverTime.damagePerSecond[target] = damagePerSecond;
    DamageOverTime.duration[target] = duration;
    DamageOverTime.elapsed[target] = 0;
    DamageOverTime.type[target] = this.getDamageTypeNumber(damageType);
    DamageOverTime.sourceEntity[target] = source;
  }

  /**
   * Handle entity death.
   */
  private handleDeath(killer: EntityId, entity: EntityId): void {
    const rawWorld = this.world.raw;

    // Add Dead tag
    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, entity)) {
      addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Dead, entity);
    }

    // Calculate XP value
    let xpValue = 1;
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Enemy, entity)) {
      // Could read from Enemy component if available
      xpValue = 1;
    }
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Boss, entity)) {
      xpValue = 100;
    }

    // Emit entity killed event
    const position = { x: Position.x[entity], y: Position.y[entity] };
    const killedEvent: EntityKilledEvent = {
      entity,
      killer,
      position,
      xpValue,
    };
    this.eventBus.emit(GameEvents.ENTITY_KILLED, killedEvent);

    // Increment killer's kill count if player
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Player, killer)) {
      Player.kills[killer]++;
    }
  }

  /**
   * Get critical chance from source entity.
   */
  private getSourceCritChance(source: EntityId): number {
    const rawWorld = this.world.raw;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], StatModifiers, source)) {
      return StatModifiers.critChance[source];
    }

    return 0;
  }

  /**
   * Get critical multiplier from source entity.
   */
  private getSourceCritMultiplier(source: EntityId): number {
    const rawWorld = this.world.raw;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], StatModifiers, source)) {
      const bonus = StatModifiers.critMultiplier[source];
      return CRITICAL_HIT_MULTIPLIER + bonus;
    }

    return CRITICAL_HIT_MULTIPLIER;
  }

  /**
   * Convert DamageType enum to number for storage.
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
   * Check if entity is dead.
   */
  isDead(entity: EntityId): boolean {
    const rawWorld = this.world.raw;
    return hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, entity);
  }

  /**
   * Check if entity is invulnerable.
   */
  isInvulnerable(entity: EntityId): boolean {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      return false;
    }

    return Health.invulnerable[entity] === 1;
  }

  /**
   * Get entity's current health percentage.
   */
  getHealthPercent(entity: EntityId): number {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      return 0;
    }

    return Health.current[entity] / Health.max[entity];
  }

  destroy(): void {
    // Nothing to clean up
  }
}
