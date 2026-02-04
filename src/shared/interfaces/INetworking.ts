import type { EntityId } from './IWorld';

/**
 * Network connection state.
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error',
}

/**
 * Player info from server.
 */
export interface INetworkPlayer {
  id: string;              // Nakama user ID
  displayName: string;
  entity: EntityId;        // Local entity ID
  isLocal: boolean;        // Is this the local player
  isHost: boolean;         // Is this the match host
  latency: number;         // Round-trip time in ms
}

/**
 * Match state from server.
 */
export interface IMatchState {
  matchId: string;
  tick: number;
  players: INetworkPlayer[];
  gameState: GameNetState;
  waveNumber: number;
  timeElapsed: number;
}

export enum GameNetState {
  Lobby = 'lobby',
  Starting = 'starting',
  Playing = 'playing',
  Paused = 'paused',
  GameOver = 'gameOver',
}

/**
 * Network message types.
 */
export enum NetMessageType {
  // Player actions
  PlayerInput = 1,
  PlayerPosition = 2,
  PlayerAction = 3,

  // Combat
  WeaponFire = 10,
  DamageDealt = 11,
  EntityKilled = 12,
  XPCollected = 13,

  // Game state
  StateSnapshot = 20,
  StateDelta = 21,
  WaveStart = 22,
  WaveEnd = 23,
  BossSpawn = 24,

  // Upgrades
  UpgradeSelected = 30,
  LevelUp = 31,

  // Match control
  StartMatch = 40,
  PauseMatch = 41,
  EndMatch = 42,
  PlayerReady = 43,
}

/**
 * Player input for network sync.
 */
export interface INetworkInput {
  tick: number;
  moveX: number;          // -1 to 1
  moveY: number;          // -1 to 1
  aimX: number;           // Aim direction X
  aimY: number;           // Aim direction Y
  actions: number;        // Bit flags for actions
}

/**
 * Entity state for network sync.
 */
export interface INetworkEntityState {
  entity: EntityId;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  health?: number;
  rotation?: number;
  state?: number;         // Animation/behavior state
}

/**
 * State snapshot for full sync.
 */
export interface IStateSnapshot {
  tick: number;
  timestamp: number;
  entities: INetworkEntityState[];
  waveNumber: number;
  xpOrbs: Array<{ x: number; y: number; value: number }>;
}

/**
 * State delta for incremental sync.
 */
export interface IStateDelta {
  tick: number;
  timestamp: number;
  added: INetworkEntityState[];
  updated: Array<{ entity: EntityId; changes: Partial<INetworkEntityState> }>;
  removed: EntityId[];
}

/**
 * Network manager interface.
 */
export interface INetworkManager {
  /** Current connection state */
  readonly state: ConnectionState;

  /** Current match state */
  readonly matchState: IMatchState | null;

  /** Local player info */
  readonly localPlayer: INetworkPlayer | null;

  /** Current latency in ms */
  readonly latency: number;

  /** Whether this instance has authority */
  readonly isAuthority: boolean;

  // Connection

  /**
   * Connect to Nakama server.
   */
  connect(serverUrl: string): Promise<void>;

  /**
   * Disconnect from server.
   */
  disconnect(): Promise<void>;

  /**
   * Authenticate with server.
   */
  authenticate(method: AuthMethod, credentials: IAuthCredentials): Promise<INetworkPlayer>;

  // Match

  /**
   * Create a new match.
   */
  createMatch(): Promise<string>;

  /**
   * Join existing match.
   */
  joinMatch(matchId: string): Promise<void>;

  /**
   * Leave current match.
   */
  leaveMatch(): Promise<void>;

  /**
   * Start the match (host only).
   */
  startMatch(): Promise<void>;

  // Messaging

  /**
   * Send message to server.
   */
  send(type: NetMessageType, data: unknown): void;

  /**
   * Send reliable message (TCP-like).
   */
  sendReliable(type: NetMessageType, data: unknown): void;

  /**
   * Register message handler.
   */
  onMessage<T>(type: NetMessageType, handler: (data: T, sender: string) => void): void;

  // State Sync

  /**
   * Send local player input.
   */
  sendInput(input: INetworkInput): void;

  /**
   * Get predicted state for entity.
   */
  getPredictedState(entity: EntityId): INetworkEntityState | null;

  /**
   * Apply state from server.
   */
  applyServerState(snapshot: IStateSnapshot): void;

  /**
   * Get interpolated state for remote entity.
   */
  getInterpolatedState(entity: EntityId, renderTime: number): INetworkEntityState | null;
}

export enum AuthMethod {
  Device = 'device',
  Email = 'email',
  Google = 'google',
  Steam = 'steam',
  Guest = 'guest',
}

export interface IAuthCredentials {
  email?: string;
  password?: string;
  token?: string;
  deviceId?: string;
  displayName?: string;
}

/**
 * Client-side prediction interface.
 */
export interface IPrediction {
  /**
   * Store input for prediction.
   */
  storeInput(tick: number, input: INetworkInput): void;

  /**
   * Get predicted position based on inputs.
   */
  predictPosition(entity: EntityId, currentTick: number): { x: number; y: number };

  /**
   * Reconcile with server state.
   */
  reconcile(serverTick: number, serverState: INetworkEntityState): void;

  /**
   * Clear old inputs.
   */
  clearOldInputs(beforeTick: number): void;
}

/**
 * Entity interpolation interface.
 */
export interface IInterpolation {
  /**
   * Add state snapshot for entity.
   */
  addSnapshot(entity: EntityId, state: INetworkEntityState, timestamp: number): void;

  /**
   * Get interpolated state at render time.
   */
  getState(entity: EntityId, renderTime: number): INetworkEntityState | null;

  /**
   * Clear old snapshots.
   */
  clearOld(beforeTimestamp: number): void;
}
