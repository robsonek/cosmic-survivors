/**
 * CollisionSystem - ECS system for collision detection.
 *
 * Performs broad phase using SpatialHash and narrow phase
 * collision detection for circle-circle, circle-rect, and rect-rect.
 * Generates collision events and tracks trigger states.
 */

import { defineQuery, enterQuery, exitQuery, hasComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { ICollision } from '../shared/interfaces/IPhysics';
import { CollisionLayer } from '../shared/interfaces/IPhysics';
import { Position, CircleCollider, RectCollider } from '../shared/types/components';
import { SpatialHash } from '../spatial/SpatialHash';
import { MAX_COLLISION_CHECKS_PER_FRAME } from '../shared/constants/game';

/**
 * Key for tracking trigger pairs.
 */
function makePairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Collision callback type.
 */
type CollisionCallback = (collision: ICollision) => void;
type TriggerCallback = (entityA: EntityId, entityB: EntityId) => void;

/**
 * CollisionSystem - Detects and reports collisions between entities.
 */
export class CollisionSystem implements ISystem {
  public readonly name = 'CollisionSystem';
  public readonly priority = 15; // After movement, before combat
  public readonly dependencies: string[] = ['MovementSystem'];
  public enabled = true;

  private world!: IWorld;
  private spatialHash!: SpatialHash;

  // Queries for entities with colliders
  private circleQuery!: ReturnType<typeof defineQuery>;
  private rectQuery!: ReturnType<typeof defineQuery>;
  private circleEnterQuery!: ReturnType<typeof enterQuery>;
  private circleExitQuery!: ReturnType<typeof exitQuery>;
  private rectEnterQuery!: ReturnType<typeof enterQuery>;
  private rectExitQuery!: ReturnType<typeof exitQuery>;

  // Current frame collisions
  private readonly collisions: ICollision[] = [];

  // Trigger tracking (pairs currently in contact)
  private readonly activeTriggers: Set<string> = new Set();
  private readonly currentFrameTriggers: Set<string> = new Set();

  // Callbacks
  private readonly collisionCallbacks: CollisionCallback[] = [];
  private readonly triggerEnterCallbacks: TriggerCallback[] = [];
  private readonly triggerExitCallbacks: TriggerCallback[] = [];

  // Performance tracking
  private collisionChecksThisFrame = 0;

  constructor(spatialHash: SpatialHash) {
    this.spatialHash = spatialHash;
  }

  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.circleQuery = defineQuery([Position, CircleCollider]);
    this.rectQuery = defineQuery([Position, RectCollider]);
    this.circleEnterQuery = enterQuery(this.circleQuery);
    this.circleExitQuery = exitQuery(this.circleQuery);
    this.rectEnterQuery = enterQuery(this.rectQuery);
    this.rectExitQuery = exitQuery(this.rectQuery);
  }

  /**
   * Main update - updates spatial hash and detects collisions.
   */
  update(_dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;
    this.collisions.length = 0;
    this.currentFrameTriggers.clear();
    this.collisionChecksThisFrame = 0;

    // Handle enter/exit for spatial hash
    this.handleEntityChanges(rawWorld);

    // Update positions in spatial hash
    this.updateSpatialHash(rawWorld);

    // Detect collisions
    this.detectCollisions(rawWorld);

    // Process trigger exits
    this.processTriggerExits();
  }

  /**
   * Handle entities entering/exiting collision queries.
   */
  private handleEntityChanges(rawWorld: object): void {
    // Handle circle colliders entering
    const circleEntered = this.circleEnterQuery(rawWorld);
    for (const entity of circleEntered) {
      const x = Position.x[entity];
      const y = Position.y[entity];
      const radius = CircleCollider.radius[entity];
      const layer = CircleCollider.layer[entity] as CollisionLayer;
      this.spatialHash.insert(entity, x, y, radius, layer);
    }

    // Handle circle colliders exiting
    const circleExited = this.circleExitQuery(rawWorld);
    for (const entity of circleExited) {
      this.spatialHash.remove(entity);
    }

    // Handle rect colliders entering
    const rectEntered = this.rectEnterQuery(rawWorld);
    for (const entity of rectEntered) {
      const x = Position.x[entity];
      const y = Position.y[entity];
      const width = RectCollider.width[entity];
      const height = RectCollider.height[entity];
      // Use half diagonal as radius for spatial hash
      const radius = Math.sqrt(width * width + height * height) / 2;
      const layer = RectCollider.layer[entity] as CollisionLayer;
      this.spatialHash.insert(entity, x, y, radius, layer);
    }

    // Handle rect colliders exiting
    const rectExited = this.rectExitQuery(rawWorld);
    for (const entity of rectExited) {
      this.spatialHash.remove(entity);
    }
  }

  /**
   * Update all entity positions in spatial hash.
   */
  private updateSpatialHash(rawWorld: object): void {
    // Update circle colliders
    const circleEntities = this.circleQuery(rawWorld);
    for (const entity of circleEntities) {
      const x = Position.x[entity] + CircleCollider.offsetX[entity];
      const y = Position.y[entity] + CircleCollider.offsetY[entity];
      const radius = CircleCollider.radius[entity];
      const layer = CircleCollider.layer[entity] as CollisionLayer;
      this.spatialHash.update(entity, x, y, radius, layer);
    }

    // Update rect colliders
    const rectEntities = this.rectQuery(rawWorld);
    for (const entity of rectEntities) {
      const x = Position.x[entity] + RectCollider.offsetX[entity];
      const y = Position.y[entity] + RectCollider.offsetY[entity];
      const width = RectCollider.width[entity];
      const height = RectCollider.height[entity];
      const radius = Math.sqrt(width * width + height * height) / 2;
      const layer = RectCollider.layer[entity] as CollisionLayer;
      this.spatialHash.update(entity, x, y, radius, layer);
    }
  }

  /**
   * Detect collisions using broad phase + narrow phase.
   */
  private detectCollisions(rawWorld: object): void {
    const circleEntities = this.circleQuery(rawWorld);
    const rectEntities = this.rectQuery(rawWorld);

    // Check circle vs circle and circle vs rect
    for (const entityA of circleEntities) {
      if (this.collisionChecksThisFrame >= MAX_COLLISION_CHECKS_PER_FRAME) {
        console.warn('CollisionSystem: Max collision checks reached');
        break;
      }

      const ax = Position.x[entityA] + CircleCollider.offsetX[entityA];
      const ay = Position.y[entityA] + CircleCollider.offsetY[entityA];
      const aRadius = CircleCollider.radius[entityA];
      const aLayer = CircleCollider.layer[entityA];
      const aMask = CircleCollider.mask[entityA];
      const aIsTrigger = CircleCollider.isTrigger[entityA] === 1;

      // Query potential colliders
      const nearby = this.spatialHash.queryRadius(ax, ay, aRadius + 100); // +100 for max other radius

      for (const entityB of nearby) {
        if (entityA >= entityB) continue; // Avoid duplicate checks
        if (this.collisionChecksThisFrame >= MAX_COLLISION_CHECKS_PER_FRAME) break;

        this.collisionChecksThisFrame++;

        // Check if B has a collider and get its layer
        const hasCircle = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entityB);
        const hasRect = hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, entityB);

        if (!hasCircle && !hasRect) continue;

        let bLayer: number;
        let bMask: number;
        let bIsTrigger: boolean;

        if (hasCircle) {
          bLayer = CircleCollider.layer[entityB];
          bMask = CircleCollider.mask[entityB];
          bIsTrigger = CircleCollider.isTrigger[entityB] === 1;
        } else {
          bLayer = RectCollider.layer[entityB];
          bMask = RectCollider.mask[entityB];
          bIsTrigger = RectCollider.isTrigger[entityB] === 1;
        }

        // Check layer/mask compatibility
        if ((aLayer & bMask) === 0 && (bLayer & aMask) === 0) continue;

        // Narrow phase collision check
        let collision: ICollision | null = null;

        if (hasCircle) {
          collision = this.circleVsCircle(entityA, entityB);
        } else if (hasRect) {
          collision = this.circleVsRect(entityA, entityB);
        }

        if (collision) {
          this.handleCollision(collision, aIsTrigger || bIsTrigger);
        }
      }
    }

    // Check rect vs rect
    for (const entityA of rectEntities) {
      if (this.collisionChecksThisFrame >= MAX_COLLISION_CHECKS_PER_FRAME) break;

      const ax = Position.x[entityA] + RectCollider.offsetX[entityA];
      const ay = Position.y[entityA] + RectCollider.offsetY[entityA];
      const aWidth = RectCollider.width[entityA];
      const aHeight = RectCollider.height[entityA];
      const aRadius = Math.sqrt(aWidth * aWidth + aHeight * aHeight) / 2;
      const aLayer = RectCollider.layer[entityA];
      const aMask = RectCollider.mask[entityA];
      const aIsTrigger = RectCollider.isTrigger[entityA] === 1;

      const nearby = this.spatialHash.queryRadius(ax, ay, aRadius + 100);

      for (const entityB of nearby) {
        if (entityA >= entityB) continue;
        if (this.collisionChecksThisFrame >= MAX_COLLISION_CHECKS_PER_FRAME) break;

        // Only check against other rects (circle vs rect already handled)
        if (!hasComponent(rawWorld as Parameters<typeof hasComponent>[0], RectCollider, entityB)) continue;
        if (hasComponent(rawWorld as Parameters<typeof hasComponent>[0], CircleCollider, entityB)) continue;

        this.collisionChecksThisFrame++;

        const bLayer = RectCollider.layer[entityB];
        const bMask = RectCollider.mask[entityB];
        const bIsTrigger = RectCollider.isTrigger[entityB] === 1;

        if ((aLayer & bMask) === 0 && (bLayer & aMask) === 0) continue;

        const collision = this.rectVsRect(entityA, entityB);
        if (collision) {
          this.handleCollision(collision, aIsTrigger || bIsTrigger);
        }
      }
    }
  }

  /**
   * Circle vs Circle collision test.
   */
  private circleVsCircle(entityA: EntityId, entityB: EntityId): ICollision | null {
    const ax = Position.x[entityA] + CircleCollider.offsetX[entityA];
    const ay = Position.y[entityA] + CircleCollider.offsetY[entityA];
    const aRadius = CircleCollider.radius[entityA];

    const bx = Position.x[entityB] + CircleCollider.offsetX[entityB];
    const by = Position.y[entityB] + CircleCollider.offsetY[entityB];
    const bRadius = CircleCollider.radius[entityB];

    const dx = bx - ax;
    const dy = by - ay;
    const distSq = dx * dx + dy * dy;
    const combinedRadius = aRadius + bRadius;

    if (distSq >= combinedRadius * combinedRadius) {
      return null;
    }

    const dist = Math.sqrt(distSq);
    const overlap = combinedRadius - dist;

    // Calculate normal (A to B)
    let normalX = 0;
    let normalY = 0;
    if (dist > 0.0001) {
      normalX = dx / dist;
      normalY = dy / dist;
    } else {
      // Overlapping exactly - use arbitrary normal
      normalX = 1;
      normalY = 0;
    }

    // Contact point is at the midpoint of overlap
    const contactX = ax + normalX * (aRadius - overlap / 2);
    const contactY = ay + normalY * (aRadius - overlap / 2);

    return {
      entityA,
      entityB,
      overlap,
      normalX,
      normalY,
      contactX,
      contactY,
    };
  }

  /**
   * Circle vs Rectangle collision test.
   */
  private circleVsRect(circleEntity: EntityId, rectEntity: EntityId): ICollision | null {
    const cx = Position.x[circleEntity] + CircleCollider.offsetX[circleEntity];
    const cy = Position.y[circleEntity] + CircleCollider.offsetY[circleEntity];
    const radius = CircleCollider.radius[circleEntity];

    const rx = Position.x[rectEntity] + RectCollider.offsetX[rectEntity];
    const ry = Position.y[rectEntity] + RectCollider.offsetY[rectEntity];
    const halfWidth = RectCollider.width[rectEntity] / 2;
    const halfHeight = RectCollider.height[rectEntity] / 2;

    // Find closest point on rectangle to circle center
    const closestX = Math.max(rx - halfWidth, Math.min(cx, rx + halfWidth));
    const closestY = Math.max(ry - halfHeight, Math.min(cy, ry + halfHeight));

    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= radius * radius) {
      return null;
    }

    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;

    // Calculate normal
    let normalX = 0;
    let normalY = 0;
    if (dist > 0.0001) {
      normalX = dx / dist;
      normalY = dy / dist;
    } else {
      // Circle center is inside rect - find closest edge
      const leftDist = cx - (rx - halfWidth);
      const rightDist = (rx + halfWidth) - cx;
      const topDist = cy - (ry - halfHeight);
      const bottomDist = (ry + halfHeight) - cy;

      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

      if (minDist === leftDist) {
        normalX = -1;
        normalY = 0;
      } else if (minDist === rightDist) {
        normalX = 1;
        normalY = 0;
      } else if (minDist === topDist) {
        normalX = 0;
        normalY = -1;
      } else {
        normalX = 0;
        normalY = 1;
      }
    }

    return {
      entityA: circleEntity,
      entityB: rectEntity,
      overlap,
      normalX,
      normalY,
      contactX: closestX,
      contactY: closestY,
    };
  }

  /**
   * Rectangle vs Rectangle collision test (AABB).
   */
  private rectVsRect(entityA: EntityId, entityB: EntityId): ICollision | null {
    const ax = Position.x[entityA] + RectCollider.offsetX[entityA];
    const ay = Position.y[entityA] + RectCollider.offsetY[entityA];
    const aHalfWidth = RectCollider.width[entityA] / 2;
    const aHalfHeight = RectCollider.height[entityA] / 2;

    const bx = Position.x[entityB] + RectCollider.offsetX[entityB];
    const by = Position.y[entityB] + RectCollider.offsetY[entityB];
    const bHalfWidth = RectCollider.width[entityB] / 2;
    const bHalfHeight = RectCollider.height[entityB] / 2;

    // Check AABB overlap
    const overlapX = (aHalfWidth + bHalfWidth) - Math.abs(bx - ax);
    const overlapY = (aHalfHeight + bHalfHeight) - Math.abs(by - ay);

    if (overlapX <= 0 || overlapY <= 0) {
      return null;
    }

    // Use minimum overlap axis
    let normalX = 0;
    let normalY = 0;
    let overlap: number;

    if (overlapX < overlapY) {
      overlap = overlapX;
      normalX = bx > ax ? 1 : -1;
      normalY = 0;
    } else {
      overlap = overlapY;
      normalX = 0;
      normalY = by > ay ? 1 : -1;
    }

    // Contact point at center of overlap region
    const contactX = (Math.max(ax - aHalfWidth, bx - bHalfWidth) +
                      Math.min(ax + aHalfWidth, bx + bHalfWidth)) / 2;
    const contactY = (Math.max(ay - aHalfHeight, by - bHalfHeight) +
                      Math.min(ay + aHalfHeight, by + bHalfHeight)) / 2;

    return {
      entityA,
      entityB,
      overlap,
      normalX,
      normalY,
      contactX,
      contactY,
    };
  }

  /**
   * Handle a detected collision.
   */
  private handleCollision(collision: ICollision, isTrigger: boolean): void {
    const pairKey = makePairKey(collision.entityA, collision.entityB);

    if (isTrigger) {
      this.currentFrameTriggers.add(pairKey);

      // Check if this is a new trigger
      if (!this.activeTriggers.has(pairKey)) {
        this.activeTriggers.add(pairKey);

        // Fire trigger enter callbacks
        for (const callback of this.triggerEnterCallbacks) {
          callback(collision.entityA, collision.entityB);
        }
      }
    } else {
      // Regular collision
      this.collisions.push(collision);

      // Fire collision callbacks
      for (const callback of this.collisionCallbacks) {
        callback(collision);
      }
    }
  }

  /**
   * Process trigger exits for pairs no longer in contact.
   */
  private processTriggerExits(): void {
    for (const pairKey of this.activeTriggers) {
      if (!this.currentFrameTriggers.has(pairKey)) {
        this.activeTriggers.delete(pairKey);

        // Parse pair key to get entities
        const [aStr, bStr] = pairKey.split(':');
        const entityA = parseInt(aStr, 10);
        const entityB = parseInt(bStr, 10);

        // Fire trigger exit callbacks
        for (const callback of this.triggerExitCallbacks) {
          callback(entityA, entityB);
        }
      }
    }
  }

  /**
   * Get all collisions from current frame.
   */
  getCollisions(): ICollision[] {
    return this.collisions;
  }

  /**
   * Register collision callback.
   */
  onCollision(callback: CollisionCallback): void {
    this.collisionCallbacks.push(callback);
  }

  /**
   * Register trigger enter callback.
   */
  onTriggerEnter(callback: TriggerCallback): void {
    this.triggerEnterCallbacks.push(callback);
  }

  /**
   * Register trigger exit callback.
   */
  onTriggerExit(callback: TriggerCallback): void {
    this.triggerExitCallbacks.push(callback);
  }

  /**
   * Get spatial hash reference.
   */
  getSpatialHash(): SpatialHash {
    return this.spatialHash;
  }

  /**
   * Get collision checks count for debugging.
   */
  getCollisionChecksThisFrame(): number {
    return this.collisionChecksThisFrame;
  }

  destroy(): void {
    this.collisions.length = 0;
    this.activeTriggers.clear();
    this.currentFrameTriggers.clear();
    this.collisionCallbacks.length = 0;
    this.triggerEnterCallbacks.length = 0;
    this.triggerExitCallbacks.length = 0;
  }
}
