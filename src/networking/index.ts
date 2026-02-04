/**
 * Networking module for Cosmic Survivors.
 * Provides multiplayer functionality using Nakama.
 */

// Core client
export { NakamaClient } from './NakamaClient';
export type {
  IRPCResponse,
  IMatchPresenceEvent,
  IMatchDataEvent,
  INakamaCallbacks,
} from './NakamaClient';

// Network manager
export { NetworkManager } from './NetworkManager';

// State synchronization
export { StateSync, SyncPriority } from './StateSync';

// Client-side prediction
export { Prediction } from './Prediction';

// Entity interpolation
export { Interpolation } from './Interpolation';

// Message encoding/decoding
export { NetworkMessages } from './NetworkMessages';
export type {
  IMessageTypeMap,
  IWeaponFireMessage,
  IDamageMessage,
  IEntityKilledMessage,
  IXPCollectedMessage,
  IWaveStartMessage,
  IWaveEndMessage,
  IBossSpawnMessage,
  IUpgradeSelectedMessage,
  ILevelUpMessage,
  IStartMatchMessage,
  IPauseMatchMessage,
  IEndMatchMessage,
  IPlayerReadyMessage,
} from './NetworkMessages';

// Match handling
export { MatchHandler } from './MatchHandler';
export type { IMatchConfig, IMatchCallbacks } from './MatchHandler';

// Re-export networking interfaces from shared
export {
  ConnectionState,
  GameNetState,
  NetMessageType,
  AuthMethod,
} from '../shared/interfaces/INetworking';

export type {
  INetworkManager,
  INetworkPlayer,
  IMatchState,
  INetworkInput,
  INetworkEntityState,
  IStateSnapshot,
  IStateDelta,
  IAuthCredentials,
  IPrediction,
  IInterpolation,
} from '../shared/interfaces/INetworking';

/**
 * Network configuration constants.
 */
export const NetworkConfig = {
  /** Network tick rate in Hz */
  TICK_RATE: 20,

  /** Interpolation delay in milliseconds */
  INTERPOLATION_DELAY: 100,

  /** Maximum prediction frames */
  MAX_PREDICTION_FRAMES: 10,

  /** Input buffer size */
  INPUT_BUFFER_SIZE: 32,

  /** Full snapshot interval in ticks */
  SNAPSHOT_INTERVAL: 100,

  /** Position change threshold for delta sync */
  POSITION_THRESHOLD: 0.1,

  /** Velocity change threshold for delta sync */
  VELOCITY_THRESHOLD: 0.1,

  /** Maximum entities per network packet */
  MAX_ENTITIES_PER_PACKET: 50,

  /** Default server key */
  DEFAULT_SERVER_KEY: 'defaultkey',
} as const;

// Factory function imports
import { NetworkManager as NetworkManagerClass } from './NetworkManager';

/**
 * Create a configured NetworkManager instance.
 */
export function createNetworkManager(options?: {
  maxPlayers?: number;
  minPlayers?: number;
  countdownDuration?: number;
  autoStart?: boolean;
  hostMigration?: boolean;
}): NetworkManagerClass {
  return new NetworkManagerClass(options);
}
