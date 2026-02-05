/**
 * GameScene - Main gameplay scene with upgrade, weapon, and wave systems.
 * Bullet Heaven / Vampire Survivors style.
 */

import * as Phaser from 'phaser';
import { getUpgradeSystem, IUpgrade } from '../systems/UpgradeSystem';
import { weaponManager, IWeaponInstance } from '../systems/WeaponManager';
import { waveManager, type IWaveConfig } from '../systems/WaveManager';
import { UpgradeSelectionUI } from '../ui/UpgradeSelectionUI';
import { MiniMap, type MiniMapEntity } from '../ui/hud/MiniMap';
import { WaveAnnouncer } from '../ui/WaveAnnouncer';
import {
  timeProgressionSystem,
  ITimeProgressionMultipliers,
  ITimeThreshold
} from '../systems/TimeProgressionSystem';
import {
  getComboSystem,
  ComboSystem,
  IComboEvent,
  IComboMilestone
} from '../systems/ComboSystem';
import {
  killStreakSystem,
  IKillStreakEvent,
  KillStreakRewardType,
} from '../systems/KillStreakSystem';
import { DamageNumberSystem } from '../systems/DamageNumberSystem';
import { powerUpSystem } from '../systems/PowerUpSystem';
import { GameScreenEffects } from '../effects/GameScreenEffects';
import { TrailEffects } from '../effects/TrailEffects';
import {
  HazardSystem,
  HazardType,
  getHazardSystem,
  resetHazardSystem,
} from '../systems/HazardSystem';
import { difficultySystem } from '../systems/DifficultySystem';

interface Enemy extends Phaser.GameObjects.Sprite {
  enemyId: string;
  speed: number;
  hp: number;
  maxHp: number;
  damage: number;
  xpValue: number;
  behavior: 'chase' | 'circle' | 'dash' | 'ranged';
  behaviorTimer: number;
  dashTarget?: { x: number; y: number };
  isBoss: boolean;
}

interface Projectile extends Phaser.GameObjects.Sprite {
  vx: number;
  vy: number;
  lifetime: number;
  damage: number;
  piercing: number;
  homing: boolean;
  isEnemy: boolean;
}

interface XPOrb extends Phaser.GameObjects.Sprite {
  value: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];

  // Player stats - base stats, progression system adds power over time
  private stats = {
    maxHp: 150,
    hp: 150,
    speed: 300,
    damageMultiplier: 1,
    fireRateMultiplier: 1.5,  // Reduced base fire rate (was 2x)
    magnetRadius: 180,
    regenRate: 0,
    additionalProjectiles: 0,  // No extra projectiles at start
    piercingBonus: 0,
    critChance: 0,
    xpMultiplier: 1,
  };

  // Game state
  private score = 0;
  private kills = 0;
  private gameTime = 0;
  private isPaused = false;
  private isGameOver = false;
  private weaponCooldowns: Map<string, number> = new Map();

  // Abilities system
  private abilities = {
    dash: { cooldown: 0, maxCooldown: 3, active: false, duration: 0 },
    ultimate: { cooldown: 0, maxCooldown: 30 },
    bomb: { cooldown: 0, maxCooldown: 20 },
    shield: { cooldown: 0, maxCooldown: 15, active: false, hp: 0, maxHp: 50 }
  };
  private isInvincible = false;
  private dashTarget = { x: 0, y: 0 };
  private dashStartPos = { x: 0, y: 0 };

  // Ability UI elements
  private abilityIcons: Phaser.GameObjects.Graphics[] = [];
  private abilityTexts: Phaser.GameObjects.Text[] = [];
  private shieldGraphics!: Phaser.GameObjects.Graphics;

  // Ability input keys
  private abilityKeys!: {
    dash: Phaser.Input.Keyboard.Key;
    ultimate: Phaser.Input.Keyboard.Key;
    bomb: Phaser.Input.Keyboard.Key;
    shield: Phaser.Input.Keyboard.Key;
  };

  // Systems
  private upgradeSystem = getUpgradeSystem();
  private comboSystem = getComboSystem();
  private upgradeUI!: UpgradeSelectionUI;
  private damageNumbers!: DamageNumberSystem;
  private hazardSystem!: HazardSystem;

  // Ice patch slow effect tracking
  private iceSlowTimer = 0;
  private iceSlowActive = false;
  private baseSpeed = 300;

  // Combo UI elements
  private comboContainer!: Phaser.GameObjects.Container;
  private comboText!: Phaser.GameObjects.Text;
  private comboMultiplierText!: Phaser.GameObjects.Text;
  private comboTimerBar!: Phaser.GameObjects.Graphics;
  private comboTierText!: Phaser.GameObjects.Text;

  // Kill Streak UI elements
  private killStreakText!: Phaser.GameObjects.Text;
  private killStreakEffectText!: Phaser.GameObjects.Text;

  // Time Progression System
  private timeProgression: ITimeProgressionMultipliers = {
    damageMultiplier: 1,
    additionalProjectiles: 0,
    fireRateMultiplier: 1,
    currentThreshold: null,
    currentThresholdIndex: -1,
    gameTimeSeconds: 0,
    gameTimeMinutes: 0,
  };
  private progressionText!: Phaser.GameObjects.Text;

  // UI elements
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private background!: Phaser.GameObjects.TileSprite;
  private difficultyText!: Phaser.GameObjects.Text;

  // Crosshair
  private crosshair!: Phaser.GameObjects.Graphics;

  // MiniMap
  private miniMap!: MiniMap;

  // Wave Announcer
  private waveAnnouncer!: WaveAnnouncer;
  private _lastWaveNumber: number = 0;

  // Screen Effects
  private screenEffects!: GameScreenEffects;

  // Trail Effects (for advanced visual trails)
  private _trailEffects!: TrailEffects;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('enemy_drone', 'assets/sprites/enemyRed1.png');
    this.load.image('enemy_charger', 'assets/sprites/enemyRed2.png');
    this.load.image('enemy_tank', 'assets/sprites/enemyGreen3.png');
    this.load.image('enemy_shooter', 'assets/sprites/enemyBlue2.png');
    this.load.image('enemy_swarm', 'assets/sprites/enemyRed4.png');
    this.load.image('boss_mothership', 'assets/sprites/enemyBlack5.png');
    this.load.image('boss_destroyer', 'assets/sprites/enemyBlack3.png');
    this.load.image('laser_blue', 'assets/sprites/projectiles/laserBlue01.png');
    this.load.image('laser_green', 'assets/sprites/projectiles/laserGreen11.png');
    this.load.image('laser_red', 'assets/sprites/projectiles/laserRed01.png');
    this.load.image('xp_orb', 'assets/sprites/powerupGreen.png');
    this.load.image('xp_orb_large', 'assets/sprites/powerupBlue.png');
    this.load.image('star', 'assets/particles/star1.png');
    this.load.image('fire', 'assets/particles/fire08.png');
    this.load.image('bg_purple', 'assets/backgrounds/darkPurple.png');
    this.load.audio('sfx_laser', 'assets/audio/sfx_laser1.ogg');
    this.load.audio('sfx_hit', 'assets/audio/sfx_zap.ogg');
    this.load.audio('sfx_powerup', 'assets/audio/sfx_shieldUp.ogg');
    this.load.audio('sfx_death', 'assets/audio/sfx_lose.ogg');
    this.load.audio('sfx_levelup', 'assets/audio/sfx_twoTone.ogg');
  }

  create(): void {
    // Reset systems
    this.upgradeSystem.reset();
    waveManager.reset();
    waveManager.startGame();
    weaponManager.reset();
    weaponManager.addWeapon('basic_laser');  // Only one weapon at start
    timeProgressionSystem.reset();
    killStreakSystem.reset();
    powerUpSystem.reset();
    difficultySystem.reset();
    this.comboSystem.fullReset();

    // Set up combo system event handler
    this.comboSystem.addEventListener((event: IComboEvent) => {
      this.handleComboEvent(event);
    });

    // Set up kill streak callbacks
    killStreakSystem.setOnMilestoneReached((event: IKillStreakEvent) => {
      this.onKillStreakMilestone(event);
    });
    killStreakSystem.setOnStreakReset((finalStreak: number) => {
      this.onKillStreakReset(finalStreak);
    });

    // Set up time progression callback for power spikes
    timeProgressionSystem.setOnThresholdReached((threshold: ITimeThreshold, index: number) => {
      if (index > 0) {  // Skip "Start" threshold
        this.showPowerSpike(threshold);
      }
    });

    // Reset state
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.weaponCooldowns.clear();
    this.score = 0;
    this.kills = 0;
    this.gameTime = 0;
    this.isPaused = false;
    this.isGameOver = false;
    this.resetStats();
    this.resetAbilities();

    // Background
    this.background = this.add.tileSprite(
      0, 0,
      this.cameras.main.width * 2,
      this.cameras.main.height * 2,
      'bg_purple'
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(-10);

    // Starfield
    this.createStarfield();

    // Player
    this.player = this.add.sprite(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'player'
    ).setScale(0.8).setDepth(10);

    // Initialize power-up system with scene and player
    powerUpSystem.init(this);
    powerUpSystem.setPlayer(this.player);
    powerUpSystem.createHUD(this.cameras.main.width - 220, 130);

    // Shield graphics (rendered around player)
    this.shieldGraphics = this.add.graphics().setDepth(11);

    // UI
    this.createUI();
    this.createAbilityUI();
    this.createComboUI();

    // Upgrade UI
    this.upgradeUI = new UpgradeSelectionUI(this, {
      screenWidth: this.cameras.main.width,
      screenHeight: this.cameras.main.height,
    });

    // Create crosshair (follows mouse cursor)
    this.crosshair = this.add.graphics();
    this.crosshair.setDepth(200);
    this.drawCrosshair();

    // Create MiniMap (bottom-left corner)
    const minimapPadding = 20;
    const minimapSize = 150;
    this.miniMap = new MiniMap(this, {
      x: minimapPadding,
      y: this.cameras.main.height - minimapSize - minimapPadding,
      size: minimapSize,
      range: 600, // View range in world units
    });

    // Create enhanced damage number system
    this.damageNumbers = new DamageNumberSystem(this);

    // Create screen effects system
    this.screenEffects = new GameScreenEffects(this);

    // Create hazard system and configure callbacks
    resetHazardSystem();
    this.hazardSystem = getHazardSystem(this);
    this.hazardSystem.reset();
    this.setupHazardSystem();

    // Create Wave Announcer for dramatic wave announcements
    this.waveAnnouncer = new WaveAnnouncer(this, {
      screenWidth: this.cameras.main.width,
      screenHeight: this.cameras.main.height,
    });
    this._lastWaveNumber = 0;

    // Set up wave manager callbacks
    waveManager.onWaveStartCallback((wave: IWaveConfig) => {
      if (wave.bossWave && wave.bossType) {
        this.waveAnnouncer.announceBossWave(wave.waveNumber, wave.bossType);
      } else {
        this.waveAnnouncer.announceWaveStart(wave.waveNumber);
      }
      this._lastWaveNumber = wave.waveNumber;
    });

    waveManager.onWaveEndCallback((waveNumber: number) => {
      // Calculate bonus XP based on wave number
      const bonusXP = waveNumber * 50;
      this.waveAnnouncer.announceWaveComplete(waveNumber, bonusXP);
      // Add bonus XP to player
      this.upgradeSystem.addXp(bonusXP);
    });

    waveManager.onBossSpawnCallback((_bossType: string) => {
      // Boss spawn is already handled in wave start callback for boss waves
      // This callback is for mid-wave boss spawns if needed
    });

    // Level up callback
    this.upgradeSystem.onLevelUp(() => {
      this.sound.play('sfx_levelup', { volume: 0.5 });
      this.showUpgradeSelection();
    });

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    };

    // Ability keys
    this.abilityKeys = {
      dash: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ultimate: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      bomb: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      shield: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    // Hide default cursor
    this.input.setDefaultCursor('none');
  }

  private resetAbilities(): void {
    this.abilities = {
      dash: { cooldown: 0, maxCooldown: 3, active: false, duration: 0 },
      ultimate: { cooldown: 0, maxCooldown: 30 },
      bomb: { cooldown: 0, maxCooldown: 20 },
      shield: { cooldown: 0, maxCooldown: 15, active: false, hp: 0, maxHp: 50 }
    };
    this.isInvincible = false;
  }

  private createAbilityUI(): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const iconSize = 50;
    const iconSpacing = 70;
    const startX = screenWidth / 2 - (iconSpacing * 1.5);
    const y = screenHeight - 60;

    const abilityData = [
      { key: 'SPACE', name: 'DASH', color: 0x00ff00 },
      { key: 'Q', name: 'ULTIMATE', color: 0xff6600 },
      { key: 'E', name: 'BOMB', color: 0xff00ff },
      { key: 'R', name: 'SHIELD', color: 0x00aaff },
    ];

    this.abilityIcons = [];
    this.abilityTexts = [];

    for (let i = 0; i < abilityData.length; i++) {
      const x = startX + i * iconSpacing;
      const data = abilityData[i];

      // Background circle
      const icon = this.add.graphics().setScrollFactor(0).setDepth(100);
      icon.fillStyle(0x222222, 0.8);
      icon.fillCircle(x, y, iconSize / 2);
      icon.lineStyle(3, data.color, 1);
      icon.strokeCircle(x, y, iconSize / 2);
      this.abilityIcons.push(icon);

      // Key label
      const keyText = this.add.text(x, y - 5, data.key, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
      this.abilityTexts.push(keyText);

      // Name label below
      this.add.text(x, y + 35, data.name, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#888888',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    }
  }

  private updateAbilityUI(): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const iconSize = 50;
    const iconSpacing = 70;
    const startX = screenWidth / 2 - (iconSpacing * 1.5);
    const y = screenHeight - 60;

    const abilities = [
      { ability: this.abilities.dash, color: 0x00ff00 },
      { ability: this.abilities.ultimate, color: 0xff6600 },
      { ability: this.abilities.bomb, color: 0xff00ff },
      { ability: this.abilities.shield, color: 0x00aaff },
    ];

    for (let i = 0; i < abilities.length; i++) {
      const x = startX + i * iconSpacing;
      const data = abilities[i];
      const icon = this.abilityIcons[i];
      const cooldownRatio = data.ability.cooldown / data.ability.maxCooldown;

      icon.clear();

      // Background
      icon.fillStyle(0x222222, 0.8);
      icon.fillCircle(x, y, iconSize / 2);

      // Cooldown overlay (pie chart style)
      if (cooldownRatio > 0) {
        icon.fillStyle(0x000000, 0.7);
        icon.slice(x, y, iconSize / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cooldownRatio, true);
        icon.fillPath();
      }

      // Border - bright when ready, dim when on cooldown
      if (cooldownRatio <= 0) {
        icon.lineStyle(3, data.color, 1);
      } else {
        icon.lineStyle(2, data.color, 0.4);
      }
      icon.strokeCircle(x, y, iconSize / 2);

      // Shield HP indicator
      if (i === 3 && this.abilities.shield.active) {
        const shieldRatio = this.abilities.shield.hp / this.abilities.shield.maxHp;
        icon.lineStyle(4, 0x00ffff, 1);
        icon.beginPath();
        icon.arc(x, y, iconSize / 2 - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldRatio);
        icon.strokePath();
      }
    }
  }

  private drawCrosshair(): void {
    this.crosshair.clear();

    // Outer circle
    this.crosshair.lineStyle(2, 0x00ffff, 0.8);
    this.crosshair.strokeCircle(0, 0, 12);

    // Inner dot
    this.crosshair.fillStyle(0x00ffff, 1);
    this.crosshair.fillCircle(0, 0, 3);

    // Cross lines
    this.crosshair.lineStyle(2, 0x00ffff, 0.6);
    // Horizontal
    this.crosshair.lineBetween(-20, 0, -14, 0);
    this.crosshair.lineBetween(14, 0, 20, 0);
    // Vertical
    this.crosshair.lineBetween(0, -20, 0, -14);
    this.crosshair.lineBetween(0, 14, 0, 20);
  }

  private updateCrosshair(): void {
    const pointer = this.input.activePointer;
    this.crosshair.setPosition(pointer.x, pointer.y);

    // Change color when firing (LPM held)
    this.crosshair.clear();
    if (pointer.isDown) {
      // Red/orange when firing
      this.crosshair.lineStyle(2, 0xff6600, 1);
      this.crosshair.strokeCircle(0, 0, 10);
      this.crosshair.fillStyle(0xff6600, 1);
      this.crosshair.fillCircle(0, 0, 4);
      this.crosshair.lineStyle(2, 0xff6600, 0.8);
    } else {
      // Cyan when idle
      this.crosshair.lineStyle(2, 0x00ffff, 0.8);
      this.crosshair.strokeCircle(0, 0, 12);
      this.crosshair.fillStyle(0x00ffff, 1);
      this.crosshair.fillCircle(0, 0, 3);
      this.crosshair.lineStyle(2, 0x00ffff, 0.6);
    }
    // Cross lines
    this.crosshair.lineBetween(-20, 0, -14, 0);
    this.crosshair.lineBetween(14, 0, 20, 0);
    this.crosshair.lineBetween(0, -20, 0, -14);
    this.crosshair.lineBetween(0, 14, 0, 20);
  }

  private updatePlayerRotation(): void {
    // Rotate player ship towards mouse cursor
    const pointer = this.input.activePointer;
    const targetAngle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y,
      pointer.worldX, pointer.worldY
    );

    // Add PI/2 offset because sprite faces "up" by default
    const targetRotation = targetAngle + Math.PI / 2;

    // Smooth rotation interpolation for nicer feel
    const currentRotation = this.player.rotation;
    const diff = Phaser.Math.Angle.Wrap(targetRotation - currentRotation);
    this.player.rotation = currentRotation + diff * 0.2; // 0.2 = smoothing factor
  }

  private resetStats(): void {
    this.stats = {
      maxHp: 150,
      hp: 150,
      speed: 300,
      damageMultiplier: 1,
      fireRateMultiplier: 1.5,  // Reduced base fire rate
      magnetRadius: 180,
      regenRate: 0,
      additionalProjectiles: 0,  // No extra projectiles at start
      piercingBonus: 0,
      critChance: 0,
      xpMultiplier: 1,
    };
  }

  private createStarfield(): void {
    const particles = this.add.particles(0, 0, 'star', {
      x: { min: 0, max: this.cameras.main.width },
      y: -10,
      lifespan: 8000,
      speedY: { min: 30, max: 80 },
      scale: { min: 0.1, max: 0.3 },
      alpha: { start: 0.8, end: 0 },
      quantity: 1,
      frequency: 200,
      blendMode: Phaser.BlendModes.ADD,
    });
    particles.setDepth(-5);
  }

  private createUI(): void {
    this.scoreText = this.add.text(20, 20, 'SCORE: 0 | KILLS: 0', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00ffff',
      stroke: '#003333',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    this.waveText = this.add.text(20, 45, 'WAVE 1', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff00ff',
      stroke: '#330033',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    this.levelText = this.add.text(20, this.cameras.main.height - 35, 'LV 1', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffff00',
    }).setScrollFactor(0).setDepth(100);

    this.timeText = this.add.text(this.cameras.main.width - 100, 20, '00:00', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(100);

    // Progression threshold text (shows current power level)
    this.progressionText = this.add.text(this.cameras.main.width - 20, 50, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#88ff88',
      align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.xpBar = this.add.graphics().setScrollFactor(0).setDepth(100);

    // Kill Streak UI (right side, below time)
    this.killStreakText = this.add.text(this.cameras.main.width - 20, 80, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffaa00',
      align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.killStreakEffectText = this.add.text(this.cameras.main.width - 20, 100, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Difficulty indicator (top center)
    const diffIndicator = difficultySystem.getDifficultyIndicator();
    this.difficultyText = this.add.text(this.cameras.main.width / 2, 20, diffIndicator.text, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: `#${diffIndicator.color.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
  }

  private showUpgradeSelection(): void {
    this.isPaused = true;
    const upgrades = this.upgradeSystem.getRandomUpgrades(3);

    const uiUpgrades = upgrades.map((u: IUpgrade) => ({
      id: u.id,
      name: u.name,
      description: u.description,
      icon: u.icon,
      level: u.currentLevel,
      maxLevel: u.maxLevel,
      rarity: u.rarity || 'common',
    }));

    this.upgradeUI.showUpgrades(uiUpgrades, (selected) => {
      this.upgradeSystem.selectUpgrade(selected.id);
      this.applyUpgrades();
      this.isPaused = false;
    });
  }

  private applyUpgrades(): void {
    const upgrades = this.upgradeSystem.getAcquiredUpgrades();

    // Reset to base stats (progression system adds power over time)
    this.stats.maxHp = 150;
    this.stats.speed = 300;
    this.stats.damageMultiplier = 1;
    this.stats.fireRateMultiplier = 1.5;  // Reduced base fire rate
    this.stats.magnetRadius = 180;
    this.stats.regenRate = 0;
    this.stats.additionalProjectiles = 0;  // No extra projectiles at start
    this.stats.piercingBonus = 0;
    this.stats.critChance = 0;
    this.stats.xpMultiplier = 1;

    for (const upgrade of upgrades) {
      const level = upgrade.currentLevel;
      switch (upgrade.id) {
        case 'vital_force': this.stats.maxHp += 20 * level; break;
        case 'regeneration': this.stats.regenRate += 1 * level; break;
        case 'power_strike': this.stats.damageMultiplier += 0.25 * level; break;
        case 'rapid_fire': this.stats.fireRateMultiplier = Math.max(0.3, 1 - 0.1 * level); break;
        case 'multishot': this.stats.additionalProjectiles += level; break;
        case 'piercing_rounds': this.stats.piercingBonus += level; break;
        case 'critical_strike': this.stats.critChance += 0.1 * level; break;
        case 'swift_feet': this.stats.speed += 35 * level; break;
        case 'xp_magnet': this.stats.magnetRadius += 40 * level; break;
        case 'wisdom': this.stats.xpMultiplier += 0.15 * level; break;
      }
    }

    this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    const dt = delta / 1000;
    this.gameTime += dt;

    // Update time progression system
    this.timeProgression = timeProgressionSystem.calculate(this.gameTime);

    // Update difficulty system (for endless scaling)
    difficultySystem.update(dt);

    // Update kill streak system
    killStreakSystem.update(dt);

    // Update combo system
    this.comboSystem.update(dt);

    // Update power-up system
    powerUpSystem.update(dt, this.player.x, this.player.y);

    // Update hazard system (spawns hazards after wave 10)
    this.hazardSystem.setCurrentWave(waveManager.getCurrentWaveNumber());
    this.hazardSystem.update(dt);

    // Update ice slow effect
    this.updateIceSlowEffect(dt);

    this.background.tilePositionY -= 30 * dt;
    this.handleInput(dt);
    this.handleAbilityInput();
    this.updateAbilities(dt);
    this.updateWaves(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateXPOrbs(dt);
    this.checkCollisions();

    // Update crosshair and player rotation towards cursor
    this.updateCrosshair();
    this.updatePlayerRotation();

    // Regen
    if (this.stats.regenRate > 0) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.regenRate * dt);
    }

    this.updateUI();
    this.updateAbilityUI();
    this.updateComboUI();
    this.updateShieldGraphics();
    this.updateMiniMap(dt);

    // Update wave announcer and check for milestones
    this.waveAnnouncer.update(dt);
    this.waveAnnouncer.checkMilestones(this.gameTime);

    // Update damage number animations
    this.damageNumbers.update(dt);

    // Update screen effects
    this.screenEffects.update(dt);

    // Update low health vignette
    const hpPercent = this.stats.hp / this.stats.maxHp;
    this.screenEffects.setLowHealth(hpPercent < 0.25, hpPercent);
  }

  private handleAbilityInput(): void {
    if (this.isGameOver) return;

    // DASH - SPACE
    if (Phaser.Input.Keyboard.JustDown(this.abilityKeys.dash)) {
      this.useDash();
    }

    // ULTIMATE - Q
    if (Phaser.Input.Keyboard.JustDown(this.abilityKeys.ultimate)) {
      this.useUltimate();
    }

    // BOMB - E
    if (Phaser.Input.Keyboard.JustDown(this.abilityKeys.bomb)) {
      this.useBomb();
    }

    // SHIELD - R
    if (Phaser.Input.Keyboard.JustDown(this.abilityKeys.shield)) {
      this.useShield();
    }
  }

  private useDash(): void {
    if (this.abilities.dash.cooldown > 0 || this.abilities.dash.active) return;

    // Calculate dash target towards mouse cursor
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y,
      pointer.worldX, pointer.worldY
    );

    const dashDistance = 175; // 150-200 pixels
    this.dashStartPos = { x: this.player.x, y: this.player.y };
    this.dashTarget = {
      x: this.player.x + Math.cos(angle) * dashDistance,
      y: this.player.y + Math.sin(angle) * dashDistance
    };

    // Clamp to screen bounds
    const margin = 40;
    this.dashTarget.x = Phaser.Math.Clamp(this.dashTarget.x, margin, this.cameras.main.width - margin);
    this.dashTarget.y = Phaser.Math.Clamp(this.dashTarget.y, margin, this.cameras.main.height - margin);

    this.abilities.dash.active = true;
    this.abilities.dash.duration = 0.15; // Dash duration in seconds
    this.isInvincible = true;

    // Play dash sound
    this.sound.play('sfx_powerup', { volume: 0.3 });

    // Create dash trail effect
    this.createDashTrail();
  }

  private createDashTrail(): void {
    // Create afterimage trail
    const numTrails = 5;
    for (let i = 0; i < numTrails; i++) {
      const t = i / numTrails;
      const trailX = Phaser.Math.Linear(this.dashStartPos.x, this.dashTarget.x, t);
      const trailY = Phaser.Math.Linear(this.dashStartPos.y, this.dashTarget.y, t);

      const trail = this.add.sprite(trailX, trailY, 'player');
      trail.setScale(0.8);
      trail.setAlpha(0.5 - t * 0.4);
      trail.setTint(0x00ffff);
      trail.setDepth(9);

      this.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.4,
        duration: 200,
        delay: i * 30,
        onComplete: () => trail.destroy()
      });
    }

    // Particle effect
    const particles = this.add.particles(this.player.x, this.player.y, 'star', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      quantity: 10,
      blendMode: Phaser.BlendModes.ADD,
      tint: 0x00ffff
    });
    this.time.delayedCall(100, () => particles.destroy());
  }

  private useUltimate(): void {
    if (this.abilities.ultimate.cooldown > 0) return;

    this.abilities.ultimate.cooldown = this.abilities.ultimate.maxCooldown;

    // Play sound
    this.sound.play('sfx_hit', { volume: 0.5 });

    // Create shockwave effect
    this.createUltimateEffect();

    // Damage all enemies within radius
    const ultimateRadius = 300;
    const ultimateDamage = 100 * this.stats.damageMultiplier;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);

      if (dist <= ultimateRadius) {
        enemy.hp -= ultimateDamage;
        enemy.setTint(0xff8800);
        this.time.delayedCall(100, () => {
          if (enemy.active) enemy.clearTint();
        });

        if (enemy.hp <= 0) {
          this.killEnemy(enemy, i);
        }
      }
    }

    // Camera shake
    this.cameras.main.shake(200, 0.02);
  }

  private createUltimateEffect(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(50);

    let radius = 0;
    const maxRadius = 300;
    const duration = 300;
    const startTime = this.time.now;

    const updateShockwave = () => {
      const elapsed = this.time.now - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        graphics.destroy();
        return;
      }

      radius = maxRadius * progress;
      const alpha = 1 - progress;

      graphics.clear();

      // Outer ring
      graphics.lineStyle(8, 0xff6600, alpha);
      graphics.strokeCircle(this.player.x, this.player.y, radius);

      // Inner ring
      graphics.lineStyle(4, 0xffff00, alpha * 0.8);
      graphics.strokeCircle(this.player.x, this.player.y, radius * 0.7);

      // Core glow
      graphics.fillStyle(0xff6600, alpha * 0.3);
      graphics.fillCircle(this.player.x, this.player.y, radius * 0.5);

      this.time.delayedCall(16, updateShockwave);
    };

    updateShockwave();

    // Particles
    const particles = this.add.particles(this.player.x, this.player.y, 'fire', {
      speed: { min: 200, max: 400 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      quantity: 30,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff6600, 0xffff00, 0xff0000]
    });
    this.time.delayedCall(100, () => particles.destroy());
  }

  private useBomb(): void {
    if (this.abilities.bomb.cooldown > 0) return;

    this.abilities.bomb.cooldown = this.abilities.bomb.maxCooldown;

    // Play sound
    this.sound.play('sfx_powerup', { volume: 0.4 });

    // Create screen flash effect
    this.createBombEffect();

    // Destroy all enemy projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.isEnemy) {
        // Create small explosion at projectile position
        const particles = this.add.particles(proj.x, proj.y, 'star', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.3, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 200,
          quantity: 3,
          blendMode: Phaser.BlendModes.ADD,
          tint: 0xff00ff
        });
        this.time.delayedCall(200, () => particles.destroy());

        proj.destroy();
        this.projectiles.splice(i, 1);
      }
    }

    // Small damage to all enemies
    const bombDamage = 20 * this.stats.damageMultiplier;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.hp -= bombDamage;
      enemy.setTint(0xff00ff);
      this.time.delayedCall(100, () => {
        if (enemy.active) enemy.clearTint();
      });

      if (enemy.hp <= 0) {
        this.killEnemy(enemy, i);
      }
    }
  }

  private createBombEffect(): void {
    // Screen flash
    const flash = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff00ff,
      0.5
    ).setDepth(200);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy()
    });

    // Expanding wave
    const wave = this.add.graphics();
    wave.setDepth(49);

    let radius = 0;
    const maxRadius = Math.max(this.cameras.main.width, this.cameras.main.height);
    const duration = 500;
    const startTime = this.time.now;

    const updateWave = () => {
      const elapsed = this.time.now - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        wave.destroy();
        return;
      }

      radius = maxRadius * progress;
      const alpha = (1 - progress) * 0.6;

      wave.clear();
      wave.lineStyle(6, 0xff00ff, alpha);
      wave.strokeCircle(this.player.x, this.player.y, radius);
      wave.lineStyle(3, 0xffffff, alpha * 0.5);
      wave.strokeCircle(this.player.x, this.player.y, radius * 0.9);

      this.time.delayedCall(16, updateWave);
    };

    updateWave();
  }

  private useShield(): void {
    if (this.abilities.shield.cooldown > 0 || this.abilities.shield.active) return;

    this.abilities.shield.active = true;
    this.abilities.shield.hp = this.abilities.shield.maxHp;

    // Play sound
    this.sound.play('sfx_powerup', { volume: 0.4 });

    // Shield lasts 3 seconds or until HP depleted
    this.time.delayedCall(3000, () => {
      if (this.abilities.shield.active) {
        this.deactivateShield();
      }
    });
  }

  private deactivateShield(): void {
    this.abilities.shield.active = false;
    this.abilities.shield.hp = 0;
    this.abilities.shield.cooldown = this.abilities.shield.maxCooldown;

    // Shield break effect
    const particles = this.add.particles(this.player.x, this.player.y, 'star', {
      speed: { min: 100, max: 200 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      quantity: 15,
      blendMode: Phaser.BlendModes.ADD,
      tint: 0x00aaff
    });
    this.time.delayedCall(400, () => particles.destroy());
  }

  private updateShieldGraphics(): void {
    this.shieldGraphics.clear();

    if (!this.abilities.shield.active) return;

    const shieldRadius = 45;
    const pulseScale = 1 + Math.sin(this.time.now * 0.01) * 0.05;
    const shieldAlpha = 0.3 + (this.abilities.shield.hp / this.abilities.shield.maxHp) * 0.3;

    // Shield bubble
    this.shieldGraphics.fillStyle(0x00aaff, shieldAlpha * 0.3);
    this.shieldGraphics.fillCircle(this.player.x, this.player.y, shieldRadius * pulseScale);

    this.shieldGraphics.lineStyle(3, 0x00aaff, shieldAlpha);
    this.shieldGraphics.strokeCircle(this.player.x, this.player.y, shieldRadius * pulseScale);

    // Inner glow
    this.shieldGraphics.lineStyle(2, 0x00ffff, shieldAlpha * 0.5);
    this.shieldGraphics.strokeCircle(this.player.x, this.player.y, shieldRadius * pulseScale * 0.8);
  }

  private updateAbilities(dt: number): void {
    // Update cooldowns
    if (this.abilities.dash.cooldown > 0) {
      this.abilities.dash.cooldown -= dt;
      if (this.abilities.dash.cooldown < 0) this.abilities.dash.cooldown = 0;
    }
    if (this.abilities.ultimate.cooldown > 0) {
      this.abilities.ultimate.cooldown -= dt;
      if (this.abilities.ultimate.cooldown < 0) this.abilities.ultimate.cooldown = 0;
    }
    if (this.abilities.bomb.cooldown > 0) {
      this.abilities.bomb.cooldown -= dt;
      if (this.abilities.bomb.cooldown < 0) this.abilities.bomb.cooldown = 0;
    }
    if (this.abilities.shield.cooldown > 0) {
      this.abilities.shield.cooldown -= dt;
      if (this.abilities.shield.cooldown < 0) this.abilities.shield.cooldown = 0;
    }

    // Update dash movement
    if (this.abilities.dash.active) {
      this.abilities.dash.duration -= dt;

      // Move player towards dash target
      const dashSpeed = 1500; // Very fast dash
      const angle = Phaser.Math.Angle.Between(
        this.player.x, this.player.y,
        this.dashTarget.x, this.dashTarget.y
      );
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.dashTarget.x, this.dashTarget.y
      );

      if (dist > 5 && this.abilities.dash.duration > 0) {
        const moveAmount = Math.min(dashSpeed * dt, dist);
        this.player.x += Math.cos(angle) * moveAmount;
        this.player.y += Math.sin(angle) * moveAmount;
      }

      // End dash
      if (this.abilities.dash.duration <= 0 || dist <= 5) {
        this.abilities.dash.active = false;
        this.abilities.dash.cooldown = this.abilities.dash.maxCooldown;
        this.isInvincible = false;
      }
    }
  }

  private handleInput(dt: number): void {
    // Skip normal movement during dash
    if (this.abilities.dash.active) return;

    let vx = 0, vy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) vx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    }

    // Apply power-up speed boost multiplier
    const powerUps = powerUpSystem.getMultipliers();
    const effectiveSpeed = this.stats.speed * powerUps.speedMultiplier;
    this.player.x += vx * effectiveSpeed * dt;
    this.player.y += vy * effectiveSpeed * dt;

    const margin = 40;
    this.player.x = Phaser.Math.Clamp(this.player.x, margin, this.cameras.main.width - margin);
    this.player.y = Phaser.Math.Clamp(this.player.y, margin, this.cameras.main.height - margin);
  }

  private updateWaves(dt: number): void {
    const spawns = waveManager.update(dt);

    for (const spawn of spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.spawnEnemy(spawn.enemyType);
      }
    }
  }

  private updateWeapons(dt: number): void {
    // Only fire when left mouse button is held down
    if (!this.input.activePointer.isDown) {
      // Still update cooldowns when not firing
      const weapons = weaponManager.getActiveWeapons();
      for (const weapon of weapons) {
        const cooldownKey = weapon.definition.id;
        let cooldown = this.weaponCooldowns.get(cooldownKey) || 0;
        cooldown -= dt;
        if (cooldown < 0) cooldown = 0;
        this.weaponCooldowns.set(cooldownKey, cooldown);
      }
      return;
    }

    // Calculate angle from player to mouse cursor
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y,
      pointer.worldX, pointer.worldY
    );

    const weapons = weaponManager.getActiveWeapons();

    for (const weapon of weapons) {
      const cooldownKey = weapon.definition.id;
      let cooldown = this.weaponCooldowns.get(cooldownKey) || 0;
      cooldown -= dt;

      if (cooldown <= 0) {
        // Get power-up multipliers for fire rate
        const powerUps = powerUpSystem.getMultipliers();
        // Apply stats, time progression, and power-up fire rate multipliers
        const effectiveFireRate = weapon.computedFireRate *
          this.stats.fireRateMultiplier *
          this.timeProgression.fireRateMultiplier *
          powerUps.fireRateMultiplier;
        cooldown = 1 / effectiveFireRate;
        // Fire in the direction of the mouse cursor
        this.fireWeapon(weapon, angle);
      }

      this.weaponCooldowns.set(cooldownKey, cooldown);
    }
  }

  private fireWeapon(weapon: IWeaponInstance, angle: number): void {
    const def = weapon.definition;

    // Get power-up multipliers
    const powerUps = powerUpSystem.getMultipliers();

    // Apply stats, time progression, and power-up projectile count bonuses
    const count = weapon.computedProjectileCount +
      this.stats.additionalProjectiles +
      this.timeProgression.additionalProjectiles +
      powerUps.additionalProjectiles;
    const spreadRad = Phaser.Math.DegToRad(weapon.computedSpread);
    const startAngle = angle - spreadRad / 2;
    const step = count > 1 ? spreadRad / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const projAngle = count === 1 ? angle : startAngle + step * i;

      const proj = this.add.sprite(this.player.x, this.player.y, def.projectileTexture || 'laser_blue') as Projectile;
      proj.rotation = projAngle + Math.PI / 2;
      proj.vx = Math.cos(projAngle) * weapon.computedProjectileSpeed * 1.5;  // 50% faster projectiles
      proj.vy = Math.sin(projAngle) * weapon.computedProjectileSpeed * 1.5;  // 50% faster projectiles
      proj.lifetime = 3;
      // Apply stats, time progression, power-up, and kill streak damage multipliers
      proj.damage = weapon.computedDamage *
        this.stats.damageMultiplier *
        this.timeProgression.damageMultiplier *
        powerUps.damageMultiplier *
        killStreakSystem.getDamageMultiplier();
      proj.piercing = (def.piercing ? 3 : 0) + this.stats.piercingBonus;
      proj.homing = def.homing || false;
      proj.isEnemy = false;
      proj.setScale(0.6);
      proj.setBlendMode(Phaser.BlendModes.ADD);

      if (Math.random() < this.stats.critChance) {
        proj.damage *= 2;
        proj.setTint(0xff0000);
      }

      this.projectiles.push(proj);
    }

    this.sound.play('sfx_laser', { volume: 0.2 });
  }

  private getClosestEnemy(): Enemy | null {
    const enemies = this.getClosestEnemies(1);
    return enemies.length > 0 ? enemies[0] : null;
  }

  private getClosestEnemies(count: number): Enemy[] {
    const maxRange = 1200;  // Increased detection range from 800 to 1200
    const enemiesWithDist: { enemy: Enemy; dist: number }[] = [];

    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < maxRange) {
        enemiesWithDist.push({ enemy, dist });
      }
    }

    // Sort by distance and return closest N enemies
    enemiesWithDist.sort((a, b) => a.dist - b.dist);
    return enemiesWithDist.slice(0, count).map(e => e.enemy);
  }

  private spawnEnemy(enemyType: string): void {
    const side = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    switch (side) {
      case 0: x = Phaser.Math.Between(50, this.cameras.main.width - 50); y = -50; break;
      case 1: x = this.cameras.main.width + 50; y = Phaser.Math.Between(50, this.cameras.main.height - 50); break;
      case 2: x = Phaser.Math.Between(50, this.cameras.main.width - 50); y = this.cameras.main.height + 50; break;
      default: x = -50; y = Phaser.Math.Between(50, this.cameras.main.height - 50);
    }

    const isBoss = enemyType.startsWith('boss_') || enemyType === 'mothership' || enemyType === 'destroyer';
    const data = isBoss ? waveManager.getScaledBoss(enemyType) : waveManager.getScaledEnemy(enemyType);
    if (!data) return;

    const textureMap: Record<string, string> = {
      'drone': 'enemy_drone',
      'charger': 'enemy_charger',
      'tank': 'enemy_tank',
      'shooter': 'enemy_shooter',
      'swarm': 'enemy_swarm',
      'mothership': 'boss_mothership',
      'destroyer': 'boss_destroyer',
    };

    const texture = textureMap[enemyType] || 'enemy_drone';

    const enemy = this.add.sprite(x, y, texture) as Enemy;
    enemy.setScale(data.scale * (isBoss ? 1.5 : 1));
    enemy.enemyId = data.id;
    enemy.speed = data.speed * difficultySystem.getEnemySpeedMultiplier();
    enemy.hp = Math.ceil(data.hp * difficultySystem.getEnemyHpMultiplier());
    enemy.maxHp = Math.ceil(data.hp * difficultySystem.getEnemyHpMultiplier());
    enemy.damage = Math.ceil(data.damage * difficultySystem.getEnemyDamageMultiplier());
    enemy.xpValue = Math.ceil(data.xpValue * difficultySystem.getXpMultiplier());
    enemy.behavior = data.behavior as Enemy['behavior'];
    enemy.behaviorTimer = 0;
    enemy.isBoss = isBoss;

    if (isBoss) {
      enemy.setTint(0xff00ff);
    }

    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      enemy.behaviorTimer += dt;

      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);

      switch (enemy.behavior) {
        case 'chase':
          enemy.x += Math.cos(angle) * enemy.speed * dt;
          enemy.y += Math.sin(angle) * enemy.speed * dt;
          break;

        case 'dash':
          if (!enemy.dashTarget || enemy.behaviorTimer > 2) {
            enemy.dashTarget = { x: this.player.x, y: this.player.y };
            enemy.behaviorTimer = 0;
          }
          const dashDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, enemy.dashTarget.x, enemy.dashTarget.y);
          if (dashDist > 10) {
            const dashAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, enemy.dashTarget.x, enemy.dashTarget.y);
            enemy.x += Math.cos(dashAngle) * enemy.speed * 3 * dt;
            enemy.y += Math.sin(dashAngle) * enemy.speed * 3 * dt;
          }
          break;

        case 'circle':
          const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
          if (dist > 250) {
            enemy.x += Math.cos(angle) * enemy.speed * dt;
            enemy.y += Math.sin(angle) * enemy.speed * dt;
          } else {
            const circleAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            const newAngle = circleAngle + enemy.speed * 0.01 * dt;
            enemy.x = this.player.x + Math.cos(newAngle) * 200;
            enemy.y = this.player.y + Math.sin(newAngle) * 200;
          }
          break;

        case 'ranged':
          const rangeDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
          if (rangeDist < 250) {
            enemy.x -= Math.cos(angle) * enemy.speed * dt;
            enemy.y -= Math.sin(angle) * enemy.speed * dt;
          } else if (rangeDist > 350) {
            enemy.x += Math.cos(angle) * enemy.speed * dt;
            enemy.y += Math.sin(angle) * enemy.speed * dt;
          }
          if (enemy.behaviorTimer > 2) {
            enemy.behaviorTimer = 0;
            this.fireEnemyProjectile(enemy);
          }
          break;
      }

      enemy.rotation = angle - Math.PI / 2;
    }
  }

  private fireEnemyProjectile(enemy: Enemy): void {
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    const proj = this.add.sprite(enemy.x, enemy.y, 'laser_red') as Projectile;
    proj.rotation = angle + Math.PI / 2;
    proj.vx = Math.cos(angle) * 200;
    proj.vy = Math.sin(angle) * 200;
    proj.lifetime = 5;
    proj.damage = enemy.damage;
    proj.piercing = 0;
    proj.homing = false;
    proj.isEnemy = true;
    proj.setScale(0.5);
    proj.setTint(0xff0000);
    this.projectiles.push(proj);
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];

      if (proj.homing && !proj.isEnemy) {
        const target = this.getClosestEnemy();
        if (target) {
          const targetAngle = Phaser.Math.Angle.Between(proj.x, proj.y, target.x, target.y);
          const currentAngle = Math.atan2(proj.vy, proj.vx);
          const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, 3 * dt);
          const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
          proj.vx = Math.cos(newAngle) * speed;
          proj.vy = Math.sin(newAngle) * speed;
          proj.rotation = newAngle + Math.PI / 2;
        }
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.lifetime -= dt;

      if (proj.lifetime <= 0 ||
          proj.x < -100 || proj.x > this.cameras.main.width + 100 ||
          proj.y < -100 || proj.y > this.cameras.main.height + 100) {
        proj.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateXPOrbs(dt: number): void {
    // Get power-up magnet multiplier
    const powerUps = powerUpSystem.getMultipliers();
    const effectiveMagnetRadius = this.stats.magnetRadius * powerUps.magnetMultiplier;

    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const orb = this.xpOrbs[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);

      if (dist < effectiveMagnetRadius) {
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, this.player.x, this.player.y);
        const speed = 400 * (1 - dist / effectiveMagnetRadius);
        orb.x += Math.cos(angle) * speed * dt;
        orb.y += Math.sin(angle) * speed * dt;
      }

      orb.setScale(0.4 + Math.sin(this.time.now * 0.005) * 0.05);

      if (dist < 30) {
        const xpGain = Math.round(orb.value * this.stats.xpMultiplier);
        this.upgradeSystem.addXp(xpGain);
        this.score += orb.value;
        this.sound.play('sfx_powerup', { volume: 0.15 });
        this.damageNumbers.showXP(orb.x, orb.y, xpGain);
        orb.destroy();
        this.xpOrbs.splice(i, 1);
      }
    }
  }

  private checkCollisions(): void {
    // Player projectiles vs enemies
    for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
      const proj = this.projectiles[pi];
      if (proj.isEnemy) continue;

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const enemy = this.enemies[ei];
        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, enemy.x, enemy.y);

        if (dist < 40) {
          const damage = proj.damage;
          const isCritical = proj.tint === 0xff0000;
          const wasOverkill = enemy.hp > 0 && enemy.hp - damage <= -enemy.maxHp * 0.5;

          enemy.hp -= damage;
          enemy.setTint(0xffffff);
          this.time.delayedCall(50, () => {
            if (enemy.active) enemy.clearTint();
          });
          this.sound.play('sfx_hit', { volume: 0.15 });

          // Show damage number with enhanced effects
          if (wasOverkill && enemy.hp <= 0) {
            this.damageNumbers.showOverkill(enemy.x, enemy.y, damage, ei);
          } else {
            this.damageNumbers.showDamage(enemy.x, enemy.y, damage, isCritical, ei);
          }

          if (enemy.hp <= 0) {
            this.killEnemy(enemy, ei);
          }

          if (proj.piercing > 0) {
            proj.piercing--;
          } else {
            proj.destroy();
            this.projectiles.splice(pi, 1);
            break;
          }
        }
      }
    }

    // Enemy projectiles vs player (skip if invincible)
    if (!this.isInvincible) {
      for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
        const proj = this.projectiles[pi];
        if (!proj.isEnemy) continue;

        const dist = Phaser.Math.Distance.Between(proj.x, proj.y, this.player.x, this.player.y);
        if (dist < 30) {
          this.damagePlayer(proj.damage);
          proj.destroy();
          this.projectiles.splice(pi, 1);
        }
      }

      // Contact damage
      for (const enemy of this.enemies) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (dist < 35) {
          this.damagePlayer(enemy.damage * 0.5);
          const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
          enemy.x += Math.cos(angle) * 50;
          enemy.y += Math.sin(angle) * 50;
        }
      }
    }
  }

  private killEnemy(enemy: Enemy, index: number): void {
    this.spawnXPOrb(enemy.x, enemy.y, enemy.xpValue);
    this.createDeathEffect(enemy.x, enemy.y);
    this.enemies.splice(index, 1);
    enemy.destroy();
    this.kills++;

    // Track kill for kill streak system
    killStreakSystem.addKill();

    // Track kill for combo system (provides XP bonus)
    const xpBonus = this.comboSystem.registerKill(enemy.xpValue);
    if (xpBonus > 0) {
      this.upgradeSystem.addXp(xpBonus);
      this.score += xpBonus;
    }

    // Try to spawn a power-up (5% chance)
    powerUpSystem.trySpawnPowerUp(enemy.x, enemy.y);
  }

  private damagePlayer(damage: number): void {
    // Check if power-up invincibility is active
    if (powerUpSystem.isInvincible()) {
      // Show golden glow effect from power-up
      this.player.setTint(0xffdd00);
      this.time.delayedCall(100, () => this.player.clearTint());
      return;
    }

    // Check if kill streak invincibility is active
    if (killStreakSystem.isStreakInvincible()) {
      // Show golden invincibility effect
      this.player.setTint(0xffff00);
      this.time.delayedCall(100, () => this.player.clearTint());
      return;
    }

    // Shield absorbs damage first
    if (this.abilities.shield.active && this.abilities.shield.hp > 0) {
      const absorbed = Math.min(damage, this.abilities.shield.hp);
      this.abilities.shield.hp -= absorbed;
      damage -= absorbed;

      // Show shield absorption
      if (absorbed > 0) {
        this.damageNumbers.showShield(this.player.x, this.player.y, absorbed);
      }

      // Shield break check
      if (this.abilities.shield.hp <= 0) {
        this.deactivateShield();
      }

      // If all damage absorbed, return
      if (damage <= 0) {
        this.player.setTint(0x00aaff);
        this.time.delayedCall(100, () => this.player.clearTint());
        return;
      }
    }

    // Notify kill streak system that player took damage (resets streak)
    killStreakSystem.onPlayerDamaged();

    this.stats.hp -= damage;
    this.player.setTint(0xff0000);
    this.time.delayedCall(100, () => this.player.clearTint());

    // Show player damage number
    this.damageNumbers.showPlayerDamage(this.player.x, this.player.y, damage);
    this.cameras.main.shake(100, 0.01);

    if (this.stats.hp <= 0) {
      this.gameOver();
    }
  }

  private spawnXPOrb(x: number, y: number, value: number): void {
    const orb = this.add.sprite(x, y, value > 30 ? 'xp_orb_large' : 'xp_orb') as XPOrb;
    orb.setScale(0);
    orb.value = value;
    orb.setBlendMode(Phaser.BlendModes.ADD);
    orb.setTint(0x88ff88);

    this.tweens.add({
      targets: orb,
      scale: 0.4,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.xpOrbs.push(orb);
  }

  private createDeathEffect(x: number, y: number): void {
    const particles = this.add.particles(x, y, 'fire', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      quantity: 8,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.time.delayedCall(500, () => particles.destroy());
  }

  /**
   * Shows power spike effect when reaching a new time progression threshold
   */
  private showPowerSpike(threshold: ITimeThreshold): void {
    // Play level up sound
    this.sound.play('sfx_levelup', { volume: 0.6 });

    // Camera flash effect
    this.cameras.main.flash(300, 255, 255, 255, false);

    // Create announcement text
    const colorHex = `#${threshold.color.toString(16).padStart(6, '0')}`;
    const titleText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 80,
      'POWER SPIKE!',
      {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: colorHex,
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    const nameText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      threshold.name.toUpperCase(),
      {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: colorHex,
        stroke: '#000000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    // Build bonus description
    const bonuses: string[] = [];
    if (threshold.damageBonus > 0) {
      bonuses.push(`DMG +${Math.round(threshold.damageBonus * 100)}%`);
    }
    if (threshold.projectileBonus > 0) {
      bonuses.push(`+${threshold.projectileBonus} Projectiles`);
    }
    if (threshold.fireRateBonus > 0) {
      bonuses.push(`Fire Rate +${Math.round(threshold.fireRateBonus * 100)}%`);
    }

    const bonusText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 10,
      bonuses.join(' | '),
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    // Animate text in
    this.tweens.add({
      targets: [titleText, nameText, bonusText],
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Animate text out after delay
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [titleText, nameText, bonusText],
        alpha: 0,
        y: '-=30',
        duration: 500,
        onComplete: () => {
          titleText.destroy();
          nameText.destroy();
          bonusText.destroy();
        }
      });
    });

    // Particle burst around player
    const particles = this.add.particles(this.player.x, this.player.y, 'star', {
      speed: { min: 150, max: 300 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 30,
      blendMode: Phaser.BlendModes.ADD,
      tint: threshold.color,
    });
    this.time.delayedCall(200, () => particles.destroy());

    // Small camera shake
    this.cameras.main.shake(200, 0.01);
  }

  private onKillStreakMilestone(event: IKillStreakEvent): void {
    const m = event.milestone;
    const hex = `#${m.color.toString(16).padStart(6, '0')}`;
    this.sound.play(m.soundKey, { volume: 0.7 });
    this.cameras.main.flash(300, (m.color >> 16) & 0xff, (m.color >> 8) & 0xff, m.color & 0xff, false);
    const t1 = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 60, m.name, { fontFamily: 'monospace', fontSize: '48px', color: hex, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(200).setAlpha(0);
    const t2 = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, m.description, { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200).setAlpha(0);
    const t3 = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 40, `${event.currentStreak} KILL STREAK!`, { fontFamily: 'monospace', fontSize: '18px', color: '#ffaa00', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: [t1, t2, t3], alpha: 1, scale: { from: 0.5, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(2500, () => this.tweens.add({ targets: [t1, t2, t3], alpha: 0, y: '-=30', duration: 500, onComplete: () => { t1.destroy(); t2.destroy(); t3.destroy(); } }));
    if (m.rewardType === KillStreakRewardType.XP_BONUS) this.upgradeSystem.addXp(m.rewardValue);
    else if (m.rewardType === KillStreakRewardType.HEAL_PERCENT) { this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp * m.rewardValue); const hp = this.add.particles(this.player.x, this.player.y, 'star', { speed: { min: 50, max: 100 }, scale: { start: 0.4, end: 0 }, lifespan: 500, quantity: 15, blendMode: Phaser.BlendModes.ADD, tint: 0x00ff00 }); this.time.delayedCall(500, () => hp.destroy()); }
    else if (m.rewardType === KillStreakRewardType.SCREEN_EXPLOSION) { for (let i = this.enemies.length - 1; i >= 0; i--) { const e = this.enemies[i]; e.hp -= m.rewardValue; e.setTint(0xff0000); this.time.delayedCall(100, () => { if (e.active) e.clearTint(); }); if (e.hp <= 0) this.killEnemy(e, i); } this.cameras.main.shake(500, 0.03); const ex = this.add.particles(this.player.x, this.player.y, 'fire', { speed: { min: 300, max: 600 }, scale: { start: 0.8, end: 0 }, lifespan: 800, quantity: 50, blendMode: Phaser.BlendModes.ADD, tint: [0xff0000, 0xff6600, 0xffff00] }); this.time.delayedCall(200, () => ex.destroy()); }
    const mp = this.add.particles(this.player.x, this.player.y, 'star', { speed: { min: 150, max: 300 }, scale: { start: 0.5, end: 0 }, lifespan: 600, quantity: 30, blendMode: Phaser.BlendModes.ADD, tint: m.color });
    this.time.delayedCall(200, () => mp.destroy());
    this.cameras.main.shake(300, 0.015);
  }

  private onKillStreakReset(finalStreak: number): void {
    if (finalStreak >= 5) {
      const t = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 30, `STREAK ENDED: ${finalStreak} KILLS`, { fontFamily: 'monospace', fontSize: '24px', color: '#ff4444', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 200 });
      this.time.delayedCall(1500, () => this.tweens.add({ targets: t, alpha: 0, y: '-=20', duration: 400, onComplete: () => t.destroy() }));
    }
  }

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.score} | KILLS: ${this.kills}`);

    const wave = waveManager.getCurrentWave();
    this.waveText.setText(`WAVE ${wave.waveNumber}${wave.bossWave ? ' - BOSS!' : ''}`);

    const level = this.upgradeSystem.level;
    this.levelText.setText(`LV ${level}`);

    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    this.timeText.setText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

    // Update progression UI
    if (this.timeProgression.currentThreshold && this.timeProgression.currentThresholdIndex > 0) {
      const threshold = this.timeProgression.currentThreshold;
      this.progressionText.setText(threshold.name);
      this.progressionText.setColor(`#${threshold.color.toString(16).padStart(6, '0')}`);
    } else {
      this.progressionText.setText('');
    }

    // HP Bar
    this.hpBar.clear();
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(20, 70, 200, 12);
    const hpRatio = this.stats.hp / this.stats.maxHp;
    const hpColor = hpRatio > 0.5 ? 0x00ff88 : (hpRatio > 0.25 ? 0xffff00 : 0xff4444);
    this.hpBar.fillStyle(hpColor, 1);
    this.hpBar.fillRect(22, 72, 196 * hpRatio, 8);
    this.hpBar.lineStyle(2, 0x00ffff, 0.8);
    this.hpBar.strokeRect(20, 70, 200, 12);

    // XP Bar
    this.xpBar.clear();
    const xpBarWidth = this.cameras.main.width - 80;
    this.xpBar.fillStyle(0x222222, 0.8);
    this.xpBar.fillRect(40, this.cameras.main.height - 20, xpBarWidth, 8);
    const xpRatio = this.upgradeSystem.levelProgress;
    this.xpBar.fillStyle(0xffff00, 1);
    this.xpBar.fillRect(40, this.cameras.main.height - 20, xpBarWidth * xpRatio, 8);

    // Update difficulty indicator (shows endless scaling)
    const diffIndicator = difficultySystem.getDifficultyIndicator();
    this.difficultyText.setText(diffIndicator.text);
    this.difficultyText.setColor(`#${diffIndicator.color.toString(16).padStart(6, '0')}`);

    // Update kill streak UI
    const streak = killStreakSystem.getCurrentStreak();
    if (streak > 0) {
      this.killStreakText.setText(`STREAK: ${streak}`);
      const c = streak >= 200 ? '#ff0000' : streak >= 100 ? '#ffff00' : streak >= 50 ? '#ff00ff' : streak >= 25 ? '#ffaa00' : streak >= 10 ? '#00ff00' : '#aaaaaa';
      this.killStreakText.setColor(c);
    } else {
      this.killStreakText.setText('');
    }
    const eff: string[] = [];
    if (killStreakSystem.getDamageBoostTimeRemaining() > 0) eff.push(`DMG+50% ${Math.ceil(killStreakSystem.getDamageBoostTimeRemaining())}s`);
    if (killStreakSystem.getInvincibilityTimeRemaining() > 0) eff.push(`INVINCIBLE ${Math.ceil(killStreakSystem.getInvincibilityTimeRemaining())}s`);
    this.killStreakEffectText.setText(eff.join(' | '));
  }

  /**
   * Update the minimap with current game state.
   */
  private updateMiniMap(dt: number): void {
    // Update minimap animation (boss pulsing)
    this.miniMap.update(dt);

    // Build entity list for minimap
    const entities: MiniMapEntity[] = [];

    // Add enemies
    for (const enemy of this.enemies) {
      entities.push({
        x: enemy.x,
        y: enemy.y,
        type: enemy.isBoss ? 'boss' : 'enemy',
      });
    }

    // Add XP orbs
    for (const orb of this.xpOrbs) {
      entities.push({
        x: orb.x,
        y: orb.y,
        type: 'xpOrb',
      });
    }

    // Update minimap with current data
    this.miniMap.updateData({
      playerX: this.player.x,
      playerY: this.player.y,
      mapWidth: this.cameras.main.width,
      mapHeight: this.cameras.main.height,
      entities,
    });
  }

  /**
   * Set up hazard system callbacks.
   */
  private setupHazardSystem(): void {
    // Player position getter
    this.hazardSystem.setPlayerPositionGetter(() => {
      if (!this.player || !this.player.active) return null;
      return { x: this.player.x, y: this.player.y };
    });

    // Enemy position getter
    this.hazardSystem.setEnemyPositionGetter(() => {
      return this.enemies
        .filter((e) => e.active)
        .map((enemy, index) => ({
          id: index,
          x: enemy.x,
          y: enemy.y,
        }));
    });

    // Player damage callback
    this.hazardSystem.setOnPlayerDamage(
      (damage: number, hazardType: HazardType) => {
        if (this.isInvincible) return;
        this.damagePlayer(damage);
        this.showHazardDamageEffect(hazardType);
      }
    );

    // Enemy damage callback
    this.hazardSystem.setOnEnemyDamage(
      (enemyIndex: number, damage: number, _hazardType: HazardType) => {
        const enemy = this.enemies[enemyIndex];
        if (enemy && enemy.active) {
          enemy.hp -= damage;
          if (enemy.hp <= 0) {
            this.killEnemy(enemy, enemyIndex);
          }
        }
      }
    );

    // Player slow callback (for ice patches)
    this.hazardSystem.setOnPlayerSlow((slowFactor: number, duration: number) => {
      this.applyIceSlow(slowFactor, duration);
    });
  }

  /**
   * Show visual effect when player takes hazard damage.
   */
  private showHazardDamageEffect(hazardType: HazardType): void {
    switch (hazardType) {
      case HazardType.MeteorShower:
        // Orange flash for meteor impact
        this.cameras.main.flash(100, 255, 150, 50);
        this.cameras.main.shake(150, 0.01);
        break;
      case HazardType.ElectricZone:
        // Blue-white flash for electric shock
        this.cameras.main.flash(80, 100, 200, 255);
        break;
      case HazardType.PoisonCloud:
        // Green tint for poison
        this.cameras.main.flash(150, 50, 200, 50);
        break;
      case HazardType.IcePatch:
        // Light blue flash for ice
        this.cameras.main.flash(100, 150, 220, 255);
        break;
      case HazardType.LavaCrack:
        // Red-orange flash for lava
        this.cameras.main.flash(120, 255, 80, 30);
        this.cameras.main.shake(100, 0.005);
        break;
    }
  }

  /**
   * Apply ice slow effect to player.
   */
  private applyIceSlow(slowFactor: number, duration: number): void {
    // Store base speed if not already slowed
    if (!this.iceSlowActive) {
      this.baseSpeed = this.stats.speed;
    }

    // Apply slow effect
    this.stats.speed = this.baseSpeed * slowFactor;
    this.iceSlowActive = true;
    this.iceSlowTimer = duration;

    // Visual feedback - slight blue tint on player
    this.player.setTint(0x88ccff);
  }

  /**
   * Update ice slow effect timer.
   */
  private updateIceSlowEffect(dt: number): void {
    if (!this.iceSlowActive) return;

    this.iceSlowTimer -= dt;

    if (this.iceSlowTimer <= 0) {
      // Restore normal speed
      this.stats.speed = this.baseSpeed;
      this.iceSlowActive = false;
      this.iceSlowTimer = 0;

      // Remove blue tint
      this.player.clearTint();
    }
  }

  /**
   * Create combo UI elements
   */
  private createComboUI(): void {
    const screenWidth = this.cameras.main.width;

    // Container for combo UI (top-center of screen)
    this.comboContainer = this.add.container(screenWidth / 2, 120);
    this.comboContainer.setDepth(100);
    this.comboContainer.setAlpha(0); // Hidden by default

    // Combo count text (large, centered)
    this.comboText = this.add.text(0, 0, '0', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Multiplier text (below count)
    this.comboMultiplierText = this.add.text(0, 45, 'x1', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Tier text (above count)
    this.comboTierText = this.add.text(0, -45, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Timer bar (below multiplier)
    this.comboTimerBar = this.add.graphics();

    // Add all to container
    this.comboContainer.add([
      this.comboTierText,
      this.comboText,
      this.comboMultiplierText,
      this.comboTimerBar,
    ]);
  }

  /**
   * Update combo UI each frame
   */
  private updateComboUI(): void {
    const state = this.comboSystem.getState();

    if (!state.isActive || state.count < 2) {
      // Fade out if not active or count too low
      if (this.comboContainer.alpha > 0) {
        this.comboContainer.alpha = Math.max(0, this.comboContainer.alpha - 0.1);
      }
      return;
    }

    // Fade in
    if (this.comboContainer.alpha < 1) {
      this.comboContainer.alpha = Math.min(1, this.comboContainer.alpha + 0.2);
    }

    // Update text
    this.comboText.setText(state.count.toString());
    this.comboMultiplierText.setText(`x${state.multiplier}`);
    this.comboTierText.setText(state.tierName);

    // Update colors based on tier
    const tierColor = this.comboSystem.tierColor;
    const colorHex = `#${tierColor.toString(16).padStart(6, '0')}`;
    this.comboText.setColor(colorHex);
    this.comboTierText.setColor(colorHex);

    // Update timer bar
    this.comboTimerBar.clear();
    const barWidth = 100;
    const barHeight = 6;
    const timeRatio = state.timeRemaining / ComboSystem.getComboTimeWindow();

    // Background
    this.comboTimerBar.fillStyle(0x333333, 0.8);
    this.comboTimerBar.fillRect(-barWidth / 2, 70, barWidth, barHeight);

    // Fill (color based on urgency)
    const barColor = timeRatio > 0.5 ? 0x00ff00 : (timeRatio > 0.25 ? 0xffff00 : 0xff0000);
    this.comboTimerBar.fillStyle(barColor, 1);
    this.comboTimerBar.fillRect(-barWidth / 2, 70, barWidth * timeRatio, barHeight);

    // Pulse effect on high combos
    if (state.count >= 10) {
      const pulse = 1 + Math.sin(this.time.now * 0.01) * 0.05;
      this.comboContainer.setScale(pulse);
    } else {
      this.comboContainer.setScale(1);
    }
  }

  /**
   * Handle combo events from the ComboSystem
   */
  private handleComboEvent(event: IComboEvent): void {
    switch (event.type) {
      case 'milestone':
        if (event.milestone) {
          this.onComboMilestone(event.milestone, event.count);
        }
        break;
      case 'expire':
        this.onComboExpire(event.count, event.xpBonus);
        break;
      case 'reset':
        // Silent reset (e.g., on player death)
        break;
    }
  }

  /**
   * Handle combo milestone reached
   */
  private onComboMilestone(milestone: IComboMilestone, count: number): void {
    // Play milestone sound
    this.sound.play('sfx_levelup', { volume: 0.6 });

    // Screen flash for high milestones
    if (milestone.screenFlash) {
      const r = (milestone.flashColor >> 16) & 0xff;
      const g = (milestone.flashColor >> 8) & 0xff;
      const b = milestone.flashColor & 0xff;
      this.cameras.main.flash(200, r, g, b, false);
    }

    // Show announcement
    this.showComboAnnouncement(milestone.announcement, milestone.flashColor, count);

    // Particle burst
    const particles = this.add.particles(this.player.x, this.player.y, 'star', {
      speed: { min: 150, max: 300 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      quantity: 20,
      blendMode: Phaser.BlendModes.ADD,
      tint: milestone.flashColor,
    });
    this.time.delayedCall(200, () => particles.destroy());

    // Camera shake for big milestones
    if (count >= 25) {
      this.cameras.main.shake(150, 0.01);
    }
  }

  /**
   * Handle combo expiration
   */
  private onComboExpire(finalCount: number, totalXPBonus: number): void {
    // Only show result for meaningful combos
    if (finalCount >= 5) {
      this.showComboResult(finalCount, totalXPBonus);
    }
  }

  /**
   * Show combo milestone announcement
   */
  private showComboAnnouncement(text: string, color: number, count: number): void {
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;

    const announcement = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 100,
      text,
      {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: colorHex,
        stroke: '#000000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0).setScale(0.5);

    const countText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 50,
      `${count}x COMBO!`,
      {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    // Animate in
    this.tweens.add({
      targets: [announcement, countText],
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Animate out
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [announcement, countText],
        alpha: 0,
        y: '-=30',
        duration: 400,
        onComplete: () => {
          announcement.destroy();
          countText.destroy();
        },
      });
    });
  }

  /**
   * Show combo result when it expires
   */
  private showComboResult(finalCount: number, totalXPBonus: number): void {
    const result = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 80,
      `COMBO ENDED: ${finalCount} KILLS`,
      {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    const bonus = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 50,
      `+${totalXPBonus} BONUS XP`,
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    // Animate in
    this.tweens.add({
      targets: [result, bonus],
      alpha: 1,
      duration: 200,
    });

    // Animate out
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [result, bonus],
        alpha: 0,
        y: '-=20',
        duration: 400,
        onComplete: () => {
          result.destroy();
          bonus.destroy();
        },
      });
    });
  }

  private gameOver(): void {
    // Clear all screen effects FIRST (vignette, chromatic, etc.)
    this.screenEffects.clearAll();

    this.isPaused = true;
    this.isGameOver = true;
    this.sound.play('sfx_death', { volume: 0.5 });
    this.createDeathEffect(this.player.x, this.player.y);
    this.player.setVisible(false);

    // Submit score to difficulty system for high score tracking
    difficultySystem.submitScore({
      score: this.score,
      timeSurvived: this.gameTime,
      waveReached: waveManager.getCurrentWave().waveNumber,
      kills: this.kills,
      level: this.upgradeSystem.level,
    });

    this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    ).setDepth(150);

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 60,
      'GAME OVER',
      {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#ff0000',
        stroke: '#330000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5).setDepth(200);

    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 10,
      `Time: ${minutes}:${seconds.toString().padStart(2, '0')} | Score: ${this.score} | Kills: ${this.kills}\nWave: ${waveManager.getCurrentWave().waveNumber} | Level: ${this.upgradeSystem.level}`,
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(200);

    const restartText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 100,
      'Click to restart',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#00ffff',
      }
    ).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Use mouse click to restart instead of SPACE (since SPACE is now dash)
    this.input.once('pointerdown', () => {
      this.scene.restart();
    });
  }
}
