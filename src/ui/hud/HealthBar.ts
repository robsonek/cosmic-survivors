/**
 * HealthBar component for Cosmic Survivors HUD.
 * Displays player health with damage/heal animations and shield indicator.
 */

import * as Phaser from 'phaser';
import type { IUIComponent, IHUDHealthData } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes } from '../UIConstants';

export interface HealthBarConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export class HealthBar implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private healthFill: Phaser.GameObjects.Graphics;
  private shieldFill: Phaser.GameObjects.Graphics;
  private damageFill: Phaser.GameObjects.Graphics;
  private healthText: Phaser.GameObjects.Text;
  private config: Required<HealthBarConfig>;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  private currentHealth: number = 100;
  private maxHealth: number = 100;
  private currentShield: number = 0;
  private displayHealth: number = 100;
  private damageDisplayHealth: number = 100;
  private healthTween?: Phaser.Tweens.Tween;
  private damageTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: HealthBarConfig) {
    this.id = `healthbar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      width: UISizes.HEALTH_BAR_WIDTH,
      height: UISizes.HEALTH_BAR_HEIGHT,
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD);

    // Create background
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create damage fill (shows damage dealt animation)
    this.damageFill = scene.add.graphics();
    this.container.add(this.damageFill);

    // Create health fill
    this.healthFill = scene.add.graphics();
    this.container.add(this.healthFill);

    // Create shield fill
    this.shieldFill = scene.add.graphics();
    this.container.add(this.shieldFill);

    // Create health text
    this.healthText = scene.add.text(
      this.config.width / 2,
      this.config.height / 2,
      '100/100',
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
        fontStyle: 'bold',
      }
    );
    this.healthText.setOrigin(0.5);
    this.container.add(this.healthText);

    // Create heart icon
    const heartIcon = scene.add.text(-20, this.config.height / 2, '\u2665', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.HEALTH_FILL).rgba,
    });
    heartIcon.setOrigin(0.5);
    this.container.add(heartIcon);

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

  updateData(data: IHUDHealthData): void {
    const oldHealth = this.currentHealth;
    this.currentHealth = data.current;
    this.maxHealth = data.max;
    this.currentShield = data.shield ?? 0;

    // Animate health change
    const healthDelta = data.current - oldHealth;

    if (healthDelta < 0) {
      // Damage taken - show damage animation
      this.animateDamage(oldHealth, data.current);
    } else if (healthDelta > 0) {
      // Healed - animate directly
      this.animateHealth(data.current);
    } else {
      this.displayHealth = data.current;
      this.damageDisplayHealth = data.current;
    }

    this.redraw();
  }

  private animateDamage(oldHealth: number, newHealth: number): void {
    // Flash red
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 1, to: 0.5 },
      duration: 50,
      yoyo: true,
      repeat: 1,
    });

    // Immediately update health fill
    this.displayHealth = newHealth;
    this.redrawHealthFill();

    // Animate damage fill (delay to show damage amount)
    if (this.damageTween) {
      this.damageTween.stop();
    }

    this.damageDisplayHealth = oldHealth;
    this.redrawDamageFill();

    this.damageTween = this.scene.tweens.add({
      targets: this,
      damageDisplayHealth: newHealth,
      duration: 500,
      delay: 200,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.redrawDamageFill();
      },
    });
  }

  private animateHealth(targetHealth: number): void {
    if (this.healthTween) {
      this.healthTween.stop();
    }

    this.healthTween = this.scene.tweens.add({
      targets: this,
      displayHealth: targetHealth,
      duration: 300,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.redrawHealthFill();
      },
      onComplete: () => {
        this.damageDisplayHealth = targetHealth;
        this.redrawDamageFill();
      },
    });

    // Green flash for healing
    this.scene.tweens.add({
      targets: this.healthFill,
      alpha: { from: 1.5, to: 1 },
      duration: 200,
    });
  }

  private redraw(): void {
    this.redrawBackground();
    this.redrawDamageFill();
    this.redrawHealthFill();
    this.redrawShieldFill();
    this.updateText();
  }

  private redrawBackground(): void {
    this.background.clear();

    const width = this.config.width;
    const height = this.config.height;
    const radius = 4;

    // Draw border
    this.background.fillStyle(UIColors.BORDER, 1);
    this.background.fillRoundedRect(0, 0, width, height, radius);

    // Draw background
    this.background.fillStyle(UIColors.PROGRESS_BG, 1);
    this.background.fillRoundedRect(2, 2, width - 4, height - 4, radius - 1);
  }

  private redrawDamageFill(): void {
    this.damageFill.clear();

    const percent = this.maxHealth > 0 ? this.damageDisplayHealth / this.maxHealth : 0;
    if (percent <= 0) return;

    const innerWidth = this.config.width - 4;
    const innerHeight = this.config.height - 4;
    const fillWidth = innerWidth * Math.min(1, percent);

    this.damageFill.fillStyle(UIColors.WARNING, 0.7);
    this.damageFill.fillRoundedRect(2, 2, fillWidth, innerHeight, {
      tl: 3,
      tr: fillWidth >= innerWidth - 1 ? 3 : 0,
      br: fillWidth >= innerWidth - 1 ? 3 : 0,
      bl: 3,
    });
  }

  private redrawHealthFill(): void {
    this.healthFill.clear();

    const percent = this.maxHealth > 0 ? this.displayHealth / this.maxHealth : 0;
    if (percent <= 0) return;

    const innerWidth = this.config.width - 4;
    const innerHeight = this.config.height - 4;
    const fillWidth = innerWidth * Math.min(1, percent);

    // Use different color when low health
    const fillColor = percent <= 0.25 ? UIColors.HEALTH_LOW : UIColors.HEALTH_FILL;

    this.healthFill.fillStyle(fillColor, 1);
    this.healthFill.fillRoundedRect(2, 2, fillWidth, innerHeight, {
      tl: 3,
      tr: fillWidth >= innerWidth - 1 ? 3 : 0,
      br: fillWidth >= innerWidth - 1 ? 3 : 0,
      bl: 3,
    });
  }

  private redrawShieldFill(): void {
    this.shieldFill.clear();

    if (this.currentShield <= 0) return;

    // Shield is drawn as a partial overlay on top of health
    const healthPercent = this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;
    const shieldPercent = this.maxHealth > 0 ? this.currentShield / this.maxHealth : 0;

    const innerWidth = this.config.width - 4;
    const innerHeight = this.config.height - 4;
    const startX = 2 + innerWidth * healthPercent;
    const shieldWidth = innerWidth * Math.min(shieldPercent, 1 - healthPercent);

    if (shieldWidth <= 0) return;

    this.shieldFill.fillStyle(UIColors.SHIELD_FILL, 0.8);
    this.shieldFill.fillRect(startX, 2, shieldWidth, innerHeight);
  }

  private updateText(): void {
    const healthText = `${Math.ceil(this.currentHealth)}/${this.maxHealth}`;
    const shieldText = this.currentShield > 0 ? ` (+${Math.ceil(this.currentShield)})` : '';
    this.healthText.setText(healthText + shieldText);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // HealthBar doesn't need per-frame updates
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
    if (this.healthTween) {
      this.healthTween.stop();
    }
    if (this.damageTween) {
      this.damageTween.stop();
    }
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
