/**
 * Renderer implementation for Cosmic Survivors.
 * Uses Phaser 4 as the rendering backend.
 */

import * as Phaser from 'phaser';
import type {
  IRenderer,
  ICamera,
  ISpriteConfig,
  IParticleConfig,
  IParticleEmitter,
  RenderLayer,
  BlendMode
} from '../shared/interfaces/IRenderer';
import type { EntityId } from '../shared/interfaces/IWorld';
import { Camera } from './Camera';

/**
 * Sprite entry in the renderer's sprite map.
 */
interface SpriteEntry {
  sprite: Phaser.GameObjects.Sprite;
  config: ISpriteConfig;
  layer: RenderLayer;
}

/**
 * Particle emitter wrapper.
 */
class ParticleEmitterWrapper implements IParticleEmitter {
  readonly id: string;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private _active: boolean = true;

  constructor(id: string, emitter: Phaser.GameObjects.Particles.ParticleEmitter) {
    this.id = id;
    this.emitter = emitter;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    this._active = value;
    if (value) {
      this.emitter.start();
    } else {
      this.emitter.stop();
    }
  }

  start(): void {
    this._active = true;
    this.emitter.start();
  }

  stop(): void {
    this._active = false;
    this.emitter.stop();
  }

  explode(count: number): void {
    this.emitter.explode(count);
  }

  setPosition(x: number, y: number): void {
    this.emitter.setPosition(x, y);
  }

  destroy(): void {
    this.emitter.destroy();
  }
}

/**
 * Map Phaser blend modes to our BlendMode enum.
 */
function toPhaserBlendMode(blendMode: BlendMode | undefined): Phaser.BlendModes {
  switch (blendMode) {
    case 'add':
      return Phaser.BlendModes.ADD;
    case 'multiply':
      return Phaser.BlendModes.MULTIPLY;
    case 'screen':
      return Phaser.BlendModes.SCREEN;
    case 'normal':
    default:
      return Phaser.BlendModes.NORMAL;
  }
}

/**
 * Renderer class implementing IRenderer interface.
 * Manages all rendering through Phaser 4.
 */
export class Renderer implements IRenderer {
  /** Phaser game instance */
  private game: Phaser.Game | null = null;

  /** Main scene for rendering */
  private scene: Phaser.Scene | null = null;

  /** Camera instance */
  private _camera: Camera;

  /** Canvas element */
  private _canvas: HTMLCanvasElement | null = null;

  /** Sprite map: entity ID -> sprite entry */
  private sprites: Map<EntityId, SpriteEntry> = new Map();

  /** Layer containers for z-ordering */
  private layerContainers: Map<RenderLayer, Phaser.GameObjects.Container> = new Map();

  /** Particle emitters */
  private particleEmitters: Map<string, ParticleEmitterWrapper> = new Map();

  /** Emitter ID counter */
  private emitterIdCounter: number = 0;

  /** FPS tracking */
  private _fps: number = 60;
  private fpsUpdateTime: number = 0;
  private frameCount: number = 0;

  /** Whether using WebGPU */
  private _isWebGPU: boolean = false;

  /** Renderer configuration */
  private config: {
    width: number;
    height: number;
    parent: HTMLElement | string;
    backgroundColor: number;
  };

  constructor(config: {
    width: number;
    height: number;
    parent: HTMLElement | string;
    backgroundColor?: number;
  }) {
    this.config = {
      width: config.width,
      height: config.height,
      parent: config.parent,
      backgroundColor: config.backgroundColor ?? 0x000000,
    };

    this._camera = new Camera(config.width, config.height);
  }

  // ============================================
  // IRenderer Properties
  // ============================================

  get camera(): ICamera {
    return this._camera;
  }

  get isWebGPU(): boolean {
    return this._isWebGPU;
  }

  get canvas(): HTMLCanvasElement {
    if (!this._canvas) {
      throw new Error('Renderer not initialized. Call init() first.');
    }
    return this._canvas;
  }

  get fps(): number {
    return this._fps;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize the renderer.
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const self = this;

      class MainScene extends Phaser.Scene {
        constructor() {
          super({ key: 'MainScene' });
        }

        create(): void {
          // Store scene reference
          self.scene = this;

          // Set up camera
          self._camera.setPhaserCamera(this.cameras.main);

          // Create layer containers
          self.createLayerContainers();

          // Resolve initialization
          resolve();
        }
      }

      const gameConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: this.config.width,
        height: this.config.height,
        parent: this.config.parent,
        backgroundColor: this.config.backgroundColor,
        scene: MainScene,
        physics: {
          default: 'arcade',
          arcade: {
            debug: false,
          },
        },
        render: {
          antialias: true,
          pixelArt: false,
          roundPixels: false,
        },
        scale: {
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.NO_CENTER,
        },
      };

      try {
        this.game = new Phaser.Game(gameConfig);
        this._canvas = this.game.canvas;
        this._isWebGPU = this.game.renderer.type === Phaser.WEBGL;
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create layer containers for z-ordering.
   */
  private createLayerContainers(): void {
    if (!this.scene) return;

    // Import RenderLayer values
    const layers = [0, 10, 20, 30, 50, 60, 70, 80, 100, 110];

    for (const layer of layers) {
      const container = this.scene.add.container(0, 0);
      container.setDepth(layer);
      this.layerContainers.set(layer as RenderLayer, container);
    }
  }

  /**
   * Get layer container, creating if needed.
   */
  private getLayerContainer(layer: RenderLayer): Phaser.GameObjects.Container {
    let container = this.layerContainers.get(layer);
    if (!container && this.scene) {
      container = this.scene.add.container(0, 0);
      container.setDepth(layer);
      this.layerContainers.set(layer, container);
    }
    return container!;
  }

  // ============================================
  // Sprite Management
  // ============================================

  /**
   * Create a sprite for an entity.
   */
  createSprite(entity: EntityId, config: ISpriteConfig): void {
    if (!this.scene) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    // Remove existing sprite if any
    if (this.sprites.has(entity)) {
      this.removeSprite(entity);
    }

    // Create Phaser sprite
    const sprite = this.scene.add.sprite(0, 0, config.key, config.frame);

    // Apply configuration
    this.applyConfigToSprite(sprite, config);

    // Add to appropriate layer container
    const layer = config.layer ?? 50; // Default to Entities layer
    const container = this.getLayerContainer(layer);
    container.add(sprite);

    // Store sprite entry
    this.sprites.set(entity, {
      sprite,
      config: { ...config },
      layer,
    });
  }

  /**
   * Update sprite properties.
   */
  updateSprite(entity: EntityId, config: Partial<ISpriteConfig>): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Merge config
    Object.assign(entry.config, config);

    // Apply changes
    this.applyConfigToSprite(entry.sprite, entry.config);

    // Handle layer change
    if (config.layer !== undefined && config.layer !== entry.layer) {
      // Remove from old container
      const oldContainer = this.layerContainers.get(entry.layer);
      if (oldContainer) {
        oldContainer.remove(entry.sprite);
      }

      // Add to new container
      const newContainer = this.getLayerContainer(config.layer);
      newContainer.add(entry.sprite);

      entry.layer = config.layer;
    }
  }

  /**
   * Remove sprite for entity.
   */
  removeSprite(entity: EntityId): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    // Remove from container
    const container = this.layerContainers.get(entry.layer);
    if (container) {
      container.remove(entry.sprite);
    }

    // Destroy sprite
    entry.sprite.destroy();

    // Remove from map
    this.sprites.delete(entity);
  }

  /**
   * Apply ISpriteConfig to Phaser sprite.
   */
  private applyConfigToSprite(sprite: Phaser.GameObjects.Sprite, config: ISpriteConfig): void {
    // Size
    if (config.width !== undefined && config.height !== undefined) {
      sprite.setDisplaySize(config.width, config.height);
    } else if (config.scale !== undefined) {
      sprite.setScale(config.scale);
    }

    // Origin
    sprite.setOrigin(config.originX ?? 0.5, config.originY ?? 0.5);

    // Tint
    if (config.tint !== undefined) {
      sprite.setTint(config.tint);
    } else {
      sprite.clearTint();
    }

    // Alpha
    sprite.setAlpha(config.alpha ?? 1);

    // Rotation
    if (config.rotation !== undefined) {
      sprite.setRotation(config.rotation);
    }

    // Flip
    sprite.setFlipX(config.flipX ?? false);
    sprite.setFlipY(config.flipY ?? false);

    // Blend mode
    if (config.blendMode !== undefined) {
      sprite.setBlendMode(toPhaserBlendMode(config.blendMode));
    }
  }

  // ============================================
  // Animation
  // ============================================

  /**
   * Play animation on entity's sprite.
   */
  playAnimation(entity: EntityId, animKey: string, loop: boolean = true): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    entry.sprite.play({
      key: animKey,
      repeat: loop ? -1 : 0,
    });
  }

  /**
   * Stop animation.
   */
  stopAnimation(entity: EntityId): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    entry.sprite.stop();
  }

  // ============================================
  // Particles
  // ============================================

  /**
   * Create particle emitter.
   */
  createParticles(config: IParticleConfig): IParticleEmitter {
    if (!this.scene) {
      throw new Error('Renderer not initialized. Call init() first.');
    }

    const id = `emitter_${++this.emitterIdCounter}`;

    // Create emitter configuration
    const emitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      x: config.x,
      y: config.y,
      quantity: config.quantity ?? 1,
      frequency: config.frequency ?? 100,
      lifespan: config.lifespan ?? 1000,
      speed: config.speed ?? { min: 50, max: 100 },
      angle: config.angle ?? { min: 0, max: 360 },
      scale: config.scale ? { start: config.scale.start, end: config.scale.end } : undefined,
      alpha: config.alpha ? { start: config.alpha.start, end: config.alpha.end } : undefined,
      tint: config.tint,
      blendMode: toPhaserBlendMode(config.blendMode),
      gravityX: config.gravityX ?? 0,
      gravityY: config.gravityY ?? 0,
    };

    // Create particle emitter
    const emitter = this.scene.add.particles(config.x, config.y, config.key, emitterConfig);

    // Get the actual emitter from the particle manager
    const wrapper = new ParticleEmitterWrapper(id, emitter as unknown as Phaser.GameObjects.Particles.ParticleEmitter);
    this.particleEmitters.set(id, wrapper);

    return wrapper;
  }

  // ============================================
  // Effects
  // ============================================

  /**
   * Screen shake effect.
   */
  screenShake(intensity: number, duration: number): void {
    this._camera.shake(intensity, duration);
  }

  /**
   * Flash entity sprite.
   */
  flashSprite(entity: EntityId, color: number, duration: number): void {
    const entry = this.sprites.get(entity);
    if (!entry || !this.scene) return;

    // Create flash effect using tint and tween
    const originalTint = entry.config.tint;
    entry.sprite.setTint(color);

    this.scene.tweens.add({
      targets: entry.sprite,
      alpha: { from: 1, to: 0.5 },
      duration: duration * 500,
      yoyo: true,
      onComplete: () => {
        if (originalTint !== undefined) {
          entry.sprite.setTint(originalTint);
        } else {
          entry.sprite.clearTint();
        }
      },
    });
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Render current frame.
   * Called automatically by Phaser's game loop.
   */
  render(): void {
    // Update camera
    const dt = this.game?.loop.delta ? this.game.loop.delta / 1000 : 1 / 60;
    this._camera.update(dt);

    // Update FPS
    this.updateFPS(dt);
  }

  /**
   * Update FPS tracking.
   */
  private updateFPS(dt: number): void {
    this.frameCount++;
    this.fpsUpdateTime += dt;

    if (this.fpsUpdateTime >= 1) {
      this._fps = Math.round(this.frameCount / this.fpsUpdateTime);
      this.frameCount = 0;
      this.fpsUpdateTime = 0;
    }
  }

  /**
   * Resize renderer to new dimensions.
   */
  resize(width: number, height: number): void {
    if (!this.game) return;

    this.game.scale.resize(width, height);
    this._camera.resize(width, height);
  }

  /**
   * Clean up renderer resources.
   */
  destroy(): void {
    // Destroy all sprites
    this.sprites.forEach((_, entity) => {
      this.removeSprite(entity);
    });

    // Destroy all particle emitters
    this.particleEmitters.forEach((emitter) => {
      emitter.destroy();
    });
    this.particleEmitters.clear();

    // Destroy layer containers
    this.layerContainers.forEach((container) => {
      container.destroy();
    });
    this.layerContainers.clear();

    // Destroy Phaser game
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    this.scene = null;
    this._canvas = null;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get Phaser sprite for entity.
   */
  getSprite(entity: EntityId): Phaser.GameObjects.Sprite | null {
    return this.sprites.get(entity)?.sprite ?? null;
  }

  /**
   * Get Phaser scene.
   */
  getScene(): Phaser.Scene | null {
    return this.scene;
  }

  /**
   * Update sprite position (used by SpriteSystem).
   */
  setSpritePosition(entity: EntityId, x: number, y: number): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    entry.sprite.setPosition(x, y);
  }

  /**
   * Update sprite rotation (used by SpriteSystem).
   */
  setSpriteRotation(entity: EntityId, rotation: number): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    entry.sprite.setRotation(rotation);
  }

  /**
   * Update sprite scale (used by SpriteSystem).
   */
  setSpriteScale(entity: EntityId, scaleX: number, scaleY: number): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    entry.sprite.setScale(scaleX, scaleY);
  }

  /**
   * Update sprite frame (used by AnimationSystem).
   */
  setSpriteFrame(entity: EntityId, frame: string | number): void {
    const entry = this.sprites.get(entity);
    if (!entry) return;

    entry.sprite.setFrame(frame);
  }

  /**
   * Check if entity has a sprite.
   */
  hasSprite(entity: EntityId): boolean {
    return this.sprites.has(entity);
  }

  /**
   * Get all entity IDs with sprites.
   */
  getSpriteEntities(): EntityId[] {
    return Array.from(this.sprites.keys());
  }
}
