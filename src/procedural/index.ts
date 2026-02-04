/**
 * Procedural systems module exports.
 *
 * Provides wave generation, loot drops, difficulty scaling,
 * upgrade selection, XP management, and pickup collection.
 */

// Wave Generation
export { WaveGenerator, createWaveGenerator } from './WaveGenerator';
export {
  getWaveTemplate,
  getBossWaveConfig,
  isBossWave,
  selectEnemyFromPool,
  calculateEnemyCount,
  getModifierMultipliers,
  getEnemyPoolForWave,
  EarlyGameEnemyPool,
  MidGameEnemyPool,
  LateGameEnemyPool,
  SwarmEnemyPool,
  EliteEnemyPool,
  BossSupportPool,
  EarlyGameTemplates,
  MidGameTemplates,
  LateGameTemplates,
  BossWaves,
  SpecialWaves,
} from './WaveDefinitions';
export type {
  EnemyPoolEntry,
  WaveTemplate,
  BossWaveConfig,
  SpecialWaveConfig,
} from './WaveDefinitions';

// Difficulty Scaling
export {
  DifficultyScaler,
  createDifficultyScaler,
} from './DifficultyScaler';
export type {
  DifficultyConfig,
  DifficultyStats,
} from './DifficultyScaler';

// Loot Generation
export {
  LootGenerator,
  createLootGenerator,
} from './LootGenerator';

// Upgrade Pool
export {
  UpgradePool,
  createUpgradePool,
} from './UpgradePool';
export type {
  UpgradeEntry,
} from './UpgradePool';

// XP System
export {
  XPSystem,
  createXPSystem,
  scaleXPValue,
} from './XPSystem';
export type {
  XPSystemConfig,
  PlayerXPState,
  XPGainEvent,
} from './XPSystem';

// Pickup System
export {
  PickupSystem,
  PickupFactory,
  createPickupSystem,
} from './PickupSystem';
export type {
  PickupCollectedEvent,
  SpecialEffectEvent,
} from './PickupSystem';

// Re-export interfaces for convenience
export type {
  IWaveDefinition,
  IWaveGenerator,
  IDifficultyScaler,
  ILootGenerator,
  ILootConfig,
  ILootDrop,
  ILootTableEntry,
  IUpgradePool,
  LootType,
  WaveModifier,
} from '../shared/interfaces/IProcedural';
export { LootType as LootTypeEnum, WaveModifier as WaveModifierEnum } from '../shared/interfaces/IProcedural';

/**
 * Create all procedural systems with shared dependencies.
 */
export interface ProceduralSystems {
  waveGenerator: WaveGenerator;
  difficultyScaler: DifficultyScaler;
  lootGenerator: LootGenerator;
  upgradePool: UpgradePool;
  xpSystem: XPSystem;
  pickupSystem: PickupSystem;
}

import type { IEventBus } from '../shared/interfaces/IEventBus';
import { WaveGenerator } from './WaveGenerator';
import { DifficultyScaler, createDifficultyScaler as createDifficultyScalerFn } from './DifficultyScaler';
import { LootGenerator } from './LootGenerator';
import { UpgradePool } from './UpgradePool';
import { XPSystem } from './XPSystem';
import { PickupSystem } from './PickupSystem';

/**
 * Initialize all procedural systems.
 */
export function createProceduralSystems(
  eventBus: IEventBus,
  options: {
    difficultyPreset?: 'easy' | 'normal' | 'hard' | 'nightmare';
    seed?: number;
    sharedXP?: boolean;
  } = {}
): ProceduralSystems {
  // Create difficulty scaler
  const difficultyScaler = options.difficultyPreset
    ? createDifficultyScalerFn(options.difficultyPreset)
    : new DifficultyScaler();

  // Create wave generator
  const waveGenerator = new WaveGenerator(
    eventBus,
    difficultyScaler,
    options.seed
  );

  // Create loot generator
  const lootGenerator = new LootGenerator();

  // Create upgrade pool
  const upgradePool = new UpgradePool();

  // Create XP system
  const xpSystem = new XPSystem(eventBus, {
    sharedXP: options.sharedXP ?? false,
  });
  xpSystem.setUpgradePool(upgradePool);

  // Create pickup system
  const pickupSystem = new PickupSystem();
  pickupSystem.setEventBus(eventBus);
  pickupSystem.setXPSystem(xpSystem);

  // Connect difficulty to loot scaling
  const updateLootScaling = (): void => {
    lootGenerator.setXPScaling(difficultyScaler.getXPMultiplier());
  };

  // Update loot scaling periodically (through difficulty updates)
  eventBus.on('difficulty:update', updateLootScaling);

  return {
    waveGenerator,
    difficultyScaler,
    lootGenerator,
    upgradePool,
    xpSystem,
    pickupSystem,
  };
}
