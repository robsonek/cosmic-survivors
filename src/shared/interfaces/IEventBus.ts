/**
 * Event handler function type.
 */
export type EventHandler<T = unknown> = (data: T) => void;

/**
 * Subscription handle for unsubscribing.
 */
export interface ISubscription {
  /** Unsubscribe from the event */
  unsubscribe(): void;
}

/**
 * Central event bus for decoupled communication.
 */
export interface IEventBus {
  /**
   * Subscribe to an event.
   * @param event Event name
   * @param handler Handler function
   * @returns Subscription handle
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): ISubscription;

  /**
   * Subscribe to an event (fires only once).
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): ISubscription;

  /**
   * Unsubscribe from an event.
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void;

  /**
   * Emit an event.
   * @param event Event name
   * @param data Event data
   */
  emit<T = unknown>(event: string, data: T): void;

  /**
   * Emit an event with delay (in ms).
   */
  emitDelayed<T = unknown>(event: string, data: T, delayMs: number): void;

  /**
   * Remove all handlers for an event.
   */
  clear(event: string): void;

  /**
   * Remove all handlers for all events.
   */
  clearAll(): void;

  /**
   * Check if event has any handlers.
   */
  hasHandlers(event: string): boolean;
}

// ============================================
// Game Event Types
// ============================================

/** Damage event data */
export interface DamageEvent {
  source: number;      // Entity that dealt damage
  target: number;      // Entity that received damage
  amount: number;      // Damage amount
  type: DamageType;    // Type of damage
  isCritical: boolean; // Whether it was a critical hit
  position: { x: number; y: number };
}

export enum DamageType {
  Physical = 'physical',
  Fire = 'fire',
  Ice = 'ice',
  Lightning = 'lightning',
  Poison = 'poison',
  Arcane = 'arcane',
}

/** Entity killed event */
export interface EntityKilledEvent {
  entity: number;
  killer: number;
  position: { x: number; y: number };
  xpValue: number;
}

/** Weapon fired event */
export interface WeaponFiredEvent {
  entity: number;
  weaponId: string;
  position: { x: number; y: number };
  direction: { x: number; y: number };
  projectileCount: number;
}

/** Player level up event */
export interface PlayerLevelUpEvent {
  entity: number;
  newLevel: number;
  upgradeChoices: string[]; // Array of upgrade IDs to choose from
}

/** Upgrade selected event */
export interface UpgradeSelectedEvent {
  entity: number;
  upgradeId: string;
  upgradeType: 'weapon' | 'passive' | 'evolution';
}

/** Wave events */
export interface WaveStartEvent {
  waveNumber: number;
  enemyTypes: string[];
  totalEnemies: number;
  duration: number;
}

export interface WaveCompleteEvent {
  waveNumber: number;
  enemiesKilled: number;
  timeElapsed: number;
  bonusXP: number;
}

export interface BossSpawnEvent {
  bossType: string;
  position: { x: number; y: number };
  entity: number;
}

/** Boss phase change event */
export interface BossPhaseChangeEvent {
  bossEntity: number;
  oldPhase: number;
  newPhase: number;
  phaseName: string;
}

/** Boss enrage event */
export interface BossEnrageEvent {
  bossEntity: number;
}

/** Boss defeated event */
export interface BossDefeatedEvent {
  bossType: string;
  bossEntity: number;
  position: { x: number; y: number };
  xpValue: number;
}

/** Screen effect events */
export interface ScreenShakeEvent {
  intensity: number;
  duration: number;
}

export interface ScreenFlashEvent {
  color: number;
  duration: number;
  intensity?: number;
}

export interface ScreenSlowMotionEvent {
  factor: number;
  duration: number;
}

/** Shockwave visual effect event */
export interface ShockwaveEffectEvent {
  x: number;
  y: number;
  radius: number;
  color: number;
}

/** Network events */
export interface PlayerConnectedEvent {
  playerId: string;
  displayName: string;
  entity: number;
}

export interface PlayerDisconnectedEvent {
  playerId: string;
  reason: string;
}

export interface NetworkStateUpdateEvent {
  tick: number;
  entities: NetworkEntityState[];
}

export interface NetworkEntityState {
  entity: number;
  components: Record<string, unknown>;
}

/** Audio events */
export interface PlaySFXEvent {
  sfxId: string;
  position?: { x: number; y: number };
  volume?: number;
  pitch?: number;
}

export interface PlayMusicEvent {
  trackId: string;
  fadeIn?: number;
  loop?: boolean;
}

// ============================================
// Event Names (Constants)
// ============================================

export const GameEvents = {
  // Combat
  DAMAGE: 'combat:damage',
  ENTITY_KILLED: 'combat:entityKilled',
  WEAPON_FIRED: 'combat:weaponFired',

  // Progression
  PLAYER_LEVEL_UP: 'progression:levelUp',
  UPGRADE_SELECTED: 'progression:upgradeSelected',
  XP_GAINED: 'progression:xpGained',

  // Waves
  WAVE_START: 'wave:start',
  WAVE_COMPLETE: 'wave:complete',
  BOSS_SPAWN: 'wave:bossSpawn',
  BOSS_PHASE_CHANGE: 'boss:phaseChange',
  BOSS_ENRAGE: 'boss:enrage',
  BOSS_DEFEATED: 'boss:defeated',

  // Screen Effects
  SCREEN_SHAKE: 'screen:shake',
  SCREEN_FLASH: 'screen:flash',
  SCREEN_SLOW_MOTION: 'screen:slowMotion',
  EFFECT_SHOCKWAVE: 'effect:shockwave',

  // Network
  PLAYER_CONNECTED: 'network:playerConnected',
  PLAYER_DISCONNECTED: 'network:playerDisconnected',
  NETWORK_STATE_UPDATE: 'network:stateUpdate',
  NETWORK_LATENCY_UPDATE: 'network:latencyUpdate',

  // Audio
  PLAY_SFX: 'audio:playSFX',
  STOP_SFX: 'audio:stopSFX',
  PLAY_MUSIC: 'audio:playMusic',
  STOP_MUSIC: 'audio:stopMusic',

  // UI
  SHOW_DAMAGE_NUMBER: 'ui:showDamageNumber',
  SHOW_NOTIFICATION: 'ui:showNotification',
  UPDATE_HUD: 'ui:updateHUD',

  // Game State
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  GAME_OVER: 'game:over',
  GAME_WIN: 'game:win',
} as const;
