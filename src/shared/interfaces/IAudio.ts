/**
 * Audio channel types.
 */
export enum AudioChannel {
  Master = 'master',
  Music = 'music',
  SFX = 'sfx',
  UI = 'ui',
  Ambient = 'ambient',
}

/**
 * Sound configuration.
 */
export interface ISoundConfig {
  key: string;               // Asset key
  volume?: number;           // 0-1, default 1
  pitch?: number;            // Playback rate, default 1
  loop?: boolean;            // Loop the sound
  channel?: AudioChannel;    // Audio channel for volume control
  spatial?: boolean;         // Use spatial audio
  x?: number;                // Position X for spatial
  y?: number;                // Position Y for spatial
  maxDistance?: number;      // Max audible distance for spatial
  delay?: number;            // Delay before playing in ms
}

/**
 * Playing sound instance.
 */
export interface ISoundInstance {
  readonly id: string;
  readonly key: string;

  /** Current playback position in seconds */
  readonly currentTime: number;

  /** Total duration in seconds */
  readonly duration: number;

  /** Whether currently playing */
  readonly isPlaying: boolean;

  /** Volume 0-1 */
  volume: number;

  /** Playback rate */
  pitch: number;

  /** Play the sound */
  play(): void;

  /** Pause the sound */
  pause(): void;

  /** Stop the sound */
  stop(): void;

  /** Seek to position */
  seek(time: number): void;

  /** Fade volume */
  fade(toVolume: number, duration: number): Promise<void>;

  /** Update spatial position */
  setPosition(x: number, y: number): void;
}

/**
 * Music track configuration.
 */
export interface IMusicConfig {
  key: string;
  volume?: number;
  loop?: boolean;           // Usually true for music
  fadeIn?: number;          // Fade in duration in ms
  bpm?: number;             // Beats per minute (for sync)
  introEnd?: number;        // Time where intro ends (for smart looping)
  loopStart?: number;       // Custom loop start point
  loopEnd?: number;         // Custom loop end point
}

/**
 * Audio manager interface.
 */
export interface IAudioManager {
  /** Master volume */
  masterVolume: number;

  /** Music volume */
  musicVolume: number;

  /** SFX volume */
  sfxVolume: number;

  /** Whether audio is muted */
  muted: boolean;

  // SFX

  /**
   * Play a sound effect.
   * @returns Sound instance for control
   */
  playSFX(config: ISoundConfig): ISoundInstance;

  /**
   * Play SFX at position (spatial audio).
   */
  playSFXAt(key: string, x: number, y: number, volume?: number): ISoundInstance;

  /**
   * Stop a specific sound.
   */
  stopSFX(id: string): void;

  /**
   * Stop all SFX.
   */
  stopAllSFX(): void;

  // Music

  /**
   * Play music track.
   */
  playMusic(config: IMusicConfig): ISoundInstance;

  /**
   * Stop current music.
   * @param fadeOut Fade out duration in ms
   */
  stopMusic(fadeOut?: number): Promise<void>;

  /**
   * Crossfade to new music.
   */
  crossfade(config: IMusicConfig, duration: number): Promise<void>;

  /**
   * Pause music.
   */
  pauseMusic(): void;

  /**
   * Resume music.
   */
  resumeMusic(): void;

  /** Current playing music key */
  readonly currentMusic: string | null;

  // Channel Control

  /**
   * Set channel volume.
   */
  setChannelVolume(channel: AudioChannel, volume: number): void;

  /**
   * Get channel volume.
   */
  getChannelVolume(channel: AudioChannel): number;

  /**
   * Mute/unmute channel.
   */
  setChannelMuted(channel: AudioChannel, muted: boolean): void;

  // Spatial Audio

  /**
   * Set listener position (usually camera/player).
   */
  setListenerPosition(x: number, y: number): void;

  // Lifecycle

  /**
   * Initialize audio system.
   * Must be called after user interaction on web.
   */
  init(): Promise<void>;

  /**
   * Suspend audio (when game loses focus).
   */
  suspend(): void;

  /**
   * Resume audio (when game gains focus).
   */
  resume(): void;

  /**
   * Clean up resources.
   */
  destroy(): void;
}

/**
 * Sound pool for frequently played sounds.
 */
export interface ISoundPool {
  /** Pool key */
  readonly key: string;

  /** Number of sounds in pool */
  readonly size: number;

  /**
   * Play sound from pool.
   */
  play(config?: Partial<ISoundConfig>): ISoundInstance;

  /**
   * Stop all sounds in pool.
   */
  stopAll(): void;
}
