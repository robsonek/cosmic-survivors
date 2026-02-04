/**
 * MovementSystem - ECS system for entity movement.
 *
 * Integrates velocity into position, applies friction and acceleration,
 * and respects maxSpeed limits.
 */

import { defineQuery, hasComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld } from '../shared/interfaces/IWorld';
import { Position, Velocity, Movement } from '../shared/types/components';

/**
 * MovementSystem - Handles velocity integration and movement physics.
 */
export class MovementSystem implements ISystem {
  public readonly name = 'MovementSystem';
  public readonly priority = 10; // Early in physics phase
  public readonly dependencies: string[] = [];
  public enabled = true;

  private world!: IWorld;

  // Query for entities with Position and Velocity
  private movingQuery!: ReturnType<typeof defineQuery>;

  constructor() {}

  init(world: IWorld): void {
    this.world = world;

    // Define query for moving entities
    this.movingQuery = defineQuery([Position, Velocity]);
  }

  /**
   * Fixed update for physics integration.
   */
  fixedUpdate(fixedDt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;
    const entities = this.movingQuery(rawWorld);

    for (const entity of entities) {
      // Get current velocity
      let vx = Velocity.x[entity];
      let vy = Velocity.y[entity];

      // Check if entity has Movement component for advanced physics
      if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entity)) {
        const maxSpeed = Movement.maxSpeed[entity];
        const friction = Movement.friction[entity];
        const deceleration = Movement.deceleration[entity];

        // Apply friction (multiplicative drag)
        if (friction > 0) {
          const frictionFactor = 1 - friction * fixedDt;
          vx *= Math.max(0, frictionFactor);
          vy *= Math.max(0, frictionFactor);
        }

        // Apply deceleration (linear drag toward zero)
        if (deceleration > 0) {
          const speed = Math.sqrt(vx * vx + vy * vy);
          if (speed > 0.0001) {
            const newSpeed = Math.max(0, speed - deceleration * fixedDt);
            const ratio = newSpeed / speed;
            vx *= ratio;
            vy *= ratio;
          }
        }

        // Clamp to max speed
        if (maxSpeed > 0) {
          const speed = Math.sqrt(vx * vx + vy * vy);
          if (speed > maxSpeed) {
            const ratio = maxSpeed / speed;
            vx *= ratio;
            vy *= ratio;
          }
        }

        // Store updated velocity
        Velocity.x[entity] = vx;
        Velocity.y[entity] = vy;
      }

      // Integrate velocity into position
      Position.x[entity] += vx * fixedDt;
      Position.y[entity] += vy * fixedDt;
    }
  }

  /**
   * Regular update - also performs integration for smooth movement.
   * Use fixedUpdate for physics-accurate movement, or update for simpler games.
   */
  update(_dt: number): void {
    // By default, we use fixedUpdate for physics.
    // If fixedUpdate is being used, we don't double-integrate.
    // This method is here for systems that don't use fixed timestep.
  }

  /**
   * Apply acceleration to an entity's velocity.
   */
  applyAcceleration(entity: number, ax: number, ay: number, dt: number): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Velocity, entity)) {
      return;
    }

    let vx = Velocity.x[entity] + ax * dt;
    let vy = Velocity.y[entity] + ay * dt;

    // Clamp to max speed if entity has Movement component
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entity)) {
      const maxSpeed = Movement.maxSpeed[entity];
      if (maxSpeed > 0) {
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > maxSpeed) {
          const ratio = maxSpeed / speed;
          vx *= ratio;
          vy *= ratio;
        }
      }
    }

    Velocity.x[entity] = vx;
    Velocity.y[entity] = vy;
  }

  /**
   * Apply impulse (instant velocity change) to an entity.
   */
  applyImpulse(entity: number, impulseX: number, impulseY: number): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Velocity, entity)) {
      return;
    }

    // If entity has mass, divide impulse by mass
    let mass = 1;
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entity)) {
      mass = Movement.mass[entity];
      if (mass <= 0) mass = 1;
    }

    Velocity.x[entity] += impulseX / mass;
    Velocity.y[entity] += impulseY / mass;
  }

  /**
   * Set entity velocity directly.
   */
  setVelocity(entity: number, vx: number, vy: number): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Velocity, entity)) {
      return;
    }

    Velocity.x[entity] = vx;
    Velocity.y[entity] = vy;
  }

  /**
   * Set velocity toward a direction at a specific speed.
   */
  setVelocityToward(entity: number, targetX: number, targetY: number, speed: number): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Position, entity)) {
      return;
    }

    const px = Position.x[entity];
    const py = Position.y[entity];

    const dx = targetX - px;
    const dy = targetY - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.0001) {
      this.setVelocity(entity, (dx / dist) * speed, (dy / dist) * speed);
    }
  }

  /**
   * Stop entity movement.
   */
  stop(entity: number): void {
    this.setVelocity(entity, 0, 0);
  }

  /**
   * Get entity speed.
   */
  getSpeed(entity: number): number {
    const vx = Velocity.x[entity];
    const vy = Velocity.y[entity];
    return Math.sqrt(vx * vx + vy * vy);
  }

  /**
   * Get velocity direction in radians.
   */
  getDirection(entity: number): number {
    const vx = Velocity.x[entity];
    const vy = Velocity.y[entity];
    return Math.atan2(vy, vx);
  }

  destroy(): void {
    // No cleanup needed
  }
}
