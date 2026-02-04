/**
 * DemoScene - Cosmic Survivors demo with Kenney Space Shooter assets.
 * Sci-fi neon aesthetic.
 */

import * as Phaser from 'phaser';

interface Enemy extends Phaser.GameObjects.Sprite {
  speed: number;
  hp: number;
  maxHp: number;
  enemyColor: number;
}

interface Projectile extends Phaser.GameObjects.Sprite {
  vx: number;
  vy: number;
  lifetime: number;
}

interface XPOrb extends Phaser.GameObjects.Sprite {
  value: number;
}

export class DemoScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];

  private playerSpeed = 250;
  private shootCooldown = 0;
  private spawnCooldown = 0;
  private score = 0;
  private kills = 0;
  private playerHp = 100;
  private maxPlayerHp = 100;

  private scoreText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private background!: Phaser.GameObjects.TileSprite;
  private hpBar!: Phaser.GameObjects.Graphics;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  constructor() {
    super({ key: 'DemoScene' });
  }

  preload(): void {
    // Player
    this.load.image('player', 'assets/sprites/player.png');

    // Enemies
    this.load.image('enemy_small', 'assets/sprites/enemyRed1.png');
    this.load.image('enemy_medium', 'assets/sprites/enemyBlue2.png');
    this.load.image('enemy_large', 'assets/sprites/enemyGreen3.png');
    this.load.image('enemy_boss', 'assets/sprites/enemyBlack5.png');

    // Projectiles
    this.load.image('laser_blue', 'assets/sprites/projectiles/laserBlue01.png');
    this.load.image('laser_green', 'assets/sprites/projectiles/laserGreen11.png');
    this.load.image('laser_red', 'assets/sprites/projectiles/laserRed01.png');

    // Power-ups / XP
    this.load.image('xp_orb', 'assets/sprites/powerupGreen.png');
    this.load.image('powerup_shield', 'assets/sprites/powerupBlue_shield.png');
    this.load.image('powerup_bolt', 'assets/sprites/powerupYellow_bolt.png');

    // Effects
    this.load.image('star', 'assets/particles/star1.png');
    this.load.image('fire', 'assets/particles/fire08.png');

    // Background
    this.load.image('bg_purple', 'assets/backgrounds/darkPurple.png');

    // Audio
    this.load.audio('sfx_laser', 'assets/audio/sfx_laser1.ogg');
    this.load.audio('sfx_hit', 'assets/audio/sfx_zap.ogg');
    this.load.audio('sfx_powerup', 'assets/audio/sfx_shieldUp.ogg');
    this.load.audio('sfx_death', 'assets/audio/sfx_lose.ogg');
  }

  create(): void {
    // Scrolling space background
    this.background = this.add.tileSprite(
      0, 0,
      this.cameras.main.width * 2,
      this.cameras.main.height * 2,
      'bg_purple'
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(-10);

    // Add stars particle effect for depth
    this.createStarfield();

    // Create player
    this.player = this.add.sprite(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'player'
    ).setScale(0.8);

    // HP Bar background
    this.hpBar = this.add.graphics();
    this.hpBar.setScrollFactor(0).setDepth(100);

    // UI - Score
    this.scoreText = this.add.text(20, 20, 'SCORE: 0 | KILLS: 0', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#00ffff',
      stroke: '#003333',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    this.hpText = this.add.text(20, 50, 'HP: 100/100', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00ff88',
      stroke: '#003300',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    this.fpsText = this.add.text(this.cameras.main.width - 80, 20, 'FPS: 60', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#666688',
    }).setScrollFactor(0).setDepth(100);

    // Title with neon effect (using shadow)
    const title = this.add.text(
      this.cameras.main.centerX,
      40,
      'COSMIC SURVIVORS',
      {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ff00ff',
        stroke: '#330033',
        strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: '#ff00ff', blur: 10, fill: true, stroke: true },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Pulse animation on title
    this.tweens.add({
      targets: title,
      alpha: 0.8,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Instructions
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 25,
      'WASD/Arrows: Move | Auto-fire | Collect green orbs',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#888899',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    };

    // Spawn initial enemies
    for (let i = 0; i < 8; i++) {
      this.spawnEnemy();
    }
  }

  private createStarfield(): void {
    // Create stars particle effect
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

  private updateHPBar(): void {
    this.hpBar.clear();

    const barWidth = 200;
    const barHeight = 12;
    const x = 20;
    const y = 75;

    // Background
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // HP fill
    const hpRatio = this.playerHp / this.maxPlayerHp;
    const fillColor = hpRatio > 0.5 ? 0x00ff88 : (hpRatio > 0.25 ? 0xffff00 : 0xff4444);
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(x + 2, y + 2, (barWidth - 4) * hpRatio, barHeight - 4);

    // Border
    this.hpBar.lineStyle(2, 0x00ffff, 0.8);
    this.hpBar.strokeRect(x, y, barWidth, barHeight);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // Scroll background
    this.background.tilePositionY -= 30 * dt;

    // Update FPS
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    // Handle input
    this.handleInput(dt);

    // Auto-fire
    this.shootCooldown -= dt;
    if (this.shootCooldown <= 0) {
      this.fireProjectile();
      this.shootCooldown = 0.2;
    }

    // Spawn enemies
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.enemies.length < 60) {
      this.spawnEnemy();
      this.spawnCooldown = 1.2 - Math.min(this.kills * 0.01, 0.8);
    }

    // Update entities
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateXPOrbs(dt);

    // Check collisions
    this.checkCollisions();

    // Update UI
    this.scoreText.setText(`SCORE: ${this.score} | KILLS: ${this.kills}`);
    this.hpText.setText(`HP: ${this.playerHp}/${this.maxPlayerHp}`);
    this.updateHPBar();
  }

  private handleInput(dt: number): void {
    let vx = 0;
    let vy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) vx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) vy += 1;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    }

    // Move player
    this.player.x += vx * this.playerSpeed * dt;
    this.player.y += vy * this.playerSpeed * dt;

    // Rotate player slightly based on movement
    this.player.rotation = vx * 0.15;

    // Keep in bounds
    const margin = 40;
    this.player.x = Phaser.Math.Clamp(this.player.x, margin, this.cameras.main.width - margin);
    this.player.y = Phaser.Math.Clamp(this.player.y, margin, this.cameras.main.height - margin);
  }

  private fireProjectile(): void {
    // Find closest enemy
    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;

    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        enemy.x, enemy.y
      );
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy && closestDist < 600) {
      const angle = Phaser.Math.Angle.Between(
        this.player.x, this.player.y,
        closestEnemy.x, closestEnemy.y
      );

      const projectile = this.add.sprite(
        this.player.x,
        this.player.y - 20,
        'laser_blue'
      ) as Projectile;

      projectile.rotation = angle + Math.PI / 2;
      projectile.vx = Math.cos(angle) * 500;
      projectile.vy = Math.sin(angle) * 500;
      projectile.lifetime = 2;
      projectile.setScale(0.7);
      projectile.setBlendMode(Phaser.BlendModes.ADD);

      this.projectiles.push(projectile);

      // Sound
      this.sound.play('sfx_laser', { volume: 0.3 });
    }
  }

  private spawnEnemy(): void {
    const side = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    switch (side) {
      case 0: // Top
        x = Phaser.Math.Between(50, this.cameras.main.width - 50);
        y = -40;
        break;
      case 1: // Right
        x = this.cameras.main.width + 40;
        y = Phaser.Math.Between(50, this.cameras.main.height - 50);
        break;
      case 2: // Bottom
        x = Phaser.Math.Between(50, this.cameras.main.width - 50);
        y = this.cameras.main.height + 40;
        break;
      default: // Left
        x = -40;
        y = Phaser.Math.Between(50, this.cameras.main.height - 50);
    }

    // Enemy types with increasing difficulty
    const difficulty = Math.min(this.kills / 20, 3);
    const types = [
      { texture: 'enemy_small', speed: 100 + difficulty * 10, hp: 1, scale: 0.6, color: 0xff4444 },
      { texture: 'enemy_medium', speed: 70 + difficulty * 5, hp: 2, scale: 0.7, color: 0x44aaff },
      { texture: 'enemy_large', speed: 50, hp: 4, scale: 0.8, color: 0x44ff44 },
    ];

    const typeIndex = Phaser.Math.Between(0, Math.min(2, Math.floor(difficulty)));
    const type = types[typeIndex];

    const enemy = this.add.sprite(x, y, type.texture) as Enemy;
    enemy.setScale(type.scale);
    enemy.speed = type.speed;
    enemy.hp = type.hp;
    enemy.maxHp = type.hp;
    enemy.enemyColor = type.color;

    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      // Move toward player
      const angle = Phaser.Math.Angle.Between(
        enemy.x, enemy.y,
        this.player.x, this.player.y
      );

      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;

      // Rotate to face player
      enemy.rotation = angle - Math.PI / 2;
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.lifetime -= dt;

      if (proj.lifetime <= 0 ||
          proj.x < -50 || proj.x > this.cameras.main.width + 50 ||
          proj.y < -50 || proj.y > this.cameras.main.height + 50) {
        proj.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateXPOrbs(dt: number): void {
    const magnetRadius = 120;
    const magnetSpeed = 350;

    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
      const orb = this.xpOrbs[i];

      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        orb.x, orb.y
      );

      // Magnet effect
      if (dist < magnetRadius) {
        const angle = Phaser.Math.Angle.Between(
          orb.x, orb.y,
          this.player.x, this.player.y
        );
        const speed = magnetSpeed * (1 - dist / magnetRadius);
        orb.x += Math.cos(angle) * speed * dt;
        orb.y += Math.sin(angle) * speed * dt;
      }

      // Pulsating effect
      orb.setScale(0.5 + Math.sin(this.time.now * 0.005) * 0.05);

      // Collect
      if (dist < 25) {
        this.score += orb.value;
        this.sound.play('sfx_powerup', { volume: 0.2 });

        // Heal slightly
        this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + 1);

        orb.destroy();
        this.xpOrbs.splice(i, 1);
      }
    }
  }

  private checkCollisions(): void {
    // Projectile vs Enemy
    for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
      const proj = this.projectiles[pi];

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const enemy = this.enemies[ei];

        const dist = Phaser.Math.Distance.Between(
          proj.x, proj.y,
          enemy.x, enemy.y
        );

        if (dist < 35) {
          enemy.hp -= 1;

          // Hit flash
          enemy.setTint(0xffffff);
          this.time.delayedCall(50, () => {
            if (enemy.active) enemy.clearTint();
          });

          this.sound.play('sfx_hit', { volume: 0.2 });

          if (enemy.hp <= 0) {
            this.spawnXPOrb(enemy.x, enemy.y, enemy.maxHp * 10);
            this.createDeathEffect(enemy.x, enemy.y);
            enemy.destroy();
            this.enemies.splice(ei, 1);
            this.kills++;
          }

          proj.destroy();
          this.projectiles.splice(pi, 1);
          break;
        }
      }
    }

    // Enemy vs Player
    for (const enemy of this.enemies) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        enemy.x, enemy.y
      );

      if (dist < 35) {
        this.playerHp -= 10;
        this.player.setTint(0xff0000);
        this.time.delayedCall(100, () => {
          this.player.clearTint();
        });

        // Knockback enemy
        const angle = Phaser.Math.Angle.Between(
          this.player.x, this.player.y,
          enemy.x, enemy.y
        );
        enemy.x += Math.cos(angle) * 50;
        enemy.y += Math.sin(angle) * 50;

        // Camera shake
        this.cameras.main.shake(100, 0.01);

        if (this.playerHp <= 0) {
          this.gameOver();
        }
      }
    }
  }

  private spawnXPOrb(x: number, y: number, value: number): void {
    const orb = this.add.sprite(x, y, 'xp_orb') as XPOrb;
    orb.setScale(0.5);
    orb.value = value;
    orb.setBlendMode(Phaser.BlendModes.ADD);
    orb.setTint(0x88ff88);

    // Pop-in animation
    orb.setScale(0);
    this.tweens.add({
      targets: orb,
      scale: 0.5,
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

  private gameOver(): void {
    this.sound.play('sfx_death', { volume: 0.5 });

    // Explosion effect
    this.createDeathEffect(this.player.x, this.player.y);
    this.player.setVisible(false);

    // Darken screen
    const overlay = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.7
    ).setDepth(150);

    // Game over text
    const gameOverText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      'GAME OVER',
      {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#ff0000',
        stroke: '#330000',
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 0, color: '#ff0000', blur: 15, fill: true },
      }
    ).setOrigin(0.5).setDepth(200);

    const finalScore = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 30,
      `Final Score: ${this.score} | Kills: ${this.kills}`,
      {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      }
    ).setOrigin(0.5).setDepth(200);

    const restartText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 90,
      'Press SPACE to restart',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#00ffff',
      }
    ).setOrigin(0.5).setDepth(200);

    // Blinking restart text
    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Restart on space
    this.input.keyboard!.once('keydown-SPACE', () => {
      overlay.destroy();
      gameOverText.destroy();
      finalScore.destroy();
      restartText.destroy();
      this.scene.restart();
    });

    // Pause enemy movement
    this.enemies.forEach(e => e.speed = 0);
  }
}
