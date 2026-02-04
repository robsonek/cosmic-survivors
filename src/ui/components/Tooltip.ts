/**
 * Tooltip component for Cosmic Survivors UI.
 * Shows contextual information on hover with auto-positioning.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth } from '../UIConstants';

export interface TooltipConfig {
  maxWidth?: number;
  padding?: number;
  backgroundColor?: number;
  backgroundAlpha?: number;
  borderColor?: number;
  borderWidth?: number;
  borderRadius?: number;
  textColor?: number;
  fontSize?: number;
  titleColor?: number;
  titleFontSize?: number;
  showDelay?: number;
  followMouse?: boolean;
  offsetX?: number;
  offsetY?: number;
}

export class Tooltip implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private config: Required<TooltipConfig>;
  private _visible: boolean = false;
  private _interactive: boolean = false;
  private showTimer?: Phaser.Time.TimerEvent;
  private pendingShow: boolean = false;
  private currentTitle: string = '';
  private currentBody: string = '';
  private screenWidth: number;
  private screenHeight: number;

  constructor(scene: Phaser.Scene, config: TooltipConfig = {}) {
    this.id = `tooltip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
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
      offsetX: 15,
      offsetY: 15,
      ...config,
    };

    this.screenWidth = scene.cameras.main.width;
    this.screenHeight = scene.cameras.main.height;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.TOOLTIP);
    this.container.setVisible(false);

    // Create background
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create body text
    this.bodyText = scene.add.text(this.config.padding, this.config.padding, '', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: `${this.config.fontSize}px`,
      color: Phaser.Display.Color.IntegerToColor(this.config.textColor).rgba,
      wordWrap: { width: this.config.maxWidth - this.config.padding * 2 },
    });
    this.container.add(this.bodyText);

    // Setup mouse tracking
    if (this.config.followMouse) {
      scene.input.on('pointermove', this.onPointerMove, this);
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
  }

  showAt(x: number, y: number, title: string, body: string): void {
    this.currentTitle = title;
    this.currentBody = body;

    if (this.config.showDelay > 0) {
      this.pendingShow = true;
      if (this.showTimer) {
        this.showTimer.destroy();
      }
      this.showTimer = this.scene.time.delayedCall(this.config.showDelay, () => {
        if (this.pendingShow) {
          this.displayTooltip(x, y);
        }
      });
    } else {
      this.displayTooltip(x, y);
    }
  }

  showForObject(
    object: Phaser.GameObjects.GameObject,
    title: string,
    body: string
  ): void {
    const bounds = (object as Phaser.GameObjects.Sprite).getBounds();
    const x = bounds.right + this.config.offsetX;
    const y = bounds.top;
    this.showAt(x, y, title, body);
  }

  private displayTooltip(x: number, y: number): void {
    this.updateContent();
    this.positionTooltip(x, y);
    this.visible = true;

    // Animate in
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 100,
    });
  }

  private updateContent(): void {
    // Clear and update title if needed
    if (this.titleText) {
      this.titleText.destroy();
      this.titleText = undefined;
    }

    let yOffset = this.config.padding;

    if (this.currentTitle) {
      this.titleText = this.scene.add.text(
        this.config.padding,
        yOffset,
        this.currentTitle,
        {
          fontFamily: UIFonts.PRIMARY,
          fontSize: `${this.config.titleFontSize}px`,
          color: Phaser.Display.Color.IntegerToColor(this.config.titleColor).rgba,
          fontStyle: 'bold',
          wordWrap: { width: this.config.maxWidth - this.config.padding * 2 },
        }
      );
      this.container.add(this.titleText);
      yOffset += this.titleText.height + 6;
    }

    // Update body text
    this.bodyText.setText(this.currentBody);
    this.bodyText.setY(yOffset);

    // Redraw background
    this.redrawBackground();
  }

  private redrawBackground(): void {
    this.background.clear();

    // Calculate size based on content
    let width = this.bodyText.width + this.config.padding * 2;
    let height = this.bodyText.y + this.bodyText.height + this.config.padding;

    if (this.titleText) {
      width = Math.max(width, this.titleText.width + this.config.padding * 2);
    }

    width = Math.min(width, this.config.maxWidth);

    const radius = this.config.borderRadius;
    const bw = this.config.borderWidth;

    // Draw border
    if (bw > 0) {
      this.background.fillStyle(this.config.borderColor, 1);
      this.background.fillRoundedRect(0, 0, width, height, radius);
    }

    // Draw background
    this.background.fillStyle(this.config.backgroundColor, this.config.backgroundAlpha);
    this.background.fillRoundedRect(bw, bw, width - bw * 2, height - bw * 2, Math.max(0, radius - bw));
  }

  private positionTooltip(x: number, y: number): void {
    // Calculate tooltip bounds
    const width = Math.min(
      Math.max(
        this.bodyText.width + this.config.padding * 2,
        this.titleText ? this.titleText.width + this.config.padding * 2 : 0
      ),
      this.config.maxWidth
    );
    const height = this.bodyText.y + this.bodyText.height + this.config.padding;

    // Adjust position to keep tooltip on screen
    let finalX = x + this.config.offsetX;
    let finalY = y + this.config.offsetY;

    // Right edge
    if (finalX + width > this.screenWidth) {
      finalX = x - width - this.config.offsetX;
    }

    // Left edge
    if (finalX < 0) {
      finalX = 0;
    }

    // Bottom edge
    if (finalY + height > this.screenHeight) {
      finalY = y - height - this.config.offsetY;
    }

    // Top edge
    if (finalY < 0) {
      finalY = 0;
    }

    this.container.setPosition(finalX, finalY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this._visible && this.config.followMouse) {
      this.positionTooltip(pointer.x, pointer.y);
    }
  }

  update(_dt: number): void {
    // Tooltip doesn't need per-frame updates
  }

  show(): void {
    // Use showAt instead
  }

  hide(): void {
    this.pendingShow = false;
    if (this.showTimer) {
      this.showTimer.destroy();
      this.showTimer = undefined;
    }

    if (this._visible) {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 100,
        onComplete: () => {
          this.visible = false;
        },
      });
    }
  }

  destroy(): void {
    if (this.showTimer) {
      this.showTimer.destroy();
    }
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
