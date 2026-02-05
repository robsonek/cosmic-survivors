/**
 * VirtualJoystick - Touch joystick for mobile movement.
 * Appears where the player touches on the left half of the screen.
 * Outputs normalized moveX/moveY in range -1..1.
 */

import * as Phaser from 'phaser';

export interface JoystickOutput {
  moveX: number;
  moveY: number;
  isActive: boolean;
}

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;

  private baseX = 0;
  private baseY = 0;
  private thumbX = 0;
  private thumbY = 0;

  private readonly baseRadius = 80;
  private readonly thumbRadius = 30;
  private readonly deadZone = 0.15; // 15% of base radius

  private activePointerId: number | null = null;
  private _moveX = 0;
  private _moveY = 0;
  private _isActive = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Base circle (outline, semi-transparent)
    this.base = scene.add.graphics();
    this.base.setScrollFactor(0);
    this.base.setDepth(300);
    this.base.setVisible(false);

    // Thumb circle (filled, more opaque)
    this.thumb = scene.add.graphics();
    this.thumb.setScrollFactor(0);
    this.thumb.setDepth(301);
    this.thumb.setVisible(false);

    this.setupListeners();
  }

  get moveX(): number { return this._moveX; }
  get moveY(): number { return this._moveY; }
  get isActive(): boolean { return this._isActive; }

  private setupListeners(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only accept touches on left half of screen
      if (pointer.x > this.scene.cameras.main.width / 2) return;
      // Only accept if no joystick is already active
      if (this.activePointerId !== null) return;

      this.activePointerId = pointer.id;
      this.baseX = pointer.x;
      this.baseY = pointer.y;
      this.thumbX = pointer.x;
      this.thumbY = pointer.y;
      this._isActive = true;

      this.drawBase();
      this.drawThumb();
      this.base.setVisible(true);
      this.thumb.setVisible(true);
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.activePointerId) return;

      const dx = pointer.x - this.baseX;
      const dy = pointer.y - this.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clamp thumb within base radius
      if (dist > this.baseRadius) {
        this.thumbX = this.baseX + (dx / dist) * this.baseRadius;
        this.thumbY = this.baseY + (dy / dist) * this.baseRadius;
      } else {
        this.thumbX = pointer.x;
        this.thumbY = pointer.y;
      }

      // Calculate normalized output with dead zone
      const clampedDist = Math.min(dist, this.baseRadius);
      const normalizedDist = clampedDist / this.baseRadius;

      if (normalizedDist < this.deadZone) {
        this._moveX = 0;
        this._moveY = 0;
      } else {
        // Remap from [deadZone..1] to [0..1]
        const remapped = (normalizedDist - this.deadZone) / (1 - this.deadZone);
        const angle = Math.atan2(dy, dx);
        this._moveX = Math.cos(angle) * remapped;
        this._moveY = Math.sin(angle) * remapped;
      }

      this.drawThumb();
    });

    const onPointerUp = (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.activePointerId) return;

      this.activePointerId = null;
      this._moveX = 0;
      this._moveY = 0;
      this._isActive = false;

      this.base.setVisible(false);
      this.thumb.setVisible(false);
    };

    this.scene.input.on('pointerup', onPointerUp);
    this.scene.input.on('pointerupoutside', onPointerUp);
  }

  private drawBase(): void {
    this.base.clear();
    this.base.setPosition(this.baseX, this.baseY);

    // Semi-transparent filled circle
    this.base.fillStyle(0xffffff, 0.1);
    this.base.fillCircle(0, 0, this.baseRadius);

    // White stroke
    this.base.lineStyle(2, 0xffffff, 0.3);
    this.base.strokeCircle(0, 0, this.baseRadius);
  }

  private drawThumb(): void {
    this.thumb.clear();
    this.thumb.setPosition(this.thumbX, this.thumbY);

    // Cyan filled thumb
    this.thumb.fillStyle(0x00ffff, 0.7);
    this.thumb.fillCircle(0, 0, this.thumbRadius);

    // Brighter border
    this.thumb.lineStyle(2, 0x00ffff, 0.9);
    this.thumb.strokeCircle(0, 0, this.thumbRadius);
  }

  /** Get the movement direction angle in radians (for dash direction etc.) */
  getDirection(): number {
    return Math.atan2(this._moveY, this._moveX);
  }

  destroy(): void {
    this.base.destroy();
    this.thumb.destroy();
  }
}
