/**
 * WeaponSlots component for Cosmic Survivors HUD.
 * Displays player's equipped weapons with cooldown indicators and level badges.
 */

import * as Phaser from 'phaser';
import type { IUIComponent, IHUDWeaponSlotData } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes } from '../UIConstants';
import { PLAYER_MAX_WEAPONS } from '@shared/constants/game';

export interface WeaponSlotsConfig {
  x: number;
  y: number;
  slotSize?: number;
  gap?: number;
  maxSlots?: number;
}

interface WeaponSlot {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  icon?: Phaser.GameObjects.Image;
  cooldownOverlay: Phaser.GameObjects.Graphics;
  levelBadge: Phaser.GameObjects.Container;
  levelText: Phaser.GameObjects.Text;
  weaponId?: string;
}

export class WeaponSlots implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private slots: WeaponSlot[] = [];
  private config: Required<WeaponSlotsConfig>;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  constructor(scene: Phaser.Scene, config: WeaponSlotsConfig) {
    this.id = `weaponslots_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      slotSize: UISizes.WEAPON_SLOT_SIZE,
      gap: UISizes.WEAPON_SLOT_GAP,
      maxSlots: PLAYER_MAX_WEAPONS,
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD);

    // Create weapon slots
    for (let i = 0; i < this.config.maxSlots; i++) {
      this.createSlot(i);
    }
  }

  private createSlot(index: number): void {
    const x = index * (this.config.slotSize + this.config.gap);
    const slotContainer = this.scene.add.container(x, 0);
    this.container.add(slotContainer);

    // Background
    const background = this.scene.add.graphics();
    background.fillStyle(UIColors.PANEL_BG, 0.9);
    background.fillRoundedRect(0, 0, this.config.slotSize, this.config.slotSize, 8);
    background.lineStyle(2, UIColors.BORDER);
    background.strokeRoundedRect(0, 0, this.config.slotSize, this.config.slotSize, 8);
    slotContainer.add(background);

    // Cooldown overlay
    const cooldownOverlay = this.scene.add.graphics();
    slotContainer.add(cooldownOverlay);

    // Level badge (bottom right)
    const levelBadge = this.scene.add.container(
      this.config.slotSize - 8,
      this.config.slotSize - 8
    );
    levelBadge.setVisible(false);
    slotContainer.add(levelBadge);

    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(UIColors.PRIMARY, 1);
    badgeBg.fillCircle(0, 0, 10);
    badgeBg.lineStyle(1, UIColors.BORDER);
    badgeBg.strokeCircle(0, 0, 10);
    levelBadge.add(badgeBg);

    const levelText = this.scene.add.text(0, 0, '1', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '11px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      fontStyle: 'bold',
    });
    levelText.setOrigin(0.5);
    levelBadge.add(levelText);

    // Slot number indicator
    const slotNumber = this.scene.add.text(
      this.config.slotSize / 2,
      this.config.slotSize / 2,
      (index + 1).toString(),
      {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '20px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DISABLED).rgba,
      }
    );
    slotNumber.setOrigin(0.5);
    slotNumber.setAlpha(0.5);
    slotContainer.add(slotNumber);

    this.slots.push({
      container: slotContainer,
      background,
      cooldownOverlay,
      levelBadge,
      levelText,
    });
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

  updateData(data: IHUDWeaponSlotData): void {
    // Update each slot with weapon data
    for (let i = 0; i < this.config.maxSlots; i++) {
      const slot = this.slots[i];
      const weapon = data.weapons[i];

      if (weapon) {
        this.updateSlot(slot, weapon);
      } else {
        this.clearSlot(slot);
      }
    }
  }

  private updateSlot(
    slot: WeaponSlot,
    weapon: { id: string; icon: string; level: number; cooldownPercent: number }
  ): void {
    // Update or create icon
    if (slot.weaponId !== weapon.id) {
      // Weapon changed - update icon
      if (slot.icon) {
        slot.icon.destroy();
      }

      slot.icon = this.scene.add.image(
        this.config.slotSize / 2,
        this.config.slotSize / 2,
        weapon.icon
      );
      slot.icon.setDisplaySize(this.config.slotSize - 16, this.config.slotSize - 16);
      slot.container.add(slot.icon);
      slot.container.sendToBack(slot.background);

      slot.weaponId = weapon.id;
    }

    // Update level badge
    slot.levelBadge.setVisible(true);
    slot.levelText.setText(weapon.level.toString());

    // Update cooldown overlay
    this.drawCooldown(slot.cooldownOverlay, weapon.cooldownPercent);
  }

  private clearSlot(slot: WeaponSlot): void {
    if (slot.icon) {
      slot.icon.destroy();
      slot.icon = undefined;
    }
    slot.weaponId = undefined;
    slot.levelBadge.setVisible(false);
    slot.cooldownOverlay.clear();
  }

  private drawCooldown(graphics: Phaser.GameObjects.Graphics, percent: number): void {
    graphics.clear();

    if (percent <= 0 || percent >= 1) return;

    const size = this.config.slotSize;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 4;

    // Draw radial cooldown overlay
    graphics.fillStyle(UIColors.COOLDOWN_FILL, 0.6);

    // Draw arc from top, going clockwise for cooldown remaining
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * percent;

    graphics.beginPath();
    graphics.moveTo(centerX, centerY);
    graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
    graphics.closePath();
    graphics.fillPath();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  update(_dt: number): void {
    // WeaponSlots doesn't need per-frame updates
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
    this.slots.forEach(slot => {
      slot.container.destroy();
    });
    this.slots = [];
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
