/**
 * PhysicsSystem - Main aggregating physics system.
 *
 * Implements IPhysicsSystem interface and provides high-level physics
 * queries like raycasting, point queries, and overlap tests.
 */

import { hasComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IPhysicsSystem, ISpatialHash, ICollision, IRaycastHit } from '../shared/interfaces/IPhysics';
// CollisionLayer is used for default parameter values
import { Position, CircleCollider, RectCollider } from '../shared/types/components';
import { SpatialHash } from '../spatial/SpatialHash';
import { CollisionSystem } from './CollisionSystem';
import { MovementSystem } from './MovementSystem';
import { CollisionResolver } from './CollisionResolver';

/**
 * Collision callback type.
 */
type CollisionCallback = (collision: ICollision) => void;
type TriggerCallback = (entityA: EntityId, entityB: EntityId) => void;

/**
 * PhysicsSystem - Main physics system that aggregates spatial hash,
 * collision detection, movement, and physics queries.
 */
export class PhysicsSystem implements ISystem, IPhysicsSystem {
  public readonly name = 'PhysicsSystem';
  public readonly priority = 10; // Physics runs early
  public readonly dependencies: string[] = [];
  public enabled = true;

  // Gravity (pixels per second squared)
  public gravity = { x: 0, y: 0 };

  // Sub-systems
  private readonly spatialHash: SpatialHash;
  private readonly collisionSystem: CollisionSystem;
  private readonly movementSystem: MovementSystem;
  private readonly collisionResolver: CollisionResolver;

  private world!: IWorld;

  // Expose spatial hash through interface
  get spatial(): ISpatialHash {
    return this.spatialHash;
  }

  constructor() {
    this.spatialHash = new SpatialHash();
    this.collisionSystem = new CollisionSystem(this.spatialHash);
    this.movementSystem = new MovementSystem();
    this.collisionResolver = new CollisionResolver();
  }

  init(world: IWorld): void {
    this.world = world;

    // Initialize sub-systems
    this.movementSystem.init(world);
    this.collisionSystem.init(world);
    this.collisionResolver.init(world);
  }

  /**
   * Fixed update for physics simulation.
   */
  fixedUpdate(fixedDt: number): void {
    if (!this.enabled) return;

    // 1. Apply movement
    this.movementSystem.fixedUpdate(fixedDt);

    // 2. Update spatial hash and detect collisions
    this.collisionSystem.update(fixedDt);
  }

  /**
   * Regular update - delegates to sub-systems.
   */
  update(_dt: number): void {
    if (!this.enabled) return;

    // Note: Physics uses fixedUpdate, but we still run collision detection
    // in update for systems that don't use fixed timestep
  }

  /**
   * Perform raycast and return first hit.
   */
  raycast(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    layerMask: number = 0xFFFF
  ): IRaycastHit | null {
    const hits = this.raycastAll(startX, startY, dirX, dirY, maxDistance, layerMask);
    return hits.length > 0 ? hits[0] : null;
  }

  /**
   * Perform raycast and return all hits sorted by distance.
   */
  raycastAll(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    layerMask: number = 0xFFFF
  ): IRaycastHit[] {
    const rawWorld = this.world.raw;
    const hits: IRaycastHit[] = [];

    // Normalize direction
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dirLen < 0.0001) {
      return hits;
    }
    const ndx = dirX / dirLen;
    const ndy = dirY / dirLen;

    // Query entities along the ray path
    // Use rectangle query covering the ray's bounding box
    const endX = startX + ndx * maxDistance;
    const endY = startY + ndy * maxDistance;

    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const width = maxX - minX + 100; // Buffer for entity radii
    const height = maxY - minY + 100;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const candidates = this.spatialHash.queryRect(centerX, centerY, width, height);

    for (const entity of candidates) {
      // Check layer mask
      let entityLayer = 0;
      let hasCollider = false;

      if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
        entityLayer = CircleCollider.layer[entity];
        hasCollider = true;
      } else if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, entity)) {
        entityLayer = RectCollider.layer[entity];
        hasCollider = true;
      }

      if (!hasCollider) continue;
      if ((entityLayer & layerMask) === 0) continue;

      // Perform ray intersection test
      const hit = this.rayIntersectsEntity(startX, startY, ndx, ndy, maxDistance, entity);
      if (hit) {
        hits.push(hit);
      }
    }

    // Sort by distance
    hits.sort((a, b) => a.distance - b.distance);

    return hits;
  }

  /**
   * Ray intersection test for a single entity.
   */
  private rayIntersectsEntity(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    entity: EntityId
  ): IRaycastHit | null {
    const rawWorld = this.world.raw;

    if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
      return this.rayIntersectsCircle(startX, startY, dirX, dirY, maxDistance, entity);
    } else if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, entity)) {
      return this.rayIntersectsRect(startX, startY, dirX, dirY, maxDistance, entity);
    }

    return null;
  }

  /**
   * Ray-circle intersection.
   */
  private rayIntersectsCircle(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    entity: EntityId
  ): IRaycastHit | null {
    const cx = Position.x[entity] + CircleCollider.offsetX[entity];
    const cy = Position.y[entity] + CircleCollider.offsetY[entity];
    const radius = CircleCollider.radius[entity];

    // Vector from ray start to circle center
    const ocx = cx - startX;
    const ocy = cy - startY;

    // Project onto ray direction
    const t = ocx * dirX + ocy * dirY;

    // Find closest point on ray to circle center
    const closestX = startX + dirX * t;
    const closestY = startY + dirY * t;

    // Distance from closest point to circle center
    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq > radius * radius) {
      return null; // Ray misses circle
    }

    // Calculate intersection distance
    const halfChord = Math.sqrt(radius * radius - distSq);
    let hitDistance = t - halfChord;

    // If we're inside the circle, use the exit point
    if (hitDistance < 0) {
      hitDistance = t + halfChord;
    }

    if (hitDistance < 0 || hitDistance > maxDistance) {
      return null; // Hit is behind ray or too far
    }

    // Calculate hit point and normal
    const hitX = startX + dirX * hitDistance;
    const hitY = startY + dirY * hitDistance;

    const normalX = (hitX - cx) / radius;
    const normalY = (hitY - cy) / radius;

    return {
      entity,
      point: { x: hitX, y: hitY },
      normal: { x: normalX, y: normalY },
      distance: hitDistance,
    };
  }

  /**
   * Ray-rectangle intersection (AABB).
   */
  private rayIntersectsRect(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    entity: EntityId
  ): IRaycastHit | null {
    const rx = Position.x[entity] + RectCollider.offsetX[entity];
    const ry = Position.y[entity] + RectCollider.offsetY[entity];
    const halfWidth = RectCollider.width[entity] / 2;
    const halfHeight = RectCollider.height[entity] / 2;

    const minX = rx - halfWidth;
    const maxX = rx + halfWidth;
    const minY = ry - halfHeight;
    const maxY = ry + halfHeight;

    // Slab method for ray-AABB intersection
    let tMin = 0;
    let tMax = maxDistance;
    let normalX = 0;
    let normalY = 0;

    // X slab
    if (Math.abs(dirX) < 0.0001) {
      if (startX < minX || startX > maxX) {
        return null;
      }
    } else {
      const invDirX = 1 / dirX;
      let t1 = (minX - startX) * invDirX;
      let t2 = (maxX - startX) * invDirX;

      let n1x = -1;
      let n2x = 1;

      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        [n1x, n2x] = [n2x, n1x];
      }

      if (t1 > tMin) {
        tMin = t1;
        normalX = n1x;
        normalY = 0;
      }
      if (t2 < tMax) {
        tMax = t2;
      }

      if (tMin > tMax) {
        return null;
      }
    }

    // Y slab
    if (Math.abs(dirY) < 0.0001) {
      if (startY < minY || startY > maxY) {
        return null;
      }
    } else {
      const invDirY = 1 / dirY;
      let t1 = (minY - startY) * invDirY;
      let t2 = (maxY - startY) * invDirY;

      let n1y = -1;
      let n2y = 1;

      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        [n1y, n2y] = [n2y, n1y];
      }

      if (t1 > tMin) {
        tMin = t1;
        normalX = 0;
        normalY = n1y;
      }
      if (t2 < tMax) {
        tMax = t2;
      }

      if (tMin > tMax) {
        return null;
      }
    }

    if (tMin < 0 || tMin > maxDistance) {
      return null;
    }

    const hitX = startX + dirX * tMin;
    const hitY = startY + dirY * tMin;

    return {
      entity,
      point: { x: hitX, y: hitY },
      normal: { x: normalX, y: normalY },
      distance: tMin,
    };
  }

  /**
   * Check if point is inside any collider.
   */
  pointInCollider(x: number, y: number, layerMask: number = 0xFFFF): EntityId | null {
    const rawWorld = this.world.raw;

    // Query small radius around point
    const candidates = this.spatialHash.queryRadius(x, y, 1);

    for (const entity of candidates) {
      let entityLayer = 0;

      if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
        entityLayer = CircleCollider.layer[entity];
        if ((entityLayer & layerMask) === 0) continue;

        const cx = Position.x[entity] + CircleCollider.offsetX[entity];
        const cy = Position.y[entity] + CircleCollider.offsetY[entity];
        const radius = CircleCollider.radius[entity];

        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          return entity;
        }
      } else if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, entity)) {
        entityLayer = RectCollider.layer[entity];
        if ((entityLayer & layerMask) === 0) continue;

        const rx = Position.x[entity] + RectCollider.offsetX[entity];
        const ry = Position.y[entity] + RectCollider.offsetY[entity];
        const halfWidth = RectCollider.width[entity] / 2;
        const halfHeight = RectCollider.height[entity] / 2;

        if (x >= rx - halfWidth && x <= rx + halfWidth &&
            y >= ry - halfHeight && y <= ry + halfHeight) {
          return entity;
        }
      }
    }

    return null;
  }

  /**
   * Get all entities overlapping with circle.
   */
  overlapCircle(x: number, y: number, radius: number, layerMask: number = 0xFFFF): EntityId[] {
    const rawWorld = this.world.raw;
    const results: EntityId[] = [];

    const candidates = this.spatialHash.queryRadius(x, y, radius);

    for (const entity of candidates) {
      let entityLayer = 0;

      if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entity)) {
        entityLayer = CircleCollider.layer[entity];
        if ((entityLayer & layerMask) === 0) continue;

        const cx = Position.x[entity] + CircleCollider.offsetX[entity];
        const cy = Position.y[entity] + CircleCollider.offsetY[entity];
        const entityRadius = CircleCollider.radius[entity];

        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;
        const combinedRadius = radius + entityRadius;

        if (distSq <= combinedRadius * combinedRadius) {
          results.push(entity);
        }
      } else if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, entity)) {
        entityLayer = RectCollider.layer[entity];
        if ((entityLayer & layerMask) === 0) continue;

        const rx = Position.x[entity] + RectCollider.offsetX[entity];
        const ry = Position.y[entity] + RectCollider.offsetY[entity];
        const halfWidth = RectCollider.width[entity] / 2;
        const halfHeight = RectCollider.height[entity] / 2;

        // Find closest point on rect to circle center
        const closestX = Math.max(rx - halfWidth, Math.min(x, rx + halfWidth));
        const closestY = Math.max(ry - halfHeight, Math.min(y, ry + halfHeight));

        const dx = x - closestX;
        const dy = y - closestY;

        if (dx * dx + dy * dy <= radius * radius) {
          results.push(entity);
        }
      }
    }

    return results;
  }

  /**
   * Get all collisions from current frame.
   */
  getCollisions(): ICollision[] {
    return this.collisionSystem.getCollisions();
  }

  /**
   * Register collision callback.
   */
  onCollision(callback: CollisionCallback): void {
    this.collisionSystem.onCollision(callback);
  }

  /**
   * Register trigger enter callback.
   */
  onTriggerEnter(callback: TriggerCallback): void {
    this.collisionSystem.onTriggerEnter(callback);
  }

  /**
   * Register trigger exit callback.
   */
  onTriggerExit(callback: TriggerCallback): void {
    this.collisionSystem.onTriggerExit(callback);
  }

  /**
   * Get the collision system.
   */
  getCollisionSystem(): CollisionSystem {
    return this.collisionSystem;
  }

  /**
   * Get the movement system.
   */
  getMovementSystem(): MovementSystem {
    return this.movementSystem;
  }

  /**
   * Get the collision resolver.
   */
  getCollisionResolver(): CollisionResolver {
    return this.collisionResolver;
  }

  /**
   * Clear all physics data.
   */
  clear(): void {
    this.spatialHash.clear();
  }

  destroy(): void {
    this.spatialHash.clear();
    this.collisionSystem.destroy();
    this.movementSystem.destroy();
  }
}
