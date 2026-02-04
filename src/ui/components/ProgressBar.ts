/**
 * ProgressBar component for Cosmic Survivors UI.
 * Displays progress with animated fill and optional text overlay.
 */

import * as Phaser from 'phaser';
import type { IUIProgressBar } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth } from '../UIConstants';

export interface ProgressBarConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  value?: number;
  maxValue?: number;
  backgroundColor?: number;
  fillColor?: number;
  borderColor?: number;
  borderWidth?: number;
  borderRadius?: number;
  showText?: boolean;
  textFormat?: 'percent' | 'value' | 'both';
  textColor?: number;
  fontSize?: number;
  animationDuration?: number;
}

export class ProgressBar implements IUIProgressBar {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private config: ProgressBarConfig;
  private _value: number;
  private _maxValue: number;
  private displayValue: number;
  private _visible: boolean = true;
  private _interactive: boolean = false;
  private _showText: boolean;
  private animationTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: ProgressBarConfig) {
    this.id = `progressbar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      value: 0,
      maxValue: 100,
      backgroundColor: UIColors.PROGRESS_BG,
      fillColor: UIColors.PROGRESS_FILL,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 4,
      showText: false,
      textFormat: 'percent',
      textColor: UIColors.TEXT_PRIMARY,
      fontSize: 14,
      animationDuration: 200,
      ...config,
    };

    this._value = this.config.value!;
    this._maxValue = this.config.maxValue!;
    this.displayValue = this._value;
    this._showText = this.config.showText!;

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD);

    // Create background
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create fill
    this.fill = scene.add.graphics();
    this.container.add(this.fill);

    // Create text label if needed
    if (this._showText) {
      this.label = scene.add.text(this.config.width / 2, this.config.height / 2, '', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: `${this.config.fontSize}px`,
        color: Phaser.Display.Color.IntegerToColor(this.config.textColor!).rgba,
        align: 'center',
      });
      this.label.setOrigin(0.5);
      this.container.add(this.label);
    }

    this.redraw();
  }

  get value(): number {
    return this._value;
  }

  set value(newValue: number) {
    const oldValue = this._value;
    this._value = Math.max(0, Math.min(newValue, this._maxValue));

    if (this.config.animationDuration! > 0 && Math.abs(newValue - oldValue) > 0.01) {
      this.animateValue(oldValue, this._value);
    } else {
      this.displayValue = this._value;
      this.redrawFill();
    }
  }

  get maxValue(): number {
    return this._maxValue;
  }

  set maxValue(value: number) {
    this._maxValue = Math.max(1, value);
    this._value = Math.min(this._value, this._maxValue);
    this.displayValue = Math.min(this.displayValue, this._maxValue);
    this.redrawFill();
  }

  get showText(): boolean {
    return this._showText;
  }

  set showText(value: boolean) {
    this._showText = value;
    if (value && !this.label) {
      this.label = this.scene.add.text(this.config.width / 2, this.config.height / 2, '', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: `${this.config.fontSize}px`,
        color: Phaser.Display.Color.IntegerToColor(this.config.textColor!).rgba,
        align: 'center',
      });
      this.label.setOrigin(0.5);
      this.container.add(this.label);
    }
    if (this.label) {
      this.label.setVisible(value);
    }
    this.updateText();
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

  setColors(background: number, fill: number): void {
    this.config.backgroundColor = background;
    this.config.fillColor = fill;
    this.redraw();
  }

  private animateValue(from: number, to: number): void {
    if (this.animationTween) {
      this.animationTween.stop();
    }

    const target = { value: from };
    this.animationTween = this.scene.tweens.add({
      targets: target,
      value: to,
      duration: this.config.animationDuration!,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.displayValue = target.value;
        this.redrawFill();
      },
      onComplete: () => {
        this.displayValue = to;
        this.redrawFill();
      },
    });
  }

  private redraw(): void {
    this.redrawBackground();
    this.redrawFill();
  }

  private redrawBackground(): void {
    this.background.clear();

    const width = this.config.width;
    const height = this.config.height;
    const radius = this.config.borderRadius!;
    const bw = this.config.borderWidth!;

    // Draw border
    if (bw > 0) {
      this.background.fillStyle(this.config.borderColor!, 1);
      this.background.fillRoundedRect(0, 0, width, height, radius);
    }

    // Draw background
    this.background.fillStyle(this.config.backgroundColor!, 1);
    this.background.fillRoundedRect(bw, bw, width - bw * 2, height - bw * 2, Math.max(0, radius - bw));
  }

  private redrawFill(): void {
    this.fill.clear();

    const percent = this._maxValue > 0 ? this.displayValue / this._maxValue : 0;
    if (percent <= 0) {
      this.updateText();
      return;
    }

    const bw = this.config.borderWidth!;
    const innerWidth = this.config.width - bw * 2;
    const innerHeight = this.config.height - bw * 2;
    const radius = Math.max(0, this.config.borderRadius! - bw);
    const fillWidth = innerWidth * Math.min(1, percent);

    this.fill.fillStyle(this.config.fillColor!, 1);

    // Use mask for rounded corners on the fill
    if (fillWidth > 0) {
      // For simplicity, draw a rounded rect clipped to fill width
      // Create a shape that respects the rounded corners
      this.fill.fillRoundedRect(bw, bw, fillWidth, innerHeight, {
        tl: radius,
        tr: fillWidth >= innerWidth - 1 ? radius : 0,
        br: fillWidth >= innerWidth - 1 ? radius : 0,
        bl: radius,
      });
    }

    this.updateText();
  }

  private updateText(): void {
    if (!this.label || !this._showText) return;

    const percent = this._maxValue > 0 ? (this.displayValue / this._maxValue) * 100 : 0;

    let text = '';
    switch (this.config.textFormat) {
      case 'percent':
        text = `${Math.round(percent)}%`;
        break;
      case 'value':
        text = `${Math.round(this.displayValue)}/${this._maxValue}`;
        break;
      case 'both':
        text = `${Math.round(this.displayValue)}/${this._maxValue} (${Math.round(percent)}%)`;
        break;
    }

    this.label.setText(text);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // Progress bar doesn't need per-frame updates
  }

  show(): void {
    this.visible = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 150,
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  destroy(): void {
    if (this.animationTween) {
      this.animationTween.stop();
    }
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
