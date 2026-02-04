/**
 * AttackBehavior - AI behavior for attacking targets.
 *
 * This behavior handles attack execution when the enemy is within attack range.
 * Supports both melee and ranged attack types.
 */

import type { EntityId } from '../../shared/interfaces/IWorld';
import type { IAIBehavior, IAIContext, IAIBehaviorConfig } from '../../shared/interfaces/IAI';
import { Position, Velocity, AIController } from '../../shared/types/components';
import { Steering } from '../pathfinding/Steering';

/**
 * Attack type enumeration.
 */
export enum AttackType {
  Melee = 'melee',
  Ranged = 'ranged',
  Area = 'area',
}

/**
 * Configuration for attack behavior.
 */
export interface IAttackConfig {
  /** Attack range - distance at which attack can be executed */
  attackRange: number;
  /** Cooldown between attacks in seconds */
  attackCooldown: number;
  /** Base damage of the attack */
  damage: number;
  /** Type of attack */
  attackType: AttackType;
  /** Movement speed while attacking (for melee) */
  moveSpeed: number;
  /** Whether to stop while attacking */
  stopWhileAttacking: boolean;
  /** Duration of attack animation/lock */
  attackDuration: number;
  /** Projectile speed for ranged attacks */
  projectileSpeed?: number;
  /** Area of effect radius for area attacks */
  aoeRadius?: number;
  /** Callback when attack is executed */
  onAttack?: (entity: EntityId, target: EntityId, config: IAttackConfig) => void;
}

/**
 * Per-entity attack state.
 */
interface AttackState {
  cooldownRemaining: number;
  isAttacking: boolean;
  attackTimeRemaining: number;
}

/**
 * AttackBehavior - Handles enemy attacks.
 */
export class AttackBehavior implements IAIBehavior {
  public readonly name = 'Attack';
  public readonly priority = 70; // Higher priority than chase

  private readonly config: IAttackConfig;
  private readonly entityStates: Map<EntityId, AttackState> = new Map();

  constructor(config?: Partial<IAttackConfig>) {
    this.config = {
      attackRange: 50,
      attackCooldown: 1.0,
      damage: 10,
      attackType: AttackType.Melee,
      moveSpeed: 50,
      stopWhileAttacking: true,
      attackDuration: 0.3,
      ...config,
    };
  }

  /**
   * Get or create attack state for an entity.
   */
  private getState(entity: EntityId): AttackState {
    let state = this.entityStates.get(entity);
    if (!state) {
      state = {
        cooldownRemaining: 0,
        isAttacking: false,
        attackTimeRemaining: 0,
      };
      this.entityStates.set(entity, state);
    }
    return state;
  }

  /**
   * Check if this behavior should activate.
   * Activates when target is within attack range and cooldown is ready.
   */
  shouldActivate(entity: EntityId, context: IAIContext): boolean {
    // Need a valid target
    if (context.target === null) {
      return false;
    }

    // Check if target is within attack range
    if (context.targetDistance > this.config.attackRange) {
      return false;
    }

    // Check cooldown
    const state = this.getState(entity);

    // Always activate if currently attacking (to finish the attack)
    if (state.isAttacking) {
      return true;
    }

    // Check if cooldown is ready
    return state.cooldownRemaining <= 0;
  }

  /**
   * Execute attack behavior.
   */
  execute(entity: EntityId, context: IAIContext, dt: number): void {
    const state = this.getState(entity);

    // Update cooldown
    if (state.cooldownRemaining > 0) {
      state.cooldownRemaining -= dt;
    }

    // Update attack duration if currently attacking
    if (state.isAttacking) {
      state.attackTimeRemaining -= dt;

      if (state.attackTimeRemaining <= 0) {
        state.isAttacking = false;
      }

      // Stop movement during attack if configured
      if (this.config.stopWhileAttacking) {
        Velocity.x[entity] = 0;
        Velocity.y[entity] = 0;
      }

      return;
    }

    // Check if we can attack
    if (context.target === null) {
      return;
    }

    const targetDist = context.targetDistance;

    // If target is in range and cooldown is ready, attack
    if (targetDist <= this.config.attackRange && state.cooldownRemaining <= 0) {
      this.performAttack(entity, context.target, state);
    } else if (targetDist > this.config.attackRange * 0.5) {
      // Move closer if not in optimal range (but still in attack range)
      const entityX = Position.x[entity];
      const entityY = Position.y[entity];
      const targetX = Position.x[context.target];
      const targetY = Position.y[context.target];

      const steering = Steering.seek(entityX, entityY, targetX, targetY);
      Steering.applyToEntity(entity, steering, this.config.moveSpeed, dt);
    } else {
      // In range, stop and face target
      Velocity.x[entity] *= 0.8;
      Velocity.y[entity] *= 0.8;
    }
  }

  /**
   * Perform the actual attack.
   */
  private performAttack(entity: EntityId, target: EntityId, state: AttackState): void {
    // Start attack
    state.isAttacking = true;
    state.attackTimeRemaining = this.config.attackDuration;
    state.cooldownRemaining = this.config.attackCooldown;

    // Update AIController's last attack time
    AIController.lastAttackTime[entity] = 0; // Will be updated by AISystem

    // Call attack callback if provided
    if (this.config.onAttack) {
      this.config.onAttack(entity, target, this.config);
    }

    // The actual damage dealing should be handled by a combat system
    // This behavior just triggers the attack
  }

  /**
   * Called when behavior ends.
   */
  onExit(entity: EntityId): void {
    const state = this.getState(entity);
    // If we exit mid-attack, reset attacking state but keep cooldown
    if (state.isAttacking) {
      state.isAttacking = false;
    }
  }

  /**
   * Clean up entity state when entity is removed.
   */
  cleanupEntity(entity: EntityId): void {
    this.entityStates.delete(entity);
  }

  /**
   * Update cooldown for an entity (called each frame by AISystem).
   */
  updateCooldown(entity: EntityId, dt: number): void {
    const state = this.getState(entity);
    if (state.cooldownRemaining > 0) {
      state.cooldownRemaining -= dt;
    }
  }

  /**
   * Check if entity is currently attacking.
   */
  isEntityAttacking(entity: EntityId): boolean {
    const state = this.entityStates.get(entity);
    return state?.isAttacking ?? false;
  }

  /**
   * Get remaining cooldown for an entity.
   */
  getCooldownRemaining(entity: EntityId): number {
    const state = this.entityStates.get(entity);
    return state?.cooldownRemaining ?? 0;
  }

  /**
   * Set attack callback.
   */
  setOnAttack(callback: (entity: EntityId, target: EntityId, config: IAttackConfig) => void): void {
    this.config.onAttack = callback;
  }

  /**
   * Create attack behavior from AI behavior config.
   */
  static fromConfig(config: IAIBehaviorConfig): AttackBehavior {
    return new AttackBehavior({
      attackRange: config.attackRange,
      attackCooldown: config.attackCooldown,
      moveSpeed: config.moveSpeed,
    });
  }

  /**
   * Get the attack configuration.
   */
  getConfig(): Readonly<IAttackConfig> {
    return this.config;
  }
}
