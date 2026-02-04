/**
 * WaveDefinitions - Predefined wave templates for enemy spawning.
 *
 * Defines enemy composition, difficulty scaling, and wave modifiers
 * for different stages of the game.
 */

import { WaveModifier } from '../shared/interfaces/IProcedural';
import { SpawnPosition, SpawnFormation } from '../shared/interfaces/IAI';

/**
 * Enemy pool entry with weighted probability.
 */
export interface EnemyPoolEntry {
  /** Enemy definition ID */
  enemyId: string;
  /** Weight for random selection (higher = more likely) */
  weight: number;
}

/**
 * Wave template defining enemy composition and behavior.
 */
export interface WaveTemplate {
  /** Wave range this template applies to [min, max] */
  waveRange: [number, number];
  /** Pool of enemies to spawn from */
  enemyPool: EnemyPoolEntry[];
  /** Base enemy count */
  baseCount: number;
  /** Additional enemies per player */
  countPerPlayer: number;
  /** Chance for elite enemies (0-1) */
  eliteChance: number;
  /** Wave modifiers */
  modifiers?: WaveModifier[];
  /** Spawn position strategy */
  spawnPosition?: SpawnPosition;
  /** Spawn formation for groups */
  formation?: SpawnFormation;
  /** XP bonus for completing wave */
  xpBonus?: number;
}

/**
 * Boss wave configuration.
 */
export interface BossWaveConfig {
  /** Wave number this boss appears on */
  waveNumber: number;
  /** Boss enemy ID */
  bossId: string;
  /** Support enemy pool */
  supportPool: EnemyPoolEntry[];
  /** Number of support enemies */
  supportCount: number;
  /** Spawn delay for boss (seconds into wave) */
  bossSpawnDelay: number;
  /** XP bonus for defeating boss */
  xpBonus: number;
}

/**
 * Special wave configuration.
 */
export interface SpecialWaveConfig {
  /** Name of the special wave */
  name: string;
  /** Enemy pool for this wave */
  enemyPool: EnemyPoolEntry[];
  /** Enemy count multiplier */
  countMultiplier: number;
  /** Health multiplier for enemies */
  healthMultiplier: number;
  /** Damage multiplier for enemies */
  damageMultiplier: number;
  /** Modifiers for this wave */
  modifiers: WaveModifier[];
  /** XP bonus multiplier */
  xpBonusMultiplier: number;
}

// ============================================
// Enemy Pools
// ============================================

/** Early game enemies (waves 1-10) */
export const EarlyGameEnemyPool: EnemyPoolEntry[] = [
  { enemyId: 'bat', weight: 60 },
  { enemyId: 'skeleton', weight: 35 },
  { enemyId: 'zombie', weight: 5 },
];

/** Mid game enemies (waves 11-25) */
export const MidGameEnemyPool: EnemyPoolEntry[] = [
  { enemyId: 'bat', weight: 30 },
  { enemyId: 'skeleton', weight: 30 },
  { enemyId: 'zombie', weight: 25 },
  { enemyId: 'ghost', weight: 15 },
];

/** Late game enemies (waves 26+) */
export const LateGameEnemyPool: EnemyPoolEntry[] = [
  { enemyId: 'skeleton', weight: 20 },
  { enemyId: 'zombie', weight: 30 },
  { enemyId: 'ghost', weight: 30 },
  { enemyId: 'ogre', weight: 20 },
];

/** Swarm-only enemies */
export const SwarmEnemyPool: EnemyPoolEntry[] = [
  { enemyId: 'bat', weight: 100 },
];

/** Elite-only enemies */
export const EliteEnemyPool: EnemyPoolEntry[] = [
  { enemyId: 'ghost', weight: 40 },
  { enemyId: 'ogre', weight: 60 },
];

/** Boss support enemies */
export const BossSupportPool: EnemyPoolEntry[] = [
  { enemyId: 'skeleton', weight: 40 },
  { enemyId: 'zombie', weight: 30 },
  { enemyId: 'ghost', weight: 30 },
];

// ============================================
// Wave Templates
// ============================================

/** Early game wave templates (1-10) */
export const EarlyGameTemplates: WaveTemplate[] = [
  {
    waveRange: [1, 3],
    enemyPool: [
      { enemyId: 'bat', weight: 100 },
    ],
    baseCount: 8,
    countPerPlayer: 3,
    eliteChance: 0,
    spawnPosition: SpawnPosition.EdgeOfScreen,
    xpBonus: 10,
  },
  {
    waveRange: [4, 6],
    enemyPool: [
      { enemyId: 'bat', weight: 70 },
      { enemyId: 'skeleton', weight: 30 },
    ],
    baseCount: 12,
    countPerPlayer: 4,
    eliteChance: 0.02,
    spawnPosition: SpawnPosition.EdgeOfScreen,
    xpBonus: 15,
  },
  {
    waveRange: [7, 10],
    enemyPool: EarlyGameEnemyPool,
    baseCount: 16,
    countPerPlayer: 5,
    eliteChance: 0.05,
    spawnPosition: SpawnPosition.EdgeOfScreen,
    xpBonus: 25,
  },
];

/** Mid game wave templates (11-25) */
export const MidGameTemplates: WaveTemplate[] = [
  {
    waveRange: [11, 15],
    enemyPool: MidGameEnemyPool,
    baseCount: 20,
    countPerPlayer: 6,
    eliteChance: 0.08,
    spawnPosition: SpawnPosition.EdgeOfScreen,
    xpBonus: 40,
  },
  {
    waveRange: [16, 20],
    enemyPool: MidGameEnemyPool,
    baseCount: 25,
    countPerPlayer: 7,
    eliteChance: 0.12,
    spawnPosition: SpawnPosition.AroundPlayers,
    xpBonus: 60,
  },
  {
    waveRange: [21, 25],
    enemyPool: [
      { enemyId: 'skeleton', weight: 25 },
      { enemyId: 'zombie', weight: 35 },
      { enemyId: 'ghost', weight: 30 },
      { enemyId: 'ogre', weight: 10 },
    ],
    baseCount: 30,
    countPerPlayer: 8,
    eliteChance: 0.15,
    spawnPosition: SpawnPosition.AroundPlayers,
    xpBonus: 80,
  },
];

/** Late game wave templates (26+) */
export const LateGameTemplates: WaveTemplate[] = [
  {
    waveRange: [26, 35],
    enemyPool: LateGameEnemyPool,
    baseCount: 35,
    countPerPlayer: 10,
    eliteChance: 0.2,
    modifiers: [WaveModifier.Tanky],
    spawnPosition: SpawnPosition.AroundPlayers,
    xpBonus: 120,
  },
  {
    waveRange: [36, 50],
    enemyPool: LateGameEnemyPool,
    baseCount: 40,
    countPerPlayer: 12,
    eliteChance: 0.25,
    modifiers: [WaveModifier.Tanky, WaveModifier.Fast],
    spawnPosition: SpawnPosition.AroundPlayers,
    xpBonus: 180,
  },
  {
    waveRange: [51, 999],
    enemyPool: LateGameEnemyPool,
    baseCount: 50,
    countPerPlayer: 15,
    eliteChance: 0.3,
    modifiers: [WaveModifier.Tanky, WaveModifier.Fast, WaveModifier.Elite],
    spawnPosition: SpawnPosition.AroundPlayers,
    xpBonus: 300,
  },
];

// ============================================
// Boss Waves
// ============================================

/** Boss wave configurations (every 5th wave) */
export const BossWaves: BossWaveConfig[] = [
  {
    waveNumber: 5,
    bossId: 'ogre', // Mini-boss: Ogre
    supportPool: [{ enemyId: 'bat', weight: 60 }, { enemyId: 'skeleton', weight: 40 }],
    supportCount: 10,
    bossSpawnDelay: 5,
    xpBonus: 100,
  },
  {
    waveNumber: 10,
    bossId: 'ogre', // TODO: Replace with actual boss when defined
    supportPool: BossSupportPool,
    supportCount: 15,
    bossSpawnDelay: 3,
    xpBonus: 200,
  },
  {
    waveNumber: 15,
    bossId: 'ogre', // TODO: Replace with stronger boss
    supportPool: BossSupportPool,
    supportCount: 20,
    bossSpawnDelay: 3,
    xpBonus: 350,
  },
  {
    waveNumber: 20,
    bossId: 'ogre', // TODO: Replace with stronger boss
    supportPool: [{ enemyId: 'zombie', weight: 40 }, { enemyId: 'ghost', weight: 60 }],
    supportCount: 25,
    bossSpawnDelay: 2,
    xpBonus: 500,
  },
  {
    waveNumber: 25,
    bossId: 'ogre', // TODO: Replace with final boss
    supportPool: EliteEnemyPool,
    supportCount: 30,
    bossSpawnDelay: 2,
    xpBonus: 750,
  },
  {
    waveNumber: 30,
    bossId: 'ogre', // TODO: Replace with final boss
    supportPool: EliteEnemyPool,
    supportCount: 40,
    bossSpawnDelay: 1,
    xpBonus: 1000,
  },
];

// ============================================
// Special Waves
// ============================================

/** Special wave configurations (randomly replace normal waves) */
export const SpecialWaves: Record<string, SpecialWaveConfig> = {
  swarm: {
    name: 'Bat Swarm',
    enemyPool: SwarmEnemyPool,
    countMultiplier: 3.0,
    healthMultiplier: 0.5,
    damageMultiplier: 0.5,
    modifiers: [WaveModifier.Swarm, WaveModifier.Fast],
    xpBonusMultiplier: 1.5,
  },
  elite: {
    name: 'Elite Assault',
    enemyPool: EliteEnemyPool,
    countMultiplier: 0.5,
    healthMultiplier: 1.5,
    damageMultiplier: 1.3,
    modifiers: [WaveModifier.Elite, WaveModifier.Tanky],
    xpBonusMultiplier: 2.0,
  },
  rush: {
    name: 'Speed Rush',
    enemyPool: MidGameEnemyPool,
    countMultiplier: 1.5,
    healthMultiplier: 0.8,
    damageMultiplier: 1.0,
    modifiers: [WaveModifier.Fast],
    xpBonusMultiplier: 1.3,
  },
  nightmare: {
    name: 'Nightmare Wave',
    enemyPool: LateGameEnemyPool,
    countMultiplier: 1.2,
    healthMultiplier: 2.0,
    damageMultiplier: 1.5,
    modifiers: [WaveModifier.Tanky, WaveModifier.Elite, WaveModifier.NoPickups],
    xpBonusMultiplier: 3.0,
  },
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get wave template for a specific wave number.
 */
export function getWaveTemplate(waveNumber: number): WaveTemplate {
  // Check all template categories
  const allTemplates = [...EarlyGameTemplates, ...MidGameTemplates, ...LateGameTemplates];

  for (const template of allTemplates) {
    if (waveNumber >= template.waveRange[0] && waveNumber <= template.waveRange[1]) {
      return template;
    }
  }

  // Default to last late game template
  return LateGameTemplates[LateGameTemplates.length - 1];
}

/**
 * Get boss wave configuration if wave is a boss wave.
 */
export function getBossWaveConfig(waveNumber: number): BossWaveConfig | null {
  return BossWaves.find(boss => boss.waveNumber === waveNumber) ?? null;
}

/**
 * Check if wave is a boss wave.
 */
export function isBossWave(waveNumber: number): boolean {
  return waveNumber > 0 && waveNumber % 5 === 0;
}

/**
 * Select random enemy from pool based on weights.
 */
export function selectEnemyFromPool(pool: EnemyPoolEntry[], random: () => number = Math.random): string {
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.enemyId;
    }
  }

  // Fallback to first entry
  return pool[0].enemyId;
}

/**
 * Get enemy pool for wave number.
 */
export function getEnemyPoolForWave(waveNumber: number): EnemyPoolEntry[] {
  const template = getWaveTemplate(waveNumber);
  return template.enemyPool;
}

/**
 * Calculate total enemy count for wave.
 */
export function calculateEnemyCount(
  waveNumber: number,
  playerCount: number,
  difficulty: number
): number {
  const template = getWaveTemplate(waveNumber);
  const baseCount = template.baseCount + template.countPerPlayer * playerCount;
  const difficultyMultiplier = 1 + (difficulty - 1) * 0.1;

  return Math.floor(baseCount * difficultyMultiplier);
}

/**
 * Get modifier multipliers for a wave.
 */
export function getModifierMultipliers(modifiers: WaveModifier[]): {
  health: number;
  damage: number;
  speed: number;
  count: number;
} {
  const result = { health: 1, damage: 1, speed: 1, count: 1 };

  for (const modifier of modifiers) {
    switch (modifier) {
      case WaveModifier.Fast:
        result.speed *= 1.3;
        break;
      case WaveModifier.Tanky:
        result.health *= 1.5;
        break;
      case WaveModifier.Swarm:
        result.count *= 2.0;
        result.health *= 0.5;
        break;
      case WaveModifier.Elite:
        result.health *= 1.3;
        result.damage *= 1.2;
        break;
      case WaveModifier.NoPickups:
        // No stat changes, handled elsewhere
        break;
    }
  }

  return result;
}
