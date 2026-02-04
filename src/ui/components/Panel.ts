/**
 * Panel component for Cosmic Survivors UI.
 * Provides a styled container with background, border, and optional title.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth } from '../UIConstants';

export interface PanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: number;
  backgroundAlpha?: number;
  borderColor?: number;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  title?: string;
  titleFontSize?: number;
  titleColor?: number;
  titleBarColor?: number;
  titleBarHeight?: number;
  shadow?: boolean;
  shadowColor?: number;
  shadowOffset?: number;
}

export class Panel implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private titleBar?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private contentContainer: Phaser.GameObjects.Container;
  private config: PanelConfig;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  constructor(scene: Phaser.Scene, config: PanelConfig) {
    this.id = `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      backgroundColor: UIColors.PANEL_BG,
      backgroundAlpha: 0.95,
      borderColor: UIColors.BORDER,
      borderWidth: 2,
      borderRadius: 12,
      padding: 16,
      titleFontSize: 20,
      titleColor: UIColors.TEXT_PRIMARY,
      titleBarColor: UIColors.PANEL_HEADER,
      titleBarHeight: 40,
      shadow: true,
      shadowColor: 0x000000,
      shadowOffset: 4,
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.PANELS);

    // Create shadow if enabled
    if (this.config.shadow) {
      const shadow = scene.add.graphics();
      shadow.fillStyle(this.config.shadowColor!, 0.3);
      shadow.fillRoundedRect(
        this.config.shadowOffset!,
        this.config.shadowOffset!,
        this.config.width,
        this.config.height,
        this.config.borderRadius!
      );
      this.container.add(shadow);
    }

    // Create background
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create title bar if title provided
    if (this.config.title) {
      this.titleBar = scene.add.graphics();
      this.container.add(this.titleBar);

      this.titleText = scene.add.text(
        this.config.width / 2,
        this.config.titleBarHeight! / 2,
        this.config.title,
        {
          fontFamily: UIFonts.PRIMARY,
          fontSize: `${this.config.titleFontSize}px`,
          color: Phaser.Display.Color.IntegerToColor(this.config.titleColor!).rgba,
          fontStyle: 'bold',
        }
      );
      this.titleText.setOrigin(0.5);
      this.container.add(this.titleText);
    }

    // Create content container
    const contentY = this.config.title ? this.config.titleBarHeight! : 0;
    this.contentContainer = scene.add.container(this.config.padding!, contentY + this.config.padding!);
    this.container.add(this.contentContainer);

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

  private redraw(): void {
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
    this.background.fillStyle(this.config.backgroundColor!, this.config.backgroundAlpha!);
    this.background.fillRoundedRect(bw, bw, width - bw * 2, height - bw * 2, Math.max(0, radius - bw));

    // Draw title bar
    if (this.titleBar && this.config.title) {
      this.titleBar.clear();
      this.titleBar.fillStyle(this.config.titleBarColor!, 1);
      this.titleBar.fillRoundedRect(
        bw,
        bw,
        width - bw * 2,
        this.config.titleBarHeight! - bw,
        { tl: Math.max(0, radius - bw), tr: Math.max(0, radius - bw), bl: 0, br: 0 }
      );
    }
  }

  setTitle(title: string): void {
    if (this.titleText) {
      this.titleText.setText(title);
    }
  }

  add(child: Phaser.GameObjects.GameObject): void {
    this.contentContainer.add(child);
  }

  remove(child: Phaser.GameObjects.GameObject): void {
    this.contentContainer.remove(child);
  }

  getContentBounds(): { x: number; y: number; width: number; height: number } {
    const titleHeight = this.config.title ? this.config.titleBarHeight! : 0;
    const padding = this.config.padding!;
    const bw = this.config.borderWidth!;

    return {
      x: padding,
      y: titleHeight + padding,
      width: this.config.width - padding * 2 - bw * 2,
      height: this.config.height - titleHeight - padding * 2 - bw * 2,
    };
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.redraw();
  }

  update(_dt: number): void {
    // Panel doesn't need per-frame updates
  }

  show(): void {
    this.visible = true;
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeIn',
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

  getContentContainer(): Phaser.GameObjects.Container {
    return this.contentContainer;
  }
}
