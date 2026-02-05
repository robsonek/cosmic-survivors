/**
 * WaveAnnouncer - Dramatic announcement system for wave events.
 *
 * Features:
 * - Big dramatic text when wave starts: "WAVE 5"
 * - Special text for boss waves: "BOSS INCOMING"
 * - Wave complete celebration: "WAVE COMPLETE! +500 XP"
 * - Survival milestones: "5 MINUTES SURVIVED!"
 * - Text animations: zoom in, shake, fade out
 * - Different colors for normal/boss/milestone
 */

import * as Phaser from 'phaser';
import { UIDepth, UIFonts } from './UIConstants';

// ============================================
// Types and Interfaces
// ============================================

/**
 * Announcement type for styling
 */
export enum AnnouncementType {
  WaveStart = 'waveStart',
  BossIncoming = 'bossIncoming',
  WaveComplete = 'waveComplete',
  Milestone = 'milestone',
}

/**
 * Configuration for WaveAnnouncer
 */
export interface WaveAnnouncerConfig {
  screenWidth?: number;
  screenHeight?: number;
}

/**
 * Announcement data structure
 */
interface Announcement {
  container: Phaser.GameObjects.Container;
  type: AnnouncementType;
  startTime: number;
  duration: number;
}

// ============================================
// Color Schemes for Different Announcement Types
// ============================================

const AnnouncementStyles: Record<AnnouncementType, {
  primaryColor: number;
  secondaryColor: number;
  strokeColor: string;
  glowColor: number;
  shakeIntensity: number;
}> = {
  [AnnouncementType.WaveStart]: {
    primaryColor: 0x00ffff,     // Cyan
    secondaryColor: 0x00cccc,
    strokeColor: '#003333',
    glowColor: 0x00ffff,
    shakeIntensity: 0.005,
  },
  [AnnouncementType.BossIncoming]: {
    primaryColor: 0xff0000,     // Red
    secondaryColor: 0xff6600,   // Orange
    strokeColor: '#330000',
    glowColor: 0xff4400,
    shakeIntensity: 0.02,
  },
  [AnnouncementType.WaveComplete]: {
    primaryColor: 0x00ff00,     // Green
    secondaryColor: 0x88ff88,
    strokeColor: '#003300',
    glowColor: 0x00ff00,
    shakeIntensity: 0,
  },
  [AnnouncementType.Milestone]: {
    primaryColor: 0xffff00,     // Yellow/Gold
    secondaryColor: 0xffcc00,
    strokeColor: '#333300',
    glowColor: 0xffff00,
    shakeIntensity: 0.01,
  },
};

// ============================================
// Milestone Definitions
// ============================================

interface MilestoneDefinition {
  timeSeconds: number;
  message: string;
  reached: boolean;
}

const SURVIVAL_MILESTONES: MilestoneDefinition[] = [
  { timeSeconds: 60, message: '1 MINUTE SURVIVED!', reached: false },
  { timeSeconds: 120, message: '2 MINUTES SURVIVED!', reached: false },
  { timeSeconds: 180, message: '3 MINUTES SURVIVED!', reached: false },
  { timeSeconds: 300, message: '5 MINUTES SURVIVED!', reached: false },
  { timeSeconds: 600, message: '10 MINUTES SURVIVED!', reached: false },
  { timeSeconds: 900, message: '15 MINUTES SURVIVED!', reached: false },
  { timeSeconds: 1200, message: '20 MINUTES SURVIVED!', reached: false },
  { timeSeconds: 1800, message: '30 MINUTES SURVIVED!', reached: false },
];

// ============================================
// WaveAnnouncer Class
// ============================================

/**
 * WaveAnnouncer handles dramatic on-screen announcements for wave events.
 */
export class WaveAnnouncer {
  private scene: Phaser.Scene;
  private screenWidth: number;
  private screenHeight: number;

  // Active announcements
  private currentAnnouncement: Announcement | null = null;
  private announcementQueue: Array<{
    type: AnnouncementType;
    mainText: string;
    subText?: string;
    duration?: number;
  }> = [];

  // Milestone tracking
  private milestones: MilestoneDefinition[];
  private _lastGameTime: number = 0;

  constructor(scene: Phaser.Scene, config: WaveAnnouncerConfig = {}) {
    this.scene = scene;
    this.screenWidth = config.screenWidth ?? scene.cameras.main.width;
    this.screenHeight = config.screenHeight ?? scene.cameras.main.height;

    // Clone milestones for this instance
    this.milestones = SURVIVAL_MILESTONES.map(m => ({ ...m }));
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Announce wave start.
   */
  announceWaveStart(waveNumber: number): void {
    this.queueAnnouncement({
      type: AnnouncementType.WaveStart,
      mainText: `WAVE ${waveNumber}`,
      duration: 2000,
    });
  }

  /**
   * Announce boss wave.
   */
  announceBossWave(waveNumber: number, bossName?: string): void {
    this.queueAnnouncement({
      type: AnnouncementType.BossIncoming,
      mainText: 'BOSS INCOMING',
      subText: bossName ? bossName.toUpperCase() : `WAVE ${waveNumber}`,
      duration: 3000,
    });
  }

  /**
   * Announce wave completion.
   */
  announceWaveComplete(waveNumber: number, bonusXP: number): void {
    this.queueAnnouncement({
      type: AnnouncementType.WaveComplete,
      mainText: 'WAVE COMPLETE!',
      subText: bonusXP > 0 ? `+${bonusXP} XP` : undefined,
      duration: 2000,
    });
  }

  /**
   * Announce survival milestone.
   */
  announceMilestone(message: string): void {
    this.queueAnnouncement({
      type: AnnouncementType.Milestone,
      mainText: message,
      duration: 2500,
    });
  }

  /**
   * Check and announce time-based milestones.
   */
  checkMilestones(gameTimeSeconds: number): void {
    for (const milestone of this.milestones) {
      if (!milestone.reached && gameTimeSeconds >= milestone.timeSeconds) {
        milestone.reached = true;
        this.announceMilestone(milestone.message);
      }
    }
    this._lastGameTime = gameTimeSeconds;
  }

  /**
   * Update announcer (called each frame).
   */
  update(dt: number): void {
    // Process announcement queue
    if (!this.currentAnnouncement && this.announcementQueue.length > 0) {
      const next = this.announcementQueue.shift();
      if (next) {
        this.showAnnouncement(next.type, next.mainText, next.subText, next.duration);
      }
    }

    // Update current announcement
    if (this.currentAnnouncement) {
      const elapsed = this.scene.time.now - this.currentAnnouncement.startTime;
      if (elapsed >= this.currentAnnouncement.duration) {
        this.hideCurrentAnnouncement();
      }
    }
  }

  /**
   * Reset announcer state (for new game).
   */
  reset(): void {
    // Clear queue
    this.announcementQueue = [];

    // Destroy current announcement
    if (this.currentAnnouncement) {
      this.currentAnnouncement.container.destroy();
      this.currentAnnouncement = null;
    }

    // Reset milestones
    this.milestones = SURVIVAL_MILESTONES.map(m => ({ ...m }));
    this._lastGameTime = 0;
  }

  /**
   * Resize handler.
   */
  resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;

    // Reposition current announcement if exists
    if (this.currentAnnouncement) {
      this.currentAnnouncement.container.setPosition(width / 2, height / 2 - 50);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.reset();
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Queue an announcement.
   */
  private queueAnnouncement(announcement: {
    type: AnnouncementType;
    mainText: string;
    subText?: string;
    duration?: number;
  }): void {
    // Boss announcements take priority and clear queue
    if (announcement.type === AnnouncementType.BossIncoming) {
      this.announcementQueue = [];
      if (this.currentAnnouncement) {
        this.hideCurrentAnnouncement();
      }
    }

    this.announcementQueue.push(announcement);
  }

  /**
   * Show an announcement on screen.
   */
  private showAnnouncement(
    type: AnnouncementType,
    mainText: string,
    subText?: string,
    duration: number = 2000
  ): void {
    const style = AnnouncementStyles[type];
    const centerX = this.screenWidth / 2;
    const centerY = this.screenHeight / 2 - 50;

    // Create container
    const container = this.scene.add.container(centerX, centerY);
    container.setDepth(UIDepth.OVERLAY + 10);
    container.setScrollFactor(0);

    // Calculate color hex strings
    const primaryHex = `#${style.primaryColor.toString(16).padStart(6, '0')}`;
    const secondaryHex = `#${style.secondaryColor.toString(16).padStart(6, '0')}`;

    // Create glow effect (multiple layers)
    const glowText = this.scene.add.text(0, 0, mainText, {
      fontFamily: UIFonts.TITLE,
      fontSize: '72px',
      color: primaryHex,
    });
    glowText.setOrigin(0.5);
    glowText.setAlpha(0.3);
    glowText.setScale(1.1);
    glowText.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glowText);

    // Main text
    const mainTextObj = this.scene.add.text(0, 0, mainText, {
      fontFamily: UIFonts.TITLE,
      fontSize: '64px',
      color: primaryHex,
      stroke: style.strokeColor,
      strokeThickness: 6,
    });
    mainTextObj.setOrigin(0.5);
    container.add(mainTextObj);

    // Sub text (if provided)
    let subTextObj: Phaser.GameObjects.Text | null = null;
    if (subText) {
      subTextObj = this.scene.add.text(0, 50, subText, {
        fontFamily: UIFonts.TITLE,
        fontSize: '32px',
        color: secondaryHex,
        stroke: style.strokeColor,
        strokeThickness: 4,
      });
      subTextObj.setOrigin(0.5);
      container.add(subTextObj);
    }

    // Warning icons for boss (simulated with text)
    if (type === AnnouncementType.BossIncoming) {
      const warningLeft = this.scene.add.text(-220, 0, '!', {
        fontFamily: UIFonts.TITLE,
        fontSize: '48px',
        color: '#ff6600',
        stroke: '#330000',
        strokeThickness: 4,
      });
      warningLeft.setOrigin(0.5);
      container.add(warningLeft);

      const warningRight = this.scene.add.text(220, 0, '!', {
        fontFamily: UIFonts.TITLE,
        fontSize: '48px',
        color: '#ff6600',
        stroke: '#330000',
        strokeThickness: 4,
      });
      warningRight.setOrigin(0.5);
      container.add(warningRight);

      // Animate warning icons
      this.scene.tweens.add({
        targets: [warningLeft, warningRight],
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Initial state (for zoom-in animation)
    container.setAlpha(0);
    container.setScale(0.3);

    // Store announcement
    this.currentAnnouncement = {
      container,
      type,
      startTime: this.scene.time.now,
      duration,
    };

    // Animate in with zoom effect
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Apply shake effect after zoom in
        if (style.shakeIntensity > 0) {
          this.scene.cameras.main.shake(500, style.shakeIntensity);
        }

        // Subtle pulsing animation
        this.scene.tweens.add({
          targets: mainTextObj,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        // Glow pulsing
        this.scene.tweens.add({
          targets: glowText,
          alpha: 0.5,
          scale: 1.15,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // Schedule fade out
    this.scene.time.delayedCall(duration - 500, () => {
      if (this.currentAnnouncement && this.currentAnnouncement.container === container) {
        this.scene.tweens.add({
          targets: container,
          alpha: 0,
          y: centerY - 30,
          duration: 500,
          ease: 'Quad.easeIn',
        });
      }
    });

    // Play sound effect based on type
    this.playAnnouncementSound(type);

    // Create particle effect for milestone and wave complete
    if (type === AnnouncementType.Milestone || type === AnnouncementType.WaveComplete) {
      this.createCelebrationParticles(type);
    }

    // Create danger particles for boss
    if (type === AnnouncementType.BossIncoming) {
      this.createDangerParticles();
    }
  }

  /**
   * Hide current announcement.
   */
  private hideCurrentAnnouncement(): void {
    if (!this.currentAnnouncement) return;

    const container = this.currentAnnouncement.container;
    this.currentAnnouncement = null;

    // Destroy container
    this.scene.tweens.killTweensOf(container);
    container.destroy();
  }

  /**
   * Play appropriate sound for announcement type.
   */
  private playAnnouncementSound(type: AnnouncementType): void {
    try {
      switch (type) {
        case AnnouncementType.WaveStart:
          this.scene.sound.play('sfx_powerup', { volume: 0.4 });
          break;
        case AnnouncementType.BossIncoming:
          // Play warning sound multiple times
          this.scene.sound.play('sfx_hit', { volume: 0.5 });
          this.scene.time.delayedCall(200, () => {
            this.scene.sound.play('sfx_hit', { volume: 0.4 });
          });
          this.scene.time.delayedCall(400, () => {
            this.scene.sound.play('sfx_hit', { volume: 0.3 });
          });
          break;
        case AnnouncementType.WaveComplete:
          this.scene.sound.play('sfx_levelup', { volume: 0.5 });
          break;
        case AnnouncementType.Milestone:
          this.scene.sound.play('sfx_levelup', { volume: 0.6 });
          break;
      }
    } catch {
      // Sound not loaded, ignore
    }
  }

  /**
   * Create celebration particles for positive announcements.
   */
  private createCelebrationParticles(type: AnnouncementType): void {
    const style = AnnouncementStyles[type];
    const centerX = this.screenWidth / 2;
    const centerY = this.screenHeight / 2 - 50;

    // Check if star particle texture exists
    if (!this.scene.textures.exists('star')) {
      return;
    }

    // Create burst of particles
    const particles = this.scene.add.particles(centerX, centerY, 'star', {
      speed: { min: 150, max: 350 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 20,
      blendMode: Phaser.BlendModes.ADD,
      tint: [style.primaryColor, style.secondaryColor],
    });
    particles.setDepth(UIDepth.OVERLAY + 9);
    particles.setScrollFactor(0);

    // Destroy particles after emission
    this.scene.time.delayedCall(200, () => {
      particles.stop();
    });
    this.scene.time.delayedCall(1200, () => {
      particles.destroy();
    });
  }

  /**
   * Create danger particles for boss announcement.
   */
  private createDangerParticles(): void {
    const _centerX = this.screenWidth / 2;
    const centerY = this.screenHeight / 2 - 50;

    // Check if fire particle texture exists
    if (!this.scene.textures.exists('fire')) {
      return;
    }

    // Create warning particles from edges
    const leftParticles = this.scene.add.particles(0, centerY, 'fire', {
      speedX: { min: 200, max: 400 },
      speedY: { min: -50, max: 50 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 600,
      quantity: 2,
      frequency: 50,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff0000, 0xff6600],
    });
    leftParticles.setDepth(UIDepth.OVERLAY + 8);
    leftParticles.setScrollFactor(0);

    const rightParticles = this.scene.add.particles(this.screenWidth, centerY, 'fire', {
      speedX: { min: -400, max: -200 },
      speedY: { min: -50, max: 50 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 600,
      quantity: 2,
      frequency: 50,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff0000, 0xff6600],
    });
    rightParticles.setDepth(UIDepth.OVERLAY + 8);
    rightParticles.setScrollFactor(0);

    // Stop and destroy after boss announcement
    this.scene.time.delayedCall(2000, () => {
      leftParticles.stop();
      rightParticles.stop();
    });
    this.scene.time.delayedCall(3000, () => {
      leftParticles.destroy();
      rightParticles.destroy();
    });
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a WaveAnnouncer instance.
 */
export function createWaveAnnouncer(
  scene: Phaser.Scene,
  config?: WaveAnnouncerConfig
): WaveAnnouncer {
  return new WaveAnnouncer(scene, config);
}
