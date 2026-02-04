import type { EntityId } from './IWorld';

/**
 * Render layer for z-ordering.
 */
export enum RenderLayer {
  Background = 0,
  Floor = 10,
  GroundEffects = 20,
  Shadows = 30,
  Entities = 50,
  Projectiles = 60,
  Effects = 70,
  Particles = 80,
  UI = 100,
  Overlay = 110,
}

/**
 * Sprite configuration.
 */
export interface ISpriteConfig {
  key: string;              // Asset key
  frame?: string | number;  // Animation frame
  width?: number;
  height?: number;
  originX?: number;         // 0-1, default 0.5
  originY?: number;         // 0-1, default 0.5
  tint?: number;            // Color tint
  alpha?: number;           // 0-1
  scale?: number;
  rotation?: number;        // Radians
  flipX?: boolean;
  flipY?: boolean;
  layer?: RenderLayer;
  blendMode?: BlendMode;
}

export enum BlendMode {
  Normal = 'normal',
  Add = 'add',
  Multiply = 'multiply',
  Screen = 'screen',
}

/**
 * Camera interface.
 */
export interface ICamera {
  /** Camera position (center) */
  x: number;
  y: number;

  /** Zoom level (1 = normal) */
  zoom: number;

  /** Rotation in radians */
  rotation: number;

  /** Viewport dimensions */
  readonly width: number;
  readonly height: number;

  /** Follow an entity */
  follow(entity: EntityId, lerp?: number): void;

  /** Stop following */
  stopFollow(): void;

  /** Shake camera */
  shake(intensity: number, duration: number): void;

  /** Flash screen */
  flash(color: number, duration: number): void;

  /** Fade screen */
  fade(color: number, duration: number): Promise<void>;

  /** Convert world position to screen position */
  worldToScreen(x: number, y: number): { x: number; y: number };

  /** Convert screen position to world position */
  screenToWorld(x: number, y: number): { x: number; y: number };

  /** Check if position is visible */
  isVisible(x: number, y: number, margin?: number): boolean;

  /** Get visible bounds */
  getBounds(): { x: number; y: number; width: number; height: number };
}

/**
 * Main renderer interface.
 */
export interface IRenderer {
  /** Main camera */
  readonly camera: ICamera;

  /** Whether WebGPU is available */
  readonly isWebGPU: boolean;

  /** Canvas element */
  readonly canvas: HTMLCanvasElement;

  /** Current FPS */
  readonly fps: number;

  // Sprite Management

  /**
   * Create a sprite for an entity.
   */
  createSprite(entity: EntityId, config: ISpriteConfig): void;

  /**
   * Update sprite properties.
   */
  updateSprite(entity: EntityId, config: Partial<ISpriteConfig>): void;

  /**
   * Remove sprite for entity.
   */
  removeSprite(entity: EntityId): void;

  /**
   * Play animation on entity's sprite.
   */
  playAnimation(entity: EntityId, animKey: string, loop?: boolean): void;

  /**
   * Stop animation.
   */
  stopAnimation(entity: EntityId): void;

  // Effects

  /**
   * Create particle emitter.
   */
  createParticles(config: IParticleConfig): IParticleEmitter;

  /**
   * Screen shake effect.
   */
  screenShake(intensity: number, duration: number): void;

  /**
   * Flash entity sprite.
   */
  flashSprite(entity: EntityId, color: number, duration: number): void;

  // Lifecycle

  /**
   * Render current frame.
   */
  render(): void;

  /**
   * Resize renderer to new dimensions.
   */
  resize(width: number, height: number): void;

  /**
   * Clean up renderer resources.
   */
  destroy(): void;
}

/**
 * Particle emitter configuration.
 */
export interface IParticleConfig {
  key: string;              // Texture key
  x: number;
  y: number;
  quantity?: number;        // Particles per emission
  frequency?: number;       // Ms between emissions (-1 for one-shot)
  lifespan?: number;        // Particle lifetime in ms
  speed?: { min: number; max: number };
  angle?: { min: number; max: number };
  scale?: { start: number; end: number };
  alpha?: { start: number; end: number };
  tint?: number | number[];
  blendMode?: BlendMode;
  gravityX?: number;
  gravityY?: number;
  follow?: EntityId;        // Follow an entity
}

/**
 * Active particle emitter.
 */
export interface IParticleEmitter {
  /** Emitter ID */
  readonly id: string;

  /** Whether emitter is active */
  active: boolean;

  /** Start emitting */
  start(): void;

  /** Stop emitting */
  stop(): void;

  /** Emit specific number of particles */
  explode(count: number): void;

  /** Update position */
  setPosition(x: number, y: number): void;

  /** Destroy emitter */
  destroy(): void;
}
