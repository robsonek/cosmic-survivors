/**
 * AudioEventHandler - Automatic sound playback based on game events.
 *
 * Subscribes to GameEvents and plays appropriate sounds:
 * - DAMAGE -> hit sound
 * - ENTITY_KILLED -> death sound
 * - WEAPON_FIRED -> weapon sound
 * - PLAYER_LEVEL_UP -> level up fanfare
 * - WAVE_START -> wave start sound
 */

import type { IEventBus, ISubscription } from '@shared/interfaces/IEventBus';
import {
  GameEvents,
  type DamageEvent,
  type EntityKilledEvent,
  type WeaponFiredEvent,
  type PlayerLevelUpEvent,
  type WaveStartEvent,
  type BossSpawnEvent,
  type PlaySFXEvent,
  type PlayMusicEvent,
} from '@shared/interfaces/IEventBus';
import { AudioManager } from './AudioManager';
import { SFXKeys, getWeaponSFX } from './SFXDefinitions';
import { MusicTracks } from './MusicTracks';

/**
 * AudioEventHandler configuration.
 */
export interface AudioEventHandlerConfig {
  /** Play hit sounds on damage */
  playHitSounds?: boolean;
  /** Play death sounds */
  playDeathSounds?: boolean;
  /** Play weapon sounds */
  playWeaponSounds?: boolean;
  /** Play UI sounds */
  playUISounds?: boolean;
  /** Play game event sounds */
  playGameEventSounds?: boolean;
  /** Max hit sounds per frame (throttle) */
  maxHitSoundsPerFrame?: number;
  /** Max death sounds per frame (throttle) */
  maxDeathSoundsPerFrame?: number;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: Required<AudioEventHandlerConfig> = {
  playHitSounds: true,
  playDeathSounds: true,
  playWeaponSounds: true,
  playUISounds: true,
  playGameEventSounds: true,
  maxHitSoundsPerFrame: 8,
  maxDeathSoundsPerFrame: 6,
};

/**
 * AudioEventHandler - Links game events to audio playback.
 */
export class AudioEventHandler {
  /** Audio manager reference */
  private audioManager: AudioManager;

  /** Event bus reference */
  private eventBus: IEventBus;

  /** Active subscriptions */
  private subscriptions: ISubscription[] = [];

  /** Configuration */
  private config: Required<AudioEventHandlerConfig>;

  /** Frame throttling */
  private hitSoundsThisFrame = 0;
  private deathSoundsThisFrame = 0;
  private frameResetScheduled = false;

  /** Player entity ID for special handling */
  private playerEntityId: number | null = null;

  constructor(
    audioManager: AudioManager,
    eventBus: IEventBus,
    config: AudioEventHandlerConfig = {}
  ) {
    this.audioManager = audioManager;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.setupSubscriptions();
  }

  /**
   * Set player entity ID for special sound handling.
   */
  setPlayerEntity(entityId: number): void {
    this.playerEntityId = entityId;
  }

  /**
   * Enable/disable specific sound categories.
   */
  setConfig(config: Partial<AudioEventHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy and unsubscribe from all events.
   */
  destroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];
  }

  /**
   * Setup all event subscriptions.
   */
  private setupSubscriptions(): void {
    // Combat events
    this.subscriptions.push(
      this.eventBus.on<DamageEvent>(GameEvents.DAMAGE, this.onDamage.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on<EntityKilledEvent>(
        GameEvents.ENTITY_KILLED,
        this.onEntityKilled.bind(this)
      )
    );

    this.subscriptions.push(
      this.eventBus.on<WeaponFiredEvent>(
        GameEvents.WEAPON_FIRED,
        this.onWeaponFired.bind(this)
      )
    );

    // Progression events
    this.subscriptions.push(
      this.eventBus.on<PlayerLevelUpEvent>(
        GameEvents.PLAYER_LEVEL_UP,
        this.onPlayerLevelUp.bind(this)
      )
    );

    // Wave events
    this.subscriptions.push(
      this.eventBus.on<WaveStartEvent>(GameEvents.WAVE_START, this.onWaveStart.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on<BossSpawnEvent>(GameEvents.BOSS_SPAWN, this.onBossSpawn.bind(this))
    );

    // Game state events
    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_OVER, this.onGameOver.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_WIN, this.onGameWin.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_PAUSE, this.onGamePause.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_RESUME, this.onGameResume.bind(this))
    );

    // Direct audio events (for manual SFX/Music control)
    this.subscriptions.push(
      this.eventBus.on<PlaySFXEvent>(GameEvents.PLAY_SFX, this.onPlaySFX.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on<PlayMusicEvent>(GameEvents.PLAY_MUSIC, this.onPlayMusic.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on(GameEvents.STOP_SFX, this.onStopSFX.bind(this))
    );

    this.subscriptions.push(
      this.eventBus.on(GameEvents.STOP_MUSIC, this.onStopMusic.bind(this))
    );
  }

  /**
   * Handle damage event.
   */
  private onDamage(event: DamageEvent): void {
    if (!this.config.playHitSounds) return;

    // Throttle hit sounds
    if (this.hitSoundsThisFrame >= this.config.maxHitSoundsPerFrame) {
      return;
    }
    this.hitSoundsThisFrame++;
    this.scheduleFrameReset();

    // Determine sound based on target
    const isPlayerHit = event.target === this.playerEntityId;
    const sfxKey = isPlayerHit ? SFXKeys.HIT_PLAYER : SFXKeys.HIT_ENEMY;

    // Play critical hit sound if applicable
    if (event.isCritical && !isPlayerHit) {
      this.audioManager.playSFXAt(
        SFXKeys.CRITICAL_HIT,
        event.position.x,
        event.position.y,
        0.8
      );
    } else {
      // Play spatial hit sound
      this.audioManager.playSFXAt(
        sfxKey,
        event.position.x,
        event.position.y,
        isPlayerHit ? 1.0 : 0.5
      );
    }
  }

  /**
   * Handle entity killed event.
   */
  private onEntityKilled(event: EntityKilledEvent): void {
    if (!this.config.playDeathSounds) return;

    // Throttle death sounds
    if (this.deathSoundsThisFrame >= this.config.maxDeathSoundsPerFrame) {
      return;
    }
    this.deathSoundsThisFrame++;
    this.scheduleFrameReset();

    // Determine sound based on entity
    const isPlayerDeath = event.entity === this.playerEntityId;

    if (isPlayerDeath) {
      // Player death is important, play at full volume
      this.audioManager.playSFX({
        key: SFXKeys.PLAYER_DEATH,
        volume: 1.0,
        spatial: false,
      });
    } else {
      // Enemy death with spatial audio
      this.audioManager.playSFXAt(
        SFXKeys.ENEMY_DEATH,
        event.position.x,
        event.position.y,
        0.6
      );
    }
  }

  /**
   * Handle weapon fired event.
   */
  private onWeaponFired(event: WeaponFiredEvent): void {
    if (!this.config.playWeaponSounds) return;

    // Get appropriate SFX for weapon
    const sfxKey = getWeaponSFX(event.weaponId);

    // Play with spatial audio at weapon position
    this.audioManager.playSFXAt(
      sfxKey,
      event.position.x,
      event.position.y,
      0.7
    );
  }

  /**
   * Handle player level up event.
   */
  private onPlayerLevelUp(_event: PlayerLevelUpEvent): void {
    if (!this.config.playUISounds) return;

    // Play level up fanfare (non-spatial, high priority)
    this.audioManager.playSFX({
      key: SFXKeys.LEVEL_UP,
      volume: 1.0,
      spatial: false,
    });
  }

  /**
   * Handle wave start event.
   */
  private onWaveStart(_event: WaveStartEvent): void {
    if (!this.config.playGameEventSounds) return;

    this.audioManager.playSFX({
      key: SFXKeys.WAVE_START,
      volume: 0.8,
      spatial: false,
    });
  }

  /**
   * Handle boss spawn event.
   */
  private onBossSpawn(event: BossSpawnEvent): void {
    if (!this.config.playGameEventSounds) return;

    // Play boss spawn sound
    this.audioManager.playSFXAt(
      SFXKeys.BOSS_SPAWN,
      event.position.x,
      event.position.y,
      1.0
    );

    // Crossfade to boss music
    this.audioManager.crossfade(
      {
        key: MusicTracks.BOSS.key,
        loop: MusicTracks.BOSS.loop,
        volume: MusicTracks.BOSS.volume,
      },
      1500
    );
  }

  /**
   * Handle game over event.
   */
  private onGameOver(): void {
    if (!this.config.playGameEventSounds) return;

    // Play game over sound
    this.audioManager.playSFX({
      key: SFXKeys.GAME_OVER,
      volume: 1.0,
      spatial: false,
    });

    // Crossfade to game over music
    this.audioManager.crossfade(
      {
        key: MusicTracks.GAMEOVER.key,
        loop: MusicTracks.GAMEOVER.loop,
        volume: MusicTracks.GAMEOVER.volume,
      },
      2000
    );
  }

  /**
   * Handle game win event.
   */
  private onGameWin(): void {
    if (!this.config.playGameEventSounds) return;

    // Play victory sound
    this.audioManager.playSFX({
      key: SFXKeys.VICTORY,
      volume: 1.0,
      spatial: false,
    });

    // Crossfade to victory music
    this.audioManager.crossfade(
      {
        key: MusicTracks.VICTORY.key,
        loop: MusicTracks.VICTORY.loop,
        volume: MusicTracks.VICTORY.volume,
      },
      1000
    );
  }

  /**
   * Handle game pause event.
   */
  private onGamePause(): void {
    this.audioManager.pauseMusic();
  }

  /**
   * Handle game resume event.
   */
  private onGameResume(): void {
    this.audioManager.resumeMusic();
  }

  /**
   * Handle direct play SFX event.
   */
  private onPlaySFX(event: PlaySFXEvent): void {
    if (event.position) {
      this.audioManager.playSFXAt(
        event.sfxId,
        event.position.x,
        event.position.y,
        event.volume
      );
    } else {
      this.audioManager.playSFX({
        key: event.sfxId,
        volume: event.volume,
        pitch: event.pitch,
        spatial: false,
      });
    }
  }

  /**
   * Handle direct play music event.
   */
  private onPlayMusic(event: PlayMusicEvent): void {
    this.audioManager.playMusic({
      key: event.trackId,
      fadeIn: event.fadeIn,
      loop: event.loop,
    });
  }

  /**
   * Handle stop SFX event.
   */
  private onStopSFX(data: unknown): void {
    const id = data as string | undefined;
    if (id) {
      this.audioManager.stopSFX(id);
    } else {
      this.audioManager.stopAllSFX();
    }
  }

  /**
   * Handle stop music event.
   */
  private onStopMusic(data: unknown): void {
    const fadeOut = data as number | undefined;
    this.audioManager.stopMusic(fadeOut);
  }

  /**
   * Schedule frame reset for throttling.
   */
  private scheduleFrameReset(): void {
    if (this.frameResetScheduled) return;

    this.frameResetScheduled = true;
    requestAnimationFrame(() => {
      this.hitSoundsThisFrame = 0;
      this.deathSoundsThisFrame = 0;
      this.frameResetScheduled = false;
    });
  }
}

/**
 * Create and setup AudioEventHandler.
 */
export function createAudioEventHandler(
  audioManager: AudioManager,
  eventBus: IEventBus,
  config?: AudioEventHandlerConfig
): AudioEventHandler {
  return new AudioEventHandler(audioManager, eventBus, config);
}
