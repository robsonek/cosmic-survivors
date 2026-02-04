/**
 * MusicPlayer - Music playback with advanced features.
 *
 * Features:
 * - Play single track
 * - Crossfade between tracks
 * - Loop handling (with intro/loop points)
 * - Fade in/out
 * - Volume control
 * - BPM tracking (for sync with gameplay)
 */

import type { IMusicConfig, ISoundInstance } from '@shared/interfaces/IAudio';
import { MUSIC_CROSSFADE_DURATION } from '@shared/constants/game';

/**
 * Active music track state.
 */
interface MusicTrackState {
  key: string;
  audio: HTMLAudioElement;
  config: IMusicConfig;
  volume: number;
  isFading: boolean;
  fadePromise?: Promise<void>;
}

/**
 * BPM sync callback.
 */
export type BeatCallback = (beat: number, measure: number) => void;

/**
 * MusicPlayer configuration.
 */
export interface MusicPlayerConfig {
  assetBasePath?: string;
  defaultCrossfadeDuration?: number;
}

/**
 * MusicPlayer implementation.
 */
export class MusicPlayer {
  /** Currently playing track */
  private currentTrack: MusicTrackState | null = null;

  /** Track being crossfaded out */
  private fadingOutTrack: MusicTrackState | null = null;

  /** Volume settings */
  private masterVolume = 1.0;
  private musicVolume = 1.0;

  /** Muted state */
  private muted = false;

  /** Paused state */
  private paused = false;

  /** Configuration */
  private readonly assetBasePath: string;
  private readonly defaultCrossfadeDuration: number;

  /** BPM tracking */
  private bpmCallbacks: BeatCallback[] = [];
  private beatCount = 0;
  private bpmIntervalId: number | null = null;

  /** Available assets */
  private availableAssets: Map<string, string> = new Map();

  constructor(config: MusicPlayerConfig = {}) {
    this.assetBasePath = config.assetBasePath ?? '/assets/audio/music/';
    this.defaultCrossfadeDuration = config.defaultCrossfadeDuration ?? MUSIC_CROSSFADE_DURATION;
  }

  /**
   * Register music asset.
   */
  registerAsset(key: string, url?: string): void {
    const assetUrl = url ?? `${this.assetBasePath}${key}.mp3`;
    this.availableAssets.set(key, assetUrl);
  }

  /**
   * Check if asset is registered.
   */
  hasAsset(key: string): boolean {
    return this.availableAssets.has(key);
  }

  /**
   * Get current playing track key.
   */
  get currentMusic(): string | null {
    return this.currentTrack?.key ?? null;
  }

  /**
   * Check if music is playing.
   */
  get isPlaying(): boolean {
    return this.currentTrack !== null && !this.paused;
  }

  /**
   * Get current BPM.
   */
  get currentBPM(): number {
    return this.currentTrack?.config.bpm ?? 0;
  }

  /**
   * Play music track.
   */
  play(config: IMusicConfig): ISoundInstance {
    const key = config.key;

    // Check if already playing same track
    if (this.currentTrack?.key === key) {
      return this.createSoundInstance(this.currentTrack);
    }

    // Get asset URL
    const url = this.availableAssets.get(key);
    if (!url) {
      console.warn(`Music asset not registered: ${key}`);
      return this.createNullInstance(key);
    }

    // Stop current without crossfade
    if (this.currentTrack) {
      this.stopCurrentTrack(false);
    }

    // Create new track
    const audio = new Audio(url);
    audio.loop = config.loop ?? true;
    audio.preload = 'auto';

    const volume = config.volume ?? 1.0;
    const track: MusicTrackState = {
      key,
      audio,
      config,
      volume,
      isFading: false,
    };

    // Setup custom loop points
    if (config.loopStart !== undefined || config.loopEnd !== undefined) {
      this.setupCustomLoop(audio, config);
    }

    // Start playback
    this.currentTrack = track;
    audio.volume = this.calculateVolume(volume);

    // Fade in if specified
    if (config.fadeIn && config.fadeIn > 0) {
      audio.volume = 0;
      this.fadeIn(track, config.fadeIn);
    }

    audio.play().catch((err) => {
      console.warn(`Failed to play music ${key}:`, err);
    });

    // Setup BPM tracking
    if (config.bpm) {
      this.startBPMTracking(config.bpm);
    }

    return this.createSoundInstance(track);
  }

  /**
   * Stop music.
   */
  async stop(fadeOut?: number): Promise<void> {
    if (!this.currentTrack) return;

    if (fadeOut && fadeOut > 0) {
      await this.fadeOut(this.currentTrack, fadeOut);
    }

    this.stopCurrentTrack(false);
    this.stopBPMTracking();
  }

  /**
   * Crossfade to new music.
   */
  async crossfade(config: IMusicConfig, duration?: number): Promise<void> {
    const fadeDuration = duration ?? this.defaultCrossfadeDuration;
    const key = config.key;

    // If same track, do nothing
    if (this.currentTrack?.key === key) {
      return;
    }

    // Get asset URL
    const url = this.availableAssets.get(key);
    if (!url) {
      console.warn(`Music asset not registered: ${key}`);
      return;
    }

    // Store current track for fading out
    const oldTrack = this.currentTrack;

    // Create new track
    const audio = new Audio(url);
    audio.loop = config.loop ?? true;
    audio.volume = 0; // Start silent for fade in

    const volume = config.volume ?? 1.0;
    const newTrack: MusicTrackState = {
      key,
      audio,
      config,
      volume,
      isFading: true,
    };

    // Setup custom loop points
    if (config.loopStart !== undefined || config.loopEnd !== undefined) {
      this.setupCustomLoop(audio, config);
    }

    // Set new track as current
    this.currentTrack = newTrack;
    this.fadingOutTrack = oldTrack;

    // Start new track
    audio.play().catch((err) => {
      console.warn(`Failed to play music ${key}:`, err);
    });

    // Crossfade
    const fadeInPromise = this.fadeIn(newTrack, fadeDuration);
    const fadeOutPromise = oldTrack ? this.fadeOut(oldTrack, fadeDuration) : Promise.resolve();

    await Promise.all([fadeInPromise, fadeOutPromise]);

    // Cleanup old track
    if (this.fadingOutTrack) {
      this.fadingOutTrack.audio.pause();
      this.fadingOutTrack.audio.src = '';
      this.fadingOutTrack = null;
    }

    newTrack.isFading = false;

    // Update BPM tracking
    if (config.bpm) {
      this.startBPMTracking(config.bpm);
    } else {
      this.stopBPMTracking();
    }
  }

  /**
   * Pause music.
   */
  pause(): void {
    if (this.currentTrack && !this.paused) {
      this.currentTrack.audio.pause();
      this.paused = true;
    }
  }

  /**
   * Resume music.
   */
  resume(): void {
    if (this.currentTrack && this.paused) {
      this.currentTrack.audio.play().catch(() => {});
      this.paused = false;
    }
  }

  /**
   * Set master volume.
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set music channel volume.
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set muted state.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateVolumes();
  }

  /**
   * Get current playback position.
   */
  getCurrentTime(): number {
    return this.currentTrack?.audio.currentTime ?? 0;
  }

  /**
   * Seek to position.
   */
  seek(time: number): void {
    if (this.currentTrack && this.currentTrack.audio.duration > 0) {
      this.currentTrack.audio.currentTime = Math.max(
        0,
        Math.min(time, this.currentTrack.audio.duration)
      );
    }
  }

  /**
   * Register BPM beat callback.
   */
  onBeat(callback: BeatCallback): () => void {
    this.bpmCallbacks.push(callback);
    return () => {
      const index = this.bpmCallbacks.indexOf(callback);
      if (index !== -1) {
        this.bpmCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Destroy and cleanup.
   */
  destroy(): void {
    this.stopCurrentTrack(true);
    this.stopBPMTracking();
    this.bpmCallbacks = [];
    this.availableAssets.clear();
  }

  /**
   * Calculate final volume.
   */
  private calculateVolume(trackVolume: number): number {
    if (this.muted) return 0;
    return trackVolume * this.musicVolume * this.masterVolume;
  }

  /**
   * Update all playing volumes.
   */
  private updateVolumes(): void {
    if (this.currentTrack && !this.currentTrack.isFading) {
      this.currentTrack.audio.volume = this.calculateVolume(this.currentTrack.volume);
    }
  }

  /**
   * Stop current track.
   */
  private stopCurrentTrack(cleanup: boolean): void {
    if (this.currentTrack) {
      this.currentTrack.audio.pause();
      if (cleanup) {
        this.currentTrack.audio.src = '';
      }
      this.currentTrack = null;
    }

    if (this.fadingOutTrack) {
      this.fadingOutTrack.audio.pause();
      this.fadingOutTrack.audio.src = '';
      this.fadingOutTrack = null;
    }

    this.paused = false;
  }

  /**
   * Fade in track.
   */
  private async fadeIn(track: MusicTrackState, duration: number): Promise<void> {
    track.isFading = true;
    const targetVolume = this.calculateVolume(track.volume);
    const startVolume = 0;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const update = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        track.audio.volume = startVolume + (targetVolume - startVolume) * progress;

        if (progress < 1 && track === this.currentTrack) {
          requestAnimationFrame(update);
        } else {
          track.isFading = false;
          resolve();
        }
      };

      requestAnimationFrame(update);
    });
  }

  /**
   * Fade out track.
   */
  private async fadeOut(track: MusicTrackState, duration: number): Promise<void> {
    track.isFading = true;
    const startVolume = track.audio.volume;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const update = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        track.audio.volume = startVolume * (1 - progress);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          track.audio.volume = 0;
          track.isFading = false;
          resolve();
        }
      };

      requestAnimationFrame(update);
    });
  }

  /**
   * Setup custom loop points.
   */
  private setupCustomLoop(audio: HTMLAudioElement, config: IMusicConfig): void {
    const loopStart = config.loopStart ?? config.introEnd ?? 0;
    const loopEnd = config.loopEnd;

    if (!config.loop) return;

    // Disable native loop
    audio.loop = false;

    // Handle manual looping
    const handleTimeUpdate = () => {
      if (loopEnd !== undefined && audio.currentTime >= loopEnd) {
        audio.currentTime = loopStart;
      }
    };

    const handleEnded = () => {
      if (config.loop) {
        audio.currentTime = loopStart;
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
  }

  /**
   * Start BPM tracking.
   */
  private startBPMTracking(bpm: number): void {
    this.stopBPMTracking();

    if (bpm <= 0 || this.bpmCallbacks.length === 0) return;

    const beatInterval = 60000 / bpm; // ms per beat
    this.beatCount = 0;

    this.bpmIntervalId = window.setInterval(() => {
      this.beatCount++;
      const measure = Math.floor(this.beatCount / 4);
      const beatInMeasure = this.beatCount % 4;

      for (const callback of this.bpmCallbacks) {
        try {
          callback(beatInMeasure, measure);
        } catch (err) {
          console.error('Error in beat callback:', err);
        }
      }
    }, beatInterval);
  }

  /**
   * Stop BPM tracking.
   */
  private stopBPMTracking(): void {
    if (this.bpmIntervalId !== null) {
      window.clearInterval(this.bpmIntervalId);
      this.bpmIntervalId = null;
    }
    this.beatCount = 0;
  }

  /**
   * Create ISoundInstance for track.
   */
  private createSoundInstance(track: MusicTrackState): ISoundInstance {
    const self = this;
    const audio = track.audio;

    return {
      id: `music_${track.key}`,
      key: track.key,

      get currentTime(): number {
        return audio.currentTime;
      },

      get duration(): number {
        return audio.duration || 0;
      },

      get isPlaying(): boolean {
        return !audio.paused && !self.paused;
      },

      get volume(): number {
        return track.volume;
      },

      set volume(v: number) {
        track.volume = Math.max(0, Math.min(1, v));
        if (!track.isFading) {
          audio.volume = self.calculateVolume(track.volume);
        }
      },

      get pitch(): number {
        return audio.playbackRate;
      },

      set pitch(p: number) {
        audio.playbackRate = Math.max(0.1, Math.min(4, p));
      },

      play(): void {
        self.resume();
      },

      pause(): void {
        self.pause();
      },

      stop(): void {
        self.stop();
      },

      seek(time: number): void {
        self.seek(time);
      },

      async fade(toVolume: number, duration: number): Promise<void> {
        const startVolume = track.volume;
        const startTime = performance.now();

        return new Promise((resolve) => {
          const update = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            track.volume = startVolume + (toVolume - startVolume) * progress;
            audio.volume = self.calculateVolume(track.volume);

            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              resolve();
            }
          };

          requestAnimationFrame(update);
        });
      },

      setPosition(_x: number, _y: number): void {
        // Music doesn't use spatial audio
      },
    };
  }

  /**
   * Create null/no-op instance.
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
