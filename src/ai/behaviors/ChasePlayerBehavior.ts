/**
 * ChasePlayerBehavior - AI behavior for chasing the player.
 *
 * This behavior moves the enemy toward the target player while respecting
 * preferred range (won't get too close).
 */

import type { EntityId } from '../../shared/interfaces/IWorld';
import type { IAIBehavior, IAIContext, IAIBehaviorConfig } from '../../shared/interfaces/IAI';
import { Position, Velocity } from '../../shared/types/components';
import { Steering } from '../pathfinding/Steering';
import { distance } from '../../shared/utils/math';

/**
 * Configuration for chase behavior.
 */
export interface IChaseConfig {
  /** Movement speed when chasing */
  moveSpeed: number;
  /** Preferred distance from target (won't get closer than this) */
  preferredRange: number;
  /** Detection range (max distance to chase) */
  detectionRange: number;
  /** Use pursuit prediction for moving targets */
  usePursuit?: boolean;
}

/**
 * ChasePlayerBehavior - Moves toward the target player.
 */
export class ChasePlayerBehavior implements IAIBehavior {
  public readonly name = 'ChasePlayer';
  public readonly priority = 50;

  private readonly config: IChaseConfig;

  constructor(config?: Partial<IChaseConfig>) {
    this.config = {
      moveSpeed: 100,
      preferredRange: 30,
      detectionRange: 500,
      usePursuit: false,
      ...config,
    };
  }

  /**
   * Check if this behavior should activate.
   * Activates when there's a valid target within detection range
   * and we're not already at preferred range.
   */
  shouldActivate(_entity: EntityId, context: IAIContext): boolean {
    // Need a valid target
    if (context.target === null) {
      return false;
    }

    // Check if target is within detection range but outside preferred range
    const dist = context.targetDistance;
    return dist > this.config.preferredRange && dist <= this.config.detectionRange;
  }

  /**
   * Execute chase behavior - move toward target.
   */
  execute(entity: EntityId, context: IAIContext, dt: number): void {
    if (context.target === null) {
      return;
    }

    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    const targetX = Position.x[context.target];
    const targetY = Position.y[context.target];

    // Calculate distance to target
    const dist = distance(entityX, entityY, targetX, targetY);

    // If we're within preferred range, stop or slow down
    if (dist <= this.config.preferredRange) {
      // Arrive behavior - slow down as we approach
      const steering = Steering.arrive(
        entityX,
        entityY,
        targetX,
        targetY,
        this.config.preferredRange * 2,
        this.config.preferredRange
      );
      Steering.applyToEntity(entity, steering, this.config.moveSpeed, dt);
      return;
    }

    // Use pursuit for moving targets if enabled
    if (this.config.usePursuit) {
      const targetVelX = Velocity.x[context.target];
      const targetVelY = Velocity.y[context.target];

      const steering = Steering.pursuit(
        entityX,
        entityY,
        this.config.moveSpeed,
        targetX,
        targetY,
        targetVelX,
        targetVelY
      );
      Steering.applyToEntity(entity, steering, this.config.moveSpeed, dt);
    } else {
      // Simple seek
      const steering = Steering.seek(entityX, entityY, targetX, targetY);
      Steering.setVelocityFromSteering(entity, steering, this.config.moveSpeed);
    }
  }

  /**
   * Called when behavior ends.
   */
  onExit(entity: EntityId): void {
    // Slow down when exiting chase
    Velocity.x[entity] *= 0.5;
    Velocity.y[entity] *= 0.5;
  }

  /**
   * Create chase behavior from AI behavior config.
   */
  static fromConfig(config: IAIBehaviorConfig): ChasePlayerBehavior {
    return new ChasePlayerBehavior({
      moveSpeed: config.moveSpeed,
      preferredRange: config.preferredRange,
      detectionRange: config.detectionRange,
    });
  }
}
