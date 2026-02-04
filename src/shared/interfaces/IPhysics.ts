import type { EntityId } from './IWorld';

/**
 * Collision layer flags.
 */
export enum CollisionLayer {
  None = 0,
  Player = 1 << 0,
  Enemy = 1 << 1,
  PlayerProjectile = 1 << 2,
  EnemyProjectile = 1 << 3,
  Pickup = 1 << 4,
  Wall = 1 << 5,
  Trigger = 1 << 6,
}

/**
 * Collision mask presets.
 */
export const CollisionMasks = {
  Player: CollisionLayer.Enemy | CollisionLayer.EnemyProjectile | CollisionLayer.Pickup | CollisionLayer.Wall,
  Enemy: CollisionLayer.Player | CollisionLayer.PlayerProjectile | CollisionLayer.Wall,
  PlayerProjectile: CollisionLayer.Enemy | CollisionLayer.Wall,
  EnemyProjectile: CollisionLayer.Player | CollisionLayer.Wall,
  Pickup: CollisionLayer.Player,
  Wall: CollisionLayer.Player | CollisionLayer.Enemy | CollisionLayer.PlayerProjectile | CollisionLayer.EnemyProjectile,
} as const;

/**
 * Collider shape types.
 */
export enum ColliderShape {
  Circle = 'circle',
  Rectangle = 'rectangle',
  Point = 'point',
}

/**
 * Collider configuration.
 */
export interface IColliderConfig {
  shape: ColliderShape;
  layer: CollisionLayer;
  mask: number;           // Layers this collides with
  isTrigger?: boolean;    // If true, doesn't block movement
  radius?: number;        // For circle
  width?: number;         // For rectangle
  height?: number;        // For rectangle
  offsetX?: number;       // Offset from entity position
  offsetY?: number;
}

/**
 * Collision result.
 */
export interface ICollision {
  entityA: EntityId;
  entityB: EntityId;
  overlap: number;
  normalX: number;
  normalY: number;
  contactX: number;
  contactY: number;
}

/**
 * Raycast result.
 */
export interface IRaycastHit {
  entity: EntityId;
  point: { x: number; y: number };
  normal: { x: number; y: number };
  distance: number;
}

/**
 * Spatial query interface for efficient collision detection.
 */
export interface ISpatialHash {
  /** Cell size used for hashing */
  readonly cellSize: number;

  /**
   * Insert entity into spatial hash.
   */
  insert(entity: EntityId, x: number, y: number, radius: number): void;

  /**
   * Remove entity from spatial hash.
   */
  remove(entity: EntityId): void;

  /**
   * Update entity position.
   */
  update(entity: EntityId, x: number, y: number, radius: number): void;

  /**
   * Query entities in radius.
   */
  queryRadius(x: number, y: number, radius: number): EntityId[];

  /**
   * Query entities in rectangle.
   */
  queryRect(x: number, y: number, width: number, height: number): EntityId[];

  /**
   * Query entities by layer in radius.
   */
  queryRadiusWithLayer(x: number, y: number, radius: number, layer: CollisionLayer): EntityId[];

  /**
   * Clear all entities.
   */
  clear(): void;
}

/**
 * Physics system interface.
 */
export interface IPhysicsSystem {
  /** Spatial partitioning structure */
  readonly spatial: ISpatialHash;

  /** Gravity vector */
  gravity: { x: number; y: number };

  /**
   * Perform raycast.
   * @param startX Start X position
   * @param startY Start Y position
   * @param dirX Direction X (normalized)
   * @param dirY Direction Y (normalized)
   * @param maxDistance Maximum ray distance
   * @param layerMask Collision layers to test against
   * @returns First hit or null
   */
  raycast(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    layerMask?: number
  ): IRaycastHit | null;

  /**
   * Perform raycast and return all hits.
   */
  raycastAll(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    layerMask?: number
  ): IRaycastHit[];

  /**
   * Check if point is inside any collider.
   */
  pointInCollider(x: number, y: number, layerMask?: number): EntityId | null;

  /**
   * Get all entities overlapping with circle.
   */
  overlapCircle(x: number, y: number, radius: number, layerMask?: number): EntityId[];

  /**
   * Get all collisions this frame.
   */
  getCollisions(): ICollision[];

  /**
   * Register collision callback.
   */
  onCollision(callback: (collision: ICollision) => void): void;

  /**
   * Register trigger enter callback.
   */
  onTriggerEnter(callback: (entityA: EntityId, entityB: EntityId) => void): void;

  /**
   * Register trigger exit callback.
   */
  onTriggerExit(callback: (entityA: EntityId, entityB: EntityId) => void): void;
}

/**
 * Movement configuration for entities.
 */
export interface IMovementConfig {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  friction?: number;      // Ground friction
  airFriction?: number;   // Air resistance
  mass?: number;          // For knockback calculations
}
