/**
 * GameLoop - Main game loop with fixed timestep physics.
 *
 * Features:
 * - requestAnimationFrame-based rendering
 * - Fixed timestep for physics (60Hz default)
 * - Delta time capping to prevent spiral of death
 * - FPS counting and monitoring
 * - Pause/resume support
 */

import { FIXED_UPDATE_RATE } from '@shared/constants/game';

/**
 * Callback types for game loop.
 */
export type UpdateCallback = (dt: number) => void;
export type FixedUpdateCallback = (fixedDt: number) => void;
export type RenderCallback = (interpolation: number) => void;

/**
 * Game loop configuration.
 */
export interface GameLoopConfig {
  /** Target FPS for rendering */
  targetFPS?: number;
  /** Fixed update rate in Hz */
  fixedUpdateRate?: number;
  /** Maximum delta time in seconds */
  maxDeltaTime?: number;
  /** FPS sample count for averaging */
  fpsSampleCount?: number;
}

/**
 * Game loop statistics.
 */
export interface GameLoopStats {
  /** Current FPS */
  fps: number;
  /** Current delta time */
  dt: number;
  /** Fixed delta time */
  fixedDt: number;
  /** Frame number */
  frame: number;
  /** Total elapsed time */
  time: number;
  /** Time spent in update */
  updateTime: number;
  /** Time spent in fixed update */
  fixedUpdateTime: number;
  /** Time spent in render */
  renderTime: number;
}

/**
 * GameLoop implementation for Cosmic Survivors.
 */
export class GameLoop {
  /** Whether the loop is running */
  private _running = false;

  /** Whether the loop is paused */
  private _paused = false;

  /** RAF ID for cancellation */
  private _rafId: number | null = null;

  /** Last frame timestamp */
  private _lastTime = 0;

  /** Accumulated time for fixed updates */
  private _accumulator = 0;

  /** Current frame number */
  private _frame = 0;

  /** Total elapsed time */
  private _time = 0;

  /** Current delta time */
  private _dt = 0;

  /** Fixed delta time */
  private _fixedDt: number;

  /** Maximum delta time */
  private _maxDt: number;

  /** FPS calculation */
  private _fpsHistory: number[] = [];
  private _fpsSampleCount: number;
  private _currentFps = 0;

  /** Performance timing */
  private _updateTime = 0;
  private _fixedUpdateTime = 0;
  private _renderTime = 0;

  /** Callbacks */
  private _updateCallback: UpdateCallback | null = null;
  private _fixedUpdateCallback: FixedUpdateCallback | null = null;
  private _renderCallback: RenderCallback | null = null;

  constructor(config: GameLoopConfig = {}) {
    const {
      fixedUpdateRate = FIXED_UPDATE_RATE,
      maxDeltaTime = 0.1,
      fpsSampleCount = 60,
    } = config;

    this._fixedDt = 1 / fixedUpdateRate;
    this._maxDt = maxDeltaTime;
    this._fpsSampleCount = fpsSampleCount;
  }

  /**
   * Get current FPS.
   */
  get fps(): number {
    return this._currentFps;
  }

  /**
   * Get current delta time.
   */
  get dt(): number {
    return this._dt;
  }

  /**
   * Get fixed delta time.
   */
  get fixedDt(): number {
    return this._fixedDt;
  }

  /**
   * Get current frame number.
   */
  get frame(): number {
    return this._frame;
  }

  /**
   * Get total elapsed time.
   */
  get time(): number {
    return this._time;
  }

  /**
   * Check if running.
   */
  get isRunning(): boolean {
    return this._running;
  }

  /**
   * Check if paused.
   */
  get isPaused(): boolean {
    return this._paused;
  }

  /**
   * Get loop statistics.
   */
  get stats(): GameLoopStats {
    return {
      fps: this._currentFps,
      dt: this._dt,
      fixedDt: this._fixedDt,
      frame: this._frame,
      time: this._time,
      updateTime: this._updateTime,
      fixedUpdateTime: this._fixedUpdateTime,
      renderTime: this._renderTime,
    };
  }

  /**
   * Set update callback (called every frame).
   */
  setUpdateCallback(callback: UpdateCallback): void {
    this._updateCallback = callback;
  }

  /**
   * Set fixed update callback (called at fixed rate).
   */
  setFixedUpdateCallback(callback: FixedUpdateCallback): void {
    this._fixedUpdateCallback = callback;
  }

  /**
   * Set render callback (called every frame after update).
   */
  setRenderCallback(callback: RenderCallback): void {
    this._renderCallback = callback;
  }

  /**
   * Start the game loop.
   */
  start(): void {
    if (this._running) return;

    this._running = true;
    this._paused = false;
    this._lastTime = performance.now();
    this._accumulator = 0;

    this.tick(this._lastTime);
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    this._running = false;

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Pause the game loop (stops updates, continues rendering).
   */
  pause(): void {
    this._paused = true;
  }

  /**
   * Resume the game loop.
   */
  resume(): void {
    if (!this._paused) return;

    this._paused = false;
    // Reset timing to avoid time jump
    this._lastTime = performance.now();
    this._accumulator = 0;
  }

  /**
   * Reset the game loop state.
   */
  reset(): void {
    this._frame = 0;
    this._time = 0;
    this._dt = 0;
    this._accumulator = 0;
    this._fpsHistory = [];
    this._currentFps = 0;
  }

  /**
   * Main tick function.
   */
  private tick(currentTime: number): void {
    if (!this._running) return;

    // Calculate delta time
    let dt = (currentTime - this._lastTime) / 1000;
    this._lastTime = currentTime;

    // Cap delta time to prevent spiral of death
    if (dt > this._maxDt) {
      dt = this._maxDt;
    }

    // Update FPS
    this.updateFPS(dt);

    this._dt = dt;

    // Only update game logic if not paused
    if (!this._paused) {
      // Variable update
      const updateStart = performance.now();
      if (this._updateCallback) {
        this._updateCallback(dt);
      }
      this._updateTime = performance.now() - updateStart;

      // Fixed timestep updates
      this._accumulator += dt;

      const fixedStart = performance.now();
      let fixedSteps = 0;
      const maxFixedSteps = 5; // Prevent too many fixed steps in one frame

      while (this._accumulator >= this._fixedDt && fixedSteps < maxFixedSteps) {
        if (this._fixedUpdateCallback) {
          this._fixedUpdateCallback(this._fixedDt);
        }
        this._accumulator -= this._fixedDt;
        fixedSteps++;
      }

      // Prevent accumulator from growing too large
      if (this._accumulator > this._fixedDt * 2) {
        this._accumulator = this._fixedDt;
      }

      this._fixedUpdateTime = performance.now() - fixedStart;

      // Update counters
      this._time += dt;
      this._frame++;
    }

    // Calculate interpolation for smooth rendering
    const interpolation = this._accumulator / this._fixedDt;

    // Render (always, even when paused)
    const renderStart = performance.now();
    if (this._renderCallback) {
      this._renderCallback(interpolation);
    }
    this._renderTime = performance.now() - renderStart;

    // Schedule next frame
    this._rafId = requestAnimationFrame((time) => this.tick(time));
  }

  /**
   * Update FPS calculation.
   */
  private updateFPS(dt: number): void {
    if (dt <= 0) return;

    const fps = 1 / dt;
    this._fpsHistory.push(fps);

    if (this._fpsHistory.length > this._fpsSampleCount) {
      this._fpsHistory.shift();
    }

    // Calculate average FPS
    const sum = this._fpsHistory.reduce((a, b) => a + b, 0);
    this._currentFps = Math.round(sum / this._fpsHistory.length);
  }
}
