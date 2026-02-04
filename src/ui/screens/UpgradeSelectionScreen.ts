/**
 * UpgradeSelectionScreen for Cosmic Survivors.
 * Displays upgrade choices when player levels up.
 */

import * as Phaser from 'phaser';
import type { IUIComponent, IUpgradeChoice } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes, getRarityColor, getRarityName } from '../UIConstants';

export interface UpgradeSelectionScreenConfig {
  screenWidth: number;
  screenHeight: number;
  autoSelectTimeout?: number; // Optional auto-select timer in seconds
}

interface UpgradeCard {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  choice: IUpgradeChoice;
  index: number;
}

export class UpgradeSelectionScreen implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private subtitle: Phaser.GameObjects.Text;
  private cards: UpgradeCard[] = [];
  private config: Required<UpgradeSelectionScreenConfig>;
  private _visible: boolean = false;
  private _interactive: boolean = true;

  private selectedIndex: number = -1;
  private resolvePromise?: (upgradeId: string) => void;
  private autoSelectTimer?: Phaser.Time.TimerEvent;
  private timerText?: Phaser.GameObjects.Text;
  private keyboardHandler?: (event: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, config: UpgradeSelectionScreenConfig) {
    this.id = `upgradescreen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      autoSelectTimeout: 0, // No auto-select by default
      ...config,
    };

    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.SCREENS);
    this.container.setVisible(false);
    this.container.setScrollFactor(0);

    // Create dark overlay
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(UIColors.OVERLAY_BG, 0.8);
    this.overlay.fillRect(0, 0, config.screenWidth, config.screenHeight);
    this.container.add(this.overlay);

    // Create title
    this.title = scene.add.text(
      config.screenWidth / 2,
      80,
      'LEVEL UP!',
      {
        fontFamily: UIFonts.TITLE,
        fontSize: `${UISizes.TITLE_FONT_SIZE}px`,
        color: Phaser.Display.Color.IntegerToColor(UIColors.ACCENT).rgba,
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    this.title.setOrigin(0.5);
    this.container.add(this.title);

    // Create subtitle
    this.subtitle = scene.add.text(
      config.screenWidth / 2,
      130,
      'Choose an upgrade',
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: `${UISizes.BODY_FONT_SIZE}px`,
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      }
    );
    this.subtitle.setOrigin(0.5);
    this.container.add(this.subtitle);

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    this.container.setVisible(value);
  }

  get interactive(): boolean {
    return this._interactive;
  }

  set interactive(value: boolean) {
    this._interactive = value;
  }

  /**
   * Show the screen (IUIComponent interface).
   */
  show(): void {
    // This is overridden by showWithChoices
    this.visible = true;
  }

  /**
   * Show upgrade selection with choices.
   * Returns a promise that resolves with the selected upgrade ID.
   */
  async showWithChoices(choices: IUpgradeChoice[]): Promise<string> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.clearCards();
      this.createCards(choices);
      this.visible = true;
      this.playEnterAnimation();

      // Start auto-select timer if configured
      if (this.config.autoSelectTimeout > 0) {
        this.startAutoSelectTimer();
      }
    });
  }

  private createCards(choices: IUpgradeChoice[]): void {
    const cardWidth = UISizes.UPGRADE_CARD_WIDTH;
    const gap = UISizes.UPGRADE_CARD_GAP;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (this.config.screenWidth - totalWidth) / 2;
    const centerY = this.config.screenHeight / 2;

    choices.forEach((choice, index) => {
      const x = startX + index * (cardWidth + gap) + cardWidth / 2;
      const y = centerY;
      const card = this.createCard(choice, index, x, y);
      this.cards.push(card);
    });
  }

  private createCard(choice: IUpgradeChoice, index: number, x: number, y: number): UpgradeCard {
    const cardWidth = UISizes.UPGRADE_CARD_WIDTH;
    const cardHeight = UISizes.UPGRADE_CARD_HEIGHT;
    const rarityColor = getRarityColor(choice.rarity);

    const cardContainer = this.scene.add.container(x, y);
    this.container.add(cardContainer);

    // Background
    const background = this.scene.add.graphics();
    this.drawCardBackground(background, cardWidth, cardHeight, rarityColor, false);
    cardContainer.add(background);

    // Rarity badge (top)
    const rarityBadge = this.scene.add.text(0, -cardHeight / 2 + 20, getRarityName(choice.rarity).toUpperCase(), {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '12px',
      color: Phaser.Display.Color.IntegerToColor(rarityColor).rgba,
      fontStyle: 'bold',
    });
    rarityBadge.setOrigin(0.5);
    cardContainer.add(rarityBadge);

    // Type badge
    const typeBadge = this.scene.add.text(0, -cardHeight / 2 + 40, choice.type.toUpperCase(), {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '10px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
    });
    typeBadge.setOrigin(0.5);
    cardContainer.add(typeBadge);

    // Icon placeholder
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(UIColors.PANEL_BG, 1);
    iconBg.fillCircle(0, -60, 40);
    iconBg.lineStyle(3, rarityColor);
    iconBg.strokeCircle(0, -60, 40);
    cardContainer.add(iconBg);

    // Try to add icon image
    if (this.scene.textures.exists(choice.icon)) {
      const icon = this.scene.add.image(0, -60, choice.icon);
      icon.setDisplaySize(60, 60);
      cardContainer.add(icon);
    } else {
      // Fallback text icon
      const iconText = this.scene.add.text(0, -60, '?', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '32px',
        color: Phaser.Display.Color.IntegerToColor(rarityColor).rgba,
      });
      iconText.setOrigin(0.5);
      cardContainer.add(iconText);
    }

    // Name
    const name = this.scene.add.text(0, 10, choice.name, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardWidth - 40 },
    });
    name.setOrigin(0.5);
    cardContainer.add(name);

    // Level indicator
    if (choice.currentLevel !== undefined) {
      const levelText = choice.maxLevel
        ? `Level ${choice.currentLevel} -> ${choice.currentLevel + 1}/${choice.maxLevel}`
        : `Level ${choice.currentLevel + 1}`;
      const level = this.scene.add.text(0, 40, levelText, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_XP).rgba,
      });
      level.setOrigin(0.5);
      cardContainer.add(level);
    }

    // New badge
    if (choice.isNew) {
      const newBadge = this.scene.add.text(-cardWidth / 2 + 30, -cardHeight / 2 + 20, 'NEW!', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.SUCCESS).rgba,
        fontStyle: 'bold',
      });
      newBadge.setOrigin(0.5);
      cardContainer.add(newBadge);
    }

    // Description
    const description = this.scene.add.text(0, 85, choice.description, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      align: 'center',
      wordWrap: { width: cardWidth - 40 },
    });
    description.setOrigin(0.5, 0);
    cardContainer.add(description);

    // Key hint
    const keyHint = this.scene.add.text(0, cardHeight / 2 - 30, `Press ${index + 1}`, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_ACCENT).rgba,
    });
    keyHint.setOrigin(0.5);
    cardContainer.add(keyHint);

    // Setup interaction
    const hitArea = new Phaser.Geom.Rectangle(
      -cardWidth / 2,
      -cardHeight / 2,
      cardWidth,
      cardHeight
    );
    cardContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    cardContainer.on('pointerover', () => {
      if (this._interactive) {
        this.highlightCard(index);
      }
    });

    cardContainer.on('pointerout', () => {
      if (this._interactive) {
        this.unhighlightCard(index);
      }
    });

    cardContainer.on('pointerdown', () => {
      if (this._interactive) {
        this.selectCard(index);
      }
    });

    return {
      container: cardContainer,
      background,
      choice,
      index,
    };
  }

  private drawCardBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    borderColor: number,
    highlighted: boolean
  ): void {
    graphics.clear();

    const x = -width / 2;
    const y = -height / 2;
    const radius = 12;
    const borderWidth = highlighted ? 4 : 2;

    // Shadow
    graphics.fillStyle(0x000000, 0.3);
    graphics.fillRoundedRect(x + 4, y + 4, width, height, radius);

    // Border
    graphics.fillStyle(borderColor, highlighted ? 1 : 0.5);
    graphics.fillRoundedRect(x, y, width, height, radius);

    // Background
    graphics.fillStyle(UIColors.PANEL_BG, 0.95);
    graphics.fillRoundedRect(
      x + borderWidth,
      y + borderWidth,
      width - borderWidth * 2,
      height - borderWidth * 2,
      radius - borderWidth
    );

    // Highlight glow
    if (highlighted) {
      graphics.lineStyle(2, borderColor, 0.5);
      graphics.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, radius + 2);
    }
  }

  private highlightCard(index: number): void {
    const card = this.cards[index];
    if (!card) return;

    this.selectedIndex = index;

    // Redraw background with highlight
    const rarityColor = getRarityColor(card.choice.rarity);
    this.drawCardBackground(
      card.background,
      UISizes.UPGRADE_CARD_WIDTH,
      UISizes.UPGRADE_CARD_HEIGHT,
      rarityColor,
      true
    );

    // Scale up animation
    this.scene.tweens.add({
      targets: card.container,
      scale: 1.05,
      duration: 100,
      ease: 'Quad.easeOut',
    });

    this.scene.game.canvas.style.cursor = 'pointer';
  }

  private unhighlightCard(index: number): void {
    const card = this.cards[index];
    if (!card) return;

    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
    }

    // Redraw background without highlight
    const rarityColor = getRarityColor(card.choice.rarity);
    this.drawCardBackground(
      card.background,
      UISizes.UPGRADE_CARD_WIDTH,
      UISizes.UPGRADE_CARD_HEIGHT,
      rarityColor,
      false
    );

    // Scale down animation
    this.scene.tweens.add({
      targets: card.container,
      scale: 1,
      duration: 100,
      ease: 'Quad.easeOut',
    });

    this.scene.game.canvas.style.cursor = 'default';
  }

  private selectCard(index: number): void {
    if (index < 0 || index >= this.cards.length) return;

    const card = this.cards[index];
    this._interactive = false;

    // Stop auto-select timer
    this.stopAutoSelectTimer();

    // Selection animation
    this.scene.tweens.add({
      targets: card.container,
      scale: 1.1,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });

    // Flash effect
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.5);
    flash.fillRoundedRect(
      -UISizes.UPGRADE_CARD_WIDTH / 2,
      -UISizes.UPGRADE_CARD_HEIGHT / 2,
      UISizes.UPGRADE_CARD_WIDTH,
      UISizes.UPGRADE_CARD_HEIGHT,
      12
    );
    card.container.add(flash);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        flash.destroy();
        this.playExitAnimation(() => {
          if (this.resolvePromise) {
            this.resolvePromise(card.choice.id);
            this.resolvePromise = undefined;
          }
        });
      },
    });
  }

  private setupKeyboardControls(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (!this._visible || !this._interactive) return;

      const key = event.key;
      if (key >= '1' && key <= '9') {
        const index = parseInt(key) - 1;
        if (index < this.cards.length) {
          this.selectCard(index);
        }
      }
    };

    window.addEventListener('keydown', this.keyboardHandler);
  }

  private playEnterAnimation(): void {
    // Title animation
    this.title.setAlpha(0);
    this.title.setY(60);
    this.scene.tweens.add({
      targets: this.title,
      alpha: 1,
      y: 80,
      duration: 300,
      ease: 'Quad.easeOut',
    });

    // Subtitle animation
    this.subtitle.setAlpha(0);
    this.scene.tweens.add({
      targets: this.subtitle,
      alpha: 1,
      duration: 300,
      delay: 100,
    });

    // Cards animation
    this.cards.forEach((card, index) => {
      card.container.setAlpha(0);
      card.container.setY(card.container.y + 50);
      this.scene.tweens.add({
        targets: card.container,
        alpha: 1,
        y: card.container.y - 50,
        duration: 300,
        delay: 150 + index * 100,
        ease: 'Back.easeOut',
      });
    });
  }

  private playExitAnimation(onComplete: () => void): void {
    // Fade out all cards
    this.cards.forEach((card, index) => {
      this.scene.tweens.add({
        targets: card.container,
        alpha: 0,
        y: card.container.y - 30,
        duration: 200,
        delay: index * 50,
      });
    });

    // Fade out overlay and title
    this.scene.tweens.add({
      targets: [this.overlay, this.title, this.subtitle],
      alpha: 0,
      duration: 200,
      delay: 150,
      onComplete: () => {
        this.visible = false;
        this.clearCards();
        onComplete();
      },
    });
  }

  private startAutoSelectTimer(): void {
    const timeout = this.config.autoSelectTimeout;

    // Create timer text
    this.timerText = this.scene.add.text(
      this.config.screenWidth / 2,
      this.config.screenHeight - 50,
      `Auto-selecting in ${timeout}s`,
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      }
    );
    this.timerText.setOrigin(0.5);
    this.container.add(this.timerText);

    let remaining = timeout;
    this.autoSelectTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        remaining--;
        if (this.timerText) {
          this.timerText.setText(`Auto-selecting in ${remaining}s`);
        }
        if (remaining <= 0) {
          this.stopAutoSelectTimer();
          // Auto-select first choice
          this.selectCard(0);
        }
      },
      repeat: timeout - 1,
    });
  }

  private stopAutoSelectTimer(): void {
    if (this.autoSelectTimer) {
      this.autoSelectTimer.destroy();
      this.autoSelectTimer = undefined;
    }
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = undefined;
    }
  }

  private clearCards(): void {
    this.cards.forEach(card => {
      card.container.destroy();
    });
    this.cards = [];
    this.selectedIndex = -1;
    this.scene.game.canvas.style.cursor = 'default';
  }

  update(_dt: number): void {
    // Screen doesn't need per-frame updates
  }

  hide(): void {
    this.stopAutoSelectTimer();
    this.playExitAnimation(() => {
      // Resolve with empty string if manually hidden
      if (this.resolvePromise) {
        this.resolvePromise('');
        this.resolvePromise = undefined;
      }
    });
  }

  destroy(): void {
    this.stopAutoSelectTimer();
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
    }
    this.clearCards();
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
