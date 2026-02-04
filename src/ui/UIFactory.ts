/**
 * UIFactory for Cosmic Survivors.
 * Factory methods for creating UI components with consistent styling.
 */

import * as Phaser from 'phaser';
import type { IUpgradeChoice } from '@shared/interfaces/IUI';
import { Button, type ButtonConfig } from './components/Button';
import { ProgressBar, type ProgressBarConfig } from './components/ProgressBar';
import { Panel, type PanelConfig } from './components/Panel';
import { Tooltip, type TooltipConfig } from './components/Tooltip';
import { UIColors, UISizes, getRarityColor } from './UIConstants';

export interface UpgradeCardConfig {
  x: number;
  y: number;
  upgrade: IUpgradeChoice;
  onClick?: (upgrade: IUpgradeChoice) => void;
}

/**
 * Factory for creating UI components with consistent styling.
 */
export class UIFactory {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a styled button.
   */
  createButton(config: Partial<ButtonConfig> & { x: number; y: number; text: string }): Button {
    return new Button(this.scene, {
      width: 200,
      height: UISizes.BUTTON_HEIGHT,
      backgroundColor: UIColors.BUTTON_NORMAL,
      hoverColor: UIColors.BUTTON_HOVER,
      pressedColor: UIColors.BUTTON_PRESSED,
      disabledColor: UIColors.BUTTON_DISABLED,
      textColor: UIColors.TEXT_PRIMARY,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 20,
      ...config,
    });
  }

  /**
   * Create a primary action button (green).
   */
  createPrimaryButton(config: Partial<ButtonConfig> & { x: number; y: number; text: string }): Button {
    return new Button(this.scene, {
      width: 200,
      height: UISizes.BUTTON_HEIGHT,
      backgroundColor: UIColors.SUCCESS,
      hoverColor: 0x8ef331,
      pressedColor: 0x5eb301,
      textColor: UIColors.TEXT_PRIMARY,
      borderColor: UIColors.SUCCESS,
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 20,
      ...config,
    });
  }

  /**
   * Create a danger button (red).
   */
  createDangerButton(config: Partial<ButtonConfig> & { x: number; y: number; text: string }): Button {
    return new Button(this.scene, {
      width: 200,
      height: UISizes.BUTTON_HEIGHT,
      backgroundColor: UIColors.ERROR,
      hoverColor: 0xf02030,
      pressedColor: 0xa00010,
      textColor: UIColors.TEXT_PRIMARY,
      borderColor: UIColors.ERROR,
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 20,
      ...config,
    });
  }

  /**
   * Create a progress bar.
   */
  createProgressBar(config: Partial<ProgressBarConfig> & { x: number; y: number }): ProgressBar {
    return new ProgressBar(this.scene, {
      width: 200,
      height: 20,
      value: 0,
      maxValue: 100,
      backgroundColor: UIColors.PROGRESS_BG,
      fillColor: UIColors.PROGRESS_FILL,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 4,
      showText: false,
      animationDuration: 200,
      ...config,
    });
  }

  /**
   * Create a health bar progress bar.
   */
  createHealthBar(config: Partial<ProgressBarConfig> & { x: number; y: number }): ProgressBar {
    return new ProgressBar(this.scene, {
      width: UISizes.HEALTH_BAR_WIDTH,
      height: UISizes.HEALTH_BAR_HEIGHT,
      value: 100,
      maxValue: 100,
      backgroundColor: UIColors.PROGRESS_BG,
      fillColor: UIColors.HEALTH_FILL,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 4,
      showText: true,
      textFormat: 'value',
      animationDuration: 200,
      ...config,
    });
  }

  /**
   * Create an XP bar progress bar.
   */
  createXPBar(config: Partial<ProgressBarConfig> & { x: number; y: number }): ProgressBar {
    return new ProgressBar(this.scene, {
      width: UISizes.XP_BAR_WIDTH,
      height: UISizes.XP_BAR_HEIGHT,
      value: 0,
      maxValue: 100,
      backgroundColor: UIColors.PROGRESS_BG,
      fillColor: UIColors.XP_FILL,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 8,
      showText: true,
      textFormat: 'both',
      fontSize: 12,
      animationDuration: 300,
      ...config,
    });
  }

  /**
   * Create a panel.
   */
  createPanel(config: Partial<PanelConfig> & { x: number; y: number; width: number; height: number }): Panel {
    return new Panel(this.scene, {
      backgroundColor: UIColors.PANEL_BG,
      backgroundAlpha: 0.95,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: UISizes.PANEL_BORDER_RADIUS,
      padding: UISizes.PANEL_PADDING,
      titleFontSize: 20,
      titleColor: UIColors.TEXT_PRIMARY,
      titleBarColor: UIColors.PANEL_HEADER,
      titleBarHeight: 40,
      shadow: true,
      ...config,
    });
  }

  /**
   * Create a tooltip.
   */
  createTooltip(config: Partial<TooltipConfig> = {}): Tooltip {
    return new Tooltip(this.scene, {
      maxWidth: 300,
      padding: 12,
      backgroundColor: UIColors.TOOLTIP_BG,
      backgroundAlpha: 0.95,
      borderColor: UIColors.BORDER,
      borderWidth: 1,
      borderRadius: 6,
      textColor: UIColors.TEXT_PRIMARY,
      fontSize: 14,
      titleColor: UIColors.TEXT_ACCENT,
      titleFontSize: 16,
      showDelay: 300,
      followMouse: true,
      ...config,
    });
  }

  /**
   * Create an upgrade card (simplified version for use outside UpgradeSelectionScreen).
   */
  createUpgradeCard(config: UpgradeCardConfig): Phaser.GameObjects.Container {
    const { x, y, upgrade, onClick } = config;
    const width = UISizes.UPGRADE_CARD_WIDTH;
    const height = UISizes.UPGRADE_CARD_HEIGHT;
    const rarityColor = getRarityColor(upgrade.rarity);

    const container = this.scene.add.container(x, y);

    // Background
    const background = this.scene.add.graphics();
    background.fillStyle(rarityColor, 0.3);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    background.fillStyle(UIColors.PANEL_BG, 0.95);
    background.fillRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 10);
    background.lineStyle(3, rarityColor);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
    container.add(background);

    // Icon background
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(UIColors.PANEL_BG, 1);
    iconBg.fillCircle(0, -height / 4, 35);
    iconBg.lineStyle(2, rarityColor);
    iconBg.strokeCircle(0, -height / 4, 35);
    container.add(iconBg);

    // Icon
    if (this.scene.textures.exists(upgrade.icon)) {
      const icon = this.scene.add.image(0, -height / 4, upgrade.icon);
      icon.setDisplaySize(50, 50);
      container.add(icon);
    }

    // Name
    const nameText = this.scene.add.text(0, 30, upgrade.name, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 30 },
    });
    nameText.setOrigin(0.5);
    container.add(nameText);

    // Level
    if (upgrade.currentLevel !== undefined) {
      const levelStr = upgrade.maxLevel
        ? `Lv.${upgrade.currentLevel} -> ${upgrade.currentLevel + 1}`
        : `Lv.${upgrade.currentLevel + 1}`;
      const levelText = this.scene.add.text(0, 55, levelStr, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_XP).rgba,
      });
      levelText.setOrigin(0.5);
      container.add(levelText);
    }

    // Description
    const descText = this.scene.add.text(0, 90, upgrade.description, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      align: 'center',
      wordWrap: { width: width - 30 },
    });
    descText.setOrigin(0.5, 0);
    container.add(descText);

    // Setup interaction
    if (onClick) {
      const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      container.on('pointerover', () => {
        this.scene.tweens.add({
          targets: container,
          scale: 1.05,
          duration: 100,
        });
      });

      container.on('pointerout', () => {
        this.scene.tweens.add({
          targets: container,
          scale: 1,
          duration: 100,
        });
      });

      container.on('pointerdown', () => {
        onClick(upgrade);
      });
    }

    return container;
  }

  /**
   * Create a simple text label.
   */
  createLabel(
    x: number,
    y: number,
    text: string,
    options: {
      fontSize?: number;
      color?: number;
      fontStyle?: string;
      align?: string;
    } = {}
  ): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: `${options.fontSize ?? UISizes.BODY_FONT_SIZE}px`,
      color: Phaser.Display.Color.IntegerToColor(options.color ?? UIColors.TEXT_PRIMARY).rgba,
      fontStyle: options.fontStyle ?? 'normal',
      align: options.align ?? 'left',
    });
    return label;
  }

  /**
   * Create a divider line.
   */
  createDivider(x: number, y: number, width: number, color: number = UIColors.BORDER): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(1, color, 0.5);
    graphics.moveTo(x, y);
    graphics.lineTo(x + width, y);
    graphics.strokePath();
    return graphics;
  }
}
