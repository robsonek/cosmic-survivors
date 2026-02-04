/**
 * Match Handler for Cosmic Survivors.
 * Manages match lifecycle, lobby state, and player coordination.
 */

import { Presence } from '@heroiclabs/nakama-js';
import {
  GameNetState,
  INetworkPlayer,
  IMatchState,
  NetMessageType,
} from '../shared/interfaces/INetworking';
import type { EntityId } from '../shared/interfaces/IWorld';
import { NakamaClient, IMatchPresenceEvent, IMatchDataEvent } from './NakamaClient';
import { NetworkMessages, IPlayerReadyMessage, IStartMatchMessage, IEndMatchMessage } from './NetworkMessages';

/**
 * Player ready state.
 */
interface IPlayerReadyState {
  playerId: string;
  displayName: string;
  ready: boolean;
  characterId: number;
  joinedAt: number;
}

/**
 * Match configuration.
 */
export interface IMatchConfig {
  maxPlayers: number;
  minPlayers: number;
  countdownDuration: number;
  autoStart: boolean;
  hostMigration: boolean;
}

/**
 * Match event callbacks.
 */
export interface IMatchCallbacks {
  onPlayerJoined?: (player: INetworkPlayer) => void;
  onPlayerLeft?: (playerId: string, reason: string) => void;
  onPlayerReady?: (playerId: string, ready: boolean) => void;
  onMatchStart?: (matchId: string, seed: number) => void;
  onMatchEnd?: (reason: number, stats: IEndMatchMessage['stats']) => void;
  onHostChanged?: (newHostId: string) => void;
  onCountdownStart?: (seconds: number) => void;
  onCountdownCancel?: () => void;
  onGameStateChanged?: (state: GameNetState) => void;
}

/**
 * MatchHandler - Match lifecycle and coordination.
 */
export class MatchHandler {
  private client: NakamaClient;
  private config: IMatchConfig;
  private callbacks: IMatchCallbacks = {};

  private players: Map<string, IPlayerReadyState> = new Map();
  private playerEntities: Map<string, EntityId> = new Map();
  private hostId: string | null = null;
  private localPlayerId: string | null = null;

  private _matchId: string | null = null;
  private _gameState: GameNetState = GameNetState.Lobby;
  private _matchSeed: number = 0;
  private _startTime: number = 0;

  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownRemaining: number = 0;

  // Unsubscribe functions
  private unsubscribers: Array<() => void> = [];

  constructor(client: NakamaClient, config: Partial<IMatchConfig> = {}) {
    this.client = client;
    this.config = {
      maxPlayers: 4,
      minPlayers: 1,
      countdownDuration: 5,
      autoStart: false,
      hostMigration: true,
      ...config,
    };
  }

  /**
   * Get current match ID.
   */
  get matchId(): string | null {
    return this._matchId;
  }

  /**
   * Get current game state.
   */
  get gameState(): GameNetState {
    return this._gameState;
  }

  /**
   * Get match seed for procedural generation.
   */
  get matchSeed(): number {
    return this._matchSeed;
  }

  /**
   * Get match start time.
   */
  get startTime(): number {
    return this._startTime;
  }

  /**
   * Is current player the host?
   */
  get isHost(): boolean {
    return this.localPlayerId !== null && this.localPlayerId === this.hostId;
  }

  /**
   * Get current host ID.
   */
  get currentHostId(): string | null {
    return this.hostId;
  }

  /**
   * Get player count.
   */
  get playerCount(): number {
    return this.players.size;
  }

  /**
   * Set callbacks for match events.
   */
  setCallbacks(callbacks: IMatchCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Initialize match handler with local player.
   */
  initialize(localPlayerId: string): void {
    this.localPlayerId = localPlayerId;
    this.setupMessageHandlers();
  }

  /**
   * Set up message handlers for match communication.
   */
  private setupMessageHandlers(): void {
    // Clean up previous handlers
    this.cleanup();

    // Handle presence events
    this.client.setCallbacks({
      onMatchPresence: (event) => this.handlePresence(event),
      onMatchData: (event) => this.handleMatchData(event),
    });

    // Register specific message handlers
    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.PlayerReady, (data, sender) => {
        this.handlePlayerReady(data, sender);
      })
    );

    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.StartMatch, (data, sender) => {
        this.handleStartMatch(data, sender);
      })
    );

    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.EndMatch, (data, sender) => {
        this.handleEndMatch(data, sender);
      })
    );

    this.unsubscribers.push(
      this.client.onMatchData(NetMessageType.PauseMatch, (data, sender) => {
        this.handlePauseMatch(data, sender);
      })
    );
  }

  /**
   * Create and join a new match.
   */
  async createMatch(): Promise<string> {
    this._matchId = await this.client.createMatch();
    this._gameState = GameNetState.Lobby;
    this._matchSeed = Math.floor(Math.random() * 2147483647);

    // Creator is automatically the host
    this.hostId = this.localPlayerId;

    // Add self to players
    if (this.localPlayerId) {
      this.players.set(this.localPlayerId, {
        playerId: this.localPlayerId,
        displayName: 'Host',
        ready: false,
        characterId: 0,
        joinedAt: Date.now(),
      });
    }

    this.callbacks.onGameStateChanged?.(this._gameState);
    return this._matchId;
  }

  /**
   * Join an existing match.
   */
  async joinMatch(matchId: string): Promise<void> {
    const match = await this.client.joinMatch(matchId);
    this._matchId = matchId;
    this._gameState = GameNetState.Lobby;

    // Process existing presences
    for (const presence of match.presences ?? []) {
      this.addPlayer(presence);
    }

    // Determine host (first player by default)
    if (match.presences && match.presences.length > 0) {
      this.hostId = match.presences[0].user_id;
    }

    // Add self
    if (this.localPlayerId && !this.players.has(this.localPlayerId)) {
      this.players.set(this.localPlayerId, {
        playerId: this.localPlayerId,
        displayName: 'Player',
        ready: false,
        characterId: 0,
        joinedAt: Date.now(),
      });
    }

    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * Leave current match.
   */
  async leaveMatch(): Promise<void> {
    this.cancelCountdown();
    await this.client.leaveMatch();

    this._matchId = null;
    this._gameState = GameNetState.Lobby;
    this.players.clear();
    this.playerEntities.clear();
    this.hostId = null;
  }

  /**
   * Set local player's ready state.
   */
  setReady(ready: boolean, characterId: number = 0): void {
    if (!this.localPlayerId) return;

    const playerState = this.players.get(this.localPlayerId);
    if (playerState) {
      playerState.ready = ready;
      playerState.characterId = characterId;
    }

    // Send ready message
    const message: IPlayerReadyMessage = {
      playerId: this.localPlayerId,
      ready,
      characterId,
    };

    const data = NetworkMessages.encode(NetMessageType.PlayerReady, message);
    this.client.sendMatchData(NetMessageType.PlayerReady, data);

    // Check if all players are ready (host only)
    if (this.isHost && this.config.autoStart) {
      this.checkAutoStart();
    }
  }

  /**
   * Start the match (host only).
   */
  async startMatch(): Promise<void> {
    if (!this.isHost) {
      console.warn('MatchHandler: Only host can start match');
      return;
    }

    if (this.playerCount < this.config.minPlayers) {
      console.warn(`MatchHandler: Not enough players (${this.playerCount}/${this.config.minPlayers})`);
      return;
    }

    // Start countdown
    this.startCountdown();
  }

  /**
   * Force start the match immediately (host only).
   */
  forceStart(): void {
    if (!this.isHost) return;

    this.cancelCountdown();
    this.sendStartMatch();
  }

  /**
   * Start countdown before match starts.
   */
  private startCountdown(): void {
    this.cancelCountdown();

    this._gameState = GameNetState.Starting;
    this.countdownRemaining = this.config.countdownDuration;
    this.callbacks.onGameStateChanged?.(this._gameState);
    this.callbacks.onCountdownStart?.(this.countdownRemaining);

    const tick = () => {
      this.countdownRemaining--;

      if (this.countdownRemaining <= 0) {
        this.sendStartMatch();
      } else {
        this.countdownTimer = setTimeout(tick, 1000);
      }
    };

    this.countdownTimer = setTimeout(tick, 1000);
  }

  /**
   * Cancel countdown.
   */
  cancelCountdown(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }

    if (this._gameState === GameNetState.Starting) {
      this._gameState = GameNetState.Lobby;
      this.callbacks.onCountdownCancel?.();
      this.callbacks.onGameStateChanged?.(this._gameState);
    }
  }

  /**
   * Send match start message.
   */
  private sendStartMatch(): void {
    this._gameState = GameNetState.Playing;
    this._startTime = Date.now();

    const message: IStartMatchMessage = {
      matchId: this._matchId!,
      seed: this._matchSeed,
      tick: 0,
    };

    const data = NetworkMessages.encode(NetMessageType.StartMatch, message);
    this.client.sendMatchDataReliable(NetMessageType.StartMatch, data);

    this.callbacks.onMatchStart?.(this._matchId!, this._matchSeed);
    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * End the match.
   */
  endMatch(reason: number, stats: IEndMatchMessage['stats']): void {
    if (!this.isHost) return;

    this._gameState = GameNetState.GameOver;

    const message: IEndMatchMessage = {
      reason,
      stats,
    };

    const data = NetworkMessages.encode(NetMessageType.EndMatch, message);
    this.client.sendMatchDataReliable(NetMessageType.EndMatch, data);

    this.callbacks.onMatchEnd?.(reason, stats);
    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * Pause/unpause the match.
   */
  setPaused(paused: boolean, tick: number): void {
    if (!this.isHost) return;

    this._gameState = paused ? GameNetState.Paused : GameNetState.Playing;

    const message = { paused, tick };
    const data = NetworkMessages.encode(NetMessageType.PauseMatch, message);
    this.client.sendMatchData(NetMessageType.PauseMatch, data);

    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * Handle presence events (joins/leaves).
   */
  private handlePresence(event: IMatchPresenceEvent): void {
    // Handle joins
    for (const presence of event.joins) {
      this.addPlayer(presence);
    }

    // Handle leaves
    for (const presence of event.leaves) {
      this.removePlayer(presence.user_id, 'left');
    }
  }

  /**
   * Add a player to the match.
   */
  private addPlayer(presence: Presence): void {
    if (this.players.has(presence.user_id)) return;

    const playerState: IPlayerReadyState = {
      playerId: presence.user_id,
      displayName: presence.username ?? `Player_${presence.user_id.substring(0, 6)}`,
      ready: false,
      characterId: 0,
      joinedAt: Date.now(),
    };

    this.players.set(presence.user_id, playerState);

    const networkPlayer = this.createNetworkPlayer(presence.user_id);
    this.callbacks.onPlayerJoined?.(networkPlayer);

    // If this is the first player, they become host
    if (this.players.size === 1 && !this.hostId) {
      this.hostId = presence.user_id;
    }
  }

  /**
   * Remove a player from the match.
   */
  private removePlayer(playerId: string, reason: string): void {
    this.players.delete(playerId);
    this.playerEntities.delete(playerId);

    this.callbacks.onPlayerLeft?.(playerId, reason);

    // Handle host migration
    if (playerId === this.hostId && this.config.hostMigration) {
      this.migrateHost();
    }

    // Cancel countdown if not enough players
    if (this.playerCount < this.config.minPlayers) {
      this.cancelCountdown();
    }
  }

  /**
   * Migrate host to next player.
   */
  private migrateHost(): void {
    // Find the player who joined earliest
    let earliestPlayer: IPlayerReadyState | null = null;

    for (const player of this.players.values()) {
      if (!earliestPlayer || player.joinedAt < earliestPlayer.joinedAt) {
        earliestPlayer = player;
      }
    }

    if (earliestPlayer) {
      this.hostId = earliestPlayer.playerId;
      this.callbacks.onHostChanged?.(this.hostId);
    } else {
      this.hostId = null;
    }
  }

  /**
   * Handle player ready message.
   */
  private handlePlayerReady(data: Uint8Array, _sender: Presence): void {
    const message = NetworkMessages.decode<IPlayerReadyMessage>(
      NetMessageType.PlayerReady,
      data
    );

    const playerState = this.players.get(message.playerId);
    if (playerState) {
      playerState.ready = message.ready;
      playerState.characterId = message.characterId;

      this.callbacks.onPlayerReady?.(message.playerId, message.ready);

      // Check auto-start
      if (this.isHost && this.config.autoStart) {
        this.checkAutoStart();
      }
    }
  }

  /**
   * Handle start match message.
   */
  private handleStartMatch(data: Uint8Array, _sender: Presence): void {
    const message = NetworkMessages.decode<IStartMatchMessage>(
      NetMessageType.StartMatch,
      data
    );

    this._matchSeed = message.seed;
    this._gameState = GameNetState.Playing;
    this._startTime = Date.now();

    this.callbacks.onMatchStart?.(message.matchId, message.seed);
    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * Handle end match message.
   */
  private handleEndMatch(data: Uint8Array, _sender: Presence): void {
    const message = NetworkMessages.decode<IEndMatchMessage>(
      NetMessageType.EndMatch,
      data
    );

    this._gameState = GameNetState.GameOver;

    this.callbacks.onMatchEnd?.(message.reason, message.stats);
    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * Handle pause match message.
   */
  private handlePauseMatch(data: Uint8Array, _sender: Presence): void {
    const message = NetworkMessages.decode<{ paused: boolean; tick: number }>(
      NetMessageType.PauseMatch,
      data
    );

    this._gameState = message.paused ? GameNetState.Paused : GameNetState.Playing;
    this.callbacks.onGameStateChanged?.(this._gameState);
  }

  /**
   * Handle generic match data.
   */
  private handleMatchData(_event: IMatchDataEvent): void {
    // This is called for all match data - specific handlers should be registered
    // via client.onMatchData for specific opcodes
  }

  /**
   * Check if all players are ready and start if autoStart is enabled.
   */
  private checkAutoStart(): void {
    if (this.playerCount < this.config.minPlayers) return;

    let allReady = true;
    for (const player of this.players.values()) {
      if (!player.ready) {
        allReady = false;
        break;
      }
    }

    if (allReady) {
      this.startMatch();
    }
  }

  /**
   * Create INetworkPlayer from player state.
   */
  private createNetworkPlayer(playerId: string): INetworkPlayer {
    const playerState = this.players.get(playerId);
    const entity = this.playerEntities.get(playerId) ?? 0;

    return {
      id: playerId,
      displayName: playerState?.displayName ?? 'Unknown',
      entity,
      isLocal: playerId === this.localPlayerId,
      isHost: playerId === this.hostId,
      latency: 0,
    };
  }

  /**
   * Get all players as INetworkPlayer array.
   */
  getPlayers(): INetworkPlayer[] {
    return Array.from(this.players.keys()).map((id) => this.createNetworkPlayer(id));
  }

  /**
   * Get player by ID.
   */
  getPlayer(playerId: string): INetworkPlayer | null {
    if (!this.players.has(playerId)) return null;
    return this.createNetworkPlayer(playerId);
  }

  /**
   * Set entity ID for a player.
   */
  setPlayerEntity(playerId: string, entity: EntityId): void {
    this.playerEntities.set(playerId, entity);
  }

  /**
   * Get entity ID for a player.
   */
  getPlayerEntity(playerId: string): EntityId | null {
    return this.playerEntities.get(playerId) ?? null;
  }

  /**
   * Check if all players are ready.
   */
  areAllPlayersReady(): boolean {
    for (const player of this.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  /**
   * Get ready player count.
   */
  getReadyPlayerCount(): number {
    let count = 0;
    for (const player of this.players.values()) {
      if (player.ready) count++;
    }
    return count;
  }

  /**
   * Create match state object.
   */
  getMatchState(): IMatchState | null {
    if (!this._matchId) return null;

    return {
      matchId: this._matchId,
      tick: 0, // Will be updated by NetworkManager
      players: this.getPlayers(),
      gameState: this._gameState,
      waveNumber: 0, // Will be updated by game
      timeElapsed: this._startTime > 0 ? Date.now() - this._startTime : 0,
    };
  }

  /**
   * Clean up handlers.
   */
  cleanup(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    this.cancelCountdown();
  }

  /**
   * Destroy match handler.
   */
  destroy(): void {
    this.cleanup();
    this.players.clear();
    this.playerEntities.clear();
  }
}
