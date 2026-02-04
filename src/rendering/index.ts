/**
 * Rendering Module for Cosmic Survivors.
 *
 * This module provides all rendering functionality using Phaser 4 as the backend.
 * It integrates with the bitECS system through the SpriteSystem and AnimationSystem.
 *
 * Main components:
 * - Camera: Handles camera positioning, follow, shake, flash, and fade effects
 * - Renderer: Main Phaser 4 wrapper for sprite and particle management
 * - SpriteSystem: ECS system for synchronizing sprites with entity positions
 * - AnimationSystem: ECS system for updating sprite animations
 * - AnimationManager: Registry for animation definitions
 */

// Core classes
import { Camera as CameraClass } from './Camera';
import { Renderer as RendererClass } from './Renderer';
import { SpriteSystem as SpriteSystemClass } from './SpriteSystem';
import { AnimationSystem as AnimationSystemClass } from './AnimationSystem';
import { AnimationManager as AnimationManagerClass } from './AnimationManager';

export { CameraClass as Camera };
export { RendererClass as Renderer };
export { SpriteSystemClass as SpriteSystem };
export { AnimationSystemClass as AnimationSystem };
export { AnimationManagerClass as AnimationManager };

export type {
  AnimationFrame,
  AnimationDefinition,
  SpriteSheetAnimationConfig,
  FrameNamesAnimationConfig,
} from './AnimationManager';

// Re-export render-related types from shared
export {
  RenderLayer,
  BlendMode,
} from '../shared/interfaces/IRenderer';

export type {
  ICamera,
  IRenderer,
  ISpriteConfig,
  IParticleConfig,
  IParticleEmitter,
} from '../shared/interfaces/IRenderer';

/**
 * Factory function to create all rendering components.
 */
export interface RenderingConfig {
  width: number;
  height: number;
  parent: HTMLElement | string;
  backgroundColor?: number;
}

export interface RenderingModule {
  renderer: RendererClass;
  camera: CameraClass;
  spriteSystem: SpriteSystemClass;
  animationSystem: AnimationSystemClass;
  animationManager: AnimationManagerClass;
}

/**
 * Create all rendering components at once.
 */
export async function createRenderingModule(config: RenderingConfig): Promise<RenderingModule> {
  // Create animation manager
  const animationManager = new AnimationManagerClass();

  // Create renderer
  const renderer = new RendererClass({
    width: config.width,
    height: config.height,
    parent: config.parent,
    backgroundColor: config.backgroundColor,
  });

  // Initialize renderer
  await renderer.init();

  // Get camera reference
  const camera = renderer.camera as CameraClass;

  // Create ECS systems
  const spriteSystem = new SpriteSystemClass(renderer);
  const animationSystem = new AnimationSystemClass(renderer, animationManager);

  return {
    renderer,
    camera,
    spriteSystem,
    animationSystem,
    animationManager,
  };
}

/**
 * System priorities for rendering systems.
 * Rendering should happen after physics and AI.
 */
export const RENDERING_PRIORITIES = {
  ANIMATION_SYSTEM: 95,
  SPRITE_SYSTEM: 100,
} as const;
