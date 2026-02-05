/**
 * UI Module index for Cosmic Survivors.
 * Exports all UI components, screens, and managers.
 */

// Main managers
export { UIManager, type UIManagerConfig } from './UIManager';
export { UIFactory, type UpgradeCardConfig } from './UIFactory';

// Constants
export {
  UIColors,
  UIFonts,
  UIDepth,
  UIAnimations,
  UISizes,
  getRarityColor,
  getRarityName,
} from './UIConstants';

// Components
export {
  Button,
  type ButtonConfig,
  ProgressBar,
  type ProgressBarConfig,
  Panel,
  type PanelConfig,
  Tooltip,
  type TooltipConfig,
} from './components';

// HUD
export {
  HealthBar,
  type HealthBarConfig,
  XPBar,
  type XPBarConfig,
  WeaponSlots,
  type WeaponSlotsConfig,
  Timer,
  type TimerConfig,
  type TimerData,
  KillCounter,
  type KillCounterConfig,
  type KillCounterData,
  HUD,
  type HUDConfig,
} from './hud';

// Screens
export {
  UpgradeSelectionScreen,
  type UpgradeSelectionScreenConfig,
  PauseScreen,
  type PauseScreenConfig,
  type PauseStats,
  GameOverScreen,
  type GameOverScreenConfig,
  type GameOverStats,
  StatsScreen,
  type StatsScreenConfig,
  type GameStats,
  type BestStats,
  type EnemyKillRecord,
  type WeaponUsageRecord,
  type DPSDataPoint,
  StatsTracker,
  createStatsTracker,
} from './screens';

// Standalone UI Components
export {
  UpgradeSelectionUI,
  type UpgradeSelectionUIConfig,
  type IUpgrade,
} from './UpgradeSelectionUI';

// Wave Announcer
export {
  WaveAnnouncer,
  AnnouncementType,
  createWaveAnnouncer,
  type WaveAnnouncerConfig,
} from './WaveAnnouncer';

// Achievement Popup
export {
  AchievementPopup,
  type AchievementPopupConfig,
} from './AchievementPopup';
