/**
 * Effects Module for Cosmic Survivors.
 *
 * This module provides visual effects including:
 * - ParticleSystem: ECS-integrated particle emitter management
 * - ParticlePresets: Pre-configured particle effects
 * - ScreenEffects: Screen-wide visual effects (shake, flash, vignette)
 * - TrailRenderer: Motion trails for projectiles and fast entities
 * - DamageNumberRenderer: Floating combat text
 * - EffectsManager: Central coordinator for all effects
 */

// Core systems
export { ParticleSystem } from './ParticleSystem';
export { ScreenEffects } from './ScreenEffects';
export { TrailRenderer } from './TrailRenderer';
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
} from './ScreenEffects';

export type {
  TrailConfig,
} from './TrailRenderer';

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
  DAMAGE_NUMBERS: 107,
} as const;
