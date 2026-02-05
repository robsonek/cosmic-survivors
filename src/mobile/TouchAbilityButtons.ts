/**
 * TouchAbilityButtons - 4 ability buttons in diamond layout for mobile.
 * Positioned in bottom-right corner of the screen.
 * Each button has cooldown pie-chart overlay and tap callback.
 */

import * as Phaser from 'phaser';

interface AbilityButtonConfig {
  name: string;
  color: number;
  offsetX: number;
  offsetY: number;
  callback: () => void;
}

interface ButtonState {
  config: AbilityButtonConfig;
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  cooldownRatio: number;
  centerX: number;
  centerY: number;
  wasPressed: boolean;
}

export class TouchAbilityButtons {
  private scene: Phaser.Scene;
  private buttons: ButtonState[] = [];
  private readonly buttonRadius = 35;
  private activePointerIds: Map<number, number> = new Map(); // pointerId -> buttonIndex

  constructor(scene: Phaser.Scene, callbacks: {
    onDash: () => void;
    onUltimate: () => void;
    onBomb: () => void;
    onShield: () => void;
  }) {
    this.scene = scene;
    const w = scene.cameras.main.width;
    const h = scene.cameras.main.height;

    // Diamond layout: center at (w-110, h-130)
    const configs: AbilityButtonConfig[] = [
      { name: 'DASH', color: 0x00ff00, offsetX: 0, offsetY: 50, callback: callbacks.onDash },
      { name: 'ULT', color: 0xff6600, offsetX: 0, offsetY: -50, callback: callbacks.onUltimate },
      { name: 'BOMB', color: 0xff00ff, offsetX: -60, offsetY: 0, callback: callbacks.onBomb },
      { name: 'SHLD', color: 0x00aaff, offsetX: 60, offsetY: 0, callback: callbacks.onShield },
    ];

    const anchorX = w - 110;
    const anchorY = h - 140;

    for (const config of configs) {
      const cx = anchorX + config.offsetX;
      const cy = anchorY + config.offsetY;

      const graphics = scene.add.graphics();
      graphics.setScrollFactor(0);
      graphics.setDepth(300);

      const label = scene.add.text(cx, cy, config.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

      const state: ButtonState = {
        config,
        graphics,
        label,
        cooldownRatio: 0,
        centerX: cx,
        centerY: cy,
        wasPressed: false,
      };

      this.buttons.push(state);
    }

    this.drawAll();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const idx = this.hitTest(pointer.x, pointer.y);
      if (idx === -1) return;

      this.activePointerIds.set(pointer.id, idx);
      this.buttons[idx].wasPressed = true;
      this.buttons[idx].config.callback();
      this.drawButton(idx);
    });

    const onPointerUp = (pointer: Phaser.Input.Pointer) => {
      if (this.activePointerIds.has(pointer.id)) {
        const idx = this.activePointerIds.get(pointer.id)!;
        this.activePointerIds.delete(pointer.id);
        this.buttons[idx].wasPressed = false;
        this.drawButton(idx);
      }
    };

    this.scene.input.on('pointerup', onPointerUp);
    this.scene.input.on('pointerupoutside', onPointerUp);
  }

  private hitTest(x: number, y: number): number {
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      const dx = x - btn.centerX;
      const dy = y - btn.centerY;
      if (dx * dx + dy * dy <= this.buttonRadius * this.buttonRadius) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Update cooldown ratios. Call each frame.
   * @param cooldowns Object with cooldown ratios (0 = ready, 1 = full cooldown)
   */
  updateCooldowns(cooldowns: { dash: number; ultimate: number; bomb: number; shield: number }): void {
    this.buttons[0].cooldownRatio = cooldowns.dash;
    this.buttons[1].cooldownRatio = cooldowns.ultimate;
    this.buttons[2].cooldownRatio = cooldowns.bomb;
    this.buttons[3].cooldownRatio = cooldowns.shield;
    this.drawAll();
  }

  /** Check if a specific ability button was just pressed this frame */
  wasJustPressed(index: number): boolean {
    if (index < 0 || index >= this.buttons.length) return false;
    const pressed = this.buttons[index].wasPressed;
    // Reset after reading (single-frame query)
    this.buttons[index].wasPressed = false;
    return pressed;
  }

  private drawAll(): void {
    for (let i = 0; i < this.buttons.length; i++) {
      this.drawButton(i);
    }
  }

  private drawButton(index: number): void {
    const btn = this.buttons[index];
    const g = btn.graphics;
    const cx = btn.centerX;
    const cy = btn.centerY;
    const r = this.buttonRadius;

    g.clear();

    // Background
    g.fillStyle(0x222222, 0.8);
    g.fillCircle(cx, cy, r);

    // Cooldown overlay (pie chart)
    if (btn.cooldownRatio > 0) {
      g.fillStyle(0x000000, 0.7);
      g.slice(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * btn.cooldownRatio, true);
      g.fillPath();
    }

    // Border - bright when ready, dim when on cooldown
    const isReady = btn.cooldownRatio <= 0;
    const isPressed = this.activePointerIds.size > 0 &&
      Array.from(this.activePointerIds.values()).includes(index);

    if (isPressed) {
      g.lineStyle(4, 0xffffff, 1);
    } else if (isReady) {
      g.lineStyle(3, btn.config.color, 1);
    } else {
      g.lineStyle(2, btn.config.color, 0.4);
    }
    g.strokeCircle(cx, cy, r);
  }

  destroy(): void {
    for (const btn of this.buttons) {
      btn.graphics.destroy();
      btn.label.destroy();
    }
    this.buttons = [];
  }
}
