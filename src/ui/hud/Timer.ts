/**
 * Timer component for Cosmic Survivors HUD.
 * Displays game time (MM:SS) and wave indicator.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth } from '../UIConstants';

export interface TimerConfig {
  x: number;
  y: number;
}

export interface TimerData {
  time: number; // Time in seconds
  wave?: number;
  maxWave?: number;
}

export class Timer implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private timeText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private config: TimerConfig;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  private currentTime: number = 0;
  private currentWave: number = 1;
  private maxWave?: number;

  constructor(scene: Phaser.Scene, config: TimerConfig) {
    this.id = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD);

    // Create background
    this.background = scene.add.graphics();
    this.background.fillStyle(UIColors.PANEL_BG, 0.8);
    this.background.fillRoundedRect(-60, -20, 120, 60, 8);
    this.container.add(this.background);

    // Create time text (main display)
    this.timeText = scene.add.text(0, -5, '00:00', {
      fontFamily: UIFonts.MONO,
      fontSize: '28px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      fontStyle: 'bold',
    });
    this.timeText.setOrigin(0.5);
    this.container.add(this.timeText);

    // Create wave text
    this.waveText = scene.add.text(0, 22, 'Wave 1', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
    });
    this.waveText.setOrigin(0.5);
    this.container.add(this.waveText);
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

  updateData(data: TimerData): void {
    const oldWave = this.currentWave;

    this.currentTime = data.time;
    if (data.wave !== undefined) {
      this.currentWave = data.wave;
    }
    if (data.maxWave !== undefined) {
      this.maxWave = data.maxWave;
    }

    // Wave change animation
    if (data.wave !== undefined && data.wave !== oldWave) {
      this.playWaveChangeAnimation();
    }

    this.updateDisplay();
  }

  private playWaveChangeAnimation(): void {
    // Flash the wave text
    this.scene.tweens.add({
      targets: this.waveText,
      scale: { from: 1.3, to: 1 },
      duration: 300,
      ease: 'Quad.easeOut',
    });

    // Temporarily change color
    this.waveText.setColor(Phaser.Display.Color.IntegerToColor(UIColors.ACCENT).rgba);
    this.scene.time.delayedCall(500, () => {
      this.waveText.setColor(Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba);
    });
  }

  private updateDisplay(): void {
    // Format time as MM:SS
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = Math.floor(this.currentTime % 60);
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timeText.setText(timeString);

    // Update wave text
    let waveString = `Wave ${this.currentWave}`;
    if (this.maxWave !== undefined) {
      waveString += `/${this.maxWave}`;
    }
    this.waveText.setText(waveString);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // Timer is updated via updateData, not per-frame
  }

  show(): void {
    this.visible = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      y: { from: this.config.y - 20, to: this.config.y },
      duration: 300,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.config.y - 20,
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
}
