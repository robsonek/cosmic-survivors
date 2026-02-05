/**
 * SFXTriggers - Sound effect trigger system for game events.
 *
 * Centralizes all sound effect triggering in one place. Listens to game events
 * and plays appropriate sounds through AudioManager.
 *
 * Features:
 * - Weapon fire sounds (per weapon type)
 * - Combat sounds (hit, death, critical)
 * - Progression sounds (level up, combo milestones)
 * - Pickup sounds (XP, health, power-ups)
 * - Boss and wave sounds
 * - Player ability sounds (dash, ultimate)
 * - UI sounds
 */

import type { IEventBus, ISubscription } from '../shared/interfaces/IEventBus';
import {
  GameEvents,
  DamageEvent,
  EntityKilledEvent,
  WeaponFiredEvent,
  PlayerLevelUpEvent,
  WaveStartEvent,
  WaveCompleteEvent,
  BossSpawnEvent,
} from '../shared/interfaces/IEventBus';
import type { AudioManager } from './AudioManager';
import { SFXKeys, getWeaponSFX } from './SFXDefinitions';

// ============================================
// Extended SFX Keys for new sounds
// ============================================

/**
 * Extended SFX keys beyond the base definitions.
 * These are placeholder IDs that can be hooked to actual assets.
 */
export const ExtendedSFXKeys = {
  // Combo milestones - escalating sounds
  COMBO_10: 'sfx_combo_10',
  COMBO_25: 'sfx_combo_25',
  COMBO_50: 'sfx_combo_50',
  COMBO_100: 'sfx_combo_100',
  COMBO_BREAK: 'sfx_combo_break',

  // Ultimate/special abilities
  ULTIMATE_ACTIVATE: 'sfx_ultimate_activate',
  ULTIMATE_CHARGE: 'sfx_ultimate_charge',

  // Power-up specific
  POWERUP_RARE: 'sfx_powerup_rare',
  POWERUP_EPIC: 'sfx_powerup_epic',
  POWERUP_LEGENDARY: 'sfx_powerup_legendary',

  // Boss-related
  BOSS_WARNING: 'sfx_boss_warning',
  BOSS_PHASE_CHANGE: 'sfx_boss_phase',
  BOSS_DEATH: 'sfx_boss_death',

  // Shield
  SHIELD_ACTIVATE: 'sfx_shield_activate',
  SHIELD_HIT: 'sfx_shield_hit',
  SHIELD_BREAK: 'sfx_shield_break',

  // Environment
  ARENA_HAZARD: 'sfx_hazard',
  ARENA_SHRINK: 'sfx_arena_shrink',
} as const;

export type ExtendedSFXKey = (typeof ExtendedSFXKeys)[keyof typeof ExtendedSFXKeys];

// ============================================
// Combo System Interface
// ============================================

/**
 * Combo state for milestone tracking.
 */
interface ComboState {
  count: number;
  lastHitTime: number;
  lastMilestone: number;
}

// Combo thresholds for sound escalation
const COMBO_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

// ============================================
// SFXTriggers Class
// ============================================

/**
 * SFXTriggers - Central sound trigger coordinator.
 */
export class SFXTriggers {
  /** Audio manager reference */
  private audioManager: AudioManager;

  /** Event bus reference */
  private eventBus: IEventBus;

  /** Active subscriptions for cleanup */
  private subscriptions: ISubscription[] = [];

  /** Combo tracking per player */
  private playerCombos: Map<number, ComboState> = new Map();

  /** Combo timeout in seconds */
  private readonly comboTimeout = 3.0;

  /** Kill streak tracking */
  private playerKillStreaks: Map<number, number> = new Map();

  /** Whether system is enabled */
  private enabled = true;

  constructor(audioManager: AudioManager, eventBus: IEventBus) {
    this.audioManager = audioManager;
    this.eventBus = eventBus;

    // Register extended SFX keys
    this.registerExtendedSFX();

    // Subscribe to all game events
    this.setupSubscriptions();
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Register extended SFX keys with the audio manager.
   */
  private registerExtendedSFX(): void {
    for (const key of Object.values(ExtendedSFXKeys)) {
      this.audioManager.registerSFX(key);
    }
  }

  /**
   * Setup all event subscriptions.
   */
  private setupSubscriptions(): void {
    // Combat events
    this.subscriptions.push(
      this.eventBus.on<DamageEvent>(GameEvents.DAMAGE, (e) => this.onDamage(e))
    );
    this.subscriptions.push(
      this.eventBus.on<EntityKilledEvent>(GameEvents.ENTITY_KILLED, (e) => this.onEntityKilled(e))
    );
    this.subscriptions.push(
      this.eventBus.on<WeaponFiredEvent>(GameEvents.WEAPON_FIRED, (e) => this.onWeaponFired(e))
    );

    // Progression events
    this.subscriptions.push(
      this.eventBus.on<PlayerLevelUpEvent>(GameEvents.PLAYER_LEVEL_UP, (e) => this.onLevelUp(e))
    );
    this.subscriptions.push(
      this.eventBus.on(GameEvents.UPGRADE_SELECTED, () => this.onUpgradeSelected())
    );
    this.subscriptions.push(
      this.eventBus.on(GameEvents.XP_GAINED, () => this.onXPGained())
    );

    // Wave events
    this.subscriptions.push(
      this.eventBus.on<WaveStartEvent>(GameEvents.WAVE_START, (e) => this.onWaveStart(e))
    );
    this.subscriptions.push(
      this.eventBus.on<WaveCompleteEvent>(GameEvents.WAVE_COMPLETE, (e) => this.onWaveComplete(e))
    );
    this.subscriptions.push(
      this.eventBus.on<BossSpawnEvent>(GameEvents.BOSS_SPAWN, (e) => this.onBossSpawn(e))
    );

    // Game state events
    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_OVER, () => this.onGameOver())
    );
    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_WIN, () => this.onGameWin())
    );
    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_PAUSE, () => this.onGamePause())
    );
    this.subscriptions.push(
      this.eventBus.on(GameEvents.GAME_RESUME, () => this.onGameResume())
    );

    // Pickup events (custom events from PickupSystem)
    this.subscriptions.push(
      this.eventBus.on<{ type: string; value: number }>('pickup:collected', (e) => this.onPickupCollected(e))
    );
    this.subscriptions.push(
      this.eventBus.on<{ type: string }>('pickup:specialEffect', (e) => this.onSpecialEffect(e))
    );
  }

  // ============================================
  // Combat Sound Handlers
  // ============================================

  /**
   * Handle damage event - play hit sounds.
   */
  private onDamage(event: DamageEvent): void {
    if (!this.enabled) return;

    const { target, amount, isCritical, position } = event;

    // Determine if target is player or enemy
    // We'll check by looking at the target entity (simplified check)
    const isPlayerHit = this.isPlayerEntity(target);

    if (isPlayerHit) {
      // Player took damage
      this.playPlayerHitSound(amount, position);
    } else {
      // Enemy took damage
      this.playEnemyHitSound(isCritical, position);

      // Update combo
      this.incrementCombo(event.source);
    }
  }

  /**
   * Play player hit sound.
   */
  private playPlayerHitSound(
    amount: number,
    position: { x: number; y: number }
  ): void {
    // Volume scales with damage taken
    const volumeScale = Math.min(1, amount / 50);
    this.audioManager.playSFX({
      key: SFXKeys.HIT_PLAYER,
      volume: 0.6 + volumeScale * 0.4,
    });

    // For heavy hits, also play hurt sound
    if (amount >= 30) {
      this.audioManager.playSFX({
        key: SFXKeys.PLAYER_HURT,
        volume: 0.7,
      });
    }
  }

  /**
   * Play enemy hit sound with spatial audio.
   */
  private playEnemyHitSound(
    isCritical: boolean,
    position: { x: number; y: number }
  ): void {
    if (isCritical) {
      // Critical hit - distinctive sound
      this.audioManager.playSFXAt(SFXKeys.CRITICAL_HIT, position.x, position.y, 0.7);
    } else {
      // Normal hit
      this.audioManager.playSFXAt(SFXKeys.HIT_ENEMY, position.x, position.y, 0.4);
    }
  }

  /**
   * Handle entity killed event.
   */
  private onEntityKilled(event: EntityKilledEvent): void {
    if (!this.enabled) return;

    const { entity, killer, position, xpValue } = event;
    const isPlayer = this.isPlayerEntity(entity);

    if (isPlayer) {
      // Player died
      this.audioManager.playSFX({
        key: SFXKeys.PLAYER_DEATH,
        volume: 1.0,
      });
    } else {
      // Enemy died
      const isBoss = xpValue >= 50; // Bosses give lots of XP

      if (isBoss) {
        this.audioManager.playSFX({
          key: ExtendedSFXKeys.BOSS_DEATH,
          volume: 1.0,
        });
      } else {
        this.audioManager.playSFXAt(SFXKeys.ENEMY_DEATH, position.x, position.y, 0.5);
      }

      // Update kill streak
      this.incrementKillStreak(killer);
    }
  }

  /**
   * Handle weapon fired event - play weapon-specific sounds.
   */
  private onWeaponFired(event: WeaponFiredEvent): void {
    if (!this.enabled) return;

    const { weaponId, position, projectileCount } = event;

    // Get weapon-specific SFX
    const sfxKey = getWeaponSFX(weaponId);

    // Volume slightly increases with projectile count
    const volumeBonus = Math.min(0.3, (projectileCount - 1) * 0.05);

    this.audioManager.playSFXAt(sfxKey, position.x, position.y, 0.6 + volumeBonus);
  }

  // ============================================
  // Progression Sound Handlers
  // ============================================

  /**
   * Handle level up event - triumphant sound.
   */
  private onLevelUp(event: PlayerLevelUpEvent): void {
    if (!this.enabled) return;

    // Play level up sound
    this.audioManager.playSFX({
      key: SFXKeys.LEVEL_UP,
      volume: 0.9,
    });

    // Extra fanfare for milestone levels
    if (event.newLevel % 10 === 0) {
      // Every 10 levels gets extra celebration
      this.audioManager.playSFX({
        key: ExtendedSFXKeys.POWERUP_EPIC,
        volume: 0.7,
        delay: 200,
      });
    }
  }

  /**
   * Handle upgrade selected.
   */
  private onUpgradeSelected(): void {
    if (!this.enabled) return;

    this.audioManager.playSFX({
      key: SFXKeys.UPGRADE_SELECT,
      volume: 0.7,
    });
  }

  /**
   * Handle XP gained - subtle collect sound.
   */
  private onXPGained(): void {
    // XP pickup sound handled in onPickupCollected
    // This is for other XP sources (wave bonus, etc.)
  }

  // ============================================
  // Wave Sound Handlers
  // ============================================

  /**
   * Handle wave start.
   */
  private onWaveStart(event: WaveStartEvent): void {
    if (!this.enabled) return;

    this.audioManager.playSFX({
      key: SFXKeys.WAVE_START,
      volume: 0.8,
    });
  }

  /**
   * Handle wave complete.
   */
  private onWaveComplete(event: WaveCompleteEvent): void {
    if (!this.enabled) return;

    this.audioManager.playSFX({
      key: SFXKeys.WAVE_COMPLETE,
      volume: 0.8,
    });
  }

  /**
   * Handle boss spawn - dramatic warning.
   */
  private onBossSpawn(event: BossSpawnEvent): void {
    if (!this.enabled) return;

    // Warning sound first
    this.audioManager.playSFX({
      key: ExtendedSFXKeys.BOSS_WARNING,
      volume: 0.9,
    });

    // Then spawn sound after brief delay
    this.audioManager.playSFX({
      key: SFXKeys.BOSS_SPAWN,
      volume: 1.0,
      delay: 500,
    });
  }

  // ============================================
  // Pickup Sound Handlers
  // ============================================

  /**
   * Handle pickup collected.
   */
  private onPickupCollected(event: { type: string; value: number }): void {
    if (!this.enabled) return;

    switch (event.type) {
      case 'xp_orb':
      case 'XPOrb':
        // Satisfying XP collect sound with pitch variation based on value
        this.audioManager.playSFX({
          key: SFXKeys.PICKUP_XP,
          volume: 0.3 + Math.min(0.3, event.value / 50),
          pitch: 0.9 + Math.min(0.4, event.value / 100),
        });
        break;

      case 'health':
      case 'Health':
        this.audioManager.playSFX({
          key: SFXKeys.PICKUP_HEALTH,
          volume: 0.7,
        });
        // Extra healing sound
        this.audioManager.playSFX({
          key: SFXKeys.PLAYER_HEAL,
          volume: 0.5,
          delay: 100,
        });
        break;

      case 'chest':
      case 'Chest':
        this.audioManager.playSFX({
          key: SFXKeys.PICKUP_CHEST,
          volume: 0.9,
        });
        break;

      case 'magnet':
      case 'Magnet':
        this.audioManager.playSFX({
          key: SFXKeys.PICKUP_MAGNET,
          volume: 0.7,
        });
        break;

      case 'coin':
      case 'Gold':
        this.audioManager.playSFX({
          key: SFXKeys.PICKUP_COIN,
          volume: 0.5,
        });
        break;

      default:
        // Generic power-up sound
        this.audioManager.playSFX({
          key: SFXKeys.UI_CONFIRM,
          volume: 0.5,
        });
    }
  }

  /**
   * Handle special effect triggered.
   */
  private onSpecialEffect(event: { type: string }): void {
    if (!this.enabled) return;

    switch (event.type) {
      case 'magnet':
        // Whoosh sound for all XP flying in
        this.audioManager.playSFX({
          key: SFXKeys.PICKUP_MAGNET,
          volume: 0.8,
        });
        break;

      case 'bomb':
        this.audioManager.playSFX({
          key: SFXKeys.EXPLOSION,
          volume: 1.0,
        });
        break;

      case 'clock':
        // Time freeze effect sound
        this.audioManager.playSFX({
          key: ExtendedSFXKeys.ARENA_HAZARD,
          volume: 0.7,
        });
        break;
    }
  }

  // ============================================
  // Game State Sound Handlers
  // ============================================

  /**
   * Handle game over.
   */
  private onGameOver(): void {
    this.audioManager.playSFX({
      key: SFXKeys.GAME_OVER,
      volume: 0.9,
    });
  }

  /**
   * Handle game win.
   */
  private onGameWin(): void {
    this.audioManager.playSFX({
      key: SFXKeys.VICTORY,
      volume: 1.0,
    });
  }

  /**
   * Handle game pause.
   */
  private onGamePause(): void {
    // Optional: play pause sound
    this.audioManager.playSFX({
      key: SFXKeys.UI_CLICK,
      volume: 0.4,
    });
  }

  /**
   * Handle game resume.
   */
  private onGameResume(): void {
    this.audioManager.playSFX({
      key: SFXKeys.UI_CONFIRM,
      volume: 0.4,
    });
  }

  // ============================================
  // Direct Trigger Methods (for GameScene)
  // ============================================

  /**
   * Play dash whoosh sound.
   */
  playDash(x: number, y: number): void {
    if (!this.enabled) return;
    this.audioManager.playSFXAt(SFXKeys.DASH, x, y, 0.7);
  }

  /**
   * Play ultimate activation sound.
   */
  playUltimateActivation(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: ExtendedSFXKeys.ULTIMATE_ACTIVATE,
      volume: 1.0,
    });
  }

  /**
   * Play shield activation sound.
   */
  playShieldActivation(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: ExtendedSFXKeys.SHIELD_ACTIVATE,
      volume: 0.8,
    });
  }

  /**
   * Play shield hit sound.
   */
  playShieldHit(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: ExtendedSFXKeys.SHIELD_HIT,
      volume: 0.6,
    });
  }

  /**
   * Play shield break sound.
   */
  playShieldBreak(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: ExtendedSFXKeys.SHIELD_BREAK,
      volume: 0.8,
    });
  }

  /**
   * Play UI click sound.
   */
  playUIClick(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: SFXKeys.UI_CLICK,
      volume: 0.5,
    });
  }

  /**
   * Play UI hover sound.
   */
  playUIHover(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: SFXKeys.UI_HOVER,
      volume: 0.3,
    });
  }

  /**
   * Play UI back/cancel sound.
   */
  playUIBack(): void {
    if (!this.enabled) return;
    this.audioManager.playSFX({
      key: SFXKeys.UI_BACK,
      volume: 0.5,
    });
  }

  /**
   * Play explosion sound at position.
   */
  playExplosion(x: number, y: number, volume: number = 0.8): void {
    if (!this.enabled) return;
    this.audioManager.playSFXAt(SFXKeys.EXPLOSION, x, y, volume);
  }

  // ============================================
  // Combo System
  // ============================================

  /**
   * Increment combo count and play milestone sounds.
   */
  private incrementCombo(playerEntity: number): void {
    const now = performance.now() / 1000;
    let combo = this.playerCombos.get(playerEntity);

    if (!combo) {
      combo = { count: 0, lastHitTime: 0, lastMilestone: 0 };
      this.playerCombos.set(playerEntity, combo);
    }

    // Check if combo should reset
    if (now - combo.lastHitTime > this.comboTimeout) {
      if (combo.count >= 10) {
        // Play combo break sound
        this.audioManager.playSFX({
          key: ExtendedSFXKeys.COMBO_BREAK,
          volume: 0.5,
        });
      }
      combo.count = 0;
      combo.lastMilestone = 0;
    }

    combo.count++;
    combo.lastHitTime = now;

    // Check for milestones
    this.checkComboMilestone(combo);
  }

  /**
   * Check and play combo milestone sound.
   */
  private checkComboMilestone(combo: ComboState): void {
    for (const milestone of COMBO_MILESTONES) {
      if (combo.count >= milestone && combo.lastMilestone < milestone) {
        combo.lastMilestone = milestone;
        this.playComboMilestone(milestone);
        break;
      }
    }
  }

  /**
   * Play escalating combo milestone sound.
   */
  private playComboMilestone(milestone: number): void {
    let sfxKey: string;
    let volume = 0.6;

    switch (milestone) {
      case 10:
        sfxKey = ExtendedSFXKeys.COMBO_10;
        volume = 0.5;
        break;
      case 25:
        sfxKey = ExtendedSFXKeys.COMBO_25;
        volume = 0.6;
        break;
      case 50:
        sfxKey = ExtendedSFXKeys.COMBO_50;
        volume = 0.7;
        break;
      case 100:
        sfxKey = ExtendedSFXKeys.COMBO_100;
        volume = 0.8;
        break;
      default:
        // For higher milestones, use combo_100 with higher pitch
        sfxKey = ExtendedSFXKeys.COMBO_100;
        volume = 0.9;
    }

    this.audioManager.playSFX({
      key: sfxKey,
      volume,
      pitch: 1 + (milestone / 500), // Escalating pitch
    });
  }

  /**
   * Get current combo count for player.
   */
  getComboCount(playerEntity: number): number {
    return this.playerCombos.get(playerEntity)?.count ?? 0;
  }

  // ============================================
  // Kill Streak System
  // ============================================

  /**
   * Increment kill streak.
   */
  private incrementKillStreak(playerEntity: number): void {
    const current = this.playerKillStreaks.get(playerEntity) ?? 0;
    this.playerKillStreaks.set(playerEntity, current + 1);
  }

  /**
   * Reset kill streak for player.
   */
  resetKillStreak(playerEntity: number): void {
    this.playerKillStreaks.set(playerEntity, 0);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Simple check if entity is a player.
   * In a real implementation, this would check ECS components.
   */
  private isPlayerEntity(entity: number): boolean {
    // Placeholder - would check Tags.Player component
    // For now, assume low entity IDs are players
    return entity < 10;
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Enable/disable the trigger system.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if system is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Update system (call each frame for combo timeout checks).
   */
  update(_dt: number): void {
    // Combo timeout is handled in incrementCombo
    // Could add additional time-based effects here
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.playerCombos.clear();
    this.playerKillStreaks.clear();
  }

  /**
   * Clean up subscriptions.
   */
  destroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
    this.playerCombos.clear();
    this.playerKillStreaks.clear();
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create SFX trigger system.
 */
export function createSFXTriggers(
  audioManager: AudioManager,
  eventBus: IEventBus
): SFXTriggers {
  return new SFXTriggers(audioManager, eventBus);
}

// ============================================
// Singleton Access
// ============================================

let sfxTriggersInstance: SFXTriggers | null = null;

/**
 * Get or create SFXTriggers singleton.
 */
export function getSFXTriggers(
  audioManager?: AudioManager,
  eventBus?: IEventBus
): SFXTriggers | null {
  if (!sfxTriggersInstance && audioManager && eventBus) {
    sfxTriggersInstance = new SFXTriggers(audioManager, eventBus);
  }
  return sfxTriggersInstance;
}

/**
 * Reset SFXTriggers singleton.
 */
export function resetSFXTriggers(): void {
  if (sfxTriggersInstance) {
    sfxTriggersInstance.destroy();
    sfxTriggersInstance = null;
  }
}
