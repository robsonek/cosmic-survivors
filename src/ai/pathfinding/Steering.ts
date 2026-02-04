/**
 * Steering behaviors for AI movement.
 *
 * Implements basic steering behaviors like seek, flee, arrive, and obstacle avoidance.
 * These provide smooth, natural-looking movement for AI entities.
 */

import type { EntityId } from '../../shared/interfaces/IWorld';
import { Position, Velocity } from '../../shared/types/components';
import { distance, clamp } from '../../shared/utils/math';

/**
 * Steering result - direction and magnitude.
 */
export interface ISteeringResult {
  /** Direction X (normalized or weighted) */
  x: number;
  /** Direction Y (normalized or weighted) */
  y: number;
  /** Magnitude/weight of this steering force */
  magnitude: number;
}

/**
 * Obstacle for avoidance.
 */
export interface IObstacle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Steering utilities for AI movement.
 */
export class Steering {
  /**
   * Seek behavior - move toward a target position.
   * Returns direction toward the target at full speed.
   *
   * @param entityX Entity's current X position
   * @param entityY Entity's current Y position
   * @param targetX Target X position
   * @param targetY Target Y position
   * @returns Steering result with direction toward target
   */
  static seek(
    entityX: number,
    entityY: number,
    targetX: number,
    targetY: number
  ): ISteeringResult {
    const dx = targetX - entityX;
    const dy = targetY - entityY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    return {
      x: dx / dist,
      y: dy / dist,
      magnitude: 1,
    };
  }

  /**
   * Seek behavior for entity - reads position from ECS components.
   *
   * @param entity Entity ID
   * @param targetX Target X position
   * @param targetY Target Y position
   * @returns Steering result with direction toward target
   */
  static seekEntity(
    entity: EntityId,
    targetX: number,
    targetY: number
  ): ISteeringResult {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    return Steering.seek(entityX, entityY, targetX, targetY);
  }

  /**
   * Flee behavior - move away from a threat position.
   * Opposite of seek.
   *
   * @param entityX Entity's current X position
   * @param entityY Entity's current Y position
   * @param threatX Threat X position
   * @param threatY Threat Y position
   * @returns Steering result with direction away from threat
   */
  static flee(
    entityX: number,
    entityY: number,
    threatX: number,
    threatY: number
  ): ISteeringResult {
    const dx = entityX - threatX;
    const dy = entityY - threatY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) {
      // If at exact same position, flee in random direction
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.cos(angle),
        y: Math.sin(angle),
        magnitude: 1,
      };
    }

    return {
      x: dx / dist,
      y: dy / dist,
      magnitude: 1,
    };
  }

  /**
   * Flee behavior for entity - reads position from ECS components.
   *
   * @param entity Entity ID
   * @param threatX Threat X position
   * @param threatY Threat Y position
   * @returns Steering result with direction away from threat
   */
  static fleeEntity(
    entity: EntityId,
    threatX: number,
    threatY: number
  ): ISteeringResult {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    return Steering.flee(entityX, entityY, threatX, threatY);
  }

  /**
   * Arrive behavior - move toward target but slow down as approaching.
   * Provides smoother stopping at destination.
   *
   * @param entityX Entity's current X position
   * @param entityY Entity's current Y position
   * @param targetX Target X position
   * @param targetY Target Y position
   * @param slowRadius Distance at which to start slowing down
   * @param stopRadius Distance at which to stop completely
   * @returns Steering result with scaled magnitude based on distance
   */
  static arrive(
    entityX: number,
    entityY: number,
    targetX: number,
    targetY: number,
    slowRadius: number = 100,
    stopRadius: number = 5
  ): ISteeringResult {
    const dx = targetX - entityX;
    const dy = targetY - entityY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < stopRadius) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Calculate speed based on distance
    let magnitude = 1;
    if (dist < slowRadius) {
      // Linear interpolation from stop to full speed
      magnitude = (dist - stopRadius) / (slowRadius - stopRadius);
      magnitude = clamp(magnitude, 0, 1);
    }

    return {
      x: dx / dist,
      y: dy / dist,
      magnitude,
    };
  }

  /**
   * Arrive behavior for entity - reads position from ECS components.
   *
   * @param entity Entity ID
   * @param targetX Target X position
   * @param targetY Target Y position
   * @param slowRadius Distance at which to start slowing down
   * @param stopRadius Distance at which to stop completely
   * @returns Steering result with scaled magnitude based on distance
   */
  static arriveEntity(
    entity: EntityId,
    targetX: number,
    targetY: number,
    slowRadius: number = 100,
    stopRadius: number = 5
  ): ISteeringResult {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    return Steering.arrive(entityX, entityY, targetX, targetY, slowRadius, stopRadius);
  }

  /**
   * Obstacle avoidance - steer away from obstacles.
   * Uses a simple look-ahead approach.
   *
   * @param entityX Entity's current X position
   * @param entityY Entity's current Y position
   * @param velocityX Entity's current velocity X
   * @param velocityY Entity's current velocity Y
   * @param obstacles Array of obstacles to avoid
   * @param lookAheadDistance How far ahead to look for obstacles
   * @param avoidanceRadius Extra radius to maintain from obstacles
   * @returns Steering result for avoidance, or zero if no avoidance needed
   */
  static avoid(
    entityX: number,
    entityY: number,
    velocityX: number,
    velocityY: number,
    obstacles: IObstacle[],
    lookAheadDistance: number = 100,
    avoidanceRadius: number = 20
  ): ISteeringResult {
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

    if (speed < 0.0001 || obstacles.length === 0) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Normalize velocity for direction
    const dirX = velocityX / speed;
    const dirY = velocityY / speed;

    // Find closest threatening obstacle
    let closestObstacle: IObstacle | null = null;
    let closestDistance = Infinity;

    for (const obstacle of obstacles) {
      // Check if obstacle is in front of entity (dot product positive)
      const toObstacleX = obstacle.x - entityX;
      const toObstacleY = obstacle.y - entityY;
      const dot = toObstacleX * dirX + toObstacleY * dirY;

      if (dot < 0) {
        // Obstacle is behind us
        continue;
      }

      // Calculate distance from look-ahead line to obstacle center
      // Project obstacle onto velocity line
      const projDist = dot;
      const projX = entityX + dirX * projDist;
      const projY = entityY + dirY * projDist;

      // Distance from projection to obstacle
      const distToLine = distance(projX, projY, obstacle.x, obstacle.y);
      const combinedRadius = obstacle.radius + avoidanceRadius;

      // Check if obstacle is within collision range
      if (distToLine < combinedRadius && projDist < lookAheadDistance) {
        const distToObstacle = distance(entityX, entityY, obstacle.x, obstacle.y);
        if (distToObstacle < closestDistance) {
          closestDistance = distToObstacle;
          closestObstacle = obstacle;
        }
      }
    }

    if (!closestObstacle) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Calculate avoidance force perpendicular to velocity
    // Steer away from obstacle
    const toObstacleX = closestObstacle.x - entityX;
    const toObstacleY = closestObstacle.y - entityY;

    // Calculate perpendicular vector (90 degrees)
    // Choose the perpendicular that points away from the obstacle
    const perpX1 = -dirY;
    const perpY1 = dirX;
    const perpX2 = dirY;
    const perpY2 = -dirX;

    // Dot product with direction to obstacle to determine which perpendicular to use
    const dot1 = perpX1 * toObstacleX + perpY1 * toObstacleY;
    const dot2 = perpX2 * toObstacleX + perpY2 * toObstacleY;

    // Choose the perpendicular pointing away from obstacle
    const avoidX = dot1 < dot2 ? perpX1 : perpX2;
    const avoidY = dot1 < dot2 ? perpY1 : perpY2;

    // Scale magnitude based on how close the obstacle is
    const urgency = 1 - (closestDistance / lookAheadDistance);

    return {
      x: avoidX,
      y: avoidY,
      magnitude: clamp(urgency, 0.2, 1),
    };
  }

  /**
   * Obstacle avoidance for entity - reads from ECS components.
   *
   * @param entity Entity ID
   * @param obstacles Array of obstacles to avoid
   * @param lookAheadDistance How far ahead to look for obstacles
   * @param avoidanceRadius Extra radius to maintain from obstacles
   * @returns Steering result for avoidance
   */
  static avoidEntity(
    entity: EntityId,
    obstacles: IObstacle[],
    lookAheadDistance: number = 100,
    avoidanceRadius: number = 20
  ): ISteeringResult {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];
    const velocityX = Velocity.x[entity];
    const velocityY = Velocity.y[entity];

    return Steering.avoid(
      entityX,
      entityY,
      velocityX,
      velocityY,
      obstacles,
      lookAheadDistance,
      avoidanceRadius
    );
  }

  /**
   * Wander behavior - add some randomness to movement.
   * Creates a "wander circle" ahead of the entity and targets random points on it.
   *
   * @param entityX Entity's current X position
   * @param entityY Entity's current Y position
   * @param velocityX Entity's current velocity X
   * @param velocityY Entity's current velocity Y
   * @param wanderAngle Current wander angle (should be stored and passed each frame)
   * @param wanderRadius Radius of the wander circle
   * @param wanderDistance Distance ahead to place wander circle
   * @param wanderJitter How much the wander angle can change per call
   * @returns Object with steering result and new wander angle
   */
  static wander(
    entityX: number,
    entityY: number,
    velocityX: number,
    velocityY: number,
    wanderAngle: number,
    wanderRadius: number = 50,
    wanderDistance: number = 100,
    wanderJitter: number = 0.5
  ): { steering: ISteeringResult; newWanderAngle: number } {
    // Add jitter to wander angle
    const newWanderAngle = wanderAngle + (Math.random() - 0.5) * wanderJitter;

    // Get current direction (or random if stationary)
    let dirX: number, dirY: number;
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

    if (speed < 0.0001) {
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    } else {
      dirX = velocityX / speed;
      dirY = velocityY / speed;
    }

    // Calculate wander circle center
    const circleCenterX = entityX + dirX * wanderDistance;
    const circleCenterY = entityY + dirY * wanderDistance;

    // Calculate target point on wander circle
    const targetX = circleCenterX + Math.cos(newWanderAngle) * wanderRadius;
    const targetY = circleCenterY + Math.sin(newWanderAngle) * wanderRadius;

    // Seek toward wander target
    const steering = Steering.seek(entityX, entityY, targetX, targetY);

    return {
      steering,
      newWanderAngle,
    };
  }

  /**
   * Pursuit behavior - predict target's future position and seek toward it.
   *
   * @param entityX Pursuer's X position
   * @param entityY Pursuer's Y position
   * @param entitySpeed Pursuer's max speed
   * @param targetX Target's X position
   * @param targetY Target's Y position
   * @param targetVelX Target's velocity X
   * @param targetVelY Target's velocity Y
   * @returns Steering result toward predicted position
   */
  static pursuit(
    entityX: number,
    entityY: number,
    entitySpeed: number,
    targetX: number,
    targetY: number,
    targetVelX: number,
    targetVelY: number
  ): ISteeringResult {
    const dist = distance(entityX, entityY, targetX, targetY);

    // Prediction time based on distance and speed
    const predictionTime = entitySpeed > 0 ? dist / entitySpeed : 1;

    // Predict future position
    const futureX = targetX + targetVelX * predictionTime * 0.5;
    const futureY = targetY + targetVelY * predictionTime * 0.5;

    return Steering.seek(entityX, entityY, futureX, futureY);
  }

  /**
   * Evade behavior - predict threat's future position and flee from it.
   * Opposite of pursuit.
   *
   * @param entityX Evader's X position
   * @param entityY Evader's Y position
   * @param entitySpeed Evader's max speed
   * @param threatX Threat's X position
   * @param threatY Threat's Y position
   * @param threatVelX Threat's velocity X
   * @param threatVelY Threat's velocity Y
   * @returns Steering result away from predicted position
   */
  static evade(
    entityX: number,
    entityY: number,
    entitySpeed: number,
    threatX: number,
    threatY: number,
    threatVelX: number,
    threatVelY: number
  ): ISteeringResult {
    const dist = distance(entityX, entityY, threatX, threatY);

    // Prediction time based on distance and speed
    const predictionTime = entitySpeed > 0 ? dist / entitySpeed : 1;

    // Predict future position
    const futureX = threatX + threatVelX * predictionTime * 0.5;
    const futureY = threatY + threatVelY * predictionTime * 0.5;

    return Steering.flee(entityX, entityY, futureX, futureY);
  }

  /**
   * Combine multiple steering results with weights.
   *
   * @param steerings Array of steering results with weights
   * @returns Combined steering result
   */
  static combine(
    steerings: Array<{ steering: ISteeringResult; weight: number }>
  ): ISteeringResult {
    let totalX = 0;
    let totalY = 0;
    let totalWeight = 0;

    for (const { steering, weight } of steerings) {
      const effectiveWeight = weight * steering.magnitude;
      totalX += steering.x * effectiveWeight;
      totalY += steering.y * effectiveWeight;
      totalWeight += effectiveWeight;
    }

    if (totalWeight < 0.0001) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Normalize the result
    const length = Math.sqrt(totalX * totalX + totalY * totalY);

    if (length < 0.0001) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    return {
      x: totalX / length,
      y: totalY / length,
      magnitude: Math.min(length / totalWeight, 1),
    };
  }

  /**
   * Apply steering result to entity velocity.
   *
   * @param entity Entity ID
   * @param steering Steering result to apply
   * @param maxSpeed Maximum speed for this entity
   * @param dt Delta time
   */
  static applyToEntity(
    entity: EntityId,
    steering: ISteeringResult,
    maxSpeed: number,
    dt: number
  ): void {
    if (steering.magnitude < 0.0001) {
      return;
    }

    const targetVelX = steering.x * maxSpeed * steering.magnitude;
    const targetVelY = steering.y * maxSpeed * steering.magnitude;

    // Smooth transition using lerp
    const lerpFactor = Math.min(1, dt * 5); // Adjust for responsiveness
    Velocity.x[entity] += (targetVelX - Velocity.x[entity]) * lerpFactor;
    Velocity.y[entity] += (targetVelY - Velocity.y[entity]) * lerpFactor;
  }

  /**
   * Set entity velocity directly from steering result.
   *
   * @param entity Entity ID
   * @param steering Steering result
   * @param speed Speed to move at
   */
  static setVelocityFromSteering(
    entity: EntityId,
    steering: ISteeringResult,
    speed: number
  ): void {
    Velocity.x[entity] = steering.x * speed * steering.magnitude;
    Velocity.y[entity] = steering.y * speed * steering.magnitude;
  }
}
