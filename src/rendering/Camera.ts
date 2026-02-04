/**
 * Camera implementation for Cosmic Survivors.
 * Provides smooth follow, screen shake, flash, and fade effects.
 */

import * as Phaser from 'phaser';
import type { ICamera } from '../shared/interfaces/IRenderer';
import type { EntityId } from '../shared/interfaces/IWorld';
import { Position } from '../shared/types/components';

/**
 * Shake state for perlin-like noise effect.
 */
interface ShakeState {
  intensity: number;
  duration: number;
  elapsed: number;
  offsetX: number;
  offsetY: number;
  seed: number;
}

/**
 * Flash effect state.
 */
interface FlashState {
  color: number;
  duration: number;
  elapsed: number;
  alpha: number;
}

/**
 * Fade effect state.
 */
interface FadeState {
  color: number;
  duration: number;
  elapsed: number;
  fadeIn: boolean;
  resolve: (() => void) | null;
}

/**
 * Camera class implementing ICamera interface.
 * Handles camera positioning, smooth follow, and visual effects.
 */
export class Camera implements ICamera {
  /** Camera position (center) */
  private _x: number = 0;
  private _y: number = 0;

  /** Zoom level */
  private _zoom: number = 1;

  /** Rotation in radians */
  private _rotation: number = 0;

  /** Viewport dimensions */
  private _width: number;
  private _height: number;

  /** Follow state */
  private followEntity: EntityId | null = null;
  private followLerp: number = 0.1;

  /** Effect states */
  private shakeState: ShakeState | null = null;
  private flashState: FlashState | null = null;
  private fadeState: FadeState | null = null;

  /** Reference to ECS world for getting entity positions */
  private world: { raw: object } | null = null;

  /** Phaser camera reference (set by Renderer) */
  private phaserCamera: Phaser.Cameras.Scene2D.Camera | null = null;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
  }

  // ============================================
  // ICamera Properties
  // ============================================

  get x(): number {
    return this._x + (this.shakeState?.offsetX ?? 0);
  }

  set x(value: number) {
    this._x = value;
    this.syncPhaserCamera();
  }

  get y(): number {
    return this._y + (this.shakeState?.offsetY ?? 0);
  }

  set y(value: number) {
    this._y = value;
    this.syncPhaserCamera();
  }

  get zoom(): number {
    return this._zoom;
  }

  set zoom(value: number) {
    this._zoom = Math.max(0.1, Math.min(10, value));
    this.syncPhaserCamera();
  }

  get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
    this.syncPhaserCamera();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  // ============================================
  // Setup Methods
  // ============================================

  /**
   * Set reference to ECS world for entity position lookups.
   */
  setWorld(world: { raw: object }): void {
    this.world = world;
  }

  /**
   * Set Phaser camera reference.
   */
  setPhaserCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.phaserCamera = camera;
    this.syncPhaserCamera();
  }

  /**
   * Sync state to Phaser camera.
   */
  private syncPhaserCamera(): void {
    if (!this.phaserCamera) return;

    this.phaserCamera.setScroll(
      this._x - this._width / 2 + (this.shakeState?.offsetX ?? 0),
      this._y - this._height / 2 + (this.shakeState?.offsetY ?? 0)
    );
    this.phaserCamera.setZoom(this._zoom);
    this.phaserCamera.setRotation(this._rotation);
  }

  // ============================================
  // Follow Methods
  // ============================================

  /**
   * Follow an entity with smooth interpolation.
   */
  follow(entity: EntityId, lerp: number = 0.1): void {
    this.followEntity = entity;
    this.followLerp = Math.max(0, Math.min(1, lerp));
  }

  /**
   * Stop following entity.
   */
  stopFollow(): void {
    this.followEntity = null;
  }

  // ============================================
  // Effect Methods
  // ============================================

  /**
   * Shake the camera with perlin-like noise.
   */
  shake(intensity: number, duration: number): void {
    this.shakeState = {
      intensity,
      duration,
      elapsed: 0,
      offsetX: 0,
      offsetY: 0,
      seed: Math.random() * 1000,
    };
  }

  /**
   * Flash the screen with a color.
   */
  flash(color: number, duration: number): void {
    this.flashState = {
      color,
      duration,
      elapsed: 0,
      alpha: 1,
    };

    if (this.phaserCamera) {
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      this.phaserCamera.flash(duration * 1000, r, g, b);
    }
  }

  /**
   * Fade the screen to a color.
   */
  fade(color: number, duration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.fadeState = {
        color,
        duration,
        elapsed: 0,
        fadeIn: false,
        resolve,
      };

      if (this.phaserCamera) {
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        this.phaserCamera.fade(duration * 1000, r, g, b, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress >= 1) {
            resolve();
          }
        });
      } else {
        // If no Phaser camera, resolve after duration
        setTimeout(resolve, duration * 1000);
      }
    });
  }

  // ============================================
  // Coordinate Transformation
  // ============================================

  /**
   * Convert world position to screen position.
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const cos = Math.cos(-this._rotation);
    const sin = Math.sin(-this._rotation);

    // Translate relative to camera
    let dx = worldX - this._x;
    let dy = worldY - this._y;

    // Apply rotation
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    // Apply zoom and center on screen
    return {
      x: rotatedX * this._zoom + this._width / 2,
      y: rotatedY * this._zoom + this._height / 2,
    };
  }

  /**
   * Convert screen position to world position.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Remove screen center offset and zoom
    const dx = (screenX - this._width / 2) / this._zoom;
    const dy = (screenY - this._height / 2) / this._zoom;

    // Apply inverse rotation
    const cos = Math.cos(this._rotation);
    const sin = Math.sin(this._rotation);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    // Translate back to world space
    return {
      x: rotatedX + this._x,
      y: rotatedY + this._y,
    };
  }

  /**
   * Check if a world position is visible on screen.
   */
  isVisible(worldX: number, worldY: number, margin: number = 0): boolean {
    const screen = this.worldToScreen(worldX, worldY);
    return (
      screen.x >= -margin &&
      screen.x <= this._width + margin &&
      screen.y >= -margin &&
      screen.y <= this._height + margin
    );
  }

  /**
   * Get the visible world bounds.
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    const halfWidth = (this._width / this._zoom) / 2;
    const halfHeight = (this._height / this._zoom) / 2;

    // For rotated camera, we need to calculate the bounding box
    if (Math.abs(this._rotation) > 0.001) {
      const cos = Math.abs(Math.cos(this._rotation));
      const sin = Math.abs(Math.sin(this._rotation));
      const rotatedHalfWidth = halfWidth * cos + halfHeight * sin;
      const rotatedHalfHeight = halfWidth * sin + halfHeight * cos;

      return {
        x: this._x - rotatedHalfWidth,
        y: this._y - rotatedHalfHeight,
        width: rotatedHalfWidth * 2,
        height: rotatedHalfHeight * 2,
      };
    }

    return {
      x: this._x - halfWidth,
      y: this._y - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    };
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update camera state (called each frame).
   */
  update(dt: number): void {
    this.updateFollow(dt);
    this.updateShake(dt);
    this.updateFlash(dt);
    this.updateFade(dt);
  }

  /**
   * Update smooth follow.
   */
  private updateFollow(dt: number): void {
    if (this.followEntity === null || !this.world) return;

    // Get entity position from ECS
    const entityX = Position.x[this.followEntity];
    const entityY = Position.y[this.followEntity];

    if (entityX === undefined || entityY === undefined) {
      // Entity no longer exists
      this.followEntity = null;
      return;
    }

    // Lerp towards entity position
    const lerpFactor = 1 - Math.pow(1 - this.followLerp, dt * 60);
    this._x += (entityX - this._x) * lerpFactor;
    this._y += (entityY - this._y) * lerpFactor;
    this.syncPhaserCamera();
  }

  /**
   * Update screen shake effect.
   */
  private updateShake(dt: number): void {
    if (!this.shakeState) return;

    this.shakeState.elapsed += dt;

    if (this.shakeState.elapsed >= this.shakeState.duration) {
      this.shakeState = null;
      this.syncPhaserCamera();
      return;
    }

    // Calculate shake intensity falloff
    const progress = this.shakeState.elapsed / this.shakeState.duration;
    const currentIntensity = this.shakeState.intensity * (1 - progress);

    // Generate perlin-like noise using multiple sine waves
    const time = this.shakeState.elapsed * 10 + this.shakeState.seed;
    this.shakeState.offsetX = this.perlinNoise(time, 0) * currentIntensity;
    this.shakeState.offsetY = this.perlinNoise(time, 100) * currentIntensity;

    this.syncPhaserCamera();
  }

  /**
   * Simple perlin-like noise using multiple sine waves.
   */
  private perlinNoise(x: number, offset: number): number {
    return (
      Math.sin(x * 1.0 + offset) * 0.5 +
      Math.sin(x * 2.3 + offset + 50) * 0.3 +
      Math.sin(x * 4.1 + offset + 25) * 0.2
    );
  }

  /**
   * Update flash effect.
   */
  private updateFlash(dt: number): void {
    if (!this.flashState) return;

    this.flashState.elapsed += dt;

    if (this.flashState.elapsed >= this.flashState.duration) {
      this.flashState = null;
      return;
    }

    // Calculate alpha falloff
    const progress = this.flashState.elapsed / this.flashState.duration;
    this.flashState.alpha = 1 - progress;
  }

  /**
   * Update fade effect.
   */
  private updateFade(dt: number): void {
    if (!this.fadeState) return;

    this.fadeState.elapsed += dt;

    if (this.fadeState.elapsed >= this.fadeState.duration) {
      if (this.fadeState.resolve) {
        this.fadeState.resolve();
      }
      this.fadeState = null;
    }
  }

  // ============================================
  // Resize
  // ============================================

  /**
   * Resize viewport dimensions.
   */
  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
  }

  // ============================================
  // Effect State Getters (for rendering overlay)
  // ============================================

  /**
   * Get current flash state for overlay rendering.
   */
  getFlashState(): { color: number; alpha: number } | null {
    if (!this.flashState) return null;
    return {
      color: this.flashState.color,
      alpha: this.flashState.alpha,
    };
  }

  /**
   * Get current fade state for overlay rendering.
   */
  getFadeState(): { color: number; progress: number } | null {
    if (!this.fadeState) return null;
    return {
      color: this.fadeState.color,
      progress: this.fadeState.elapsed / this.fadeState.duration,
    };
  }
}
