/**
 * AISystem - ECS System for AI behavior management.
 *
 * Manages AI state machines, target selection, and behavior execution
 * for all enemy entities.
 */

import { defineQuery, hasComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IAIContext, IAIBehavior, IAIBehaviorConfig } from '../shared/interfaces/IAI';
import { AIState } from '../shared/interfaces/IAI';
import { CollisionLayer } from '../shared/interfaces/IPhysics';
import {
  Position,
  Velocity,
  AIController,
  Health,
  Flocking,
  Tags,
} from '../shared/types/components';
import { SpatialHash } from '../spatial/SpatialHash';
import { distance } from '../shared/utils/math';
import { EnemyRegistry } from './definitions/EnemyDefinition';

// Behaviors
import { ChasePlayerBehavior } from './behaviors/ChasePlayerBehavior';
import { WanderBehavior } from './behaviors/WanderBehavior';
import { AttackBehavior } from './behaviors/AttackBehavior';
import { FlockingBehavior } from './behaviors/FlockingBehavior';

/**
 * Map numeric AI state to enum.
 */
const NumberToAIState: AIState[] = [
  AIState.Idle,
  AIState.Wander,
  AIState.Chase,
  AIState.Attack,
  AIState.Flee,
  AIState.Stunned,
  AIState.Dead,
];

/**
 * Map AI state enum to numeric value.
 */
const AIStateToNumber: Record<AIState, number> = {
  [AIState.Idle]: 0,
  [AIState.Wander]: 1,
  [AIState.Chase]: 2,
  [AIState.Attack]: 3,
  [AIState.Flee]: 4,
  [AIState.Stunned]: 5,
  [AIState.Dead]: 6,
};

/**
 * Per-entity AI data that doesn't fit in ECS components.
 */
interface EntityAIData {
  currentBehavior: IAIBehavior | null;
  behaviors: IAIBehavior[];
  config: IAIBehaviorConfig;
  customData: Record<string, unknown>;
}

/**
 * AISystem - Manages enemy AI behavior.
 */
export class AISystem implements ISystem {
  public readonly name = 'AISystem';
  public readonly priority = 20; // After input, before physics
  public readonly dependencies: string[] = [];
  public enabled = true;

  private world!: IWorld;
  private spatialHash: SpatialHash | null = null;

  // Queries
  private aiQuery!: ReturnType<typeof defineQuery>;
  private playerQuery!: ReturnType<typeof defineQuery>;

  // Per-entity AI data
  private entityData: Map<EntityId, EntityAIData> = new Map();

  // Shared behaviors (used when entities don't have custom configs)
  private defaultBehaviors: {
    chase: ChasePlayerBehavior;
    wander: WanderBehavior;
    attack: AttackBehavior;
    flocking: FlockingBehavior;
  };

  // Callback for when an attack is executed
  private onAttackCallback: ((attacker: EntityId, target: EntityId, damage: number) => void) | null = null;

  constructor() {
    // Create default behaviors
    this.defaultBehaviors = {
      chase: new ChasePlayerBehavior(),
      wander: new WanderBehavior(),
      attack: new AttackBehavior(),
      flocking: new FlockingBehavior(),
    };
  }

  /**
   * Initialize the AI system.
   */
  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.aiQuery = defineQuery([Position, Velocity, AIController]);
    this.playerQuery = defineQuery([Position, Tags.Player]);

    // Set up attack callback
    this.defaultBehaviors.attack.setOnAttack((attacker, target, config) => {
      if (this.onAttackCallback) {
        this.onAttackCallback(attacker, target, config.damage);
      }
    });
  }

  /**
   * Set the spatial hash for neighbor queries.
   */
  setSpatialHash(spatial: SpatialHash): void {
    this.spatialHash = spatial;
    this.defaultBehaviors.flocking.setSpatialHash(spatial);
  }

  /**
   * Set attack callback.
   */
  setOnAttack(callback: (attacker: EntityId, target: EntityId, damage: number) => void): void {
    this.onAttackCallback = callback;
  }

  /**
   * Update all AI entities.
   */
  update(dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;
    const aiEntities = this.aiQuery(rawWorld);
    const players = this.playerQuery(rawWorld);

    // Process each AI entity
    for (const entity of aiEntities) {
      this.updateEntity(entity, dt, players);
    }
  }

  /**
   * Update a single AI entity.
   */
  private updateEntity(entity: EntityId, dt: number, players: EntityId[]): void {
    const rawWorld = this.world.raw;

    // Skip dead entities
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, entity)) {
      return;
    }

    // Get or create entity AI data
    const data = this.getOrCreateEntityData(entity);

    // Update state time
    AIController.stateTime[entity] += dt;

    // Build AI context
    const context = this.buildContext(entity, players, data);

    // State machine transition
    const newState = this.determineState(entity, context, data);
    const currentState = NumberToAIState[AIController.state[entity]] || AIState.Idle;

    if (newState !== currentState) {
      this.transitionState(entity, currentState, newState, data);
    }

    // Execute behaviors based on current state
    this.executeBehaviors(entity, context, dt, data);

    // Update last attack time
    AIController.lastAttackTime[entity] += dt;
  }

  /**
   * Build AI context for an entity.
   */
  private buildContext(entity: EntityId, players: EntityId[], data: EntityAIData): IAIContext {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    const rawWorld = this.world.raw;

    // Find nearest player
    let nearestPlayer: EntityId | null = null;
    let nearestDistance = Infinity;
    let targetDirX = 0;
    let targetDirY = 0;

    for (const player of players) {
      // Skip dead players
      if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, player)) {
        continue;
      }

      const playerX = Position.x[player];
      const playerY = Position.y[player];
      const dist = distance(entityX, entityY, playerX, playerY);

      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestPlayer = player;

        // Calculate direction to target
        if (dist > 0.001) {
          targetDirX = (playerX - entityX) / dist;
          targetDirY = (playerY - entityY) / dist;
        }
      }
    }

    // Get nearby allies for flocking
    let nearbyAllies: EntityId[] = [];
    if (this.spatialHash && hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Flocking, entity)) {
      nearbyAllies = this.defaultBehaviors.flocking.queryNearbyAllies(entity, CollisionLayer.Enemy);
    }

    // Calculate HP ratio
    let hpRatio = 1;
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Health, entity)) {
      const current = Health.current[entity];
      const max = Health.max[entity];
      hpRatio = max > 0 ? current / max : 1;
    }

    return {
      state: NumberToAIState[AIController.state[entity]] || AIState.Idle,
      target: nearestPlayer,
      targetDistance: nearestDistance,
      targetDirection: { x: targetDirX, y: targetDirY },
      nearbyAllies,
      nearbyEnemies: [], // Would need player spatial hash
      stateTime: AIController.stateTime[entity],
      position: { x: entityX, y: entityY },
      velocity: { x: Velocity.x[entity], y: Velocity.y[entity] },
      hpRatio,
      customData: data.customData,
    };
  }

  /**
   * Determine what state the AI should be in.
   */
  private determineState(entity: EntityId, context: IAIContext, data: EntityAIData): AIState {
    const config = data.config;

    // Check for flee condition first (if configured)
    if (config.fleeWhenLowHP && config.fleeThreshold !== undefined) {
      if (context.hpRatio <= config.fleeThreshold) {
        return AIState.Flee;
      }
    }

    // No target - wander or idle
    if (context.target === null) {
      return context.state === AIState.Wander ? AIState.Wander : AIState.Idle;
    }

    // Check attack range
    if (context.targetDistance <= config.attackRange) {
      // Check cooldown
      const lastAttack = AIController.lastAttackTime[entity];
      if (lastAttack >= config.attackCooldown) {
        return AIState.Attack;
      }
      // In range but on cooldown - still attack state (will wait for cooldown)
      return AIState.Attack;
    }

    // Target in detection range - chase
    if (context.targetDistance <= config.detectionRange) {
      return AIState.Chase;
    }

    // Target too far - wander
    if (context.state === AIState.Chase) {
      // Lost target, start wandering
      return AIState.Wander;
    }

    return context.state === AIState.Idle ? AIState.Idle : AIState.Wander;
  }

  /**
   * Transition between AI states.
   */
  private transitionState(
    entity: EntityId,
    _from: AIState,
    to: AIState,
    data: EntityAIData
  ): void {
    // Exit current behavior
    if (data.currentBehavior?.onExit) {
      data.currentBehavior.onExit(entity);
    }

    // Set new state
    AIController.state[entity] = AIStateToNumber[to];
    AIController.stateTime[entity] = 0;

    // Select new behavior
    data.currentBehavior = this.selectBehavior(to, data);
  }

  /**
   * Select behavior for a state.
   */
  private selectBehavior(state: AIState, data: EntityAIData): IAIBehavior | null {
    // Check if entity has custom behaviors
    for (const behavior of data.behaviors) {
      if (this.behaviorMatchesState(behavior, state)) {
        return behavior;
      }
    }

    // Use default behaviors
    switch (state) {
      case AIState.Chase:
        return this.defaultBehaviors.chase;
      case AIState.Attack:
        return this.defaultBehaviors.attack;
      case AIState.Wander:
      case AIState.Idle:
        return this.defaultBehaviors.wander;
      case AIState.Flee:
        // Flee uses chase but inverted (handled in execute)
        return this.defaultBehaviors.chase;
      default:
        return null;
    }
  }

  /**
   * Check if a behavior matches a state.
   */
  private behaviorMatchesState(behavior: IAIBehavior, state: AIState): boolean {
    const name = behavior.name.toLowerCase();

    switch (state) {
      case AIState.Chase:
        return name.includes('chase') || name.includes('pursuit');
      case AIState.Attack:
        return name.includes('attack');
      case AIState.Wander:
      case AIState.Idle:
        return name.includes('wander') || name.includes('idle');
      case AIState.Flee:
        return name.includes('flee') || name.includes('evade');
      default:
        return false;
    }
  }

  /**
   * Execute behaviors for current state.
   */
  private executeBehaviors(
    entity: EntityId,
    context: IAIContext,
    dt: number,
    data: EntityAIData
  ): void {
    const rawWorld = this.world.raw;

    // Execute main behavior
    if (data.currentBehavior) {
      // Special handling for flee state
      if (context.state === AIState.Flee && context.target !== null) {
        // Flee is opposite of chase - move away from target
        const entityX = Position.x[entity];
        const entityY = Position.y[entity];
        const targetX = Position.x[context.target];
        const targetY = Position.y[context.target];

        // Calculate flee direction (away from target)
        const dx = entityX - targetX;
        const dy = entityY - targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.001) {
          const speed = data.config.moveSpeed;
          Velocity.x[entity] = (dx / dist) * speed;
          Velocity.y[entity] = (dy / dist) * speed;
        }
      } else {
        data.currentBehavior.execute(entity, context, dt);
      }
    }

    // Always apply flocking if entity has Flocking component
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Flocking, entity)) {
      if (context.nearbyAllies.length > 0) {
        this.defaultBehaviors.flocking.execute(entity, context, dt);
      }
    }
  }

  /**
   * Get or create AI data for an entity.
   */
  private getOrCreateEntityData(entity: EntityId): EntityAIData {
    let data = this.entityData.get(entity);

    if (!data) {
      // Create default data based on behavior ID
      const behaviorId = AIController.behaviorId[entity];
      const config = this.getConfigForBehaviorId(behaviorId, entity);

      data = {
        currentBehavior: null,
        behaviors: [],
        config,
        customData: {},
      };

      this.entityData.set(entity, data);
    }

    return data;
  }

  /**
   * Get AI config for a behavior ID.
   */
  private getConfigForBehaviorId(_behaviorId: number, entity: EntityId): IAIBehaviorConfig {
    // Try to find enemy definition by behavior ID
    // This is a simple lookup - in practice you'd want a more robust system
    for (const definition of EnemyRegistry.getAll()) {
      // Check if this definition's config matches
      // (This is a simplification - real implementation would map behavior IDs properly)
      if (definition.behaviorConfig) {
        return definition.behaviorConfig;
      }
    }

    // Default config from AIController component
    return {
      moveSpeed: 100,
      detectionRange: AIController.alertRadius[entity] || 400,
      preferredRange: 30,
      attackRange: AIController.attackRadius[entity] || 50,
      attackCooldown: AIController.attackCooldown[entity] || 1.0,
      useFlocking: false,
    };
  }

  /**
   * Register custom behaviors for an entity.
   */
  registerEntityBehaviors(entity: EntityId, behaviors: IAIBehavior[]): void {
    const data = this.getOrCreateEntityData(entity);
    data.behaviors = behaviors;
  }

  /**
   * Set custom config for an entity.
   */
  setEntityConfig(entity: EntityId, config: Partial<IAIBehaviorConfig>): void {
    const data = this.getOrCreateEntityData(entity);
    Object.assign(data.config, config);
  }

  /**
   * Force state change for an entity.
   */
  forceState(entity: EntityId, state: AIState): void {
    const data = this.getOrCreateEntityData(entity);
    const currentState = NumberToAIState[AIController.state[entity]] || AIState.Idle;
    this.transitionState(entity, currentState, state, data);
  }

  /**
   * Remove AI data for an entity.
   */
  removeEntity(entity: EntityId): void {
    const data = this.entityData.get(entity);
    if (data?.currentBehavior?.onExit) {
      data.currentBehavior.onExit(entity);
    }
    this.entityData.delete(entity);
  }

  /**
   * Clean up the system.
   */
  destroy(): void {
    this.entityData.clear();
    this.spatialHash = null;
  }

  /**
   * Get current state of an entity.
   */
  getEntityState(entity: EntityId): AIState {
    return NumberToAIState[AIController.state[entity]] || AIState.Idle;
  }

  /**
   * Get the default behaviors.
   */
  getDefaultBehaviors(): typeof this.defaultBehaviors {
    return this.defaultBehaviors;
  }
}
