/**
 * GameOverScreen for Cosmic Survivors.
 * Displays game over stats with restart and main menu options.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes } from '../UIConstants';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { StatsScreen, type GameStats } from './StatsScreen';

export interface GameOverScreenConfig {
  screenWidth: number;
  screenHeight: number;
  onRestart?: () => void;
  onMainMenu?: () => void;
  onViewStats?: () => GameStats | null;
}

export interface GameOverStats {
  timeSurvived: number;
  kills: number;
  level: number;
  damageDealt: number;
  xpEarned: number;
  isVictory?: boolean;
}

export class GameOverScreen implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private panel: Panel;
  private title: Phaser.GameObjects.Text;
  private statsContainer: Phaser.GameObjects.Container;
  private buttons: Button[] = [];
  private config: GameOverScreenConfig;
  private _visible: boolean = false;
  private _interactive: boolean = true;
  private statsScreen: StatsScreen | null = null;
  private lastGameStats: GameStats | null = null;

  constructor(scene: Phaser.Scene, config: GameOverScreenConfig) {
    this.id = `gameoverscreen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.SCREENS);
    this.container.setVisible(false);
    this.container.setScrollFactor(0);

    // Create dark overlay
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(UIColors.OVERLAY_BG, 0.85);
    this.overlay.fillRect(0, 0, config.screenWidth, config.screenHeight);
    this.container.add(this.overlay);

    // Create main panel
    const panelWidth = 500;
    const panelHeight = 550;
    this.panel = new Panel(scene, {
      x: (config.screenWidth - panelWidth) / 2,
      y: (config.screenHeight - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
    });
    this.container.add(this.panel.getContainer());

    // Create title
    this.title = scene.add.text(
      config.screenWidth / 2,
      config.screenHeight / 2 - 220,
      'GAME OVER',
      {
        fontFamily: UIFonts.TITLE,
        fontSize: `${UISizes.TITLE_FONT_SIZE}px`,
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DAMAGE).rgba,
        stroke: '#000000',
        strokeThickness: 4,
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
  }

  private createButtons(): void {
    const buttonWidth = 180;
    const buttonHeight = UISizes.BUTTON_HEIGHT;
    const buttonY = this.config.screenHeight / 2 + 170;
    const centerX = this.config.screenWidth / 2;
    const buttonSpacing = 15;

    // View Stats button
    const statsBtn = new Button(this.scene, {
      x: centerX - buttonWidth - buttonSpacing,
      y: buttonY,
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

    // Restart button
    const restartBtn = new Button(this.scene, {
      x: centerX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Play Again',
      backgroundColor: UIColors.SUCCESS,
      hoverColor: 0x8ef331,
      onClick: () => {
        this.config.onRestart?.();
      },
    });
    this.buttons.push(restartBtn);
    this.container.add(restartBtn.getContainer());

    // Main Menu button
    const menuBtn = new Button(this.scene, {
      x: centerX + buttonWidth + buttonSpacing,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      text: 'Main Menu',
      onClick: () => {
        this.config.onMainMenu?.();
      },
    });
    this.buttons.push(menuBtn);
    this.container.add(menuBtn.getContainer());
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

    // Get game stats from callback or stored stats
    const gameStats = this.config.onViewStats?.() ?? this.lastGameStats;
    if (gameStats) {
      this.statsScreen.showWithStats(gameStats);
    }
  }

  /**
   * Set game stats to be shown in stats screen.
   */
  setGameStats(stats: GameStats): void {
    this.lastGameStats = stats;
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
   * Show game over screen with stats.
   */
  showWithStats(stats: GameOverStats): void {
    this.updateStats(stats);
    this.show();
  }

  /**
   * Update stats display.
   */
  updateStats(stats: GameOverStats): void {
    // Update title based on victory/defeat
    if (stats.isVictory) {
      this.title.setText('VICTORY!');
      this.title.setColor(Phaser.Display.Color.IntegerToColor(UIColors.SUCCESS).rgba);
    } else {
      this.title.setText('GAME OVER');
      this.title.setColor(Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DAMAGE).rgba);
    }

    // Clear existing stats
    this.statsContainer.removeAll(true);

    const lineHeight = 36;
    let y = 0;

    // Stats data
    const statsData = [
      { label: 'Time Survived', value: this.formatTime(stats.timeSurvived), color: UIColors.TEXT_PRIMARY },
      { label: 'Level Reached', value: stats.level.toString(), color: UIColors.TEXT_XP },
      { label: 'Enemies Killed', value: stats.kills.toLocaleString(), color: UIColors.TEXT_DAMAGE },
      { label: 'Damage Dealt', value: this.formatNumber(stats.damageDealt), color: UIColors.ACCENT },
      { label: 'XP Earned', value: `+${stats.xpEarned.toLocaleString()}`, color: UIColors.TEXT_XP },
    ];

    statsData.forEach(stat => {
      // Label
      const label = this.scene.add.text(-150, y, stat.label, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      label.setOrigin(0, 0.5);
      this.statsContainer.add(label);

      // Value
      const value = this.scene.add.text(150, y, stat.value, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '22px',
        color: Phaser.Display.Color.IntegerToColor(stat.color).rgba,
        fontStyle: 'bold',
      });
      value.setOrigin(1, 0.5);
      this.statsContainer.add(value);

      // Separator line
      const line = this.scene.add.graphics();
      line.lineStyle(1, UIColors.BORDER, 0.3);
      line.moveTo(-150, y + 18);
      line.lineTo(150, y + 18);
      line.strokePath();
      this.statsContainer.add(line);

      y += lineHeight;
    });

    // XP earned highlight
    const xpBadge = this.scene.add.graphics();
    xpBadge.fillStyle(UIColors.PRIMARY, 0.2);
    xpBadge.fillRoundedRect(-160, y + 10, 320, 50, 8);
    this.statsContainer.add(xpBadge);

    const xpLabel = this.scene.add.text(0, y + 35, 'Meta XP Earned', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_XP).rgba,
    });
    xpLabel.setOrigin(0.5);
    this.statsContainer.add(xpLabel);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  }

  show(): void {
    this.visible = true;
    this._interactive = true;

    // Animate in
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 500,
    });

    // Title animation
    this.title.setScale(0.5);
    this.scene.tweens.add({
      targets: this.title,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 200,
    });

    // Stats animation
    const statsChildren = this.statsContainer.list;
    statsChildren.forEach((child, index) => {
      if (child instanceof Phaser.GameObjects.Text || child instanceof Phaser.GameObjects.Graphics) {
        (child as Phaser.GameObjects.Components.Alpha).setAlpha(0);
        this.scene.tweens.add({
          targets: child,
          alpha: 1,
          duration: 200,
          delay: 400 + index * 50,
        });
      }
    });

    // Buttons animation
    this.buttons.forEach((btn, index) => {
      const container = btn.getContainer();
      container.setAlpha(0);
      container.setY(container.y + 30);
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        y: container.y - 30,
        duration: 300,
        delay: 800 + index * 100,
        ease: 'Quad.easeOut',
      });
    });
  }

  hide(): void {
    this._interactive = false;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  update(_dt: number): void {
    // Screen doesn't need per-frame updates
  }

  destroy(): void {
    this.buttons.forEach(btn => btn.destroy());
    this.panel.destroy();
    this.statsScreen?.destroy();
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
