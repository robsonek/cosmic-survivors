/**
 * Meta-progression module for Cosmic Survivors.
 *
 * Exports:
 * - TalentTree & TalentDefinitions
 * - AchievementSystem & AchievementDefinitions
 * - ProgressionManager
 * - SaveSystem
 * - SettingsManager
 */

// Talent system
export { TalentTree } from './TalentTree';
export type { TalentTreeState, TalentUnlockedEvent, TalentResetEvent } from './TalentTree';

export {
  TALENT_DEFINITIONS,
  getTalentDefinitionsMap,
  getTalentsByBranch,
  getTotalTalentCost,
} from './TalentDefinitions';

// Achievement system
export { AchievementSystem } from './AchievementSystem';
export type {
  AchievementSystemState,
  AchievementUnlockedEvent,
  AchievementProgressEvent,
} from './AchievementSystem';

export {
  ACHIEVEMENT_DEFINITIONS,
  getAchievementDefinitionsMap,
  getAchievementsByRarity,
  getAchievementsByCondition,
  getHiddenAchievements,
  getTotalAchievementCount,
} from './AchievementDefinitions';

// Progression manager
export { ProgressionManager } from './ProgressionManager';
export type { RunResult, ProgressionUpdateEvent } from './ProgressionManager';

// Save system
export { SaveSystem, createDefaultSaveData, getDefaultProgression } from './SaveSystem';
export { getDefaultSettings as getSaveDefaultSettings } from './SaveSystem';
export type { SaveEvent } from './SaveSystem';

// Settings manager
export {
  SettingsManager,
  getDefaultControls,
  getDefaultSettings,
  SUPPORTED_LANGUAGES,
} from './SettingsManager';
export type { SettingsChangedEvent, SupportedLanguage } from './SettingsManager';

// Re-export interfaces from shared
export type {
  IPlayerProgression,
  IWeaponUsageStats,
  ITalentTree,
  ITalentNode,
  ITalentModifiers,
  TalentBranch,
  IAchievementSystem,
  IAchievement,
  IAchievementRewards,
  AchievementRarity,
  AchievementCondition,
  ISaveSystem,
  ISaveData,
  IGameSettings,
  IControlSettings,
} from '@shared/interfaces/IMeta';
