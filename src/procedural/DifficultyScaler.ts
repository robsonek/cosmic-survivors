/**
 * DifficultyScaler - Dynamic difficulty adjustment system.
 *
 * Scales game difficulty based on:
 * - Time elapsed
 * - Player performance (kills per minute, deaths)
 * - Current wave number
 *
 * Implements IDifficultyScaler interface.
 */

import type { IDifficultyScaler } from '../shared/interfaces/IProcedural';
import { clamp } from '../shared/utils/math';

/**
 * Difficulty scaling configuration.
 */
export interface DifficultyConfig {
  /** Base difficulty multiplier */
  baseDifficulty: number;
  /** Difficulty increase per minute */
  scalingRate: number;
  /** Maximum difficulty multiplier */
  maxDifficulty: number;
  /** Minimum difficulty multiplier */
  minDifficulty: number;
  /** Performance adjustment sensitivity */
  performanceSensitivity: number;
  /** Target kills per minute for balanced gameplay */
  targetKillsPerMinute: number;
}

/** Default difficulty configuration */
const DEFAULT_CONFIG: DifficultyConfig = {
  baseDifficulty: 1.0,
  scalingRate: 0.05, // 5% per minute
  maxDifficulty: 10.0,
  minDifficulty: 0.5,
  performanceSensitivity: 0.1,
  targetKillsPerMinute: 30,
};

/**
 * DifficultyScaler implementation.
 */
export class DifficultyScaler implements IDifficultyScaler {
  /** Current configuration */
  private config: DifficultyConfig;

  /** Total game time in seconds */
  private gameTime = 0;

  /** Current calculated difficulty */
  private _difficulty: number;

  /** Performance-based adjustment */
  private performanceAdjustment = 0;

  /** Running average of kills per minute */
  private killsPerMinuteAvg = 0;

  /** Death count for adjustment */
  private totalDeaths = 0;

  /** Base difficulty setting */
  public baseDifficulty: number;

  /** Scaling rate per minute */
  public scalingRate: number;

  constructor(config: Partial<DifficultyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseDifficulty = this.config.baseDifficulty;
    this.scalingRate = this.config.scalingRate;
    this._difficulty = this.baseDifficulty;
  }

  /**
   * Current difficulty multiplier.
   */
  get difficulty(): number {
    return this._difficulty;
  }

  /**
   * Update difficulty based on time and performance.
   */
  update(dt: number, killsPerMinute: number, deathCount: number): void {
    this.gameTime += dt;

    // Update running average of KPM
    const alpha = 0.1; // Smoothing factor
    this.killsPerMinuteAvg = this.killsPerMinuteAvg * (1 - alpha) + killsPerMinute * alpha;

    // Track deaths
    if (deathCount > this.totalDeaths) {
      this.totalDeaths = deathCount;
      // Slight decrease on death to help struggling players
      this.performanceAdjustment -= 0.05;
    }

    // Calculate time-based difficulty
    const minutes = this.gameTime / 60;
    const timeBasedDifficulty = this.baseDifficulty + minutes * this.scalingRate;

    // Calculate performance adjustment
    this.updatePerformanceAdjustment();

    // Combine time-based and performance-based difficulty
    this._difficulty = clamp(
      timeBasedDifficulty + this.performanceAdjustment,
      this.config.minDifficulty,
      this.config.maxDifficulty
    );
  }

  /**
   * Update performance-based adjustment.
   */
  private updatePerformanceAdjustment(): void {
    const { targetKillsPerMinute, performanceSensitivity } = this.config;

    // Compare actual KPM to target
    const kpmDiff = this.killsPerMinuteAvg - targetKillsPerMinute;

    // If player is killing more than target, increase difficulty
    // If player is struggling, decrease difficulty
    const adjustment = (kpmDiff / targetKillsPerMinute) * performanceSensitivity;

    // Smoothly approach the target adjustment
    this.performanceAdjustment = clamp(
      this.performanceAdjustment + adjustment * 0.01,
      -0.5, // Max reduction
      0.5   // Max increase
    );
  }

  /**
   * Get enemy health multiplier.
   */
  getEnemyHealthMultiplier(): number {
    // Health scales faster than other stats
    return 1 + (this._difficulty - 1) * 0.8;
  }

  /**
   * Get enemy damage multiplier.
   */
  getEnemyDamageMultiplier(): number {
    // Damage scales moderately
    return 1 + (this._difficulty - 1) * 0.4;
  }

  /**
   * Get enemy speed multiplier.
   */
  getEnemySpeedMultiplier(): number {
    // Speed scales slowly to keep game playable
    return 1 + (this._difficulty - 1) * 0.15;
  }

  /**
   * Get spawn rate multiplier.
   */
  getSpawnRateMultiplier(): number {
    // More enemies spawn as difficulty increases
    return 1 + (this._difficulty - 1) * 0.5;
  }

  /**
   * Get XP multiplier (reward scaling).
   */
  getXPMultiplier(): number {
    // XP scales with difficulty to compensate
    return 1 + (this._difficulty - 1) * 0.3;
  }

  /**
   * Get current game time.
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Get time-based difficulty component.
   */
  getTimeDifficulty(): number {
    const minutes = this.gameTime / 60;
    return this.baseDifficulty + minutes * this.scalingRate;
  }

  /**
   * Get performance adjustment component.
   */
  getPerformanceAdjustment(): number {
    return this.performanceAdjustment;
  }

  /**
   * Reset difficulty to initial state.
   */
  reset(): void {
    this.gameTime = 0;
    this._difficulty = this.baseDifficulty;
    this.performanceAdjustment = 0;
    this.killsPerMinuteAvg = 0;
    this.totalDeaths = 0;
  }

  /**
   * Set difficulty manually (for testing/cheats).
   */
  setDifficulty(value: number): void {
    this._difficulty = clamp(value, this.config.minDifficulty, this.config.maxDifficulty);
  }

  /**
   * Get all difficulty stats for debugging/UI.
   */
  getStats(): DifficultyStats {
    return {
      difficulty: this._difficulty,
      gameTime: this.gameTime,
      timeBasedDifficulty: this.getTimeDifficulty(),
      performanceAdjustment: this.performanceAdjustment,
      killsPerMinuteAvg: this.killsPerMinuteAvg,
      totalDeaths: this.totalDeaths,
      healthMultiplier: this.getEnemyHealthMultiplier(),
      damageMultiplier: this.getEnemyDamageMultiplier(),
      speedMultiplier: this.getEnemySpeedMultiplier(),
      spawnRateMultiplier: this.getSpawnRateMultiplier(),
      xpMultiplier: this.getXPMultiplier(),
    };
  }
}

/**
 * Difficulty statistics for debugging/UI.
 */
export interface DifficultyStats {
  difficulty: number;
  gameTime: number;
  timeBasedDifficulty: number;
  performanceAdjustment: number;
  killsPerMinuteAvg: number;
  totalDeaths: number;
  healthMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  spawnRateMultiplier: number;
  xpMultiplier: number;
}

/**
 * Create a DifficultyScaler with preset difficulty.
 */
export function createDifficultyScaler(preset: 'easy' | 'normal' | 'hard' | 'nightmare'): DifficultyScaler {
  const presets: Record<string, Partial<DifficultyConfig>> = {
    easy: {
      baseDifficulty: 0.7,
      scalingRate: 0.03,
      maxDifficulty: 5.0,
    },
    normal: {
      baseDifficulty: 1.0,
      scalingRate: 0.05,
      maxDifficulty: 10.0,
    },
    hard: {
      baseDifficulty: 1.3,
      scalingRate: 0.07,
      maxDifficulty: 15.0,
    },
    nightmare: {
      baseDifficulty: 1.5,
      scalingRate: 0.1,
      maxDifficulty: 20.0,
      performanceSensitivity: 0.05, // Less adaptive
    },
  };

  return new DifficultyScaler(presets[preset]);
}
