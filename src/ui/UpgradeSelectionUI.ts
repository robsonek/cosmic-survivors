/**
 * UpgradeSelectionUI for Cosmic Survivors.
 * Neon/sci-fi styled upgrade selection interface with advanced animations.
 *
 * Features:
 * - Displays 3 upgrade cards with neon glow effects
 * - Pauses game during selection
 * - Smooth enter/exit card animations
 * - Keyboard (1,2,3) and mouse input support
 * - Hover effects with scale and glow
 * - Pulse animation on selection
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIFonts, UIDepth } from './UIConstants';

// ============================================
// IUpgrade Interface
// ============================================

/**
 * Upgrade interface - import from UpgradeSystem when available.
 * Defined locally for standalone usage.
 */
export interface IUpgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: number;
  maxLevel: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// ============================================
// Neon Color Palette
// ============================================

const NeonColors = {
  CYAN: 0x00ffff,
  MAGENTA: 0xff00ff,
  GREEN: 0x39ff14,
  YELLOW: 0xffff00,
  ORANGE: 0xff6600,
  PURPLE: 0x9d00ff,
  PINK: 0xff1493,
  BLUE: 0x00bfff,

  // Background colors
  DARK_BG: 0x0a0a1a,
  CARD_BG: 0x12122a,
  OVERLAY: 0x000011,

  // Text colors
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xaaaacc,
  TEXT_ACCENT: 0x00ffff,
} as const;

// Rarity to neon color mapping
const RarityColors: Record<string, number> = {
  common: NeonColors.TEXT_SECONDARY,
  uncommon: NeonColors.GREEN,
  rare: NeonColors.CYAN,
  epic: NeonColors.MAGENTA,
  legendary: NeonColors.ORANGE,
};

// ============================================
// Configuration
// ============================================

export interface UpgradeSelectionUIConfig {
  screenWidth: number;
  screenHeight: number;
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
  animationDuration?: number;
}

interface UpgradeCard {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  glowGraphics: Phaser.GameObjects.Graphics;
  upgrade: IUpgrade;
  index: number;
  originalY: number;
  isHovered: boolean;
  pulseTween?: Phaser.Tweens.Tween;
}

// ============================================
// UpgradeSelectionUI Class
// ============================================

export class UpgradeSelectionUI implements IUIComponent {
  readonly id: string;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private scanlineOverlay: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private subtitle: Phaser.GameObjects.Text;
  private cards: UpgradeCard[] = [];

  private config: Required<UpgradeSelectionUIConfig>;
  private _visible: boolean = false;
  private _interactive: boolean = true;

  private hoveredIndex: number = -1;
  private onSelectCallback?: (upgrade: IUpgrade) => void;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private glowAnimationTimer?: Phaser.Time.TimerEvent;
  private scanlineOffset: number = 0;

  constructor(scene: Phaser.Scene, config: UpgradeSelectionUIConfig) {
    this.id = `upgrade_selection_ui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;

    this.config = {
      cardWidth: 260,
      cardHeight: 360,
      cardGap: 30,
      animationDuration: 300,
      ...config,
    };

    // Create main container
    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.MODALS);
    this.container.setVisible(false);
    this.container.setScrollFactor(0);

    // Create overlay background
    this.overlay = this.createOverlay();
    this.container.add(this.overlay);

    // Create scanline effect overlay
    this.scanlineOverlay = this.createScanlineOverlay();
    this.container.add(this.scanlineOverlay);

    // Create title
    this.title = this.createTitle();
    this.container.add(this.title);

    // Create subtitle
    this.subtitle = this.createSubtitle();
    this.container.add(this.subtitle);

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  // ============================================
  // Public Interface
  // ============================================

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
   * Show the UI (IUIComponent interface - simple visibility toggle).
   * For showing with upgrades, use showUpgrades() method.
   */
  show(): void {
    this.visible = true;
  }

  /**
   * Show upgrade selection with provided upgrades.
   * Pauses the game and displays cards with animations.
   *
   * @param upgrades Array of upgrades to display (max 3)
   * @param onSelect Callback function when upgrade is selected
   */
  showUpgrades(upgrades: IUpgrade[], onSelect: (upgrade: IUpgrade) => void): void {
    if (upgrades.length === 0) {
      console.warn('UpgradeSelectionUI: No upgrades provided');
      return;
    }

    this.onSelectCallback = onSelect;
    this.clearCards();

    // Pause game physics
    this.pauseGame();

    // Create upgrade cards
    this.createCards(upgrades.slice(0, 3)); // Max 3 cards

    // Show container and play animations
    this.visible = true;
    this._interactive = true;
    this.playEnterAnimation();

    // Start glow animation
    this.startGlowAnimation();
  }

  /**
   * Hide the upgrade selection UI.
   */
  hide(): void {
    if (!this._visible) return;

    this._interactive = false;
    this.stopGlowAnimation();

    this.playExitAnimation(() => {
      this.visible = false;
      this.clearCards();
      this.resumeGame();
    });
  }

  /**
   * Update method for animations.
   */
  update(dt: number): void {
    if (!this._visible) return;

    // Update scanline effect
    this.updateScanlines(dt);
  }

  /**
   * Destroy the UI and clean up resources.
   */
  destroy(): void {
    this.stopGlowAnimation();

    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }

    this.clearCards();
    this.container.destroy();
  }

  /**
   * Get the main container.
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  // ============================================
  // Private: UI Creation
  // ============================================

  private createOverlay(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();

    const { screenWidth, screenHeight } = this.config;

    // Base dark overlay
    graphics.fillStyle(NeonColors.OVERLAY, 0.85);
    graphics.fillRect(0, 0, screenWidth, screenHeight);

    // Subtle blue tint at top (vignette effect approximation)
    graphics.fillStyle(NeonColors.BLUE, 0.05);
    graphics.fillRect(0, 0, screenWidth, screenHeight / 3);

    // Darker edges for vignette effect
    graphics.fillStyle(0x000000, 0.2);
    graphics.fillRect(0, 0, 50, screenHeight);
    graphics.fillRect(screenWidth - 50, 0, 50, screenHeight);

    return graphics;
  }

  private createScanlineOverlay(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.setAlpha(0.03);
    return graphics;
  }

  private updateScanlines(dt: number): void {
    this.scanlineOffset = (this.scanlineOffset + dt * 50) % 4;

    const { screenWidth, screenHeight } = this.config;
    this.scanlineOverlay.clear();
    this.scanlineOverlay.lineStyle(1, 0xffffff, 1);

    for (let y = this.scanlineOffset; y < screenHeight; y += 4) {
      this.scanlineOverlay.moveTo(0, y);
      this.scanlineOverlay.lineTo(screenWidth, y);
    }
    this.scanlineOverlay.strokePath();
  }

  private createTitle(): Phaser.GameObjects.Text {
    const { screenWidth } = this.config;

    const title = this.scene.add.text(
      screenWidth / 2,
      70,
      'CHOOSE UPGRADE',
      {
        fontFamily: UIFonts.MONO,
        fontSize: '42px',
        color: '#00ffff',
        stroke: '#004444',
        strokeThickness: 2,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#00ffff',
          blur: 20,
          fill: true,
        },
      }
    );
    title.setOrigin(0.5);

    return title;
  }

  private createSubtitle(): Phaser.GameObjects.Text {
    const { screenWidth } = this.config;

    const subtitle = this.scene.add.text(
      screenWidth / 2,
      115,
      'Press 1, 2, or 3 to select quickly',
      {
        fontFamily: UIFonts.MONO,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(NeonColors.TEXT_SECONDARY).rgba,
      }
    );
    subtitle.setOrigin(0.5);

    return subtitle;
  }

  // ============================================
  // Private: Card Creation
  // ============================================

  private createCards(upgrades: IUpgrade[]): void {
    const { screenWidth, screenHeight, cardWidth, cardGap } = this.config;
    const totalWidth = upgrades.length * cardWidth + (upgrades.length - 1) * cardGap;
    const startX = (screenWidth - totalWidth) / 2;
    const centerY = screenHeight / 2 + 20;

    upgrades.forEach((upgrade, index) => {
      const x = startX + index * (cardWidth + cardGap) + cardWidth / 2;
      const card = this.createCard(upgrade, index, x, centerY);
      this.cards.push(card);
    });
  }

  private createCard(upgrade: IUpgrade, index: number, x: number, y: number): UpgradeCard {
    const { cardWidth, cardHeight } = this.config;
    const rarityColor = RarityColors[upgrade.rarity || 'common'] || NeonColors.CYAN;

    const cardContainer = this.scene.add.container(x, y);
    this.container.add(cardContainer);

    // Glow layer (behind card)
    const glowGraphics = this.scene.add.graphics();
    this.drawCardGlow(glowGraphics, cardWidth, cardHeight, rarityColor, 0.3);
    cardContainer.add(glowGraphics);

    // Main background
    const background = this.scene.add.graphics();
    this.drawCardBackground(background, cardWidth, cardHeight, rarityColor, false);
    cardContainer.add(background);

    // Card content
    this.addCardContent(cardContainer, upgrade, index, cardWidth, cardHeight, rarityColor);

    // Setup interaction
    this.setupCardInteraction(cardContainer, index, cardWidth, cardHeight);

    return {
      container: cardContainer,
      background,
      glowGraphics,
      upgrade,
      index,
      originalY: y,
      isHovered: false,
    };
  }

  private drawCardGlow(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    color: number,
    intensity: number
  ): void {
    graphics.clear();

    // Outer glow layers
    const glowLayers = [
      { offset: 12, alpha: intensity * 0.1 },
      { offset: 8, alpha: intensity * 0.2 },
      { offset: 4, alpha: intensity * 0.3 },
    ];

    glowLayers.forEach(layer => {
      graphics.fillStyle(color, layer.alpha);
      graphics.fillRoundedRect(
        -width / 2 - layer.offset,
        -height / 2 - layer.offset,
        width + layer.offset * 2,
        height + layer.offset * 2,
        16 + layer.offset / 2
      );
    });
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
    const radius = 14;
    const borderWidth = highlighted ? 3 : 2;

    // Outer border (neon glow effect)
    if (highlighted) {
      graphics.lineStyle(6, borderColor, 0.3);
      graphics.strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, radius + 2);
    }

    // Main border
    graphics.lineStyle(borderWidth, borderColor, highlighted ? 1 : 0.7);
    graphics.strokeRoundedRect(x, y, width, height, radius);

    // Background fill with gradient effect
    graphics.fillStyle(NeonColors.CARD_BG, 0.95);
    graphics.fillRoundedRect(x + borderWidth, y + borderWidth, width - borderWidth * 2, height - borderWidth * 2, radius - 2);

    // Inner highlight line at top
    graphics.lineStyle(1, borderColor, 0.3);
    graphics.beginPath();
    graphics.moveTo(x + 20, y + borderWidth + 1);
    graphics.lineTo(x + width - 20, y + borderWidth + 1);
    graphics.strokePath();

    // Corner accents
    this.drawCornerAccents(graphics, x, y, width, height, borderColor, highlighted);
  }

  private drawCornerAccents(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    highlighted: boolean
  ): void {
    const accentSize = highlighted ? 20 : 15;
    const alpha = highlighted ? 1 : 0.5;

    graphics.lineStyle(2, color, alpha);

    // Top-left
    graphics.beginPath();
    graphics.moveTo(x, y + accentSize);
    graphics.lineTo(x, y);
    graphics.lineTo(x + accentSize, y);
    graphics.strokePath();

    // Top-right
    graphics.beginPath();
    graphics.moveTo(x + width - accentSize, y);
    graphics.lineTo(x + width, y);
    graphics.lineTo(x + width, y + accentSize);
    graphics.strokePath();

    // Bottom-left
    graphics.beginPath();
    graphics.moveTo(x, y + height - accentSize);
    graphics.lineTo(x, y + height);
    graphics.lineTo(x + accentSize, y + height);
    graphics.strokePath();

    // Bottom-right
    graphics.beginPath();
    graphics.moveTo(x + width - accentSize, y + height);
    graphics.lineTo(x + width, y + height);
    graphics.lineTo(x + width, y + height - accentSize);
    graphics.strokePath();
  }

  private addCardContent(
    container: Phaser.GameObjects.Container,
    upgrade: IUpgrade,
    index: number,
    width: number,
    height: number,
    rarityColor: number
  ): void {
    const colorStr = Phaser.Display.Color.IntegerToColor(rarityColor).rgba;

    // Key number indicator (top-left)
    const keyIndicator = this.scene.add.text(
      -width / 2 + 15,
      -height / 2 + 12,
      `[${index + 1}]`,
      {
        fontFamily: UIFonts.MONO,
        fontSize: '14px',
        color: colorStr,
      }
    );
    container.add(keyIndicator);

    // Rarity label (top-right)
    const rarityLabel = this.scene.add.text(
      width / 2 - 15,
      -height / 2 + 12,
      (upgrade.rarity || 'common').toUpperCase(),
      {
        fontFamily: UIFonts.MONO,
        fontSize: '11px',
        color: colorStr,
      }
    );
    rarityLabel.setOrigin(1, 0);
    container.add(rarityLabel);

    // Icon area with hexagon background
    const iconBg = this.scene.add.graphics();
    this.drawHexagonIcon(iconBg, 0, -height / 4 + 10, 45, rarityColor);
    container.add(iconBg);

    // Icon (emoji or texture)
    if (this.scene.textures.exists(upgrade.icon)) {
      const icon = this.scene.add.image(0, -height / 4 + 10, upgrade.icon);
      icon.setDisplaySize(55, 55);
      container.add(icon);
    } else {
      // Use icon as emoji/text
      const iconText = this.scene.add.text(0, -height / 4 + 10, upgrade.icon || '?', {
        fontFamily: UIFonts.MONO,
        fontSize: '36px',
        color: '#ffffff',
      });
      iconText.setOrigin(0.5);
      container.add(iconText);
    }

    // Upgrade name
    const nameText = this.scene.add.text(0, 35, upgrade.name, {
      fontFamily: UIFonts.MONO,
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 30 },
    });
    nameText.setOrigin(0.5);
    container.add(nameText);

    // Level indicator with stars
    const levelContainer = this.createLevelIndicator(upgrade.level, upgrade.maxLevel, rarityColor);
    levelContainer.setPosition(0, 65);
    container.add(levelContainer);

    // Description
    const descText = this.scene.add.text(0, 100, upgrade.description, {
      fontFamily: UIFonts.MONO,
      fontSize: '13px',
      color: Phaser.Display.Color.IntegerToColor(NeonColors.TEXT_SECONDARY).rgba,
      align: 'center',
      wordWrap: { width: width - 35 },
      lineSpacing: 4,
    });
    descText.setOrigin(0.5, 0);
    container.add(descText);

    // Bottom separator line
    const separatorY = height / 2 - 45;
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, rarityColor, 0.3);
    separator.moveTo(-width / 2 + 20, separatorY);
    separator.lineTo(width / 2 - 20, separatorY);
    separator.strokePath();
    container.add(separator);

    // Select hint
    const hintText = this.scene.add.text(0, height / 2 - 25, 'CLICK TO SELECT', {
      fontFamily: UIFonts.MONO,
      fontSize: '12px',
      color: colorStr,
    });
    hintText.setOrigin(0.5);
    hintText.setAlpha(0.7);
    container.add(hintText);
  }

  private drawHexagonIcon(
    graphics: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    color: number
  ): void {
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      points.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }

    // Fill
    graphics.fillStyle(NeonColors.DARK_BG, 0.9);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();

    // Border
    graphics.lineStyle(2, color, 0.8);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.strokePath();
  }

  private createLevelIndicator(level: number, maxLevel: number, color: number): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const starSize = 14;
    const gap = 4;
    const totalWidth = maxLevel * starSize + (maxLevel - 1) * gap;
    const startX = -totalWidth / 2 + starSize / 2;

    for (let i = 0; i < maxLevel; i++) {
      const x = startX + i * (starSize + gap);
      const filled = i < level;

      const star = this.scene.add.text(x, 0, filled ? '\u2605' : '\u2606', {
        fontFamily: UIFonts.MONO,
        fontSize: `${starSize}px`,
        color: filled
          ? Phaser.Display.Color.IntegerToColor(color).rgba
          : Phaser.Display.Color.IntegerToColor(NeonColors.TEXT_SECONDARY).rgba,
      });
      star.setOrigin(0.5);
      container.add(star);
    }

    // Level text below stars
    const levelText = this.scene.add.text(0, 16, `LV.${level}/${maxLevel}`, {
      fontFamily: UIFonts.MONO,
      fontSize: '11px',
      color: Phaser.Display.Color.IntegerToColor(NeonColors.TEXT_SECONDARY).rgba,
    });
    levelText.setOrigin(0.5);
    container.add(levelText);

    return container;
  }

  // ============================================
  // Private: Interaction
  // ============================================

  private setupCardInteraction(
    container: Phaser.GameObjects.Container,
    index: number,
    width: number,
    height: number
  ): void {
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      if (this._interactive) {
        this.onCardHover(index);
      }
    });

    container.on('pointerout', () => {
      if (this._interactive) {
        this.onCardOut(index);
      }
    });

    container.on('pointerdown', () => {
      if (this._interactive) {
        this.onCardSelect(index);
      }
    });
  }

  private setupKeyboardControls(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (!this._visible || !this._interactive) return;

      const key = event.key;
      if (key === '1' || key === '2' || key === '3') {
        const index = parseInt(key) - 1;
        if (index < this.cards.length) {
          this.onCardSelect(index);
        }
      }
    };

    window.addEventListener('keydown', this.keyboardHandler);
  }

  private onCardHover(index: number): void {
    const card = this.cards[index];
    if (!card || card.isHovered) return;

    card.isHovered = true;
    this.hoveredIndex = index;

    const rarityColor = RarityColors[card.upgrade.rarity || 'common'] || NeonColors.CYAN;

    // Redraw with highlight
    this.drawCardBackground(card.background, this.config.cardWidth, this.config.cardHeight, rarityColor, true);
    this.drawCardGlow(card.glowGraphics, this.config.cardWidth, this.config.cardHeight, rarityColor, 0.6);

    // Scale up animation
    this.scene.tweens.add({
      targets: card.container,
      scale: 1.08,
      y: card.originalY - 10,
      duration: 150,
      ease: 'Back.easeOut',
    });

    this.scene.game.canvas.style.cursor = 'pointer';
  }

  private onCardOut(index: number): void {
    const card = this.cards[index];
    if (!card || !card.isHovered) return;

    card.isHovered = false;
    if (this.hoveredIndex === index) {
      this.hoveredIndex = -1;
    }

    const rarityColor = RarityColors[card.upgrade.rarity || 'common'] || NeonColors.CYAN;

    // Redraw without highlight
    this.drawCardBackground(card.background, this.config.cardWidth, this.config.cardHeight, rarityColor, false);
    this.drawCardGlow(card.glowGraphics, this.config.cardWidth, this.config.cardHeight, rarityColor, 0.3);

    // Scale down animation
    this.scene.tweens.add({
      targets: card.container,
      scale: 1,
      y: card.originalY,
      duration: 150,
      ease: 'Quad.easeOut',
    });

    this.scene.game.canvas.style.cursor = 'default';
  }

  private onCardSelect(index: number): void {
    const card = this.cards[index];
    if (!card) return;

    this._interactive = false;
    this.stopGlowAnimation();

    const rarityColor = RarityColors[card.upgrade.rarity || 'common'] || NeonColors.CYAN;

    // Pulse animation on selected card
    card.pulseTween = this.scene.tweens.add({
      targets: card.container,
      scale: { from: 1.08, to: 1.15 },
      duration: 100,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });

    // Flash effect
    const flash = this.scene.add.graphics();
    flash.fillStyle(rarityColor, 0.6);
    flash.fillRoundedRect(
      -this.config.cardWidth / 2,
      -this.config.cardHeight / 2,
      this.config.cardWidth,
      this.config.cardHeight,
      14
    );
    card.container.add(flash);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        flash.destroy();

        // Call callback and hide
        if (this.onSelectCallback) {
          const callback = this.onSelectCallback;
          this.onSelectCallback = undefined;

          this.playExitAnimation(() => {
            this.visible = false;
            this.clearCards();
            this.resumeGame();
            callback(card.upgrade);
          });
        }
      },
    });

    // Dim other cards
    this.cards.forEach((otherCard, i) => {
      if (i !== index) {
        this.scene.tweens.add({
          targets: otherCard.container,
          alpha: 0.3,
          scale: 0.95,
          duration: 200,
        });
      }
    });
  }

  // ============================================
  // Private: Animations
  // ============================================

  private playEnterAnimation(): void {
    const { animationDuration } = this.config;

    // Overlay fade in
    this.overlay.setAlpha(0);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: animationDuration,
    });

    // Title animation
    this.title.setAlpha(0);
    this.title.setY(this.title.y - 30);
    this.scene.tweens.add({
      targets: this.title,
      alpha: 1,
      y: this.title.y + 30,
      duration: animationDuration,
      ease: 'Back.easeOut',
    });

    // Subtitle fade in
    this.subtitle.setAlpha(0);
    this.scene.tweens.add({
      targets: this.subtitle,
      alpha: 1,
      duration: animationDuration,
      delay: 100,
    });

    // Cards animation (staggered from bottom)
    this.cards.forEach((card, index) => {
      const delay = 150 + index * 100;

      card.container.setAlpha(0);
      card.container.setY(card.originalY + 80);
      card.container.setScale(0.8);

      this.scene.tweens.add({
        targets: card.container,
        alpha: 1,
        y: card.originalY,
        scale: 1,
        duration: animationDuration + 100,
        delay,
        ease: 'Back.easeOut',
      });
    });
  }

  private playExitAnimation(onComplete: () => void): void {
    const { animationDuration } = this.config;

    // Cards exit animation
    this.cards.forEach((card, index) => {
      this.scene.tweens.add({
        targets: card.container,
        alpha: 0,
        y: card.container.y - 50,
        scale: 0.9,
        duration: animationDuration - 50,
        delay: index * 50,
      });
    });

    // Title and subtitle fade out
    this.scene.tweens.add({
      targets: [this.title, this.subtitle],
      alpha: 0,
      duration: animationDuration - 100,
      delay: 100,
    });

    // Overlay fade out
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: animationDuration,
      delay: 150,
      onComplete: () => {
        onComplete();
      },
    });
  }

  private startGlowAnimation(): void {
    let glowPhase = 0;

    this.glowAnimationTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        glowPhase += 0.1;
        const intensity = 0.3 + Math.sin(glowPhase) * 0.15;

        this.cards.forEach(card => {
          if (!card.isHovered) {
            const rarityColor = RarityColors[card.upgrade.rarity || 'common'] || NeonColors.CYAN;
            this.drawCardGlow(
              card.glowGraphics,
              this.config.cardWidth,
              this.config.cardHeight,
              rarityColor,
              intensity
            );
          }
        });
      },
      loop: true,
    });
  }

  private stopGlowAnimation(): void {
    if (this.glowAnimationTimer) {
      this.glowAnimationTimer.destroy();
      this.glowAnimationTimer = undefined;
    }
  }

  // ============================================
  // Private: Game State
  // ============================================

  private pauseGame(): void {
    // Pause physics and game logic
    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.pause();
    }

    // Emit event for external pause handling
    this.scene.events.emit('upgradeSelectionOpened');
  }

  private resumeGame(): void {
    // Resume physics and game logic
    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.resume();
    }

    // Emit event for external resume handling
    this.scene.events.emit('upgradeSelectionClosed');
  }

  // ============================================
  // Private: Cleanup
  // ============================================

  private clearCards(): void {
    this.cards.forEach(card => {
      if (card.pulseTween) {
        card.pulseTween.stop();
      }
      card.container.destroy();
    });
    this.cards = [];
    this.hoveredIndex = -1;
    this.scene.game.canvas.style.cursor = 'default';
  }
}

export default UpgradeSelectionUI;
