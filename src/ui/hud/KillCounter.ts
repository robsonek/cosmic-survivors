/**
 * KillCounter component for Cosmic Survivors HUD.
 * Displays kill count with optional DPS/KPM stats.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth } from '../UIConstants';

export interface KillCounterConfig {
  x: number;
  y: number;
  showStats?: boolean;
}

export interface KillCounterData {
  kills: number;
  dps?: number; // Damage per second
  kpm?: number; // Kills per minute
}

export class KillCounter implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private killIcon: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;
  private statsText?: Phaser.GameObjects.Text;
  private config: Required<KillCounterConfig>;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  private currentKills: number = 0;
  private displayKills: number = 0;
  private killTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: KillCounterConfig) {
    this.id = `killcounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      showStats: false,
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD);

    // Create background
    this.background = scene.add.graphics();
    this.background.fillStyle(UIColors.PANEL_BG, 0.8);
    this.background.fillRoundedRect(-80, -15, 160, this.config.showStats ? 50 : 30, 6);
    this.container.add(this.background);

    // Create skull icon
    this.killIcon = scene.add.text(-65, 0, '\u2620', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DAMAGE).rgba,
    });
    this.killIcon.setOrigin(0.5);
    this.container.add(this.killIcon);

    // Create kill count text
    this.killText = scene.add.text(0, 0, '0', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '22px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      fontStyle: 'bold',
    });
    this.killText.setOrigin(0.5);
    this.container.add(this.killText);

    // Create stats text if enabled
    if (this.config.showStats) {
      this.statsText = scene.add.text(0, 18, 'DPS: 0 | KPM: 0', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '11px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      this.statsText.setOrigin(0.5);
      this.container.add(this.statsText);
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

  updateData(data: KillCounterData): void {
    const oldKills = this.currentKills;
    this.currentKills = data.kills;

    // Animate kill count increase
    if (data.kills > oldKills) {
      this.animateKillIncrease(oldKills, data.kills);
    }

    // Update stats
    if (this.statsText && (data.dps !== undefined || data.kpm !== undefined)) {
      const dps = data.dps !== undefined ? Math.round(data.dps) : 0;
      const kpm = data.kpm !== undefined ? Math.round(data.kpm * 10) / 10 : 0;
      this.statsText.setText(`DPS: ${dps} | KPM: ${kpm}`);
    }
  }

  private animateKillIncrease(from: number, to: number): void {
    // Cancel existing tween
    if (this.killTween) {
      this.killTween.stop();
    }

    // Animate counter
    this.killTween = this.scene.tweens.add({
      targets: this,
      displayKills: to,
      duration: Math.min(300, (to - from) * 30),
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.killText.setText(Math.floor(this.displayKills).toString());
      },
    });

    // Pop animation on icon
    this.scene.tweens.add({
      targets: this.killIcon,
      scale: { from: 1.3, to: 1 },
      duration: 150,
      ease: 'Quad.easeOut',
    });

    // Pulse animation on text
    this.scene.tweens.add({
      targets: this.killText,
      scale: { from: 1.1, to: 1 },
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  addKill(): void {
    this.updateData({ kills: this.currentKills + 1 });
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // KillCounter doesn't need per-frame updates
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
    if (this.killTween) {
      this.killTween.stop();
    }
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
