/**
 * GameScreenEffects - Screen effects wrapper for Phaser scenes.
 *
 * Provides visual feedback effects directly integrated with Phaser scenes:
 * - Hit Stop: Brief pause (50ms) on critical hits
 * - Screen Flash: White flash on level up, red flash on damage
 * - Slow Motion: 0.5x speed for 0.5s on boss kill
 * - Chromatic Aberration: Brief RGB split on big explosions
 * - Vignette Pulse: Red vignette when HP < 25%
 * - Kill Streak Effects: Screen border glows on kill streaks
 */

import * as Phaser from 'phaser';

/**
 * Kill streak tier configuration.
 */
interface KillStreakTier {
  threshold: number;
  color: number;
  name: string;
}

/**
 * GameScreenEffects provides screen-wide visual effects for game scenes.
 */
export class GameScreenEffects {
  /** Scene reference */
  private scene: Phaser.Scene;

  /** Graphics objects for overlays */
  private vignetteGraphics!: Phaser.GameObjects.Graphics;
  private chromaticGraphicsR!: Phaser.GameObjects.Graphics;
  private chromaticGraphicsB!: Phaser.GameObjects.Graphics;
  private killStreakGraphics!: Phaser.GameObjects.Graphics;

  /** Time scale for slow motion */
  private _timeScale: number = 1;
  private targetTimeScale: number = 1;
  private timeScaleEaseSpeed: number = 0;

  /** Hit stop state */
  private hitStopActive: boolean = false;
  private hitStopTimer: number = 0;
  private hitStopDuration: number = 0;
  private hitStopCallback: (() => void) | null = null;

  /** Vignette state */
  private vignetteIntensity: number = 0;
  private vignetteColor: number = 0x000000;
  private vignetteRadius: number = 0.8;

  /** Low health vignette state */
  private lowHealthActive: boolean = false;
  private lowHealthPulsePhase: number = 0;
  private lowHealthPulseSpeed: number = 3;

  /** Chromatic aberration state */
  private chromaticActive: boolean = false;
  private chromaticIntensity: number = 0;
  private chromaticDuration: number = 0;
  private chromaticTimer: number = 0;
  private chromaticAngle: number = 0;

  /** Kill streak state */
  private killStreakActive: boolean = false;
  private killStreakCount: number = 0;
  private killStreakColor: number = 0x00ffff;
  private killStreakDuration: number = 0;
  private killStreakTimer: number = 0;
  private killStreakPulsePhase: number = 0;

  /** Kill streak tiers */
  private static readonly STREAK_TIERS: KillStreakTier[] = [
    { threshold: 5, color: 0x00ffff, name: 'Multi Kill' },
    { threshold: 10, color: 0x00ff00, name: 'Killing Spree' },
    { threshold: 20, color: 0xffff00, name: 'Rampage' },
    { threshold: 30, color: 0xff6600, name: 'Unstoppable' },
    { threshold: 50, color: 0xff0000, name: 'Godlike' },
    { threshold: 100, color: 0xff00ff, name: 'Legendary' },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupGraphics();
  }

  /**
   * Set up graphics objects for overlays.
   */
  private setupGraphics(): void {
    // Vignette overlay
    this.vignetteGraphics = this.scene.add.graphics();
    this.vignetteGraphics.setDepth(1000);
    this.vignetteGraphics.setScrollFactor(0);

    // Chromatic aberration overlays
    this.chromaticGraphicsR = this.scene.add.graphics();
    this.chromaticGraphicsR.setDepth(999);
    this.chromaticGraphicsR.setScrollFactor(0);
    this.chromaticGraphicsR.setBlendMode(Phaser.BlendModes.ADD);

    this.chromaticGraphicsB = this.scene.add.graphics();
    this.chromaticGraphicsB.setDepth(999);
    this.chromaticGraphicsB.setScrollFactor(0);
    this.chromaticGraphicsB.setBlendMode(Phaser.BlendModes.ADD);

    // Kill streak border overlay
    this.killStreakGraphics = this.scene.add.graphics();
    this.killStreakGraphics.setDepth(998);
    this.killStreakGraphics.setScrollFactor(0);
  }

  // ============================================
  // Hit Stop (Frame Freeze)
  // ============================================

  /**
   * Apply hit stop effect - brief pause on critical hits.
   * @param duration Duration in milliseconds (default: 50ms)
   */
  hitStop(duration: number = 50): Promise<void> {
    return new Promise((resolve) => {
      this.hitStopActive = true;
      this.hitStopDuration = duration / 1000;
      this.hitStopTimer = 0;
      this._timeScale = 0;
      this.hitStopCallback = resolve;
    });
  }

  /**
   * Critical hit stop - 50ms freeze.
   */
  criticalHitStop(): Promise<void> {
    return this.hitStop(50);
  }

  /**
   * Heavy hit stop - 80ms freeze for powerful attacks.
   */
  heavyHitStop(): Promise<void> {
    return this.hitStop(80);
  }

  /**
   * Boss kill hit stop - 150ms dramatic freeze.
   */
  bossKillHitStop(): Promise<void> {
    return this.hitStop(150);
  }

  // ============================================
  // Screen Flash
  // ============================================

  /**
   * Flash the screen with a color.
   */
  flash(color: number, duration: number, alpha: number = 0.5): void {
    const camera = this.scene.cameras.main;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Force complete any existing flash
    camera.resetFX();

    // Apply new flash
    camera.flash(duration, r, g, b, false);
  }

  /**
   * White flash - for level up, power ups.
   */
  flashWhite(duration: number = 150): void {
    this.flash(0xffffff, duration, 0.4);
  }

  /**
   * Red flash - for taking damage.
   */
  flashRed(duration: number = 100): void {
    this.flash(0xff0000, duration, 0.3);
  }

  /**
   * Gold flash - for level up.
   */
  flashGold(duration: number = 200): void {
    this.flash(0xffd700, duration, 0.5);
  }

  // ============================================
  // Slow Motion
  // ============================================

  /**
   * Apply slow motion effect.
   * @param factor Time scale (0.5 = half speed)
   * @param duration Duration in milliseconds
   * @param easeInTime Time to ease into slow motion (ms)
   * @param easeOutTime Time to ease out of slow motion (ms)
   */
  slowMotion(factor: number, duration: number, easeInTime: number = 50, easeOutTime: number = 100): Promise<void> {
    return new Promise((resolve) => {
      this.targetTimeScale = factor;
      this.timeScaleEaseSpeed = (1 - factor) / (easeInTime / 1000);

      // Schedule return to normal
      this.scene.time.delayedCall(easeInTime + duration, () => {
        this.targetTimeScale = 1;
        this.timeScaleEaseSpeed = (1 - factor) / (easeOutTime / 1000);
      });

      // Resolve when complete
      this.scene.time.delayedCall(easeInTime + duration + easeOutTime, () => {
        this._timeScale = 1;
        resolve();
      });
    });
  }

  /**
   * Boss kill slow motion - 0.5x speed for 0.5s.
   */
  bossKillSlowMotion(): Promise<void> {
    return this.slowMotion(0.5, 500, 50, 150);
  }

  /**
   * Get current time scale.
   */
  get timeScale(): number {
    return this._timeScale;
  }

  // ============================================
  // Chromatic Aberration
  // ============================================

  /**
   * Apply chromatic aberration effect - RGB split.
   * @param intensity Effect intensity (0-1)
   * @param duration Duration in milliseconds
   */
  chromaticAberration(intensity: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.chromaticActive = true;
      this.chromaticIntensity = intensity;
      this.chromaticDuration = duration / 1000;
      this.chromaticTimer = 0;
      this.chromaticAngle = Math.random() * Math.PI * 2;
      // Re-enable visibility when effect is active
      this.chromaticGraphicsR.setVisible(true);
      this.chromaticGraphicsB.setVisible(true);

      this.scene.time.delayedCall(duration, () => {
        this.chromaticActive = false;
        resolve();
      });
    });
  }

  /**
   * Explosion chromatic aberration - brief RGB split on big explosions.
   */
  explosionChromatic(): Promise<void> {
    return this.chromaticAberration(1.0, 200);
  }

  /**
   * Damage chromatic aberration - smaller effect.
   */
  damageChromatic(): Promise<void> {
    return this.chromaticAberration(0.5, 150);
  }

  // ============================================
  // Vignette Effects
  // ============================================

  /**
   * Show vignette effect.
   */
  vignette(color: number, intensity: number, duration: number, radius: number = 0.8): void {
    this.vignetteColor = color;
    this.vignetteIntensity = intensity;
    this.vignetteRadius = radius;

    // Fade out after duration
    this.scene.tweens.add({
      targets: this,
      vignetteIntensity: 0,
      duration: duration,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Set low health vignette state - red vignette when HP < 25%.
   * @param active Whether low health warning should be active
   * @param hpPercent Current HP percentage (0-1) for intensity scaling
   */
  setLowHealth(active: boolean, hpPercent: number = 0.25): void {
    this.lowHealthActive = active;

    if (active) {
      this.vignetteColor = 0xff0000;
      this.vignetteRadius = 0.6 + hpPercent * 0.2;
      this.lowHealthPulseSpeed = 3 + (1 - hpPercent) * 3;
      // Re-enable visibility when effect is active
      this.vignetteGraphics.setVisible(true);
    }
  }

  // ============================================
  // Kill Streak Effects
  // ============================================

  /**
   * Show kill streak border glow effect.
   */
  showKillStreak(streakCount: number, duration: number = 1000): void {
    this.killStreakActive = true;
    this.killStreakCount = streakCount;
    this.killStreakDuration = duration / 1000;
    this.killStreakTimer = 0;
    this.killStreakPulsePhase = 0;
    // Re-enable visibility when effect is active
    this.killStreakGraphics.setVisible(true);

    // Get color based on streak tier
    this.killStreakColor = this.getStreakColor(streakCount);
  }

  /**
   * Get streak color based on kill count.
   */
  private getStreakColor(streakCount: number): number {
    for (let i = GameScreenEffects.STREAK_TIERS.length - 1; i >= 0; i--) {
      if (streakCount >= GameScreenEffects.STREAK_TIERS[i].threshold) {
        return GameScreenEffects.STREAK_TIERS[i].color;
      }
    }
    return 0x00ffff;
  }

  /**
   * Clear kill streak effect.
   */
  clearKillStreak(): void {
    this.killStreakActive = false;
    this.killStreakGraphics.clear();
  }

  // ============================================
  // Combination Effects
  // ============================================

  /**
   * Take damage effect - red flash, shake, vignette.
   */
  takeDamageEffect(intensity: number = 1): void {
    const scaled = Math.min(1, intensity);

    this.flashRed(100 * scaled);
    this.scene.cameras.main.shake(100 * scaled, 0.01 * scaled);

    if (scaled > 0.5) {
      this.vignette(0xff0000, 0.2 * scaled, 200, 0.8);
    }
  }

  /**
   * Level up effect - white flash, shake.
   */
  levelUpEffect(): void {
    this.flashWhite(200);
    this.scene.cameras.main.shake(150, 0.01);
  }

  /**
   * Boss spawn effect - shake, dark flash, vignette.
   */
  bossSpawnEffect(): void {
    this.scene.cameras.main.shake(500, 0.02);
    this.flash(0x000000, 100, 0.5);
    this.vignette(0x330000, 0.4, 1000, 0.6);
  }

  /**
   * Boss kill effect - hit stop, slow motion, flash, chromatic aberration.
   */
  async bossKillEffect(): Promise<void> {
    // Hit stop first
    await this.hitStop(100);

    // Then slow motion with effects
    this.flashWhite(150);
    this.scene.cameras.main.shake(300, 0.03);
    this.explosionChromatic();

    await this.bossKillSlowMotion();
  }

  /**
   * Critical hit effect - hit stop, flash, shake.
   */
  async criticalHitEffect(): Promise<void> {
    await this.hitStop(50);
    this.flash(0xffff00, 50, 0.2);
    this.scene.cameras.main.shake(80, 0.008);
  }

  /**
   * Big explosion effect - chromatic aberration, shake, flash.
   */
  bigExplosionEffect(): void {
    this.scene.cameras.main.shake(200, 0.02);
    this.flash(0xff6600, 100, 0.3);
    this.explosionChromatic();
  }

  /**
   * Death effect - slow motion, shake, red flash, chromatic.
   */
  async deathEffect(): Promise<void> {
    this.flashRed(200);
    this.scene.cameras.main.shake(300, 0.03);
    this.chromaticAberration(1.0, 400);
    await this.slowMotion(0.2, 500, 50, 200);
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update effects each frame. Call this from scene's update().
   */
  update(dt: number): void {
    // Convert to seconds if needed
    const deltaSeconds = dt > 1 ? dt / 1000 : dt;

    this.updateHitStop(deltaSeconds);
    this.updateTimeScale(deltaSeconds);
    this.updateVignette(deltaSeconds);
    this.updateChromatic(deltaSeconds);
    this.updateKillStreak(deltaSeconds);
  }

  /**
   * Update hit stop effect.
   */
  private updateHitStop(dt: number): void {
    if (!this.hitStopActive) return;

    this.hitStopTimer += dt;

    if (this.hitStopTimer >= this.hitStopDuration) {
      this.hitStopActive = false;
      this._timeScale = 1;

      if (this.hitStopCallback) {
        this.hitStopCallback();
        this.hitStopCallback = null;
      }
    }
  }

  /**
   * Update time scale for slow motion.
   */
  private updateTimeScale(dt: number): void {
    if (this.hitStopActive) return; // Don't update during hit stop

    if (this._timeScale !== this.targetTimeScale) {
      const diff = this.targetTimeScale - this._timeScale;
      const step = this.timeScaleEaseSpeed * dt;

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
    this.vignetteGraphics.clear();

    // Handle low health pulsing vignette
    if (this.lowHealthActive) {
      this.lowHealthPulsePhase += dt * this.lowHealthPulseSpeed;
      this.vignetteIntensity = 0.2 + Math.abs(Math.sin(this.lowHealthPulsePhase)) * 0.3;
    }

    if (this.vignetteIntensity <= 0) return;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const innerRadius = maxRadius * this.vignetteRadius;

    // Create radial gradient with multiple rings
    const steps = 15;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const radius = innerRadius + (maxRadius - innerRadius) * t;
      const alpha = this.vignetteIntensity * (1 - t);

      this.vignetteGraphics.fillStyle(this.vignetteColor, alpha);
      this.vignetteGraphics.fillCircle(centerX, centerY, radius);
    }
  }

  /**
   * Update chromatic aberration effect.
   */
  private updateChromatic(dt: number): void {
    this.chromaticGraphicsR.clear();
    this.chromaticGraphicsB.clear();

    if (!this.chromaticActive) return;

    this.chromaticTimer += dt;

    if (this.chromaticTimer >= this.chromaticDuration) {
      this.chromaticActive = false;
      return;
    }

    // Calculate fade based on progress
    const progress = this.chromaticTimer / this.chromaticDuration;
    const fadeOut = 1 - progress * progress;
    const intensity = this.chromaticIntensity * fadeOut;

    if (intensity <= 0.01) return;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const offset = intensity * 8;

    const offsetX = Math.cos(this.chromaticAngle) * offset;
    const offsetY = Math.sin(this.chromaticAngle) * offset;

    // Red channel offset
    this.chromaticGraphicsR.fillStyle(0xff0000, intensity * 0.15);
    this.chromaticGraphicsR.fillRect(-offsetX, -offsetY, width, height);

    // Blue channel offset
    this.chromaticGraphicsB.fillStyle(0x0000ff, intensity * 0.15);
    this.chromaticGraphicsB.fillRect(offsetX, offsetY, width, height);

    // Edge glow
    const edgeSize = offset * 2;
    this.chromaticGraphicsR.fillStyle(0xff0000, intensity * 0.2);
    this.chromaticGraphicsR.fillRect(0, 0, edgeSize, height);

    this.chromaticGraphicsB.fillStyle(0x0000ff, intensity * 0.2);
    this.chromaticGraphicsB.fillRect(width - edgeSize, 0, edgeSize, height);
  }

  /**
   * Update kill streak border glow.
   */
  private updateKillStreak(dt: number): void {
    this.killStreakGraphics.clear();

    if (!this.killStreakActive) return;

    this.killStreakTimer += dt;
    this.killStreakPulsePhase += dt * (2 + Math.min(this.killStreakCount / 10, 3));

    if (this.killStreakTimer >= this.killStreakDuration) {
      this.killStreakActive = false;
      return;
    }

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Calculate fade
    const remainingRatio = 1 - (this.killStreakTimer / this.killStreakDuration);
    const fadeOut = Math.min(1, remainingRatio * 2);

    // Pulsing intensity
    const pulse = 0.5 + Math.sin(this.killStreakPulsePhase) * 0.5;
    const baseAlpha = 0.3 + Math.min(this.killStreakCount / 100, 0.3);
    const alpha = baseAlpha * pulse * fadeOut;

    const borderWidth = 8 + Math.min(this.killStreakCount / 5, 12);

    // Draw glowing border
    this.killStreakGraphics.fillStyle(this.killStreakColor, alpha);

    // Top
    this.killStreakGraphics.fillRect(0, 0, width, borderWidth);
    // Bottom
    this.killStreakGraphics.fillRect(0, height - borderWidth, width, borderWidth);
    // Left
    this.killStreakGraphics.fillRect(0, borderWidth, borderWidth, height - borderWidth * 2);
    // Right
    this.killStreakGraphics.fillRect(width - borderWidth, borderWidth, borderWidth, height - borderWidth * 2);

    // Corner glow for high streaks
    if (this.killStreakCount >= 10) {
      const cornerSize = borderWidth * 2;
      this.killStreakGraphics.fillStyle(this.killStreakColor, alpha * 0.5);
      this.killStreakGraphics.fillRect(0, 0, cornerSize, cornerSize);
      this.killStreakGraphics.fillRect(width - cornerSize, 0, cornerSize, cornerSize);
      this.killStreakGraphics.fillRect(0, height - cornerSize, cornerSize, cornerSize);
      this.killStreakGraphics.fillRect(width - cornerSize, height - cornerSize, cornerSize, cornerSize);
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clear all active effects.
   */
  clearAll(): void {
    this._timeScale = 1;
    this.targetTimeScale = 1;
    this.hitStopActive = false;
    this.chromaticActive = false;
    this.killStreakActive = false;
    this.lowHealthActive = false;
    this.vignetteIntensity = 0;

    // Clear and hide all graphics to ensure they don't show
    this.vignetteGraphics.clear();
    this.vignetteGraphics.setVisible(false);
    this.chromaticGraphicsR.clear();
    this.chromaticGraphicsR.setVisible(false);
    this.chromaticGraphicsB.clear();
    this.chromaticGraphicsB.setVisible(false);
    this.killStreakGraphics.clear();
    this.killStreakGraphics.setVisible(false);
  }

  /**
   * Destroy screen effects.
   */
  destroy(): void {
    this.clearAll();
    this.vignetteGraphics.destroy();
    this.chromaticGraphicsR.destroy();
    this.chromaticGraphicsB.destroy();
    this.killStreakGraphics.destroy();
  }
}
