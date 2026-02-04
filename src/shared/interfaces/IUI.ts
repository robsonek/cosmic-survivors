import type { WeaponRarity } from './IWeapon';

/**
 * UI Screen identifiers.
 */
export enum UIScreen {
  MainMenu = 'mainMenu',
  Lobby = 'lobby',
  Game = 'game',
  Pause = 'pause',
  UpgradeSelection = 'upgradeSelection',
  GameOver = 'gameOver',
  Victory = 'victory',
  Settings = 'settings',
  TalentTree = 'talentTree',
  Achievements = 'achievements',
  Stats = 'stats',
}

/**
 * HUD element identifiers.
 */
export enum HUDElement {
  Health = 'health',
  XPBar = 'xpBar',
  Level = 'level',
  Timer = 'timer',
  KillCount = 'killCount',
  WeaponSlots = 'weaponSlots',
  PassiveSlots = 'passiveSlots',
  Minimap = 'minimap',
  BossHealth = 'bossHealth',
  PlayerList = 'playerList',
  Ping = 'ping',
}

/**
 * UI Manager interface.
 */
export interface IUIManager {
  /** Current active screen */
  readonly currentScreen: UIScreen;

  /** Whether UI is blocking input */
  readonly isBlocking: boolean;

  // Screens

  /**
   * Show a screen.
   * @param screen Screen to show
   * @param data Optional data to pass to screen
   */
  showScreen(screen: UIScreen, data?: unknown): void;

  /**
   * Hide current screen.
   */
  hideScreen(): void;

  /**
   * Go back to previous screen.
   */
  goBack(): void;

  // HUD

  /**
   * Update HUD element.
   */
  updateHUD(element: HUDElement, data: unknown): void;

  /**
   * Show/hide HUD element.
   */
  setHUDVisible(element: HUDElement, visible: boolean): void;

  /**
   * Show entire HUD.
   */
  showHUD(): void;

  /**
   * Hide entire HUD.
   */
  hideHUD(): void;

  // Popups & Notifications

  /**
   * Show damage number at position.
   */
  showDamageNumber(x: number, y: number, damage: number, isCritical: boolean): void;

  /**
   * Show floating text.
   */
  showFloatingText(x: number, y: number, text: string, color?: number): void;

  /**
   * Show notification toast.
   */
  showNotification(message: string, type?: NotificationType, duration?: number): void;

  /**
   * Show confirmation dialog.
   */
  showConfirm(title: string, message: string): Promise<boolean>;

  // Upgrade Selection

  /**
   * Show upgrade selection screen.
   * @param choices Available upgrade choices
   * @returns Selected upgrade ID
   */
  showUpgradeSelection(choices: IUpgradeChoice[]): Promise<string>;

  // Input

  /**
   * Check if UI consumed the input.
   */
  consumedInput(): boolean;

  // Lifecycle

  /**
   * Update UI elements.
   */
  update(dt: number): void;

  /**
   * Clean up UI.
   */
  destroy(): void;
}

export enum NotificationType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Achievement = 'achievement',
}

/**
 * Upgrade choice shown in upgrade selection.
 */
export interface IUpgradeChoice {
  id: string;
  type: 'weapon' | 'passive' | 'evolution';
  name: string;
  description: string;
  rarity: WeaponRarity;
  icon: string;
  isNew: boolean;           // First time acquiring
  currentLevel?: number;    // Current level if upgrading
  maxLevel?: number;        // Max level
}

/**
 * HUD data types.
 */
export interface IHUDHealthData {
  current: number;
  max: number;
  shield?: number;
}

export interface IHUDXPData {
  current: number;
  required: number;
  level: number;
}

export interface IHUDWeaponSlotData {
  weapons: Array<{
    id: string;
    icon: string;
    level: number;
    cooldownPercent: number; // 0-1
  }>;
}

export interface IHUDPassiveSlotData {
  passives: Array<{
    id: string;
    icon: string;
    level: number;
  }>;
}

export interface IHUDPlayerListData {
  players: Array<{
    name: string;
    level: number;
    health: number;
    isLocal: boolean;
  }>;
}

export interface IHUDBossHealthData {
  name: string;
  current: number;
  max: number;
  phases?: number;
  currentPhase?: number;
}

/**
 * UI component base interface.
 */
export interface IUIComponent {
  /** Unique identifier */
  readonly id: string;

  /** Whether component is visible */
  visible: boolean;

  /** Whether component is interactive */
  interactive: boolean;

  /** Update component */
  update(dt: number): void;

  /** Show component */
  show(): void;

  /** Hide component */
  hide(): void;

  /** Destroy component */
  destroy(): void;
}

/**
 * Button component.
 */
export interface IUIButton extends IUIComponent {
  text: string;
  disabled: boolean;
  onClick(handler: () => void): void;
}

/**
 * Progress bar component.
 */
export interface IUIProgressBar extends IUIComponent {
  value: number;      // 0-1
  maxValue: number;
  showText: boolean;
  setColors(background: number, fill: number): void;
}
