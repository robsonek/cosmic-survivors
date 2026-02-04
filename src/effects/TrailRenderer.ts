/**
 * TrailRenderer - Renders motion trails behind entities.
 * Used for projectiles, fast-moving objects, and visual effects.
 */

import * as Phaser from 'phaser';
import { Position } from '../shared/types/components';
import type { Renderer } from '../rendering/Renderer';
import { BlendMode } from '../shared/interfaces/IRenderer';

/**
 * Trail configuration.
 */
export interface TrailConfig {
  /** Maximum number of trail points */
  length: number;
  /** Trail width at head */
  width: number;
  /** Trail width at tail (default: 0) */
  tailWidth?: number;
  /** Trail color (hex) */
  color: number;
  /** Secondary color for gradient (optional) */
  colorEnd?: number;
  /** Alpha at head */
  alpha?: number;
  /** Alpha at tail (default: 0) */
  alphaEnd?: number;
  /** Blend mode */
  blendMode?: BlendMode;
  /** Minimum distance between points */
  minDistance?: number;
  /** Trail lifetime in seconds (0 = follow entity) */
  lifetime?: number;
  /** Whether trail fades out when entity stops */
  fadeOnStop?: boolean;
  /** Emit particles along trail */
  emitParticles?: boolean;
}

/**
 * Trail point storing position and metadata.
 */
interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  width: number;
  alpha: number;
}

/**
 * Active trail instance.
 */
interface ActiveTrail {
  entity: number;
  config: TrailConfig;
  points: TrailPoint[];
  graphics: Phaser.GameObjects.Graphics;
  lastX: number;
  lastY: number;
  active: boolean;
  fadeStartTime: number | null;
}

/**
 * Map Phaser blend modes.
 */
function toPhaserBlendMode(blendMode: BlendMode | undefined): Phaser.BlendModes {
  switch (blendMode) {
    case BlendMode.Add:
      return Phaser.BlendModes.ADD;
    case BlendMode.Multiply:
      return Phaser.BlendModes.MULTIPLY;
    case BlendMode.Screen:
      return Phaser.BlendModes.SCREEN;
    default:
      return Phaser.BlendModes.NORMAL;
  }
}

/**
 * TrailRenderer manages motion trails for entities.
 */
export class TrailRenderer {

  /** Scene reference */
  private scene: Phaser.Scene | null = null;

  /** Active trails by entity ID */
  private trails: Map<number, ActiveTrail> = new Map();

  /** Trail graphics container */
  private container: Phaser.GameObjects.Container | null = null;

  /** Default configuration */
  private defaultConfig: TrailConfig = {
    length: 10,
    width: 4,
    tailWidth: 0,
    color: 0xffffff,
    alpha: 1,
    alphaEnd: 0,
    minDistance: 5,
    lifetime: 0,
    fadeOnStop: true,
    emitParticles: false,
  };

  constructor(renderer: Renderer) {
    this.scene = renderer.getScene();
    this.setupContainer();
  }

  /**
   * Set up trail graphics container.
   */
  private setupContainer(): void {
    if (!this.scene) return;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(55); // Between entities and particles
  }

  // ============================================
  // Trail Creation
  // ============================================

  /**
   * Create a trail for an entity.
   */
  createTrail(entity: number, config: Partial<TrailConfig> = {}): void {
    if (!this.scene) return;

    // Remove existing trail
    this.removeTrail(entity);

    const fullConfig: TrailConfig = {
      ...this.defaultConfig,
      ...config,
    };

    // Get initial position
    const x = Position.x[entity] ?? 0;
    const y = Position.y[entity] ?? 0;

    // Create graphics object
    const graphics = this.scene.add.graphics();
    graphics.setBlendMode(toPhaserBlendMode(fullConfig.blendMode));

    if (this.container) {
      this.container.add(graphics);
    }

    // Create trail data
    const trail: ActiveTrail = {
      entity,
      config: fullConfig,
      points: [],
      graphics,
      lastX: x,
      lastY: y,
      active: true,
      fadeStartTime: null,
    };

    this.trails.set(entity, trail);
  }

  /**
   * Create projectile trail preset.
   */
  createProjectileTrail(entity: number, color: number = 0xffff00): void {
    this.createTrail(entity, {
      length: 15,
      width: 3,
      tailWidth: 0,
      color,
      alpha: 0.8,
      alphaEnd: 0,
      blendMode: BlendMode.Add,
      minDistance: 3,
    });
  }

  /**
   * Create energy beam trail.
   */
  createBeamTrail(entity: number, color: number = 0x00ffff): void {
    this.createTrail(entity, {
      length: 20,
      width: 6,
      tailWidth: 2,
      color,
      colorEnd: 0xffffff,
      alpha: 1,
      alphaEnd: 0.2,
      blendMode: BlendMode.Add,
      minDistance: 2,
    });
  }

  /**
   * Create dash trail.
   */
  createDashTrail(entity: number, color: number = 0x88aaff): void {
    this.createTrail(entity, {
      length: 8,
      width: 16,
      tailWidth: 4,
      color,
      alpha: 0.6,
      alphaEnd: 0,
      blendMode: BlendMode.Add,
      minDistance: 8,
      fadeOnStop: true,
    });
  }

  // ============================================
  // Trail Management
  // ============================================

  /**
   * Remove trail for an entity.
   */
  removeTrail(entity: number): void {
    const trail = this.trails.get(entity);
    if (!trail) return;

    trail.graphics.destroy();
    this.trails.delete(entity);
  }

  /**
   * Start fading out a trail.
   */
  fadeOutTrail(entity: number): void {
    const trail = this.trails.get(entity);
    if (!trail) return;

    trail.active = false;
    trail.fadeStartTime = Date.now();
  }

  /**
   * Check if entity has a trail.
   */
  hasTrail(entity: number): boolean {
    return this.trails.has(entity);
  }

  /**
   * Get trail for entity.
   */
  getTrail(entity: number): ActiveTrail | undefined {
    return this.trails.get(entity);
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update all trails.
   */
  update(dt: number): void {
    const now = Date.now();
    const trailsToRemove: number[] = [];

    for (const [entity, trail] of this.trails) {
      if (trail.active) {
        this.updateActiveTrail(trail, dt);
      } else {
        // Fade out trail
        this.updateFadingTrail(trail, now);

        // Remove if fully faded
        if (trail.points.length === 0) {
          trailsToRemove.push(entity);
        }
      }

      // Render trail
      this.renderTrail(trail);
    }

    // Cleanup
    for (const entity of trailsToRemove) {
      this.removeTrail(entity);
    }
  }

  /**
   * Update an active trail following an entity.
   */
  private updateActiveTrail(trail: ActiveTrail, _dt: number): void {
    const x = Position.x[trail.entity];
    const y = Position.y[trail.entity];

    if (x === undefined || y === undefined) {
      // Entity no longer exists
      trail.active = false;
      return;
    }

    // Check distance from last point
    const dx = x - trail.lastX;
    const dy = y - trail.lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const minDistance = trail.config.minDistance ?? 5;

    if (distance >= minDistance) {
      // Add new point
      trail.points.unshift({
        x,
        y,
        timestamp: Date.now(),
        width: trail.config.width,
        alpha: trail.config.alpha ?? 1,
      });

      trail.lastX = x;
      trail.lastY = y;

      // Limit points
      while (trail.points.length > trail.config.length) {
        trail.points.pop();
      }
    }

    // Update point properties based on position in trail
    for (let i = 0; i < trail.points.length; i++) {
      const t = i / Math.max(1, trail.points.length - 1);
      const point = trail.points[i];

      // Interpolate width
      const tailWidth = trail.config.tailWidth ?? 0;
      point.width = trail.config.width + (tailWidth - trail.config.width) * t;

      // Interpolate alpha
      const alphaEnd = trail.config.alphaEnd ?? 0;
      const alphaStart = trail.config.alpha ?? 1;
      point.alpha = alphaStart + (alphaEnd - alphaStart) * t;
    }
  }

  /**
   * Update a fading trail.
   */
  private updateFadingTrail(trail: ActiveTrail, now: number): void {
    const fadeTime = 500; // ms to fade

    if (trail.fadeStartTime) {
      const elapsed = now - trail.fadeStartTime;
      const progress = Math.min(1, elapsed / fadeTime);

      // Fade all points
      for (const point of trail.points) {
        point.alpha *= 1 - progress * 0.1;
      }

      // Remove fully faded points
      trail.points = trail.points.filter((p) => p.alpha > 0.01);
    }
  }

  /**
   * Render a trail to its graphics object.
   */
  private renderTrail(trail: ActiveTrail): void {
    const graphics = trail.graphics;
    graphics.clear();

    if (trail.points.length < 2) return;

    const config = trail.config;

    // Draw trail segments
    for (let i = 0; i < trail.points.length - 1; i++) {
      const current = trail.points[i];
      const next = trail.points[i + 1];

      // Calculate direction perpendicular to segment
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length < 0.001) continue;

      const nx = -dy / length;
      const ny = dx / length;

      // Calculate quad vertices
      const halfWidth1 = current.width / 2;
      const halfWidth2 = next.width / 2;

      const x1 = current.x + nx * halfWidth1;
      const y1 = current.y + ny * halfWidth1;
      const x2 = current.x - nx * halfWidth1;
      const y2 = current.y - ny * halfWidth1;
      const x3 = next.x - nx * halfWidth2;
      const y3 = next.y - ny * halfWidth2;
      const x4 = next.x + nx * halfWidth2;
      const y4 = next.y + ny * halfWidth2;

      // Interpolate color
      let color = config.color;
      if (config.colorEnd !== undefined) {
        const t = i / Math.max(1, trail.points.length - 2);
        color = this.lerpColor(config.color, config.colorEnd, t);
      }

      // Draw filled quad
      const alpha = (current.alpha + next.alpha) / 2;
      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(x1, y1);
      graphics.lineTo(x2, y2);
      graphics.lineTo(x3, y3);
      graphics.lineTo(x4, y4);
      graphics.closePath();
      graphics.fillPath();
    }
  }

  /**
   * Lerp between two colors.
   */
  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Update all trails for entities.
   */
  updateTrails(dt: number): void {
    this.update(dt);
  }

  /**
   * Get number of active trails.
   */
  getTrailCount(): number {
    return this.trails.size;
  }

  /**
   * Pause all trails.
   */
  pauseAll(): void {
    for (const trail of this.trails.values()) {
      trail.active = false;
    }
  }

  /**
   * Resume all trails.
   */
  resumeAll(): void {
    for (const trail of this.trails.values()) {
      trail.active = true;
      trail.fadeStartTime = null;
    }
  }

  /**
   * Clear all trails.
   */
  clearAll(): void {
    for (const trail of this.trails.values()) {
      trail.graphics.destroy();
    }
    this.trails.clear();
  }

  /**
   * Destroy trail renderer.
   */
  destroy(): void {
    this.clearAll();

    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}
