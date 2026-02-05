/**
 * PowerUpSystem - Handles temporary power-up drops and effects.
 *
 * Power-ups drop from enemies with 5% chance and provide temporary buffs:
 * 1. Double Damage - 2x damage multiplier (red aura)
 * 2. Speed Boost - 50% faster movement (blue trail)
 * 3. Invincibility - Cannot take damage (golden glow)
 * 4. Magnet - 5x pickup radius (green pulse)
 * 5. Multi-Shot - +3 additional projectiles (purple sparks)
 * 6. Rapid Fire - 2x fire rate (orange flames)
 *
 * Features:
 * - Visual indicators for active power-ups
 * - Timer-based duration (default 10 seconds)
 * - Stacking logic (refreshes duration, doesn't stack multipliers)
 * - HUD integration for showing active power-ups
 */

import * as Phaser from 'phaser';

/**
 * Power-up type enumeration.
 */
export enum PowerUpType {
  DoubleDamage = 'double_damage',
  SpeedBoost = 'speed_boost',
  Invincibility = 'invincibility',
  Magnet = 'magnet',
  MultiShot = 'multi_shot',
  RapidFire = 'rapid_fire',
}

/**
 * Power-up definition with visual and gameplay properties.
 */
export interface IPowerUpDefinition {
  type: PowerUpType;
  name: string;
  description: string;
  duration: number; // seconds
  color: number;
  icon: string;
  effectType: 'aura' | 'trail' | 'glow' | 'pulse' | 'sparks' | 'flames';
}

/**
 * Active power-up state.
 */
export interface IActivePowerUp {
  type: PowerUpType;
  remainingTime: number;
  duration: number;
  visualEffect?: Phaser.GameObjects.Graphics | Phaser.GameObjects.Particles.ParticleEmitter;
}

/**
 * Power-up pickup entity.
 */
export interface IPowerUpPickup extends Phaser.GameObjects.Sprite {
  powerUpType: PowerUpType;
  lifetime: number;
  bobOffset: number;
}

/**
 * Power-up multipliers applied to player stats.
 */
export interface IPowerUpMultipliers {
  damageMultiplier: number;
  speedMultiplier: number;
  isInvincible: boolean;
  magnetMultiplier: number;
  additionalProjectiles: number;
  fireRateMultiplier: number;
}

/**
 * Power-up definitions.
 */
export const POWER_UP_DEFINITIONS: Record<PowerUpType, IPowerUpDefinition> = {
  [PowerUpType.DoubleDamage]: {
    type: PowerUpType.DoubleDamage,
    name: 'Double Damage',
    description: '2x damage for 10 seconds',
    duration: 10,
    color: 0xff4444,
    icon: 'powerup_damage',
    effectType: 'aura',
  },
  [PowerUpType.SpeedBoost]: {
    type: PowerUpType.SpeedBoost,
    name: 'Speed Boost',
    description: '+50% movement speed for 10 seconds',
    duration: 10,
    color: 0x4488ff,
    icon: 'powerup_speed',
    effectType: 'trail',
  },
  [PowerUpType.Invincibility]: {
    type: PowerUpType.Invincibility,
    name: 'Invincibility',
    description: 'Cannot take damage for 10 seconds',
    duration: 10,
    color: 0xffdd00,
    icon: 'powerup_invincible',
    effectType: 'glow',
  },
  [PowerUpType.Magnet]: {
    type: PowerUpType.Magnet,
    name: 'Magnet',
    description: '5x pickup radius for 10 seconds',
    duration: 10,
    color: 0x44ff44,
    icon: 'powerup_magnet',
    effectType: 'pulse',
  },
  [PowerUpType.MultiShot]: {
    type: PowerUpType.MultiShot,
    name: 'Multi-Shot',
    description: '+3 projectiles for 10 seconds',
    duration: 10,
    color: 0xaa44ff,
    icon: 'powerup_multishot',
    effectType: 'sparks',
  },
  [PowerUpType.RapidFire]: {
    type: PowerUpType.RapidFire,
    name: 'Rapid Fire',
    description: '2x fire rate for 10 seconds',
    duration: 10,
    color: 0xff8800,
    icon: 'powerup_rapidfire',
    effectType: 'flames',
  },
};

/**
 * Drop chance for power-ups (5%).
 */
export const POWER_UP_DROP_CHANCE = 0.05;

/**
 * Pickup lifetime in seconds before despawning.
 */
export const POWER_UP_LIFETIME = 15;

/**
 * Pickup collection radius.
 */
export const POWER_UP_COLLECT_RADIUS = 40;

/**
 * PowerUpSystem class.
 */
export class PowerUpSystem {
  private scene: Phaser.Scene | null = null;

  // Active power-ups on the player
  private activePowerUps: Map<PowerUpType, IActivePowerUp> = new Map();

  // Power-up pickups in the world
  private pickups: IPowerUpPickup[] = [];

  // Visual effect graphics/particles for active power-ups
  private effectGraphics: Map<PowerUpType, Phaser.GameObjects.Graphics> = new Map();
  private effectParticles: Map<PowerUpType, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();

  // HUD elements
  private hudContainer: Phaser.GameObjects.Container | null = null;
  private hudIcons: Map<PowerUpType, { icon: Phaser.GameObjects.Graphics; timer: Phaser.GameObjects.Text }> = new Map();

  // Reference to player sprite for visual effects
  private playerSprite: Phaser.GameObjects.Sprite | null = null;

  /**
   * Initialize the power-up system with the scene.
   */
  init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.reset();
  }

  /**
   * Set the player sprite for visual effects.
   */
  setPlayer(player: Phaser.GameObjects.Sprite): void {
    this.playerSprite = player;
  }

  /**
   * Reset the system state.
   */
  reset(): void {
    // Clear active power-ups
    this.activePowerUps.clear();

    // Destroy pickups
    for (const pickup of this.pickups) {
      if (pickup && pickup.active) {
        pickup.destroy();
      }
    }
    this.pickups = [];

    // Clear visual effects
    for (const graphics of this.effectGraphics.values()) {
      if (graphics && graphics.active) {
        graphics.destroy();
      }
    }
    this.effectGraphics.clear();

    for (const particles of this.effectParticles.values()) {
      if (particles) {
        particles.stop();
      }
    }
    this.effectParticles.clear();

    // Clear HUD
    this.destroyHUD();
  }

  /**
   * Create the HUD for displaying active power-ups.
   */
  createHUD(x: number, y: number): void {
    if (!this.scene) return;

    this.hudContainer = this.scene.add.container(x, y);
    this.hudContainer.setScrollFactor(0);
    this.hudContainer.setDepth(100);
  }

  /**
   * Destroy the HUD.
   */
  private destroyHUD(): void {
    if (this.hudContainer) {
      this.hudContainer.destroy();
      this.hudContainer = null;
    }
    this.hudIcons.clear();
  }

  /**
   * Update the power-up system.
   * @param dt Delta time in seconds
   * @param playerX Player X position
   * @param playerY Player Y position
   */
  update(dt: number, playerX: number, playerY: number): void {
    if (!this.scene) return;

    // Update active power-ups (tick down timers)
    this.updateActivePowerUps(dt);

    // Update pickups (collection, lifetime, visuals)
    this.updatePickups(dt, playerX, playerY);

    // Update visual effects
    this.updateVisualEffects(playerX, playerY);

    // Update HUD
    this.updateHUD();
  }

  /**
   * Update active power-up timers.
   */
  private updateActivePowerUps(dt: number): void {
    const toRemove: PowerUpType[] = [];

    for (const [type, powerUp] of this.activePowerUps) {
      powerUp.remainingTime -= dt;

      if (powerUp.remainingTime <= 0) {
        toRemove.push(type);
      }
    }

    // Remove expired power-ups
    for (const type of toRemove) {
      this.deactivatePowerUp(type);
    }
  }

  /**
   * Update power-up pickups.
   */
  private updatePickups(dt: number, playerX: number, playerY: number): void {
    if (!this.scene) return;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];

      if (!pickup || !pickup.active) {
        this.pickups.splice(i, 1);
        continue;
      }

      // Update lifetime
      pickup.lifetime -= dt;
      if (pickup.lifetime <= 0) {
        // Fade out and remove
        this.scene.tweens.add({
          targets: pickup,
          alpha: 0,
          scale: 0,
          duration: 200,
          onComplete: () => pickup.destroy(),
        });
        this.pickups.splice(i, 1);
        continue;
      }

      // Bobbing animation
      pickup.bobOffset += dt * 4;
      pickup.y += Math.sin(pickup.bobOffset) * 0.5;

      // Pulsing scale near expiration
      if (pickup.lifetime < 3) {
        const pulse = 0.8 + Math.sin(pickup.lifetime * 10) * 0.2;
        pickup.setScale(pulse);
      }

      // Check collection
      const dist = Phaser.Math.Distance.Between(playerX, playerY, pickup.x, pickup.y);
      if (dist < POWER_UP_COLLECT_RADIUS) {
        this.collectPowerUp(pickup);
        this.pickups.splice(i, 1);
      }
    }
  }

  /**
   * Update visual effects for active power-ups.
   */
  private updateVisualEffects(playerX: number, playerY: number): void {
    if (!this.scene || !this.playerSprite) return;

    for (const [type, powerUp] of this.activePowerUps) {
      const definition = POWER_UP_DEFINITIONS[type];

      // Update graphics-based effects
      const graphics = this.effectGraphics.get(type);
      if (graphics && graphics.active) {
        graphics.clear();
        this.drawEffect(graphics, definition, playerX, playerY, powerUp.remainingTime);
      }
    }
  }

  /**
   * Draw visual effect based on type.
   */
  private drawEffect(
    graphics: Phaser.GameObjects.Graphics,
    definition: IPowerUpDefinition,
    x: number,
    y: number,
    time: number
  ): void {
    const alpha = 0.3 + Math.sin(time * 5) * 0.2;
    const pulseScale = 1 + Math.sin(time * 3) * 0.1;

    switch (definition.effectType) {
      case 'aura': // Red aura for Double Damage
        graphics.fillStyle(definition.color, alpha * 0.3);
        graphics.fillCircle(x, y, 50 * pulseScale);
        graphics.lineStyle(3, definition.color, alpha);
        graphics.strokeCircle(x, y, 50 * pulseScale);
        graphics.lineStyle(2, definition.color, alpha * 0.5);
        graphics.strokeCircle(x, y, 40 * pulseScale);
        break;

      case 'trail': // Blue trail for Speed Boost - handled by particles
        graphics.lineStyle(2, definition.color, alpha);
        for (let i = 0; i < 3; i++) {
          const offset = i * 15;
          graphics.strokeCircle(x - offset * 0.3, y, 20 - i * 5);
        }
        break;

      case 'glow': // Golden glow for Invincibility
        graphics.fillStyle(definition.color, alpha * 0.2);
        graphics.fillCircle(x, y, 45 * pulseScale);
        graphics.fillStyle(0xffffff, alpha * 0.1);
        graphics.fillCircle(x, y, 35 * pulseScale);
        graphics.lineStyle(4, definition.color, alpha);
        graphics.strokeCircle(x, y, 45 * pulseScale);
        // Inner radial lines
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + time * 2;
          const innerR = 20;
          const outerR = 45 * pulseScale;
          graphics.lineStyle(2, definition.color, alpha * 0.5);
          graphics.lineBetween(
            x + Math.cos(angle) * innerR,
            y + Math.sin(angle) * innerR,
            x + Math.cos(angle) * outerR,
            y + Math.sin(angle) * outerR
          );
        }
        break;

      case 'pulse': // Green pulse for Magnet
        const pulseRadius = 60 + Math.sin(time * 6) * 20;
        graphics.lineStyle(2, definition.color, alpha);
        graphics.strokeCircle(x, y, pulseRadius);
        graphics.lineStyle(1, definition.color, alpha * 0.5);
        graphics.strokeCircle(x, y, pulseRadius * 0.7);
        graphics.strokeCircle(x, y, pulseRadius * 1.3);
        break;

      case 'sparks': // Purple sparks for Multi-Shot
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + time * 3;
          const sparkDist = 35 + Math.sin(time * 8 + i) * 10;
          const sparkX = x + Math.cos(angle) * sparkDist;
          const sparkY = y + Math.sin(angle) * sparkDist;
          graphics.fillStyle(definition.color, alpha);
          graphics.fillCircle(sparkX, sparkY, 4);
          graphics.fillStyle(0xffffff, alpha * 0.8);
          graphics.fillCircle(sparkX, sparkY, 2);
        }
        break;

      case 'flames': // Orange flames for Rapid Fire
        for (let i = 0; i < 5; i++) {
          const flameAngle = (i / 5) * Math.PI * 2 + time * 4;
          const flameDist = 30 + Math.sin(time * 10 + i * 2) * 8;
          const flameHeight = 15 + Math.sin(time * 12 + i) * 5;
          const flameX = x + Math.cos(flameAngle) * flameDist;
          const flameY = y + Math.sin(flameAngle) * flameDist;

          graphics.fillStyle(definition.color, alpha);
          graphics.fillEllipse(flameX, flameY - flameHeight / 2, 8, flameHeight);
          graphics.fillStyle(0xffff00, alpha * 0.6);
          graphics.fillEllipse(flameX, flameY - flameHeight / 3, 4, flameHeight * 0.6);
        }
        break;
    }
  }

  /**
   * Update the HUD display.
   */
  private updateHUD(): void {
    if (!this.scene || !this.hudContainer) return;

    let index = 0;
    const iconSize = 40;
    const spacing = 50;

    // Update existing icons and add new ones
    for (const [type, powerUp] of this.activePowerUps) {
      const definition = POWER_UP_DEFINITIONS[type];
      let hudEntry = this.hudIcons.get(type);

      if (!hudEntry) {
        // Create new icon
        const icon = this.scene.add.graphics();
        icon.fillStyle(definition.color, 0.8);
        icon.fillRoundedRect(0, 0, iconSize, iconSize, 8);
        icon.lineStyle(2, 0xffffff, 0.9);
        icon.strokeRoundedRect(0, 0, iconSize, iconSize, 8);

        // Add symbol based on power-up type
        this.drawPowerUpSymbol(icon, type, iconSize);

        const timer = this.scene.add.text(iconSize / 2, iconSize + 5, '', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5, 0);

        this.hudContainer!.add(icon);
        this.hudContainer!.add(timer);

        hudEntry = { icon, timer };
        this.hudIcons.set(type, hudEntry);
      }

      // Position and update
      hudEntry.icon.setPosition(index * spacing, 0);
      hudEntry.timer.setPosition(index * spacing + iconSize / 2, iconSize + 5);
      hudEntry.timer.setText(Math.ceil(powerUp.remainingTime).toString());

      // Flash when low on time
      if (powerUp.remainingTime < 3) {
        const flash = Math.sin(powerUp.remainingTime * 10) > 0;
        hudEntry.icon.setAlpha(flash ? 1 : 0.5);
      } else {
        hudEntry.icon.setAlpha(1);
      }

      index++;
    }

    // Remove icons for inactive power-ups
    for (const [type, hudEntry] of this.hudIcons) {
      if (!this.activePowerUps.has(type)) {
        hudEntry.icon.destroy();
        hudEntry.timer.destroy();
        this.hudIcons.delete(type);
      }
    }
  }

  /**
   * Draw a symbol on the power-up icon.
   */
  private drawPowerUpSymbol(graphics: Phaser.GameObjects.Graphics, type: PowerUpType, size: number): void {
    const cx = size / 2;
    const cy = size / 2;
    graphics.lineStyle(3, 0xffffff, 0.9);

    switch (type) {
      case PowerUpType.DoubleDamage:
        // "2x" symbol - sword shape
        graphics.lineBetween(cx - 8, cy + 8, cx + 8, cy - 8);
        graphics.lineBetween(cx - 4, cy - 4, cx + 4, cy - 12);
        graphics.lineBetween(cx - 4, cy - 4, cx - 12, cy + 4);
        break;

      case PowerUpType.SpeedBoost:
        // Arrow/lightning shape
        graphics.lineBetween(cx - 8, cy, cx + 4, cy - 10);
        graphics.lineBetween(cx + 4, cy - 10, cx, cy);
        graphics.lineBetween(cx, cy, cx + 8, cy + 10);
        break;

      case PowerUpType.Invincibility:
        // Shield shape
        graphics.strokeCircle(cx, cy, 10);
        graphics.lineBetween(cx - 6, cy - 4, cx, cy + 8);
        graphics.lineBetween(cx, cy + 8, cx + 6, cy - 4);
        break;

      case PowerUpType.Magnet:
        // Magnet shape (U shape)
        graphics.lineBetween(cx - 8, cy - 8, cx - 8, cy + 4);
        graphics.lineBetween(cx + 8, cy - 8, cx + 8, cy + 4);
        graphics.arc(cx, cy + 4, 8, 0, Math.PI, false);
        graphics.strokePath();
        break;

      case PowerUpType.MultiShot:
        // Three arrows/projectiles
        graphics.lineBetween(cx, cy - 10, cx, cy + 10);
        graphics.lineBetween(cx - 8, cy - 6, cx - 8, cy + 6);
        graphics.lineBetween(cx + 8, cy - 6, cx + 8, cy + 6);
        // Arrowheads
        graphics.lineBetween(cx - 4, cy - 6, cx, cy - 10);
        graphics.lineBetween(cx + 4, cy - 6, cx, cy - 10);
        break;

      case PowerUpType.RapidFire:
        // Multiple small circles (bullets)
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(cx, cy - 8, 3);
        graphics.fillCircle(cx - 6, cy, 3);
        graphics.fillCircle(cx + 6, cy, 3);
        graphics.fillCircle(cx, cy + 8, 3);
        break;
    }
  }

  /**
   * Try to spawn a power-up at a position (5% chance).
   * Call this when an enemy dies.
   */
  trySpawnPowerUp(x: number, y: number): boolean {
    if (!this.scene) return false;

    // 5% drop chance
    if (Math.random() > POWER_UP_DROP_CHANCE) {
      return false;
    }

    // Select random power-up type
    const types = Object.values(PowerUpType);
    const type = types[Math.floor(Math.random() * types.length)];

    return this.spawnPowerUp(x, y, type);
  }

  /**
   * Spawn a specific power-up at a position.
   */
  spawnPowerUp(x: number, y: number, type: PowerUpType): boolean {
    if (!this.scene) return false;

    const definition = POWER_UP_DEFINITIONS[type];

    // Create pickup sprite (use star texture as placeholder)
    const pickup = this.scene.add.sprite(x, y, 'star') as IPowerUpPickup;
    pickup.powerUpType = type;
    pickup.lifetime = POWER_UP_LIFETIME;
    pickup.bobOffset = Math.random() * Math.PI * 2;
    pickup.setScale(0);
    pickup.setTint(definition.color);
    pickup.setBlendMode(Phaser.BlendModes.ADD);
    pickup.setDepth(5);

    // Spawn animation
    this.scene.tweens.add({
      targets: pickup,
      scale: 0.8,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Add glow effect
    const glow = this.scene.add.graphics();
    glow.setDepth(4);

    const updateGlow = () => {
      if (!pickup.active) {
        glow.destroy();
        return;
      }
      glow.clear();
      const alpha = 0.3 + Math.sin(pickup.bobOffset) * 0.2;
      glow.fillStyle(definition.color, alpha);
      glow.fillCircle(pickup.x, pickup.y, 25);
      glow.lineStyle(2, definition.color, alpha + 0.2);
      glow.strokeCircle(pickup.x, pickup.y, 30);
    };

    // Update glow in scene update
    const glowEvent = this.scene.time.addEvent({
      delay: 16,
      callback: updateGlow,
      loop: true,
    });

    pickup.on('destroy', () => {
      glowEvent.destroy();
      glow.destroy();
    });

    this.pickups.push(pickup);

    return true;
  }

  /**
   * Collect a power-up pickup.
   */
  private collectPowerUp(pickup: IPowerUpPickup): void {
    if (!this.scene) return;

    const type = pickup.powerUpType;
    const definition = POWER_UP_DEFINITIONS[type];

    // Activate the power-up
    this.activatePowerUp(type);

    // Play collection effect
    this.playCollectionEffect(pickup.x, pickup.y, definition.color);

    // Play sound
    this.scene.sound.play('sfx_powerup', { volume: 0.5 });

    // Show notification
    this.showPowerUpNotification(definition);

    // Destroy the pickup
    pickup.destroy();
  }

  /**
   * Activate a power-up on the player.
   */
  activatePowerUp(type: PowerUpType): void {
    if (!this.scene) return;

    const definition = POWER_UP_DEFINITIONS[type];
    const existing = this.activePowerUps.get(type);

    if (existing) {
      // Refresh duration (stacking refreshes time, doesn't multiply effect)
      existing.remainingTime = definition.duration;
      existing.duration = definition.duration;
    } else {
      // New power-up
      const powerUp: IActivePowerUp = {
        type,
        remainingTime: definition.duration,
        duration: definition.duration,
      };

      this.activePowerUps.set(type, powerUp);

      // Create visual effect
      this.createVisualEffect(type);
    }
  }

  /**
   * Create visual effect for a power-up.
   */
  private createVisualEffect(type: PowerUpType): void {
    if (!this.scene) return;

    const definition = POWER_UP_DEFINITIONS[type];

    // Create graphics for the effect
    const graphics = this.scene.add.graphics();
    graphics.setDepth(9); // Below player
    this.effectGraphics.set(type, graphics);

    // For some effects, also create particles
    if (definition.effectType === 'trail' && this.playerSprite) {
      const particles = this.scene.add.particles(0, 0, 'star', {
        follow: this.playerSprite,
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.6, end: 0 },
        speed: { min: 10, max: 30 },
        lifespan: 300,
        frequency: 30,
        blendMode: Phaser.BlendModes.ADD,
        tint: definition.color,
      });
      particles.setDepth(8);
      this.effectParticles.set(type, particles);
    }

    if (definition.effectType === 'flames' && this.playerSprite) {
      const particles = this.scene.add.particles(0, 0, 'fire', {
        follow: this.playerSprite,
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.8, end: 0 },
        speed: { min: 20, max: 50 },
        angle: { min: 250, max: 290 },
        lifespan: 400,
        frequency: 40,
        blendMode: Phaser.BlendModes.ADD,
        tint: [definition.color, 0xffff00],
      });
      particles.setDepth(8);
      this.effectParticles.set(type, particles);
    }

    if (definition.effectType === 'sparks' && this.playerSprite) {
      const particles = this.scene.add.particles(0, 0, 'star', {
        follow: this.playerSprite,
        followOffset: { x: 0, y: 0 },
        scale: { start: 0.2, end: 0 },
        alpha: { start: 1, end: 0 },
        speed: { min: 50, max: 100 },
        angle: { min: 0, max: 360 },
        lifespan: 200,
        frequency: 60,
        blendMode: Phaser.BlendModes.ADD,
        tint: definition.color,
      });
      particles.setDepth(8);
      this.effectParticles.set(type, particles);
    }
  }

  /**
   * Deactivate a power-up.
   */
  private deactivatePowerUp(type: PowerUpType): void {
    this.activePowerUps.delete(type);

    // Remove visual effect
    const graphics = this.effectGraphics.get(type);
    if (graphics) {
      graphics.destroy();
      this.effectGraphics.delete(type);
    }

    const particles = this.effectParticles.get(type);
    if (particles) {
      particles.stop();
      particles.destroy();
      this.effectParticles.delete(type);
    }
  }

  /**
   * Play collection effect.
   */
  private playCollectionEffect(x: number, y: number, color: number): void {
    if (!this.scene) return;

    // Particle burst
    const particles = this.scene.add.particles(x, y, 'star', {
      speed: { min: 100, max: 250 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      quantity: 15,
      blendMode: Phaser.BlendModes.ADD,
      tint: color,
    });

    this.scene.time.delayedCall(500, () => particles.destroy());

    // Ring effect
    const ring = this.scene.add.graphics();
    ring.setDepth(50);

    let radius = 0;
    const maxRadius = 60;
    const startTime = this.scene.time.now;
    const duration = 300;

    const updateRing = () => {
      if (!this.scene) return;
      const elapsed = this.scene.time.now - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        ring.destroy();
        return;
      }

      radius = maxRadius * progress;
      const alpha = 1 - progress;

      ring.clear();
      ring.lineStyle(4, color, alpha);
      ring.strokeCircle(x, y, radius);
      ring.lineStyle(2, 0xffffff, alpha * 0.5);
      ring.strokeCircle(x, y, radius * 0.8);

      this.scene.time.delayedCall(16, updateRing);
    };

    updateRing();
  }

  /**
   * Show power-up notification.
   */
  private showPowerUpNotification(definition: IPowerUpDefinition): void {
    if (!this.scene) return;

    const colorHex = `#${definition.color.toString(16).padStart(6, '0')}`;

    const text = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY - 100,
      definition.name.toUpperCase(),
      {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: colorHex,
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    const descText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY - 65,
      definition.description,
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(0.5).setDepth(200).setAlpha(0);

    // Animate in
    this.scene.tweens.add({
      targets: [text, descText],
      alpha: 1,
      y: '-=20',
      duration: 200,
      ease: 'Power2',
    });

    // Animate out after delay
    this.scene.time.delayedCall(1500, () => {
      this.scene!.tweens.add({
        targets: [text, descText],
        alpha: 0,
        y: '-=30',
        duration: 300,
        onComplete: () => {
          text.destroy();
          descText.destroy();
        },
      });
    });
  }

  /**
   * Get current power-up multipliers for player stats.
   */
  getMultipliers(): IPowerUpMultipliers {
    const multipliers: IPowerUpMultipliers = {
      damageMultiplier: 1,
      speedMultiplier: 1,
      isInvincible: false,
      magnetMultiplier: 1,
      additionalProjectiles: 0,
      fireRateMultiplier: 1,
    };

    for (const type of this.activePowerUps.keys()) {
      switch (type) {
        case PowerUpType.DoubleDamage:
          multipliers.damageMultiplier = 2;
          break;
        case PowerUpType.SpeedBoost:
          multipliers.speedMultiplier = 1.5;
          break;
        case PowerUpType.Invincibility:
          multipliers.isInvincible = true;
          break;
        case PowerUpType.Magnet:
          multipliers.magnetMultiplier = 5;
          break;
        case PowerUpType.MultiShot:
          multipliers.additionalProjectiles = 3;
          break;
        case PowerUpType.RapidFire:
          multipliers.fireRateMultiplier = 2;
          break;
      }
    }

    return multipliers;
  }

  /**
   * Check if a specific power-up is active.
   */
  isPowerUpActive(type: PowerUpType): boolean {
    return this.activePowerUps.has(type);
  }

  /**
   * Get remaining time for a power-up.
   */
  getRemainingTime(type: PowerUpType): number {
    const powerUp = this.activePowerUps.get(type);
    return powerUp ? powerUp.remainingTime : 0;
  }

  /**
   * Get all active power-ups.
   */
  getActivePowerUps(): IActivePowerUp[] {
    return Array.from(this.activePowerUps.values());
  }

  /**
   * Check if player is invincible (from power-up).
   */
  isInvincible(): boolean {
    return this.activePowerUps.has(PowerUpType.Invincibility);
  }

  /**
   * Destroy the system.
   */
  destroy(): void {
    this.reset();
    this.scene = null;
    this.playerSprite = null;
  }
}

// Singleton instance
let powerUpSystemInstance: PowerUpSystem | null = null;

/**
 * Get the power-up system singleton.
 */
export function getPowerUpSystem(): PowerUpSystem {
  if (!powerUpSystemInstance) {
    powerUpSystemInstance = new PowerUpSystem();
  }
  return powerUpSystemInstance;
}

/**
 * Export the power-up system instance.
 */
export const powerUpSystem = getPowerUpSystem();
