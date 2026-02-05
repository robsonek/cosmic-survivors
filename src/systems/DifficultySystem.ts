/**
 * DifficultySystem - Comprehensive difficulty management for Cosmic Survivors.
 *
 * Features:
 * - Three difficulty modes: Easy, Normal, Nightmare
 * - Per-difficulty high scores with persistence
 * - Endless scaling after 20 minutes
 * - Nightmare unlock requirement (survive 15 min on Normal)
 * - Visual difficulty indicator
 *
 * Phaser 4, TypeScript
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Difficulty mode enum.
 */
export enum DifficultyMode {
  Easy = 'easy',
  Normal = 'normal',
  Nightmare = 'nightmare',
}

/**
 * Difficulty multipliers applied to gameplay.
 */
export interface DifficultyMultipliers {
  /** Enemy HP multiplier */
  enemyHpMultiplier: number;
  /** Enemy damage multiplier */
  enemyDamageMultiplier: number;
  /** Enemy speed multiplier */
  enemySpeedMultiplier: number;
  /** XP gain multiplier */
  xpMultiplier: number;
  /** Spawn rate multiplier */
  spawnRateMultiplier: number;
}

/**
 * High score entry for a specific difficulty.
 */
export interface HighScoreEntry {
  /** Score achieved */
  score: number;
  /** Time survived in seconds */
  timeSurvived: number;
  /** Wave reached */
  waveReached: number;
  /** Total kills */
  kills: number;
  /** Date achieved (ISO string) */
  date: string;
  /** Player level reached */
  level: number;
}

/**
 * Persistent difficulty data stored in localStorage.
 */
export interface DifficultyPersistentData {
  /** High scores per difficulty */
  highScores: Record<DifficultyMode, HighScoreEntry | null>;
  /** Whether Nightmare mode is unlocked */
  nightmareUnlocked: boolean;
  /** Best time survived on Normal (for unlock tracking) */
  bestNormalTime: number;
}

/**
 * Difficulty configuration for a mode.
 */
export interface DifficultyConfig {
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Color for UI elements */
  color: number;
  /** Icon/emoji for display */
  icon: string;
  /** Base multipliers */
  multipliers: DifficultyMultipliers;
  /** Whether this difficulty is locked by default */
  locked: boolean;
  /** Unlock requirement description */
  unlockRequirement?: string;
}

// ============================================================================
// DIFFICULTY CONFIGURATIONS
// ============================================================================

/**
 * Difficulty presets.
 */
export const DIFFICULTY_CONFIGS: Record<DifficultyMode, DifficultyConfig> = {
  [DifficultyMode.Easy]: {
    name: 'Easy',
    description: 'For beginners. Reduced enemy strength, bonus XP.',
    color: 0x7ed321, // Green
    icon: '[E]',
    multipliers: {
      enemyHpMultiplier: 0.7,
      enemyDamageMultiplier: 0.7,
      enemySpeedMultiplier: 1.0,
      xpMultiplier: 1.5,
      spawnRateMultiplier: 0.9,
    },
    locked: false,
  },
  [DifficultyMode.Normal]: {
    name: 'Normal',
    description: 'Balanced challenge. Standard experience.',
    color: 0x4a90d9, // Blue
    icon: '[N]',
    multipliers: {
      enemyHpMultiplier: 1.0,
      enemyDamageMultiplier: 1.0,
      enemySpeedMultiplier: 1.0,
      xpMultiplier: 1.0,
      spawnRateMultiplier: 1.0,
    },
    locked: false,
  },
  [DifficultyMode.Nightmare]: {
    name: 'Nightmare',
    description: 'Extreme challenge. Fast, deadly enemies. Double XP.',
    color: 0xff4444, // Red
    icon: '[!]',
    multipliers: {
      enemyHpMultiplier: 1.5,
      enemyDamageMultiplier: 1.5,
      enemySpeedMultiplier: 2.0,
      xpMultiplier: 2.0,
      spawnRateMultiplier: 1.3,
    },
    locked: true,
    unlockRequirement: 'Survive 15 minutes on Normal difficulty',
  },
};

/**
 * Time required on Normal to unlock Nightmare (in seconds).
 */
export const NIGHTMARE_UNLOCK_TIME = 15 * 60; // 15 minutes

/**
 * Time after which endless scaling begins (in seconds).
 */
export const ENDLESS_SCALING_START_TIME = 20 * 60; // 20 minutes

/**
 * Endless scaling rate per minute after threshold.
 */
export const ENDLESS_SCALING_RATE = 0.05; // 5% per minute

/**
 * LocalStorage key for difficulty data.
 */
const DIFFICULTY_STORAGE_KEY = 'cosmic_survivors_difficulty';

// ============================================================================
// DIFFICULTY SYSTEM CLASS
// ============================================================================

/**
 * DifficultySystem manages game difficulty settings and progression.
 */
export class DifficultySystem {
  /** Current selected difficulty */
  private currentMode: DifficultyMode = DifficultyMode.Normal;

  /** Current game time in seconds */
  private gameTime: number = 0;

  /** Persistent data (high scores, unlocks) */
  private persistentData: DifficultyPersistentData;

  /** Cached multipliers (updated with endless scaling) */
  private cachedMultipliers: DifficultyMultipliers;

  /** Whether the system has been initialized */
  private initialized: boolean = false;

  constructor() {
    this.persistentData = this.loadPersistentData();
    this.cachedMultipliers = { ...DIFFICULTY_CONFIGS[this.currentMode].multipliers };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the difficulty system.
   */
  init(): void {
    if (this.initialized) return;

    this.persistentData = this.loadPersistentData();
    this.initialized = true;
  }

  /**
   * Reset for a new game run.
   */
  reset(): void {
    this.gameTime = 0;
    this.updateCachedMultipliers();
  }

  // ============================================================================
  // DIFFICULTY SELECTION
  // ============================================================================

  /**
   * Get current difficulty mode.
   */
  getCurrentMode(): DifficultyMode {
    return this.currentMode;
  }

  /**
   * Get current difficulty configuration.
   */
  getCurrentConfig(): DifficultyConfig {
    return DIFFICULTY_CONFIGS[this.currentMode];
  }

  /**
   * Set difficulty mode.
   * @returns True if successful, false if mode is locked.
   */
  setMode(mode: DifficultyMode): boolean {
    if (!this.isModeUnlocked(mode)) {
      return false;
    }

    this.currentMode = mode;
    this.updateCachedMultipliers();
    return true;
  }

  /**
   * Check if a difficulty mode is unlocked.
   */
  isModeUnlocked(mode: DifficultyMode): boolean {
    const config = DIFFICULTY_CONFIGS[mode];
    if (!config.locked) return true;

    if (mode === DifficultyMode.Nightmare) {
      return this.persistentData.nightmareUnlocked;
    }

    return true;
  }

  /**
   * Get all available difficulty modes.
   */
  getAvailableModes(): DifficultyMode[] {
    return Object.values(DifficultyMode);
  }

  /**
   * Get configuration for a specific mode.
   */
  getModeConfig(mode: DifficultyMode): DifficultyConfig {
    return DIFFICULTY_CONFIGS[mode];
  }

  // ============================================================================
  // MULTIPLIERS
  // ============================================================================

  /**
   * Get current effective multipliers (includes endless scaling).
   */
  getMultipliers(): DifficultyMultipliers {
    return { ...this.cachedMultipliers };
  }

  /**
   * Get enemy HP multiplier.
   */
  getEnemyHpMultiplier(): number {
    return this.cachedMultipliers.enemyHpMultiplier;
  }

  /**
   * Get enemy damage multiplier.
   */
  getEnemyDamageMultiplier(): number {
    return this.cachedMultipliers.enemyDamageMultiplier;
  }

  /**
   * Get enemy speed multiplier.
   */
  getEnemySpeedMultiplier(): number {
    return this.cachedMultipliers.enemySpeedMultiplier;
  }

  /**
   * Get XP multiplier.
   */
  getXpMultiplier(): number {
    return this.cachedMultipliers.xpMultiplier;
  }

  /**
   * Get spawn rate multiplier.
   */
  getSpawnRateMultiplier(): number {
    return this.cachedMultipliers.spawnRateMultiplier;
  }

  /**
   * Update cached multipliers with endless scaling.
   */
  private updateCachedMultipliers(): void {
    const baseMultipliers = DIFFICULTY_CONFIGS[this.currentMode].multipliers;
    const endlessMultiplier = this.calculateEndlessScaling();

    this.cachedMultipliers = {
      enemyHpMultiplier: baseMultipliers.enemyHpMultiplier * endlessMultiplier,
      enemyDamageMultiplier: baseMultipliers.enemyDamageMultiplier * endlessMultiplier,
      enemySpeedMultiplier: Math.min(
        baseMultipliers.enemySpeedMultiplier * (1 + (endlessMultiplier - 1) * 0.3),
        baseMultipliers.enemySpeedMultiplier * 1.5 // Cap speed scaling
      ),
      xpMultiplier: baseMultipliers.xpMultiplier * (1 + (endlessMultiplier - 1) * 0.5),
      spawnRateMultiplier: baseMultipliers.spawnRateMultiplier * (1 + (endlessMultiplier - 1) * 0.3),
    };
  }

  /**
   * Calculate endless scaling multiplier based on game time.
   */
  private calculateEndlessScaling(): number {
    if (this.gameTime < ENDLESS_SCALING_START_TIME) {
      return 1.0;
    }

    const minutesPastThreshold = (this.gameTime - ENDLESS_SCALING_START_TIME) / 60;
    return 1.0 + minutesPastThreshold * ENDLESS_SCALING_RATE;
  }

  /**
   * Get current endless scaling factor (for UI display).
   */
  getEndlessScalingFactor(): number {
    return this.calculateEndlessScaling();
  }

  /**
   * Check if endless scaling is active.
   */
  isEndlessScalingActive(): boolean {
    return this.gameTime >= ENDLESS_SCALING_START_TIME;
  }

  // ============================================================================
  // GAME TIME TRACKING
  // ============================================================================

  /**
   * Update game time (call every frame).
   * @param dt Delta time in seconds.
   */
  update(dt: number): void {
    this.gameTime += dt;
    this.updateCachedMultipliers();
  }

  /**
   * Get current game time in seconds.
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Set game time (for loading saved games).
   */
  setGameTime(time: number): void {
    this.gameTime = time;
    this.updateCachedMultipliers();
  }

  // ============================================================================
  // HIGH SCORES
  // ============================================================================

  /**
   * Get high score for a difficulty mode.
   */
  getHighScore(mode: DifficultyMode): HighScoreEntry | null {
    return this.persistentData.highScores[mode];
  }

  /**
   * Get high score for current difficulty.
   */
  getCurrentHighScore(): HighScoreEntry | null {
    return this.getHighScore(this.currentMode);
  }

  /**
   * Submit a score and check if it's a new high score.
   * @returns True if this is a new high score.
   */
  submitScore(stats: {
    score: number;
    timeSurvived: number;
    waveReached: number;
    kills: number;
    level: number;
  }): boolean {
    const entry: HighScoreEntry = {
      ...stats,
      date: new Date().toISOString(),
    };

    const currentHigh = this.persistentData.highScores[this.currentMode];
    const isNewHighScore = !currentHigh || stats.score > currentHigh.score;

    if (isNewHighScore) {
      this.persistentData.highScores[this.currentMode] = entry;
    }

    // Track best Normal time for Nightmare unlock
    if (this.currentMode === DifficultyMode.Normal) {
      if (stats.timeSurvived > this.persistentData.bestNormalTime) {
        this.persistentData.bestNormalTime = stats.timeSurvived;
      }

      // Check for Nightmare unlock
      if (stats.timeSurvived >= NIGHTMARE_UNLOCK_TIME && !this.persistentData.nightmareUnlocked) {
        this.persistentData.nightmareUnlocked = true;
      }
    }

    this.savePersistentData();
    return isNewHighScore;
  }

  /**
   * Get all high scores.
   */
  getAllHighScores(): Record<DifficultyMode, HighScoreEntry | null> {
    return { ...this.persistentData.highScores };
  }

  // ============================================================================
  // NIGHTMARE UNLOCK
  // ============================================================================

  /**
   * Check if Nightmare mode is unlocked.
   */
  isNightmareUnlocked(): boolean {
    return this.persistentData.nightmareUnlocked;
  }

  /**
   * Get progress towards Nightmare unlock (0-1).
   */
  getNightmareUnlockProgress(): number {
    if (this.persistentData.nightmareUnlocked) return 1.0;
    return Math.min(1.0, this.persistentData.bestNormalTime / NIGHTMARE_UNLOCK_TIME);
  }

  /**
   * Manually unlock Nightmare (for debug/cheats).
   */
  unlockNightmare(): void {
    this.persistentData.nightmareUnlocked = true;
    this.savePersistentData();
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  /**
   * Load persistent data from localStorage.
   */
  private loadPersistentData(): DifficultyPersistentData {
    try {
      const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as DifficultyPersistentData;
        // Validate and fill in missing fields
        return {
          highScores: {
            [DifficultyMode.Easy]: data.highScores?.[DifficultyMode.Easy] ?? null,
            [DifficultyMode.Normal]: data.highScores?.[DifficultyMode.Normal] ?? null,
            [DifficultyMode.Nightmare]: data.highScores?.[DifficultyMode.Nightmare] ?? null,
          },
          nightmareUnlocked: data.nightmareUnlocked ?? false,
          bestNormalTime: data.bestNormalTime ?? 0,
        };
      }
    } catch (error) {
      console.warn('Failed to load difficulty data:', error);
    }

    return this.getDefaultPersistentData();
  }

  /**
   * Save persistent data to localStorage.
   */
  private savePersistentData(): void {
    try {
      localStorage.setItem(DIFFICULTY_STORAGE_KEY, JSON.stringify(this.persistentData));
    } catch (error) {
      console.error('Failed to save difficulty data:', error);
    }
  }

  /**
   * Get default persistent data.
   */
  private getDefaultPersistentData(): DifficultyPersistentData {
    return {
      highScores: {
        [DifficultyMode.Easy]: null,
        [DifficultyMode.Normal]: null,
        [DifficultyMode.Nightmare]: null,
      },
      nightmareUnlocked: false,
      bestNormalTime: 0,
    };
  }

  /**
   * Clear all difficulty data (for reset).
   */
  clearData(): void {
    this.persistentData = this.getDefaultPersistentData();
    localStorage.removeItem(DIFFICULTY_STORAGE_KEY);
  }

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  /**
   * Get difficulty indicator for HUD display.
   */
  getDifficultyIndicator(): {
    text: string;
    color: number;
    icon: string;
  } {
    const config = DIFFICULTY_CONFIGS[this.currentMode];
    let text = config.name;

    if (this.isEndlessScalingActive()) {
      const scalingPercent = Math.round((this.getEndlessScalingFactor() - 1) * 100);
      text = `${config.name} +${scalingPercent}%`;
    }

    return {
      text,
      color: config.color,
      icon: config.icon,
    };
  }

  /**
   * Format time for display (MM:SS).
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get stats summary for current difficulty.
   */
  getStatsSummary(): string {
    const m = this.cachedMultipliers;
    const parts: string[] = [];

    if (m.enemyHpMultiplier !== 1.0) {
      parts.push(`HP: ${Math.round(m.enemyHpMultiplier * 100)}%`);
    }
    if (m.enemyDamageMultiplier !== 1.0) {
      parts.push(`DMG: ${Math.round(m.enemyDamageMultiplier * 100)}%`);
    }
    if (m.enemySpeedMultiplier !== 1.0) {
      parts.push(`SPD: ${Math.round(m.enemySpeedMultiplier * 100)}%`);
    }
    if (m.xpMultiplier !== 1.0) {
      parts.push(`XP: ${Math.round(m.xpMultiplier * 100)}%`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Standard';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Global difficulty system instance.
 */
export const difficultySystem = new DifficultySystem();

export default difficultySystem;
