import type { IWorld } from './IWorld';
import type { IRenderer, ICamera } from './IRenderer';
import type { IPhysicsSystem } from './IPhysics';
import type { IEventBus } from './IEventBus';
import type { INetworkManager } from './INetworking';
import type { IAudioManager } from './IAudio';
import type { IUIManager } from './IUI';
import type { IWeaponSystem } from './IWeapon';

/**
 * Game state.
 */
export enum GameState {
  Loading = 'loading',
  MainMenu = 'mainMenu',
  Lobby = 'lobby',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'gameOver',
  Victory = 'victory',
}

/**
 * Game configuration.
 */
export interface IGameConfig {
  /** Target container element */
  parent: string | HTMLElement;

  /** Game width */
  width: number;

  /** Game height */
  height: number;

  /** Background color */
  backgroundColor: number;

  /** Enable debug mode */
  debug: boolean;

  /** Target FPS */
  targetFPS: number;

  /** Fixed update rate (Hz) */
  fixedUpdateRate: number;

  /** Use WebGPU if available */
  preferWebGPU: boolean;

  /** Max entities for ECS */
  maxEntities: number;

  /** Server URL for multiplayer */
  serverUrl?: string;

  /** Asset base path */
  assetPath: string;
}

/**
 * Default game configuration.
 */
export const defaultGameConfig: IGameConfig = {
  parent: 'game-container',
  width: 1920,
  height: 1080,
  backgroundColor: 0x0a0a0f,
  debug: false,
  targetFPS: 60,
  fixedUpdateRate: 60,
  preferWebGPU: true,
  maxEntities: 10000,
  assetPath: '/assets',
};

/**
 * Main game interface.
 * Provides access to all subsystems.
 */
export interface IGame {
  /** Current game state */
  readonly state: GameState;

  /** Game configuration */
  readonly config: IGameConfig;

  /** ECS World */
  readonly world: IWorld;

  /** Renderer subsystem */
  readonly renderer: IRenderer;

  /** Camera */
  readonly camera: ICamera;

  /** Physics subsystem */
  readonly physics: IPhysicsSystem;

  /** Event bus */
  readonly events: IEventBus;

  /** Network manager */
  readonly network: INetworkManager;

  /** Audio manager */
  readonly audio: IAudioManager;

  /** UI manager */
  readonly ui: IUIManager;

  /** Weapon system */
  readonly weapons: IWeaponSystem;

  /** Current frame number */
  readonly frame: number;

  /** Total elapsed time in seconds */
  readonly time: number;

  /** Current delta time */
  readonly dt: number;

  /** Current FPS */
  readonly fps: number;

  /** Whether game is paused */
  readonly isPaused: boolean;

  /** Whether game is in multiplayer mode */
  readonly isMultiplayer: boolean;

  // Lifecycle

  /**
   * Initialize the game.
   */
  init(): Promise<void>;

  /**
   * Start the game loop.
   */
  start(): void;

  /**
   * Stop the game loop.
   */
  stop(): void;

  /**
   * Pause the game.
   */
  pause(): void;

  /**
   * Resume the game.
   */
  resume(): void;

  /**
   * Change game state.
   */
  setState(state: GameState): void;

  /**
   * Clean up and destroy the game.
   */
  destroy(): void;

  // Scene Management

  /**
   * Start a new game session.
   */
  startGame(options?: IGameStartOptions): Promise<void>;

  /**
   * End current game session.
   */
  endGame(victory: boolean): void;

  /**
   * Restart current game.
   */
  restart(): Promise<void>;

  // Utility

  /**
   * Get system by name.
   */
  getSystem<T>(name: string): T | undefined;

  /**
   * Check if asset is loaded.
   */
  isAssetLoaded(key: string): boolean;

  /**
   * Load asset at runtime.
   */
  loadAsset(type: AssetType, key: string, url: string): Promise<void>;
}

/**
 * Options for starting a game.
 */
export interface IGameStartOptions {
  /** Character ID to play */
  characterId?: string;

  /** Starting weapons */
  startingWeapons?: string[];

  /** Seed for procedural generation */
  seed?: number;

  /** Match ID for multiplayer */
  matchId?: string;

  /** Difficulty preset */
  difficulty?: DifficultyPreset;
}

export enum DifficultyPreset {
  Easy = 'easy',
  Normal = 'normal',
  Hard = 'hard',
  Nightmare = 'nightmare',
}

export enum AssetType {
  Image = 'image',
  Spritesheet = 'spritesheet',
  Audio = 'audio',
  JSON = 'json',
  Font = 'font',
  Shader = 'shader',
}

/**
 * Asset manifest for preloading.
 */
export interface IAssetManifest {
  images: Array<{ key: string; url: string }>;
  spritesheets: Array<{
    key: string;
    url: string;
    frameWidth: number;
    frameHeight: number;
    frameCount?: number;
  }>;
  audio: Array<{ key: string; url: string }>;
  json: Array<{ key: string; url: string }>;
  fonts: Array<{ key: string; url: string }>;
}

/**
 * Asset loader interface.
 */
export interface IAssetLoader {
  /** Loading progress (0-1) */
  readonly progress: number;

  /** Whether loading is complete */
  readonly isComplete: boolean;

  /**
   * Load assets from manifest.
   */
  loadManifest(manifest: IAssetManifest): Promise<void>;

  /**
   * Load single asset.
   */
  load(type: AssetType, key: string, url: string): Promise<void>;

  /**
   * Get loaded asset.
   */
  get<T>(key: string): T | undefined;

  /**
   * Check if asset is loaded.
   */
  has(key: string): boolean;

  /**
   * Unload asset.
   */
  unload(key: string): void;

  /**
   * Clear all assets.
   */
  clear(): void;

  /**
   * Register progress callback.
   */
  onProgress(callback: (progress: number) => void): void;
}

/**
 * Input state snapshot.
 */
export interface IInputState {
  /** Movement direction (-1 to 1) */
  moveX: number;
  moveY: number;

  /** Aim direction (normalized) */
  aimX: number;
  aimY: number;

  /** Mouse/pointer position */
  pointerX: number;
  pointerY: number;

  /** Mouse/pointer world position */
  worldPointerX: number;
  worldPointerY: number;

  /** Is primary action pressed */
  primaryAction: boolean;

  /** Is secondary action pressed */
  secondaryAction: boolean;

  /** Keys currently pressed */
  keysDown: Set<string>;

  /** Keys pressed this frame */
  keysPressed: Set<string>;

  /** Keys released this frame */
  keysReleased: Set<string>;
}

/**
 * Input manager interface.
 */
export interface IInputManager {
  /** Current input state */
  readonly state: IInputState;

  /** Whether using gamepad */
  readonly usingGamepad: boolean;

  /**
   * Update input state (called each frame).
   */
  update(): void;

  /**
   * Check if key is currently down.
   */
  isKeyDown(key: string): boolean;

  /**
   * Check if key was pressed this frame.
   */
  isKeyPressed(key: string): boolean;

  /**
   * Check if key was released this frame.
   */
  isKeyReleased(key: string): boolean;

  /**
   * Get movement vector.
   */
  getMovement(): { x: number; y: number };

  /**
   * Get aim direction.
   */
  getAimDirection(): { x: number; y: number };

  /**
   * Set key bindings.
   */
  setBindings(bindings: Record<string, string>): void;

  /**
   * Enable/disable input.
   */
  setEnabled(enabled: boolean): void;
}
