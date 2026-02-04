/**
 * ParticleSystem - ECS system for managing particle emitters.
 * Handles particle emitter lifecycle and position synchronization.
 */

import { defineQuery, enterQuery, exitQuery, type IWorld } from 'bitecs';
import * as Phaser from 'phaser';
import type { IParticleConfig, IParticleEmitter } from '../shared/interfaces/IRenderer';
import { BlendMode } from '../shared/interfaces/IRenderer';
import { Position, ParticleEmitter } from '../shared/types/components';
import type { Renderer } from '../rendering/Renderer';
import { ParticlePresets, EffectType, getPresetConfig } from './ParticlePresets';

/**
 * Extended emitter wrapper with additional tracking.
 */
interface ManagedEmitter {
  emitter: IParticleEmitter;
  phaserEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  config: IParticleConfig;
  followEntity: number | null;
  autoDestroy: boolean;
  destroyTime: number | null;
  createdAt: number;
}

/**
 * Map Phaser blend modes to our BlendMode enum.
 */
function toPhaserBlendMode(blendMode: BlendMode | undefined): Phaser.BlendModes {
  switch (blendMode) {
    case BlendMode.Add:
      return Phaser.BlendModes.ADD;
    case BlendMode.Multiply:
      return Phaser.BlendModes.MULTIPLY;
    case BlendMode.Screen:
      return Phaser.BlendModes.SCREEN;
    case BlendMode.Normal:
    default:
      return Phaser.BlendModes.NORMAL;
  }
}

/**
 * ParticleSystem manages all particle emitters in the game.
 */
export class ParticleSystem {
  /** Renderer reference (kept for potential future use) */
  private readonly renderer: Renderer;

  /** Active emitters by ID */
  private emitters: Map<string, ManagedEmitter> = new Map();

  /** Emitter ID counter */
  private emitterIdCounter: number = 0;

  /** Query for entities with ParticleEmitter component */
  private particleQuery = defineQuery([Position, ParticleEmitter]);
  private enterParticleQuery = enterQuery(this.particleQuery);
  private exitParticleQuery = exitQuery(this.particleQuery);

  /** Entity emitter map (entity ID -> emitter IDs) */
  private entityEmitters: Map<number, Set<string>> = new Map();

  /** Pending one-shot effects (for cleanup) */
  private pendingCleanup: string[] = [];

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  // ============================================
  // Emitter Creation
  // ============================================

  /**
   * Create a particle emitter with configuration.
   */
  createEmitter(config: IParticleConfig): IParticleEmitter {
    const scene = this.renderer.getScene();
    if (!scene) {
      throw new Error('Renderer scene not initialized');
    }

    const id = `emitter_${++this.emitterIdCounter}`;

    // Create Phaser emitter configuration
    const emitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      x: config.x,
      y: config.y,
      quantity: config.quantity ?? 1,
      frequency: config.frequency ?? 100,
      lifespan: config.lifespan ?? 1000,
      speed: config.speed ?? { min: 50, max: 100 },
      angle: config.angle ?? { min: 0, max: 360 },
      scale: config.scale
        ? { start: config.scale.start, end: config.scale.end }
        : undefined,
      alpha: config.alpha
        ? { start: config.alpha.start, end: config.alpha.end }
        : undefined,
      tint: config.tint,
      blendMode: toPhaserBlendMode(config.blendMode),
      gravityX: config.gravityX ?? 0,
      gravityY: config.gravityY ?? 0,
    };

    // Create particle manager and emitter
    const particles = scene.add.particles(config.x, config.y, config.key, emitterConfig);

    // Get the emitter
    const phaserEmitter = particles as unknown as Phaser.GameObjects.Particles.ParticleEmitter;

    // Create wrapper
    const wrapper: IParticleEmitter = {
      id,
      active: true,
      start: () => {
        phaserEmitter.start();
      },
      stop: () => {
        phaserEmitter.stop();
      },
      explode: (count: number) => {
        phaserEmitter.explode(count);
      },
      setPosition: (x: number, y: number) => {
        phaserEmitter.setPosition(x, y);
      },
      destroy: () => {
        this.destroyEmitter(id);
      },
    };

    // Store managed emitter
    this.emitters.set(id, {
      emitter: wrapper,
      phaserEmitter,
      config,
      followEntity: config.follow ?? null,
      autoDestroy: false,
      destroyTime: null,
      createdAt: Date.now(),
    });

    // Track entity emitters
    if (config.follow !== undefined) {
      let entitySet = this.entityEmitters.get(config.follow);
      if (!entitySet) {
        entitySet = new Set();
        this.entityEmitters.set(config.follow, entitySet);
      }
      entitySet.add(id);
    }

    return wrapper;
  }

  /**
   * Create a one-shot effect from a preset.
   */
  playPresetEffect(
    type: EffectType,
    x: number,
    y: number,
    _options?: {
      scale?: number;
      tint?: number;
      rotation?: number;
    }
  ): IParticleEmitter {
    const preset = ParticlePresets[type];
    const config = getPresetConfig(type, x, y);

    const emitter = this.createEmitter(config);
    const managed = this.emitters.get(emitter.id);

    if (managed && preset.oneShot) {
      // Set up auto-destroy for one-shot effects
      managed.autoDestroy = true;
      managed.destroyTime = Date.now() + (preset.duration ?? 1000);

      // Explode immediately
      managed.phaserEmitter.explode(config.quantity ?? 10);
    }

    return emitter;
  }

  /**
   * Create an emitter attached to an entity.
   */
  createEntityEmitter(
    entity: number,
    config: Omit<IParticleConfig, 'x' | 'y' | 'follow'>
  ): IParticleEmitter {
    const x = Position.x[entity] ?? 0;
    const y = Position.y[entity] ?? 0;

    const fullConfig: IParticleConfig = {
      ...config,
      x,
      y,
      follow: entity,
    };

    return this.createEmitter(fullConfig);
  }

  // ============================================
  // Emitter Management
  // ============================================

  /**
   * Destroy an emitter by ID.
   */
  destroyEmitter(id: string): void {
    const managed = this.emitters.get(id);
    if (!managed) return;

    // Remove from entity tracking
    if (managed.followEntity !== null) {
      const entitySet = this.entityEmitters.get(managed.followEntity);
      if (entitySet) {
        entitySet.delete(id);
        if (entitySet.size === 0) {
          this.entityEmitters.delete(managed.followEntity);
        }
      }
    }

    // Destroy Phaser emitter
    managed.phaserEmitter.destroy();

    // Remove from map
    this.emitters.delete(id);
  }

  /**
   * Destroy all emitters for an entity.
   */
  destroyEntityEmitters(entity: number): void {
    const entitySet = this.entityEmitters.get(entity);
    if (!entitySet) return;

    // Copy to avoid modification during iteration
    const emitterIds = Array.from(entitySet);
    for (const id of emitterIds) {
      this.destroyEmitter(id);
    }
  }

  /**
   * Get emitter by ID.
   */
  getEmitter(id: string): IParticleEmitter | null {
    return this.emitters.get(id)?.emitter ?? null;
  }

  /**
   * Get all emitters for an entity.
   */
  getEntityEmitters(entity: number): IParticleEmitter[] {
    const entitySet = this.entityEmitters.get(entity);
    if (!entitySet) return [];

    return Array.from(entitySet)
      .map((id) => this.emitters.get(id)?.emitter)
      .filter((e): e is IParticleEmitter => e !== undefined);
  }

  // ============================================
  // ECS Integration
  // ============================================

  /**
   * Update system - processes ECS queries and updates emitter positions.
   */
  update(world: IWorld, _dt: number): void {
    const now = Date.now();

    // Handle entities that just got ParticleEmitter component
    const entered = this.enterParticleQuery(world);
    for (const _entity of entered) {
      // Component-based emitters would need a registry mapping emitterId to preset
      // Example: const emitterId = ParticleEmitter.emitterId[entity];
      // For now, we assume emitters are created via the API
    }

    // Handle entities that just lost ParticleEmitter component
    const exited = this.exitParticleQuery(world);
    for (const entity of exited) {
      this.destroyEntityEmitters(entity);
    }

    // Update positions of emitters following entities
    for (const [id, managed] of this.emitters) {
      if (managed.followEntity !== null) {
        const x = Position.x[managed.followEntity];
        const y = Position.y[managed.followEntity];

        if (x !== undefined && y !== undefined) {
          const offsetX = managed.config.x ?? 0;
          const offsetY = managed.config.y ?? 0;
          managed.phaserEmitter.setPosition(x + offsetX, y + offsetY);
        }
      }

      // Check for auto-destroy
      if (managed.autoDestroy && managed.destroyTime !== null) {
        if (now >= managed.destroyTime) {
          this.pendingCleanup.push(id);
        }
      }
    }

    // Cleanup expired emitters
    for (const id of this.pendingCleanup) {
      this.destroyEmitter(id);
    }
    this.pendingCleanup.length = 0;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Pause all emitters.
   */
  pauseAll(): void {
    for (const managed of this.emitters.values()) {
      managed.phaserEmitter.pause();
    }
  }

  /**
   * Resume all emitters.
   */
  resumeAll(): void {
    for (const managed of this.emitters.values()) {
      managed.phaserEmitter.resume();
    }
  }

  /**
   * Stop all emitters.
   */
  stopAll(): void {
    for (const managed of this.emitters.values()) {
      managed.phaserEmitter.stop();
    }
  }

  /**
   * Destroy all emitters.
   */
  destroyAll(): void {
    const ids = Array.from(this.emitters.keys());
    for (const id of ids) {
      this.destroyEmitter(id);
    }
  }

  /**
   * Get active emitter count.
   */
  getEmitterCount(): number {
    return this.emitters.size;
  }

  /**
   * Get approximate particle count (sum of all emitters).
   */
  getParticleCount(): number {
    let count = 0;
    for (const managed of this.emitters.values()) {
      count += managed.phaserEmitter.getParticleCount?.() ?? 0;
    }
    return count;
  }

  /**
   * Clean up system resources.
   */
  destroy(): void {
    this.destroyAll();
    this.entityEmitters.clear();
  }
}
