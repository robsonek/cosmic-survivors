/**
 * MobileInputAdapter - Orchestrates all mobile input components.
 * Single point of contact for GameScene to get mobile input state.
 */

import * as Phaser from 'phaser';
import { VirtualJoystick } from './VirtualJoystick';
import { TouchAbilityButtons } from './TouchAbilityButtons';
import { TouchPauseButton } from './TouchPauseButton';
import { AutoAimSystem } from './AutoAimSystem';
import { OrientationWarning } from './OrientationWarning';

interface EnemyLike {
  x: number;
  y: number;
  active: boolean;
}

export class MobileInputAdapter {
  private joystick: VirtualJoystick;
  private abilityButtons: TouchAbilityButtons;
  private pauseButton: TouchPauseButton;
  private autoAim: AutoAimSystem;
  private orientationWarning: OrientationWarning;

  constructor(scene: Phaser.Scene, callbacks: {
    onDash: () => void;
    onUltimate: () => void;
    onBomb: () => void;
    onShield: () => void;
    onPause: () => void;
  }) {
    this.joystick = new VirtualJoystick(scene);
    this.abilityButtons = new TouchAbilityButtons(scene, {
      onDash: callbacks.onDash,
      onUltimate: callbacks.onUltimate,
      onBomb: callbacks.onBomb,
      onShield: callbacks.onShield,
    });
    this.pauseButton = new TouchPauseButton(scene, callbacks.onPause);
    this.autoAim = new AutoAimSystem();
    this.orientationWarning = new OrientationWarning();
  }

  /** Movement X from joystick, normalized -1..1 */
  get moveX(): number { return this.joystick.moveX; }

  /** Movement Y from joystick, normalized -1..1 */
  get moveY(): number { return this.joystick.moveY; }

  /** Auto-aim angle in radians */
  get aimAngle(): number { return this.autoAim.targetAngle; }

  /** Whether auto-aim found a target */
  get hasTarget(): boolean { return this.autoAim.hasTarget; }

  /** Whether the player should be auto-firing (always true on mobile when target exists or moving) */
  get shouldFire(): boolean {
    return this.autoAim.hasTarget || this.joystick.isActive;
  }

  /** Joystick direction angle for dash */
  get joystickDirection(): number { return this.joystick.getDirection(); }

  /** Whether joystick is currently active */
  get joystickActive(): boolean { return this.joystick.isActive; }

  /**
   * Update auto-aim system. Call every frame.
   */
  update(
    dt: number,
    playerX: number,
    playerY: number,
    enemies: EnemyLike[]
  ): void {
    this.autoAim.update(
      dt,
      playerX,
      playerY,
      enemies,
      this.joystick.moveX,
      this.joystick.moveY
    );
  }

  /**
   * Update ability button cooldown displays.
   */
  updateCooldowns(cooldowns: {
    dash: number;
    ultimate: number;
    bomb: number;
    shield: number;
  }): void {
    this.abilityButtons.updateCooldowns(cooldowns);
  }

  destroy(): void {
    this.joystick.destroy();
    this.abilityButtons.destroy();
    this.pauseButton.destroy();
    this.orientationWarning.destroy();
  }
}
