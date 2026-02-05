/**
 * TouchPauseButton - Pause icon button for mobile, top-right corner.
 * Two vertical bars in a circle.
 */

import * as Phaser from 'phaser';

export class TouchPauseButton {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly radius = 20;
  private onPause: () => void;

  constructor(scene: Phaser.Scene, onPause: () => void) {
    this.scene = scene;
    this.onPause = onPause;

    this.centerX = scene.cameras.main.width - 50;
    this.centerY = 50;

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(300);

    this.draw();
    this.setupListeners();
  }

  private draw(): void {
    const g = this.graphics;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.radius;

    g.clear();

    // Background circle
    g.fillStyle(0x222222, 0.7);
    g.fillCircle(cx, cy, r);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(cx, cy, r);

    // Two pause bars
    const barWidth = 4;
    const barHeight = 16;
    const gap = 4;

    g.fillStyle(0xffffff, 0.9);
    g.fillRect(cx - gap - barWidth, cy - barHeight / 2, barWidth, barHeight);
    g.fillRect(cx + gap, cy - barHeight / 2, barWidth, barHeight);
  }

  private setupListeners(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.centerX;
      const dy = pointer.y - this.centerY;
      if (dx * dx + dy * dy <= this.radius * this.radius) {
        this.onPause();
      }
    });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
