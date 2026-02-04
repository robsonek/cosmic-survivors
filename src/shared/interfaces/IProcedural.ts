import type { ISpawnConfig } from './IAI';
import type { WeaponRarity } from './IWeapon';

/**
 * Wave definition.
 */
export interface IWaveDefinition {
  /** Wave number (1-indexed) */
  waveNumber: number;

  /** Duration in seconds (0 = until all killed) */
  duration: number;

  /** Enemy spawns for this wave */
  spawns: ISpawnConfig[];

  /** Boss spawn (optional) */
  boss?: {
    bossId: string;
    spawnTime: number;    // Seconds into wave
  };

  /** Special modifiers for this wave */
  modifiers?: WaveModifier[];

  /** XP bonus for completing wave */
  xpBonus: number;
}

export enum WaveModifier {
  Fast = 'fast',           // Enemies move faster
  Tanky = 'tanky',         // Enemies have more HP
  Swarm = 'swarm',         // More enemies, less HP
  Elite = 'elite',         // More elite enemies
  NoPickups = 'noPickups', // No XP/health drops
}

/**
 * Wave generator interface.
 */
export interface IWaveGenerator {
  /** Current wave number */
  readonly currentWave: number;

  /** Time elapsed in current wave */
  readonly waveTime: number;

  /** Whether wave is active */
  readonly isWaveActive: boolean;

  /** Total game time elapsed */
  readonly gameTime: number;

  /**
   * Generate wave definition.
   * @param waveNumber Wave to generate
   * @param playerCount Number of players
   * @param difficulty Current difficulty level
   */
  generateWave(waveNumber: number, playerCount: number, difficulty: number): IWaveDefinition;

  /**
   * Start next wave.
   */
  startNextWave(): void;

  /**
   * End current wave early.
   */
  endWave(): void;

  /**
   * Update wave state.
   */
  update(dt: number): void;

  /**
   * Get current wave definition.
   */
  getCurrentWave(): IWaveDefinition | null;

  /**
   * Check if boss wave.
   */
  isBossWave(waveNumber: number): boolean;
}

/**
 * Difficulty scaler interface.
 */
export interface IDifficultyScaler {
  /** Current difficulty multiplier */
  readonly difficulty: number;

  /** Base difficulty (starting value) */
  baseDifficulty: number;

  /** Scaling rate per minute */
  scalingRate: number;

  /**
   * Update difficulty based on time and performance.
   */
  update(dt: number, killsPerMinute: number, deathCount: number): void;

  /**
   * Get enemy stat multiplier.
   */
  getEnemyHealthMultiplier(): number;

  /**
   * Get enemy damage multiplier.
   */
  getEnemyDamageMultiplier(): number;

  /**
   * Get enemy speed multiplier.
   */
  getEnemySpeedMultiplier(): number;

  /**
   * Get spawn rate multiplier.
   */
  getSpawnRateMultiplier(): number;

  /**
   * Get XP multiplier.
   */
  getXPMultiplier(): number;

  /**
   * Reset difficulty.
   */
  reset(): void;
}

/**
 * Loot drop configuration.
 */
export interface ILootConfig {
  /** Entity that dropped loot */
  source: number;

  /** Position to spawn loot */
  x: number;
  y: number;

  /** XP value */
  xpValue: number;

  /** Chance to drop health (0-1) */
  healthDropChance: number;

  /** Extra drop chances */
  extraDrops?: Array<{
    type: LootType;
    chance: number;
    value?: number;
  }>;
}

export enum LootType {
  XPOrb = 'xpOrb',
  Health = 'health',
  Magnet = 'magnet',       // Collect all nearby XP
  Chest = 'chest',         // Contains upgrade
  Bomb = 'bomb',           // Damages all enemies
  Clock = 'clock',         // Freezes enemies
  Gold = 'gold',           // Currency
}

/**
 * Loot table entry.
 */
export interface ILootTableEntry {
  type: LootType;
  weight: number;
  minValue?: number;
  maxValue?: number;
  rarity?: WeaponRarity;
}

/**
 * Loot generator interface.
 */
export interface ILootGenerator {
  /**
   * Generate loot from killed enemy.
   */
  generateEnemyLoot(config: ILootConfig): ILootDrop[];

  /**
   * Generate loot from chest.
   */
  generateChestLoot(rarity: WeaponRarity): ILootDrop[];

  /**
   * Generate boss loot.
   */
  generateBossLoot(bossId: string): ILootDrop[];

  /**
   * Set loot table.
   */
  setLootTable(entries: ILootTableEntry[]): void;

  /**
   * Get drop chance for type.
   */
  getDropChance(type: LootType): number;
}

/**
 * Generated loot drop.
 */
export interface ILootDrop {
  type: LootType;
  x: number;
  y: number;
  value: number;
  rarity?: WeaponRarity;
  upgradeId?: string;      // For chest upgrades
}

/**
 * Upgrade pool for level-up choices.
 */
export interface IUpgradePool {
  /**
   * Get upgrade choices for level up.
   * @param playerEntity Player entity
   * @param count Number of choices (usually 3)
   * @returns Upgrade IDs weighted by rarity and availability
   */
  getUpgradeChoices(playerEntity: number, count: number): string[];

  /**
   * Check if upgrade is available for player.
   */
  isAvailable(playerEntity: number, upgradeId: string): boolean;

  /**
   * Get all possible upgrades.
   */
  getAllUpgrades(): string[];

  /**
   * Add custom weight modifier.
   */
  addWeightModifier(upgradeId: string, modifier: number): void;

  /**
   * Check evolution availability.
   */
  getAvailableEvolutions(playerEntity: number): string[];
}
