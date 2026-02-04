/**
 * EffectsManager - Central manager for visual effects.
 * Coordinates particle systems, screen effects, trails, and damage numbers.
 * Subscribes to game events for automatic effect triggering.
 */

import type { IWorld } from 'bitecs';
import type { Renderer } from '../rendering/Renderer';
import type { Camera } from '../rendering/Camera';
import type { IEventBus, ISubscription } from '../shared/interfaces/IEventBus';
import {
  GameEvents,
  type DamageEvent,
  type EntityKilledEvent,
  type WeaponFiredEvent,
  type PlayerLevelUpEvent,
} from '../shared/interfaces/IEventBus';
import { Position } from '../shared/types/components';

import { ParticleSystem } from './ParticleSystem';
import { EffectType, ParticlePresets } from './ParticlePresets';
import { ScreenEffects } from './ScreenEffects';
import { TrailRenderer } from './TrailRenderer';
import { DamageNumberRenderer } from './DamageNumberRenderer';

/**
 * Effect play options.
 */
export interface EffectOptions {
  /** Scale multiplier */
  scale?: number;
  /** Color override */
  color?: number;
  /** Rotation */
  rotation?: number;
  /** Custom duration */
  duration?: number;
  /** Whether to follow an entity */
  follow?: number;
  /** Sound effect ID */
  sfxId?: string;
}

/**
 * Effects configuration.
 */
export interface EffectsConfig {
  /** Enable particle effects */
  particles?: boolean;
  /** Enable screen effects */
  screenEffects?: boolean;
  /** Enable trails */
  trails?: boolean;
  /** Enable damage numbers */
  damageNumbers?: boolean;
  /** Auto-subscribe to game events */
  autoSubscribe?: boolean;
  /** Particle quality (0-1) */
  particleQuality?: number;
}

/**
 * EffectsManager coordinates all visual effects in the game.
 */
export class EffectsManager {
  /** Event bus reference */
  private eventBus: IEventBus | null = null;

  /** Sub-systems */
  private particleSystem: ParticleSystem;
  private screenEffects: ScreenEffects;
  private trailRenderer: TrailRenderer;
  private damageNumberRenderer: DamageNumberRenderer;

  /** Configuration */
  private config: EffectsConfig;

  /** Event subscriptions */
  private subscriptions: ISubscription[] = [];

  /** Quality multiplier for particle effects */
  public qualityMultiplier: number = 1;

  /** Whether effects are paused */
  private paused: boolean = false;

  /** Local player entity (for positioning effects) */
  private localPlayerEntity: number | null = null;

  constructor(renderer: Renderer, camera: Camera, config: EffectsConfig = {}) {
    this.config = {
      particles: true,
      screenEffects: true,
      trails: true,
      damageNumbers: true,
      autoSubscribe: true,
      particleQuality: 1,
      ...config,
    };

    this.qualityMultiplier = this.config.particleQuality ?? 1;

    // Initialize sub-systems
    this.particleSystem = new ParticleSystem(renderer);
    this.screenEffects = new ScreenEffects(renderer, camera);
    this.trailRenderer = new TrailRenderer(renderer);
    this.damageNumberRenderer = new DamageNumberRenderer(renderer);
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize effects manager with event bus.
   */
  init(eventBus: IEventBus): void {
    this.eventBus = eventBus;

    if (this.config.autoSubscribe) {
      this.subscribeToEvents();
    }
  }

  /**
   * Set local player entity for relative effects.
   */
  setLocalPlayer(entity: number): void {
    this.localPlayerEntity = entity;
  }

  /**
   * Subscribe to game events.
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    // Damage events
    this.subscriptions.push(
      this.eventBus.on<DamageEvent>(GameEvents.DAMAGE, (event) => {
        this.onDamage(event);
      })
    );

    // Entity killed events
    this.subscriptions.push(
      this.eventBus.on<EntityKilledEvent>(GameEvents.ENTITY_KILLED, (event) => {
        this.onEntityKilled(event);
      })
    );

    // Weapon fired events
    this.subscriptions.push(
      this.eventBus.on<WeaponFiredEvent>(GameEvents.WEAPON_FIRED, (event) => {
        this.onWeaponFired(event);
      })
    );

    // Level up events
    this.subscriptions.push(
      this.eventBus.on<PlayerLevelUpEvent>(GameEvents.PLAYER_LEVEL_UP, (event) => {
        this.onLevelUp(event);
      })
    );

    // XP gained events
    this.subscriptions.push(
      this.eventBus.on<{ entity: number; amount: number; position: { x: number; y: number } }>(
        GameEvents.XP_GAINED,
        (event) => {
          this.onXPGained(event);
        }
      )
    );
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handle damage event.
   */
  private onDamage(event: DamageEvent): void {
    const { position, amount, isCritical, target } = event;

    // Show damage number
    if (this.config.damageNumbers) {
      this.damageNumberRenderer.showDamage(position.x, position.y, amount, isCritical);
    }

    // Play blood/hit effect
    if (this.config.particles) {
      if (isCritical) {
        this.playEffect(EffectType.CriticalHit, position.x, position.y);
      } else {
        this.playEffect(EffectType.BloodSplash, position.x, position.y);
      }
      this.playEffect(EffectType.HitSpark, position.x, position.y);
    }

    // Screen effect for player taking damage
    if (this.config.screenEffects && target === this.localPlayerEntity) {
      const intensity = Math.min(1, amount / 50);
      this.screenEffects.takeDamageEffect(intensity);
    }
  }

  /**
   * Handle entity killed event.
   */
  private onEntityKilled(event: EntityKilledEvent): void {
    const { position } = event;

    // Play death explosion
    if (this.config.particles) {
      this.playEffect(EffectType.DeathExplosion, position.x, position.y);
    }

    // Screen shake for kills
    if (this.config.screenEffects) {
      this.screenEffects.impactShake(2);
    }
  }

  /**
   * Handle weapon fired event.
   */
  private onWeaponFired(event: WeaponFiredEvent): void {
    const { position, direction } = event;

    // Play muzzle flash
    if (this.config.particles) {
      const angle = Math.atan2(direction.y, direction.x) * (180 / Math.PI);
      this.playEffect(EffectType.WeaponFire, position.x, position.y, { rotation: angle });
    }
  }

  /**
   * Handle level up event.
   */
  private onLevelUp(event: PlayerLevelUpEvent): void {
    const entity = event.entity;
    const x = Position.x[entity] ?? 0;
    const y = Position.y[entity] ?? 0;

    // Play level up effect
    if (this.config.particles) {
      this.playEffect(EffectType.LevelUp, x, y);
    }

    // Screen effects
    if (this.config.screenEffects) {
      this.screenEffects.levelUpEffect();
    }
  }

  /**
   * Handle XP gained event.
   */
  private onXPGained(event: { entity: number; amount: number; position: { x: number; y: number } }): void {
    const { position, amount } = event;

    // Play XP collect effect
    if (this.config.particles) {
      this.playEffect(EffectType.XPCollect, position.x, position.y);
    }

    // Show XP number
    if (this.config.damageNumbers) {
      this.damageNumberRenderer.showXP(position.x, position.y, amount);
    }
  }

  // ============================================
  // Effect Playback
  // ============================================

  /**
   * Play an effect at a position.
   */
  playEffect(type: EffectType, x: number, y: number, options?: EffectOptions): void {
    if (this.paused || !this.config.particles) return;

    const preset = ParticlePresets[type];
    if (!preset) return;

    // Quality scaling is applied internally by the particle system
    // Future: use qualityMultiplier to adjust particle count

    // Play particle effect
    this.particleSystem.playPresetEffect(type, x, y, {
      scale: options?.scale,
      tint: options?.color,
      rotation: options?.rotation,
    });

    // Screen shake if defined
    if (this.config.screenEffects && preset.screenShake) {
      this.screenEffects.shake({
        intensity: preset.screenShake,
        duration: preset.screenShakeDuration ?? 100,
      });
    }

    // Emit sound event
    if (preset.sfxId && this.eventBus) {
      this.eventBus.emit(GameEvents.PLAY_SFX, {
        sfxId: preset.sfxId,
        position: { x, y },
      });
    }
  }

  /**
   * Play blood splash effect.
   */
  playBloodSplash(x: number, y: number): void {
    this.playEffect(EffectType.BloodSplash, x, y);
  }

  /**
   * Play death explosion effect.
   */
  playDeathExplosion(x: number, y: number): void {
    this.playEffect(EffectType.DeathExplosion, x, y);
  }

  /**
   * Play XP collect effect.
   */
  playXPCollect(x: number, y: number): void {
    this.playEffect(EffectType.XPCollect, x, y);
  }

  /**
   * Play level up effect.
   */
  playLevelUp(x: number, y: number): void {
    this.playEffect(EffectType.LevelUp, x, y);
  }

  /**
   * Play weapon fire effect.
   */
  playWeaponFire(x: number, y: number, angle: number): void {
    this.playEffect(EffectType.WeaponFire, x, y, { rotation: angle });
  }

  /**
   * Play hit spark effect.
   */
  playHitSpark(x: number, y: number): void {
    this.playEffect(EffectType.HitSpark, x, y);
  }

  /**
   * Play heal effect.
   */
  playHeal(x: number, y: number, amount: number): void {
    this.playEffect(EffectType.Heal, x, y);

    if (this.config.damageNumbers) {
      this.damageNumberRenderer.showHeal(x, y, amount);
    }
  }

  // ============================================
  // Screen Effects
  // ============================================

  /**
   * Flash the screen.
   */
  screenFlash(color: number, duration: number, intensity: number = 1): void {
    if (!this.config.screenEffects || this.paused) return;
    this.screenEffects.flash(color, duration, intensity);
  }

  /**
   * Shake the screen.
   */
  screenShake(intensity: number, duration: number): void {
    if (!this.config.screenEffects || this.paused) return;
    this.screenEffects.shake({ intensity, duration });
  }

  /**
   * Slow motion effect.
   */
  slowMotion(factor: number, duration: number): Promise<void> {
    if (!this.config.screenEffects || this.paused) {
      return Promise.resolve();
    }
    return this.screenEffects.slowMotion({ factor, duration });
  }

  /**
   * Vignette effect.
   */
  vignette(intensity: number, duration: number, color: number = 0x000000): Promise<void> {
    if (!this.config.screenEffects || this.paused) {
      return Promise.resolve();
    }
    return this.screenEffects.vignette({ intensity, duration, color });
  }

  /**
   * Get current time scale for slow motion.
   */
  get timeScale(): number {
    return this.screenEffects.timeScale;
  }

  // ============================================
  // Trail Effects
  // ============================================

  /**
   * Create a trail for an entity.
   */
  createTrail(entity: number, color: number = 0xffffff): void {
    if (!this.config.trails || this.paused) return;
    this.trailRenderer.createProjectileTrail(entity, color);
  }

  /**
   * Create beam trail.
   */
  createBeamTrail(entity: number, color: number = 0x00ffff): void {
    if (!this.config.trails || this.paused) return;
    this.trailRenderer.createBeamTrail(entity, color);
  }

  /**
   * Create dash trail.
   */
  createDashTrail(entity: number, color: number = 0x88aaff): void {
    if (!this.config.trails || this.paused) return;
    this.trailRenderer.createDashTrail(entity, color);
  }

  /**
   * Remove trail from entity.
   */
  removeTrail(entity: number): void {
    this.trailRenderer.removeTrail(entity);
  }

  // ============================================
  // Damage Numbers
  // ============================================

  /**
   * Show damage number.
   */
  showDamage(x: number, y: number, damage: number, isCritical: boolean = false): void {
    if (!this.config.damageNumbers || this.paused) return;
    this.damageNumberRenderer.showDamage(x, y, damage, isCritical);
  }

  /**
   * Show heal number.
   */
  showHeal(x: number, y: number, amount: number): void {
    if (!this.config.damageNumbers || this.paused) return;
    this.damageNumberRenderer.showHeal(x, y, amount);
  }

  /**
   * Show XP number.
   */
  showXP(x: number, y: number, amount: number): void {
    if (!this.config.damageNumbers || this.paused) return;
    this.damageNumberRenderer.showXP(x, y, amount);
  }

  /**
   * Show custom text.
   */
  showText(x: number, y: number, text: string, color: number = 0xffffff): void {
    if (!this.config.damageNumbers || this.paused) return;
    this.damageNumberRenderer.showText(x, y, text, color);
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update all effects.
   */
  update(world: IWorld, dt: number): void {
    if (this.paused) return;

    // Apply time scale
    const scaledDt = dt * this.timeScale;

    // Update sub-systems
    this.particleSystem.update(world, scaledDt);
    this.screenEffects.update(scaledDt);
    this.trailRenderer.update(scaledDt);
    this.damageNumberRenderer.update(scaledDt);
  }

  // ============================================
  // Control Methods
  // ============================================

  /**
   * Pause all effects.
   */
  pause(): void {
    this.paused = true;
    this.particleSystem.pauseAll();
    this.trailRenderer.pauseAll();
  }

  /**
   * Resume all effects.
   */
  resume(): void {
    this.paused = false;
    this.particleSystem.resumeAll();
    this.trailRenderer.resumeAll();
  }

  /**
   * Set particle quality (0-1).
   */
  setQuality(quality: number): void {
    this.qualityMultiplier = Math.max(0, Math.min(1, quality));
  }

  /**
   * Enable/disable effect categories.
   */
  setEnabled(
    category: 'particles' | 'screenEffects' | 'trails' | 'damageNumbers' | 'autoSubscribe',
    enabled: boolean
  ): void {
    this.config[category] = enabled;
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get particle system.
   */
  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  /**
   * Get screen effects.
   */
  getScreenEffects(): ScreenEffects {
    return this.screenEffects;
  }

  /**
   * Get trail renderer.
   */
  getTrailRenderer(): TrailRenderer {
    return this.trailRenderer;
  }

  /**
   * Get damage number renderer.
   */
  getDamageNumberRenderer(): DamageNumberRenderer {
    return this.damageNumberRenderer;
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clear all active effects.
   */
  clearAll(): void {
    this.particleSystem.destroyAll();
    this.screenEffects.clearAll();
    this.trailRenderer.clearAll();
    this.damageNumberRenderer.clearAll();
  }

  /**
   * Destroy effects manager.
   */
  destroy(): void {
    // Unsubscribe from events
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];

    // Destroy sub-systems
    this.particleSystem.destroy();
    this.screenEffects.destroy();
    this.trailRenderer.destroy();
    this.damageNumberRenderer.destroy();

    this.eventBus = null;
  }
}
