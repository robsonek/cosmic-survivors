/**
 * AnimationSystem - ECS system for handling sprite animations.
 * Updates animation frame indices based on time and animation definitions.
 */

import { defineQuery, enterQuery, exitQuery } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import { Animation, Sprite } from '../shared/types/components';
import type { Renderer } from './Renderer';
import type { AnimationManager } from './AnimationManager';

/**
 * Query for entities with Animation and Sprite components.
 */
const animationQuery = defineQuery([Animation, Sprite]);

/**
 * Query for newly added animations.
 */
const animationEnterQuery = enterQuery(animationQuery);

/**
 * Query for removed animations.
 */
const animationExitQuery = exitQuery(animationQuery);

/**
 * AnimationSystem updates animation frame indices and syncs with sprites.
 */
export class AnimationSystem implements ISystem {
  readonly name: string = 'AnimationSystem';
  readonly priority: number = 95; // Just before SpriteSystem
  readonly dependencies: string[] = [];

  enabled: boolean = true;

  /** Reference to ECS world */
  private world: IWorld | null = null;

  /** Reference to renderer */
  private renderer: Renderer;

  /** Reference to animation manager */
  private animationManager: AnimationManager;

  /** Animation ID lookup map (animationId -> animation key) */
  private animationIds: Map<number, string> = new Map();

  /** Reverse lookup (key -> animationId) */
  private animationKeyToId: Map<string, number> = new Map();

  /** Next animation ID */
  private nextAnimationId: number = 1;

  constructor(renderer: Renderer, animationManager: AnimationManager) {
    this.renderer = renderer;
    this.animationManager = animationManager;
  }

  /**
   * Initialize the system with world reference.
   */
  init(world: IWorld): void {
    this.world = world;
  }

  /**
   * Register an animation key and get its ID.
   */
  registerAnimationKey(key: string): number {
    // Check if already registered
    const existingId = this.animationKeyToId.get(key);
    if (existingId !== undefined) {
      return existingId;
    }

    // Register new animation
    const id = this.nextAnimationId++;
    this.animationIds.set(id, key);
    this.animationKeyToId.set(key, id);
    return id;
  }

  /**
   * Get animation key from ID.
   */
  getAnimationKey(animationId: number): string | undefined {
    return this.animationIds.get(animationId);
  }

  /**
   * Get animation ID from key.
   */
  getAnimationId(key: string): number | undefined {
    return this.animationKeyToId.get(key);
  }

  /**
   * Update the system.
   */
  update(dt: number): void {
    if (!this.world) return;

    const world = this.world.raw;

    // Process newly added animations
    const entered = animationEnterQuery(world);
    for (const entity of entered) {
      this.initializeAnimation(entity);
    }

    // Process removed animations (nothing special to do)
    animationExitQuery(world);

    // Update all active animations
    const entities = animationQuery(world);
    for (const entity of entities) {
      this.updateAnimation(entity, dt);
    }
  }

  /**
   * Initialize animation on newly created entity.
   */
  private initializeAnimation(entity: EntityId): void {
    // Reset frame time and index
    Animation.frameTime[entity] = 0;
    Animation.frameIndex[entity] = 0;
  }

  /**
   * Update animation for an entity.
   */
  private updateAnimation(entity: EntityId, dt: number): void {
    // Check if animation is playing
    const playing = Animation.playing[entity] === 1;
    if (!playing) return;

    // Get animation definition
    const animationId = Animation.animationId[entity];
    const animationKey = this.animationIds.get(animationId);
    if (!animationKey) return;

    const animDef = this.animationManager.getAnimation(animationKey);
    if (!animDef) return;

    // Update frame time
    const speed = Animation.speed[entity] || 1;
    const frameTime = Animation.frameTime[entity] + dt * speed;
    const frameDuration = 1 / animDef.frameRate;

    if (frameTime >= frameDuration) {
      // Advance to next frame
      let frameIndex = Animation.frameIndex[entity] + 1;
      const loop = Animation.loop[entity] === 1;

      if (frameIndex >= animDef.frames.length) {
        if (loop) {
          // Loop back to start
          frameIndex = 0;
        } else {
          // Stop at last frame
          frameIndex = animDef.frames.length - 1;
          Animation.playing[entity] = 0;
        }
      }

      Animation.frameIndex[entity] = frameIndex;
      Animation.frameTime[entity] = frameTime - frameDuration;

      // Update sprite frame
      const frame = animDef.frames[frameIndex];
      Sprite.frameIndex[entity] = typeof frame === 'number' ? frame : 0;
      this.renderer.setSpriteFrame(entity, frame);
    } else {
      Animation.frameTime[entity] = frameTime;
    }
  }

  /**
   * Play animation on entity.
   */
  playAnimation(entity: EntityId, animationKey: string, loop: boolean = true): void {
    if (!this.world) return;

    // Get or register animation ID
    let animationId = this.animationKeyToId.get(animationKey);
    if (animationId === undefined) {
      animationId = this.registerAnimationKey(animationKey);
    }

    // Check if animation exists
    const animDef = this.animationManager.getAnimation(animationKey);
    if (!animDef) {
      console.warn(`AnimationSystem: Animation '${animationKey}' not found`);
      return;
    }

    // Set animation component values
    Animation.animationId[entity] = animationId;
    Animation.frameIndex[entity] = 0;
    Animation.frameTime[entity] = 0;
    Animation.loop[entity] = loop ? 1 : 0;
    Animation.playing[entity] = 1;
    Animation.speed[entity] = Animation.speed[entity] || 1;

    // Set initial frame
    if (animDef.frames.length > 0) {
      const frame = animDef.frames[0];
      Sprite.frameIndex[entity] = typeof frame === 'number' ? frame : 0;
      this.renderer.setSpriteFrame(entity, frame);
    }
  }

  /**
   * Stop animation on entity.
   */
  stopAnimation(entity: EntityId): void {
    Animation.playing[entity] = 0;
  }

  /**
   * Pause animation on entity.
   */
  pauseAnimation(entity: EntityId): void {
    Animation.playing[entity] = 0;
  }

  /**
   * Resume animation on entity.
   */
  resumeAnimation(entity: EntityId): void {
    Animation.playing[entity] = 1;
  }

  /**
   * Set animation speed multiplier.
   */
  setAnimationSpeed(entity: EntityId, speed: number): void {
    Animation.speed[entity] = Math.max(0, speed);
  }

  /**
   * Set animation to specific frame.
   */
  setAnimationFrame(entity: EntityId, frameIndex: number): void {
    const animationId = Animation.animationId[entity];
    const animationKey = this.animationIds.get(animationId);
    if (!animationKey) return;

    const animDef = this.animationManager.getAnimation(animationKey);
    if (!animDef) return;

    // Clamp frame index
    const clampedIndex = Math.max(0, Math.min(frameIndex, animDef.frames.length - 1));
    Animation.frameIndex[entity] = clampedIndex;
    Animation.frameTime[entity] = 0;

    // Update sprite frame
    const frame = animDef.frames[clampedIndex];
    Sprite.frameIndex[entity] = typeof frame === 'number' ? frame : 0;
    this.renderer.setSpriteFrame(entity, frame);
  }

  /**
   * Check if animation is playing.
   */
  isPlaying(entity: EntityId): boolean {
    return Animation.playing[entity] === 1;
  }

  /**
   * Get current animation key.
   */
  getCurrentAnimation(entity: EntityId): string | undefined {
    const animationId = Animation.animationId[entity];
    return this.animationIds.get(animationId);
  }

  /**
   * Get current frame index.
   */
  getCurrentFrame(entity: EntityId): number {
    return Animation.frameIndex[entity];
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.animationIds.clear();
    this.animationKeyToId.clear();
    this.world = null;
  }
}
