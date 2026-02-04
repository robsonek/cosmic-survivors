/**
 * WanderBehavior - AI behavior for random wandering movement.
 *
 * This behavior makes enemies move randomly when they have no target,
 * changing direction periodically.
 */

import type { EntityId } from '../../shared/interfaces/IWorld';
import type { IAIBehavior, IAIContext, IAIBehaviorConfig } from '../../shared/interfaces/IAI';
import { AIState } from '../../shared/interfaces/IAI';
import { Position, Velocity } from '../../shared/types/components';
import { Steering } from '../pathfinding/Steering';
import { randomRange, TWO_PI } from '../../shared/utils/math';

/**
 * Configuration for wander behavior.
 */
export interface IWanderConfig {
  /** Movement speed when wandering */
  moveSpeed: number;
  /** Minimum time before changing direction */
  minDirectionChangeTime: number;
  /** Maximum time before changing direction */
  maxDirectionChangeTime: number;
  /** Radius of wander circle for steering */
  wanderRadius: number;
  /** Distance ahead to place wander circle */
  wanderDistance: number;
  /** How much wander angle changes per update */
  wanderJitter: number;
  /** Bounds to stay within (optional) */
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * Per-entity wander state.
 */
interface WanderState {
  wanderAngle: number;
  directionChangeTimer: number;
  nextDirectionChangeTime: number;
}

/**
 * WanderBehavior - Random wandering movement.
 */
export class WanderBehavior implements IAIBehavior {
  public readonly name = 'Wander';
  public readonly priority = 10; // Low priority - only when no other behavior

  private readonly config: IWanderConfig;
  private readonly entityStates: Map<EntityId, WanderState> = new Map();

  constructor(config?: Partial<IWanderConfig>) {
    this.config = {
      moveSpeed: 50,
      minDirectionChangeTime: 1,
      maxDirectionChangeTime: 3,
      wanderRadius: 30,
      wanderDistance: 50,
      wanderJitter: 0.3,
      ...config,
    };
  }

  /**
   * Get or create wander state for an entity.
   */
  private getState(entity: EntityId): WanderState {
    let state = this.entityStates.get(entity);
    if (!state) {
      state = {
        wanderAngle: Math.random() * TWO_PI,
        directionChangeTimer: 0,
        nextDirectionChangeTime: randomRange(
          this.config.minDirectionChangeTime,
          this.config.maxDirectionChangeTime
        ),
      };
      this.entityStates.set(entity, state);
    }
    return state;
  }

  /**
   * Check if this behavior should activate.
   * Activates when there's no target (in Idle state).
   */
  shouldActivate(_entity: EntityId, context: IAIContext): boolean {
    // Wander when there's no target
    return context.target === null || context.state === AIState.Idle || context.state === AIState.Wander;
  }

  /**
   * Execute wander behavior - random movement.
   */
  execute(entity: EntityId, _context: IAIContext, dt: number): void {
    const state = this.getState(entity);
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    const velocityX = Velocity.x[entity];
    const velocityY = Velocity.y[entity];

    // Update direction change timer
    state.directionChangeTimer += dt;

    // Check if we need to change direction
    if (state.directionChangeTimer >= state.nextDirectionChangeTime) {
      // Reset timer and set new random direction
      state.directionChangeTimer = 0;
      state.nextDirectionChangeTime = randomRange(
        this.config.minDirectionChangeTime,
        this.config.maxDirectionChangeTime
      );
      // Add larger jitter for direction change
      state.wanderAngle += (Math.random() - 0.5) * Math.PI;
    }

    // Apply wander steering
    const { steering, newWanderAngle } = Steering.wander(
      entityX,
      entityY,
      velocityX,
      velocityY,
      state.wanderAngle,
      this.config.wanderRadius,
      this.config.wanderDistance,
      this.config.wanderJitter
    );

    state.wanderAngle = newWanderAngle;

    // Check bounds if configured
    if (this.config.bounds) {
      const bounds = this.config.bounds;
      let adjustedSteering = steering;

      // If near boundary, steer away from it
      const margin = 50;

      if (entityX < bounds.minX + margin) {
        adjustedSteering = Steering.combine([
          { steering, weight: 0.5 },
          { steering: Steering.seek(entityX, entityY, entityX + 100, entityY), weight: 1 },
        ]);
      } else if (entityX > bounds.maxX - margin) {
        adjustedSteering = Steering.combine([
          { steering, weight: 0.5 },
          { steering: Steering.seek(entityX, entityY, entityX - 100, entityY), weight: 1 },
        ]);
      }

      if (entityY < bounds.minY + margin) {
        adjustedSteering = Steering.combine([
          { steering: adjustedSteering, weight: 0.5 },
          { steering: Steering.seek(entityX, entityY, entityX, entityY + 100), weight: 1 },
        ]);
      } else if (entityY > bounds.maxY - margin) {
        adjustedSteering = Steering.combine([
          { steering: adjustedSteering, weight: 0.5 },
          { steering: Steering.seek(entityX, entityY, entityX, entityY - 100), weight: 1 },
        ]);
      }

      Steering.applyToEntity(entity, adjustedSteering, this.config.moveSpeed, dt);
    } else {
      Steering.applyToEntity(entity, steering, this.config.moveSpeed, dt);
    }
  }

  /**
   * Called when behavior ends.
   */
  onExit(_entity: EntityId): void {
    // Keep the state for when we resume wandering
  }

  /**
   * Clean up entity state when entity is removed.
   */
  cleanupEntity(entity: EntityId): void {
    this.entityStates.delete(entity);
  }

  /**
   * Create wander behavior from AI behavior config.
   */
  static fromConfig(config: IAIBehaviorConfig): WanderBehavior {
    return new WanderBehavior({
      moveSpeed: config.moveSpeed * 0.5, // Wander at half speed
    });
  }
}
