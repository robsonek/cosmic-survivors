/**
 * StatsScreen for Cosmic Survivors.
 * Displays detailed game statistics with comparison to best runs.
 * Shows during pause and game over with metrics like damage, kills, DPS, accuracy.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIColors, UIFonts, UIDepth, UISizes } from '../UIConstants';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';

/** LocalStorage key for best stats */
const BEST_STATS_KEY = 'cosmic_survivors_best_stats';

/**
 * Enemy kill record by type.
 */
export interface EnemyKillRecord {
  type: string;
  count: number;
  displayName: string;
}

/**
 * Weapon usage statistics.
 */
export interface WeaponUsageRecord {
  id: string;
  name: string;
  damageDealt: number;
  kills: number;
  shotsFired: number;
  hits: number;
  timeUsed: number;
}

/**
 * DPS data point for graph.
 */
export interface DPSDataPoint {
  time: number;
  dps: number;
}

/**
 * Complete game statistics.
 */
export interface GameStats {
  // Core stats
  totalDamageDealt: number;
  highestCombo: number;
  enemiesKilledByType: EnemyKillRecord[];
  totalEnemiesKilled: number;

  // Weapon stats
  weaponsUsed: WeaponUsageRecord[];
  mostUsedAbility: { id: string; name: string; uses: number } | null;

  // Movement
  distanceTraveled: number;

  // Progression
  xpEarned: number;
  levelReached: number;

  // Time
  timeSurvived: number;

  // Accuracy
  totalShots: number;
  totalHits: number;
  accuracy: number;

  // DPS over time
  dpsHistory: DPSDataPoint[];
  averageDPS: number;
  peakDPS: number;

  // Meta
  waveReached: number;
  bossesDefeated: number;
  isVictory?: boolean;
}

/**
 * Best stats record for comparison.
 */
export interface BestStats {
  highestDamage: number;
  highestCombo: number;
  mostKills: number;
  longestSurvival: number;
  bestAccuracy: number;
  highestDPS: number;
  furthestWave: number;
  mostBossesDefeated: number;
  highestLevel: number;
  longestDistance: number;
  timestamp: number;
}

export interface StatsScreenConfig {
  screenWidth: number;
  screenHeight: number;
  onClose?: () => void;
}

/**
 * Tab identifiers for stats categories.
 */
enum StatsTab {
  Overview = 'overview',
  Combat = 'combat',
  Weapons = 'weapons',
  DPS = 'dps',
}

export class StatsScreen implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private panel: Panel;
  private title: Phaser.GameObjects.Text;
  private tabButtons: Map<StatsTab, Button> = new Map();
  private contentContainer: Phaser.GameObjects.Container;
  private closeButton: Button;
  private config: StatsScreenConfig;
  private currentStats: GameStats | null = null;
  private bestStats: BestStats | null = null;
  private _visible: boolean = false;
  private _interactive: boolean = true;
  private currentTab: StatsTab = StatsTab.Overview;
  private keyboardHandler?: (event: KeyboardEvent) => void;

  // DPS graph elements
  private dpsGraphContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, config: StatsScreenConfig) {
    this.id = `statsscreen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(UIDepth.SCREENS + 1);
    this.container.setVisible(false);
    this.container.setScrollFactor(0);

    // Load best stats
    this.loadBestStats();

    // Create dark overlay
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(UIColors.OVERLAY_BG, 0.85);
    this.overlay.fillRect(0, 0, config.screenWidth, config.screenHeight);
    this.container.add(this.overlay);

    // Create main panel
    const panelWidth = 800;
    const panelHeight = 650;
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
      config.screenHeight / 2 - 290,
      'GAME STATISTICS',
      {
        fontFamily: UIFonts.TITLE,
        fontSize: `${UISizes.HEADING_FONT_SIZE}px`,
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    this.title.setOrigin(0.5);
    this.container.add(this.title);

    // Create tab buttons
    this.createTabButtons();

    // Create content container
    this.contentContainer = scene.add.container(
      config.screenWidth / 2,
      config.screenHeight / 2 + 20
    );
    this.container.add(this.contentContainer);

    // Create close button
    this.closeButton = new Button(this.scene, {
      x: config.screenWidth / 2,
      y: config.screenHeight / 2 + 280,
      width: 200,
      height: UISizes.BUTTON_HEIGHT,
      text: 'Close',
      backgroundColor: UIColors.PRIMARY,
      hoverColor: UIColors.PRIMARY_LIGHT,
      onClick: () => {
        this.hide();
        this.config.onClose?.();
      },
    });
    this.container.add(this.closeButton.getContainer());

    // Setup keyboard
    this.setupKeyboardControls();
  }

  private createTabButtons(): void {
    const tabs = [
      { id: StatsTab.Overview, label: 'Overview' },
      { id: StatsTab.Combat, label: 'Combat' },
      { id: StatsTab.Weapons, label: 'Weapons' },
      { id: StatsTab.DPS, label: 'DPS Graph' },
    ];

    const buttonWidth = 150;
    const totalWidth = tabs.length * buttonWidth + (tabs.length - 1) * 10;
    const startX = this.config.screenWidth / 2 - totalWidth / 2 + buttonWidth / 2;
    const y = this.config.screenHeight / 2 - 230;

    tabs.forEach((tab, index) => {
      const button = new Button(this.scene, {
        x: startX + index * (buttonWidth + 10),
        y,
        width: buttonWidth,
        height: 36,
        text: tab.label,
        fontSize: 16,
        backgroundColor: tab.id === StatsTab.Overview ? UIColors.PRIMARY : UIColors.BUTTON_NORMAL,
        hoverColor: UIColors.BUTTON_HOVER,
        onClick: () => this.switchTab(tab.id),
      });
      this.tabButtons.set(tab.id, button);
      this.container.add(button.getContainer());
    });
  }

  private switchTab(tab: StatsTab): void {
    if (this.currentTab === tab) return;

    // Update button styles
    this.tabButtons.forEach((button, buttonTab) => {
      const _bgColor = buttonTab === tab ? UIColors.PRIMARY : UIColors.BUTTON_NORMAL;
      // Re-create button to update color (simpler than adding setBackgroundColor method)
      button.getContainer().setAlpha(buttonTab === tab ? 1 : 0.8);
    });

    this.currentTab = tab;
    this.renderCurrentTab();
  }

  private setupKeyboardControls(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (!this._visible || !this._interactive) return;

      if (event.key === 'Escape' || event.key === 'Tab') {
        this.hide();
        this.config.onClose?.();
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
    this.closeButton.interactive = value;
    this.tabButtons.forEach(btn => {
      btn.interactive = value;
    });
  }

  /**
   * Load best stats from localStorage.
   */
  private loadBestStats(): void {
    try {
      const stored = localStorage.getItem(BEST_STATS_KEY);
      if (stored) {
        this.bestStats = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load best stats:', error);
      this.bestStats = null;
    }
  }

  /**
   * Save best stats to localStorage.
   */
  private saveBestStats(): void {
    if (!this.bestStats) return;

    try {
      localStorage.setItem(BEST_STATS_KEY, JSON.stringify(this.bestStats));
    } catch (error) {
      console.error('Failed to save best stats:', error);
    }
  }

  /**
   * Update best stats with current game stats.
   */
  private updateBestStats(stats: GameStats): void {
    const isNewBest = this.bestStats === null;

    if (!this.bestStats) {
      this.bestStats = {
        highestDamage: 0,
        highestCombo: 0,
        mostKills: 0,
        longestSurvival: 0,
        bestAccuracy: 0,
        highestDPS: 0,
        furthestWave: 0,
        mostBossesDefeated: 0,
        highestLevel: 0,
        longestDistance: 0,
        timestamp: Date.now(),
      };
    }

    let hasNewRecord = false;

    if (stats.totalDamageDealt > this.bestStats.highestDamage) {
      this.bestStats.highestDamage = stats.totalDamageDealt;
      hasNewRecord = true;
    }
    if (stats.highestCombo > this.bestStats.highestCombo) {
      this.bestStats.highestCombo = stats.highestCombo;
      hasNewRecord = true;
    }
    if (stats.totalEnemiesKilled > this.bestStats.mostKills) {
      this.bestStats.mostKills = stats.totalEnemiesKilled;
      hasNewRecord = true;
    }
    if (stats.timeSurvived > this.bestStats.longestSurvival) {
      this.bestStats.longestSurvival = stats.timeSurvived;
      hasNewRecord = true;
    }
    if (stats.accuracy > this.bestStats.bestAccuracy) {
      this.bestStats.bestAccuracy = stats.accuracy;
      hasNewRecord = true;
    }
    if (stats.peakDPS > this.bestStats.highestDPS) {
      this.bestStats.highestDPS = stats.peakDPS;
      hasNewRecord = true;
    }
    if (stats.waveReached > this.bestStats.furthestWave) {
      this.bestStats.furthestWave = stats.waveReached;
      hasNewRecord = true;
    }
    if (stats.bossesDefeated > this.bestStats.mostBossesDefeated) {
      this.bestStats.mostBossesDefeated = stats.bossesDefeated;
      hasNewRecord = true;
    }
    if (stats.levelReached > this.bestStats.highestLevel) {
      this.bestStats.highestLevel = stats.levelReached;
      hasNewRecord = true;
    }
    if (stats.distanceTraveled > this.bestStats.longestDistance) {
      this.bestStats.longestDistance = stats.distanceTraveled;
      hasNewRecord = true;
    }

    if (hasNewRecord || isNewBest) {
      this.bestStats.timestamp = Date.now();
      this.saveBestStats();
    }
  }

  /**
   * Show stats screen with game statistics.
   */
  showWithStats(stats: GameStats): void {
    this.currentStats = stats;
    this.updateBestStats(stats);
    this.currentTab = StatsTab.Overview;
    this.renderCurrentTab();
    this.show();
  }

  /**
   * Render the current tab content.
   */
  private renderCurrentTab(): void {
    // Clear content
    this.contentContainer.removeAll(true);
    this.dpsGraphContainer = null;

    if (!this.currentStats) return;

    switch (this.currentTab) {
      case StatsTab.Overview:
        this.renderOverviewTab();
        break;
      case StatsTab.Combat:
        this.renderCombatTab();
        break;
      case StatsTab.Weapons:
        this.renderWeaponsTab();
        break;
      case StatsTab.DPS:
        this.renderDPSTab();
        break;
    }
  }

  /**
   * Render overview tab with key stats.
   */
  private renderOverviewTab(): void {
    const stats = this.currentStats!;
    const lineHeight = 38;
    let y = -180;

    const overviewStats = [
      {
        label: 'Time Survived',
        value: this.formatTime(stats.timeSurvived),
        best: this.bestStats ? this.formatTime(this.bestStats.longestSurvival) : null,
        isNewRecord: this.bestStats ? stats.timeSurvived >= this.bestStats.longestSurvival : true,
        color: UIColors.TEXT_PRIMARY,
      },
      {
        label: 'Level Reached',
        value: stats.levelReached.toString(),
        best: this.bestStats?.highestLevel.toString() ?? null,
        isNewRecord: this.bestStats ? stats.levelReached >= this.bestStats.highestLevel : true,
        color: UIColors.TEXT_XP,
      },
      {
        label: 'Wave Reached',
        value: stats.waveReached.toString(),
        best: this.bestStats?.furthestWave.toString() ?? null,
        isNewRecord: this.bestStats ? stats.waveReached >= this.bestStats.furthestWave : true,
        color: UIColors.ACCENT,
      },
      {
        label: 'Total Damage',
        value: this.formatNumber(stats.totalDamageDealt),
        best: this.bestStats ? this.formatNumber(this.bestStats.highestDamage) : null,
        isNewRecord: this.bestStats ? stats.totalDamageDealt >= this.bestStats.highestDamage : true,
        color: UIColors.TEXT_DAMAGE,
      },
      {
        label: 'Enemies Killed',
        value: stats.totalEnemiesKilled.toLocaleString(),
        best: this.bestStats?.mostKills.toLocaleString() ?? null,
        isNewRecord: this.bestStats ? stats.totalEnemiesKilled >= this.bestStats.mostKills : true,
        color: UIColors.ERROR,
      },
      {
        label: 'XP Earned',
        value: `+${stats.xpEarned.toLocaleString()}`,
        best: null,
        isNewRecord: false,
        color: UIColors.TEXT_XP,
      },
      {
        label: 'Distance Traveled',
        value: this.formatDistance(stats.distanceTraveled),
        best: this.bestStats ? this.formatDistance(this.bestStats.longestDistance) : null,
        isNewRecord: this.bestStats ? stats.distanceTraveled >= this.bestStats.longestDistance : true,
        color: UIColors.PRIMARY,
      },
      {
        label: 'Highest Combo',
        value: `${stats.highestCombo}x`,
        best: this.bestStats ? `${this.bestStats.highestCombo}x` : null,
        isNewRecord: this.bestStats ? stats.highestCombo >= this.bestStats.highestCombo : true,
        color: UIColors.WARNING,
      },
      {
        label: 'Accuracy',
        value: `${stats.accuracy.toFixed(1)}%`,
        best: this.bestStats ? `${this.bestStats.bestAccuracy.toFixed(1)}%` : null,
        isNewRecord: this.bestStats ? stats.accuracy >= this.bestStats.bestAccuracy : true,
        color: UIColors.SUCCESS,
      },
      {
        label: 'Average DPS',
        value: this.formatNumber(stats.averageDPS),
        best: null,
        isNewRecord: false,
        color: UIColors.TEXT_CRITICAL,
      },
    ];

    overviewStats.forEach(stat => {
      this.renderStatLine(y, stat.label, stat.value, stat.best, stat.isNewRecord, stat.color);
      y += lineHeight;
    });
  }

  /**
   * Render combat tab with detailed combat stats.
   */
  private renderCombatTab(): void {
    const stats = this.currentStats!;
    let y = -180;
    const lineHeight = 32;

    // Combat header
    const combatHeader = this.scene.add.text(0, y, '-- Combat Statistics --', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_ACCENT).rgba,
      fontStyle: 'bold',
    });
    combatHeader.setOrigin(0.5);
    this.contentContainer.add(combatHeader);
    y += lineHeight + 10;

    // Combat stats
    const combatStats = [
      { label: 'Total Shots Fired', value: stats.totalShots.toLocaleString() },
      { label: 'Total Hits', value: stats.totalHits.toLocaleString() },
      { label: 'Miss Rate', value: `${((1 - stats.accuracy / 100) * 100).toFixed(1)}%` },
      { label: 'Peak DPS', value: this.formatNumber(stats.peakDPS) },
      { label: 'Bosses Defeated', value: stats.bossesDefeated.toString() },
    ];

    combatStats.forEach(stat => {
      this.renderSimpleStatLine(y, stat.label, stat.value);
      y += lineHeight;
    });

    y += 20;

    // Enemies killed by type
    const enemiesHeader = this.scene.add.text(0, y, '-- Enemies Killed by Type --', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_ACCENT).rgba,
      fontStyle: 'bold',
    });
    enemiesHeader.setOrigin(0.5);
    this.contentContainer.add(enemiesHeader);
    y += lineHeight + 10;

    // Sort enemies by kill count
    const sortedEnemies = [...stats.enemiesKilledByType].sort((a, b) => b.count - a.count);
    const maxToShow = 6;

    sortedEnemies.slice(0, maxToShow).forEach(enemy => {
      this.renderSimpleStatLine(y, enemy.displayName, enemy.count.toLocaleString());
      y += lineHeight - 4;
    });

    if (sortedEnemies.length > maxToShow) {
      const otherCount = sortedEnemies.slice(maxToShow).reduce((sum, e) => sum + e.count, 0);
      this.renderSimpleStatLine(y, 'Other', otherCount.toLocaleString());
    }
  }

  /**
   * Render weapons tab with weapon usage stats.
   */
  private renderWeaponsTab(): void {
    const stats = this.currentStats!;
    let y = -180;
    const lineHeight = 28;

    // Most used ability
    if (stats.mostUsedAbility) {
      const abilityHeader = this.scene.add.text(0, y, 'Most Used Ability', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      abilityHeader.setOrigin(0.5);
      this.contentContainer.add(abilityHeader);
      y += lineHeight;

      const abilityText = this.scene.add.text(0, y, `${stats.mostUsedAbility.name} (${stats.mostUsedAbility.uses} uses)`, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '22px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.ACCENT).rgba,
        fontStyle: 'bold',
      });
      abilityText.setOrigin(0.5);
      this.contentContainer.add(abilityText);
      y += lineHeight + 20;
    }

    // Weapons header
    const weaponsHeader = this.scene.add.text(0, y, '-- Weapon Statistics --', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_ACCENT).rgba,
      fontStyle: 'bold',
    });
    weaponsHeader.setOrigin(0.5);
    this.contentContainer.add(weaponsHeader);
    y += lineHeight + 10;

    // Sort weapons by damage dealt
    const sortedWeapons = [...stats.weaponsUsed].sort((a, b) => b.damageDealt - a.damageDealt);

    if (sortedWeapons.length === 0) {
      const noWeapons = this.scene.add.text(0, y, 'No weapons used', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DISABLED).rgba,
      });
      noWeapons.setOrigin(0.5);
      this.contentContainer.add(noWeapons);
      return;
    }

    // Column headers
    const colX = {
      name: -280,
      damage: -80,
      kills: 40,
      accuracy: 160,
    };

    const headerY = y;
    const headers = [
      { text: 'Weapon', x: colX.name },
      { text: 'Damage', x: colX.damage },
      { text: 'Kills', x: colX.kills },
      { text: 'Accuracy', x: colX.accuracy },
    ];

    headers.forEach(header => {
      const text = this.scene.add.text(header.x, headerY, header.text, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      text.setOrigin(0, 0.5);
      this.contentContainer.add(text);
    });

    y += lineHeight;

    // Separator
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, UIColors.BORDER, 0.5);
    separator.moveTo(-300, y - 10);
    separator.lineTo(300, y - 10);
    separator.strokePath();
    this.contentContainer.add(separator);

    sortedWeapons.slice(0, 8).forEach(weapon => {
      const weaponAccuracy = weapon.shotsFired > 0
        ? ((weapon.hits / weapon.shotsFired) * 100).toFixed(1)
        : '0.0';

      // Weapon name
      const nameText = this.scene.add.text(colX.name, y, weapon.name, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      });
      nameText.setOrigin(0, 0.5);
      this.contentContainer.add(nameText);

      // Damage
      const damageText = this.scene.add.text(colX.damage, y, this.formatNumber(weapon.damageDealt), {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DAMAGE).rgba,
      });
      damageText.setOrigin(0, 0.5);
      this.contentContainer.add(damageText);

      // Kills
      const killsText = this.scene.add.text(colX.kills, y, weapon.kills.toString(), {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.ERROR).rgba,
      });
      killsText.setOrigin(0, 0.5);
      this.contentContainer.add(killsText);

      // Accuracy
      const accText = this.scene.add.text(colX.accuracy, y, `${weaponAccuracy}%`, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '16px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.SUCCESS).rgba,
      });
      accText.setOrigin(0, 0.5);
      this.contentContainer.add(accText);

      y += lineHeight;
    });
  }

  /**
   * Render DPS graph tab.
   */
  private renderDPSTab(): void {
    const stats = this.currentStats!;

    // Graph dimensions
    const graphWidth = 650;
    const graphHeight = 300;
    const graphX = -graphWidth / 2;
    const graphY = -180;
    const padding = { left: 60, right: 20, top: 20, bottom: 40 };

    this.dpsGraphContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.dpsGraphContainer);

    // Graph background
    const bg = this.scene.add.graphics();
    bg.fillStyle(UIColors.PANEL_HEADER, 0.5);
    bg.fillRoundedRect(graphX, graphY, graphWidth, graphHeight, 8);
    bg.lineStyle(1, UIColors.BORDER, 0.5);
    bg.strokeRoundedRect(graphX, graphY, graphWidth, graphHeight, 8);
    this.dpsGraphContainer.add(bg);

    if (stats.dpsHistory.length < 2) {
      const noData = this.scene.add.text(0, graphY + graphHeight / 2, 'Not enough data for DPS graph', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DISABLED).rgba,
      });
      noData.setOrigin(0.5);
      this.dpsGraphContainer.add(noData);
      return;
    }

    // Calculate graph area
    const plotX = graphX + padding.left;
    const plotY = graphY + padding.top;
    const plotWidth = graphWidth - padding.left - padding.right;
    const plotHeight = graphHeight - padding.top - padding.bottom;

    // Find max DPS for scaling
    const maxDPS = Math.max(...stats.dpsHistory.map(d => d.dps), 1);
    const maxTime = Math.max(...stats.dpsHistory.map(d => d.time), 1);

    // Draw grid lines
    const gridGraphics = this.scene.add.graphics();
    gridGraphics.lineStyle(1, UIColors.BORDER, 0.2);

    // Horizontal grid lines (5 lines)
    for (let i = 0; i <= 4; i++) {
      const y = plotY + plotHeight - (i / 4) * plotHeight;
      gridGraphics.moveTo(plotX, y);
      gridGraphics.lineTo(plotX + plotWidth, y);

      // Y-axis label
      const labelValue = (maxDPS * i / 4);
      const label = this.scene.add.text(plotX - 10, y, this.formatNumber(labelValue), {
        fontFamily: UIFonts.MONO,
        fontSize: '12px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      label.setOrigin(1, 0.5);
      this.dpsGraphContainer.add(label);
    }

    // Vertical grid lines (every 30 seconds)
    const timeInterval = 30;
    for (let t = 0; t <= maxTime; t += timeInterval) {
      const x = plotX + (t / maxTime) * plotWidth;
      gridGraphics.moveTo(x, plotY);
      gridGraphics.lineTo(x, plotY + plotHeight);

      // X-axis label
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      const label = this.scene.add.text(x, plotY + plotHeight + 10, `${minutes}:${seconds.toString().padStart(2, '0')}`, {
        fontFamily: UIFonts.MONO,
        fontSize: '11px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      label.setOrigin(0.5, 0);
      this.dpsGraphContainer.add(label);
    }

    gridGraphics.strokePath();
    this.dpsGraphContainer.add(gridGraphics);

    // Draw DPS line
    const lineGraphics = this.scene.add.graphics();
    lineGraphics.lineStyle(3, UIColors.TEXT_CRITICAL, 1);

    const points: { x: number; y: number }[] = [];
    stats.dpsHistory.forEach((point, index) => {
      const x = plotX + (point.time / maxTime) * plotWidth;
      const y = plotY + plotHeight - (point.dps / maxDPS) * plotHeight;
      points.push({ x, y });
    });

    // Draw line
    if (points.length > 0) {
      lineGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        lineGraphics.lineTo(points[i].x, points[i].y);
      }
      lineGraphics.strokePath();
    }
    this.dpsGraphContainer.add(lineGraphics);

    // Draw area under curve
    const areaGraphics = this.scene.add.graphics();
    areaGraphics.fillStyle(UIColors.TEXT_CRITICAL, 0.2);
    areaGraphics.beginPath();
    areaGraphics.moveTo(points[0].x, plotY + plotHeight);
    points.forEach(p => {
      areaGraphics.lineTo(p.x, p.y);
    });
    areaGraphics.lineTo(points[points.length - 1].x, plotY + plotHeight);
    areaGraphics.closePath();
    areaGraphics.fillPath();
    this.dpsGraphContainer.add(areaGraphics);

    // Mark peak DPS
    const peakIndex = stats.dpsHistory.findIndex(d => d.dps === stats.peakDPS);
    if (peakIndex >= 0) {
      const peakPoint = points[peakIndex];
      const peakMarker = this.scene.add.graphics();
      peakMarker.fillStyle(UIColors.WARNING, 1);
      peakMarker.fillCircle(peakPoint.x, peakPoint.y, 6);
      peakMarker.lineStyle(2, UIColors.TEXT_PRIMARY, 1);
      peakMarker.strokeCircle(peakPoint.x, peakPoint.y, 6);
      this.dpsGraphContainer.add(peakMarker);

      const peakLabel = this.scene.add.text(peakPoint.x, peakPoint.y - 20, `Peak: ${this.formatNumber(stats.peakDPS)}`, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '12px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.WARNING).rgba,
        fontStyle: 'bold',
      });
      peakLabel.setOrigin(0.5, 1);
      this.dpsGraphContainer.add(peakLabel);
    }

    // Y-axis label
    const yAxisLabel = this.scene.add.text(graphX + 15, graphY + graphHeight / 2, 'DPS', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
    });
    yAxisLabel.setOrigin(0.5);
    yAxisLabel.setRotation(-Math.PI / 2);
    this.dpsGraphContainer.add(yAxisLabel);

    // X-axis label
    const xAxisLabel = this.scene.add.text(0, graphY + graphHeight + 35, 'Time', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
    });
    xAxisLabel.setOrigin(0.5);
    this.dpsGraphContainer.add(xAxisLabel);

    // Stats summary below graph
    const summaryY = graphY + graphHeight + 60;
    const summaryStats = [
      { label: 'Average DPS', value: this.formatNumber(stats.averageDPS), color: UIColors.TEXT_CRITICAL },
      { label: 'Peak DPS', value: this.formatNumber(stats.peakDPS), color: UIColors.WARNING },
      { label: 'Best Peak', value: this.bestStats ? this.formatNumber(this.bestStats.highestDPS) : '-', color: UIColors.TEXT_XP },
    ];

    const summarySpacing = 180;
    summaryStats.forEach((stat, index) => {
      const x = (index - 1) * summarySpacing;

      const label = this.scene.add.text(x, summaryY, stat.label, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
      });
      label.setOrigin(0.5);
      this.dpsGraphContainer?.add(label);

      const value = this.scene.add.text(x, summaryY + 22, stat.value, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '20px',
        color: Phaser.Display.Color.IntegerToColor(stat.color).rgba,
        fontStyle: 'bold',
      });
      value.setOrigin(0.5);
      this.dpsGraphContainer?.add(value);
    });
  }

  /**
   * Render a stat line with optional best comparison.
   */
  private renderStatLine(
    y: number,
    label: string,
    value: string,
    best: string | null,
    isNewRecord: boolean,
    valueColor: number
  ): void {
    // Label
    const labelText = this.scene.add.text(-280, y, label, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '18px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
    });
    labelText.setOrigin(0, 0.5);
    this.contentContainer.add(labelText);

    // Value
    const valueText = this.scene.add.text(80, y, value, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(valueColor).rgba,
      fontStyle: 'bold',
    });
    valueText.setOrigin(0, 0.5);
    this.contentContainer.add(valueText);

    // New record indicator
    if (isNewRecord && best !== null) {
      const recordText = this.scene.add.text(valueText.x + valueText.width + 10, y, 'NEW!', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.WARNING).rgba,
        fontStyle: 'bold',
      });
      recordText.setOrigin(0, 0.5);
      this.contentContainer.add(recordText);
    }

    // Best comparison
    if (best !== null) {
      const bestText = this.scene.add.text(280, y, `Best: ${best}`, {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_DISABLED).rgba,
      });
      bestText.setOrigin(1, 0.5);
      this.contentContainer.add(bestText);
    }

    // Separator line
    const line = this.scene.add.graphics();
    line.lineStyle(1, UIColors.BORDER, 0.2);
    line.moveTo(-280, y + 16);
    line.lineTo(280, y + 16);
    line.strokePath();
    this.contentContainer.add(line);
  }

  /**
   * Render a simple stat line without comparison.
   */
  private renderSimpleStatLine(y: number, label: string, value: string): void {
    const labelText = this.scene.add.text(-200, y, label, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
    });
    labelText.setOrigin(0, 0.5);
    this.contentContainer.add(labelText);

    const valueText = this.scene.add.text(200, y, value, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      fontStyle: 'bold',
    });
    valueText.setOrigin(1, 0.5);
    this.contentContainer.add(valueText);
  }

  /**
   * Format time in mm:ss format.
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format large numbers.
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return Math.round(num).toLocaleString();
  }

  /**
   * Format distance in meters/kilometers.
   */
  private formatDistance(pixels: number): string {
    // Assume 1 pixel = 1 unit, convert to meters (100 pixels = 1m)
    const meters = pixels / 100;
    if (meters >= 1000) {
      return (meters / 1000).toFixed(2) + ' km';
    }
    return Math.round(meters) + ' m';
  }

  show(): void {
    this.visible = true;
    this._interactive = true;

    // Animate in
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
    });

    // Panel slide in
    const panel = this.panel.getContainer();
    const originalY = panel.y;
    panel.setY(originalY - 50);
    this.scene.tweens.add({
      targets: panel,
      y: originalY,
      duration: 400,
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
    this.tabButtons.forEach(btn => btn.destroy());
    this.closeButton.destroy();
    this.panel.destroy();
    this.container.destroy();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Get best stats (for external use).
   */
  getBestStats(): BestStats | null {
    return this.bestStats;
  }

  /**
   * Clear best stats (for testing/reset).
   */
  clearBestStats(): void {
    this.bestStats = null;
    try {
      localStorage.removeItem(BEST_STATS_KEY);
    } catch (error) {
      console.warn('Failed to clear best stats:', error);
    }
  }
}
