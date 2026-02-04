/**
 * AnimationManager - Manages animation definitions for the game.
 * Stores and provides access to animation frame sequences and timing.
 */

/**
 * Animation frame type - can be frame index or frame key.
 */
export type AnimationFrame = number | string;

/**
 * Animation definition.
 */
export interface AnimationDefinition {
  /** Unique animation key */
  key: string;

  /** Array of frame indices or frame keys */
  frames: AnimationFrame[];

  /** Frames per second */
  frameRate: number;

  /** Optional texture key (for atlas animations) */
  textureKey?: string;

  /** Whether animation loops by default */
  loop?: boolean;

  /** Optional callback when animation completes */
  onComplete?: () => void;
}

/**
 * Configuration for creating animation from a sprite sheet.
 */
export interface SpriteSheetAnimationConfig {
  /** Unique animation key */
  key: string;

  /** Start frame index */
  start: number;

  /** End frame index */
  end: number;

  /** Frames per second */
  frameRate: number;

  /** Texture key */
  textureKey?: string;

  /** Whether animation loops by default */
  loop?: boolean;
}

/**
 * Configuration for creating animation from frame names.
 */
export interface FrameNamesAnimationConfig {
  /** Unique animation key */
  key: string;

  /** Prefix for frame names */
  prefix: string;

  /** Start number */
  start: number;

  /** End number */
  end: number;

  /** Number of digits for padding (e.g., 4 for 0001, 0002) */
  zeroPad?: number;

  /** Suffix for frame names */
  suffix?: string;

  /** Frames per second */
  frameRate: number;

  /** Texture key */
  textureKey?: string;

  /** Whether animation loops by default */
  loop?: boolean;
}

/**
 * AnimationManager stores and manages all animation definitions.
 */
export class AnimationManager {
  /** Map of animation key -> definition */
  private animations: Map<string, AnimationDefinition> = new Map();

  /**
   * Register a new animation with explicit frames.
   */
  registerAnimation(
    key: string,
    frames: AnimationFrame[],
    frameRate: number,
    options?: {
      textureKey?: string;
      loop?: boolean;
      onComplete?: () => void;
    }
  ): AnimationDefinition {
    if (this.animations.has(key)) {
      console.warn(`AnimationManager: Animation '${key}' already exists, overwriting`);
    }

    const definition: AnimationDefinition = {
      key,
      frames,
      frameRate,
      textureKey: options?.textureKey,
      loop: options?.loop ?? true,
      onComplete: options?.onComplete,
    };

    this.animations.set(key, definition);
    return definition;
  }

  /**
   * Create animation from sprite sheet range.
   */
  createFromSpriteSheet(config: SpriteSheetAnimationConfig): AnimationDefinition {
    const frames: number[] = [];

    // Generate frame indices
    for (let i = config.start; i <= config.end; i++) {
      frames.push(i);
    }

    return this.registerAnimation(config.key, frames, config.frameRate, {
      textureKey: config.textureKey,
      loop: config.loop,
    });
  }

  /**
   * Create animation from frame names (e.g., "walk_0001", "walk_0002").
   */
  createFromFrameNames(config: FrameNamesAnimationConfig): AnimationDefinition {
    const frames: string[] = [];
    const zeroPad = config.zeroPad ?? 0;
    const suffix = config.suffix ?? '';

    // Generate frame names
    for (let i = config.start; i <= config.end; i++) {
      const frameNumber = zeroPad > 0 ? String(i).padStart(zeroPad, '0') : String(i);
      frames.push(`${config.prefix}${frameNumber}${suffix}`);
    }

    return this.registerAnimation(config.key, frames, config.frameRate, {
      textureKey: config.textureKey,
      loop: config.loop,
    });
  }

  /**
   * Create animation with custom frame order.
   */
  createCustom(
    key: string,
    frames: AnimationFrame[],
    frameRate: number,
    loop: boolean = true
  ): AnimationDefinition {
    return this.registerAnimation(key, frames, frameRate, { loop });
  }

  /**
   * Get animation definition by key.
   */
  getAnimation(key: string): AnimationDefinition | undefined {
    return this.animations.get(key);
  }

  /**
   * Check if animation exists.
   */
  hasAnimation(key: string): boolean {
    return this.animations.has(key);
  }

  /**
   * Remove animation by key.
   */
  removeAnimation(key: string): boolean {
    return this.animations.delete(key);
  }

  /**
   * Get all animation keys.
   */
  getAnimationKeys(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Get total duration of animation in seconds.
   */
  getAnimationDuration(key: string): number {
    const anim = this.animations.get(key);
    if (!anim) return 0;
    return anim.frames.length / anim.frameRate;
  }

  /**
   * Get frame count for animation.
   */
  getFrameCount(key: string): number {
    const anim = this.animations.get(key);
    return anim?.frames.length ?? 0;
  }

  /**
   * Clone an animation with a new key.
   */
  cloneAnimation(sourceKey: string, newKey: string): AnimationDefinition | undefined {
    const source = this.animations.get(sourceKey);
    if (!source) {
      console.warn(`AnimationManager: Source animation '${sourceKey}' not found`);
      return undefined;
    }

    return this.registerAnimation(newKey, [...source.frames], source.frameRate, {
      textureKey: source.textureKey,
      loop: source.loop,
      onComplete: source.onComplete,
    });
  }

  /**
   * Create a reversed version of an animation.
   */
  createReversed(sourceKey: string, newKey: string): AnimationDefinition | undefined {
    const source = this.animations.get(sourceKey);
    if (!source) {
      console.warn(`AnimationManager: Source animation '${sourceKey}' not found`);
      return undefined;
    }

    return this.registerAnimation(newKey, [...source.frames].reverse(), source.frameRate, {
      textureKey: source.textureKey,
      loop: source.loop,
    });
  }

  /**
   * Create a ping-pong (forward + backward) animation.
   */
  createPingPong(sourceKey: string, newKey: string): AnimationDefinition | undefined {
    const source = this.animations.get(sourceKey);
    if (!source) {
      console.warn(`AnimationManager: Source animation '${sourceKey}' not found`);
      return undefined;
    }

    const reversedFrames = [...source.frames].reverse().slice(1, -1);
    const pingPongFrames = [...source.frames, ...reversedFrames];

    return this.registerAnimation(newKey, pingPongFrames, source.frameRate, {
      textureKey: source.textureKey,
      loop: source.loop,
    });
  }

  /**
   * Batch register multiple animations.
   */
  registerBatch(
    animations: Array<{
      key: string;
      frames: AnimationFrame[];
      frameRate: number;
      loop?: boolean;
    }>
  ): void {
    for (const anim of animations) {
      this.registerAnimation(anim.key, anim.frames, anim.frameRate, {
        loop: anim.loop,
      });
    }
  }

  /**
   * Clear all animations.
   */
  clear(): void {
    this.animations.clear();
  }

  /**
   * Get total number of registered animations.
   */
  get count(): number {
    return this.animations.size;
  }

  /**
   * Export all animations as JSON (for debugging/saving).
   */
  exportToJSON(): string {
    const data: Record<string, Omit<AnimationDefinition, 'onComplete'>> = {};

    this.animations.forEach((anim, key) => {
      data[key] = {
        key: anim.key,
        frames: anim.frames,
        frameRate: anim.frameRate,
        textureKey: anim.textureKey,
        loop: anim.loop,
      };
    });

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import animations from JSON.
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as Record<string, Omit<AnimationDefinition, 'onComplete'>>;

      for (const [key, anim] of Object.entries(data)) {
        this.registerAnimation(key, anim.frames, anim.frameRate, {
          textureKey: anim.textureKey,
          loop: anim.loop,
        });
      }
    } catch (error) {
      console.error('AnimationManager: Failed to import from JSON', error);
    }
  }
}
