/**
 * PauseScreen for Cosmic Survivors.
 * Displays pause menu with resume, settings, and quit options.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes } from '../UIConstants';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { StatsScreen, type GameStats } from './StatsScreen';

export interface PauseScreenConfig {
  screenWidth: number;
  screenHeight: number;
  onResume?: () => void;
  onSettings?: () => void;
  onQuit?: () => void;
  onViewStats?: () => GameStats | null;
}

export interface PauseStats {
  time: number;
  level: number;
  kills: number;
  weapons: Array<{ name: string; level: number }>;
}

export class PauseScreen implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private panel: Panel;
  private title: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private statsContainer: Phaser.GameObjects.Container;
  private config: PauseScreenConfig;
  private _visible: boolean = false;
  private _interactive: boolean = true;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private statsScreen: StatsScreen | null = null;

  constructor(scene: Phaser.Scene, config: PauseScreenConfig) {
    this.id = `pausescreen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.SCREENS);
    this.container.setVisible(false);
    this.container.setScrollFactor(0);

    // Create dark overlay
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(UIColors.OVERLAY_BG, 0.7);
    this.overlay.fillRect(0, 0, config.screenWidth, config.screenHeight);
    this.container.add(this.overlay);

    // Create main panel
    const panelWidth = 400;
    const panelHeight = 500;
    this.panel = new Panel(scene, {
      x: (config.screenWidth - panelWidth) / 2,
      y: (config.screenHeight - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
      title: 'PAUSED',
      titleFontSize: 28,
    });
    this.container.add(this.panel.getContainer());

    // Create title (in panel)
    this.title = scene.add.text(
      config.screenWidth / 2,
      config.screenHeight / 2 - 180,
      'GAME PAUSED',
      {
        fontFamily: UIFonts.TITLE,
        fontSize: `${UISizes.HEADING_FONT_SIZE}px`,
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      }
    );
    this.title.setOrigin(0.5);
    this.container.add(this.title);

    // Create stats container
    this.statsContainer = scene.add.container(
      config.screenWidth / 2,
      config.screenHeight / 2 - 100
    );
    this.container.add(this.statsContainer);

    // Create buttons
    this.createButtons();

    // Setup keyboard
    this.setupKeyboardControls();
  }

  private createButtons(): void {
    const buttonWidth = 250;
    const buttonHeight = UISizes.BUTTON_HEIGHT;
    const buttonY = this.config.screenHeight / 2 + 30;
    const centerX = this.config.screenWidth / 2;
    const buttonSpacing = 55;

    // Resume button
    const resumeBtn = new Button(this.scene, {
      x: centerX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Resume',
      backgroundColor: UIColors.SUCCESS,
      hoverColor: 0x8ef331,
      onClick: () => {
        this.hide();
        this.config.onResume?.();
      },
    });
    this.buttons.push(resumeBtn);
    this.container.add(resumeBtn.getContainer());

    // View Stats button
    const statsBtn = new Button(this.scene, {
      x: centerX,
      y: buttonY + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      text: 'View Stats',
      backgroundColor: UIColors.PRIMARY,
      hoverColor: UIColors.PRIMARY_LIGHT,
      onClick: () => {
        this.showStatsScreen();
      },
    });
    this.buttons.push(statsBtn);
    this.container.add(statsBtn.getContainer());

    // Settings button
    const settingsBtn = new Button(this.scene, {
      x: centerX,
      y: buttonY + buttonSpacing * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Settings',
      onClick: () => {
        this.config.onSettings?.();
      },
    });
    this.buttons.push(settingsBtn);
    this.container.add(settingsBtn.getContainer());

    // Quit button
    const quitBtn = new Button(this.scene, {
      x: centerX,
      y: buttonY + buttonSpacing * 3,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Quit to Menu',
      backgroundColor: UIColors.ERROR,
      hoverColor: 0xf02030,
      onClick: () => {
        this.config.onQuit?.();
      },
    });
    this.buttons.push(quitBtn);
    this.container.add(quitBtn.getContainer());
  }

  /**
   * Show the stats screen overlay.
   */
  private showStatsScreen(): void {
    if (!this.statsScreen) {
      this.statsScreen = new StatsScreen(this.scene, {
        screenWidth: this.config.screenWidth,
        screenHeight: this.config.screenHeight,
        onClose: () => {
          // Stats screen will hide itself
        },
      });
    }

    // Get current game stats from callback
    const gameStats = this.config.onViewStats?.();
    if (gameStats) {
      this.statsScreen.showWithStats(gameStats);
    }
  }

  private setupKeyboardControls(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (!this._visible || !this._interactive) return;

      if (event.key === 'Escape') {
        this.hide();
        this.config.onResume?.();
      }
    };

    window.addEventListener('keydown', this.keyboardHandler);
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
    this.buttons.forEach(btn => {
      btn.interactive = value;
    });
  }

  /**
   * Update stats display.
   */
  updateStats(stats: PauseStats): void {
    // Clear existing stats
    this.statsContainer.removeAll(true);

    const lineHeight = 24;
    let y = 0;

    // Time
    const minutes = Math.floor(stats.time / 60);
    const seconds = Math.floor(stats.time % 60);
    const timeText = this.scene.add.text(0, y, `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '18px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
    });
    timeText.setOrigin(0.5);
    this.statsContainer.add(timeText);
    y += lineHeight;

    // Level
    const levelText = this.scene.add.text(0, y, `Level: ${stats.level}`, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '18px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_XP).rgba,
    });
    levelText.setOrigin(0.5);
    this.statsContainer.add(levelText);
    y += lineHeight;

    // Kills
    const killsText = this.scene.add.text(0, y, `Kills: ${stats.kills}`, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '18px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DAMAGE).rgba,
    });
    killsText.setOrigin(0.5);
    this.statsContainer.add(killsText);
    y += lineHeight + 10;

    // Weapons
    if (stats.weapons.length > 0) {
      const weaponsLabel = this.scene.add.text(0, y, 'Weapons:', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      weaponsLabel.setOrigin(0.5);
      this.statsContainer.add(weaponsLabel);
      y += lineHeight - 4;

      stats.weapons.forEach(weapon => {
        const weaponText = this.scene.add.text(0, y, `${weapon.name} Lv.${weapon.level}`, {
          fontFamily: UIFonts.PRIMARY,
          fontSize: '14px',
          color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
        });
        weaponText.setOrigin(0.5);
        this.statsContainer.add(weaponText);
        y += lineHeight - 6;
      });
    }
  }

  show(): void {
    this.visible = true;
    this._interactive = true;

    // Animate in
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
    });

    // Panel slide in
    const panel = this.panel.getContainer();
    panel.setY(panel.y - 30);
    this.scene.tweens.add({
      targets: panel,
      y: panel.y + 30,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  hide(): void {
    this._interactive = false;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  update(_dt: number): void {
    // Screen doesn't need per-frame updates
  }

  destroy(): void {
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
    }
    this.buttons.forEach(btn => btn.destroy());
    this.panel.destroy();
    this.statsScreen?.destroy();
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
