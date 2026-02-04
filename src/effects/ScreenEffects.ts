/**
 * ScreenEffects - Advanced screen-wide visual effects.
 * Extends basic camera effects with more sophisticated options.
 */

import * as Phaser from 'phaser';
import type { Renderer } from '../rendering/Renderer';
import type { Camera } from '../rendering/Camera';

/**
 * Shake configuration for advanced shake effects.
 */
export interface ShakeConfig {
  intensity: number;
  duration: number;
  frequency?: number;
  easing?: 'linear' | 'easeOut' | 'easeIn' | 'easeInOut';
  direction?: 'both' | 'horizontal' | 'vertical';
}

/**
 * Vignette effect configuration.
 */
export interface VignetteConfig {
  intensity: number;
  duration: number;
  color?: number;
  radius?: number;
  fadeIn?: boolean;
}

/**
 * Chromatic aberration configuration.
 */
export interface ChromaticAberrationConfig {
  intensity: number;
  duration: number;
  angle?: number;
}

/**
 * Slow motion configuration.
 */
export interface SlowMotionConfig {
  factor: number;
  duration: number;
  easeIn?: number;
  easeOut?: number;
}

/**
 * Active effect state.
 */
interface ActiveEffect {
  type: string;
  startTime: number;
  duration: number;
  config: unknown;
  graphics?: Phaser.GameObjects.Graphics;
  shader?: Phaser.GameObjects.Shader;
  resolve?: () => void;
}

/**
 * ScreenEffects manages screen-wide visual effects.
 */
export class ScreenEffects {

  /** Scene reference */
  private scene: Phaser.Scene | null = null;

  /** Camera reference */
  private camera: Camera;

  /** Active effects */
  private activeEffects: Map<string, ActiveEffect> = new Map();

  /** Effect counter for unique IDs */
  private effectIdCounter: number = 0;

  /** Time scale for slow motion */
  private _timeScale: number = 1;
  private targetTimeScale: number = 1;
  private timeScaleTransitionSpeed: number = 0;

  /** Vignette graphics overlay */
  private vignetteGraphics: Phaser.GameObjects.Graphics | null = null;
  private vignetteIntensity: number = 0;
  private vignetteColor: number = 0x000000;
  private vignetteRadius: number = 1.0;

  /** Shake state */
  private shakeState: {
    intensity: number;
    duration: number;
    elapsed: number;
    frequency: number;
    easing: string;
    direction: string;
    offsetX: number;
    offsetY: number;
  } | null = null;

  /** Chromatic aberration state */
  private chromaticState: {
    intensity: number;
    duration: number;
    elapsed: number;
    angle: number;
  } | null = null;

  constructor(renderer: Renderer, camera: Camera) {
    this.camera = camera;
    this.scene = renderer.getScene();
    this.setupOverlays();
  }

  /**
   * Set up overlay graphics for effects.
   */
  private setupOverlays(): void {
    if (!this.scene) return;

    // Create vignette overlay
    this.vignetteGraphics = this.scene.add.graphics();
    this.vignetteGraphics.setDepth(1000);
    this.vignetteGraphics.setScrollFactor(0);
  }

  // ============================================
  // Flash Effects
  // ============================================

  /**
   * Flash the screen with a color.
   */
  flash(color: number, duration: number, intensity: number = 1): void {
    if (!this.scene) return;

    const phaserCamera = this.scene.cameras.main;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Intensity is stored for potential future use
    void intensity;

    phaserCamera.flash(duration, r, g, b, false);

    // Store effect
    const effectId = `flash_${++this.effectIdCounter}`;
    this.activeEffects.set(effectId, {
      type: 'flash',
      startTime: Date.now(),
      duration,
      config: { color, intensity },
    });

    // Auto cleanup
    setTimeout(() => {
      this.activeEffects.delete(effectId);
    }, duration);
  }

  /**
   * Flash screen white (damage flash).
   */
  flashWhite(duration: number = 100): void {
    this.flash(0xffffff, duration, 0.3);
  }

  /**
   * Flash screen red (take damage).
   */
  flashRed(duration: number = 150): void {
    this.flash(0xff0000, duration, 0.4);
  }

  /**
   * Flash screen gold (level up).
   */
  flashGold(duration: number = 200): void {
    this.flash(0xffd700, duration, 0.5);
  }

  // ============================================
  // Shake Effects
  // ============================================

  /**
   * Advanced camera shake with configurable parameters.
   */
  shake(config: ShakeConfig): void {
    const {
      intensity,
      duration,
      frequency = 60,
      easing = 'easeOut',
      direction = 'both',
    } = config;

    this.shakeState = {
      intensity,
      duration: duration / 1000, // Convert to seconds
      elapsed: 0,
      frequency,
      easing,
      direction,
      offsetX: 0,
      offsetY: 0,
    };
  }

  /**
   * Quick shake for impacts.
   */
  impactShake(intensity: number = 5): void {
    this.shake({
      intensity,
      duration: 150,
      frequency: 80,
      easing: 'easeOut',
    });
  }

  /**
   * Heavy shake for explosions.
   */
  explosionShake(intensity: number = 10): void {
    this.shake({
      intensity,
      duration: 300,
      frequency: 60,
      easing: 'easeOut',
    });
  }

  /**
   * Rumble effect (continuous shake).
   */
  rumble(intensity: number, duration: number): void {
    this.shake({
      intensity,
      duration,
      frequency: 40,
      easing: 'linear',
    });
  }

  // ============================================
  // Slow Motion
  // ============================================

  /**
   * Apply slow motion effect.
   */
  slowMotion(config: SlowMotionConfig): Promise<void> {
    return new Promise((resolve) => {
      const { factor, duration, easeIn = 100, easeOut = 100 } = config;

      // Calculate transition speeds
      const totalDuration = easeIn + duration + easeOut;
      this.targetTimeScale = factor;
      this.timeScaleTransitionSpeed = (1 - factor) / (easeIn / 1000);

      const effectId = `slowmo_${++this.effectIdCounter}`;
      this.activeEffects.set(effectId, {
        type: 'slowMotion',
        startTime: Date.now(),
        duration: totalDuration,
        config,
        resolve,
      });

      // Schedule return to normal
      setTimeout(() => {
        this.targetTimeScale = 1;
        this.timeScaleTransitionSpeed = (1 - factor) / (easeOut / 1000);
      }, easeIn + duration);

      // Cleanup
      setTimeout(() => {
        this.activeEffects.delete(effectId);
        this._timeScale = 1;
        resolve();
      }, totalDuration);
    });
  }

  /**
   * Get current time scale.
   */
  get timeScale(): number {
    return this._timeScale;
  }

  /**
   * Hit pause effect (brief slow motion on hit).
   */
  hitPause(duration: number = 50): Promise<void> {
    return this.slowMotion({
      factor: 0.1,
      duration,
      easeIn: 10,
      easeOut: 40,
    });
  }

  // ============================================
  // Vignette Effect
  // ============================================

  /**
   * Show vignette effect.
   */
  vignette(config: VignetteConfig): Promise<void> {
    return new Promise((resolve) => {
      const {
        intensity,
        duration,
        color = 0x000000,
        radius = 0.8,
        fadeIn = true,
      } = config;

      this.vignetteColor = color;
      this.vignetteRadius = radius;

      if (fadeIn) {
        // Animate intensity from 0 to target
        const startIntensity = this.vignetteIntensity;
        const targetIntensity = intensity;
        const effectId = `vignette_${++this.effectIdCounter}`;

        this.activeEffects.set(effectId, {
          type: 'vignette',
          startTime: Date.now(),
          duration,
          config: { startIntensity, targetIntensity },
          resolve,
        });
      } else {
        this.vignetteIntensity = intensity;

        // Schedule fade out
        setTimeout(() => {
          this.vignetteIntensity = 0;
          resolve();
        }, duration);
      }
    });
  }

  /**
   * Low health vignette pulse.
   */
  lowHealthVignette(): void {
    this.vignetteColor = 0xff0000;
    this.vignetteRadius = 0.7;
    // Pulsing handled in update
  }

  /**
   * Clear vignette.
   */
  clearVignette(): void {
    this.vignetteIntensity = 0;
  }

  // ============================================
  // Chromatic Aberration
  // ============================================

  /**
   * Apply chromatic aberration effect.
   * Note: This requires a custom shader for full implementation.
   * This is a simplified version using tint shifting.
   */
  chromaticAberration(config: ChromaticAberrationConfig): Promise<void> {
    return new Promise((resolve) => {
      const { intensity, duration, angle = 0 } = config;

      this.chromaticState = {
        intensity,
        duration: duration / 1000,
        elapsed: 0,
        angle,
      };

      const effectId = `chromatic_${++this.effectIdCounter}`;
      this.activeEffects.set(effectId, {
        type: 'chromatic',
        startTime: Date.now(),
        duration,
        config,
        resolve,
      });

      setTimeout(() => {
        this.chromaticState = null;
        this.activeEffects.delete(effectId);
        resolve();
      }, duration);
    });
  }

  /**
   * Damage chromatic aberration.
   */
  damageChromaticPulse(): Promise<void> {
    return this.chromaticAberration({
      intensity: 0.5,
      duration: 150,
    });
  }

  // ============================================
  // Combination Effects
  // ============================================

  /**
   * Take damage effect (combined flash, shake, vignette).
   */
  takeDamageEffect(intensity: number = 1): void {
    const scaled = Math.min(1, intensity);

    this.flashRed(100 * scaled);
    this.impactShake(3 * scaled);

    if (scaled > 0.5) {
      this.vignette({
        intensity: 0.2 * scaled,
        duration: 200,
        color: 0xff0000,
        radius: 0.8,
        fadeIn: false,
      });
    }
  }

  /**
   * Level up effect (combined flash, shake).
   */
  levelUpEffect(): void {
    this.flashGold(300);
    this.shake({
      intensity: 3,
      duration: 200,
      easing: 'easeOut',
    });
  }

  /**
   * Boss spawn effect.
   */
  bossSpawnEffect(): void {
    this.shake({
      intensity: 8,
      duration: 500,
      frequency: 30,
      easing: 'easeInOut',
    });
    this.flash(0x000000, 100, 0.5);
    this.vignette({
      intensity: 0.4,
      duration: 1000,
      color: 0x330000,
      radius: 0.6,
    });
  }

  /**
   * Death effect.
   */
  deathEffect(): Promise<void> {
    return new Promise((resolve) => {
      this.slowMotion({
        factor: 0.2,
        duration: 500,
        easeIn: 50,
        easeOut: 200,
      });

      this.shake({
        intensity: 10,
        duration: 300,
        easing: 'easeOut',
      });

      this.flash(0xff0000, 200, 0.6);
      this.chromaticAberration({
        intensity: 1,
        duration: 400,
      }).then(resolve);
    });
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update effects each frame.
   */
  update(dt: number): void {
    this.updateShake(dt);
    this.updateTimeScale(dt);
    this.updateVignette(dt);
    this.updateChromaticAberration(dt);
  }

  /**
   * Update shake effect.
   */
  private updateShake(dt: number): void {
    if (!this.shakeState) return;

    this.shakeState.elapsed += dt;

    if (this.shakeState.elapsed >= this.shakeState.duration) {
      this.shakeState = null;
      // Reset camera offset
      if (this.camera) {
        // Camera handles its own shake reset
      }
      return;
    }

    const progress = this.shakeState.elapsed / this.shakeState.duration;
    let falloff: number;

    switch (this.shakeState.easing) {
      case 'easeOut':
        falloff = 1 - progress * progress;
        break;
      case 'easeIn':
        falloff = (1 - progress) * (1 - progress);
        break;
      case 'easeInOut':
        falloff = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        falloff = 1 - falloff;
        break;
      default:
        falloff = 1 - progress;
    }

    const intensity = this.shakeState.intensity * falloff;
    const time = this.shakeState.elapsed * this.shakeState.frequency;

    // Perlin-like noise
    const noise = (t: number, seed: number) =>
      Math.sin(t * 1.0 + seed) * 0.5 +
      Math.sin(t * 2.3 + seed * 2) * 0.3 +
      Math.sin(t * 4.1 + seed * 3) * 0.2;

    if (this.shakeState.direction !== 'vertical') {
      this.shakeState.offsetX = noise(time, 0) * intensity;
    }
    if (this.shakeState.direction !== 'horizontal') {
      this.shakeState.offsetY = noise(time, 100) * intensity;
    }

    // Apply to camera
    this.camera.shake(intensity, dt);
  }

  /**
   * Update time scale for slow motion.
   */
  private updateTimeScale(dt: number): void {
    if (this._timeScale !== this.targetTimeScale) {
      const diff = this.targetTimeScale - this._timeScale;
      const step = this.timeScaleTransitionSpeed * dt;

      if (Math.abs(diff) <= step) {
        this._timeScale = this.targetTimeScale;
      } else {
        this._timeScale += Math.sign(diff) * step;
      }
    }
  }

  /**
   * Update vignette overlay.
   */
  private updateVignette(_dt: number): void {
    if (!this.vignetteGraphics || !this.scene) return;

    this.vignetteGraphics.clear();

    if (this.vignetteIntensity <= 0) return;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const innerRadius = maxRadius * this.vignetteRadius;

    // Create radial gradient
    const steps = 20;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const radius = innerRadius + (maxRadius - innerRadius) * t;
      const alpha = this.vignetteIntensity * (1 - t);

      this.vignetteGraphics.fillStyle(this.vignetteColor, alpha);
      this.vignetteGraphics.fillCircle(centerX, centerY, radius);
    }
  }

  /**
   * Update chromatic aberration.
   */
  private updateChromaticAberration(dt: number): void {
    if (!this.chromaticState) return;

    this.chromaticState.elapsed += dt;

    if (this.chromaticState.elapsed >= this.chromaticState.duration) {
      this.chromaticState = null;
      return;
    }

    // Note: Full chromatic aberration requires WebGL shaders
    // This is a placeholder for shader-based implementation
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clear all active effects.
   */
  clearAll(): void {
    this.shakeState = null;
    this.chromaticState = null;
    this.vignetteIntensity = 0;
    this._timeScale = 1;
    this.targetTimeScale = 1;

    for (const effect of this.activeEffects.values()) {
      if (effect.graphics) {
        effect.graphics.destroy();
      }
      if (effect.resolve) {
        effect.resolve();
      }
    }
    this.activeEffects.clear();

    if (this.vignetteGraphics) {
      this.vignetteGraphics.clear();
    }
  }

  /**
   * Destroy screen effects.
   */
  destroy(): void {
    this.clearAll();

    if (this.vignetteGraphics) {
      this.vignetteGraphics.destroy();
      this.vignetteGraphics = null;
    }
  }
}
