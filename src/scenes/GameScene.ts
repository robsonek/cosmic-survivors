/**
 * GameScene - Main gameplay scene with upgrade, weapon, and wave systems.
 * Bullet Heaven / Vampire Survivors style.
 */

import * as Phaser from 'phaser';
import { getUpgradeSystem, IUpgrade } from '../systems/UpgradeSystem';
import { weaponManager, IWeaponInstance } from '../systems/WeaponManager';
import { waveManager } from '../systems/WaveManager';
import { UpgradeSelectionUI } from '../ui/UpgradeSelectionUI';

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

  // Player stats
  private stats = {
    maxHp: 100,
    hp: 100,
    speed: 250,
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    magnetRadius: 120,
    regenRate: 0,
    additionalProjectiles: 0,
    piercingBonus: 0,
    critChance: 0,
    xpMultiplier: 1,
  };

  // Game state
  private score = 0;
  private kills = 0;
  private gameTime = 0;
  private isPaused = false;
  private weaponCooldowns: Map<string, number> = new Map();

  // Systems
  private upgradeSystem = getUpgradeSystem();
  private upgradeUI!: UpgradeSelectionUI;

  // UI elements
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private background!: Phaser.GameObjects.TileSprite;

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
    weaponManager.addWeapon('basic_laser');

    // Reset state
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.weaponCooldowns.clear();
    this.score = 0;
    this.kills = 0;
    this.gameTime = 0;
    this.isPaused = false;
    this.resetStats();

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

    // UI
    this.createUI();

    // Upgrade UI
    this.upgradeUI = new UpgradeSelectionUI(this, {
      screenWidth: this.cameras.main.width,
      screenHeight: this.cameras.main.height,
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
  }

  private resetStats(): void {
    this.stats = {
      maxHp: 100,
      hp: 100,
      speed: 250,
      damageMultiplier: 1,
      fireRateMultiplier: 1,
      magnetRadius: 120,
      regenRate: 0,
      additionalProjectiles: 0,
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

    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.xpBar = this.add.graphics().setScrollFactor(0).setDepth(100);
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

    // Reset to base
    this.stats.maxHp = 100;
    this.stats.speed = 250;
    this.stats.damageMultiplier = 1;
    this.stats.fireRateMultiplier = 1;
    this.stats.magnetRadius = 120;
    this.stats.regenRate = 0;
    this.stats.additionalProjectiles = 0;
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

    this.background.tilePositionY -= 30 * dt;
    this.handleInput(dt);
    this.updateWaves(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateXPOrbs(dt);
    this.checkCollisions();

    // Regen
    if (this.stats.regenRate > 0) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.regenRate * dt);
    }

    this.updateUI();
  }

  private handleInput(dt: number): void {
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

    this.player.x += vx * this.stats.speed * dt;
    this.player.y += vy * this.stats.speed * dt;
    this.player.rotation = vx * 0.15;

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
    const weapons = weaponManager.getActiveWeapons();
    const target = this.getClosestEnemy();

    for (const weapon of weapons) {
      const cooldownKey = weapon.definition.id;
      let cooldown = this.weaponCooldowns.get(cooldownKey) || 0;
      cooldown -= dt;

      if (cooldown <= 0 && target) {
        const effectiveFireRate = weapon.computedFireRate / this.stats.fireRateMultiplier;
        cooldown = 1 / effectiveFireRate;
        this.fireWeapon(weapon, target);
      }

      this.weaponCooldowns.set(cooldownKey, cooldown);
    }
  }

  private fireWeapon(weapon: IWeaponInstance, target: Enemy): void {
    const def = weapon.definition;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);

    const count = weapon.computedProjectileCount + this.stats.additionalProjectiles;
    const spreadRad = Phaser.Math.DegToRad(weapon.computedSpread);
    const startAngle = angle - spreadRad / 2;
    const step = count > 1 ? spreadRad / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const projAngle = count === 1 ? angle : startAngle + step * i;

      const proj = this.add.sprite(this.player.x, this.player.y, def.projectileTexture || 'laser_blue') as Projectile;
      proj.rotation = projAngle + Math.PI / 2;
      proj.vx = Math.cos(projAngle) * weapon.computedProjectileSpeed;
      proj.vy = Math.sin(projAngle) * weapon.computedProjectileSpeed;
      proj.lifetime = 3;
      proj.damage = weapon.computedDamage * this.stats.damageMultiplier;
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
    let closest: Enemy | null = null;
    let closestDist = 800;

    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
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
    enemy.speed = data.speed;
    enemy.hp = data.hp;
    enemy.maxHp = data.hp;
    enemy.damage = data.damage;
    enemy.xpValue = data.xpValue;
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
    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const orb = this.xpOrbs[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);

      if (dist < this.stats.magnetRadius) {
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, this.player.x, this.player.y);
        const speed = 400 * (1 - dist / this.stats.magnetRadius);
        orb.x += Math.cos(angle) * speed * dt;
        orb.y += Math.sin(angle) * speed * dt;
      }

      orb.setScale(0.4 + Math.sin(this.time.now * 0.005) * 0.05);

      if (dist < 30) {
        const xpGain = Math.round(orb.value * this.stats.xpMultiplier);
        this.upgradeSystem.addXp(xpGain);
        this.score += orb.value;
        this.sound.play('sfx_powerup', { volume: 0.15 });
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
          enemy.hp -= proj.damage;
          enemy.setTint(0xffffff);
          this.time.delayedCall(50, () => {
            if (enemy.active) enemy.clearTint();
          });
          this.sound.play('sfx_hit', { volume: 0.15 });

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

    // Enemy projectiles vs player
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

  private killEnemy(enemy: Enemy, index: number): void {
    this.spawnXPOrb(enemy.x, enemy.y, enemy.xpValue);
    this.createDeathEffect(enemy.x, enemy.y);
    this.enemies.splice(index, 1);
    enemy.destroy();
    this.kills++;
  }

  private damagePlayer(damage: number): void {
    this.stats.hp -= damage;
    this.player.setTint(0xff0000);
    this.time.delayedCall(100, () => this.player.clearTint());
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

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.score} | KILLS: ${this.kills}`);

    const wave = waveManager.getCurrentWave();
    this.waveText.setText(`WAVE ${wave.waveNumber}${wave.bossWave ? ' - BOSS!' : ''}`);

    const level = this.upgradeSystem.level;
    this.levelText.setText(`LV ${level}`);

    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    this.timeText.setText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

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
  }

  private gameOver(): void {
    this.isPaused = true;
    this.sound.play('sfx_death', { volume: 0.5 });
    this.createDeathEffect(this.player.x, this.player.y);
    this.player.setVisible(false);

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
      'Press SPACE to restart',
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

    this.input.keyboard!.once('keydown-SPACE', () => {
      this.scene.restart();
    });
  }
}
