/**
 * Particle effect preset configurations.
 * Ready-to-use configurations for common visual effects.
 */

import type { IParticleConfig } from '../shared/interfaces/IRenderer';
import { BlendMode } from '../shared/interfaces/IRenderer';

/**
 * Effect type enum for identifying preset types.
 */
export enum EffectType {
  BloodSplash = 'blood_splash',
  DeathExplosion = 'death_explosion',
  XPCollect = 'xp_collect',
  LevelUp = 'level_up',
  WeaponFire = 'weapon_fire',
  HitSpark = 'hit_spark',
  Heal = 'heal',
  CriticalHit = 'critical_hit',
  ShieldBreak = 'shield_break',
  Poison = 'poison',
  Fire = 'fire',
  Ice = 'ice',
  Lightning = 'lightning',
  // Evolution effects
  Evolution = 'evolution',
  EvolutionReady = 'evolution_ready',
  // Boss effects
  BossSpawn = 'boss_spawn',
  BossPhaseChange = 'boss_phase_change',
  BossEnrage = 'boss_enrage',
  BossSlam = 'boss_slam',
  BossLaser = 'boss_laser',
  BossSummon = 'boss_summon',
  WarningIndicator = 'warning_indicator',
  Shockwave = 'shockwave',
}

/**
 * Extended particle config with additional effect-specific options.
 */
export interface ParticlePresetConfig extends Omit<IParticleConfig, 'x' | 'y'> {
  /** Duration of the effect in ms (for one-shot effects) */
  duration?: number;
  /** Whether this is a one-shot effect */
  oneShot?: boolean;
  /** Sound effect to play */
  sfxId?: string;
  /** Screen shake intensity (0 = none) */
  screenShake?: number;
  /** Screen shake duration in ms */
  screenShakeDuration?: number;
}

/**
 * Particle presets for common game effects.
 */
export const ParticlePresets: Record<EffectType, ParticlePresetConfig> = {
  [EffectType.BloodSplash]: {
    key: 'particle_blood',
    quantity: 8,
    frequency: -1, // One-shot
    lifespan: 400,
    speed: { min: 80, max: 150 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: [0xff0000, 0xcc0000, 0x990000],
    blendMode: BlendMode.Normal,
    gravityY: 200,
    oneShot: true,
    duration: 400,
  },

  [EffectType.DeathExplosion]: {
    key: 'particle_explosion',
    quantity: 20,
    frequency: -1,
    lifespan: 600,
    speed: { min: 100, max: 250 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.0, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xff6600, 0xffaa00, 0xffff00],
    blendMode: BlendMode.Add,
    gravityY: 50,
    oneShot: true,
    duration: 600,
    screenShake: 5,
    screenShakeDuration: 200,
    sfxId: 'explosion_small',
  },

  [EffectType.XPCollect]: {
    key: 'particle_xp',
    quantity: 6,
    frequency: -1,
    lifespan: 500,
    speed: { min: 30, max: 80 },
    angle: { min: 250, max: 290 }, // Mostly upward
    scale: { start: 0.5, end: 0.2 },
    alpha: { start: 1, end: 0 },
    tint: [0x00ff00, 0x44ff44, 0x88ff88],
    blendMode: BlendMode.Add,
    gravityY: -50,
    oneShot: true,
    duration: 500,
    sfxId: 'xp_collect',
  },

  [EffectType.LevelUp]: {
    key: 'particle_levelup',
    quantity: 30,
    frequency: -1,
    lifespan: 1200,
    speed: { min: 50, max: 150 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffff00, 0xffd700, 0xffa500],
    blendMode: BlendMode.Add,
    gravityY: -100,
    oneShot: true,
    duration: 1200,
    screenShake: 3,
    screenShakeDuration: 100,
    sfxId: 'level_up',
  },

  [EffectType.WeaponFire]: {
    key: 'particle_muzzle',
    quantity: 5,
    frequency: -1,
    lifespan: 100,
    speed: { min: 100, max: 200 },
    angle: { min: -15, max: 15 }, // Forward direction
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: [0xffff00, 0xffaa00],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 100,
  },

  [EffectType.HitSpark]: {
    key: 'particle_spark',
    quantity: 6,
    frequency: -1,
    lifespan: 200,
    speed: { min: 100, max: 200 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.4, end: 0.05 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, 0xffffcc],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 200,
  },

  [EffectType.Heal]: {
    key: 'particle_heal',
    quantity: 10,
    frequency: -1,
    lifespan: 800,
    speed: { min: 20, max: 60 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 0.8, end: 0 },
    tint: [0x00ff00, 0x00ff88, 0x00ffcc],
    blendMode: BlendMode.Add,
    gravityY: -80,
    oneShot: true,
    duration: 800,
    sfxId: 'heal',
  },

  [EffectType.CriticalHit]: {
    key: 'particle_crit',
    quantity: 12,
    frequency: -1,
    lifespan: 400,
    speed: { min: 150, max: 300 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: [0xffff00, 0xff8800, 0xff4400],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 400,
    screenShake: 2,
    screenShakeDuration: 100,
  },

  [EffectType.ShieldBreak]: {
    key: 'particle_shield',
    quantity: 15,
    frequency: -1,
    lifespan: 500,
    speed: { min: 100, max: 200 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.7, end: 0.1 },
    alpha: { start: 0.9, end: 0 },
    tint: [0x00aaff, 0x0088ff, 0x0066ff],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 500,
    screenShake: 4,
    screenShakeDuration: 150,
    sfxId: 'shield_break',
  },

  [EffectType.Poison]: {
    key: 'particle_poison',
    quantity: 3,
    frequency: 200,
    lifespan: 600,
    speed: { min: 10, max: 30 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.4, end: 0.1 },
    alpha: { start: 0.7, end: 0 },
    tint: [0x00ff00, 0x44ff00, 0x88aa00],
    blendMode: BlendMode.Add,
    gravityY: -30,
    oneShot: false,
  },

  [EffectType.Fire]: {
    key: 'particle_fire',
    quantity: 4,
    frequency: 50,
    lifespan: 400,
    speed: { min: 20, max: 50 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xff4400, 0xff6600, 0xffaa00],
    blendMode: BlendMode.Add,
    gravityY: -100,
    oneShot: false,
  },

  [EffectType.Ice]: {
    key: 'particle_ice',
    quantity: 3,
    frequency: 150,
    lifespan: 500,
    speed: { min: 10, max: 40 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.5, end: 0.2 },
    alpha: { start: 0.8, end: 0 },
    tint: [0x88ccff, 0xaaddff, 0xffffff],
    blendMode: BlendMode.Add,
    gravityY: 20,
    oneShot: false,
  },

  [EffectType.Lightning]: {
    key: 'particle_lightning',
    quantity: 8,
    frequency: -1,
    lifespan: 150,
    speed: { min: 200, max: 400 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.5, end: 0.05 },
    alpha: { start: 1, end: 0 },
    tint: [0x00ffff, 0x88ffff, 0xffffff],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 150,
  },

  [EffectType.Evolution]: {
    key: 'particle_evolution',
    quantity: 50,
    frequency: -1,
    lifespan: 1500,
    speed: { min: 80, max: 200 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.2, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffd700, 0xffaa00, 0xff6600, 0xffffff],
    blendMode: BlendMode.Add,
    gravityY: -50,
    oneShot: true,
    duration: 1500,
    screenShake: 8,
    screenShakeDuration: 300,
    sfxId: 'evolution_complete',
  },

  [EffectType.EvolutionReady]: {
    key: 'particle_evolution_ready',
    quantity: 20,
    frequency: 100,
    lifespan: 800,
    speed: { min: 30, max: 60 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xffd700, 0xffcc00, 0xffaa00],
    blendMode: BlendMode.Add,
    gravityY: -80,
    oneShot: false,
    sfxId: 'evolution_ready',
  },

  // ============================================
  // Boss Effects
  // ============================================

  [EffectType.BossSpawn]: {
    key: 'particle_boss_spawn',
    quantity: 60,
    frequency: -1,
    lifespan: 1500,
    speed: { min: 100, max: 300 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.5, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xff0000, 0xff4400, 0xff8800, 0x220000],
    blendMode: BlendMode.Add,
    gravityY: -30,
    oneShot: true,
    duration: 1500,
    screenShake: 10,
    screenShakeDuration: 500,
    sfxId: 'boss_spawn',
  },

  [EffectType.BossPhaseChange]: {
    key: 'particle_boss_phase',
    quantity: 40,
    frequency: -1,
    lifespan: 1000,
    speed: { min: 150, max: 350 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.2, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: [0xff00ff, 0xff44ff, 0xaa00aa, 0xffffff],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 1000,
    screenShake: 8,
    screenShakeDuration: 400,
    sfxId: 'boss_phase_change',
  },

  [EffectType.BossEnrage]: {
    key: 'particle_boss_enrage',
    quantity: 80,
    frequency: -1,
    lifespan: 1200,
    speed: { min: 200, max: 450 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.8, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xff0000, 0xff2200, 0xff4400, 0xffff00],
    blendMode: BlendMode.Add,
    gravityY: -50,
    oneShot: true,
    duration: 1200,
    screenShake: 12,
    screenShakeDuration: 500,
    sfxId: 'boss_enrage',
  },

  [EffectType.BossSlam]: {
    key: 'particle_boss_slam',
    quantity: 50,
    frequency: -1,
    lifespan: 800,
    speed: { min: 200, max: 500 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.4, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffaa00, 0xff8800, 0xff6600, 0xffff00],
    blendMode: BlendMode.Add,
    gravityY: 100,
    oneShot: true,
    duration: 800,
    screenShake: 15,
    screenShakeDuration: 400,
    sfxId: 'boss_slam_impact',
  },

  [EffectType.BossLaser]: {
    key: 'particle_boss_laser',
    quantity: 8,
    frequency: 30,
    lifespan: 300,
    speed: { min: 50, max: 100 },
    angle: { min: -30, max: 30 },
    scale: { start: 0.8, end: 0.1 },
    alpha: { start: 1, end: 0 },
    tint: [0xff0000, 0xff4400, 0xffff00],
    blendMode: BlendMode.Add,
    oneShot: false,
  },

  [EffectType.BossSummon]: {
    key: 'particle_boss_summon',
    quantity: 25,
    frequency: -1,
    lifespan: 600,
    speed: { min: 30, max: 80 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xff00ff, 0xaa00ff, 0x8800ff, 0xffffff],
    blendMode: BlendMode.Add,
    gravityY: -100,
    oneShot: true,
    duration: 600,
    sfxId: 'boss_summon',
  },

  [EffectType.WarningIndicator]: {
    key: 'particle_warning',
    quantity: 10,
    frequency: 50,
    lifespan: 400,
    speed: { min: 20, max: 50 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.5, end: 0.1 },
    alpha: { start: 0.8, end: 0 },
    tint: [0xff0000, 0xff4400, 0xffaa00],
    blendMode: BlendMode.Add,
    oneShot: false,
  },

  [EffectType.Shockwave]: {
    key: 'particle_shockwave',
    quantity: 30,
    frequency: -1,
    lifespan: 500,
    speed: { min: 300, max: 500 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.6, end: 0 },
    alpha: { start: 0.8, end: 0 },
    tint: [0xffaa00, 0xff8800, 0xffffff],
    blendMode: BlendMode.Add,
    oneShot: true,
    duration: 500,
  },
};

/**
 * Get a particle preset config with position.
 */
export function getPresetConfig(
  type: EffectType,
  x: number,
  y: number
): IParticleConfig {
  const preset = ParticlePresets[type];
  return {
    key: preset.key,
    x,
    y,
    quantity: preset.quantity,
    frequency: preset.frequency,
    lifespan: preset.lifespan,
    speed: preset.speed,
    angle: preset.angle,
    scale: preset.scale,
    alpha: preset.alpha,
    tint: preset.tint,
    blendMode: preset.blendMode,
    gravityX: preset.gravityX,
    gravityY: preset.gravityY,
  };
}

/**
 * Create particle keys array for asset loading.
 */
export function getParticleAssetKeys(): string[] {
  const keys = new Set<string>();

  Object.values(ParticlePresets).forEach((preset) => {
    keys.add(preset.key);
  });

  return Array.from(keys);
}
