/**
 * Nakama Client wrapper for Cosmic Survivors.
 * Handles connection, authentication, and socket management.
 */

import { Client, Session, Socket, Match, MatchData, Presence } from '@heroiclabs/nakama-js';
import {
  AuthMethod,
  IAuthCredentials,
  ConnectionState,
  INetworkPlayer,
  NetMessageType,
} from '../shared/interfaces/INetworking';

/**
 * RPC response type.
 */
export interface IRPCResponse<T = unknown> {
  payload: T;
}

/**
 * Match presence event.
 */
export interface IMatchPresenceEvent {
  matchId: string;
  joins: Presence[];
  leaves: Presence[];
}

/**
 * Match data event.
 */
export interface IMatchDataEvent {
  matchId: string;
  opCode: number;
  data: Uint8Array;
  presence: Presence;
}

/**
 * Callback types for Nakama events.
 */
export interface INakamaCallbacks {
  onConnect?: () => void;
  onDisconnect?: (error?: Error) => void;
  onError?: (error: Error) => void;
  onMatchData?: (event: IMatchDataEvent) => void;
  onMatchPresence?: (event: IMatchPresenceEvent) => void;
}

/**
 * NakamaClient - Wrapper around Nakama JS SDK.
 */
export class NakamaClient {
  private client: Client | null = null;
  private session: Session | null = null;
  private socket: Socket | null = null;
  private currentMatch: Match | null = null;

  private _state: ConnectionState = ConnectionState.Disconnected;
  private useSSL: boolean = false;

  private callbacks: INakamaCallbacks = {};
  private messageHandlers: Map<number, Set<(data: Uint8Array, sender: Presence) => void>> = new Map();

  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastPingTime: number = 0;
  private _latency: number = 0;

  /**
   * Current connection state.
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Current latency in ms.
   */
  get latency(): number {
    return this._latency;
  }

  /**
   * Current session.
   */
  get currentSession(): Session | null {
    return this.session;
  }

  /**
   * Current match ID.
   */
  get matchId(): string | null {
    return this.currentMatch?.match_id ?? null;
  }

  /**
   * Whether socket is connected.
   */
  get isConnected(): boolean {
    return this._state === ConnectionState.Connected && this.socket !== null;
  }

  /**
   * Set callbacks for Nakama events.
   */
  setCallbacks(callbacks: INakamaCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Connect to Nakama server.
   * @param serverUrl Server URL (e.g., "localhost:7350")
   * @param serverKey Server key (default: "defaultkey")
   * @param useSSL Whether to use SSL
   */
  async connect(serverUrl: string, serverKey: string = 'defaultkey', useSSL: boolean = false): Promise<void> {
    if (this._state === ConnectionState.Connected) {
      console.warn('NakamaClient: Already connected');
      return;
    }

    this._state = ConnectionState.Connecting;
    this.useSSL = useSSL;

    try {
      // Parse server URL
      const [host, portStr] = serverUrl.split(':');
      const port = portStr ? parseInt(portStr, 10) : (useSSL ? 443 : 7350);

      // Create Nakama client
      this.client = new Client(serverKey, host, String(port), useSSL);

      console.log(`NakamaClient: Client created for ${host}:${port}`);
    } catch (error) {
      this._state = ConnectionState.Error;
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Disconnect from server.
   */
  async disconnect(): Promise<void> {
    this.stopPing();

    if (this.currentMatch) {
      try {
        await this.leaveMatch();
      } catch (error) {
        console.warn('NakamaClient: Error leaving match during disconnect:', error);
      }
    }

    if (this.socket) {
      this.socket.disconnect(true);
      this.socket = null;
    }

    this.session = null;
    this.client = null;
    this._state = ConnectionState.Disconnected;
    this.callbacks.onDisconnect?.();
  }

  /**
   * Authenticate with server.
   */
  async authenticate(method: AuthMethod, credentials: IAuthCredentials): Promise<INetworkPlayer> {
    if (!this.client) {
      throw new Error('NakamaClient: Not connected. Call connect() first.');
    }

    try {
      // Authenticate based on method
      switch (method) {
        case AuthMethod.Device:
          this.session = await this.client.authenticateDevice(
            credentials.deviceId ?? this.generateDeviceId(),
            true,
            credentials.displayName
          );
          break;

        case AuthMethod.Email:
          if (!credentials.email || !credentials.password) {
            throw new Error('Email and password required for email authentication');
          }
          this.session = await this.client.authenticateEmail(
            credentials.email,
            credentials.password,
            true,
            credentials.displayName
          );
          break;

        case AuthMethod.Guest:
          this.session = await this.client.authenticateDevice(
            this.generateDeviceId(),
            true,
            credentials.displayName ?? `Guest_${Math.random().toString(36).substring(2, 8)}`
          );
          break;

        case AuthMethod.Google:
          if (!credentials.token) {
            throw new Error('Token required for Google authentication');
          }
          this.session = await this.client.authenticateGoogle(
            credentials.token,
            true,
            credentials.displayName
          );
          break;

        case AuthMethod.Steam:
          if (!credentials.token) {
            throw new Error('Token required for Steam authentication');
          }
          this.session = await this.client.authenticateSteam(
            credentials.token,
            true,
            credentials.displayName
          );
          break;

        default:
          throw new Error(`Unknown authentication method: ${method}`);
      }

      // Connect socket after authentication
      await this.connectSocket();

      this._state = ConnectionState.Connected;
      this.callbacks.onConnect?.();

      // Start ping for latency measurement
      this.startPing();

      return {
        id: this.session.user_id!,
        displayName: credentials.displayName ?? this.session.username ?? 'Player',
        entity: 0, // Will be set by NetworkManager
        isLocal: true,
        isHost: false,
        latency: 0,
      };
    } catch (error) {
      this._state = ConnectionState.Error;
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Connect WebSocket for realtime communication.
   */
  private async connectSocket(): Promise<void> {
    if (!this.client || !this.session) {
      throw new Error('NakamaClient: Cannot connect socket without client and session');
    }

    this.socket = this.client.createSocket(this.useSSL, false);

    // Setup socket event handlers
    this.socket.ondisconnect = (evt) => {
      console.log('NakamaClient: Socket disconnected', evt);
      this._state = ConnectionState.Disconnected;
      this.callbacks.onDisconnect?.(new Error('Socket disconnected'));
    };

    this.socket.onerror = (evt) => {
      console.error('NakamaClient: Socket error', evt);
      this.callbacks.onError?.(new Error('Socket error'));
    };

    this.socket.onmatchdata = (matchData: MatchData) => {
      this.handleMatchData(matchData);
    };

    this.socket.onmatchpresence = (presence) => {
      this.callbacks.onMatchPresence?.({
        matchId: presence.match_id,
        joins: presence.joins ?? [],
        leaves: presence.leaves ?? [],
      });
    };

    // Connect socket
    await this.socket.connect(this.session, true);
    console.log('NakamaClient: Socket connected');
  }

  /**
   * Create a new match.
   */
  async createMatch(): Promise<string> {
    if (!this.socket) {
      throw new Error('NakamaClient: Socket not connected');
    }

    this.currentMatch = await this.socket.createMatch();
    console.log(`NakamaClient: Created match ${this.currentMatch.match_id}`);
    return this.currentMatch.match_id;
  }

  /**
   * Join an existing match.
   */
  async joinMatch(matchId: string): Promise<Match> {
    if (!this.socket) {
      throw new Error('NakamaClient: Socket not connected');
    }

    this.currentMatch = await this.socket.joinMatch(matchId);
    console.log(`NakamaClient: Joined match ${matchId}`);
    return this.currentMatch;
  }

  /**
   * Leave current match.
   */
  async leaveMatch(): Promise<void> {
    if (!this.socket || !this.currentMatch) {
      return;
    }

    await this.socket.leaveMatch(this.currentMatch.match_id);
    console.log(`NakamaClient: Left match ${this.currentMatch.match_id}`);
    this.currentMatch = null;
  }

  /**
   * Send match data (unreliable).
   */
  sendMatchData(opCode: NetMessageType, data: Uint8Array): void {
    if (!this.socket || !this.currentMatch) {
      console.warn('NakamaClient: Cannot send match data - not in a match');
      return;
    }

    this.socket.sendMatchState(this.currentMatch.match_id, opCode, data);
  }

  /**
   * Send match data reliably (with acknowledgment).
   * Note: Nakama's sendMatchState is already reliable over WebSocket.
   */
  sendMatchDataReliable(opCode: NetMessageType, data: Uint8Array): void {
    // WebSocket is already reliable, but we can add sequence numbers for ordering
    this.sendMatchData(opCode, data);
  }

  /**
   * Register a message handler for a specific opcode.
   */
  onMatchData(opCode: number, handler: (data: Uint8Array, sender: Presence) => void): () => void {
    if (!this.messageHandlers.has(opCode)) {
      this.messageHandlers.set(opCode, new Set());
    }
    this.messageHandlers.get(opCode)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(opCode)?.delete(handler);
    };
  }

  /**
   * Call RPC on server.
   */
  async rpc<T = unknown>(id: string, payload?: Record<string, unknown>): Promise<IRPCResponse<T>> {
    if (!this.client || !this.session) {
      throw new Error('NakamaClient: Not authenticated');
    }

    // Note: Nakama JS SDK's rpc() signature varies by version.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcFn = this.client.rpc as any;
    const response = await rpcFn(
      this.session,
      id,
      payload ? JSON.stringify(payload) : undefined
    );
    return {
      payload: response.payload ? JSON.parse(response.payload) : null,
    };
  }

  /**
   * Get current match presences.
   */
  getMatchPresences(): Presence[] {
    return this.currentMatch?.presences ?? [];
  }

  /**
   * Get self presence.
   */
  getSelfPresence(): Presence | null {
    return this.currentMatch?.self ?? null;
  }

  /**
   * Handle incoming match data.
   */
  private handleMatchData(matchData: MatchData): void {
    const opCode = matchData.op_code;
    const data = matchData.data;
    const sender = matchData.presence;

    if (!sender) {
      console.warn('NakamaClient: Received match data without sender');
      return;
    }

    // Notify registered handlers
    const handlers = this.messageHandlers.get(opCode);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data, sender);
        } catch (error) {
          console.error(`NakamaClient: Error in message handler for opcode ${opCode}:`, error);
        }
      });
    }

    // Also notify global callback
    this.callbacks.onMatchData?.({
      matchId: matchData.match_id,
      opCode,
      data,
      presence: sender,
    });
  }

  /**
   * Generate a unique device ID.
   */
  private generateDeviceId(): string {
    // Try to get from localStorage first
    const storageKey = 'cosmic_survivors_device_id';
    let deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;

    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, deviceId);
      }
    }

    return deviceId;
  }

  /**
   * Start ping interval for latency measurement.
   */
  private startPing(): void {
    this.stopPing();

    // Ping every 5 seconds
    this.pingInterval = setInterval(() => {
      this.measureLatency();
    }, 5000);

    // Initial ping
    this.measureLatency();
  }

  /**
   * Stop ping interval.
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Measure latency using a simple ping.
   */
  private async measureLatency(): Promise<void> {
    if (!this.socket || !this.currentMatch) {
      return;
    }

    this.lastPingTime = performance.now();

    // We'll use a custom ping message
    // In a real implementation, you might use RPC or a dedicated ping mechanism
    // For now, we'll estimate based on last message round-trip
  }

  /**
   * Update latency measurement (called when receiving server response).
   */
  updateLatency(_serverTime: number): void {
    const now = performance.now();
    if (this.lastPingTime > 0) {
      this._latency = (now - this.lastPingTime) / 2; // One-way latency estimate
      this.lastPingTime = 0;
    }
  }

  /**
   * Refresh session if expired.
   */
  async refreshSession(): Promise<void> {
    if (!this.client || !this.session) {
      return;
    }

    // Check if session is about to expire (within 5 minutes)
    const expiresAt = this.session.expires_at;
    if (expiresAt) {
      const expiresAtMs = expiresAt * 1000;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiresAtMs - now < fiveMinutes) {
        try {
          this.session = await this.client.sessionRefresh(this.session);
          console.log('NakamaClient: Session refreshed');
        } catch (error) {
          console.error('NakamaClient: Failed to refresh session:', error);
          // Re-authenticate might be needed
          this._state = ConnectionState.Error;
        }
      }
    }
  }
}
