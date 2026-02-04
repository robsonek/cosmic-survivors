/**
 * SFXPlayer - Sound effects player with advanced features.
 *
 * Features:
 * - Play, stop, pause individual sounds
 * - Sound pooling (reusing audio instances)
 * - Spatial audio (volume falloff based on distance)
 * - Pitch variation (random pitch for variety)
 * - Multiple simultaneous sounds limit
 * - Priority system (important sounds won't be cut)
 */

import type { ISoundConfig, ISoundInstance } from '@shared/interfaces/IAudio';
import {
  MAX_SIMULTANEOUS_SFX,
  SPATIAL_AUDIO_MAX_DISTANCE,
} from '@shared/constants/game';
import { SoundPoolManager } from './SoundPool';
import { getSFXConfig, type SFXKey } from './SFXDefinitions';

/**
 * Active sound tracking.
 */
interface ActiveSound {
  id: string;
  key: string;
  instance: ISoundInstance;
  priority: number;
  startTime: number;
  x?: number;
  y?: number;
  maxDistance: number;
  baseVolume: number;
}

/**
 * Cooldown tracking.
 */
interface CooldownEntry {
  lastPlayed: number;
  cooldown: number;
}

/**
 * SFXPlayer configuration.
 */
export interface SFXPlayerConfig {
  maxSimultaneous?: number;
  spatialMaxDistance?: number;
  defaultVolume?: number;
  assetBasePath?: string;
}

/**
 * SFXPlayer implementation.
 */
export class SFXPlayer {
  /** Pool manager for sound pooling */
  private poolManager: SoundPoolManager;

  /** Currently active sounds */
  private activeSounds: Map<string, ActiveSound> = new Map();

  /** Cooldown tracking */
  private cooldowns: Map<string, CooldownEntry> = new Map();

  /** Listener position for spatial audio */
  private listenerX = 0;
  private listenerY = 0;

  /** Volume settings */
  private masterVolume = 1.0;
  private sfxVolume = 1.0;

  /** Muted state */
  private muted = false;

  /** Configuration */
  private readonly maxSimultaneous: number;
  private readonly spatialMaxDistance: number;
  private readonly assetBasePath: string;

  /** Next sound ID */
  private nextSoundId = 0;

  /** Asset availability cache */
  private availableAssets: Set<string> = new Set();

  constructor(config: SFXPlayerConfig = {}) {
    this.maxSimultaneous = config.maxSimultaneous ?? MAX_SIMULTANEOUS_SFX;
    this.spatialMaxDistance = config.spatialMaxDistance ?? SPATIAL_AUDIO_MAX_DISTANCE;
    this.assetBasePath = config.assetBasePath ?? '/assets/audio/sfx/';

    this.poolManager = new SoundPoolManager();
  }

  /**
   * Register available sound asset.
   */
  registerAsset(key: string, url?: string): void {
    this.availableAssets.add(key);

    // Pre-create pool if not exists
    const config = getSFXConfig(key as SFXKey);
    const assetUrl = url ?? `${this.assetBasePath}${key}.mp3`;

    this.poolManager.getOrCreate({
      key,
      sourceUrl: assetUrl,
      poolSize: config.poolSize,
    });
  }

  /**
   * Check if asset is registered.
   */
  hasAsset(key: string): boolean {
    return this.availableAssets.has(key);
  }

  /**
   * Play a sound effect.
   */
  play(config: ISoundConfig): ISoundInstance | null {
    const key = config.key;

    // Check if asset is available
    if (!this.hasAsset(key)) {
      console.warn(`SFX asset not registered: ${key}`);
      return this.createNullInstance(key);
    }

    // Get SFX config
    const sfxConfig = getSFXConfig(key as SFXKey);

    // Check cooldown
    if (!this.checkCooldown(key, sfxConfig.cooldown)) {
      return this.createNullInstance(key);
    }

    // Check if we're at max sounds
    if (this.activeSounds.size >= this.maxSimultaneous) {
      // Try to evict lower priority sound
      const priority = sfxConfig.priority;
      if (!this.evictLowerPriority(priority)) {
        return this.createNullInstance(key);
      }
    }

    // Get or create pool
    const pool = this.poolManager.get(key);
    if (!pool) {
      return this.createNullInstance(key);
    }

    // Calculate volume
    const baseVolume = (config.volume ?? 1.0) * sfxConfig.volume;
    let spatialVolume = 1.0;

    if (config.spatial !== false && sfxConfig.spatial) {
      if (config.x !== undefined && config.y !== undefined) {
        spatialVolume = this.calculateSpatialVolume(
          config.x,
          config.y,
          config.maxDistance ?? this.spatialMaxDistance
        );
      }
    }

    const finalVolume = baseVolume * spatialVolume * this.sfxVolume * this.masterVolume;

    // Calculate pitch with variation
    const basePitch = config.pitch ?? 1.0;
    const variation = sfxConfig.pitchVariation;
    const pitch = variation > 0
      ? basePitch + (Math.random() * 2 - 1) * variation
      : basePitch;

    // Play from pool
    const instance = pool.play({
      volume: this.muted ? 0 : finalVolume,
      pitch,
      loop: config.loop,
    });

    // Track active sound
    const soundId = `sfx_${this.nextSoundId++}`;
    const activeSound: ActiveSound = {
      id: soundId,
      key,
      instance,
      priority: sfxConfig.priority,
      startTime: performance.now(),
      x: config.x,
      y: config.y,
      maxDistance: config.maxDistance ?? this.spatialMaxDistance,
      baseVolume,
    };

    this.activeSounds.set(soundId, activeSound);

    // Update cooldown
    this.updateCooldown(key, sfxConfig.cooldown);

    // Setup cleanup on end
    this.setupCleanup(soundId, instance);

    // Return wrapped instance
    return this.wrapInstance(soundId, instance);
  }

  /**
   * Play SFX at position (spatial audio).
   */
  playAt(key: string, x: number, y: number, volume?: number): ISoundInstance | null {
    return this.play({
      key,
      x,
      y,
      volume,
      spatial: true,
    });
  }

  /**
   * Stop a specific sound by ID.
   */
  stop(id: string): void {
    const active = this.activeSounds.get(id);
    if (active) {
      active.instance.stop();
      this.activeSounds.delete(id);
    }
  }

  /**
   * Stop all sounds.
   */
  stopAll(): void {
    for (const active of this.activeSounds.values()) {
      active.instance.stop();
    }
    this.activeSounds.clear();
    this.poolManager.stopAll();
  }

  /**
   * Stop all sounds with specific key.
   */
  stopByKey(key: string): void {
    for (const [id, active] of this.activeSounds) {
      if (active.key === key) {
        active.instance.stop();
        this.activeSounds.delete(id);
      }
    }
  }

  /**
   * Pause a specific sound.
   */
  pause(id: string): void {
    const active = this.activeSounds.get(id);
    if (active) {
      active.instance.pause();
    }
  }

  /**
   * Resume a specific sound.
   */
  resume(id: string): void {
    const active = this.activeSounds.get(id);
    if (active) {
      active.instance.play();
    }
  }

  /**
   * Pause all sounds.
   */
  pauseAll(): void {
    for (const active of this.activeSounds.values()) {
      active.instance.pause();
    }
  }

  /**
   * Resume all sounds.
   */
  resumeAll(): void {
    for (const active of this.activeSounds.values()) {
      active.instance.play();
    }
  }

  /**
   * Set listener position for spatial audio.
   */
  setListenerPosition(x: number, y: number): void {
    this.listenerX = x;
    this.listenerY = y;

    // Update all spatial sounds
    this.updateSpatialSounds();
  }

  /**
   * Set master volume.
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  /**
   * Set SFX channel volume.
   */
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  /**
   * Set muted state.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.poolManager.setMuted(muted);
    this.updateAllVolumes();
  }

  /**
   * Get current playing count.
   */
  get activeCount(): number {
    return this.activeSounds.size;
  }

  /**
   * Destroy and cleanup.
   */
  destroy(): void {
    this.stopAll();
    this.poolManager.destroy();
    this.activeSounds.clear();
    this.cooldowns.clear();
    this.availableAssets.clear();
  }

  /**
   * Calculate spatial volume based on distance.
   */
  private calculateSpatialVolume(x: number, y: number, maxDistance: number): number {
    const dx = x - this.listenerX;
    const dy = y - this.listenerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= maxDistance) {
      return 0;
    }

    if (distance <= 0) {
      return 1;
    }

    // Linear falloff
    return 1 - distance / maxDistance;
  }

  /**
   * Update all spatial sounds.
   */
  private updateSpatialSounds(): void {
    for (const active of this.activeSounds.values()) {
      if (active.x !== undefined && active.y !== undefined) {
        const spatialVolume = this.calculateSpatialVolume(
          active.x,
          active.y,
          active.maxDistance
        );
        const finalVolume = active.baseVolume * spatialVolume * this.sfxVolume * this.masterVolume;
        active.instance.volume = this.muted ? 0 : finalVolume;
      }
    }
  }

  /**
   * Update all sound volumes.
   */
  private updateAllVolumes(): void {
    for (const active of this.activeSounds.values()) {
      let spatialVolume = 1;
      if (active.x !== undefined && active.y !== undefined) {
        spatialVolume = this.calculateSpatialVolume(
          active.x,
          active.y,
          active.maxDistance
        );
      }
      const finalVolume = active.baseVolume * spatialVolume * this.sfxVolume * this.masterVolume;
      active.instance.volume = this.muted ? 0 : finalVolume;
    }
  }

  /**
   * Check if sound is on cooldown.
   */
  private checkCooldown(key: string, cooldown: number): boolean {
    if (cooldown <= 0) return true;

    const entry = this.cooldowns.get(key);
    if (!entry) return true;

    const elapsed = performance.now() - entry.lastPlayed;
    return elapsed >= entry.cooldown;
  }

  /**
   * Update cooldown for sound.
   */
  private updateCooldown(key: string, cooldown: number): void {
    if (cooldown > 0) {
      this.cooldowns.set(key, {
        lastPlayed: performance.now(),
        cooldown,
      });
    }
  }

  /**
   * Evict lowest priority sound.
   */
  private evictLowerPriority(newPriority: number): boolean {
    let lowestPriority = newPriority;
    let lowestId: string | null = null;

    for (const [id, active] of this.activeSounds) {
      if (active.priority < lowestPriority) {
        lowestPriority = active.priority;
        lowestId = id;
      }
    }

    if (lowestId) {
      this.stop(lowestId);
      return true;
    }

    return false;
  }

  /**
   * Setup cleanup when sound ends.
   */
  private setupCleanup(id: string, instance: ISoundInstance): void {
    // Poll for completion (since we can't easily hook into pool's audio)
    const checkComplete = () => {
      if (!instance.isPlaying) {
        this.activeSounds.delete(id);
      } else if (this.activeSounds.has(id)) {
        setTimeout(checkComplete, 100);
      }
    };
    setTimeout(checkComplete, 100);
  }

  /**
   * Create null/no-op instance for failed plays.
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

  /**
   * Wrap pool instance with our tracking.
   */
  private wrapInstance(id: string, instance: ISoundInstance): ISoundInstance {
    const self = this;

    return {
      get id() {
        return id;
      },
      get key() {
        return instance.key;
      },
      get currentTime() {
        return instance.currentTime;
      },
      get duration() {
        return instance.duration;
      },
      get isPlaying() {
        return instance.isPlaying;
      },
      get volume() {
        return instance.volume;
      },
      set volume(v: number) {
        instance.volume = v;
      },
      get pitch() {
        return instance.pitch;
      },
      set pitch(p: number) {
        instance.pitch = p;
      },
      play() {
        instance.play();
      },
      pause() {
        instance.pause();
      },
      stop() {
        self.stop(id);
      },
      seek(time: number) {
        instance.seek(time);
      },
      async fade(toVolume: number, duration: number): Promise<void> {
        return instance.fade(toVolume, duration);
      },
      setPosition(x: number, y: number) {
        const active = self.activeSounds.get(id);
        if (active) {
          active.x = x;
          active.y = y;
          self.updateSpatialSounds();
        }
      },
    };
  }
}
