/**
 * HazardSystem - Environmental hazards for Cosmic Survivors
 * Spawns various hazards after wave 10, increasing frequency over time.
 *
 * Hazard Types:
 * - Meteor Shower: Random meteors fall, dealing damage to all
 * - Electric Zones: Pulsing areas that damage whoever stands in them
 * - Poison Clouds: Slow-moving clouds that deal DOT
 * - Ice Patches: Slippery areas that reduce control
 * - Lava Cracks: Lines that open up and deal damage
 */

import * as Phaser from 'phaser';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Hazard type enumeration
 */
export enum HazardType {
  MeteorShower = 'meteor_shower',
  ElectricZone = 'electric_zone',
  PoisonCloud = 'poison_cloud',
  IcePatch = 'ice_patch',
  LavaCrack = 'lava_crack',
}

/**
 * Base hazard configuration
 */
export interface IHazardConfig {
  type: HazardType;
  x: number;
  y: number;
  damage: number;
  duration: number;
  warningDuration: number;
  radius?: number;
  width?: number;
  height?: number;
}

/**
 * Active hazard state
 */
interface IActiveHazard {
  id: string;
  type: HazardType;
  x: number;
  y: number;
  damage: number;
  duration: number;
  warningDuration: number;
  elapsed: number;
  radius: number;
  width: number;
  height: number;
  graphics: Phaser.GameObjects.Graphics;
  warningGraphics?: Phaser.GameObjects.Graphics;
  particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  isActive: boolean;
  angle?: number; // For lava cracks
  velocity?: { x: number; y: number }; // For poison clouds
  damageTimer: number; // For DOT tick rate
  affectedEntities: Set<number>; // For tracking affected entities
}

/**
 * Meteor projectile
 */
interface IMeteor {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  radius: number;
  graphics: Phaser.GameObjects.Graphics;
  shadowGraphics: Phaser.GameObjects.Graphics;
  warningGraphics?: Phaser.GameObjects.Graphics;
  elapsed: number;
  impactTime: number;
  hasImpacted: boolean;
}

/**
 * Hazard spawn configuration
 */
interface IHazardSpawnConfig {
  type: HazardType;
  weight: number;
  minWave: number;
  damage: { min: number; max: number };
  duration: { min: number; max: number };
  warningDuration: number;
  radius?: { min: number; max: number };
  width?: { min: number; max: number };
  height?: { min: number; max: number };
  count?: { min: number; max: number }; // For meteor showers
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAZARD_MIN_WAVE = 10;
const BASE_SPAWN_INTERVAL = 15; // seconds between hazard spawns
const MIN_SPAWN_INTERVAL = 5; // minimum interval at high waves
const SPAWN_INTERVAL_REDUCTION_PER_WAVE = 0.3; // reduce interval by this per wave after 10
const DOT_TICK_RATE = 0.5; // damage tick every 0.5 seconds

/**
 * Hazard spawn configurations
 */
const HAZARD_CONFIGS: Record<HazardType, IHazardSpawnConfig> = {
  [HazardType.MeteorShower]: {
    type: HazardType.MeteorShower,
    weight: 20,
    minWave: 10,
    damage: { min: 15, max: 30 },
    duration: { min: 3, max: 6 },
    warningDuration: 1.5,
    radius: { min: 60, max: 100 },
    count: { min: 5, max: 12 },
  },
  [HazardType.ElectricZone]: {
    type: HazardType.ElectricZone,
    weight: 25,
    minWave: 10,
    damage: { min: 8, max: 20 },
    duration: { min: 5, max: 10 },
    warningDuration: 1.0,
    radius: { min: 80, max: 150 },
  },
  [HazardType.PoisonCloud]: {
    type: HazardType.PoisonCloud,
    weight: 25,
    minWave: 12,
    damage: { min: 5, max: 15 },
    duration: { min: 8, max: 15 },
    warningDuration: 0.8,
    radius: { min: 100, max: 180 },
  },
  [HazardType.IcePatch]: {
    type: HazardType.IcePatch,
    weight: 15,
    minWave: 11,
    damage: { min: 0, max: 0 }, // No direct damage, just slows
    duration: { min: 6, max: 12 },
    warningDuration: 1.2,
    radius: { min: 100, max: 200 },
  },
  [HazardType.LavaCrack]: {
    type: HazardType.LavaCrack,
    weight: 15,
    minWave: 13,
    damage: { min: 20, max: 40 },
    duration: { min: 4, max: 8 },
    warningDuration: 1.5,
    width: { min: 300, max: 500 },
    height: { min: 30, max: 60 },
  },
};

// ============================================================================
// HAZARD SYSTEM CLASS
// ============================================================================

/**
 * Environmental Hazard System
 */
export class HazardSystem {
  private scene: Phaser.Scene;
  private activeHazards: Map<string, IActiveHazard> = new Map();
  private activeMeteors: Map<string, IMeteor> = new Map();
  private hazardIdCounter = 0;
  private meteorIdCounter = 0;
  private spawnTimer = 0;
  private currentWave = 0;
  private enabled = true;

  // Callbacks
  private onPlayerDamage?: (damage: number, hazardType: HazardType) => void;
  private onEnemyDamage?: (entityId: number, damage: number, hazardType: HazardType) => void;
  private onPlayerSlow?: (slowFactor: number, duration: number) => void;
  private getPlayerPosition?: () => { x: number; y: number } | null;
  private getEnemyPositions?: () => Array<{ id: number; x: number; y: number }>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Set callback for player damage
   */
  setOnPlayerDamage(callback: (damage: number, hazardType: HazardType) => void): void {
    this.onPlayerDamage = callback;
  }

  /**
   * Set callback for enemy damage
   */
  setOnEnemyDamage(callback: (entityId: number, damage: number, hazardType: HazardType) => void): void {
    this.onEnemyDamage = callback;
  }

  /**
   * Set callback for player slow effect
   */
  setOnPlayerSlow(callback: (slowFactor: number, duration: number) => void): void {
    this.onPlayerSlow = callback;
  }

  /**
   * Set position getter for player
   */
  setPlayerPositionGetter(getter: () => { x: number; y: number } | null): void {
    this.getPlayerPosition = getter;
  }

  /**
   * Set position getter for enemies
   */
  setEnemyPositionGetter(getter: () => Array<{ id: number; x: number; y: number }>): void {
    this.getEnemyPositions = getter;
  }

  /**
   * Set current wave number
   */
  setCurrentWave(wave: number): void {
    this.currentWave = wave;
  }

  /**
   * Enable/disable hazard system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update hazard system
   */
  update(dt: number): void {
    if (!this.enabled || this.currentWave < HAZARD_MIN_WAVE) {
      return;
    }

    // Update spawn timer
    this.spawnTimer += dt;
    const spawnInterval = this.calculateSpawnInterval();

    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnRandomHazard();
    }

    // Update active hazards
    this.updateHazards(dt);

    // Update meteors
    this.updateMeteors(dt);
  }

  /**
   * Calculate spawn interval based on wave
   */
  private calculateSpawnInterval(): number {
    const wavesSinceStart = this.currentWave - HAZARD_MIN_WAVE;
    const reduction = wavesSinceStart * SPAWN_INTERVAL_REDUCTION_PER_WAVE;
    return Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - reduction);
  }

  /**
   * Update all active hazards
   */
  private updateHazards(dt: number): void {
    for (const [id, hazard] of this.activeHazards) {
      hazard.elapsed += dt;

      // Warning phase
      if (hazard.elapsed < hazard.warningDuration) {
        this.updateWarningEffect(hazard, hazard.elapsed / hazard.warningDuration);
        continue;
      }

      // Activate hazard
      if (!hazard.isActive) {
        hazard.isActive = true;
        this.activateHazard(hazard);
      }

      // Update hazard visual
      this.updateHazardVisual(hazard, dt);

      // Check for damage
      hazard.damageTimer += dt;
      if (hazard.damageTimer >= DOT_TICK_RATE) {
        hazard.damageTimer = 0;
        this.checkHazardCollisions(hazard);
      }

      // Check expiration
      const totalDuration = hazard.warningDuration + hazard.duration;
      if (hazard.elapsed >= totalDuration) {
        this.destroyHazard(id);
      }
    }
  }

  /**
   * Update meteor projectiles
   */
  private updateMeteors(dt: number): void {
    for (const [id, meteor] of this.activeMeteors) {
      meteor.elapsed += dt;

      // Warning phase - show shadow growing
      if (meteor.elapsed < meteor.impactTime) {
        const progress = meteor.elapsed / meteor.impactTime;
        this.updateMeteorWarning(meteor, progress);

        // Move meteor towards target
        const t = progress;
        meteor.y = -100 + (meteor.targetY + 100) * this.easeInQuad(t);
        meteor.x = meteor.targetX;

        // Update graphics position
        meteor.graphics.setPosition(meteor.x, meteor.y);
        continue;
      }

      // Impact!
      if (!meteor.hasImpacted) {
        meteor.hasImpacted = true;
        this.meteorImpact(meteor);
      }

      // Remove after impact animation (0.5 seconds)
      if (meteor.elapsed >= meteor.impactTime + 0.5) {
        this.destroyMeteor(id);
      }
    }
  }

  // ============================================
  // Hazard Spawning
  // ============================================

  /**
   * Spawn a random hazard
   */
  private spawnRandomHazard(): void {
    const availableHazards = Object.values(HAZARD_CONFIGS).filter(
      config => this.currentWave >= config.minWave
    );

    if (availableHazards.length === 0) return;

    // Weighted random selection
    const totalWeight = availableHazards.reduce((sum, h) => sum + h.weight, 0);
    let random = Math.random() * totalWeight;

    for (const config of availableHazards) {
      random -= config.weight;
      if (random <= 0) {
        this.spawnHazard(config);
        break;
      }
    }
  }

  /**
   * Spawn a specific hazard type
   */
  private spawnHazard(config: IHazardSpawnConfig): void {
    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;

    // Random position with margin
    const margin = 100;
    const x = Phaser.Math.Between(margin, screenWidth - margin);
    const y = Phaser.Math.Between(margin, screenHeight - margin);

    const damage = Phaser.Math.Between(config.damage.min, config.damage.max);
    const duration = Phaser.Math.FloatBetween(config.duration.min, config.duration.max);
    const radius = config.radius
      ? Phaser.Math.Between(config.radius.min, config.radius.max)
      : 100;
    const width = config.width
      ? Phaser.Math.Between(config.width.min, config.width.max)
      : 0;
    const height = config.height
      ? Phaser.Math.Between(config.height.min, config.height.max)
      : 0;

    if (config.type === HazardType.MeteorShower) {
      this.spawnMeteorShower(x, y, damage, duration, radius, config);
    } else {
      this.createHazard({
        type: config.type,
        x,
        y,
        damage,
        duration,
        warningDuration: config.warningDuration,
        radius,
        width,
        height,
      });
    }
  }

  /**
   * Spawn a meteor shower
   */
  private spawnMeteorShower(
    centerX: number,
    centerY: number,
    damage: number,
    duration: number,
    radius: number,
    config: IHazardSpawnConfig
  ): void {
    const count = config.count
      ? Phaser.Math.Between(config.count.min, config.count.max)
      : 5;

    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;

    // Spawn meteors over time
    for (let i = 0; i < count; i++) {
      const delay = (duration / count) * i;

      this.scene.time.delayedCall(delay * 1000, () => {
        // Random position around center, but within screen bounds
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 200;
        let targetX = centerX + Math.cos(angle) * dist;
        let targetY = centerY + Math.sin(angle) * dist;

        // Clamp to screen
        targetX = Phaser.Math.Clamp(targetX, 50, screenWidth - 50);
        targetY = Phaser.Math.Clamp(targetY, 50, screenHeight - 50);

        this.createMeteor(targetX, targetY, damage, radius, config.warningDuration);
      });
    }
  }

  /**
   * Create a single hazard
   */
  private createHazard(config: IHazardConfig): IActiveHazard {
    const id = `hazard_${++this.hazardIdCounter}`;

    // Create warning graphics
    const warningGraphics = this.scene.add.graphics();
    warningGraphics.setDepth(5);

    // Create main graphics
    const graphics = this.scene.add.graphics();
    graphics.setDepth(6);
    graphics.setVisible(false);

    const hazard: IActiveHazard = {
      id,
      type: config.type,
      x: config.x,
      y: config.y,
      damage: config.damage,
      duration: config.duration,
      warningDuration: config.warningDuration,
      elapsed: 0,
      radius: config.radius || 100,
      width: config.width || 0,
      height: config.height || 0,
      graphics,
      warningGraphics,
      isActive: false,
      damageTimer: 0,
      affectedEntities: new Set(),
    };

    // Type-specific setup
    if (config.type === HazardType.PoisonCloud) {
      // Random slow movement direction
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 20;
      hazard.velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      };
    }

    if (config.type === HazardType.LavaCrack) {
      // Random angle for the crack
      hazard.angle = Math.random() * Math.PI;
    }

    this.activeHazards.set(id, hazard);
    return hazard;
  }

  /**
   * Create a meteor projectile
   */
  private createMeteor(
    targetX: number,
    targetY: number,
    damage: number,
    radius: number,
    impactTime: number
  ): IMeteor {
    const id = `meteor_${++this.meteorIdCounter}`;

    // Shadow/warning graphics
    const shadowGraphics = this.scene.add.graphics();
    shadowGraphics.setDepth(4);

    // Warning indicator
    const warningGraphics = this.scene.add.graphics();
    warningGraphics.setDepth(5);

    // Meteor graphics
    const graphics = this.scene.add.graphics();
    graphics.setDepth(50);

    const meteor: IMeteor = {
      id,
      x: targetX,
      y: -100,
      targetX,
      targetY,
      speed: 500,
      damage,
      radius,
      graphics,
      shadowGraphics,
      warningGraphics,
      elapsed: 0,
      impactTime,
      hasImpacted: false,
    };

    this.activeMeteors.set(id, meteor);
    return meteor;
  }

  // ============================================
  // Warning Effects
  // ============================================

  /**
   * Update warning effect for a hazard
   */
  private updateWarningEffect(hazard: IActiveHazard, progress: number): void {
    if (!hazard.warningGraphics) return;

    hazard.warningGraphics.clear();

    const alpha = 0.3 + Math.sin(progress * Math.PI * 8) * 0.2;
    const scale = 0.5 + progress * 0.5;

    switch (hazard.type) {
      case HazardType.ElectricZone:
        this.drawElectricWarning(hazard.warningGraphics, hazard.x, hazard.y, hazard.radius * scale, alpha);
        break;
      case HazardType.PoisonCloud:
        this.drawPoisonWarning(hazard.warningGraphics, hazard.x, hazard.y, hazard.radius * scale, alpha);
        break;
      case HazardType.IcePatch:
        this.drawIceWarning(hazard.warningGraphics, hazard.x, hazard.y, hazard.radius * scale, alpha);
        break;
      case HazardType.LavaCrack:
        this.drawLavaWarning(hazard.warningGraphics, hazard.x, hazard.y, hazard.width, hazard.height, hazard.angle || 0, alpha * scale);
        break;
    }
  }

  /**
   * Update meteor warning effect
   */
  private updateMeteorWarning(meteor: IMeteor, progress: number): void {
    meteor.shadowGraphics.clear();
    meteor.warningGraphics?.clear();
    meteor.graphics.clear();

    // Growing shadow
    const shadowRadius = meteor.radius * progress;
    const shadowAlpha = 0.3 + progress * 0.3;

    meteor.shadowGraphics.fillStyle(0x000000, shadowAlpha);
    meteor.shadowGraphics.fillCircle(meteor.targetX, meteor.targetY, shadowRadius);

    // Pulsing warning ring
    const pulseAlpha = 0.5 + Math.sin(progress * Math.PI * 10) * 0.3;
    meteor.warningGraphics?.lineStyle(3, 0xff4400, pulseAlpha);
    meteor.warningGraphics?.strokeCircle(meteor.targetX, meteor.targetY, meteor.radius);

    // Draw meteor (fireball)
    const meteorScale = 0.5 + progress * 0.5;
    this.drawMeteor(meteor.graphics, meteor.x, meteor.y, meteor.radius * meteorScale);
  }

  // ============================================
  // Hazard Activation
  // ============================================

  /**
   * Activate a hazard (transition from warning to active)
   */
  private activateHazard(hazard: IActiveHazard): void {
    // Clean up warning graphics
    if (hazard.warningGraphics) {
      hazard.warningGraphics.destroy();
      hazard.warningGraphics = undefined;
    }

    // Show main graphics
    hazard.graphics.setVisible(true);

    // Play activation sound/effect
    this.playActivationEffect(hazard);

    // Create particles for some hazard types
    this.createHazardParticles(hazard);
  }

  /**
   * Play activation effect for hazard
   */
  private playActivationEffect(hazard: IActiveHazard): void {
    switch (hazard.type) {
      case HazardType.ElectricZone:
        this.scene.cameras.main.flash(100, 100, 150, 255, false, undefined, undefined);
        break;
      case HazardType.LavaCrack:
        this.scene.cameras.main.shake(150, 0.005);
        break;
    }
  }

  /**
   * Create particles for hazard
   */
  private createHazardParticles(hazard: IActiveHazard): void {
    if (!this.scene.textures.exists('star')) return;

    let particleConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig | null = null;

    switch (hazard.type) {
      case HazardType.PoisonCloud:
        particleConfig = {
          x: hazard.x,
          y: hazard.y,
          speed: { min: 10, max: 30 },
          scale: { start: 0.3, end: 0 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 2000,
          quantity: 2,
          frequency: 100,
          tint: 0x00ff00,
          blendMode: Phaser.BlendModes.ADD,
        };
        break;
      case HazardType.ElectricZone:
        particleConfig = {
          x: hazard.x,
          y: hazard.y,
          speed: { min: 50, max: 150 },
          scale: { start: 0.2, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 300,
          quantity: 3,
          frequency: 50,
          tint: 0x00aaff,
          blendMode: Phaser.BlendModes.ADD,
        };
        break;
    }

    if (particleConfig) {
      hazard.particles = this.scene.add.particles(hazard.x, hazard.y, 'star', particleConfig);
      hazard.particles.setDepth(7);
    }
  }

  // ============================================
  // Hazard Visual Updates
  // ============================================

  /**
   * Update hazard visuals
   */
  private updateHazardVisual(hazard: IActiveHazard, dt: number): void {
    hazard.graphics.clear();

    const activeTime = hazard.elapsed - hazard.warningDuration;
    const fadeProgress = activeTime / hazard.duration;

    // Move poison clouds
    if (hazard.type === HazardType.PoisonCloud && hazard.velocity) {
      hazard.x += hazard.velocity.x * dt;
      hazard.y += hazard.velocity.y * dt;

      // Bounce off screen edges
      const screenWidth = this.scene.cameras.main.width;
      const screenHeight = this.scene.cameras.main.height;

      if (hazard.x < hazard.radius || hazard.x > screenWidth - hazard.radius) {
        hazard.velocity.x *= -1;
      }
      if (hazard.y < hazard.radius || hazard.y > screenHeight - hazard.radius) {
        hazard.velocity.y *= -1;
      }

      // Update particle position
      if (hazard.particles) {
        hazard.particles.setPosition(hazard.x, hazard.y);
      }
    }

    // Draw based on type
    switch (hazard.type) {
      case HazardType.ElectricZone:
        this.drawElectricZone(hazard.graphics, hazard, activeTime, fadeProgress);
        break;
      case HazardType.PoisonCloud:
        this.drawPoisonCloud(hazard.graphics, hazard, activeTime, fadeProgress);
        break;
      case HazardType.IcePatch:
        this.drawIcePatch(hazard.graphics, hazard, fadeProgress);
        break;
      case HazardType.LavaCrack:
        this.drawLavaCrack(hazard.graphics, hazard, activeTime, fadeProgress);
        break;
    }
  }

  // ============================================
  // Drawing Methods
  // ============================================

  /**
   * Draw electric zone warning
   */
  private drawElectricWarning(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, alpha: number): void {
    g.lineStyle(3, 0x00aaff, alpha);
    g.strokeCircle(x, y, radius);
    g.lineStyle(2, 0x66ddff, alpha * 0.5);
    g.strokeCircle(x, y, radius * 0.8);
  }

  /**
   * Draw poison cloud warning
   */
  private drawPoisonWarning(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, alpha: number): void {
    g.lineStyle(3, 0x00ff00, alpha);
    g.strokeCircle(x, y, radius);
    g.fillStyle(0x00ff00, alpha * 0.2);
    g.fillCircle(x, y, radius);
  }

  /**
   * Draw ice patch warning
   */
  private drawIceWarning(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, alpha: number): void {
    g.lineStyle(3, 0x88ddff, alpha);
    g.strokeCircle(x, y, radius);
    g.fillStyle(0xaaeeff, alpha * 0.2);
    g.fillCircle(x, y, radius);
  }

  /**
   * Draw lava crack warning
   */
  private drawLavaWarning(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, angle: number, alpha: number): void {
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(angle);

    g.lineStyle(3, 0xff4400, alpha);
    g.strokeRect(-width / 2, -height / 2, width, height);
    g.fillStyle(0xff2200, alpha * 0.3);
    g.fillRect(-width / 2, -height / 2, width, height);

    g.restore();
  }

  /**
   * Draw electric zone (active)
   */
  private drawElectricZone(g: Phaser.GameObjects.Graphics, hazard: IActiveHazard, time: number, fadeProgress: number): void {
    const alpha = (1 - fadeProgress * 0.5);
    const pulsePhase = time * 10;

    // Base fill
    g.fillStyle(0x003366, alpha * 0.3);
    g.fillCircle(hazard.x, hazard.y, hazard.radius);

    // Electric arcs
    g.lineStyle(2, 0x00aaff, alpha);
    g.strokeCircle(hazard.x, hazard.y, hazard.radius);

    // Inner pulsing rings
    const innerRadius = hazard.radius * (0.5 + Math.sin(pulsePhase) * 0.2);
    g.lineStyle(3, 0x66ddff, alpha * 0.8);
    g.strokeCircle(hazard.x, hazard.y, innerRadius);

    // Lightning bolts
    this.drawLightningBolts(g, hazard.x, hazard.y, hazard.radius, time, alpha);
  }

  /**
   * Draw lightning bolts for electric zone
   */
  private drawLightningBolts(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, time: number, alpha: number): void {
    const numBolts = 4;
    g.lineStyle(2, 0xffffff, alpha);

    for (let i = 0; i < numBolts; i++) {
      const baseAngle = (i / numBolts) * Math.PI * 2 + time * 2;
      const startX = cx + Math.cos(baseAngle) * radius * 0.3;
      const startY = cy + Math.sin(baseAngle) * radius * 0.3;
      const endX = cx + Math.cos(baseAngle) * radius * 0.9;
      const endY = cy + Math.sin(baseAngle) * radius * 0.9;

      g.beginPath();
      g.moveTo(startX, startY);

      // Zigzag to end
      const segments = 5;
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const px = Phaser.Math.Linear(startX, endX, t);
        const py = Phaser.Math.Linear(startY, endY, t);
        const offset = (Math.random() - 0.5) * 20;
        const perpX = -(endY - startY) / radius;
        const perpY = (endX - startX) / radius;
        g.lineTo(px + perpX * offset, py + perpY * offset);
      }

      g.strokePath();
    }
  }

  /**
   * Draw poison cloud (active)
   */
  private drawPoisonCloud(g: Phaser.GameObjects.Graphics, hazard: IActiveHazard, time: number, fadeProgress: number): void {
    const alpha = (1 - fadeProgress * 0.5);
    const wobble = Math.sin(time * 3) * 10;

    // Multiple overlapping circles for cloud effect
    g.fillStyle(0x003300, alpha * 0.4);
    g.fillCircle(hazard.x + wobble, hazard.y, hazard.radius);
    g.fillCircle(hazard.x - wobble * 0.5, hazard.y + wobble * 0.5, hazard.radius * 0.8);

    g.fillStyle(0x00ff00, alpha * 0.2);
    g.fillCircle(hazard.x, hazard.y, hazard.radius * 0.7);

    g.lineStyle(2, 0x44ff44, alpha * 0.6);
    g.strokeCircle(hazard.x, hazard.y, hazard.radius);

    // Skull warning icon (simplified)
    this.drawSkullIcon(g, hazard.x, hazard.y - 10, alpha);
  }

  /**
   * Draw simplified skull icon for poison
   */
  private drawSkullIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha: number): void {
    g.fillStyle(0xffffff, alpha * 0.5);
    g.fillCircle(x, y, 12);

    // Eyes
    g.fillStyle(0x000000, alpha * 0.8);
    g.fillCircle(x - 4, y - 2, 3);
    g.fillCircle(x + 4, y - 2, 3);

    // Nose
    g.fillTriangle(x, y + 2, x - 2, y + 5, x + 2, y + 5);
  }

  /**
   * Draw ice patch (active)
   */
  private drawIcePatch(g: Phaser.GameObjects.Graphics, hazard: IActiveHazard, fadeProgress: number): void {
    const alpha = (1 - fadeProgress * 0.5);

    // Icy blue gradient fill
    g.fillStyle(0x88ddff, alpha * 0.4);
    g.fillCircle(hazard.x, hazard.y, hazard.radius);

    // Lighter center
    g.fillStyle(0xaaeeff, alpha * 0.3);
    g.fillCircle(hazard.x, hazard.y, hazard.radius * 0.6);

    // White sparkles in center
    g.fillStyle(0xffffff, alpha * 0.5);
    g.fillCircle(hazard.x, hazard.y, hazard.radius * 0.3);

    // Edge
    g.lineStyle(2, 0xffffff, alpha * 0.8);
    g.strokeCircle(hazard.x, hazard.y, hazard.radius);

    // Ice crystal patterns
    this.drawIceCrystals(g, hazard.x, hazard.y, hazard.radius * 0.8, alpha);
  }

  /**
   * Draw ice crystal patterns
   */
  private drawIceCrystals(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, alpha: number): void {
    g.lineStyle(1, 0xffffff, alpha * 0.6);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const endX = cx + Math.cos(angle) * radius;
      const endY = cy + Math.sin(angle) * radius;

      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(endX, endY);
      g.strokePath();

      // Small branches
      const midX = cx + Math.cos(angle) * radius * 0.5;
      const midY = cy + Math.sin(angle) * radius * 0.5;
      const branchLen = radius * 0.2;

      g.beginPath();
      g.moveTo(midX, midY);
      g.lineTo(
        midX + Math.cos(angle + Math.PI / 4) * branchLen,
        midY + Math.sin(angle + Math.PI / 4) * branchLen
      );
      g.strokePath();

      g.beginPath();
      g.moveTo(midX, midY);
      g.lineTo(
        midX + Math.cos(angle - Math.PI / 4) * branchLen,
        midY + Math.sin(angle - Math.PI / 4) * branchLen
      );
      g.strokePath();
    }
  }

  /**
   * Draw lava crack (active)
   */
  private drawLavaCrack(g: Phaser.GameObjects.Graphics, hazard: IActiveHazard, time: number, fadeProgress: number): void {
    const alpha = (1 - fadeProgress * 0.5);
    const angle = hazard.angle || 0;
    const pulsePhase = time * 5;

    g.save();
    g.translateCanvas(hazard.x, hazard.y);
    g.rotateCanvas(angle);

    // Crack opening effect
    const openProgress = Math.min(1, (hazard.elapsed - hazard.warningDuration) / 0.5);
    const currentHeight = hazard.height * openProgress;

    // Dark crack
    g.fillStyle(0x220000, alpha);
    g.fillRect(-hazard.width / 2, -currentHeight / 2, hazard.width, currentHeight);

    // Lava glow
    const glowIntensity = 0.5 + Math.sin(pulsePhase) * 0.2;
    g.fillStyle(0xff4400, alpha * glowIntensity);
    g.fillRect(-hazard.width / 2 + 5, -currentHeight / 2 + 5, hazard.width - 10, currentHeight - 10);

    // Hot core
    g.fillStyle(0xffaa00, alpha * glowIntensity * 0.8);
    g.fillRect(-hazard.width / 2 + 15, -currentHeight / 2 + 10, hazard.width - 30, currentHeight - 20);

    // Edge glow
    g.lineStyle(3, 0xff6600, alpha * 0.8);
    g.strokeRect(-hazard.width / 2, -currentHeight / 2, hazard.width, currentHeight);

    g.restore();
  }

  /**
   * Draw meteor
   */
  private drawMeteor(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number): void {
    // Fire trail
    g.fillStyle(0xff6600, 0.5);
    g.fillCircle(x, y - radius, radius * 0.6);
    g.fillCircle(x, y - radius * 1.5, radius * 0.4);

    // Core
    g.fillStyle(0xff4400, 0.9);
    g.fillCircle(x, y, radius);

    // Hot center
    g.fillStyle(0xffaa00, 0.8);
    g.fillCircle(x, y, radius * 0.6);

    // White hot core
    g.fillStyle(0xffffaa, 0.6);
    g.fillCircle(x, y, radius * 0.3);
  }

  // ============================================
  // Collision Detection
  // ============================================

  /**
   * Check collisions for a hazard
   */
  private checkHazardCollisions(hazard: IActiveHazard): void {
    // Check player collision
    const playerPos = this.getPlayerPosition?.();
    if (playerPos && this.isInHazard(playerPos.x, playerPos.y, hazard)) {
      this.applyHazardEffect(hazard, true, -1);
    }

    // Check enemy collisions
    const enemies = this.getEnemyPositions?.() || [];
    for (const enemy of enemies) {
      if (this.isInHazard(enemy.x, enemy.y, hazard)) {
        this.applyHazardEffect(hazard, false, enemy.id);
      }
    }
  }

  /**
   * Check if a point is inside a hazard area
   */
  private isInHazard(x: number, y: number, hazard: IActiveHazard): boolean {
    if (hazard.type === HazardType.LavaCrack) {
      // Rotated rectangle collision
      const angle = hazard.angle || 0;
      const dx = x - hazard.x;
      const dy = y - hazard.y;

      // Rotate point to align with rectangle
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      const rotX = dx * cos - dy * sin;
      const rotY = dx * sin + dy * cos;

      return Math.abs(rotX) <= hazard.width / 2 && Math.abs(rotY) <= hazard.height / 2;
    }

    // Circle collision for other hazards
    const dist = Phaser.Math.Distance.Between(x, y, hazard.x, hazard.y);
    return dist <= hazard.radius;
  }

  /**
   * Apply hazard effect to target
   */
  private applyHazardEffect(hazard: IActiveHazard, isPlayer: boolean, entityId: number): void {
    switch (hazard.type) {
      case HazardType.ElectricZone:
      case HazardType.PoisonCloud:
      case HazardType.LavaCrack:
        // Deal damage
        if (isPlayer) {
          this.onPlayerDamage?.(hazard.damage, hazard.type);
        } else {
          this.onEnemyDamage?.(entityId, hazard.damage, hazard.type);
        }
        break;

      case HazardType.IcePatch:
        // Apply slow to player only
        if (isPlayer) {
          this.onPlayerSlow?.(0.5, DOT_TICK_RATE);
        }
        break;
    }
  }

  /**
   * Meteor impact
   */
  private meteorImpact(meteor: IMeteor): void {
    // Check player collision
    const playerPos = this.getPlayerPosition?.();
    if (playerPos) {
      const dist = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, meteor.targetX, meteor.targetY);
      if (dist <= meteor.radius) {
        this.onPlayerDamage?.(meteor.damage, HazardType.MeteorShower);
      }
    }

    // Check enemy collisions
    const enemies = this.getEnemyPositions?.() || [];
    for (const enemy of enemies) {
      const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, meteor.targetX, meteor.targetY);
      if (dist <= meteor.radius) {
        this.onEnemyDamage?.(enemy.id, meteor.damage, HazardType.MeteorShower);
      }
    }

    // Impact effect
    this.createImpactEffect(meteor);
  }

  /**
   * Create meteor impact effect
   */
  private createImpactEffect(meteor: IMeteor): void {
    // Camera shake
    this.scene.cameras.main.shake(150, 0.01);

    // Hide meteor, show explosion
    meteor.graphics.clear();

    // Explosion ring
    const explosionGraphics = this.scene.add.graphics();
    explosionGraphics.setDepth(50);

    let frame = 0;
    const maxFrames = 15;

    const animateExplosion = () => {
      explosionGraphics.clear();
      frame++;

      const progress = frame / maxFrames;
      const radius = meteor.radius * (1 + progress * 2);
      const alpha = 1 - progress;

      // Outer ring
      explosionGraphics.lineStyle(5, 0xff6600, alpha);
      explosionGraphics.strokeCircle(meteor.targetX, meteor.targetY, radius);

      // Inner flash
      explosionGraphics.fillStyle(0xffaa00, alpha * 0.5);
      explosionGraphics.fillCircle(meteor.targetX, meteor.targetY, radius * 0.5);

      if (frame < maxFrames) {
        this.scene.time.delayedCall(30, animateExplosion);
      } else {
        explosionGraphics.destroy();
      }
    };

    animateExplosion();

    // Clear shadow
    meteor.shadowGraphics.clear();
    meteor.warningGraphics?.clear();
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Destroy a hazard
   */
  private destroyHazard(id: string): void {
    const hazard = this.activeHazards.get(id);
    if (!hazard) return;

    hazard.graphics.destroy();
    hazard.warningGraphics?.destroy();
    hazard.particles?.destroy();

    this.activeHazards.delete(id);
  }

  /**
   * Destroy a meteor
   */
  private destroyMeteor(id: string): void {
    const meteor = this.activeMeteors.get(id);
    if (!meteor) return;

    meteor.graphics.destroy();
    meteor.shadowGraphics.destroy();
    meteor.warningGraphics?.destroy();

    this.activeMeteors.delete(id);
  }

  /**
   * Destroy all hazards
   */
  destroyAll(): void {
    for (const id of this.activeHazards.keys()) {
      this.destroyHazard(id);
    }

    for (const id of this.activeMeteors.keys()) {
      this.destroyMeteor(id);
    }

    this.spawnTimer = 0;
  }

  /**
   * Reset the system
   */
  reset(): void {
    this.destroyAll();
    this.hazardIdCounter = 0;
    this.meteorIdCounter = 0;
    this.currentWave = 0;
    this.enabled = true;
  }

  /**
   * Destroy the system
   */
  destroy(): void {
    this.destroyAll();
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Ease in quadratic
   */
  private easeInQuad(t: number): number {
    return t * t;
  }

  /**
   * Get active hazard count
   */
  getActiveHazardCount(): number {
    return this.activeHazards.size + this.activeMeteors.size;
  }

  /**
   * Check if player is in any ice patch (for external slow check)
   */
  isPlayerInIcePatch(): boolean {
    const playerPos = this.getPlayerPosition?.();
    if (!playerPos) return false;

    for (const hazard of this.activeHazards.values()) {
      if (hazard.type === HazardType.IcePatch && hazard.isActive) {
        if (this.isInHazard(playerPos.x, playerPos.y, hazard)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Force spawn a specific hazard type (for testing)
   */
  forceSpawnHazard(type: HazardType): void {
    const config = HAZARD_CONFIGS[type];
    if (config) {
      this.spawnHazard(config);
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let hazardSystemInstance: HazardSystem | null = null;

/**
 * Get or create hazard system instance
 */
export function getHazardSystem(scene: Phaser.Scene): HazardSystem {
  if (!hazardSystemInstance) {
    hazardSystemInstance = new HazardSystem(scene);
  }
  return hazardSystemInstance;
}

/**
 * Reset hazard system instance
 */
export function resetHazardSystem(): void {
  if (hazardSystemInstance) {
    hazardSystemInstance.destroy();
    hazardSystemInstance = null;
  }
}

export default HazardSystem;
