/**
 * HUD - Main HUD aggregator for Cosmic Survivors.
 * Manages all HUD elements and their positioning.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import {
  HUDElement,
  type IHUDHealthData,
  type IHUDXPData,
  type IHUDWeaponSlotData,
} from '@shared/interfaces/IUI';
import { UIDepth } from '../UIConstants';
import { HealthBar } from './HealthBar';
import { XPBar } from './XPBar';
import { WeaponSlots } from './WeaponSlots';
import { Timer, type TimerData } from './Timer';
import { KillCounter, type KillCounterData } from './KillCounter';

export interface HUDConfig {
  screenWidth: number;
  screenHeight: number;
}

export class HUD implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: HUDConfig;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  // HUD Elements
  private healthBar: HealthBar;
  private xpBar: XPBar;
  private weaponSlots: WeaponSlots;
  private timer: Timer;
  private killCounter: KillCounter;

  // Element visibility
  private elementVisibility: Map<HUDElement, boolean> = new Map();

  constructor(scene: Phaser.Scene, config: HUDConfig) {
    this.id = `hud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.HUD);
    this.container.setScrollFactor(0); // Fixed to camera

    // Calculate positions based on screen size
    const padding = 20;
    const topY = padding;
    const bottomY = config.screenHeight - padding;

    // Create HealthBar (top-left)
    this.healthBar = new HealthBar(scene, {
      x: padding + 30,
      y: topY,
    });
    this.container.add(this.healthBar.getContainer());

    // Create XP Bar (top-center, below health)
    this.xpBar = new XPBar(scene, {
      x: config.screenWidth / 2 - 200,
      y: topY + 35,
    });
    this.container.add(this.xpBar.getContainer());

    // Create Timer (top-center)
    this.timer = new Timer(scene, {
      x: config.screenWidth / 2,
      y: topY + 10,
    });
    this.container.add(this.timer.getContainer());

    // Create Kill Counter (top-right)
    this.killCounter = new KillCounter(scene, {
      x: config.screenWidth - padding - 80,
      y: topY + 15,
      showStats: true,
    });
    this.container.add(this.killCounter.getContainer());

    // Create Weapon Slots (bottom-center)
    this.weaponSlots = new WeaponSlots(scene, {
      x: config.screenWidth / 2 - 200,
      y: bottomY - 70,
    });
    this.container.add(this.weaponSlots.getContainer());

    // Initialize all elements as visible
    Object.values(HUDElement).forEach(element => {
      this.elementVisibility.set(element as HUDElement, true);
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

  /**
   * Update a specific HUD element.
   */
  updateElement(element: HUDElement, data: unknown): void {
    switch (element) {
      case HUDElement.Health:
        this.healthBar.updateData(data as IHUDHealthData);
        break;
      case HUDElement.XPBar:
      case HUDElement.Level:
        this.xpBar.updateData(data as IHUDXPData);
        break;
      case HUDElement.WeaponSlots:
        this.weaponSlots.updateData(data as IHUDWeaponSlotData);
        break;
      case HUDElement.Timer:
        this.timer.updateData(data as TimerData);
        break;
      case HUDElement.KillCount:
        this.killCounter.updateData(data as KillCounterData);
        break;
      default:
        console.warn(`HUD element ${element} not implemented`);
    }
  }

  /**
   * Set visibility of a specific HUD element.
   */
  setElementVisible(element: HUDElement, visible: boolean): void {
    this.elementVisibility.set(element, visible);

    switch (element) {
      case HUDElement.Health:
        this.healthBar.visible = visible;
        break;
      case HUDElement.XPBar:
      case HUDElement.Level:
        this.xpBar.visible = visible;
        break;
      case HUDElement.WeaponSlots:
        this.weaponSlots.visible = visible;
        break;
      case HUDElement.Timer:
        this.timer.visible = visible;
        break;
      case HUDElement.KillCount:
        this.killCounter.visible = visible;
        break;
      default:
        console.warn(`HUD element ${element} not implemented`);
    }
  }

  /**
   * Get component by element type.
   */
  getElement(element: HUDElement): IUIComponent | undefined {
    switch (element) {
      case HUDElement.Health:
        return this.healthBar;
      case HUDElement.XPBar:
      case HUDElement.Level:
        return this.xpBar;
      case HUDElement.WeaponSlots:
        return this.weaponSlots;
      case HUDElement.Timer:
        return this.timer;
      case HUDElement.KillCount:
        return this.killCounter;
      default:
        return undefined;
    }
  }

  /**
   * Resize HUD to new screen dimensions.
   */
  resize(width: number, height: number): void {
    this.config.screenWidth = width;
    this.config.screenHeight = height;

    const padding = 20;
    const topY = padding;
    const bottomY = height - padding;

    // Reposition elements
    this.healthBar.setPosition(padding + 30, topY);
    this.xpBar.setPosition(width / 2 - 200, topY + 35);
    this.timer.setPosition(width / 2, topY + 10);
    this.killCounter.setPosition(width - padding - 80, topY + 15);
    this.weaponSlots.setPosition(width / 2 - 200, bottomY - 70);
  }

  setPosition(_x: number, _y: number): void {
    // HUD is always at 0,0 (screen space)
  }

  update(dt: number): void {
    // Update all HUD elements
    this.healthBar.update(dt);
    this.xpBar.update(dt);
    this.weaponSlots.update(dt);
    this.timer.update(dt);
    this.killCounter.update(dt);
  }

  show(): void {
    this.visible = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 300,
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
    this.healthBar.destroy();
    this.xpBar.destroy();
    this.weaponSlots.destroy();
    this.timer.destroy();
    this.killCounter.destroy();
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
