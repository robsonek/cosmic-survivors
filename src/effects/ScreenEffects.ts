/**
 * ScreenEffects - Advanced screen-wide visual effects.
 * Extends basic camera effects with more sophisticated options.
 *
 * Features:
 * - Hit Stop: Brief pause on critical hits
 * - Screen Flash: White/red/gold flashes for various events
 * - Slow Motion: Time scale manipulation for dramatic moments
 * - Chromatic Aberration: RGB split effect for impacts
 * - Vignette Pulse: Low health warning effect
 * - Kill Streak Effects: Screen border glow on kill streaks
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
  pulse?: boolean;
  pulseSpeed?: number;
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
 * Hit stop configuration.
 */
export interface HitStopConfig {
  duration: number;
  timeScale?: number;
}

/**
 * Kill streak effect configuration.
 */
export interface KillStreakConfig {
  streakCount: number;
  duration: number;
  color?: number;
  pulseSpeed?: number;
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

  /** Hit stop state */
  private hitStopActive: boolean = false;
  private hitStopTimer: number = 0;
  private hitStopDuration: number = 0;
  private preHitStopTimeScale: number = 1;

  /** Vignette graphics overlay */
  private vignetteGraphics: Phaser.GameObjects.Graphics | null = null;
  private vignetteIntensity: number = 0;
  private vignetteColor: number = 0x000000;
  private vignetteRadius: number = 1.0;
  private vignettePulse: boolean = false;
  private vignettePulseSpeed: number = 3;
  private vignettePulseTime: number = 0;

  /** Low health vignette state */
  private lowHealthActive: boolean = false;
  private lowHealthPulsePhase: number = 0;

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

  /** Chromatic aberration graphics (simulated with color overlays) */
  private chromaticGraphicsR: Phaser.GameObjects.Graphics | null = null;
  private chromaticGraphicsB: Phaser.GameObjects.Graphics | null = null;

  /** Kill streak state */
  private killStreakGraphics: Phaser.GameObjects.Graphics | null = null;
  private killStreakState: {
    streakCount: number;
    duration: number;
    elapsed: number;
    color: number;
    pulseSpeed: number;
    pulsePhase: number;
  } | null = null;

  /** Screen border glow graphics */
  private borderGlowGraphics: Phaser.GameObjects.Graphics | null = null;

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

    // Create chromatic aberration overlays (red and blue channel offsets)
    this.chromaticGraphicsR = this.scene.add.graphics();
    this.chromaticGraphicsR.setDepth(999);
    this.chromaticGraphicsR.setScrollFactor(0);
    this.chromaticGraphicsR.setBlendMode(Phaser.BlendModes.ADD);

    this.chromaticGraphicsB = this.scene.add.graphics();
    this.chromaticGraphicsB.setDepth(999);
    this.chromaticGraphicsB.setScrollFactor(0);
    this.chromaticGraphicsB.setBlendMode(Phaser.BlendModes.ADD);

    // Create kill streak border glow overlay
    this.killStreakGraphics = this.scene.add.graphics();
    this.killStreakGraphics.setDepth(998);
    this.killStreakGraphics.setScrollFactor(0);

    // Create border glow overlay
    this.borderGlowGraphics = this.scene.add.graphics();
    this.borderGlowGraphics.setDepth(997);
    this.borderGlowGraphics.setScrollFactor(0);
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
  // Hit Stop (Frame Freeze) Effects
  // ============================================

  /**
   * Apply hit stop effect - brief pause on critical hits.
   * This is a hard freeze rather than slow motion.
   */
  hitStop(config: HitStopConfig = { duration: 50 }): Promise<void> {
    return new Promise((resolve) => {
      const { duration, timeScale = 0 } = config;

      // Store current time scale
      this.preHitStopTimeScale = this._timeScale;

      // Activate hit stop
      this.hitStopActive = true;
      this.hitStopDuration = duration / 1000;
      this.hitStopTimer = 0;
      this._timeScale = timeScale;

      const effectId = `hitstop_${++this.effectIdCounter}`;
      this.activeEffects.set(effectId, {
        type: 'hitStop',
        startTime: Date.now(),
        duration,
        config,
        resolve,
      });
    });
  }

  /**
   * Critical hit stop - 50ms freeze on critical hits.
   */
  criticalHitStop(): Promise<void> {
    return this.hitStop({ duration: 50, timeScale: 0 });
  }

  /**
   * Heavy hit stop - longer freeze for powerful attacks.
   */
  heavyHitStop(): Promise<void> {
    return this.hitStop({ duration: 80, timeScale: 0 });
  }

  /**
   * Boss kill hit stop - dramatic freeze.
   */
  bossKillHitStop(): Promise<void> {
    return this.hitStop({ duration: 150, timeScale: 0 });
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
   * Low health vignette pulse - red vignette when HP < 25%.
   * This creates a pulsing red border effect to warn the player.
   */
  lowHealthVignette(): void {
    this.lowHealthActive = true;
    this.vignetteColor = 0xff0000;
    this.vignetteRadius = 0.7;
    this.vignettePulse = true;
    this.vignettePulseSpeed = 3;
  }

  /**
   * Set low health state - enables/disables pulsing vignette.
   * @param active Whether low health warning should be active
   * @param hpPercent Current HP percentage (0-1) for intensity scaling
   */
  setLowHealth(active: boolean, hpPercent: number = 0.25): void {
    this.lowHealthActive = active;

    if (active) {
      this.vignetteColor = 0xff0000;
      this.vignetteRadius = 0.6 + (hpPercent * 0.2); // Tighter radius at lower HP
      this.vignettePulse = true;
      this.vignettePulseSpeed = 3 + (1 - hpPercent) * 3; // Faster pulse at lower HP
    } else {
      this.vignettePulse = false;
      this.vignetteIntensity = 0;
    }
  }

  /**
   * Clear vignette.
   */
  clearVignette(): void {
    this.vignetteIntensity = 0;
    this.vignettePulse = false;
    this.lowHealthActive = false;
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

  /**
   * Big explosion chromatic aberration - brief RGB split on big explosions.
   */
  explosionChromaticPulse(): Promise<void> {
    return this.chromaticAberration({
      intensity: 1.0,
      duration: 200,
      angle: Math.random() * Math.PI * 2,
    });
  }

  // ============================================
  // Kill Streak Effects
  // ============================================

  /**
   * Show kill streak effect - screen border glows on kill streaks.
   */
  killStreakEffect(config: KillStreakConfig): void {
    const {
      streakCount,
      duration,
      color = this.getStreakColor(streakCount),
      pulseSpeed = 2 + Math.min(streakCount / 10, 3),
    } = config;

    this.killStreakState = {
      streakCount,
      duration: duration / 1000,
      elapsed: 0,
      color,
      pulseSpeed,
      pulsePhase: 0,
    };

    const effectId = `killstreak_${++this.effectIdCounter}`;
    this.activeEffects.set(effectId, {
      type: 'killStreak',
      startTime: Date.now(),
      duration,
      config,
    });
  }

  /**
   * Get streak color based on kill count.
   */
  private getStreakColor(streakCount: number): number {
    if (streakCount >= 50) return 0xff00ff; // Purple - Legendary
    if (streakCount >= 30) return 0xff0000; // Red - Unstoppable
    if (streakCount >= 20) return 0xff6600; // Orange - Rampage
    if (streakCount >= 10) return 0xffff00; // Yellow - Killing Spree
    if (streakCount >= 5) return 0x00ff00;  // Green - Multi Kill
    return 0x00ffff; // Cyan - Starting streak
  }

  /**
   * Show border glow effect for kill streaks.
   */
  showKillStreakBorder(streakCount: number, duration: number = 1000): void {
    this.killStreakEffect({
      streakCount,
      duration,
      color: this.getStreakColor(streakCount),
    });
  }

  /**
   * Clear kill streak effect.
   */
  clearKillStreak(): void {
    this.killStreakState = null;
    if (this.killStreakGraphics) {
      this.killStreakGraphics.clear();
    }
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

  /**
   * Boss kill effect - dramatic slow motion (0.5x speed for 0.5s) on boss kill.
   */
  bossKillEffect(): Promise<void> {
    return new Promise((resolve) => {
      // Hit stop first for impact
      this.hitStop({ duration: 100, timeScale: 0 });

      // Then slow motion
      setTimeout(() => {
        this.slowMotion({
          factor: 0.5,
          duration: 500,
          easeIn: 50,
          easeOut: 150,
        });

        // Screen effects
        this.flash(0xffffff, 150, 0.8);
        this.explosionShake(15);
        this.explosionChromaticPulse();

        // Resolve after slow motion
        setTimeout(() => resolve(), 700);
      }, 100);
    });
  }

  /**
   * Critical hit effect - combines hit stop with flash and shake.
   */
  criticalHitEffect(): Promise<void> {
    return new Promise((resolve) => {
      this.hitStop({ duration: 50, timeScale: 0 }).then(() => {
        this.flash(0xffff00, 50, 0.3);
        this.impactShake(4);
        resolve();
      });
    });
  }

  /**
   * Big explosion effect - chromatic aberration with shake and flash.
   */
  bigExplosionEffect(): Promise<void> {
    return new Promise((resolve) => {
      this.explosionShake(12);
      this.flash(0xff6600, 100, 0.4);
      this.explosionChromaticPulse().then(resolve);
    });
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update effects each frame.
   */
  update(dt: number): void {
    this.updateHitStop(dt);
    this.updateShake(dt);
    this.updateTimeScale(dt);
    this.updateVignette(dt);
    this.updateChromaticAberration(dt);
    this.updateKillStreak(dt);
  }

  /**
   * Update hit stop effect.
   */
  private updateHitStop(dt: number): void {
    if (!this.hitStopActive) return;

    this.hitStopTimer += dt;

    if (this.hitStopTimer >= this.hitStopDuration) {
      // End hit stop
      this.hitStopActive = false;
      this._timeScale = this.preHitStopTimeScale;

      // Find and resolve hit stop effect
      for (const [id, effect] of this.activeEffects) {
        if (effect.type === 'hitStop' && effect.resolve) {
          effect.resolve();
          this.activeEffects.delete(id);
          break;
        }
      }
    }
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
  private updateVignette(dt: number): void {
    if (!this.vignetteGraphics || !this.scene) return;

    this.vignetteGraphics.clear();

    // Handle low health pulsing vignette
    if (this.lowHealthActive) {
      this.lowHealthPulsePhase += dt * this.vignettePulseSpeed;
      // Pulsing intensity between 0.2 and 0.5
      this.vignetteIntensity = 0.2 + Math.abs(Math.sin(this.lowHealthPulsePhase)) * 0.3;
    } else if (this.vignettePulse) {
      // General pulsing vignette
      this.vignettePulseTime += dt * this.vignettePulseSpeed;
      const baseIntensity = this.vignetteIntensity;
      this.vignetteIntensity = baseIntensity * (0.7 + Math.abs(Math.sin(this.vignettePulseTime)) * 0.3);
    }

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
   * Simulates RGB split by drawing colored edge overlays.
   */
  private updateChromaticAberration(dt: number): void {
    if (!this.chromaticGraphicsR || !this.chromaticGraphicsB || !this.scene) return;

    this.chromaticGraphicsR.clear();
    this.chromaticGraphicsB.clear();

    if (!this.chromaticState) return;

    this.chromaticState.elapsed += dt;

    if (this.chromaticState.elapsed >= this.chromaticState.duration) {
      this.chromaticState = null;
      return;
    }

    // Calculate fade based on progress
    const progress = this.chromaticState.elapsed / this.chromaticState.duration;
    const fadeOut = 1 - progress * progress; // Quadratic ease out
    const intensity = this.chromaticState.intensity * fadeOut;

    if (intensity <= 0.01) return;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const offset = intensity * 8; // Pixel offset for chromatic effect

    // Calculate offset direction based on angle
    const angle = this.chromaticState.angle;
    const offsetX = Math.cos(angle) * offset;
    const offsetY = Math.sin(angle) * offset;

    // Draw red channel offset (left/up)
    this.chromaticGraphicsR.fillStyle(0xff0000, intensity * 0.15);
    this.chromaticGraphicsR.fillRect(-offsetX, -offsetY, width, height);

    // Draw blue channel offset (right/down)
    this.chromaticGraphicsB.fillStyle(0x0000ff, intensity * 0.15);
    this.chromaticGraphicsB.fillRect(offsetX, offsetY, width, height);

    // Add edge glow effect for more pronounced chromatic look
    const edgeSize = offset * 2;

    // Red edge on left
    this.chromaticGraphicsR.fillStyle(0xff0000, intensity * 0.2);
    this.chromaticGraphicsR.fillRect(0, 0, edgeSize, height);

    // Blue edge on right
    this.chromaticGraphicsB.fillStyle(0x0000ff, intensity * 0.2);
    this.chromaticGraphicsB.fillRect(width - edgeSize, 0, edgeSize, height);
  }

  /**
   * Update kill streak border glow effect.
   */
  private updateKillStreak(dt: number): void {
    if (!this.killStreakGraphics || !this.scene) return;

    this.killStreakGraphics.clear();

    if (!this.killStreakState) return;

    this.killStreakState.elapsed += dt;
    this.killStreakState.pulsePhase += dt * this.killStreakState.pulseSpeed;

    // Check if effect has expired
    if (this.killStreakState.elapsed >= this.killStreakState.duration) {
      this.killStreakState = null;
      return;
    }

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Calculate fade based on remaining time
    const remainingRatio = 1 - (this.killStreakState.elapsed / this.killStreakState.duration);
    const fadeOut = Math.min(1, remainingRatio * 2); // Fade out in last half

    // Pulsing intensity
    const pulse = 0.5 + Math.sin(this.killStreakState.pulsePhase) * 0.5;
    const baseAlpha = 0.3 + (this.killStreakState.streakCount / 100) * 0.3; // Higher streak = more intense
    const alpha = baseAlpha * pulse * fadeOut;

    const color = this.killStreakState.color;
    const borderWidth = 8 + Math.min(this.killStreakState.streakCount / 5, 12); // Wider border at higher streaks

    // Draw glowing border on all edges
    // Top edge
    this.killStreakGraphics.fillStyle(color, alpha);
    this.killStreakGraphics.fillRect(0, 0, width, borderWidth);

    // Bottom edge
    this.killStreakGraphics.fillRect(0, height - borderWidth, width, borderWidth);

    // Left edge
    this.killStreakGraphics.fillRect(0, borderWidth, borderWidth, height - borderWidth * 2);

    // Right edge
    this.killStreakGraphics.fillRect(width - borderWidth, borderWidth, borderWidth, height - borderWidth * 2);

    // Add corner glow for higher streaks
    if (this.killStreakState.streakCount >= 10) {
      const cornerSize = borderWidth * 2;
      const cornerAlpha = alpha * 0.5;

      this.killStreakGraphics.fillStyle(color, cornerAlpha);
      // Top-left corner
      this.killStreakGraphics.fillRect(0, 0, cornerSize, cornerSize);
      // Top-right corner
      this.killStreakGraphics.fillRect(width - cornerSize, 0, cornerSize, cornerSize);
      // Bottom-left corner
      this.killStreakGraphics.fillRect(0, height - cornerSize, cornerSize, cornerSize);
      // Bottom-right corner
      this.killStreakGraphics.fillRect(width - cornerSize, height - cornerSize, cornerSize, cornerSize);
    }

    // Add inner glow line for very high streaks
    if (this.killStreakState.streakCount >= 30) {
      const innerOffset = borderWidth + 4;
      const innerWidth = 2;

      this.killStreakGraphics.fillStyle(0xffffff, alpha * 0.5);
      // Top
      this.killStreakGraphics.fillRect(innerOffset, innerOffset, width - innerOffset * 2, innerWidth);
      // Bottom
      this.killStreakGraphics.fillRect(innerOffset, height - innerOffset - innerWidth, width - innerOffset * 2, innerWidth);
      // Left
      this.killStreakGraphics.fillRect(innerOffset, innerOffset + innerWidth, innerWidth, height - innerOffset * 2 - innerWidth * 2);
      // Right
      this.killStreakGraphics.fillRect(width - innerOffset - innerWidth, innerOffset + innerWidth, innerWidth, height - innerOffset * 2 - innerWidth * 2);
    }
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
    this.killStreakState = null;
    this.vignetteIntensity = 0;
    this.vignettePulse = false;
    this.lowHealthActive = false;
    this._timeScale = 1;
    this.targetTimeScale = 1;
    this.hitStopActive = false;

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
    if (this.chromaticGraphicsR) {
      this.chromaticGraphicsR.clear();
    }
    if (this.chromaticGraphicsB) {
      this.chromaticGraphicsB.clear();
    }
    if (this.killStreakGraphics) {
      this.killStreakGraphics.clear();
    }
    if (this.borderGlowGraphics) {
      this.borderGlowGraphics.clear();
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
    if (this.chromaticGraphicsR) {
      this.chromaticGraphicsR.destroy();
      this.chromaticGraphicsR = null;
    }
    if (this.chromaticGraphicsB) {
      this.chromaticGraphicsB.destroy();
      this.chromaticGraphicsB = null;
    }
    if (this.killStreakGraphics) {
      this.killStreakGraphics.destroy();
      this.killStreakGraphics = null;
    }
    if (this.borderGlowGraphics) {
      this.borderGlowGraphics.destroy();
      this.borderGlowGraphics = null;
    }
  }

  // ============================================
  // Getters for external use
  // ============================================

  /**
   * Check if hit stop is currently active.
   */
  get isHitStopActive(): boolean {
    return this.hitStopActive;
  }

  /**
   * Check if low health vignette is active.
   */
  get isLowHealthActive(): boolean {
    return this.lowHealthActive;
  }

  /**
   * Get current kill streak count if active.
   */
  get currentKillStreak(): number {
    return this.killStreakState?.streakCount ?? 0;
  }
}
