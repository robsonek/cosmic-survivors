/**
 * Main Game class - orchestrates all subsystems.
 *
 * Integrates:
 * - EventBus for decoupled communication
 * - World (ECS) for entity management
 * - AssetLoader for resource loading
 * - InputManager for player input
 * - GameLoop for frame management
 */

import type {
  IGame,
  IGameConfig,
  IGameStartOptions,
  IAssetLoader,
  IAssetManifest,
  IInputManager,
  AssetType,
} from '@shared/interfaces/IGame';
import { GameState, defaultGameConfig } from '@shared/interfaces/IGame';
import type { IWorld } from '@shared/interfaces/IWorld';
import type { IRenderer, ICamera } from '@shared/interfaces/IRenderer';
import type { IPhysicsSystem } from '@shared/interfaces/IPhysics';
import type { IEventBus } from '@shared/interfaces/IEventBus';
import type { INetworkManager } from '@shared/interfaces/INetworking';
import type { IAudioManager } from '@shared/interfaces/IAudio';
import type { IUIManager } from '@shared/interfaces/IUI';
import type { IWeaponSystem } from '@shared/interfaces/IWeapon';
import { GameEvents } from '@shared/interfaces/IEventBus';

import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { AssetLoader } from './AssetLoader';
import { InputManager } from './InputManager';
import { World } from '../ecs/World';

/**
 * Main Game class for Cosmic Survivors.
 */
export class Game implements IGame {
  /** Current game state */
  private _state: GameState = GameState.Loading;

  /** Game configuration */
  private _config: IGameConfig;

  /** Frame counter */
  private _frame = 0;

  /** Total elapsed time */
  private _time = 0;

  /** Current delta time */
  private _dt = 0;

  /** Current FPS */
  private _fps = 0;

  /** Whether game is paused */
  private _isPaused = false;

  /** Whether in multiplayer mode */
  private _isMultiplayer = false;

  // Core systems (always initialized)
  private _events!: EventBus;
  private _world!: World;
  private _assetLoader!: AssetLoader;
  private _inputManager!: InputManager;
  private _gameLoop!: GameLoop;

  // Subsystems (initialized later by other agents)
  private _renderer!: IRenderer;
  private _physics!: IPhysicsSystem;
  private _network!: INetworkManager;
  private _audio!: IAudioManager;
  private _ui!: IUIManager;
  private _weapons!: IWeaponSystem;

  constructor(config: Partial<IGameConfig> = {}) {
    this._config = { ...defaultGameConfig, ...config };
  }

  // ============================================
  // Getters (IGame interface)
  // ============================================

  get state(): GameState {
    return this._state;
  }

  get config(): IGameConfig {
    return this._config;
  }

  get world(): IWorld {
    return this._world;
  }

  get renderer(): IRenderer {
    return this._renderer;
  }

  get camera(): ICamera {
    return this._renderer?.camera;
  }

  get physics(): IPhysicsSystem {
    return this._physics;
  }

  get events(): IEventBus {
    return this._events;
  }

  get network(): INetworkManager {
    return this._network;
  }

  get audio(): IAudioManager {
    return this._audio;
  }

  get ui(): IUIManager {
    return this._ui;
  }

  get weapons(): IWeaponSystem {
    return this._weapons;
  }

  get frame(): number {
    return this._frame;
  }

  get time(): number {
    return this._time;
  }

  get dt(): number {
    return this._dt;
  }

  get fps(): number {
    return this._fps;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isMultiplayer(): boolean {
    return this._isMultiplayer;
  }

  // Additional getters for core systems
  get assetLoader(): IAssetLoader {
    return this._assetLoader;
  }

  get input(): IInputManager {
    return this._inputManager;
  }

  get gameLoop(): GameLoop {
    return this._gameLoop;
  }

  // ============================================
  // Lifecycle Methods
  // ============================================

  /**
   * Initialize the game and all core systems.
   */
  async init(): Promise<void> {
    console.log('[Game] Initializing Cosmic Survivors...');

    // 1. Create EventBus first (other systems may need it)
    this._events = new EventBus();
    console.log('[Game] EventBus created');

    // 2. Create AssetLoader
    this._assetLoader = new AssetLoader(this._config.assetPath);
    console.log('[Game] AssetLoader created');

    // 3. Create InputManager
    const container = this.getContainer();
    this._inputManager = new InputManager(container || window);
    console.log('[Game] InputManager created');

    // 4. Create ECS World
    this._world = new World();
    console.log('[Game] ECS World created');

    // 5. Create GameLoop
    this._gameLoop = new GameLoop({
      targetFPS: this._config.targetFPS,
      fixedUpdateRate: this._config.fixedUpdateRate,
    });

    // Set up game loop callbacks
    this._gameLoop.setUpdateCallback((dt) => this.update(dt));
    this._gameLoop.setFixedUpdateCallback((fixedDt) => this.fixedUpdate(fixedDt));
    this._gameLoop.setRenderCallback((interpolation) => this.render(interpolation));
    console.log('[Game] GameLoop created');

    // 6. Initialize ECS World
    await this._world.init();
    console.log('[Game] ECS World initialized');

    // Transition to main menu
    this._state = GameState.MainMenu;
    console.log('[Game] Initialization complete, state: MainMenu');
  }

  /**
   * Load assets from manifest.
   * @param manifest Asset manifest
   */
  async loadAssets(manifest: IAssetManifest): Promise<void> {
    console.log('[Game] Loading assets...');

    this._assetLoader.onProgress((progress) => {
      console.log(`[Game] Loading progress: ${Math.round(progress * 100)}%`);
      // Emit progress event for UI
      this._events.emit('asset:progress', { progress });
    });

    await this._assetLoader.loadManifest(manifest);
    console.log('[Game] Assets loaded');
  }

  /**
   * Start the game loop.
   */
  start(): void {
    if (this._gameLoop.isRunning) {
      console.warn('[Game] Game loop already running');
      return;
    }

    console.log('[Game] Starting game loop');
    this._gameLoop.start();
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    console.log('[Game] Stopping game loop');
    this._gameLoop.stop();
  }

  /**
   * Pause the game.
   */
  pause(): void {
    if (this._isPaused) return;

    this._isPaused = true;
    this._state = GameState.Paused;
    this._gameLoop.pause();

    this._events.emit(GameEvents.GAME_PAUSE, {});
    console.log('[Game] Game paused');
  }

  /**
   * Resume the game.
   */
  resume(): void {
    if (!this._isPaused) return;

    this._isPaused = false;
    this._state = GameState.Playing;
    this._gameLoop.resume();

    this._events.emit(GameEvents.GAME_RESUME, {});
    console.log('[Game] Game resumed');
  }

  /**
   * Change game state.
   * @param state New game state
   */
  setState(state: GameState): void {
    const previousState = this._state;
    this._state = state;

    console.log(`[Game] State changed: ${previousState} -> ${state}`);

    // Handle state transitions
    if (state === GameState.Paused) {
      this._isPaused = true;
      this._gameLoop.pause();
    } else if (previousState === GameState.Paused) {
      this._isPaused = false;
      this._gameLoop.resume();
    }
  }

  /**
   * Clean up and destroy the game.
   */
  destroy(): void {
    console.log('[Game] Destroying game...');

    // Stop game loop
    this._gameLoop.stop();

    // Destroy input manager
    this._inputManager.destroy();

    // Clear events
    this._events.clearAll();

    // Destroy world
    this._world.destroy();

    // Clear assets
    this._assetLoader.clear();

    console.log('[Game] Game destroyed');
  }

  // ============================================
  // Game Session Methods
  // ============================================

  /**
   * Start a new game session.
   * @param options Game start options
   */
  async startGame(options?: IGameStartOptions): Promise<void> {
    console.log('[Game] Starting new game session', options);

    this._state = GameState.Playing;
    this._isPaused = false;
    this._isMultiplayer = !!options?.matchId;

    // Reset time and frame counters
    this._time = 0;
    this._frame = 0;
    this._gameLoop.reset();

    // TODO: Initialize game session
    // - Create player entity
    // - Set starting weapons
    // - Initialize wave system
    // - Start multiplayer connection if needed

    // Start the loop if not running
    if (!this._gameLoop.isRunning) {
      this.start();
    }
  }

  /**
   * End current game session.
   * @param victory Whether player won
   */
  endGame(victory: boolean): void {
    console.log(`[Game] Game ended, victory: ${victory}`);

    this._state = victory ? GameState.Victory : GameState.GameOver;

    // Emit appropriate event
    if (victory) {
      this._events.emit(GameEvents.GAME_WIN, {
        time: this._time,
        frame: this._frame,
      });
    } else {
      this._events.emit(GameEvents.GAME_OVER, {
        time: this._time,
        frame: this._frame,
      });
    }
  }

  /**
   * Restart current game.
   */
  async restart(): Promise<void> {
    console.log('[Game] Restarting game');

    // Clean up current session
    this._world.destroy();

    // Reinitialize world
    this._world = new World();
    await this._world.init();

    // Start new game with same options
    await this.startGame();
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get system by name from world.
   * @param name System name
   */
  getSystem<T>(name: string): T | undefined {
    return this._world.getSystem(name) as T | undefined;
  }

  /**
   * Check if asset is loaded.
   * @param key Asset key
   */
  isAssetLoaded(key: string): boolean {
    return this._assetLoader.has(key);
  }

  /**
   * Load a single asset at runtime.
   * @param type Asset type
   * @param key Asset key
   * @param url Asset URL
   */
  async loadAsset(type: AssetType, key: string, url: string): Promise<void> {
    await this._assetLoader.load(type, key, url);
  }

  /**
   * Get a loaded asset.
   * @param key Asset key
   */
  getAsset<T>(key: string): T | undefined {
    return this._assetLoader.get<T>(key);
  }

  // ============================================
  // Subsystem Registration (for other agents)
  // ============================================

  /**
   * Set renderer subsystem.
   */
  setRenderer(renderer: IRenderer): void {
    this._renderer = renderer;
    console.log('[Game] Renderer set');
  }

  /**
   * Set physics subsystem.
   */
  setPhysics(physics: IPhysicsSystem): void {
    this._physics = physics;
    console.log('[Game] Physics set');
  }

  /**
   * Set network manager.
   */
  setNetwork(network: INetworkManager): void {
    this._network = network;
    console.log('[Game] Network manager set');
  }

  /**
   * Set audio manager.
   */
  setAudio(audio: IAudioManager): void {
    this._audio = audio;
    console.log('[Game] Audio manager set');
  }

  /**
   * Set UI manager.
   */
  setUI(ui: IUIManager): void {
    this._ui = ui;
    console.log('[Game] UI manager set');
  }

  /**
   * Set weapon system.
   */
  setWeapons(weapons: IWeaponSystem): void {
    this._weapons = weapons;
    console.log('[Game] Weapon system set');
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Main update tick (variable timestep).
   */
  private update(dt: number): void {
    this._dt = dt;
    this._time = this._gameLoop.time;
    this._frame = this._gameLoop.frame;
    this._fps = this._gameLoop.fps;

    // Update input first
    this._inputManager.update();

    // Update world context
    this._world.updateContext({
      frame: this._frame,
      time: this._time,
      dt,
      isAuthority: !this._isMultiplayer || this._network?.isAuthority,
    });

    // Update all systems
    if (this._state === GameState.Playing && !this._isPaused) {
      this._world.update(dt);
    }
  }

  /**
   * Fixed update tick (fixed timestep for physics).
   */
  private fixedUpdate(fixedDt: number): void {
    if (this._state === GameState.Playing && !this._isPaused) {
      this._world.fixedUpdate(fixedDt);
    }
  }

  /**
   * Render tick.
   * @param _interpolation Interpolation factor for smooth rendering
   */
  private render(_interpolation: number): void {
    // Rendering will be handled by Agent-Rendering
    // The renderer system will be registered with the world
    // and will be called during world.update() with lateUpdate

    if (this._renderer) {
      // Renderer will handle its own rendering
      // This is just a hook for any additional render logic
    }
  }

  /**
   * Get the container element.
   */
  private getContainer(): HTMLElement | null {
    if (typeof this._config.parent === 'string') {
      return document.getElementById(this._config.parent);
    }
    return this._config.parent;
  }
}
