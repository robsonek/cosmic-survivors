/**
 * TrailEffects - Advanced trail and particle effects for visual polish.
 *
 * Features:
 * 1. Player Trail - Fading afterimages when moving fast/dashing
 * 2. Projectile Trails - Colored trails behind all projectiles
 * 3. Enemy Death - Explosion of particles in enemy color
 * 4. XP Absorption - Sparkle trail when XP flies to player
 * 5. Weapon Glow - Pulsing glow around active weapons
 * 6. Critical Hit - Star burst particles
 *
 * Uses Phaser particle emitters with object pooling for performance.
 */

import * as Phaser from 'phaser';
import { Position, Velocity } from '../shared/types/components';
import { BlendMode } from '../shared/interfaces/IRenderer';
import type { Renderer } from '../rendering/Renderer';
import type { TrailRenderer } from './TrailRenderer';

// ============================================
// Types and Interfaces
// ============================================

/**
 * Configuration for player afterimage trail.
 */
export interface PlayerTrailConfig {
  /** Number of afterimages to spawn */
  imageCount: number;
  /** Spacing between afterimages (in pixels) */
  spacing: number;
  /** Initial alpha for afterimages */
  alpha: number;
  /** Fade duration in ms */
  fadeDuration: number;
  /** Tint color for afterimages */
  tint: number;
  /** Scale decay per image (0-1) */
  scaleFalloff: number;
  /** Minimum speed to trigger trail (pixels/second) */
  speedThreshold: number;
}

/**
 * Configuration for projectile trails.
 */
export interface ProjectileTrailConfig {
  /** Trail color */
  color: number;
  /** Trail length in points */
  length: number;
  /** Trail width at head */
  width: number;
  /** Whether to emit particles along trail */
  emitParticles: boolean;
  /** Particle emit rate (per second) */
  particleRate: number;
}

/**
 * Configuration for enemy death explosion.
 */
export interface DeathExplosionConfig {
  /** Primary color (from enemy) */
  color: number;
  /** Number of particles */
  particleCount: number;
  /** Explosion radius */
  radius: number;
  /** Particle lifespan in ms */
  lifespan: number;
  /** Whether to spawn gibs */
  spawnGibs: boolean;
  /** Screen shake intensity */
  shakeIntensity: number;
}

/**
 * Configuration for XP absorption effect.
 */
export interface XPAbsorptionConfig {
  /** Sparkle color */
  color: number;
  /** Number of sparkle particles */
  sparkleCount: number;
  /** Trail persistence (0-1) */
  trailPersistence: number;
}

/**
 * Configuration for weapon glow effect.
 */
export interface WeaponGlowConfig {
  /** Glow color */
  color: number;
  /** Glow radius */
  radius: number;
  /** Pulse speed (Hz) */
  pulseSpeed: number;
  /** Minimum alpha during pulse */
  minAlpha: number;
  /** Maximum alpha during pulse */
  maxAlpha: number;
}

/**
 * Configuration for critical hit burst.
 */
export interface CriticalHitConfig {
  /** Star burst colors */
  colors: number[];
  /** Number of star particles */
  starCount: number;
  /** Burst radius */
  radius: number;
  /** Duration in ms */
  duration: number;
}

// ============================================
// Pooled Effect Types
// ============================================

interface PooledAfterimage {
  sprite: Phaser.GameObjects.Sprite | null;
  inUse: boolean;
  fadeTimer: number;
  fadeAlpha: number;
}

interface PooledParticle {
  graphics: Phaser.GameObjects.Graphics | null;
  inUse: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: number;
  size: number;
  alpha: number;
}

interface ActiveGlow {
  entity: number;
  graphics: Phaser.GameObjects.Graphics;
  config: WeaponGlowConfig;
  pulsePhase: number;
}

interface ActiveXPTrail {
  orbEntity: number;
  targetEntity: number;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter | null;
  particles: Phaser.GameObjects.Particles.ParticleEmitter | null;
}

// ============================================
// TrailEffects Class
// ============================================

/**
 * TrailEffects manages advanced visual effects for trails and particles.
 */
export class TrailEffects {
  /** Scene reference */
  private scene: Phaser.Scene | null = null;

  /** Trail renderer reference */
  private trailRenderer: TrailRenderer | null = null;

  /** Containers for different effect layers */
  private afterimageContainer: Phaser.GameObjects.Container | null = null;
  private particleContainer: Phaser.GameObjects.Container | null = null;
  private glowContainer: Phaser.GameObjects.Container | null = null;

  /** Object pools */
  private afterimagePool: PooledAfterimage[] = [];
  private particlePool: PooledParticle[] = [];

  /** Pool sizes */
  private readonly AFTERIMAGE_POOL_SIZE = 50;
  private readonly PARTICLE_POOL_SIZE = 200;

  /** Active effects tracking */
  private activeGlows: Map<number, ActiveGlow> = new Map();
  private activeXPTrails: Map<number, ActiveXPTrail> = new Map();
  private playerTrailActive: boolean = false;
  private playerLastPosition: { x: number; y: number } = { x: 0, y: 0 };
  private playerTrailEntity: number = -1;

  /** Default configurations */
  private defaultPlayerTrailConfig: PlayerTrailConfig = {
    imageCount: 5,
    spacing: 15,
    alpha: 0.6,
    fadeDuration: 200,
    tint: 0x00ffff,
    scaleFalloff: 0.9,
    speedThreshold: 300,
  };

  private defaultProjectileTrailConfig: ProjectileTrailConfig = {
    color: 0xffff00,
    length: 15,
    width: 3,
    emitParticles: true,
    particleRate: 30,
  };

  private defaultDeathExplosionConfig: DeathExplosionConfig = {
    color: 0xff6600,
    particleCount: 20,
    radius: 50,
    lifespan: 500,
    spawnGibs: false,
    shakeIntensity: 3,
  };

  private defaultXPAbsorptionConfig: XPAbsorptionConfig = {
    color: 0x00ff00,
    sparkleCount: 8,
    trailPersistence: 0.7,
  };

  private defaultWeaponGlowConfig: WeaponGlowConfig = {
    color: 0xffff00,
    radius: 20,
    pulseSpeed: 2,
    minAlpha: 0.2,
    maxAlpha: 0.6,
  };

  private defaultCriticalHitConfig: CriticalHitConfig = {
    colors: [0xffff00, 0xff8800, 0xffffff],
    starCount: 12,
    radius: 60,
    duration: 400,
  };

  constructor(renderer: Renderer, trailRenderer?: TrailRenderer) {
    this.scene = renderer.getScene();
    this.trailRenderer = trailRenderer ?? null;
    this.setupContainers();
    this.initializePools();
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Set up effect containers at appropriate depths.
   */
  private setupContainers(): void {
    if (!this.scene) return;

    // Afterimages behind entities
    this.afterimageContainer = this.scene.add.container(0, 0);
    this.afterimageContainer.setDepth(45);

    // Particles between entities and effects
    this.particleContainer = this.scene.add.container(0, 0);
    this.particleContainer.setDepth(65);

    // Glow effects around weapons
    this.glowContainer = this.scene.add.container(0, 0);
    this.glowContainer.setDepth(48);
  }

  /**
   * Initialize object pools for performance.
   */
  private initializePools(): void {
    // Initialize afterimage pool
    for (let i = 0; i < this.AFTERIMAGE_POOL_SIZE; i++) {
      this.afterimagePool.push({
        sprite: null,
        inUse: false,
        fadeTimer: 0,
        fadeAlpha: 1,
      });
    }

    // Initialize particle pool
    for (let i = 0; i < this.PARTICLE_POOL_SIZE; i++) {
      this.particlePool.push({
        graphics: null,
        inUse: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        lifetime: 0,
        maxLifetime: 1,
        color: 0xffffff,
        size: 4,
        alpha: 1,
      });
    }
  }

  // ============================================
  // 1. Player Trail (Afterimages)
  // ============================================

  /**
   * Start player afterimage trail effect.
   */
  startPlayerTrail(
    entity: number,
    textureKey: string,
    config: Partial<PlayerTrailConfig> = {}
  ): void {
    if (!this.scene) return;

    this.playerTrailActive = true;
    this.playerTrailEntity = entity;
    this.playerLastPosition = {
      x: Position.x[entity] ?? 0,
      y: Position.y[entity] ?? 0,
    };

    const fullConfig = { ...this.defaultPlayerTrailConfig, ...config };

    // Store config for update loop
    (this as Record<string, unknown>)._playerTrailConfig = fullConfig;
    (this as Record<string, unknown>)._playerTrailTexture = textureKey;
  }

  /**
   * Stop player trail effect.
   */
  stopPlayerTrail(): void {
    this.playerTrailActive = false;
    this.playerTrailEntity = -1;
  }

  /**
   * Spawn a dash trail with multiple afterimages.
   */
  spawnDashTrail(
    entity: number,
    textureKey: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    config: Partial<PlayerTrailConfig> = {}
  ): void {
    if (!this.scene || !this.afterimageContainer) return;

    const fullConfig = { ...this.defaultPlayerTrailConfig, ...config };
    const { imageCount, alpha, fadeDuration, tint, scaleFalloff } = fullConfig;

    for (let i = 0; i < imageCount; i++) {
      const t = i / Math.max(1, imageCount - 1);
      const x = Phaser.Math.Linear(startX, endX, t);
      const y = Phaser.Math.Linear(startY, endY, t);

      // Get pooled afterimage
      const pooled = this.getPooledAfterimage();
      if (!pooled) continue;

      // Create or reuse sprite
      if (!pooled.sprite) {
        pooled.sprite = this.scene.add.sprite(x, y, textureKey);
        this.afterimageContainer.add(pooled.sprite);
      } else {
        pooled.sprite.setTexture(textureKey);
        pooled.sprite.setPosition(x, y);
        pooled.sprite.setVisible(true);
      }

      const imageAlpha = alpha * (1 - t * 0.6);
      const scale = Math.pow(scaleFalloff, i) * 0.8;

      pooled.sprite.setAlpha(imageAlpha);
      pooled.sprite.setScale(scale);
      pooled.sprite.setTint(tint);
      pooled.sprite.setBlendMode(Phaser.BlendModes.ADD);

      pooled.inUse = true;
      pooled.fadeTimer = fadeDuration;
      pooled.fadeAlpha = imageAlpha;

      // Add rotation matching player
      const angle = Math.atan2(endY - startY, endX - startX);
      pooled.sprite.setRotation(angle + Math.PI / 2);
    }
  }

  /**
   * Get an available afterimage from the pool.
   */
  private getPooledAfterimage(): PooledAfterimage | null {
    for (const pooled of this.afterimagePool) {
      if (!pooled.inUse) {
        return pooled;
      }
    }
    return null;
  }

  // ============================================
  // 2. Projectile Trails
  // ============================================

  /**
   * Create a colored trail for a projectile.
   */
  createProjectileTrail(
    entity: number,
    config: Partial<ProjectileTrailConfig> = {}
  ): void {
    if (!this.trailRenderer) return;

    const fullConfig = { ...this.defaultProjectileTrailConfig, ...config };

    this.trailRenderer.createTrail(entity, {
      length: fullConfig.length,
      width: fullConfig.width,
      tailWidth: 0,
      color: fullConfig.color,
      alpha: 0.8,
      alphaEnd: 0,
      blendMode: BlendMode.Add,
      minDistance: 3,
      emitParticles: fullConfig.emitParticles,
    });

    // If emitting particles, set up particle emission
    if (fullConfig.emitParticles && this.scene) {
      this.setupProjectileParticles(entity, fullConfig);
    }
  }

  /**
   * Set up particle emission along projectile trail.
   */
  private setupProjectileParticles(
    entity: number,
    config: ProjectileTrailConfig
  ): void {
    if (!this.scene) return;

    // Store particle emission data for update loop
    const emissionData = {
      entity,
      config,
      lastEmitTime: 0,
      emitInterval: 1000 / config.particleRate,
    };

    (this as Record<string, unknown>)._projectileParticles =
      (this as Record<string, unknown>)._projectileParticles || new Map();
    ((this as Record<string, unknown>)._projectileParticles as Map<
      number,
      typeof emissionData
    >).set(entity, emissionData);
  }

  /**
   * Remove projectile trail.
   */
  removeProjectileTrail(entity: number): void {
    if (this.trailRenderer) {
      this.trailRenderer.fadeOutTrail(entity);
    }

    const projectileParticles = (this as Record<string, unknown>)
      ._projectileParticles as Map<number, unknown> | undefined;
    if (projectileParticles) {
      projectileParticles.delete(entity);
    }
  }

  // ============================================
  // 3. Enemy Death Explosion
  // ============================================

  /**
   * Spawn death explosion particles at position.
   */
  spawnDeathExplosion(
    x: number,
    y: number,
    config: Partial<DeathExplosionConfig> = {}
  ): void {
    if (!this.scene || !this.particleContainer) return;

    const fullConfig = { ...this.defaultDeathExplosionConfig, ...config };
    const { color, particleCount, radius, lifespan, spawnGibs } = fullConfig;

    // Extract RGB components for color variation
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Spawn explosion particles
    for (let i = 0; i < particleCount; i++) {
      const pooled = this.getPooledParticle();
      if (!pooled) continue;

      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 100 + Math.random() * 200;
      const size = 3 + Math.random() * 5;

      // Vary color slightly
      const colorVariation = 0.2;
      const vr = Math.floor(r * (1 - colorVariation + Math.random() * colorVariation * 2));
      const vg = Math.floor(g * (1 - colorVariation + Math.random() * colorVariation * 2));
      const vb = Math.floor(b * (1 - colorVariation + Math.random() * colorVariation * 2));
      const variedColor = (vr << 16) | (vg << 8) | vb;

      pooled.x = x;
      pooled.y = y;
      pooled.vx = Math.cos(angle) * speed;
      pooled.vy = Math.sin(angle) * speed;
      pooled.lifetime = lifespan;
      pooled.maxLifetime = lifespan;
      pooled.color = variedColor;
      pooled.size = size;
      pooled.alpha = 1;
      pooled.inUse = true;

      if (!pooled.graphics) {
        pooled.graphics = this.scene.add.graphics();
        this.particleContainer.add(pooled.graphics);
      }
    }

    // Spawn gibs (larger debris pieces) if enabled
    if (spawnGibs) {
      this.spawnGibs(x, y, color, Math.floor(particleCount / 4));
    }

    // Add central flash
    this.spawnFlashParticle(x, y, color, radius * 0.8, 150);
  }

  /**
   * Spawn debris gibs for death effect.
   */
  private spawnGibs(
    x: number,
    y: number,
    color: number,
    count: number
  ): void {
    if (!this.scene || !this.particleContainer) return;

    for (let i = 0; i < count; i++) {
      const pooled = this.getPooledParticle();
      if (!pooled) continue;

      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;

      pooled.x = x;
      pooled.y = y;
      pooled.vx = Math.cos(angle) * speed;
      pooled.vy = Math.sin(angle) * speed + 50; // Gravity bias
      pooled.lifetime = 800;
      pooled.maxLifetime = 800;
      pooled.color = this.darkenColor(color, 0.3);
      pooled.size = 8 + Math.random() * 6;
      pooled.alpha = 1;
      pooled.inUse = true;

      if (!pooled.graphics) {
        pooled.graphics = this.scene.add.graphics();
        this.particleContainer.add(pooled.graphics);
      }
    }
  }

  /**
   * Spawn a flash particle (expanding circle).
   */
  private spawnFlashParticle(
    x: number,
    y: number,
    color: number,
    maxRadius: number,
    duration: number
  ): void {
    if (!this.scene) return;

    const flash = this.scene.add.graphics();
    flash.setDepth(66);

    let elapsed = 0;
    const startTime = this.scene.time.now;

    const updateFlash = () => {
      elapsed = this.scene!.time.now - startTime;
      const progress = Math.min(1, elapsed / duration);

      flash.clear();

      if (progress >= 1) {
        flash.destroy();
        return;
      }

      const radius = maxRadius * progress;
      const alpha = (1 - progress) * 0.8;

      // Outer ring
      flash.lineStyle(4, color, alpha);
      flash.strokeCircle(x, y, radius);

      // Inner fill
      flash.fillStyle(color, alpha * 0.3);
      flash.fillCircle(x, y, radius * 0.7);

      this.scene!.time.delayedCall(16, updateFlash);
    };

    updateFlash();
  }

  /**
   * Get an available particle from the pool.
   */
  private getPooledParticle(): PooledParticle | null {
    for (const pooled of this.particlePool) {
      if (!pooled.inUse) {
        return pooled;
      }
    }
    return null;
  }

  // ============================================
  // 4. XP Absorption Trail
  // ============================================

  /**
   * Start XP absorption sparkle effect.
   */
  startXPAbsorption(
    orbEntity: number,
    targetEntity: number,
    config: Partial<XPAbsorptionConfig> = {}
  ): void {
    if (!this.scene) return;

    const fullConfig = { ...this.defaultXPAbsorptionConfig, ...config };

    // Create sparkle particle emitter following the orb
    const orbX = Position.x[orbEntity] ?? 0;
    const orbY = Position.y[orbEntity] ?? 0;

    const particles = this.scene.add.particles(orbX, orbY, 'star', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      quantity: 1,
      frequency: 50,
      blendMode: Phaser.BlendModes.ADD,
      tint: fullConfig.color,
    });

    particles.setDepth(62);

    const trail: ActiveXPTrail = {
      orbEntity,
      targetEntity,
      emitter: particles as unknown as Phaser.GameObjects.Particles.ParticleEmitter,
      particles,
    };

    this.activeXPTrails.set(orbEntity, trail);
  }

  /**
   * Stop XP absorption effect.
   */
  stopXPAbsorption(orbEntity: number): void {
    const trail = this.activeXPTrails.get(orbEntity);
    if (trail) {
      if (trail.emitter) {
        trail.emitter.stop();
      }
      if (trail.particles) {
        this.scene?.time.delayedCall(500, () => {
          trail.particles?.destroy();
        });
      }
      this.activeXPTrails.delete(orbEntity);
    }
  }

  /**
   * Play XP collection burst effect at position.
   */
  playXPCollectBurst(x: number, y: number, value: number): void {
    if (!this.scene) return;

    const particleCount = Math.min(20, 5 + Math.floor(value / 10));
    const color = value > 30 ? 0x00ffff : 0x00ff00;

    // Burst particles upward
    const particles = this.scene.add.particles(x, y, 'star', {
      speed: { min: 50, max: 150 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      quantity: particleCount,
      blendMode: Phaser.BlendModes.ADD,
      tint: color,
      gravityY: -100,
    });

    particles.setDepth(63);
    particles.explode(particleCount);

    this.scene.time.delayedCall(600, () => particles.destroy());
  }

  // ============================================
  // 5. Weapon Glow Effect
  // ============================================

  /**
   * Add pulsing glow effect to an entity (weapon).
   */
  addWeaponGlow(
    entity: number,
    config: Partial<WeaponGlowConfig> = {}
  ): void {
    if (!this.scene || !this.glowContainer) return;

    // Remove existing glow if any
    this.removeWeaponGlow(entity);

    const fullConfig = { ...this.defaultWeaponGlowConfig, ...config };

    const graphics = this.scene.add.graphics();
    graphics.setBlendMode(Phaser.BlendModes.ADD);
    this.glowContainer.add(graphics);

    const glow: ActiveGlow = {
      entity,
      graphics,
      config: fullConfig,
      pulsePhase: 0,
    };

    this.activeGlows.set(entity, glow);
  }

  /**
   * Remove weapon glow from entity.
   */
  removeWeaponGlow(entity: number): void {
    const glow = this.activeGlows.get(entity);
    if (glow) {
      glow.graphics.destroy();
      this.activeGlows.delete(entity);
    }
  }

  /**
   * Update weapon glow at position (can be used without entity).
   */
  updateWeaponGlowPosition(
    x: number,
    y: number,
    glowGraphics: Phaser.GameObjects.Graphics,
    config: WeaponGlowConfig,
    phase: number
  ): void {
    const { color, radius, minAlpha, maxAlpha } = config;

    // Calculate pulsing alpha
    const pulseValue = (Math.sin(phase) + 1) / 2;
    const alpha = minAlpha + (maxAlpha - minAlpha) * pulseValue;

    glowGraphics.clear();

    // Draw glow rings
    const rings = 4;
    for (let i = rings; i > 0; i--) {
      const ringRadius = (radius * i) / rings;
      const ringAlpha = alpha * (1 - i / (rings + 1));

      glowGraphics.fillStyle(color, ringAlpha * 0.3);
      glowGraphics.fillCircle(x, y, ringRadius);

      glowGraphics.lineStyle(2, color, ringAlpha);
      glowGraphics.strokeCircle(x, y, ringRadius);
    }

    // Core glow
    glowGraphics.fillStyle(0xffffff, alpha * 0.5);
    glowGraphics.fillCircle(x, y, radius * 0.2);
  }

  // ============================================
  // 6. Critical Hit Star Burst
  // ============================================

  /**
   * Play critical hit star burst effect.
   */
  playCriticalHitBurst(
    x: number,
    y: number,
    config: Partial<CriticalHitConfig> = {}
  ): void {
    if (!this.scene) return;

    const fullConfig = { ...this.defaultCriticalHitConfig, ...config };
    const { colors, starCount, radius, duration } = fullConfig;

    // Create star burst particles
    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const color = colors[i % colors.length];
      const speed = radius / (duration / 1000);

      this.spawnStarParticle(
        x,
        y,
        angle,
        speed,
        color,
        duration
      );
    }

    // Central flash
    this.spawnCritFlash(x, y, colors[0], radius * 0.6, duration * 0.4);

    // Screen impact text effect (CRIT!)
    this.spawnCritText(x, y - 20);
  }

  /**
   * Spawn a star-shaped particle for critical hit.
   */
  private spawnStarParticle(
    x: number,
    y: number,
    angle: number,
    speed: number,
    color: number,
    duration: number
  ): void {
    if (!this.scene) return;

    const star = this.scene.add.graphics();
    star.setDepth(70);

    let elapsed = 0;
    const startTime = this.scene.time.now;

    const updateStar = () => {
      elapsed = this.scene!.time.now - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress >= 1) {
        star.destroy();
        return;
      }

      const distance = speed * (duration / 1000) * progress;
      const currentX = x + Math.cos(angle) * distance;
      const currentY = y + Math.sin(angle) * distance;
      const alpha = 1 - progress;
      const size = (1 - progress * 0.5) * 6;

      star.clear();
      star.fillStyle(color, alpha);

      // Draw 4-pointed star
      this.drawStar(star, currentX, currentY, size, 4);

      this.scene!.time.delayedCall(16, updateStar);
    };

    updateStar();
  }

  /**
   * Draw a star shape on graphics object.
   */
  private drawStar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
    points: number
  ): void {
    const innerRadius = size * 0.4;
    const outerRadius = size;

    graphics.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;

      if (i === 0) {
        graphics.moveTo(px, py);
      } else {
        graphics.lineTo(px, py);
      }
    }

    graphics.closePath();
    graphics.fillPath();
  }

  /**
   * Spawn critical hit flash effect.
   */
  private spawnCritFlash(
    x: number,
    y: number,
    color: number,
    maxRadius: number,
    duration: number
  ): void {
    if (!this.scene) return;

    const flash = this.scene.add.graphics();
    flash.setDepth(69);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    let elapsed = 0;
    const startTime = this.scene.time.now;

    const updateFlash = () => {
      elapsed = this.scene!.time.now - startTime;
      const progress = Math.min(1, elapsed / duration);

      flash.clear();

      if (progress >= 1) {
        flash.destroy();
        return;
      }

      // Expanding ring
      const radius = maxRadius * progress;
      const alpha = (1 - progress) * 0.9;

      flash.lineStyle(6, color, alpha);
      flash.strokeCircle(x, y, radius);

      flash.lineStyle(3, 0xffffff, alpha * 0.8);
      flash.strokeCircle(x, y, radius * 0.8);

      this.scene!.time.delayedCall(16, updateFlash);
    };

    updateFlash();
  }

  /**
   * Spawn "CRIT!" text effect.
   */
  private spawnCritText(x: number, y: number): void {
    if (!this.scene) return;

    const text = this.scene.add.text(x, y, 'CRIT!', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffff00',
      stroke: '#ff6600',
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    text.setDepth(71);
    text.setScale(0);

    // Pop-in animation
    this.scene.tweens.add({
      targets: text,
      scale: { from: 0, to: 1.2 },
      duration: 100,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Float up and fade
        this.scene!.tweens.add({
          targets: text,
          y: y - 40,
          alpha: 0,
          scale: 0.8,
          duration: 400,
          ease: 'Cubic.easeOut',
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update all trail effects.
   */
  update(dt: number): void {
    this.updateAfterimages(dt);
    this.updateParticles(dt);
    this.updateGlows(dt);
    this.updateXPTrails();
    this.updatePlayerTrail(dt);
    this.updateProjectileParticles(dt);
  }

  /**
   * Update afterimage pool.
   */
  private updateAfterimages(dt: number): void {
    for (const pooled of this.afterimagePool) {
      if (!pooled.inUse || !pooled.sprite) continue;

      pooled.fadeTimer -= dt * 1000;

      if (pooled.fadeTimer <= 0) {
        pooled.sprite.setVisible(false);
        pooled.inUse = false;
      } else {
        const progress = pooled.fadeTimer / 200; // Assuming 200ms fade
        pooled.sprite.setAlpha(pooled.fadeAlpha * progress);
      }
    }
  }

  /**
   * Update particle pool.
   */
  private updateParticles(dt: number): void {
    const gravity = 300;

    for (const pooled of this.particlePool) {
      if (!pooled.inUse || !pooled.graphics) continue;

      // Update physics
      pooled.vy += gravity * dt;
      pooled.x += pooled.vx * dt;
      pooled.y += pooled.vy * dt;
      pooled.lifetime -= dt * 1000;

      if (pooled.lifetime <= 0) {
        pooled.graphics.clear();
        pooled.inUse = false;
      } else {
        const progress = pooled.lifetime / pooled.maxLifetime;
        pooled.alpha = progress;

        pooled.graphics.clear();
        pooled.graphics.fillStyle(pooled.color, pooled.alpha);
        pooled.graphics.fillCircle(pooled.x, pooled.y, pooled.size * progress);
      }
    }
  }

  /**
   * Update weapon glows.
   */
  private updateGlows(dt: number): void {
    for (const [entity, glow] of this.activeGlows) {
      const x = Position.x[entity];
      const y = Position.y[entity];

      if (x === undefined || y === undefined) {
        this.removeWeaponGlow(entity);
        continue;
      }

      glow.pulsePhase += glow.config.pulseSpeed * dt * Math.PI * 2;
      this.updateWeaponGlowPosition(
        x,
        y,
        glow.graphics,
        glow.config,
        glow.pulsePhase
      );
    }
  }

  /**
   * Update XP absorption trails.
   */
  private updateXPTrails(): void {
    for (const [orbEntity, trail] of this.activeXPTrails) {
      const x = Position.x[orbEntity];
      const y = Position.y[orbEntity];

      if (x === undefined || y === undefined) {
        this.stopXPAbsorption(orbEntity);
        continue;
      }

      if (trail.emitter) {
        trail.emitter.setPosition(x, y);
      }
    }
  }

  /**
   * Update player trail spawning.
   */
  private updatePlayerTrail(_dt: number): void {
    if (!this.playerTrailActive || this.playerTrailEntity < 0) return;

    const config = (this as Record<string, unknown>)._playerTrailConfig as
      | PlayerTrailConfig
      | undefined;
    const textureKey = (this as Record<string, unknown>)._playerTrailTexture as
      | string
      | undefined;

    if (!config || !textureKey) return;

    const entity = this.playerTrailEntity;
    const x = Position.x[entity];
    const y = Position.y[entity];

    if (x === undefined || y === undefined) return;

    // Calculate speed
    const vx = Velocity.x[entity] ?? 0;
    const vy = Velocity.y[entity] ?? 0;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Only spawn if moving fast enough
    if (speed >= config.speedThreshold) {
      const dist = Phaser.Math.Distance.Between(
        this.playerLastPosition.x,
        this.playerLastPosition.y,
        x,
        y
      );

      if (dist >= config.spacing) {
        this.spawnSingleAfterimage(
          x,
          y,
          textureKey,
          config
        );
        this.playerLastPosition = { x, y };
      }
    }
  }

  /**
   * Spawn a single afterimage at position.
   */
  private spawnSingleAfterimage(
    x: number,
    y: number,
    textureKey: string,
    config: PlayerTrailConfig
  ): void {
    if (!this.scene || !this.afterimageContainer) return;

    const pooled = this.getPooledAfterimage();
    if (!pooled) return;

    if (!pooled.sprite) {
      pooled.sprite = this.scene.add.sprite(x, y, textureKey);
      this.afterimageContainer.add(pooled.sprite);
    } else {
      pooled.sprite.setTexture(textureKey);
      pooled.sprite.setPosition(x, y);
      pooled.sprite.setVisible(true);
    }

    pooled.sprite.setAlpha(config.alpha);
    pooled.sprite.setScale(config.scaleFalloff);
    pooled.sprite.setTint(config.tint);
    pooled.sprite.setBlendMode(Phaser.BlendModes.ADD);

    pooled.inUse = true;
    pooled.fadeTimer = config.fadeDuration;
    pooled.fadeAlpha = config.alpha;
  }

  /**
   * Update projectile particle emission.
   */
  private updateProjectileParticles(dt: number): void {
    const projectileParticles = (this as Record<string, unknown>)
      ._projectileParticles as
      | Map<
          number,
          {
            entity: number;
            config: ProjectileTrailConfig;
            lastEmitTime: number;
            emitInterval: number;
          }
        >
      | undefined;

    if (!projectileParticles || !this.scene) return;

    const now = this.scene.time.now;

    for (const [entity, data] of projectileParticles) {
      const x = Position.x[entity];
      const y = Position.y[entity];

      if (x === undefined || y === undefined) {
        projectileParticles.delete(entity);
        continue;
      }

      if (now - data.lastEmitTime >= data.emitInterval) {
        data.lastEmitTime = now;
        this.spawnTrailParticle(x, y, data.config.color);
      }
    }
  }

  /**
   * Spawn a small trail particle.
   */
  private spawnTrailParticle(x: number, y: number, color: number): void {
    const pooled = this.getPooledParticle();
    if (!pooled) return;

    pooled.x = x;
    pooled.y = y;
    pooled.vx = (Math.random() - 0.5) * 20;
    pooled.vy = (Math.random() - 0.5) * 20;
    pooled.lifetime = 200;
    pooled.maxLifetime = 200;
    pooled.color = color;
    pooled.size = 2 + Math.random() * 2;
    pooled.alpha = 0.8;
    pooled.inUse = true;

    if (!pooled.graphics && this.scene && this.particleContainer) {
      pooled.graphics = this.scene.add.graphics();
      this.particleContainer.add(pooled.graphics);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Darken a color by a factor.
   */
  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - factor));
    const b = Math.floor((color & 0xff) * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Get active afterimage count.
   */
  getActiveAfterimageCount(): number {
    return this.afterimagePool.filter((p) => p.inUse).length;
  }

  /**
   * Get active particle count.
   */
  getActiveParticleCount(): number {
    return this.particlePool.filter((p) => p.inUse).length;
  }

  /**
   * Clear all active effects.
   */
  clearAll(): void {
    // Clear afterimages
    for (const pooled of this.afterimagePool) {
      if (pooled.sprite) {
        pooled.sprite.setVisible(false);
      }
      pooled.inUse = false;
    }

    // Clear particles
    for (const pooled of this.particlePool) {
      if (pooled.graphics) {
        pooled.graphics.clear();
      }
      pooled.inUse = false;
    }

    // Clear glows
    for (const glow of this.activeGlows.values()) {
      glow.graphics.destroy();
    }
    this.activeGlows.clear();

    // Clear XP trails
    for (const trail of this.activeXPTrails.values()) {
      trail.emitter?.stop();
      trail.particles?.destroy();
    }
    this.activeXPTrails.clear();

    // Clear player trail
    this.stopPlayerTrail();
  }

  /**
   * Pause all effects.
   */
  pause(): void {
    // XP trails
    for (const trail of this.activeXPTrails.values()) {
      trail.emitter?.pause();
    }
  }

  /**
   * Resume all effects.
   */
  resume(): void {
    // XP trails
    for (const trail of this.activeXPTrails.values()) {
      trail.emitter?.resume();
    }
  }

  /**
   * Destroy trail effects and clean up resources.
   */
  destroy(): void {
    this.clearAll();

    // Destroy pool objects
    for (const pooled of this.afterimagePool) {
      pooled.sprite?.destroy();
    }
    this.afterimagePool = [];

    for (const pooled of this.particlePool) {
      pooled.graphics?.destroy();
    }
    this.particlePool = [];

    // Destroy containers
    this.afterimageContainer?.destroy();
    this.particleContainer?.destroy();
    this.glowContainer?.destroy();

    this.afterimageContainer = null;
    this.particleContainer = null;
    this.glowContainer = null;
  }
}
