/**
 * CollisionResolver - Resolves collisions by separating entities and applying knockback.
 *
 * Provides functions to push apart overlapping entities and apply
 * knockback forces in response to collisions.
 */

import { hasComponent } from 'bitecs';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { ICollision } from '../shared/interfaces/IPhysics';
import { Position, Velocity, Movement, CircleCollider, RectCollider } from '../shared/types/components';

/**
 * CollisionResolver - Handles physical resolution of collisions.
 */
export class CollisionResolver {
  private world!: IWorld;

  constructor() {}

  /**
   * Initialize with world reference.
   */
  init(world: IWorld): void {
    this.world = world;
  }

  /**
   * Separate two overlapping entities.
   * Pushes entities apart along collision normal.
   *
   * @param collision The collision to resolve
   * @param massRatioA Mass ratio for entity A (0-1, default 0.5 for equal)
   * @param massRatioB Mass ratio for entity B (0-1, default 0.5 for equal)
   */
  separateEntities(collision: ICollision, massRatioA = 0.5, massRatioB = 0.5): void {
    const { entityA, entityB, overlap, normalX, normalY } = collision;
    const rawWorld = this.world.raw;

    // Check if entities have Position components
    const hasPositionA = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Position, entityA);
    const hasPositionB = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Position, entityB);

    if (!hasPositionA && !hasPositionB) {
      return;
    }

    // Calculate mass ratios based on Movement component if available
    let effectiveMassA = 1;
    let effectiveMassB = 1;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entityA)) {
      effectiveMassA = Movement.mass[entityA];
      if (effectiveMassA <= 0) effectiveMassA = 1;
    }

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entityB)) {
      effectiveMassB = Movement.mass[entityB];
      if (effectiveMassB <= 0) effectiveMassB = 1;
    }

    // Calculate how much each entity should move
    const totalMass = effectiveMassA + effectiveMassB;
    const ratioA = massRatioA !== 0.5 ? massRatioA : effectiveMassB / totalMass;
    const ratioB = massRatioB !== 0.5 ? massRatioB : effectiveMassA / totalMass;

    // Add small buffer to prevent re-collision
    const separationBuffer = 0.1;
    const totalSeparation = overlap + separationBuffer;

    // Move entities apart
    if (hasPositionA) {
      Position.x[entityA] -= normalX * totalSeparation * ratioA;
      Position.y[entityA] -= normalY * totalSeparation * ratioA;
    }

    if (hasPositionB) {
      Position.x[entityB] += normalX * totalSeparation * ratioB;
      Position.y[entityB] += normalY * totalSeparation * ratioB;
    }
  }

  /**
   * Apply knockback to an entity.
   *
   * @param entity Entity to apply knockback to
   * @param directionX Direction X (normalized)
   * @param directionY Direction Y (normalized)
   * @param force Knockback force
   */
  applyKnockback(entity: EntityId, directionX: number, directionY: number, force: number): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Velocity, entity)) {
      return;
    }

    // Get mass for knockback reduction
    let mass = 1;
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entity)) {
      mass = Movement.mass[entity];
      if (mass <= 0) mass = 1;
    }

    // Apply knockback velocity (force / mass = acceleration, but we apply instant velocity)
    const knockbackMultiplier = force / mass;

    Velocity.x[entity] += directionX * knockbackMultiplier;
    Velocity.y[entity] += directionY * knockbackMultiplier;
  }

  /**
   * Apply knockback from collision.
   * Pushes both entities away from collision point.
   *
   * @param collision The collision
   * @param force Knockback force
   */
  applyKnockbackFromCollision(collision: ICollision, force: number): void {
    const { entityA, entityB, normalX, normalY } = collision;

    // Entity A is pushed opposite to normal (away from B)
    this.applyKnockback(entityA, -normalX, -normalY, force);

    // Entity B is pushed along normal (away from A)
    this.applyKnockback(entityB, normalX, normalY, force);
  }

  /**
   * Resolve collision by separating and optionally applying knockback.
   *
   * @param collision The collision to resolve
   * @param knockbackForce Optional knockback force (0 = no knockback)
   */
  resolveCollision(collision: ICollision, knockbackForce = 0): void {
    this.separateEntities(collision);

    if (knockbackForce > 0) {
      this.applyKnockbackFromCollision(collision, knockbackForce);
    }
  }

  /**
   * Push entity away from a point.
   *
   * @param entity Entity to push
   * @param fromX Point X to push away from
   * @param fromY Point Y to push away from
   * @param force Push force
   * @param minDistance Minimum distance to maintain (optional)
   */
  pushAwayFromPoint(entity: EntityId, fromX: number, fromY: number, force: number, minDistance = 0): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Position, entity)) {
      return;
    }

    const px = Position.x[entity];
    const py = Position.y[entity];

    const dx = px - fromX;
    const dy = py - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) {
      // Entity is at the same position - push in random direction
      const angle = Math.random() * Math.PI * 2;
      this.applyKnockback(entity, Math.cos(angle), Math.sin(angle), force);
      return;
    }

    // Normalize direction
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Apply knockback
    this.applyKnockback(entity, dirX, dirY, force);

    // Optionally ensure minimum distance
    if (minDistance > 0 && dist < minDistance) {
      Position.x[entity] = fromX + dirX * minDistance;
      Position.y[entity] = fromY + dirY * minDistance;
    }
  }

  /**
   * Separate circle from circle.
   */
  separateCircleFromCircle(entityA: EntityId, entityB: EntityId): void {
    const rawWorld = this.world.raw;

    const hasColliderA = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entityA);
    const hasColliderB = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entityB);

    if (!hasColliderA || !hasColliderB) {
      return;
    }

    const ax = Position.x[entityA] + CircleCollider.offsetX[entityA];
    const ay = Position.y[entityA] + CircleCollider.offsetY[entityA];
    const radiusA = CircleCollider.radius[entityA];

    const bx = Position.x[entityB] + CircleCollider.offsetX[entityB];
    const by = Position.y[entityB] + CircleCollider.offsetY[entityB];
    const radiusB = CircleCollider.radius[entityB];

    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = radiusA + radiusB;

    if (dist >= minDist) {
      return; // Not overlapping
    }

    const overlap = minDist - dist + 0.1; // Buffer

    let normalX = 0;
    let normalY = 0;

    if (dist > 0.0001) {
      normalX = dx / dist;
      normalY = dy / dist;
    } else {
      normalX = 1;
      normalY = 0;
    }

    // Get masses
    let massA = 1;
    let massB = 1;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entityA)) {
      massA = Movement.mass[entityA] || 1;
    }
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, entityB)) {
      massB = Movement.mass[entityB] || 1;
    }

    const totalMass = massA + massB;
    const ratioA = massB / totalMass;
    const ratioB = massA / totalMass;

    Position.x[entityA] -= normalX * overlap * ratioA;
    Position.y[entityA] -= normalY * overlap * ratioA;
    Position.x[entityB] += normalX * overlap * ratioB;
    Position.y[entityB] += normalY * overlap * ratioB;
  }

  /**
   * Separate circle from rectangle.
   */
  separateCircleFromRect(circleEntity: EntityId, rectEntity: EntityId): void {
    const rawWorld = this.world.raw;

    const hasCircle = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, circleEntity);
    const hasRect = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, rectEntity);

    if (!hasCircle || !hasRect) {
      return;
    }

    const cx = Position.x[circleEntity] + CircleCollider.offsetX[circleEntity];
    const cy = Position.y[circleEntity] + CircleCollider.offsetY[circleEntity];
    const radius = CircleCollider.radius[circleEntity];

    const rx = Position.x[rectEntity] + RectCollider.offsetX[rectEntity];
    const ry = Position.y[rectEntity] + RectCollider.offsetY[rectEntity];
    const halfWidth = RectCollider.width[rectEntity] / 2;
    const halfHeight = RectCollider.height[rectEntity] / 2;

    // Find closest point on rectangle
    const closestX = Math.max(rx - halfWidth, Math.min(cx, rx + halfWidth));
    const closestY = Math.max(ry - halfHeight, Math.min(cy, ry + halfHeight));

    const dx = cx - closestX;
    const dy = cy - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= radius) {
      return; // Not overlapping
    }

    const overlap = radius - dist + 0.1;

    let normalX = 0;
    let normalY = 0;

    if (dist > 0.0001) {
      normalX = dx / dist;
      normalY = dy / dist;
    } else {
      // Circle center is inside rect
      const leftDist = cx - (rx - halfWidth);
      const rightDist = (rx + halfWidth) - cx;
      const topDist = cy - (ry - halfHeight);
      const bottomDist = (ry + halfHeight) - cy;
      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

      if (minDist === leftDist) {
        normalX = -1;
      } else if (minDist === rightDist) {
        normalX = 1;
      } else if (minDist === topDist) {
        normalY = -1;
      } else {
        normalY = 1;
      }
    }

    // Get masses
    let circleMass = 1;
    let rectMass = 1;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, circleEntity)) {
      circleMass = Movement.mass[circleEntity] || 1;
    }
    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Movement, rectEntity)) {
      rectMass = Movement.mass[rectEntity] || 1;
    }

    const totalMass = circleMass + rectMass;
    const circleRatio = rectMass / totalMass;
    const rectRatio = circleMass / totalMass;

    Position.x[circleEntity] += normalX * overlap * circleRatio;
    Position.y[circleEntity] += normalY * overlap * circleRatio;
    Position.x[rectEntity] -= normalX * overlap * rectRatio;
    Position.y[rectEntity] -= normalY * overlap * rectRatio;
  }

  /**
   * Bounce entity off collision surface.
   * Reflects velocity along collision normal.
   *
   * @param entity Entity to bounce
   * @param normalX Collision normal X
   * @param normalY Collision normal Y
   * @param bounciness Bounce factor (0 = no bounce, 1 = perfect bounce)
   */
  bounceEntity(entity: EntityId, normalX: number, normalY: number, bounciness = 0.5): void {
    const rawWorld = this.world.raw;

    if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Velocity, entity)) {
      return;
    }

    const vx = Velocity.x[entity];
    const vy = Velocity.y[entity];

    // Calculate velocity component along normal
    const dot = vx * normalX + vy * normalY;

    // Only bounce if moving toward surface
    if (dot >= 0) {
      return;
    }

    // Reflect velocity
    Velocity.x[entity] = vx - (1 + bounciness) * dot * normalX;
    Velocity.y[entity] = vy - (1 + bounciness) * dot * normalY;
  }
}
