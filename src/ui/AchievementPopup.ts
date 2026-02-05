/**
 * AchievementPopup - Achievement notification system for Cosmic Survivors.
 *
 * Features:
 * - Slide-in popup from right side when achievement unlocked
 * - Shows achievement icon, name, description
 * - Gold border animation
 * - Sound effect trigger via EventBus
 * - Auto-dismiss after 3 seconds
 * - Queue multiple achievements
 */

import * as Phaser from 'phaser';
import type { IAchievement, AchievementRarity } from '@shared/interfaces/IMeta';
import type { IEventBus } from '@shared/interfaces/IEventBus';
import { GameEvents } from '@shared/interfaces/IEventBus';
import { UIColors, UIFonts, UIDepth } from './UIConstants';
import { GAME_WIDTH } from '@shared/constants/game';

/**
 * Configuration for AchievementPopup.
 */
export interface AchievementPopupConfig {
  scene: Phaser.Scene;
  eventBus?: IEventBus;
  screenWidth?: number;
  displayDuration?: number;
  slideInDuration?: number;
  slideOutDuration?: number;
}

/**
 * Queued achievement item.
 */
interface QueuedAchievement {
  achievement: IAchievement;
  rewards?: { xp?: number; gold?: number; talentPoints?: number };
}

/**
 * Active popup instance.
 */
interface ActivePopup {
  container: Phaser.GameObjects.Container;
  startTime: number;
  phase: 'sliding-in' | 'displaying' | 'sliding-out' | 'done';
  borderGlow: Phaser.GameObjects.Graphics;
  glowTween?: Phaser.Tweens.Tween;
}

/**
 * Rarity colors for achievements.
 */
const RARITY_COLORS: Record<AchievementRarity, number> = {
  common: UIColors.RARITY_COMMON,
  uncommon: UIColors.RARITY_UNCOMMON,
  rare: UIColors.RARITY_RARE,
  epic: UIColors.RARITY_EPIC,
  legendary: UIColors.RARITY_LEGENDARY,
};

/**
 * AchievementPopup implementation.
 */
export class AchievementPopup {
  private scene: Phaser.Scene;
  private eventBus?: IEventBus;

  // Configuration
  private readonly screenWidth: number;
  private readonly displayDuration: number;
  private readonly slideInDuration: number;
  private readonly slideOutDuration: number;

  // Popup dimensions
  private readonly popupWidth = 350;
  private readonly popupHeight = 100;
  private readonly popupMargin = 20;
  private readonly iconSize = 64;

  // State
  private queue: QueuedAchievement[] = [];
  private activePopup: ActivePopup | null = null;
  private isProcessing = false;

  // Container for all popups (fixed to camera)
  private container: Phaser.GameObjects.Container;

  constructor(config: AchievementPopupConfig) {
    this.scene = config.scene;
    this.eventBus = config.eventBus;
    this.screenWidth = config.screenWidth ?? GAME_WIDTH;
    this.displayDuration = config.displayDuration ?? 3000;
    this.slideInDuration = config.slideInDuration ?? 400;
    this.slideOutDuration = config.slideOutDuration ?? 300;

    // Create main container (fixed to camera)
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(UIDepth.NOTIFICATIONS + 10);
    this.container.setScrollFactor(0);

    // Subscribe to achievement events if eventBus provided
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for achievement unlocks.
   */
  private setupEventListeners(): void {
    if (!this.eventBus) return;

    // Listen for achievement unlock events
    this.eventBus.on('achievement:unlocked', (data: {
      achievement: IAchievement;
      rewards: { xp?: number; gold?: number; talentPoints?: number };
    }) => {
      this.queueAchievement(data.achievement, data.rewards);
    });
  }

  /**
   * Queue an achievement for display.
   */
  queueAchievement(
    achievement: IAchievement,
    rewards?: { xp?: number; gold?: number; talentPoints?: number }
  ): void {
    this.queue.push({ achievement, rewards });
    this.processQueue();
  }

  /**
   * Process the achievement queue.
   */
  private processQueue(): void {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;
    this.showPopup(item);
  }

  /**
   * Show a popup for an achievement.
   */
  private showPopup(item: QueuedAchievement): void {
    const { achievement, rewards } = item;

    // Create popup container
    const popupContainer = this.scene.add.container(
      this.screenWidth + this.popupWidth, // Start off-screen right
      this.popupMargin
    );

    // Get rarity color
    const rarityColor = RARITY_COLORS[achievement.rarity] ?? UIColors.RARITY_COMMON;

    // Create border glow graphics (animated)
    const borderGlow = this.scene.add.graphics();
    this.drawBorderGlow(borderGlow, rarityColor, 1.0);
    popupContainer.add(borderGlow);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(UIColors.PANEL_BG, 0.95);
    bg.fillRoundedRect(0, 0, this.popupWidth, this.popupHeight, 8);
    bg.lineStyle(2, rarityColor);
    bg.strokeRoundedRect(0, 0, this.popupWidth, this.popupHeight, 8);
    popupContainer.add(bg);

    // Achievement icon background
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(UIColors.PANEL_HEADER, 1);
    iconBg.fillRoundedRect(10, 10, this.iconSize + 8, this.iconSize + 8, 6);
    iconBg.lineStyle(2, rarityColor);
    iconBg.strokeRoundedRect(10, 10, this.iconSize + 8, this.iconSize + 8, 6);
    popupContainer.add(iconBg);

    // Achievement icon (placeholder star)
    const icon = this.scene.add.text(
      14 + this.iconSize / 2 + 4,
      14 + this.iconSize / 2 + 4,
      this.getAchievementIcon(achievement.rarity),
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '36px',
        color: Phaser.Display.Color.IntegerToColor(rarityColor).rgba,
      }
    );
    icon.setOrigin(0.5);
    popupContainer.add(icon);

    // "ACHIEVEMENT UNLOCKED" header
    const header = this.scene.add.text(
      this.iconSize + 30,
      12,
      'ACHIEVEMENT UNLOCKED',
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '11px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.ACCENT).rgba,
        fontStyle: 'bold',
      }
    );
    popupContainer.add(header);

    // Achievement name
    const nameText = this.scene.add.text(
      this.iconSize + 30,
      28,
      achievement.name,
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(rarityColor).rgba,
        fontStyle: 'bold',
        wordWrap: { width: this.popupWidth - this.iconSize - 50 },
      }
    );
    popupContainer.add(nameText);

    // Achievement description
    const descText = this.scene.add.text(
      this.iconSize + 30,
      50,
      achievement.description,
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '12px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
        wordWrap: { width: this.popupWidth - this.iconSize - 50 },
      }
    );
    popupContainer.add(descText);

    // Rewards display (if any)
    if (rewards && (rewards.xp || rewards.gold || rewards.talentPoints)) {
      const rewardParts: string[] = [];
      if (rewards.xp) rewardParts.push(`+${rewards.xp} XP`);
      if (rewards.gold) rewardParts.push(`+${rewards.gold} Gold`);
      if (rewards.talentPoints) rewardParts.push(`+${rewards.talentPoints} Talent Points`);

      const rewardText = this.scene.add.text(
        this.iconSize + 30,
        72,
        rewardParts.join('  '),
        {
          fontFamily: UIFonts.PRIMARY,
          fontSize: '11px',
          color: Phaser.Display.Color.IntegerToColor(UIColors.SUCCESS).rgba,
        }
      );
      popupContainer.add(rewardText);
    }

    // Add to main container
    this.container.add(popupContainer);

    // Create active popup tracking
    this.activePopup = {
      container: popupContainer,
      startTime: this.scene.time.now,
      phase: 'sliding-in',
      borderGlow,
    };

    // Start border glow animation
    this.startGlowAnimation(borderGlow, rarityColor);

    // Play sound effect
    this.playSoundEffect(achievement.rarity);

    // Slide in animation
    this.scene.tweens.add({
      targets: popupContainer,
      x: this.screenWidth - this.popupWidth - this.popupMargin,
      duration: this.slideInDuration,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.activePopup) {
          this.activePopup.phase = 'displaying';
          this.activePopup.startTime = this.scene.time.now;
        }
      },
    });

    // Scale pop effect
    popupContainer.setScale(0.8);
    this.scene.tweens.add({
      targets: popupContainer,
      scaleX: 1,
      scaleY: 1,
      duration: this.slideInDuration,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Draw border glow effect.
   */
  private drawBorderGlow(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    intensity: number
  ): void {
    graphics.clear();

    // Outer glow layers
    for (let i = 3; i >= 0; i--) {
      const alpha = (0.15 * intensity) * (1 - i / 4);
      graphics.lineStyle(4 + i * 3, color, alpha);
      graphics.strokeRoundedRect(
        -2 - i * 2,
        -2 - i * 2,
        this.popupWidth + 4 + i * 4,
        this.popupHeight + 4 + i * 4,
        10 + i * 2
      );
    }
  }

  /**
   * Start glow animation.
   */
  private startGlowAnimation(
    graphics: Phaser.GameObjects.Graphics,
    color: number
  ): void {
    if (!this.activePopup) return;

    const glowIntensity = { value: 1.0 };

    this.activePopup.glowTween = this.scene.tweens.add({
      targets: glowIntensity,
      value: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.drawBorderGlow(graphics, color, glowIntensity.value);
      },
    });
  }

  /**
   * Get achievement icon based on rarity.
   */
  private getAchievementIcon(rarity: AchievementRarity): string {
    switch (rarity) {
      case 'legendary':
        return '\u2605'; // Filled star
      case 'epic':
        return '\u2606'; // Empty star
      case 'rare':
        return '\u2726'; // Four pointed star
      case 'uncommon':
        return '\u2736'; // Six pointed star
      default:
        return '\u2713'; // Checkmark
    }
  }

  /**
   * Play achievement sound effect.
   */
  private playSoundEffect(rarity: AchievementRarity): void {
    if (!this.eventBus) return;

    // Map rarity to sound key
    let sfxKey = 'achievement_common';
    switch (rarity) {
      case 'legendary':
        sfxKey = 'achievement_legendary';
        break;
      case 'epic':
        sfxKey = 'achievement_epic';
        break;
      case 'rare':
        sfxKey = 'achievement_rare';
        break;
      case 'uncommon':
        sfxKey = 'achievement_uncommon';
        break;
    }

    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: sfxKey,
      volume: 0.8,
    });
  }

  /**
   * Update the popup system.
   */
  update(_dt: number): void {
    if (!this.activePopup) return;

    const now = this.scene.time.now;
    const elapsed = now - this.activePopup.startTime;

    switch (this.activePopup.phase) {
      case 'displaying':
        if (elapsed >= this.displayDuration) {
          this.startSlideOut();
        }
        break;

      case 'sliding-out':
        // Handled by tween
        break;

      case 'done':
        // Cleanup and process next
        this.cleanupCurrentPopup();
        break;
    }
  }

  /**
   * Start slide out animation.
   */
  private startSlideOut(): void {
    if (!this.activePopup) return;

    this.activePopup.phase = 'sliding-out';

    // Stop glow animation
    if (this.activePopup.glowTween) {
      this.activePopup.glowTween.stop();
    }

    // Slide out animation
    this.scene.tweens.add({
      targets: this.activePopup.container,
      x: this.screenWidth + this.popupWidth,
      alpha: 0,
      duration: this.slideOutDuration,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.activePopup) {
          this.activePopup.phase = 'done';
        }
      },
    });
  }

  /**
   * Cleanup current popup and process next.
   */
  private cleanupCurrentPopup(): void {
    if (this.activePopup) {
      this.activePopup.container.destroy();
      this.activePopup = null;
    }

    this.isProcessing = false;

    // Process next in queue
    if (this.queue.length > 0) {
      // Small delay between popups
      this.scene.time.delayedCall(200, () => {
        this.processQueue();
      });
    }
  }

  /**
   * Manually dismiss current popup.
   */
  dismiss(): void {
    if (this.activePopup && this.activePopup.phase === 'displaying') {
      this.startSlideOut();
    }
  }

  /**
   * Clear all queued achievements.
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Get number of queued achievements.
   */
  get queueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if popup is currently showing.
   */
  get isShowing(): boolean {
    return this.activePopup !== null && this.activePopup.phase !== 'done';
  }

  /**
   * Resize handler.
   */
  resize(width: number, _height: number): void {
    // Update screen width reference - TypeScript requires casting through unknown
    (this as unknown as { screenWidth: number }).screenWidth = width;

    // Reposition active popup if displaying
    if (this.activePopup && this.activePopup.phase === 'displaying') {
      this.activePopup.container.setX(width - this.popupWidth - this.popupMargin);
    }
  }

  /**
   * Destroy and cleanup.
   */
  destroy(): void {
    // Stop any active tweens
    if (this.activePopup?.glowTween) {
      this.activePopup.glowTween.stop();
    }

    // Destroy containers
    if (this.activePopup) {
      this.activePopup.container.destroy();
    }
    this.container.destroy();

    // Clear queue
    this.queue = [];
    this.activePopup = null;
    this.isProcessing = false;
  }
}
