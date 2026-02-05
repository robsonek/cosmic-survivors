/**
 * BossSystem - Advanced boss fight mechanics for Cosmic Survivors
 *
 * Features:
 * - Unique attack patterns (Bullet Hell, Laser Sweep, Summon Minions, Ground Slam, Enrage)
 * - Boss phases with phase transitions
 * - Telegraphed attacks with warning indicators
 * - Integration with WaveManager for boss spawns
 * - Dramatic music trigger events
 */

import { defineQuery, hasComponent, addComponent } from 'bitecs';
import type { ISystem } from '../shared/interfaces/ISystem';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEventBus, BossSpawnEvent, EntityKilledEvent } from '../shared/interfaces/IEventBus';
import { GameEvents, DamageType } from '../shared/interfaces/IEventBus';
import {
  Position,
  Velocity,
  Health,
  Tags,
  CircleCollider,
  Sprite,
  AIController,
  Movement,
  Projectile,
} from '../shared/types/components';
import { CollisionLayer, CollisionMasks } from '../shared/interfaces/IPhysics';

// ============================================
// Boss Attack Types
// ============================================

export enum BossAttackType {
  BulletHell = 'bullet_hell',
  LaserSweep = 'laser_sweep',
  SummonMinions = 'summon_minions',
  GroundSlam = 'ground_slam',
  Enrage = 'enrage',
}

// ============================================
// Boss Phase Configuration
// ============================================

export interface BossPhaseConfig {
  /** Health threshold to enter this phase (0-1) */
  healthThreshold: number;
  /** Attacks available in this phase */
  attacks: BossAttackType[];
  /** Speed multiplier for this phase */
  speedMultiplier: number;
  /** Damage multiplier for this phase */
  damageMultiplier: number;
  /** Attack interval (seconds) */
  attackInterval: number;
  /** Phase name for UI/effects */
  phaseName: string;
}

// ============================================
// Boss Definition
// ============================================

export interface BossDefinition {
  id: string;
  name: string;
  baseHealth: number;
  baseDamage: number;
  baseSpeed: number;
  collisionRadius: number;
  xpValue: number;
  phases: BossPhaseConfig[];
  /** Enrage threshold (HP percentage) */
  enrageThreshold: number;
  /** Special abilities */
  abilities: {
    bulletHell?: BulletHellConfig;
    laserSweep?: LaserSweepConfig;
    summonMinions?: SummonMinionsConfig;
    groundSlam?: GroundSlamConfig;
  };
}

// ============================================
// Attack Configurations
// ============================================

export interface BulletHellConfig {
  /** Number of projectile arms */
  armCount: number;
  /** Projectiles per arm */
  projectilesPerArm: number;
  /** Rotation speed (degrees per second) */
  rotationSpeed: number;
  /** Projectile speed */
  projectileSpeed: number;
  /** Damage per projectile */
  damage: number;
  /** Duration of the attack */
  duration: number;
  /** Fire rate (projectiles per second per arm) */
  fireRate: number;
}

export interface LaserSweepConfig {
  /** Laser width */
  width: number;
  /** Laser length */
  length: number;
  /** Sweep angle (degrees) */
  sweepAngle: number;
  /** Sweep speed (degrees per second) */
  sweepSpeed: number;
  /** Damage per tick */
  damagePerTick: number;
  /** Warning duration before firing */
  warningDuration: number;
  /** Active duration */
  activeDuration: number;
}

export interface SummonMinionsConfig {
  /** Enemy type to summon */
  minionType: string;
  /** Number of minions to summon */
  count: number;
  /** Spawn radius around boss */
  spawnRadius: number;
  /** Summon animation duration */
  summonDuration: number;
}

export interface GroundSlamConfig {
  /** Inner damage radius (full damage) */
  innerRadius: number;
  /** Outer damage radius (falloff) */
  outerRadius: number;
  /** Damage at center */
  damage: number;
  /** Warning duration before impact */
  warningDuration: number;
  /** Number of shockwave rings */
  shockwaveRings: number;
  /** Knockback force */
  knockbackForce: number;
}

// ============================================
// Boss State
// ============================================

interface BossState {
  entity: EntityId;
  definition: BossDefinition;
  currentPhase: number;
  currentAttack: BossAttackType | null;
  attackTimer: number;
  attackCooldown: number;
  isEnraged: boolean;
  attackState: AttackState | null;
  warningIndicators: WarningIndicator[];
  projectiles: EntityId[];
  laserEntities: EntityId[];
}

interface AttackState {
  type: BossAttackType;
  elapsed: number;
  duration: number;
  data: Record<string, unknown>;
}

interface WarningIndicator {
  id: number;
  x: number;
  y: number;
  radius: number;
  elapsed: number;
  duration: number;
  type: 'circle' | 'line' | 'cone';
  angle?: number;
  length?: number;
  color: number;
}

// ============================================
// Predefined Boss Types
// ============================================

export const BOSS_DEFINITIONS: Record<string, BossDefinition> = {
  mothership: {
    id: 'mothership',
    name: 'Mothership',
    baseHealth: 3000,
    baseDamage: 25,
    baseSpeed: 40,
    collisionRadius: 80,
    xpValue: 2000,
    enrageThreshold: 0.25,
    phases: [
      {
        healthThreshold: 1.0,
        attacks: [BossAttackType.BulletHell, BossAttackType.SummonMinions],
        speedMultiplier: 1.0,
        damageMultiplier: 1.0,
        attackInterval: 5.0,
        phaseName: 'Phase 1',
      },
      {
        healthThreshold: 0.6,
        attacks: [BossAttackType.BulletHell, BossAttackType.SummonMinions, BossAttackType.GroundSlam],
        speedMultiplier: 1.2,
        damageMultiplier: 1.2,
        attackInterval: 4.0,
        phaseName: 'Phase 2',
      },
      {
        healthThreshold: 0.3,
        attacks: [BossAttackType.BulletHell, BossAttackType.LaserSweep, BossAttackType.SummonMinions, BossAttackType.GroundSlam],
        speedMultiplier: 1.5,
        damageMultiplier: 1.5,
        attackInterval: 3.0,
        phaseName: 'Final Phase',
      },
    ],
    abilities: {
      bulletHell: {
        armCount: 5,
        projectilesPerArm: 3,
        rotationSpeed: 45,
        projectileSpeed: 180,
        damage: 15,
        duration: 6.0,
        fireRate: 3,
      },
      laserSweep: {
        width: 40,
        length: 600,
        sweepAngle: 120,
        sweepSpeed: 60,
        damagePerTick: 20,
        warningDuration: 1.5,
        activeDuration: 3.0,
      },
      summonMinions: {
        minionType: 'drone',
        count: 10,
        spawnRadius: 200,
        summonDuration: 2.0,
      },
      groundSlam: {
        innerRadius: 100,
        outerRadius: 300,
        damage: 40,
        warningDuration: 1.0,
        shockwaveRings: 3,
        knockbackForce: 400,
      },
    },
  },
  destroyer: {
    id: 'destroyer',
    name: 'Destroyer',
    baseHealth: 5000,
    baseDamage: 35,
    baseSpeed: 30,
    collisionRadius: 100,
    xpValue: 3500,
    enrageThreshold: 0.25,
    phases: [
      {
        healthThreshold: 1.0,
        attacks: [BossAttackType.LaserSweep, BossAttackType.GroundSlam],
        speedMultiplier: 1.0,
        damageMultiplier: 1.0,
        attackInterval: 6.0,
        phaseName: 'Phase 1',
      },
      {
        healthThreshold: 0.5,
        attacks: [BossAttackType.LaserSweep, BossAttackType.GroundSlam, BossAttackType.BulletHell],
        speedMultiplier: 1.3,
        damageMultiplier: 1.3,
        attackInterval: 4.5,
        phaseName: 'Phase 2',
      },
      {
        healthThreshold: 0.2,
        attacks: [BossAttackType.LaserSweep, BossAttackType.GroundSlam, BossAttackType.BulletHell, BossAttackType.SummonMinions],
        speedMultiplier: 1.6,
        damageMultiplier: 1.6,
        attackInterval: 3.0,
        phaseName: 'Desperation',
      },
    ],
    abilities: {
      bulletHell: {
        armCount: 8,
        projectilesPerArm: 2,
        rotationSpeed: 30,
        projectileSpeed: 220,
        damage: 20,
        duration: 8.0,
        fireRate: 4,
      },
      laserSweep: {
        width: 60,
        length: 800,
        sweepAngle: 180,
        sweepSpeed: 45,
        damagePerTick: 30,
        warningDuration: 2.0,
        activeDuration: 4.0,
      },
      summonMinions: {
        minionType: 'charger',
        count: 6,
        spawnRadius: 250,
        summonDuration: 2.5,
      },
      groundSlam: {
        innerRadius: 150,
        outerRadius: 400,
        damage: 60,
        warningDuration: 1.2,
        shockwaveRings: 4,
        knockbackForce: 500,
      },
    },
  },
};

// ============================================
// BossSystem Class
// ============================================

export class BossSystem implements ISystem {
  public readonly name = 'BossSystem';
  public readonly priority = 35; // After AI, before damage
  public readonly dependencies: string[] = ['AISystem', 'DamageSystem'];
  public enabled = true;

  private world!: IWorld;
  private eventBus!: IEventBus;

  // Active boss states
  private activeBosses: Map<EntityId, BossState> = new Map();

  // Warning indicator counter
  private warningIdCounter = 0;

  // Player query for targeting
  private playerQuery!: ReturnType<typeof defineQuery>;

  // Boss query
  private _bossQuery!: ReturnType<typeof defineQuery>;

  // Projectile query for cleanup
  private _projectileQuery!: ReturnType<typeof defineQuery>;

  // Callbacks for external integration
  private onMinionSpawn?: (minionType: string, x: number, y: number) => EntityId | null;
  private onWarningIndicatorCreate?: (indicator: WarningIndicator) => void;
  private onWarningIndicatorRemove?: (indicatorId: number) => void;
  private onPhaseChange?: (bossEntity: EntityId, newPhase: number, phaseName: string) => void;
  private onEnrage?: (bossEntity: EntityId) => void;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  // ============================================
  // ISystem Implementation
  // ============================================

  init(world: IWorld): void {
    this.world = world;

    // Define queries
    this.playerQuery = defineQuery([Position, Tags.Player]);
    this._bossQuery = defineQuery([Position, Health, Tags.Boss]);
    this._projectileQuery = defineQuery([Projectile, Position, Velocity]);

    // Subscribe to events
    this.subscribeToEvents();
  }

  update(dt: number): void {
    if (!this.enabled) return;

    const rawWorld = this.world.raw;

    // Update all active bosses
    for (const [entity, state] of this.activeBosses) {
      // Check if boss is still alive
      if (!this.world.entityExists(entity) || hasComponent(rawWorld as Parameters<typeof hasComponent>[0], Tags.Dead, entity)) {
        this.handleBossDeath(entity);
        continue;
      }

      // Update boss state
      this.updateBoss(state, dt);
    }
  }

  destroy(): void {
    // Clean up all active bosses
    for (const [entity] of this.activeBosses) {
      this.cleanupBoss(entity);
    }
    this.activeBosses.clear();
  }

  // ============================================
  // Event Handling
  // ============================================

  private subscribeToEvents(): void {
    // Listen for boss spawn events
    this.eventBus.on<BossSpawnEvent>(GameEvents.BOSS_SPAWN, (event) => {
      this.onBossSpawn(event);
    });

    // Listen for entity killed to handle boss deaths
    this.eventBus.on<EntityKilledEvent>(GameEvents.ENTITY_KILLED, (event) => {
      if (this.activeBosses.has(event.entity)) {
        this.handleBossDeath(event.entity);
      }
    });
  }

  private onBossSpawn(event: BossSpawnEvent): void {
    const definition = BOSS_DEFINITIONS[event.bossType];
    if (!definition) {
      console.warn(`BossSystem: Unknown boss type: ${event.bossType}`);
      return;
    }

    // If entity is already created, register it
    if (event.entity > 0) {
      this.registerBoss(event.entity, definition);
    }

    // Trigger boss music
    this.eventBus.emit(GameEvents.PLAY_MUSIC, {
      trackId: 'music_boss',
      fadeIn: 500,
      loop: true,
    });

    // Emit notification for UI
    this.eventBus.emit(GameEvents.SHOW_NOTIFICATION, {
      text: `${definition.name} has appeared!`,
      type: 'boss',
      duration: 3000,
    });
  }

  // ============================================
  // Boss Registration
  // ============================================

  /**
   * Register a boss entity with a definition.
   */
  registerBoss(entity: EntityId, definition: BossDefinition): void {
    if (this.activeBosses.has(entity)) {
      console.warn(`BossSystem: Boss ${entity} already registered`);
      return;
    }

    const state: BossState = {
      entity,
      definition,
      currentPhase: 0,
      currentAttack: null,
      attackTimer: 0,
      attackCooldown: definition.phases[0].attackInterval,
      isEnraged: false,
      attackState: null,
      warningIndicators: [],
      projectiles: [],
      laserEntities: [],
    };

    this.activeBosses.set(entity, state);

    // Announce phase 1
    this.announcePhaseChange(state, 0);
  }

  /**
   * Create a boss entity from a definition.
   */
  createBoss(definition: BossDefinition, x: number, y: number): EntityId {
    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    // Position
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = x;
    Position.y[entity] = y;

    // Velocity
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Velocity, entity);
    Velocity.x[entity] = 0;
    Velocity.y[entity] = 0;

    // Health
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Health, entity);
    Health.current[entity] = definition.baseHealth;
    Health.max[entity] = definition.baseHealth;
    Health.shield[entity] = 0;
    Health.shieldMax[entity] = 0;
    Health.armor[entity] = 10;
    Health.invulnerable[entity] = 0;

    // Collider
    addComponent(rawWorld as Parameters<typeof addComponent>[0], CircleCollider, entity);
    CircleCollider.radius[entity] = definition.collisionRadius;
    CircleCollider.layer[entity] = CollisionLayer.Enemy;
    CircleCollider.mask[entity] = CollisionMasks.Enemy;
    CircleCollider.isTrigger[entity] = 0;

    // Movement
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Movement, entity);
    Movement.maxSpeed[entity] = definition.baseSpeed;
    Movement.acceleration[entity] = definition.baseSpeed * 4;
    Movement.deceleration[entity] = definition.baseSpeed * 2;
    Movement.friction[entity] = 0.1;
    Movement.mass[entity] = 50;

    // Sprite
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Sprite, entity);
    Sprite.textureId[entity] = this.hashString(`boss_${definition.id}`);
    Sprite.width[entity] = definition.collisionRadius * 2.5;
    Sprite.height[entity] = definition.collisionRadius * 2.5;
    Sprite.layer[entity] = 15;
    Sprite.visible[entity] = 1;
    Sprite.alpha[entity] = 1;

    // AI Controller
    addComponent(rawWorld as Parameters<typeof addComponent>[0], AIController, entity);
    AIController.state[entity] = 2; // Chase
    AIController.alertRadius[entity] = 800;
    AIController.attackRadius[entity] = 400;

    // Tags
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Enemy, entity);
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Boss, entity);

    // Register boss
    this.registerBoss(entity, definition);

    return entity;
  }

  // ============================================
  // Boss Update Logic
  // ============================================

  private updateBoss(state: BossState, dt: number): void {
    // Update phase based on health
    this.updatePhase(state);

    // Check enrage
    this.updateEnrage(state);

    // Update current attack if active
    if (state.attackState) {
      this.updateAttack(state, dt);
    } else {
      // Update attack timer
      state.attackTimer += dt;

      if (state.attackTimer >= state.attackCooldown) {
        this.startNextAttack(state);
      }
    }

    // Update warning indicators
    this.updateWarningIndicators(state, dt);

    // Update projectiles (cleanup dead ones)
    this.updateProjectiles(state);
  }

  private updatePhase(state: BossState): void {
    const currentHpRatio = Health.current[state.entity] / Health.max[state.entity];
    const phases = state.definition.phases;

    // Find the appropriate phase based on health
    let newPhase = 0;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (currentHpRatio <= phases[i].healthThreshold) {
        newPhase = i;
        break;
      }
    }

    // Trigger phase change if different
    if (newPhase !== state.currentPhase) {
      this.triggerPhaseChange(state, newPhase);
    }
  }

  private triggerPhaseChange(state: BossState, newPhase: number): void {
    const oldPhase = state.currentPhase;
    state.currentPhase = newPhase;

    const phaseConfig = state.definition.phases[newPhase];

    // Update attack cooldown
    state.attackCooldown = phaseConfig.attackInterval;

    // Apply speed multiplier
    const baseSpeed = state.definition.baseSpeed;
    Movement.maxSpeed[state.entity] = baseSpeed * phaseConfig.speedMultiplier;

    // Announce phase change
    this.announcePhaseChange(state, newPhase);

    // Cancel current attack on phase change
    if (state.attackState) {
      this.cancelAttack(state);
    }

    // Callback
    if (this.onPhaseChange) {
      this.onPhaseChange(state.entity, newPhase, phaseConfig.phaseName);
    }

    // Screen effects for phase change
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'boss_phase_change',
      volume: 1.0,
    });

    // Emit phase change for screen effects
    this.eventBus.emit(GameEvents.BOSS_PHASE_CHANGE, {
      bossEntity: state.entity,
      oldPhase,
      newPhase,
      phaseName: phaseConfig.phaseName,
    });
  }

  private announcePhaseChange(state: BossState, phase: number): void {
    const phaseConfig = state.definition.phases[phase];

    this.eventBus.emit(GameEvents.SHOW_NOTIFICATION, {
      text: `${state.definition.name} - ${phaseConfig.phaseName}`,
      type: 'boss_phase',
      duration: 2000,
    });
  }

  private updateEnrage(state: BossState): void {
    if (state.isEnraged) return;

    const currentHpRatio = Health.current[state.entity] / Health.max[state.entity];

    if (currentHpRatio <= state.definition.enrageThreshold) {
      this.triggerEnrage(state);
    }
  }

  private triggerEnrage(state: BossState): void {
    state.isEnraged = true;

    // 50% speed and damage increase
    const currentSpeed = Movement.maxSpeed[state.entity];
    Movement.maxSpeed[state.entity] = currentSpeed * 1.5;

    // Visual indicator
    Sprite.tint[state.entity] = 0xFFFF0000; // Red tint

    // Callback
    if (this.onEnrage) {
      this.onEnrage(state.entity);
    }

    // Notification
    this.eventBus.emit(GameEvents.SHOW_NOTIFICATION, {
      text: `${state.definition.name} is ENRAGED!`,
      type: 'boss_enrage',
      duration: 2500,
    });

    // Screen shake
    this.eventBus.emit(GameEvents.SCREEN_SHAKE, {
      intensity: 12,
      duration: 500,
    });

    // Music intensity change
    this.eventBus.emit('music:intensity', {
      level: 'high',
    });

    // SFX
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'boss_enrage',
      volume: 1.2,
    });
  }

  // ============================================
  // Attack System
  // ============================================

  private startNextAttack(state: BossState): void {
    const phaseConfig = state.definition.phases[state.currentPhase];
    const availableAttacks = phaseConfig.attacks;

    if (availableAttacks.length === 0) return;

    // Select random attack
    const attackType = availableAttacks[Math.floor(Math.random() * availableAttacks.length)];

    // Start the attack
    this.startAttack(state, attackType);
  }

  private startAttack(state: BossState, attackType: BossAttackType): void {
    state.currentAttack = attackType;
    state.attackTimer = 0;

    const phaseConfig = state.definition.phases[state.currentPhase];
    const damageMultiplier = phaseConfig.damageMultiplier * (state.isEnraged ? 1.5 : 1);

    switch (attackType) {
      case BossAttackType.BulletHell:
        this.startBulletHellAttack(state, damageMultiplier);
        break;
      case BossAttackType.LaserSweep:
        this.startLaserSweepAttack(state, damageMultiplier);
        break;
      case BossAttackType.SummonMinions:
        this.startSummonMinionsAttack(state);
        break;
      case BossAttackType.GroundSlam:
        this.startGroundSlamAttack(state, damageMultiplier);
        break;
      case BossAttackType.Enrage:
        this.triggerEnrage(state);
        break;
    }
  }

  private updateAttack(state: BossState, dt: number): void {
    if (!state.attackState) return;

    state.attackState.elapsed += dt;

    switch (state.attackState.type) {
      case BossAttackType.BulletHell:
        this.updateBulletHellAttack(state, dt);
        break;
      case BossAttackType.LaserSweep:
        this.updateLaserSweepAttack(state, dt);
        break;
      case BossAttackType.SummonMinions:
        this.updateSummonMinionsAttack(state, dt);
        break;
      case BossAttackType.GroundSlam:
        this.updateGroundSlamAttack(state, dt);
        break;
    }

    // Check if attack is complete
    if (state.attackState.elapsed >= state.attackState.duration) {
      this.endAttack(state);
    }
  }

  private cancelAttack(state: BossState): void {
    // Clean up attack-specific resources
    this.cleanupAttackResources(state);

    state.attackState = null;
    state.currentAttack = null;
  }

  private endAttack(state: BossState): void {
    this.cleanupAttackResources(state);

    state.attackState = null;
    state.currentAttack = null;
    state.attackTimer = 0;
  }

  private cleanupAttackResources(state: BossState): void {
    // Clean up warning indicators
    for (const indicator of state.warningIndicators) {
      if (this.onWarningIndicatorRemove) {
        this.onWarningIndicatorRemove(indicator.id);
      }
    }
    state.warningIndicators = [];

    // Clean up laser entities
    for (const laserEntity of state.laserEntities) {
      if (this.world.entityExists(laserEntity)) {
        this.world.removeEntity(laserEntity);
      }
    }
    state.laserEntities = [];
  }

  // ============================================
  // Bullet Hell Attack
  // ============================================

  private startBulletHellAttack(state: BossState, damageMultiplier: number): void {
    const config = state.definition.abilities.bulletHell;
    if (!config) return;

    state.attackState = {
      type: BossAttackType.BulletHell,
      elapsed: 0,
      duration: config.duration,
      data: {
        rotation: 0,
        fireTimer: 0,
        damageMultiplier,
      },
    };

    // Play attack sound
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'boss_bullet_hell_start',
      position: { x: Position.x[state.entity], y: Position.y[state.entity] },
    });
  }

  private updateBulletHellAttack(state: BossState, dt: number): void {
    const config = state.definition.abilities.bulletHell!;
    const data = state.attackState!.data;

    // Update rotation
    data.rotation = ((data.rotation as number) + config.rotationSpeed * dt) % 360;

    // Update fire timer
    data.fireTimer = (data.fireTimer as number) + dt;

    const fireInterval = 1 / config.fireRate;

    // Fire projectiles
    if ((data.fireTimer as number) >= fireInterval) {
      data.fireTimer = 0;
      this.fireBulletHellVolley(state, config, data.rotation as number, data.damageMultiplier as number);
    }
  }

  private fireBulletHellVolley(state: BossState, config: BulletHellConfig, rotation: number, damageMultiplier: number): void {
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];

    const armAngleStep = 360 / config.armCount;

    for (let arm = 0; arm < config.armCount; arm++) {
      const armAngle = rotation + arm * armAngleStep;

      for (let p = 0; p < config.projectilesPerArm; p++) {
        const spread = (p - (config.projectilesPerArm - 1) / 2) * 10;
        const angle = (armAngle + spread) * (Math.PI / 180);

        const vx = Math.cos(angle) * config.projectileSpeed;
        const vy = Math.sin(angle) * config.projectileSpeed;

        const projectile = this.createBossProjectile(
          bossX,
          bossY,
          vx,
          vy,
          config.damage * damageMultiplier,
          state.entity
        );

        state.projectiles.push(projectile);
      }
    }

    // SFX
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'projectile_fire',
      position: { x: bossX, y: bossY },
      volume: 0.3,
    });
  }

  // ============================================
  // Laser Sweep Attack
  // ============================================

  private startLaserSweepAttack(state: BossState, damageMultiplier: number): void {
    const config = state.definition.abilities.laserSweep;
    if (!config) return;

    // Find target player
    const rawWorld = this.world.raw;
    const players = this.playerQuery(rawWorld);

    if (players.length === 0) return;

    const targetPlayer = players[Math.floor(Math.random() * players.length)];
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];
    const playerX = Position.x[targetPlayer];
    const playerY = Position.y[targetPlayer];

    // Calculate initial angle towards player
    const initialAngle = Math.atan2(playerY - bossY, playerX - bossX) * (180 / Math.PI);
    const startAngle = initialAngle - config.sweepAngle / 2;

    state.attackState = {
      type: BossAttackType.LaserSweep,
      elapsed: 0,
      duration: config.warningDuration + config.activeDuration,
      data: {
        phase: 'warning',
        startAngle,
        currentAngle: startAngle,
        damageMultiplier,
        damageTimer: 0,
      },
    };

    // Create warning indicator
    this.createLaserWarningIndicator(state, config, startAngle);

    // Play warning sound
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'laser_charge',
      position: { x: bossX, y: bossY },
    });
  }

  private createLaserWarningIndicator(state: BossState, config: LaserSweepConfig, angle: number): void {
    const indicator: WarningIndicator = {
      id: ++this.warningIdCounter,
      x: Position.x[state.entity],
      y: Position.y[state.entity],
      radius: 0,
      elapsed: 0,
      duration: config.warningDuration,
      type: 'line',
      angle,
      length: config.length,
      color: 0xff0000,
    };

    state.warningIndicators.push(indicator);

    if (this.onWarningIndicatorCreate) {
      this.onWarningIndicatorCreate(indicator);
    }
  }

  private updateLaserSweepAttack(state: BossState, dt: number): void {
    const config = state.definition.abilities.laserSweep!;
    const data = state.attackState!.data;

    // Update warning indicators position
    for (const indicator of state.warningIndicators) {
      indicator.x = Position.x[state.entity];
      indicator.y = Position.y[state.entity];
    }

    if (data.phase === 'warning') {
      // Check if warning phase is over
      if (state.attackState!.elapsed >= config.warningDuration) {
        data.phase = 'active';

        // Remove warning indicator
        for (const indicator of state.warningIndicators) {
          if (this.onWarningIndicatorRemove) {
            this.onWarningIndicatorRemove(indicator.id);
          }
        }
        state.warningIndicators = [];

        // Play laser fire sound
        this.eventBus.emit(GameEvents.PLAY_SFX, {
          sfxId: 'laser_fire',
          position: { x: Position.x[state.entity], y: Position.y[state.entity] },
        });
      }
    } else if (data.phase === 'active') {
      // Update sweep angle
      data.currentAngle = (data.currentAngle as number) + config.sweepSpeed * dt;

      // Deal damage to players in laser path
      data.damageTimer = ((data.damageTimer as number) || 0) + dt;

      if ((data.damageTimer as number) >= 0.1) { // Damage tick every 100ms
        data.damageTimer = 0;
        this.laserDamageCheck(state, config, data.currentAngle as number, data.damageMultiplier as number);
      }
    }
  }

  private laserDamageCheck(state: BossState, config: LaserSweepConfig, angle: number, damageMultiplier: number): void {
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];

    const rawWorld = this.world.raw;
    const players = this.playerQuery(rawWorld);

    const angleRad = angle * (Math.PI / 180);
    const endX = bossX + Math.cos(angleRad) * config.length;
    const endY = bossY + Math.sin(angleRad) * config.length;

    for (const player of players) {
      const playerX = Position.x[player];
      const playerY = Position.y[player];

      // Check if player is within laser beam
      const dist = this.pointToLineDistance(playerX, playerY, bossX, bossY, endX, endY);

      if (dist <= config.width / 2) {
        // Deal damage
        this.eventBus.emit(GameEvents.DAMAGE, {
          source: state.entity,
          target: player,
          amount: config.damagePerTick * damageMultiplier,
          type: DamageType.Fire,
          isCritical: false,
          position: { x: playerX, y: playerY },
        });
      }
    }
  }

  private pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx: number, yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================
  // Summon Minions Attack
  // ============================================

  private startSummonMinionsAttack(state: BossState): void {
    const config = state.definition.abilities.summonMinions;
    if (!config) return;

    state.attackState = {
      type: BossAttackType.SummonMinions,
      elapsed: 0,
      duration: config.summonDuration,
      data: {
        spawned: false,
      },
    };

    // Create warning indicators for spawn positions
    this.createSummonWarningIndicators(state, config);

    // Play summoning sound
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'boss_summon',
      position: { x: Position.x[state.entity], y: Position.y[state.entity] },
    });
  }

  private createSummonWarningIndicators(state: BossState, config: SummonMinionsConfig): void {
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];

    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2;
      const x = bossX + Math.cos(angle) * config.spawnRadius;
      const y = bossY + Math.sin(angle) * config.spawnRadius;

      const indicator: WarningIndicator = {
        id: ++this.warningIdCounter,
        x,
        y,
        radius: 30,
        elapsed: 0,
        duration: config.summonDuration,
        type: 'circle',
        color: 0xff00ff,
      };

      state.warningIndicators.push(indicator);

      if (this.onWarningIndicatorCreate) {
        this.onWarningIndicatorCreate(indicator);
      }
    }
  }

  private updateSummonMinionsAttack(state: BossState, dt: number): void {
    const config = state.definition.abilities.summonMinions!;
    const data = state.attackState!.data;

    // Check if summon phase is complete
    if (state.attackState!.elapsed >= config.summonDuration * 0.9 && !data.spawned) {
      data.spawned = true;
      this.spawnMinions(state, config);
    }
  }

  private spawnMinions(state: BossState, config: SummonMinionsConfig): void {
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];

    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2;
      const x = bossX + Math.cos(angle) * config.spawnRadius;
      const y = bossY + Math.sin(angle) * config.spawnRadius;

      if (this.onMinionSpawn) {
        this.onMinionSpawn(config.minionType, x, y);
      }
    }

    // Spawn effect
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'minion_spawn',
      position: { x: bossX, y: bossY },
    });
  }

  // ============================================
  // Ground Slam Attack
  // ============================================

  private startGroundSlamAttack(state: BossState, damageMultiplier: number): void {
    const config = state.definition.abilities.groundSlam;
    if (!config) return;

    state.attackState = {
      type: BossAttackType.GroundSlam,
      elapsed: 0,
      duration: config.warningDuration + 0.5, // Warning + impact
      data: {
        phase: 'warning',
        damageMultiplier,
        impactDone: false,
      },
    };

    // Create warning indicator
    this.createGroundSlamWarningIndicator(state, config);

    // Play charge sound
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'boss_slam_charge',
      position: { x: Position.x[state.entity], y: Position.y[state.entity] },
    });
  }

  private createGroundSlamWarningIndicator(state: BossState, config: GroundSlamConfig): void {
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];

    const indicator: WarningIndicator = {
      id: ++this.warningIdCounter,
      x: bossX,
      y: bossY,
      radius: config.outerRadius,
      elapsed: 0,
      duration: config.warningDuration,
      type: 'circle',
      color: 0xffaa00,
    };

    state.warningIndicators.push(indicator);

    if (this.onWarningIndicatorCreate) {
      this.onWarningIndicatorCreate(indicator);
    }
  }

  private updateGroundSlamAttack(state: BossState, dt: number): void {
    const config = state.definition.abilities.groundSlam!;
    const data = state.attackState!.data;

    if (data.phase === 'warning') {
      // Check if warning phase is over
      if (state.attackState!.elapsed >= config.warningDuration) {
        data.phase = 'impact';

        // Remove warning indicator
        for (const indicator of state.warningIndicators) {
          if (this.onWarningIndicatorRemove) {
            this.onWarningIndicatorRemove(indicator.id);
          }
        }
        state.warningIndicators = [];
      }
    } else if (data.phase === 'impact' && !data.impactDone) {
      data.impactDone = true;
      this.executeGroundSlam(state, config, data.damageMultiplier as number);
    }
  }

  private executeGroundSlam(state: BossState, config: GroundSlamConfig, damageMultiplier: number): void {
    const bossX = Position.x[state.entity];
    const bossY = Position.y[state.entity];

    // Screen shake
    this.eventBus.emit(GameEvents.SCREEN_SHAKE, {
      intensity: 15,
      duration: 400,
    });

    // Play impact sound
    this.eventBus.emit(GameEvents.PLAY_SFX, {
      sfxId: 'boss_slam_impact',
      position: { x: bossX, y: bossY },
      volume: 1.2,
    });

    // Check players in radius
    const rawWorld = this.world.raw;
    const players = this.playerQuery(rawWorld);

    for (const player of players) {
      const playerX = Position.x[player];
      const playerY = Position.y[player];

      const dx = playerX - bossX;
      const dy = playerY - bossY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= config.outerRadius) {
        // Calculate damage falloff
        let damage: number;
        if (distance <= config.innerRadius) {
          damage = config.damage;
        } else {
          const falloff = 1 - (distance - config.innerRadius) / (config.outerRadius - config.innerRadius);
          damage = config.damage * falloff;
        }

        // Deal damage
        this.eventBus.emit(GameEvents.DAMAGE, {
          source: state.entity,
          target: player,
          amount: damage * damageMultiplier,
          type: DamageType.Physical,
          isCritical: false,
          position: { x: playerX, y: playerY },
        });

        // Apply knockback
        if (distance > 0) {
          const knockbackDir = { x: dx / distance, y: dy / distance };
          Velocity.x[player] += knockbackDir.x * config.knockbackForce;
          Velocity.y[player] += knockbackDir.y * config.knockbackForce;
        }
      }
    }

    // Emit shockwave visual event
    for (let i = 0; i < config.shockwaveRings; i++) {
      const delay = i * 100;
      this.eventBus.emitDelayed(GameEvents.EFFECT_SHOCKWAVE, {
        x: bossX,
        y: bossY,
        radius: config.innerRadius + (config.outerRadius - config.innerRadius) * (i / config.shockwaveRings),
        color: 0xffaa00,
      }, delay);
    }
  }

  // ============================================
  // Warning Indicators
  // ============================================

  private updateWarningIndicators(state: BossState, dt: number): void {
    const toRemove: number[] = [];

    for (const indicator of state.warningIndicators) {
      indicator.elapsed += dt;

      if (indicator.elapsed >= indicator.duration) {
        toRemove.push(indicator.id);
      }
    }

    // Remove expired indicators
    for (const id of toRemove) {
      const index = state.warningIndicators.findIndex(i => i.id === id);
      if (index >= 0) {
        state.warningIndicators.splice(index, 1);
        if (this.onWarningIndicatorRemove) {
          this.onWarningIndicatorRemove(id);
        }
      }
    }
  }

  // ============================================
  // Projectile Management
  // ============================================

  private createBossProjectile(x: number, y: number, vx: number, vy: number, damage: number, owner: EntityId): EntityId {
    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    // Position
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = x;
    Position.y[entity] = y;

    // Velocity
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Velocity, entity);
    Velocity.x[entity] = vx;
    Velocity.y[entity] = vy;

    // Projectile
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Projectile, entity);
    Projectile.damage[entity] = damage;
    Projectile.damageType[entity] = 0; // Physical
    Projectile.pierce[entity] = 0;
    Projectile.lifetime[entity] = 5.0;
    Projectile.ownerEntity[entity] = owner;

    // Sprite
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Sprite, entity);
    Sprite.textureId[entity] = this.hashString('projectile_boss');
    Sprite.width[entity] = 16;
    Sprite.height[entity] = 16;
    Sprite.layer[entity] = 20;
    Sprite.visible[entity] = 1;
    Sprite.alpha[entity] = 1;
    Sprite.tint[entity] = 0xFFFF4400; // Orange

    // Collider
    addComponent(rawWorld as Parameters<typeof addComponent>[0], CircleCollider, entity);
    CircleCollider.radius[entity] = 8;
    CircleCollider.layer[entity] = CollisionLayer.EnemyProjectile;
    CircleCollider.mask[entity] = CollisionLayer.Player;
    CircleCollider.isTrigger[entity] = 1;

    // Tags
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Projectile, entity);

    return entity;
  }

  private updateProjectiles(state: BossState): void {
    // Remove dead projectiles from tracking
    state.projectiles = state.projectiles.filter(entity => {
      return this.world.entityExists(entity) && !hasComponent(this.world.raw as Parameters<typeof hasComponent>[0], Tags.Dead, entity);
    });
  }

  // ============================================
  // Boss Death
  // ============================================

  private handleBossDeath(entity: EntityId): void {
    const state = this.activeBosses.get(entity);
    if (!state) return;

    // Clean up
    this.cleanupBoss(entity);

    // Play victory music
    this.eventBus.emit(GameEvents.PLAY_MUSIC, {
      trackId: 'music_victory',
      fadeIn: 500,
      loop: false,
    });

    // Delayed return to gameplay music
    this.eventBus.emitDelayed(GameEvents.PLAY_MUSIC, {
      trackId: 'music_gameplay',
      fadeIn: 2000,
      loop: true,
    }, 5000);

    // Victory notification
    this.eventBus.emit(GameEvents.SHOW_NOTIFICATION, {
      text: `${state.definition.name} defeated!`,
      type: 'boss_defeat',
      duration: 4000,
    });

    // Screen effects
    this.eventBus.emit(GameEvents.SCREEN_FLASH, {
      color: 0xffffff,
      duration: 200,
    });

    this.eventBus.emit(GameEvents.SCREEN_SLOW_MOTION, {
      factor: 0.3,
      duration: 1000,
    });

    // Remove from tracking
    this.activeBosses.delete(entity);
  }

  private cleanupBoss(entity: EntityId): void {
    const state = this.activeBosses.get(entity);
    if (!state) return;

    // Clean up attack resources
    this.cleanupAttackResources(state);

    // Clean up projectiles
    for (const projectile of state.projectiles) {
      if (this.world.entityExists(projectile)) {
        this.world.removeEntity(projectile);
      }
    }
    state.projectiles = [];
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Get active boss count.
   */
  getActiveBossCount(): number {
    return this.activeBosses.size;
  }

  /**
   * Get boss state by entity.
   */
  getBossState(entity: EntityId): BossState | undefined {
    return this.activeBosses.get(entity);
  }

  /**
   * Get all active boss entities.
   */
  getActiveBossEntities(): EntityId[] {
    return Array.from(this.activeBosses.keys());
  }

  /**
   * Check if entity is a boss.
   */
  isBoss(entity: EntityId): boolean {
    return this.activeBosses.has(entity);
  }

  /**
   * Set minion spawn callback for integration with SpawnManager.
   */
  setMinionSpawnCallback(callback: (minionType: string, x: number, y: number) => EntityId | null): void {
    this.onMinionSpawn = callback;
  }

  /**
   * Set warning indicator callbacks for UI rendering.
   */
  setWarningIndicatorCallbacks(
    onCreate: (indicator: WarningIndicator) => void,
    onRemove: (indicatorId: number) => void
  ): void {
    this.onWarningIndicatorCreate = onCreate;
    this.onWarningIndicatorRemove = onRemove;
  }

  /**
   * Set phase change callback.
   */
  setPhaseChangeCallback(callback: (bossEntity: EntityId, newPhase: number, phaseName: string) => void): void {
    this.onPhaseChange = callback;
  }

  /**
   * Set enrage callback.
   */
  setEnrageCallback(callback: (bossEntity: EntityId) => void): void {
    this.onEnrage = callback;
  }

  /**
   * Force a boss to enter a specific attack (for testing/scripted sequences).
   */
  forceAttack(entity: EntityId, attackType: BossAttackType): void {
    const state = this.activeBosses.get(entity);
    if (!state) return;

    // Cancel current attack
    if (state.attackState) {
      this.cancelAttack(state);
    }

    // Start forced attack
    this.startAttack(state, attackType);
  }

  /**
   * Force a boss to enrage (for testing/scripted sequences).
   */
  forceEnrage(entity: EntityId): void {
    const state = this.activeBosses.get(entity);
    if (!state || state.isEnraged) return;

    this.triggerEnrage(state);
  }

  // ============================================
  // Utility Methods
  // ============================================

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 65535;
  }
}

// ============================================
// Export Factory Function
// ============================================

export function createBossSystem(eventBus: IEventBus): BossSystem {
  return new BossSystem(eventBus);
}
