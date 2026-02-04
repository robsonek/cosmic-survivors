/**
 * SoundPool - Object pool for frequently played sounds.
 *
 * Features:
 * - Pre-creates multiple audio instances
 * - Reuses available instances
 * - Auto-creates if pool exhausted
 * - Configurable size per sound
 */

import type { ISoundConfig, ISoundInstance, ISoundPool } from '@shared/interfaces/IAudio';

/**
 * Internal pooled sound instance.
 */
interface PooledSound {
  audio: HTMLAudioElement;
  inUse: boolean;
  id: string;
}

/**
 * Sound pool configuration.
 */
export interface SoundPoolConfig {
  key: string;
  sourceUrl: string;
  poolSize: number;
  maxInstances?: number;
}

/**
 * SoundPool implementation.
 */
export class SoundPool implements ISoundPool {
  /** Pool key identifier */
  readonly key: string;

  /** Source URL for creating new instances */
  private readonly sourceUrl: string;

  /** Configured pool size */
  private readonly poolSize: number;

  /** Maximum allowed instances */
  private readonly maxInstances: number;

  /** Pool of audio elements */
  private pool: PooledSound[] = [];

  /** Next instance ID */
  private nextId = 0;

  /** Base volume for pool */
  private baseVolume = 1.0;

  /** Whether pool is muted */
  private muted = false;

  constructor(config: SoundPoolConfig) {
    this.key = config.key;
    this.sourceUrl = config.sourceUrl;
    this.poolSize = config.poolSize;
    this.maxInstances = config.maxInstances ?? config.poolSize * 2;

    // Pre-create pool
    this.initializePool();
  }

  /**
   * Get number of sounds in pool.
   */
  get size(): number {
    return this.pool.length;
  }

  /**
   * Get number of currently playing sounds.
   */
  get activeCount(): number {
    return this.pool.filter((p) => p.inUse).length;
  }

  /**
   * Get number of available sounds.
   */
  get availableCount(): number {
    return this.pool.filter((p) => !p.inUse).length;
  }

  /**
   * Set base volume for all sounds in pool.
   */
  setVolume(volume: number): void {
    this.baseVolume = Math.max(0, Math.min(1, volume));
    // Update playing sounds
    for (const pooled of this.pool) {
      if (pooled.inUse) {
        pooled.audio.volume = this.muted ? 0 : this.baseVolume;
      }
    }
  }

  /**
   * Set muted state.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const pooled of this.pool) {
      if (pooled.inUse) {
        pooled.audio.volume = muted ? 0 : this.baseVolume;
      }
    }
  }

  /**
   * Play sound from pool.
   */
  play(config?: Partial<ISoundConfig>): ISoundInstance {
    // Find available sound
    let pooled = this.getAvailable();

    // If none available and under max, create new
    if (!pooled && this.pool.length < this.maxInstances) {
      pooled = this.createPooledSound();
    }

    // If still none, steal oldest playing
    if (!pooled) {
      pooled = this.stealOldest();
    }

    // Reset and configure
    pooled.inUse = true;
    const audio = pooled.audio;
    audio.currentTime = 0;

    // Apply config
    const volume = config?.volume ?? 1.0;
    const pitch = config?.pitch ?? 1.0;
    const loop = config?.loop ?? false;

    audio.volume = this.muted ? 0 : this.baseVolume * volume;
    audio.playbackRate = pitch;
    audio.loop = loop;

    // Setup end handler
    const handleEnded = () => {
      if (!loop) {
        pooled!.inUse = false;
      }
      audio.removeEventListener('ended', handleEnded);
    };
    audio.addEventListener('ended', handleEnded);

    // Play
    audio.play().catch((err) => {
      console.warn(`Failed to play pooled sound ${this.key}:`, err);
      pooled!.inUse = false;
    });

    return this.createSoundInstance(pooled, volume);
  }

  /**
   * Stop all sounds in pool.
   */
  stopAll(): void {
    for (const pooled of this.pool) {
      if (pooled.inUse) {
        pooled.audio.pause();
        pooled.audio.currentTime = 0;
        pooled.inUse = false;
      }
    }
  }

  /**
   * Release pool resources.
   */
  destroy(): void {
    this.stopAll();
    for (const pooled of this.pool) {
      pooled.audio.src = '';
    }
    this.pool = [];
  }

  /**
   * Initialize pool with pre-created audio elements.
   */
  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.createPooledSound();
    }
  }

  /**
   * Create a new pooled sound.
   */
  private createPooledSound(): PooledSound {
    const audio = new Audio(this.sourceUrl);
    audio.preload = 'auto';

    const pooled: PooledSound = {
      audio,
      inUse: false,
      id: `${this.key}_${this.nextId++}`,
    };

    this.pool.push(pooled);
    return pooled;
  }

  /**
   * Get an available sound from pool.
   */
  private getAvailable(): PooledSound | null {
    return this.pool.find((p) => !p.inUse) ?? null;
  }

  /**
   * Steal the oldest playing sound.
   */
  private stealOldest(): PooledSound {
    // Find sound with most progress
    let oldest = this.pool[0];
    let maxProgress = 0;

    for (const pooled of this.pool) {
      if (pooled.inUse && pooled.audio.duration > 0) {
        const progress = pooled.audio.currentTime / pooled.audio.duration;
        if (progress > maxProgress) {
          maxProgress = progress;
          oldest = pooled;
        }
      }
    }

    // Stop it
    oldest.audio.pause();
    oldest.audio.currentTime = 0;
    oldest.inUse = false;

    return oldest;
  }

  /**
   * Create ISoundInstance wrapper.
   */
  private createSoundInstance(
    pooled: PooledSound,
    configVolume: number
  ): ISoundInstance {
    const audio = pooled.audio;
    const baseVol = this.baseVolume;
    const isMuted = () => this.muted;

    return {
      id: pooled.id,
      key: this.key,

      get currentTime(): number {
        return audio.currentTime;
      },

      get duration(): number {
        return audio.duration || 0;
      },

      get isPlaying(): boolean {
        return pooled.inUse && !audio.paused;
      },

      get volume(): number {
        return configVolume;
      },

      set volume(v: number) {
        configVolume = Math.max(0, Math.min(1, v));
        audio.volume = isMuted() ? 0 : baseVol * configVolume;
      },

      get pitch(): number {
        return audio.playbackRate;
      },

      set pitch(p: number) {
        audio.playbackRate = Math.max(0.1, Math.min(4, p));
      },

      play(): void {
        if (pooled.inUse) {
          audio.play().catch(() => {});
        }
      },

      pause(): void {
        if (pooled.inUse) {
          audio.pause();
        }
      },

      stop(): void {
        audio.pause();
        audio.currentTime = 0;
        pooled.inUse = false;
      },

      seek(time: number): void {
        if (pooled.inUse && audio.duration > 0) {
          audio.currentTime = Math.max(0, Math.min(time, audio.duration));
        }
      },

      async fade(toVolume: number, duration: number): Promise<void> {
        return new Promise((resolve) => {
          const startVolume = configVolume;
          const startTime = performance.now();

          const updateFade = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            configVolume = startVolume + (toVolume - startVolume) * progress;
            audio.volume = isMuted() ? 0 : baseVol * configVolume;

            if (progress < 1 && pooled.inUse) {
              requestAnimationFrame(updateFade);
            } else {
              resolve();
            }
          };

          requestAnimationFrame(updateFade);
        });
      },

      setPosition(_x: number, _y: number): void {
        // Spatial audio not supported in basic pool
        // Use SFXPlayer for spatial sounds
      },
    };
  }
}

/**
 * SoundPoolManager - Manages multiple sound pools.
 */
export class SoundPoolManager {
  private pools: Map<string, SoundPool> = new Map();
  private masterVolume = 1.0;
  private muted = false;

  /**
   * Create or get a sound pool.
   */
  getOrCreate(config: SoundPoolConfig): SoundPool {
    let pool = this.pools.get(config.key);
    if (!pool) {
      pool = new SoundPool(config);
      pool.setVolume(this.masterVolume);
      pool.setMuted(this.muted);
      this.pools.set(config.key, pool);
    }
    return pool;
  }

  /**
   * Get existing pool.
   */
  get(key: string): SoundPool | undefined {
    return this.pools.get(key);
  }

  /**
   * Check if pool exists.
   */
  has(key: string): boolean {
    return this.pools.has(key);
  }

  /**
   * Remove a pool.
   */
  remove(key: string): void {
    const pool = this.pools.get(key);
    if (pool) {
      pool.destroy();
      this.pools.delete(key);
    }
  }

  /**
   * Set master volume for all pools.
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    for (const pool of this.pools.values()) {
      pool.setVolume(this.masterVolume);
    }
  }

  /**
   * Set muted state for all pools.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const pool of this.pools.values()) {
      pool.setMuted(muted);
    }
  }

  /**
   * Stop all sounds in all pools.
   */
  stopAll(): void {
    for (const pool of this.pools.values()) {
      pool.stopAll();
    }
  }

  /**
   * Destroy all pools.
   */
  destroy(): void {
    for (const pool of this.pools.values()) {
      pool.destroy();
    }
    this.pools.clear();
  }

  /**
   * Get statistics.
   */
  getStats(): { poolCount: number; totalSounds: number; activeSounds: number } {
    let totalSounds = 0;
    let activeSounds = 0;

    for (const pool of this.pools.values()) {
      totalSounds += pool.size;
      activeSounds += pool.activeCount;
    }

    return {
      poolCount: this.pools.size,
      totalSounds,
      activeSounds,
    };
  }
}
