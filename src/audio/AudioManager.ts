/**
 * AudioManager - Central audio management system.
 *
 * Features:
 * - Master, music, and SFX volume control
 * - Mute functionality
 * - SFX playback with spatial audio
 * - Music playback with crossfading
 * - Channel-based volume control
 * - Lifecycle management (init, suspend, resume, destroy)
 */

import type {
  IAudioManager,
  ISoundConfig,
  IMusicConfig,
  ISoundInstance,
  AudioChannel,
} from '@shared/interfaces/IAudio';
import { SFXPlayer } from './SFXPlayer';
import { MusicPlayer } from './MusicPlayer';
import { SFXKeys } from './SFXDefinitions';
import { getAllMusicKeys } from './MusicTracks';

/**
 * AudioManager configuration.
 */
export interface AudioManagerConfig {
  sfxBasePath?: string;
  musicBasePath?: string;
  autoRegisterAssets?: boolean;
}

/**
 * Channel volume state.
 */
interface ChannelState {
  volume: number;
  muted: boolean;
}

/**
 * AudioManager implementation.
 */
export class AudioManager implements IAudioManager {
  /** SFX player instance */
  private sfxPlayer: SFXPlayer;

  /** Music player instance */
  private musicPlayer: MusicPlayer;

  /** Master volume (0-1) */
  private _masterVolume = 1.0;

  /** Music volume (0-1) */
  private _musicVolume = 1.0;

  /** SFX volume (0-1) */
  private _sfxVolume = 1.0;

  /** Global muted state */
  private _muted = false;

  /** Channel states */
  private channels: Map<AudioChannel, ChannelState> = new Map();

  /** Listener position (stored for getStats/debugging) */
  // @ts-expect-error - stored for potential future use
  private _listenerX = 0;
  // @ts-expect-error - stored for potential future use
  private _listenerY = 0;

  /** Initialized state */
  private initialized = false;

  /** Suspended state */
  private suspended = false;

  /** Configuration */
  private config: AudioManagerConfig;

  constructor(config: AudioManagerConfig = {}) {
    this.config = {
      sfxBasePath: config.sfxBasePath ?? '/assets/audio/sfx/',
      musicBasePath: config.musicBasePath ?? '/assets/audio/music/',
      autoRegisterAssets: config.autoRegisterAssets ?? true,
    };

    // Initialize players
    this.sfxPlayer = new SFXPlayer({
      assetBasePath: this.config.sfxBasePath,
    });

    this.musicPlayer = new MusicPlayer({
      assetBasePath: this.config.musicBasePath,
    });

    // Initialize channel states
    this.initializeChannels();
  }

  // ============================================
  // Volume Properties
  // ============================================

  get masterVolume(): number {
    return this._masterVolume;
  }

  set masterVolume(value: number) {
    this._masterVolume = Math.max(0, Math.min(1, value));
    this.updatePlayerVolumes();
  }

  get musicVolume(): number {
    return this._musicVolume;
  }

  set musicVolume(value: number) {
    this._musicVolume = Math.max(0, Math.min(1, value));
    this.musicPlayer.setMusicVolume(this.getEffectiveVolume('music' as AudioChannel));
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  set sfxVolume(value: number) {
    this._sfxVolume = Math.max(0, Math.min(1, value));
    this.sfxPlayer.setSFXVolume(this.getEffectiveVolume('sfx' as AudioChannel));
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    this.sfxPlayer.setMuted(value);
    this.musicPlayer.setMuted(value);
  }

  // ============================================
  // SFX Methods
  // ============================================

  /**
   * Play a sound effect.
   */
  playSFX(config: ISoundConfig): ISoundInstance {
    if (this.suspended || this._muted) {
      return this.createNullInstance(config.key);
    }

    // Apply channel volume
    const channel = config.channel ?? ('sfx' as AudioChannel);
    const channelVolume = this.getChannelVolume(channel);
    const adjustedConfig = {
      ...config,
      volume: (config.volume ?? 1.0) * channelVolume,
    };

    const instance = this.sfxPlayer.play(adjustedConfig);
    return instance ?? this.createNullInstance(config.key);
  }

  /**
   * Play SFX at position (spatial audio).
   */
  playSFXAt(key: string, x: number, y: number, volume?: number): ISoundInstance {
    return this.playSFX({
      key,
      x,
      y,
      volume,
      spatial: true,
    });
  }

  /**
   * Stop a specific sound.
   */
  stopSFX(id: string): void {
    this.sfxPlayer.stop(id);
  }

  /**
   * Stop all SFX.
   */
  stopAllSFX(): void {
    this.sfxPlayer.stopAll();
  }

  // ============================================
  // Music Methods
  // ============================================

  /**
   * Get current playing music key.
   */
  get currentMusic(): string | null {
    return this.musicPlayer.currentMusic;
  }

  /**
   * Play music track.
   */
  playMusic(config: IMusicConfig): ISoundInstance {
    if (this.suspended) {
      return this.createNullInstance(config.key);
    }

    // Apply music volume
    const musicChannel = 'music' as AudioChannel;
    const channelVolume = this.getChannelVolume(musicChannel);
    const adjustedConfig = {
      ...config,
      volume: (config.volume ?? 1.0) * channelVolume,
    };

    return this.musicPlayer.play(adjustedConfig);
  }

  /**
   * Stop current music.
   */
  async stopMusic(fadeOut?: number): Promise<void> {
    await this.musicPlayer.stop(fadeOut);
  }

  /**
   * Crossfade to new music.
   */
  async crossfade(config: IMusicConfig, duration: number): Promise<void> {
    if (this.suspended) return;

    const musicChannel = 'music' as AudioChannel;
    const channelVolume = this.getChannelVolume(musicChannel);
    const adjustedConfig = {
      ...config,
      volume: (config.volume ?? 1.0) * channelVolume,
    };

    await this.musicPlayer.crossfade(adjustedConfig, duration);
  }

  /**
   * Pause music.
   */
  pauseMusic(): void {
    this.musicPlayer.pause();
  }

  /**
   * Resume music.
   */
  resumeMusic(): void {
    if (!this.suspended) {
      this.musicPlayer.resume();
    }
  }

  // ============================================
  // Channel Control
  // ============================================

  /**
   * Set channel volume.
   */
  setChannelVolume(channel: AudioChannel, volume: number): void {
    const state = this.channels.get(channel);
    if (state) {
      state.volume = Math.max(0, Math.min(1, volume));
      this.updateChannelVolume(channel);
    }
  }

  /**
   * Get channel volume.
   */
  getChannelVolume(channel: AudioChannel): number {
    const state = this.channels.get(channel);
    if (!state || state.muted) return 0;
    return state.volume;
  }

  /**
   * Mute/unmute channel.
   */
  setChannelMuted(channel: AudioChannel, muted: boolean): void {
    const state = this.channels.get(channel);
    if (state) {
      state.muted = muted;
      this.updateChannelVolume(channel);
    }
  }

  // ============================================
  // Spatial Audio
  // ============================================

  /**
   * Set listener position for spatial audio.
   */
  setListenerPosition(x: number, y: number): void {
    this._listenerX = x;
    this._listenerY = y;
    this.sfxPlayer.setListenerPosition(x, y);
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Initialize audio system.
   * Must be called after user interaction on web.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Auto-register assets if enabled
    if (this.config.autoRegisterAssets) {
      this.registerDefaultAssets();
    }

    // Web Audio context typically needs user interaction
    // This is a good place to resume audio context if needed

    this.initialized = true;
    this.suspended = false;
  }

  /**
   * Suspend audio (when game loses focus).
   */
  suspend(): void {
    if (this.suspended) return;

    this.suspended = true;
    this.musicPlayer.pause();
    this.sfxPlayer.pauseAll();
  }

  /**
   * Resume audio (when game gains focus).
   */
  resume(): void {
    if (!this.suspended) return;

    this.suspended = false;
    this.musicPlayer.resume();
    this.sfxPlayer.resumeAll();
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.sfxPlayer.destroy();
    this.musicPlayer.destroy();
    this.channels.clear();
    this.initialized = false;
  }

  // ============================================
  // Asset Registration
  // ============================================

  /**
   * Register SFX asset.
   */
  registerSFX(key: string, url?: string): void {
    this.sfxPlayer.registerAsset(key, url);
  }

  /**
   * Register music asset.
   */
  registerMusic(key: string, url?: string): void {
    this.musicPlayer.registerAsset(key, url);
  }

  /**
   * Check if SFX asset is registered.
   */
  hasSFX(key: string): boolean {
    return this.sfxPlayer.hasAsset(key);
  }

  /**
   * Check if music asset is registered.
   */
  hasMusic(key: string): boolean {
    return this.musicPlayer.hasAsset(key);
  }

  // ============================================
  // BPM Sync
  // ============================================

  /**
   * Register beat callback for music sync.
   */
  onBeat(callback: (beat: number, measure: number) => void): () => void {
    return this.musicPlayer.onBeat(callback);
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get audio statistics.
   */
  getStats(): { activeSFX: number; currentMusic: string | null; suspended: boolean } {
    return {
      activeSFX: this.sfxPlayer.activeCount,
      currentMusic: this.musicPlayer.currentMusic,
      suspended: this.suspended,
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Initialize channel states.
   */
  private initializeChannels(): void {
    const channels: AudioChannel[] = [
      'master' as AudioChannel,
      'music' as AudioChannel,
      'sfx' as AudioChannel,
      'ui' as AudioChannel,
      'ambient' as AudioChannel,
    ];

    for (const channel of channels) {
      this.channels.set(channel, { volume: 1.0, muted: false });
    }
  }

  /**
   * Update volumes on players.
   */
  private updatePlayerVolumes(): void {
    this.sfxPlayer.setMasterVolume(this._masterVolume);
    this.musicPlayer.setMasterVolume(this._masterVolume);
  }

  /**
   * Update specific channel volume.
   */
  private updateChannelVolume(channel: AudioChannel): void {
    const channelStr = channel as string;

    if (channelStr === 'music') {
      this.musicPlayer.setMusicVolume(this.getEffectiveVolume(channel));
    } else if (channelStr === 'sfx' || channelStr === 'ui') {
      this.sfxPlayer.setSFXVolume(this.getEffectiveVolume('sfx' as AudioChannel));
    }
  }

  /**
   * Get effective volume for channel.
   */
  private getEffectiveVolume(channel: AudioChannel): number {
    const state = this.channels.get(channel);
    if (!state || state.muted || this._muted) return 0;

    const channelStr = channel as string;
    if (channelStr === 'music') {
      return state.volume * this._musicVolume;
    } else if (channelStr === 'sfx' || channelStr === 'ui') {
      return state.volume * this._sfxVolume;
    }
    return state.volume;
  }

  /**
   * Register default SFX and music assets.
   */
  private registerDefaultAssets(): void {
    // Register all SFX keys
    for (const key of Object.values(SFXKeys)) {
      this.registerSFX(key);
    }

    // Register all music keys
    for (const key of getAllMusicKeys()) {
      this.registerMusic(key);
    }
  }

  /**
   * Create null/no-op sound instance.
   */
  private createNullInstance(key: string): ISoundInstance {
    return {
      id: 'null',
      key,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      volume: 0,
      pitch: 1,
      play: () => {},
      pause: () => {},
      stop: () => {},
      seek: () => {},
      fade: async () => {},
      setPosition: () => {},
    };
  }
}

/**
 * Singleton instance for easy access.
 */
let audioManagerInstance: AudioManager | null = null;

/**
 * Get or create AudioManager singleton.
 */
export function getAudioManager(config?: AudioManagerConfig): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager(config);
  }
  return audioManagerInstance;
}

/**
 * Reset AudioManager singleton (for testing).
 */
export function resetAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.destroy();
    audioManagerInstance = null;
  }
}
