/**
 * FlockingBehavior - AI behavior for swarm/flocking movement.
 *
 * Implements the three classic flocking rules:
 * 1. Separation - avoid crowding neighbors
 * 2. Alignment - steer toward average heading of neighbors
 * 3. Cohesion - steer toward average position of neighbors
 */

import type { EntityId } from '../../shared/interfaces/IWorld';
import type { IAIBehavior, IAIContext, IAIBehaviorConfig } from '../../shared/interfaces/IAI';
import { Position, Velocity, Flocking } from '../../shared/types/components';
import { Steering, ISteeringResult } from '../pathfinding/Steering';
import { SpatialHash } from '../../spatial/SpatialHash';
import { CollisionLayer } from '../../shared/interfaces/IPhysics';
import { distance } from '../../shared/utils/math';

/**
 * Configuration for flocking behavior.
 */
export interface IFlockingConfig {
  /** Weight for separation (avoiding crowding) */
  separationWeight: number;
  /** Weight for alignment (matching velocity) */
  alignmentWeight: number;
  /** Weight for cohesion (staying with group) */
  cohesionWeight: number;
  /** Radius to look for neighbors */
  neighborRadius: number;
  /** Maximum number of neighbors to consider */
  maxNeighbors: number;
  /** Minimum separation distance */
  separationDistance: number;
  /** Movement speed */
  moveSpeed: number;
}

/**
 * FlockingBehavior - Swarm movement behavior.
 */
export class FlockingBehavior implements IAIBehavior {
  public readonly name = 'Flocking';
  public readonly priority = 30; // Applied alongside other behaviors

  private readonly config: IFlockingConfig;
  private spatialHash: SpatialHash | null = null;

  constructor(config?: Partial<IFlockingConfig>) {
    this.config = {
      separationWeight: 1.5,
      alignmentWeight: 1.0,
      cohesionWeight: 1.0,
      neighborRadius: 100,
      maxNeighbors: 10,
      separationDistance: 30,
      moveSpeed: 100,
      ...config,
    };
  }

  /**
   * Set the spatial hash for neighbor queries.
   */
  setSpatialHash(spatial: SpatialHash): void {
    this.spatialHash = spatial;
  }

  /**
   * Check if this behavior should activate.
   * Flocking is always active for entities with Flocking component.
   */
  shouldActivate(_entity: EntityId, context: IAIContext): boolean {
    // Check if entity uses flocking (from nearby allies count)
    return context.nearbyAllies.length > 0;
  }

  /**
   * Execute flocking behavior.
   */
  execute(entity: EntityId, context: IAIContext, dt: number): void {
    const neighbors = context.nearbyAllies;

    if (neighbors.length === 0) {
      return;
    }

    // Calculate flocking forces
    const separation = this.calculateSeparation(entity, neighbors);
    const alignment = this.calculateAlignment(entity, neighbors);
    const cohesion = this.calculateCohesion(entity, neighbors);

    // Get weights from component if available, otherwise use config
    let sepWeight = this.config.separationWeight;
    let aliWeight = this.config.alignmentWeight;
    let cohWeight = this.config.cohesionWeight;

    // Check if entity has Flocking component data
    if (Flocking.separationWeight[entity] !== undefined) {
      sepWeight = Flocking.separationWeight[entity] || sepWeight;
      aliWeight = Flocking.alignmentWeight[entity] || aliWeight;
      cohWeight = Flocking.cohesionWeight[entity] || cohWeight;
    }

    // Combine flocking forces
    const flockingSteering = Steering.combine([
      { steering: separation, weight: sepWeight },
      { steering: alignment, weight: aliWeight },
      { steering: cohesion, weight: cohWeight },
    ]);

    // Apply flocking as an additive force (doesn't override other behaviors)
    // Scale down the effect so it modifies rather than dominates movement
    const currentVelX = Velocity.x[entity];
    const currentVelY = Velocity.y[entity];

    const flockingForce = 0.3; // Flocking influence factor
    Velocity.x[entity] = currentVelX + flockingSteering.x * this.config.moveSpeed * flockingForce * dt;
    Velocity.y[entity] = currentVelY + flockingSteering.y * this.config.moveSpeed * flockingForce * dt;
  }

  /**
   * Calculate separation force - steer away from nearby neighbors.
   */
  private calculateSeparation(entity: EntityId, neighbors: EntityId[]): ISteeringResult {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];

    let steerX = 0;
    let steerY = 0;
    let count = 0;

    for (const neighbor of neighbors) {
      if (neighbor === entity) continue;

      const neighborX = Position.x[neighbor];
      const neighborY = Position.y[neighbor];
      const dist = distance(entityX, entityY, neighborX, neighborY);

      if (dist < this.config.separationDistance && dist > 0.001) {
        // Calculate vector pointing away from neighbor
        const diffX = entityX - neighborX;
        const diffY = entityY - neighborY;

        // Weight by distance (closer = stronger repulsion)
        const weight = 1 - (dist / this.config.separationDistance);
        steerX += (diffX / dist) * weight;
        steerY += (diffY / dist) * weight;
        count++;
      }
    }

    if (count === 0) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Average the steering
    steerX /= count;
    steerY /= count;

    const len = Math.sqrt(steerX * steerX + steerY * steerY);
    if (len < 0.001) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    return {
      x: steerX / len,
      y: steerY / len,
      magnitude: Math.min(len, 1),
    };
  }

  /**
   * Calculate alignment force - steer toward average heading of neighbors.
   */
  private calculateAlignment(entity: EntityId, neighbors: EntityId[]): ISteeringResult {
    let avgVelX = 0;
    let avgVelY = 0;
    let count = 0;

    for (const neighbor of neighbors) {
      if (neighbor === entity) continue;

      avgVelX += Velocity.x[neighbor];
      avgVelY += Velocity.y[neighbor];
      count++;
    }

    if (count === 0) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Average the velocities
    avgVelX /= count;
    avgVelY /= count;

    const len = Math.sqrt(avgVelX * avgVelX + avgVelY * avgVelY);
    if (len < 0.001) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    return {
      x: avgVelX / len,
      y: avgVelY / len,
      magnitude: 1,
    };
  }

  /**
   * Calculate cohesion force - steer toward center of neighbors.
   */
  private calculateCohesion(entity: EntityId, neighbors: EntityId[]): ISteeringResult {
    const entityX = Position.x[entity];
    const entityY = Position.y[entity];

    let centerX = 0;
    let centerY = 0;
    let count = 0;

    for (const neighbor of neighbors) {
      if (neighbor === entity) continue;

      centerX += Position.x[neighbor];
      centerY += Position.y[neighbor];
      count++;
    }

    if (count === 0) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Average position (center of mass)
    centerX /= count;
    centerY /= count;

    // Steer toward center
    return Steering.seek(entityX, entityY, centerX, centerY);
  }

  /**
   * Query nearby allies using spatial hash.
   * Returns entities within neighbor radius that are on the same layer.
   */
  queryNearbyAllies(entity: EntityId, layer: CollisionLayer = CollisionLayer.Enemy): EntityId[] {
    if (!this.spatialHash) {
      return [];
    }

    const entityX = Position.x[entity];
    const entityY = Position.y[entity];

    // Query spatial hash for nearby enemies
    const nearby = this.spatialHash.queryRadiusWithLayer(
      entityX,
      entityY,
      this.config.neighborRadius,
      layer
    );

    // Filter out self and limit to max neighbors
    const allies: EntityId[] = [];
    for (const other of nearby) {
      if (other === entity) continue;
      allies.push(other);
      if (allies.length >= this.config.maxNeighbors) {
        break;
      }
    }

    return allies;
  }

  /**
   * Called when behavior ends.
   */
  onExit(_entity: EntityId): void {
    // No cleanup needed
  }

  /**
   * Create flocking behavior from AI behavior config.
   */
  static fromConfig(config: IAIBehaviorConfig): FlockingBehavior {
    return new FlockingBehavior({
      separationWeight: config.separationWeight ?? 1.5,
      alignmentWeight: config.alignmentWeight ?? 1.0,
      cohesionWeight: config.cohesionWeight ?? 1.0,
      moveSpeed: config.moveSpeed,
    });
  }

  /**
   * Get the flocking configuration.
   */
  getConfig(): Readonly<IFlockingConfig> {
    return this.config;
  }
}
