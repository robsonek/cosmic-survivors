/**
 * Network Manager for Cosmic Survivors.
 * Central networking hub implementing INetworkManager interface.
 */

import {
  INetworkManager,
  ConnectionState,
  IMatchState,
  INetworkPlayer,
  INetworkInput,
  INetworkEntityState,
  IStateSnapshot,
  NetMessageType,
  AuthMethod,
  IAuthCredentials,
  GameNetState,
} from '../shared/interfaces/INetworking';
import type { EntityId } from '../shared/interfaces/IWorld';
import { NakamaClient } from './NakamaClient';
import { StateSync, SyncPriority } from './StateSync';
import { Prediction } from './Prediction';
import { Interpolation } from './Interpolation';
import { NetworkMessages } from './NetworkMessages';
import { MatchHandler, IMatchConfig, IMatchCallbacks } from './MatchHandler';

/**
 * Network tick rate (Hz).
 */
const NETWORK_TICK_RATE = 20;

/**
 * Interpolation delay (ms).
 */
const INTERPOLATION_DELAY = 100;

/**
 * Maximum prediction frames.
 */
const MAX_PREDICTION_FRAMES = 10;

/**
 * Input buffer size.
 */
const INPUT_BUFFER_SIZE = 32;

/**
 * Message handler type.
 */
type MessageHandler<T> = (data: T, sender: string) => void;

/**
 * NetworkManager - Central networking hub.
 */
export class NetworkManager implements INetworkManager {
  private client: NakamaClient;
  private stateSync: StateSync;
  private prediction: Prediction;
  private interpolation: Interpolation;
  private matchHandler: MatchHandler;

  private _state: ConnectionState = ConnectionState.Disconnected;
  private _localPlayer: INetworkPlayer | null = null;
  private _isAuthority: boolean = false;

  private messageHandlers: Map<NetMessageType, Set<MessageHandler<unknown>>> = new Map();
  private unsubscribers: Array<() => void> = [];

  private currentTick: number = 0;
  private tickAccumulator: number = 0;

  private pendingInputs: Map<number, INetworkInput> = new Map();

  constructor(matchConfig?: Partial<IMatchConfig>) {
    this.client = new NakamaClient();
    this.stateSync = new StateSync();
    this.prediction = new Prediction({
      maxPredictionFrames: MAX_PREDICTION_FRAMES,
      inputBufferSize: INPUT_BUFFER_SIZE,
    });
    this.interpolation = new Interpolation({
      interpolationDelay: INTERPOLATION_DELAY,
    });
    this.matchHandler = new MatchHandler(this.client, matchConfig);

    this.setupClientCallbacks();
  }

  // =============================================
  // INetworkManager Properties
  // =============================================

  get state(): ConnectionState {
    return this._state;
  }

  get matchState(): IMatchState | null {
    const state = this.matchHandler.getMatchState();
    if (state) {
      state.tick = this.currentTick;
    }
    return state;
  }

  get localPlayer(): INetworkPlayer | null {
    return this._localPlayer;
  }

  get latency(): number {
    return this.client.latency;
  }

  get isAuthority(): boolean {
    return this._isAuthority;
  }

  // =============================================
  // Connection
  // =============================================

  /**
   * Connect to Nakama server.
   */
  async connect(serverUrl: string): Promise<void> {
    this._state = ConnectionState.Connecting;

    try {
      await this.client.connect(serverUrl);
      console.log('NetworkManager: Connected to server');
    } catch (error) {
      this._state = ConnectionState.Error;
      throw error;
    }
  }

  /**
   * Disconnect from server.
   */
  async disconnect(): Promise<void> {
    await this.matchHandler.leaveMatch();
    await this.client.disconnect();

    this._state = ConnectionState.Disconnected;
    this._localPlayer = null;
    this._isAuthority = false;

    this.cleanup();
    console.log('NetworkManager: Disconnected');
  }

  /**
   * Authenticate with server.
   */
  async authenticate(method: AuthMethod, credentials: IAuthCredentials): Promise<INetworkPlayer> {
    const player = await this.client.authenticate(method, credentials);

    this._state = ConnectionState.Connected;
    this._localPlayer = player;

    // Initialize match handler with local player ID
    this.matchHandler.initialize(player.id);

    // Set up message handlers
    this.setupMessageHandlers();

    console.log(`NetworkManager: Authenticated as ${player.displayName} (${player.id})`);
    return player;
  }

  // =============================================
  // Match Management
  // =============================================

  /**
   * Create a new match.
   */
  async createMatch(): Promise<string> {
    const matchId = await this.matchHandler.createMatch();

    this._isAuthority = true; // Creator has authority
    this.resetNetworkState();

    console.log(`NetworkManager: Created match ${matchId}`);
    return matchId;
  }

  /**
   * Join an existing match.
   */
  async joinMatch(matchId: string): Promise<void> {
    await this.matchHandler.joinMatch(matchId);

    this._isAuthority = false; // Joiner doesn't have authority initially
    this.resetNetworkState();

    console.log(`NetworkManager: Joined match ${matchId}`);
  }

  /**
   * Leave current match.
   */
  async leaveMatch(): Promise<void> {
    await this.matchHandler.leaveMatch();

    this._isAuthority = false;
    this.resetNetworkState();

    console.log('NetworkManager: Left match');
  }

  /**
   * Start the match (host only).
   */
  async startMatch(): Promise<void> {
    await this.matchHandler.startMatch();

    if (this.matchHandler.isHost) {
      // Initialize tick time
      this.currentTick = 0;
    }
  }

  // =============================================
  // Messaging
  // =============================================

  /**
   * Send message (unreliable).
   */
  send(type: NetMessageType, data: unknown): void {
    const encoded = NetworkMessages.encode(type, data);
    this.client.sendMatchData(type, encoded);
  }

  /**
   * Send reliable message.
   */
  sendReliable(type: NetMessageType, data: unknown): void {
    const encoded = NetworkMessages.encode(type, data);
    this.client.sendMatchDataReliable(type, encoded);
  }

  /**
   * Register message handler.
   */
  onMessage<T>(type: NetMessageType, handler: MessageHandler<T>): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler<unknown>);
  }

  /**
   * Unregister message handler.
   */
  offMessage<T>(type: NetMessageType, handler: MessageHandler<T>): void {
    this.messageHandlers.get(type)?.delete(handler as MessageHandler<unknown>);
  }

  // =============================================
  // Input & State Sync
  // =============================================

  /**
   * Send local player input.
   */
  sendInput(input: INetworkInput): void {
    // Store input for prediction
    this.prediction.storeInput(input.tick, input);
    this.pendingInputs.set(input.tick, input);

    // Send to server
    this.send(NetMessageType.PlayerInput, input);

    // Clean up old pending inputs
    const oldTick = input.tick - INPUT_BUFFER_SIZE;
    for (const tick of this.pendingInputs.keys()) {
      if (tick < oldTick) {
        this.pendingInputs.delete(tick);
      }
    }
  }

  /**
   * Get predicted state for local entity.
   */
  getPredictedState(entity: EntityId): INetworkEntityState | null {
    return this.prediction.getPredictedState(entity);
  }

  /**
   * Apply state from server.
   */
  applyServerState(snapshot: IStateSnapshot): void {
    // Update tick
    this.currentTick = snapshot.tick;
    this.stateSync.setCurrentTick(snapshot.tick);

    // Apply to state sync
    this.stateSync.applySnapshot(snapshot);

    // Reconcile local player prediction
    if (this._localPlayer) {
      const localEntity = this.matchHandler.getPlayerEntity(this._localPlayer.id);
      if (localEntity !== null) {
        const localState = snapshot.entities.find((e) => e.entity === localEntity);
        if (localState) {
          this.prediction.reconcile(snapshot.tick, localState);
        }
      }
    }

    // Add snapshots for interpolation (remote entities only)
    for (const entityState of snapshot.entities) {
      const localEntity = this._localPlayer
        ? this.matchHandler.getPlayerEntity(this._localPlayer.id)
        : null;

      // Skip local player (use prediction instead)
      if (localEntity !== null && entityState.entity === localEntity) {
        continue;
      }

      this.interpolation.addSnapshot(entityState.entity, entityState, snapshot.timestamp);
    }
  }

  /**
   * Get interpolated state for remote entity.
   */
  getInterpolatedState(entity: EntityId, renderTime: number): INetworkEntityState | null {
    return this.interpolation.getState(entity, renderTime);
  }

  // =============================================
  // Network Tick
  // =============================================

  /**
   * Update network state (call every frame).
   */
  update(dt: number): void {
    if (this.matchHandler.gameState !== GameNetState.Playing) {
      return;
    }

    // Accumulate time
    this.tickAccumulator += dt * 1000; // Convert to ms

    const tickDuration = 1000 / NETWORK_TICK_RATE;

    // Process ticks
    while (this.tickAccumulator >= tickDuration) {
      this.tickAccumulator -= tickDuration;
      this.networkTick();
    }

    // Clean up old interpolation data
    const now = performance.now();
    this.interpolation.clearOld(now - INTERPOLATION_DELAY * 3);
  }

  /**
   * Process one network tick.
   */
  private networkTick(): void {
    this.currentTick++;
    this.stateSync.tick();
    this.prediction.setCurrentTick(this.currentTick);

    // Authority sends state updates
    if (this._isAuthority) {
      this.sendStateUpdate();
    }
  }

  /**
   * Send state update to clients (authority only).
   */
  private sendStateUpdate(): void {
    if (this.stateSync.shouldSendSnapshot()) {
      // Send full snapshot
      const snapshot = this.stateSync.createSnapshot(
        this.matchState?.waveNumber ?? 0,
        [] // XP orbs would come from game state
      );

      const data = this.stateSync.serializeSnapshot(snapshot);
      this.client.sendMatchData(NetMessageType.StateSnapshot, data);
    } else {
      // Send delta
      const delta = this.stateSync.createDelta();
      if (delta) {
        const data = this.stateSync.serializeDelta(delta);
        this.client.sendMatchData(NetMessageType.StateDelta, data);
      }
    }
  }

  // =============================================
  // Entity Management
  // =============================================

  /**
   * Register an entity for network synchronization.
   */
  registerEntity(entity: EntityId, priority: SyncPriority = SyncPriority.Medium): void {
    this.stateSync.registerEntity(entity, priority);
  }

  /**
   * Unregister an entity from network synchronization.
   */
  unregisterEntity(entity: EntityId): void {
    this.stateSync.unregisterEntity(entity);
    this.interpolation.removeEntity(entity);
    this.prediction.removeEntity(entity);
  }

  /**
   * Update entity state (for sending).
   */
  updateEntityState(entity: EntityId, state: INetworkEntityState): void {
    this.stateSync.updateEntityState(entity, state);
  }

  /**
   * Set local player entity for prediction.
   */
  setLocalEntity(entity: EntityId, moveSpeed?: number): void {
    if (this._localPlayer) {
      this.matchHandler.setPlayerEntity(this._localPlayer.id, entity);
      this.prediction.setLocalEntity(entity, { x: 0, y: 0, moveSpeed });

      // Register with high priority
      this.stateSync.registerEntity(entity, SyncPriority.Critical);
    }
  }

  /**
   * Set entity priority.
   */
  setEntityPriority(entity: EntityId, priority: SyncPriority): void {
    this.stateSync.setEntityPriority(entity, priority);
  }

  // =============================================
  // Match Handler Delegation
  // =============================================

  /**
   * Set match callbacks.
   */
  setMatchCallbacks(callbacks: IMatchCallbacks): void {
    this.matchHandler.setCallbacks(callbacks);
  }

  /**
   * Set player ready state.
   */
  setReady(ready: boolean, characterId?: number): void {
    this.matchHandler.setReady(ready, characterId);
  }

  /**
   * Get all players in match.
   */
  getPlayers(): INetworkPlayer[] {
    return this.matchHandler.getPlayers();
  }

  /**
   * Get specific player.
   */
  getPlayer(playerId: string): INetworkPlayer | null {
    return this.matchHandler.getPlayer(playerId);
  }

  /**
   * Is current player the host?
   */
  get isHost(): boolean {
    return this.matchHandler.isHost;
  }

  /**
   * Get current game state.
   */
  get gameState(): GameNetState {
    return this.matchHandler.gameState;
  }

  /**
   * End the match (host only).
   */
  endMatch(reason: number, stats: { duration: number; totalKills: number; totalXP: number; waveReached: number }): void {
    this.matchHandler.endMatch(reason, stats);
  }

  // =============================================
  // Statistics
  // =============================================

  /**
   * Get current network tick.
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Get render time for interpolation.
   */
  getRenderTime(): number {
    return performance.now() - INTERPOLATION_DELAY;
  }

  /**
   * Get network statistics.
   */
  getStats(): {
    connectionState: ConnectionState;
    latency: number;
    tick: number;
    playerCount: number;
    stateSync: ReturnType<StateSync['getStats']>;
    prediction: ReturnType<Prediction['getStats']>;
    interpolation: ReturnType<Interpolation['getStats']>;
  } {
    return {
      connectionState: this._state,
      latency: this.latency,
      tick: this.currentTick,
      playerCount: this.matchHandler.playerCount,
      stateSync: this.stateSync.getStats(),
      prediction: this.prediction.getStats(),
      interpolation: this.interpolation.getStats(),
    };
  }

  // =============================================
  // Private Methods
  // =============================================

  /**
   * Set up client callbacks.
   */
  private setupClientCallbacks(): void {
    this.client.setCallbacks({
      onConnect: () => {
        console.log('NetworkManager: Socket connected');
      },
      onDisconnect: (error) => {
        console.log('NetworkManager: Socket disconnected', error);
        this._state = ConnectionState.Disconnected;
      },
      onError: (error) => {
        console.error('NetworkManager: Socket error', error);
        this._state = ConnectionState.Error;
      },
    });
  }

  /**
   * Set up message handlers.
   */
  private setupMessageHandlers(): void {
    // Handle state snapshots
    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.StateSnapshot, (data, sender) => {
        const snapshot = this.stateSync.deserializeSnapshot(data);
        this.applyServerState(snapshot);

        // Notify registered handlers
        this.notifyHandlers(NetMessageType.StateSnapshot, snapshot, sender.user_id);
      })
    );

    // Handle state deltas
    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.StateDelta, (data, sender) => {
        const delta = this.stateSync.deserializeDelta(data);
        this.stateSync.applyDelta(delta);

        // Add interpolation snapshots from delta
        for (const entityState of delta.added) {
          this.interpolation.addSnapshot(entityState.entity, entityState, delta.timestamp);
        }

        this.notifyHandlers(NetMessageType.StateDelta, delta, sender.user_id);
      })
    );

    // Handle player input (authority only)
    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.PlayerInput, (data, sender) => {
        if (!this._isAuthority) return;

        const input = NetworkMessages.decode(NetMessageType.PlayerInput, data);
        this.notifyHandlers(NetMessageType.PlayerInput, input, sender.user_id);
      })
    );

    // Handle player position updates
    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.PlayerPosition, (data, sender) => {
        const state = NetworkMessages.decode(NetMessageType.PlayerPosition, data);
        this.notifyHandlers(NetMessageType.PlayerPosition, state, sender.user_id);
      })
    );
  }

  /**
   * Notify registered handlers for a message type.
   */
  private notifyHandlers<T>(type: NetMessageType, data: T, sender: string): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data, sender);
        } catch (error) {
          console.error(`NetworkManager: Error in message handler for type ${type}:`, error);
        }
      });
    }
  }

  /**
   * Reset network state.
   */
  private resetNetworkState(): void {
    this.currentTick = 0;
    this.tickAccumulator = 0;

    this.stateSync.clear();
    this.prediction.clear();
    this.interpolation.clear();

    this.pendingInputs.clear();
  }

  /**
   * Clean up handlers.
   */
  private cleanup(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    this.messageHandlers.clear();
    this.matchHandler.cleanup();
    this.resetNetworkState();
  }

  /**
   * Destroy network manager.
   */
  destroy(): void {
    this.cleanup();
    this.matchHandler.destroy();
  }
}
