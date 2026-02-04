/**
 * Core module exports.
 *
 * Exports all core game systems:
 * - Game: Main game orchestrator
 * - EventBus: Event system for decoupled communication
 * - GameLoop: Frame management with fixed timestep
 * - AssetLoader: Asset loading and caching
 * - InputManager: Keyboard and mouse input handling
 */

export { Game } from './Game';
export { EventBus } from './EventBus';
export { GameLoop } from './GameLoop';
export type { GameLoopConfig, GameLoopStats, UpdateCallback, FixedUpdateCallback, RenderCallback } from './GameLoop';
export { AssetLoader } from './AssetLoader';
export type { SpritesheetData } from './AssetLoader';
export { InputManager } from './InputManager';
