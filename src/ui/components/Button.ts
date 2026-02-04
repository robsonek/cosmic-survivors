/**
 * Button component for Cosmic Survivors UI.
 * Provides interactive button with hover, pressed, and disabled states.
 */

import * as Phaser from 'phaser';
import type { IUIButton } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth } from '../UIConstants';

export interface ButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: number;
  icon?: string;
  iconSize?: number;
  backgroundColor?: number;
  hoverColor?: number;
  pressedColor?: number;
  disabledColor?: number;
  textColor?: number;
  borderColor?: number;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export class Button implements IUIButton {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private icon?: Phaser.GameObjects.Image;
  private config: ButtonConfig;
  private clickHandler?: () => void;
  private _visible: boolean = true;
  private _interactive: boolean = true;
  private _disabled: boolean = false;
  private isHovered: boolean = false;
  private isPressed: boolean = false;

  constructor(scene: Phaser.Scene, config: ButtonConfig) {
    this.id = `button_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      fontSize: 24,
      backgroundColor: UIColors.BUTTON_NORMAL,
      hoverColor: UIColors.BUTTON_HOVER,
      pressedColor: UIColors.BUTTON_PRESSED,
      disabledColor: UIColors.BUTTON_DISABLED,
      textColor: UIColors.TEXT_PRIMARY,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 8,
      padding: 16,
      disabled: false,
      ...config,
    };

    this._disabled = this.config.disabled ?? false;
    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.BUTTONS);

    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create text label
    this.label = scene.add.text(0, 0, this.config.text, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: `${this.config.fontSize}px`,
      color: Phaser.Display.Color.IntegerToColor(this.config.textColor!).rgba,
      align: 'center',
    });
    this.label.setOrigin(0.5);
    this.container.add(this.label);

    // Create icon if provided
    if (this.config.icon) {
      const iconSize = this.config.iconSize ?? 24;
      this.icon = scene.add.image(-this.config.width! / 4, 0, this.config.icon);
      this.icon.setDisplaySize(iconSize, iconSize);
      this.container.add(this.icon);
      // Shift text to the right
      this.label.setX(iconSize / 2);
    }

    if (config.onClick) {
      this.clickHandler = config.onClick;
    }

    this.setupInteraction();
    this.redraw();
  }

  get text(): string {
    return this.config.text;
  }

  set text(value: string) {
    this.config.text = value;
    this.label.setText(value);
  }

  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(value: boolean) {
    this._disabled = value;
    this.redraw();
    if (value) {
      this.container.disableInteractive();
    } else if (this._interactive) {
      this.setupInteraction();
    }
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
    if (value && !this._disabled) {
      this.setupInteraction();
    } else {
      this.container.disableInteractive();
    }
  }

  onClick(handler: () => void): void {
    this.clickHandler = handler;
  }

  private setupInteraction(): void {
    const hitArea = new Phaser.Geom.Rectangle(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height
    );

    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    this.container.on('pointerover', () => {
      if (!this._disabled) {
        this.isHovered = true;
        this.redraw();
        this.scene.game.canvas.style.cursor = 'pointer';
      }
    });

    this.container.on('pointerout', () => {
      this.isHovered = false;
      this.isPressed = false;
      this.redraw();
      this.scene.game.canvas.style.cursor = 'default';
    });

    this.container.on('pointerdown', () => {
      if (!this._disabled) {
        this.isPressed = true;
        this.redraw();
      }
    });

    this.container.on('pointerup', () => {
      if (!this._disabled && this.isPressed) {
        this.isPressed = false;
        this.redraw();
        if (this.clickHandler) {
          this.clickHandler();
        }
      }
    });
  }

  private redraw(): void {
    this.background.clear();

    let bgColor = this.config.backgroundColor!;
    if (this._disabled) {
      bgColor = this.config.disabledColor!;
    } else if (this.isPressed) {
      bgColor = this.config.pressedColor!;
    } else if (this.isHovered) {
      bgColor = this.config.hoverColor!;
    }

    const x = -this.config.width / 2;
    const y = -this.config.height / 2;
    const width = this.config.width;
    const height = this.config.height;
    const radius = this.config.borderRadius!;

    // Draw border
    if (this.config.borderWidth! > 0) {
      this.background.fillStyle(this.config.borderColor!, 1);
      this.background.fillRoundedRect(x, y, width, height, radius);
    }

    // Draw background (inset by border width)
    const bw = this.config.borderWidth!;
    this.background.fillStyle(bgColor, 1);
    this.background.fillRoundedRect(x + bw, y + bw, width - bw * 2, height - bw * 2, radius - bw);

    // Update text color for disabled state
    const textColor = this._disabled ? UIColors.TEXT_DISABLED : this.config.textColor!;
    this.label.setColor(Phaser.Display.Color.IntegerToColor(textColor).rgba);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // Button doesn't need per-frame updates
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
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
