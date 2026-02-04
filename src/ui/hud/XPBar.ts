/**
 * XPBar component for Cosmic Survivors HUD.
 * Displays player experience progress with level indicator and animations.
 */

import * as Phaser from 'phaser';
import type { IUIComponent, IHUDXPData } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes } from '../UIConstants';

export interface XPBarConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export class XPBar implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private xpFill: Phaser.GameObjects.Graphics;
  private levelBadge: Phaser.GameObjects.Container;
  private levelText: Phaser.GameObjects.Text;
  private xpText: Phaser.GameObjects.Text;
  private config: Required<XPBarConfig>;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  private currentXP: number = 0;
  private requiredXP: number = 100;
  private currentLevel: number = 1;
  private displayXP: number = 0;
  private xpTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: XPBarConfig) {
    this.id = `xpbar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      width: UISizes.XP_BAR_WIDTH,
      height: UISizes.XP_BAR_HEIGHT,
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD);

    // Create background
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create XP fill
    this.xpFill = scene.add.graphics();
    this.container.add(this.xpFill);

    // Create level badge
    this.levelBadge = scene.add.container(-30, this.config.height / 2);
    this.container.add(this.levelBadge);

    const badgeBg = scene.add.graphics();
    badgeBg.fillStyle(UIColors.PRIMARY, 1);
    badgeBg.fillCircle(0, 0, 18);
    badgeBg.lineStyle(2, UIColors.BORDER_ACCENT);
    badgeBg.strokeCircle(0, 0, 18);
    this.levelBadge.add(badgeBg);

    this.levelText = scene.add.text(0, 0, '1', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5);
    this.levelBadge.add(this.levelText);

    // Create XP text
    this.xpText = scene.add.text(
      this.config.width / 2,
      this.config.height / 2,
      '0/100',
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '11px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      }
    );
    this.xpText.setOrigin(0.5);
    this.container.add(this.xpText);

    this.redraw();
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

  updateData(data: IHUDXPData): void {
    const oldLevel = this.currentLevel;
    this.currentXP = data.current;
    this.requiredXP = data.required;
    this.currentLevel = data.level;

    // Level up animation
    if (data.level > oldLevel) {
      this.playLevelUpAnimation();
    }

    // Animate XP gain
    this.animateXP(data.current);

    this.updateText();
  }

  private animateXP(targetXP: number): void {
    if (this.xpTween) {
      this.xpTween.stop();
    }

    this.xpTween = this.scene.tweens.add({
      targets: this,
      displayXP: targetXP,
      duration: 300,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.redrawXPFill();
      },
    });

    // XP gain particles effect
    this.scene.tweens.add({
      targets: this.xpFill,
      alpha: { from: 1.3, to: 1 },
      duration: 200,
    });
  }

  private playLevelUpAnimation(): void {
    // Update level text
    this.levelText.setText(this.currentLevel.toString());

    // Reset XP display for new level
    this.displayXP = 0;
    this.redrawXPFill();

    // Scale and glow animation on badge
    this.scene.tweens.add({
      targets: this.levelBadge,
      scale: { from: 1, to: 1.5 },
      duration: 200,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // Flash effect
    const flash = this.scene.add.graphics();
    flash.fillStyle(UIColors.ACCENT, 0.5);
    flash.fillCircle(0, 0, 30);
    this.levelBadge.add(flash);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 400,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  private redraw(): void {
    this.redrawBackground();
    this.redrawXPFill();
    this.updateText();
  }

  private redrawBackground(): void {
    this.background.clear();

    const width = this.config.width;
    const height = this.config.height;
    const radius = height / 2;

    // Draw border
    this.background.fillStyle(UIColors.BORDER, 1);
    this.background.fillRoundedRect(0, 0, width, height, radius);

    // Draw background
    this.background.fillStyle(UIColors.PROGRESS_BG, 1);
    this.background.fillRoundedRect(2, 2, width - 4, height - 4, radius - 1);
  }

  private redrawXPFill(): void {
    this.xpFill.clear();

    const percent = this.requiredXP > 0 ? this.displayXP / this.requiredXP : 0;
    if (percent <= 0) return;

    const innerWidth = this.config.width - 4;
    const innerHeight = this.config.height - 4;
    const radius = innerHeight / 2;
    const fillWidth = innerWidth * Math.min(1, percent);

    if (fillWidth <= 0) return;

    this.xpFill.fillStyle(UIColors.XP_FILL, 1);
    this.xpFill.fillRoundedRect(2, 2, fillWidth, innerHeight, {
      tl: radius,
      tr: fillWidth >= innerWidth - 1 ? radius : 0,
      br: fillWidth >= innerWidth - 1 ? radius : 0,
      bl: radius,
    });

    // Add shine effect
    this.xpFill.fillStyle(0xffffff, 0.2);
    this.xpFill.fillRect(2, 2, fillWidth, innerHeight / 3);
  }

  private updateText(): void {
    this.xpText.setText(`${Math.floor(this.currentXP)}/${this.requiredXP}`);
    this.levelText.setText(this.currentLevel.toString());
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // XPBar doesn't need per-frame updates
  }

  show(): void {
    this.visible = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 200,
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  destroy(): void {
    if (this.xpTween) {
      this.xpTween.stop();
    }
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
