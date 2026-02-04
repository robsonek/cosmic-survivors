/**
 * SpriteSystem - ECS system for synchronizing sprite rendering with ECS components.
 * Syncs Position, Rotation, Scale, and Sprite visibility with the renderer.
 */

import { defineQuery, enterQuery, exitQuery, hasComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import { Position, Rotation, Scale, Sprite } from '../shared/types/components';
import type { Renderer } from './Renderer';

/**
 * Query for entities with Position and Sprite components.
 */
const spriteQuery = defineQuery([Position, Sprite]);

/**
 * Query for newly added sprites.
 */
const spriteEnterQuery = enterQuery(spriteQuery);

/**
 * Query for removed sprites.
 */
const spriteExitQuery = exitQuery(spriteQuery);

/**
 * SpriteSystem synchronizes ECS entity data with renderer sprites.
 */
export class SpriteSystem implements ISystem {
  readonly name: string = 'SpriteSystem';
  readonly priority: number = 100; // Rendering priority
  readonly dependencies: string[] = [];

  enabled: boolean = true;

  /** Reference to ECS world */
  private world: IWorld | null = null;

  /** Reference to renderer */
  private renderer: Renderer;

  /** Texture key lookup map (textureId -> key) */
  private textureKeys: Map<number, string> = new Map();

  /** Next texture ID */
  private nextTextureId: number = 1;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Initialize the system with world reference.
   */
  init(world: IWorld): void {
    this.world = world;
  }

  /**
   * Register a texture key and get its ID.
   */
  registerTexture(key: string): number {
    // Check if already registered
    let existingId: number | undefined;
    this.textureKeys.forEach((existingKey, id) => {
      if (existingKey === key) {
        existingId = id;
      }
    });
    if (existingId !== undefined) {
      return existingId;
    }

    // Register new texture
    const id = this.nextTextureId++;
    this.textureKeys.set(id, key);
    return id;
  }

  /**
   * Get texture key from ID.
   */
  getTextureKey(textureId: number): string | undefined {
    return this.textureKeys.get(textureId);
  }

  /**
   * Update the system.
   */
  update(_dt: number): void {
    if (!this.world) return;

    const world = this.world.raw;

    // Process newly added sprites
    const entered = spriteEnterQuery(world);
    for (const entity of entered) {
      this.createEntitySprite(entity);
    }

    // Process removed sprites
    const exited = spriteExitQuery(world);
    for (const entity of exited) {
      this.renderer.removeSprite(entity);
    }

    // Sync all active sprites
    const entities = spriteQuery(world);
    for (const entity of entities) {
      this.syncEntitySprite(entity);
    }
  }

  /**
   * Create a sprite for a new entity.
   */
  private createEntitySprite(entity: EntityId): void {
    const textureKey = this.textureKeys.get(Sprite.textureId[entity]);
    if (!textureKey) {
      console.warn(`SpriteSystem: No texture key found for textureId ${Sprite.textureId[entity]} on entity ${entity}`);
      return;
    }

    // Get layer value
    const layer = Sprite.layer[entity] ?? 50; // Default to Entities layer

    // Create sprite configuration from ECS components
    const config = {
      key: textureKey,
      frame: Sprite.frameIndex[entity],
      width: Sprite.width[entity] || undefined,
      height: Sprite.height[entity] || undefined,
      originX: Sprite.originX[entity] || 0.5,
      originY: Sprite.originY[entity] || 0.5,
      tint: Sprite.tint[entity] || undefined,
      alpha: Sprite.alpha[entity] || 1,
      flipX: Sprite.flipX[entity] === 1,
      flipY: Sprite.flipY[entity] === 1,
      layer: layer,
    };

    this.renderer.createSprite(entity, config);

    // Set initial position
    this.syncEntitySprite(entity);
  }

  /**
   * Synchronize entity data with sprite.
   */
  private syncEntitySprite(entity: EntityId): void {
    if (!this.renderer.hasSprite(entity)) return;

    // Check visibility
    const visible = Sprite.visible[entity] !== 0;
    if (!visible) {
      // TODO: Handle visibility in renderer
      return;
    }

    // Sync position
    const x = Position.x[entity];
    const y = Position.y[entity];
    this.renderer.setSpritePosition(entity, x, y);

    // Sync rotation if component exists
    if (this.world && hasComponent(this.world.raw, Rotation, entity)) {
      const rotation = Rotation.angle[entity];
      this.renderer.setSpriteRotation(entity, rotation);
    }

    // Sync scale if component exists
    if (this.world && hasComponent(this.world.raw, Scale, entity)) {
      const scaleX = Scale.x[entity] || 1;
      const scaleY = Scale.y[entity] || 1;
      this.renderer.setSpriteScale(entity, scaleX, scaleY);
    }

    // Sync sprite-specific properties
    const alpha = Sprite.alpha[entity];
    if (alpha !== undefined) {
      this.renderer.updateSprite(entity, { alpha });
    }

    // Sync tint
    const tint = Sprite.tint[entity];
    if (tint !== 0 && tint !== undefined) {
      this.renderer.updateSprite(entity, { tint });
    }

    // Sync flip
    const flipX = Sprite.flipX[entity] === 1;
    const flipY = Sprite.flipY[entity] === 1;
    this.renderer.updateSprite(entity, { flipX, flipY });
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    // Remove all sprites
    if (this.world) {
      const entities = spriteQuery(this.world.raw);
      for (const entity of entities) {
        this.renderer.removeSprite(entity);
      }
    }

    this.textureKeys.clear();
    this.world = null;
  }

  /**
   * Force refresh of entity sprite.
   */
  refreshSprite(entity: EntityId): void {
    if (!this.world) return;

    // Remove existing sprite
    this.renderer.removeSprite(entity);

    // Recreate sprite
    if (hasComponent(this.world.raw, Sprite, entity)) {
      this.createEntitySprite(entity);
    }
  }

  /**
   * Update sprite texture.
   */
  updateTexture(entity: EntityId, textureKey: string): void {
    const textureId = this.registerTexture(textureKey);
    Sprite.textureId[entity] = textureId;
    this.refreshSprite(entity);
  }
}
