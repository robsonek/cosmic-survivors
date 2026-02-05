/**
 * DifficultySelectionScreen - Pre-game difficulty selection UI.
 *
 * Features:
 * - Three difficulty options with visual cards
 * - High score display per difficulty
 * - Locked/unlocked state for Nightmare
 * - Keyboard and mouse support
 * - Animated transitions
 *
 * Phaser 4, TypeScript
 */

import * as Phaser from 'phaser';
import {
  DifficultyMode,
  DifficultyConfig,
  DIFFICULTY_CONFIGS,
  difficultySystem,
} from '../../systems/DifficultySystem';
import { UIColors, UIDepth, UIAnimations, UIFonts } from '../UIConstants';

// ============================================================================
// TYPES
// ============================================================================

export interface DifficultySelectionScreenConfig {
  screenWidth: number;
  screenHeight: number;
  onSelect: (mode: DifficultyMode) => void;
  onBack?: () => void;
}

interface DifficultyCard {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  mode: DifficultyMode;
  config: DifficultyConfig;
  isLocked: boolean;
}

// ============================================================================
// DIFFICULTY SELECTION SCREEN
// ============================================================================

export class DifficultySelectionScreen {
  private scene: Phaser.Scene;
  private config: DifficultySelectionScreenConfig;

  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private cards: DifficultyCard[] = [];
  private selectedIndex: number = 1; // Default to Normal
  private keyboardKeys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    enter: Phaser.Input.Keyboard.Key;
    one: Phaser.Input.Keyboard.Key;
    two: Phaser.Input.Keyboard.Key;
    three: Phaser.Input.Keyboard.Key;
    escape: Phaser.Input.Keyboard.Key;
  };
  private isVisible: boolean = false;
  private instructionText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: DifficultySelectionScreenConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  // ============================================================================
  // CREATION
  // ============================================================================

  private create(): void {
    const { screenWidth, screenHeight } = this.config;

    // Container for all elements
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(UIDepth.SCREENS);
    this.container.setVisible(false);

    // Semi-transparent overlay
    this.overlay = this.scene.add.rectangle(
      screenWidth / 2,
      screenHeight / 2,
      screenWidth,
      screenHeight,
      UIColors.OVERLAY_BG,
      0.9
    );
    this.container.add(this.overlay);

    // Title
    this.title = this.scene.add.text(
      screenWidth / 2,
      80,
      'SELECT DIFFICULTY',
      {
        fontFamily: UIFonts.TITLE,
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5);
    this.container.add(this.title);

    // Subtitle with dynamic content
    this.subtitle = this.scene.add.text(
      screenWidth / 2,
      130,
      'Choose your challenge level',
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '18px',
        color: '#aaaaaa',
      }
    ).setOrigin(0.5);
    this.container.add(this.subtitle);

    // Create difficulty cards
    this.createDifficultyCards();

    // Instruction text
    this.instructionText = this.scene.add.text(
      screenWidth / 2,
      screenHeight - 60,
      '[1/2/3] Select  |  [ENTER] Confirm  |  [ESC] Back',
      {
        fontFamily: UIFonts.MONO,
        fontSize: '14px',
        color: '#888888',
      }
    ).setOrigin(0.5);
    this.container.add(this.instructionText);

    // Setup keyboard input
    this.setupKeyboard();
  }

  private createDifficultyCards(): void {
    const { screenWidth, screenHeight } = this.config;
    const cardWidth = 260;
    const cardHeight = 360;
    const cardGap = 30;
    const totalWidth = cardWidth * 3 + cardGap * 2;
    const startX = (screenWidth - totalWidth) / 2 + cardWidth / 2;
    const cardY = screenHeight / 2 + 20;

    const modes = [DifficultyMode.Easy, DifficultyMode.Normal, DifficultyMode.Nightmare];

    modes.forEach((mode, index) => {
      const x = startX + index * (cardWidth + cardGap);
      const card = this.createCard(mode, x, cardY, cardWidth, cardHeight);
      this.cards.push(card);
    });

    // Initial selection highlight
    this.updateSelection();
  }

  private createCard(
    mode: DifficultyMode,
    x: number,
    y: number,
    width: number,
    height: number
  ): DifficultyCard {
    const config = DIFFICULTY_CONFIGS[mode];
    const isLocked = !difficultySystem.isModeUnlocked(mode);
    const highScore = difficultySystem.getHighScore(mode);

    // Container for the card
    const container = this.scene.add.container(x, y);
    this.container.add(container);

    // Background graphics
    const background = this.scene.add.graphics();
    this.drawCardBackground(background, width, height, config.color, false, isLocked);
    container.add(background);

    // Icon/difficulty indicator
    const iconY = -height / 2 + 45;
    const iconText = this.scene.add.text(0, iconY, config.icon, {
      fontFamily: UIFonts.MONO,
      fontSize: '32px',
      color: isLocked ? '#666666' : `#${config.color.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    container.add(iconText);

    // Title
    const titleY = iconY + 50;
    const titleText = this.scene.add.text(0, titleY, config.name.toUpperCase(), {
      fontFamily: UIFonts.TITLE,
      fontSize: '28px',
      color: isLocked ? '#666666' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(titleText);

    // Description
    const descY = titleY + 45;
    const descText = this.scene.add.text(0, descY, config.description, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '13px',
      color: isLocked ? '#555555' : '#aaaaaa',
      align: 'center',
      wordWrap: { width: width - 30 },
    }).setOrigin(0.5);
    container.add(descText);

    // Stats display
    const statsY = descY + 55;
    const statsText = this.createStatsText(config, isLocked);
    const stats = this.scene.add.text(0, statsY, statsText, {
      fontFamily: UIFonts.MONO,
      fontSize: '11px',
      color: isLocked ? '#444444' : '#888888',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    container.add(stats);

    // High score section
    const hsY = height / 2 - 80;
    const hsLabel = this.scene.add.text(0, hsY, 'HIGH SCORE', {
      fontFamily: UIFonts.MONO,
      fontSize: '10px',
      color: isLocked ? '#444444' : '#666666',
    }).setOrigin(0.5);
    container.add(hsLabel);

    const hsValue = highScore
      ? `${highScore.score.toLocaleString()}\n${difficultySystem.formatTime(highScore.timeSurvived)} | Wave ${highScore.waveReached}`
      : 'No record';
    const hsText = this.scene.add.text(0, hsY + 28, hsValue, {
      fontFamily: UIFonts.MONO,
      fontSize: '14px',
      color: isLocked ? '#444444' : (highScore ? `#${config.color.toString(16).padStart(6, '0')}` : '#555555'),
      align: 'center',
    }).setOrigin(0.5);
    container.add(hsText);

    // Lock overlay for locked difficulties
    if (isLocked) {
      const lockOverlay = this.scene.add.graphics();
      lockOverlay.fillStyle(0x000000, 0.6);
      lockOverlay.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
      container.add(lockOverlay);

      const lockIcon = this.scene.add.text(0, -20, 'LOCKED', {
        fontFamily: UIFonts.TITLE,
        fontSize: '24px',
        color: '#ff4444',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      container.add(lockIcon);

      if (config.unlockRequirement) {
        const unlockText = this.scene.add.text(0, 20, config.unlockRequirement, {
          fontFamily: UIFonts.PRIMARY,
          fontSize: '12px',
          color: '#888888',
          align: 'center',
          wordWrap: { width: width - 40 },
        }).setOrigin(0.5);
        container.add(unlockText);

        // Progress bar for Nightmare unlock
        if (mode === DifficultyMode.Nightmare) {
          const progress = difficultySystem.getNightmareUnlockProgress();
          const barWidth = width - 60;
          const barY = 55;

          const barBg = this.scene.add.graphics();
          barBg.fillStyle(0x333333, 1);
          barBg.fillRoundedRect(-barWidth / 2, barY, barWidth, 12, 4);
          container.add(barBg);

          if (progress > 0) {
            const barFill = this.scene.add.graphics();
            barFill.fillStyle(config.color, 1);
            barFill.fillRoundedRect(-barWidth / 2 + 2, barY + 2, (barWidth - 4) * progress, 8, 3);
            container.add(barFill);
          }

          const progressText = this.scene.add.text(0, barY + 22, `${Math.round(progress * 100)}%`, {
            fontFamily: UIFonts.MONO,
            fontSize: '11px',
            color: '#666666',
          }).setOrigin(0.5);
          container.add(progressText);
        }
      }
    }

    // Make card interactive
    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: !isLocked });
    container.add(hitArea);

    if (!isLocked) {
      hitArea.on('pointerover', () => {
        const idx = this.cards.findIndex(c => c.mode === mode);
        if (idx !== -1) {
          this.selectedIndex = idx;
          this.updateSelection();
        }
      });

      hitArea.on('pointerdown', () => {
        this.selectDifficulty(mode);
      });
    }

    return {
      container,
      background,
      mode,
      config,
      isLocked,
    };
  }

  private createStatsText(config: DifficultyConfig, isLocked: boolean): string {
    const m = config.multipliers;
    const lines: string[] = [];

    const formatMult = (value: number, label: string): string => {
      if (value === 1.0) return `${label}: 100%`;
      return `${label}: ${Math.round(value * 100)}%`;
    };

    lines.push(formatMult(m.enemyHpMultiplier, 'Enemy HP'));
    lines.push(formatMult(m.enemyDamageMultiplier, 'Enemy DMG'));
    if (m.enemySpeedMultiplier !== 1.0) {
      lines.push(formatMult(m.enemySpeedMultiplier, 'Enemy SPD'));
    }
    lines.push(formatMult(m.xpMultiplier, 'XP Gain'));

    return lines.join('\n');
  }

  private drawCardBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    color: number,
    selected: boolean,
    locked: boolean
  ): void {
    graphics.clear();

    // Shadow
    if (selected && !locked) {
      graphics.fillStyle(color, 0.3);
      graphics.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width, height, 12);
    }

    // Background
    graphics.fillStyle(locked ? 0x1a1a1a : UIColors.PANEL_BG, 1);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 12);

    // Border
    const borderColor = selected ? color : (locked ? 0x333333 : UIColors.BORDER);
    const borderWidth = selected ? 3 : 2;
    graphics.lineStyle(borderWidth, borderColor, 1);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);

    // Glow effect when selected
    if (selected && !locked) {
      graphics.lineStyle(2, color, 0.5);
      graphics.strokeRoundedRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 14);
    }
  }

  // ============================================================================
  // SELECTION
  // ============================================================================

  private updateSelection(): void {
    this.cards.forEach((card, index) => {
      const isSelected = index === this.selectedIndex;
      const width = 260;
      const height = 360;

      // Redraw background with selection state
      this.drawCardBackground(
        card.background,
        width,
        height,
        card.config.color,
        isSelected,
        card.isLocked
      );

      // Scale animation
      if (isSelected && !card.isLocked) {
        this.scene.tweens.add({
          targets: card.container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: UIAnimations.FAST,
          ease: 'Back.easeOut',
        });
      } else {
        this.scene.tweens.add({
          targets: card.container,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: UIAnimations.FAST,
          ease: 'Sine.easeOut',
        });
      }
    });
  }

  private selectDifficulty(mode: DifficultyMode): void {
    if (!difficultySystem.isModeUnlocked(mode)) {
      // Play error sound or show message
      this.scene.cameras.main.shake(100, 0.005);
      return;
    }

    // Set difficulty
    difficultySystem.setMode(mode);

    // Animate selection
    const card = this.cards.find(c => c.mode === mode);
    if (card) {
      this.scene.tweens.add({
        targets: card.container,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.hide();
          this.config.onSelect(mode);
        },
      });
    }
  }

  // ============================================================================
  // KEYBOARD
  // ============================================================================

  private setupKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.keyboardKeys = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      enter: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      one: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      two: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      three: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
  }

  /**
   * Handle keyboard input (call in scene update).
   */
  handleInput(): void {
    if (!this.isVisible) return;

    // Number keys for direct selection
    if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.one)) {
      this.selectedIndex = 0;
      this.updateSelection();
      this.selectDifficulty(DifficultyMode.Easy);
    } else if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.two)) {
      this.selectedIndex = 1;
      this.updateSelection();
      this.selectDifficulty(DifficultyMode.Normal);
    } else if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.three)) {
      this.selectedIndex = 2;
      this.updateSelection();
      this.selectDifficulty(DifficultyMode.Nightmare);
    }

    // Arrow key navigation
    if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.left)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateSelection();
    } else if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.right)) {
      this.selectedIndex = Math.min(this.cards.length - 1, this.selectedIndex + 1);
      this.updateSelection();
    }

    // Enter to confirm
    if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.enter)) {
      const selectedCard = this.cards[this.selectedIndex];
      if (selectedCard) {
        this.selectDifficulty(selectedCard.mode);
      }
    }

    // Escape to go back
    if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.escape)) {
      if (this.config.onBack) {
        this.hide();
        this.config.onBack();
      }
    }
  }

  // ============================================================================
  // VISIBILITY
  // ============================================================================

  /**
   * Show the difficulty selection screen.
   */
  show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);

    // Refresh card states (in case unlocks changed)
    this.refreshCards();

    // Fade in animation
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: UIAnimations.SCREEN_TRANSITION,
      ease: 'Sine.easeOut',
    });
  }

  /**
   * Hide the difficulty selection screen.
   */
  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: UIAnimations.SCREEN_TRANSITION,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        this.isVisible = false;
      },
    });
  }

  /**
   * Check if screen is visible.
   */
  getVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Refresh card data (after unlock or new high score).
   */
  refreshCards(): void {
    // Update Nightmare locked state
    const nightmareCard = this.cards.find(c => c.mode === DifficultyMode.Nightmare);
    if (nightmareCard) {
      nightmareCard.isLocked = !difficultySystem.isModeUnlocked(DifficultyMode.Nightmare);
    }
    this.updateSelection();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Destroy all screen elements.
   */
  destroy(): void {
    this.container.destroy();
  }
}

export default DifficultySelectionScreen;
