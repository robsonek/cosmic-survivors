/**
 * Effects Module for Cosmic Survivors.
 *
 * This module provides visual effects including:
 * - ParticleSystem: ECS-integrated particle emitter management
 * - ParticlePresets: Pre-configured particle effects
 * - ScreenEffects: Screen-wide visual effects (shake, flash, vignette)
 * - TrailRenderer: Motion trails for projectiles and fast entities
 * - TrailEffects: Advanced trail effects (afterimages, death explosions, XP sparkles)
 * - DamageNumberRenderer: Floating combat text
 * - EffectsManager: Central coordinator for all effects
 */

// Core systems
export { ParticleSystem } from './ParticleSystem';
export { ScreenEffects } from './ScreenEffects';
export { GameScreenEffects } from './GameScreenEffects';
export { TrailRenderer } from './TrailRenderer';
export { TrailEffects } from './TrailEffects';
export { DamageNumberRenderer, DamageNumberType } from './DamageNumberRenderer';
export { EffectsManager } from './EffectsManager';

// Presets and configuration
export {
  ParticlePresets,
  EffectType,
  getPresetConfig,
  getParticleAssetKeys,
} from './ParticlePresets';

// Types
export type {
  ParticlePresetConfig,
} from './ParticlePresets';

export type {
  ShakeConfig,
  VignetteConfig,
  ChromaticAberrationConfig,
  SlowMotionConfig,
  HitStopConfig,
  KillStreakConfig,
} from './ScreenEffects';

export type {
  TrailConfig,
} from './TrailRenderer';

export type {
  PlayerTrailConfig,
  ProjectileTrailConfig,
  DeathExplosionConfig,
  XPAbsorptionConfig,
  WeaponGlowConfig,
  CriticalHitConfig,
} from './TrailEffects';

export type {
  DamageNumberConfig,
} from './DamageNumberRenderer';

export type {
  EffectOptions,
  EffectsConfig,
} from './EffectsManager';

// ============================================
// Factory Functions
// ============================================

import type { Renderer } from '../rendering/Renderer';
import type { Camera } from '../rendering/Camera';
import type { IEventBus } from '../shared/interfaces/IEventBus';
import { EffectsManager, type EffectsConfig } from './EffectsManager';

/**
 * Create effects module with all systems initialized.
 */
export interface EffectsModule {
  effectsManager: EffectsManager;
}

/**
 * Create effects module.
 */
export function createEffectsModule(
  renderer: Renderer,
  camera: Camera,
  eventBus?: IEventBus,
  config?: EffectsConfig
): EffectsModule {
  const effectsManager = new EffectsManager(renderer, camera, config);

  if (eventBus) {
    effectsManager.init(eventBus);
  }

  return {
    effectsManager,
  };
}

/**
 * System priorities for effects systems.
 * Effects should update after physics and rendering.
 */
export const EFFECTS_PRIORITIES = {
  PARTICLE_SYSTEM: 105,
  SCREEN_EFFECTS: 110,
  TRAIL_RENDERER: 106,
  TRAIL_EFFECTS: 107,
  DAMAGE_NUMBERS: 108,
} as const;
