/**
 * Player persistent progression data.
 */
export interface IPlayerProgression {
  /** Total XP earned across all runs */
  totalXP: number;

  /** Current talent points available */
  talentPoints: number;

  /** Unlocked talents */
  unlockedTalents: string[];

  /** Unlocked weapons */
  unlockedWeapons: string[];

  /** Unlocked characters */
  unlockedCharacters: string[];

  /** Achievement IDs */
  achievements: string[];

  /** Highest wave reached */
  highestWave: number;

  /** Total enemies killed */
  totalKills: number;

  /** Total game time in seconds */
  totalPlayTime: number;

  /** Number of runs completed */
  runsCompleted: number;

  /** Number of deaths */
  totalDeaths: number;

  /** Statistics per weapon */
  weaponStats: Record<string, IWeaponUsageStats>;

  /** Lifetime currency earned */
  lifetimeGold: number;

  /** Current gold */
  currentGold: number;
}

/** Statistics for weapon usage in meta progression */
export interface IWeaponUsageStats {
  timesUsed: number;
  damageDealt: number;
  kills: number;
  maxLevel: number;
  evolutions: number;
}

/**
 * Talent node definition.
 */
export interface ITalentNode {
  id: string;
  name: string;
  description: string;
  icon: string;

  /** Cost in talent points */
  cost: number;

  /** Max level for this talent */
  maxLevel: number;

  /** Stat modifiers per level */
  modifiers: ITalentModifiers;

  /** Required talents to unlock */
  prerequisites: string[];

  /** Position in talent tree */
  position: { x: number; y: number };

  /** Branch/category */
  branch: TalentBranch;
}

export enum TalentBranch {
  Offense = 'offense',
  Defense = 'defense',
  Utility = 'utility',
  Special = 'special',
}

export interface ITalentModifiers {
  damagePercent?: number;
  healthPercent?: number;
  speedPercent?: number;
  cooldownReduction?: number;
  xpGain?: number;
  pickupRadius?: number;
  critChance?: number;
  critDamage?: number;
  projectileCount?: number;
  areaPercent?: number;
  startingWeapon?: string;
  revivals?: number;
}

/**
 * Talent tree interface.
 */
export interface ITalentTree {
  /** All talent nodes */
  readonly nodes: ReadonlyMap<string, ITalentNode>;

  /** Currently unlocked talents with levels */
  readonly unlocked: ReadonlyMap<string, number>;

  /** Available talent points */
  readonly availablePoints: number;

  /**
   * Unlock or upgrade a talent.
   */
  unlock(talentId: string): boolean;

  /**
   * Check if talent can be unlocked.
   */
  canUnlock(talentId: string): boolean;

  /**
   * Get current level of talent.
   */
  getLevel(talentId: string): number;

  /**
   * Get total modifiers from all talents.
   */
  getTotalModifiers(): ITalentModifiers;

  /**
   * Reset all talents (refund points).
   */
  reset(): void;

  /**
   * Add talent points.
   */
  addPoints(amount: number): void;
}

/**
 * Achievement definition.
 */
export interface IAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;

  /** Hidden until unlocked */
  hidden: boolean;

  /** Rewards for unlocking */
  rewards: IAchievementRewards;

  /** Unlock condition type */
  condition: AchievementCondition;

  /** Target value for condition */
  target: number;

  /** Current progress */
  progress?: number;
}

export enum AchievementRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

export enum AchievementCondition {
  KillCount = 'killCount',
  WaveReached = 'waveReached',
  SurviveTime = 'surviveTime',
  NoHitWave = 'noHitWave',
  MaxLevel = 'maxLevel',
  FullEvolutions = 'fullEvolutions',
  BossKilled = 'bossKilled',
  BossNoHit = 'bossNoHit',
  MultiplayerWin = 'multiplayerWin',
  TotalPlayTime = 'totalPlayTime',
  WeaponMastery = 'weaponMastery',
  CollectXP = 'collectXP',
  ComboCount = 'comboCount',
}

export interface IAchievementRewards {
  xp?: number;
  gold?: number;
  talentPoints?: number;
  unlockWeapon?: string;
  unlockCharacter?: string;
  title?: string;
}

/**
 * Achievement system interface.
 */
export interface IAchievementSystem {
  /** All achievements */
  readonly achievements: ReadonlyMap<string, IAchievement>;

  /** Unlocked achievement IDs */
  readonly unlocked: ReadonlySet<string>;

  /**
   * Check and potentially unlock achievements.
   */
  check(): void;

  /**
   * Update progress for specific condition.
   */
  updateProgress(condition: AchievementCondition, value: number): void;

  /**
   * Get achievement by ID.
   */
  get(id: string): IAchievement | undefined;

  /**
   * Check if achievement is unlocked.
   */
  isUnlocked(id: string): boolean;

  /**
   * Get completion percentage.
   */
  getCompletionPercent(): number;
}

/**
 * Save data structure.
 */
export interface ISaveData {
  version: number;
  timestamp: number;
  progression: IPlayerProgression;
  settings: IGameSettings;
}

export interface IGameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  damageNumbers: boolean;
  showFPS: boolean;
  language: string;
  controls: IControlSettings;
}

export interface IControlSettings {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  pause: string;
  interact: string;
}

/**
 * Save system interface.
 */
export interface ISaveSystem {
  /**
   * Save game data locally.
   */
  saveLocal(data: ISaveData): Promise<void>;

  /**
   * Load local save data.
   */
  loadLocal(): Promise<ISaveData | null>;

  /**
   * Sync with cloud (Nakama).
   */
  syncCloud(): Promise<void>;

  /**
   * Check if cloud save is newer.
   */
  hasNewerCloudSave(): Promise<boolean>;

  /**
   * Export save as string (for backup).
   */
  export(): string;

  /**
   * Import save from string.
   */
  import(data: string): Promise<void>;

  /**
   * Delete all save data.
   */
  delete(): Promise<void>;
}
