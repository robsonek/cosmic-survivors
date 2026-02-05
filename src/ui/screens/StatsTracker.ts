/**
 * StatsTracker for Cosmic Survivors.
 * Tracks game statistics during gameplay for display in StatsScreen.
 */

import type { IEventBus } from '@shared/interfaces/IEventBus';
import { GameEvents, type DamageEvent, type EntityKilledEvent, type WeaponFiredEvent } from '@shared/interfaces/IEventBus';
import type {
  GameStats,
  EnemyKillRecord,
  WeaponUsageRecord,
  DPSDataPoint,
} from './StatsScreen';

/** DPS sampling interval in seconds */
const DPS_SAMPLE_INTERVAL = 5;

/** Maximum combo timeout in seconds */
const COMBO_TIMEOUT = 2;

/**
 * StatsTracker collects game statistics for the StatsScreen.
 * Subscribe to events and call update() each frame.
 */
export class StatsTracker {
  // Core tracking
  private _totalDamageDealt: number = 0;
  private _currentCombo: number = 0;
  private _highestCombo: number = 0;
  private _lastKillTime: number = 0;

  // Enemy kills
  private _enemyKills: Map<string, EnemyKillRecord> = new Map();
  private _totalKills: number = 0;
  private _bossesDefeated: number = 0;

  // Weapon stats
  private _weaponStats: Map<string, WeaponUsageRecord> = new Map();
  private _abilityUses: Map<string, { name: string; uses: number }> = new Map();

  // Movement
  private _distanceTraveled: number = 0;
  private _lastPosition: { x: number; y: number } | null = null;

  // Progression
  private _xpEarned: number = 0;
  private _levelReached: number = 1;
  private _waveReached: number = 1;

  // Time
  private _timeSurvived: number = 0;
  private __gameStartTime: number = 0;

  // Accuracy
  private _totalShots: number = 0;
  private _totalHits: number = 0;

  // DPS tracking
  private _dpsHistory: DPSDataPoint[] = [];
  private _damageInCurrentInterval: number = 0;
  private _lastDPSSampleTime: number = 0;

  // Event subscriptions
  private eventBus: IEventBus | null = null;
  private subscriptions: Array<{ unsubscribe: () => void }> = [];

  constructor() {
    this.__gameStartTime = Date.now();
  }

  /**
   * Initialize tracker with event bus.
   */
  init(eventBus: IEventBus): void {
    this.eventBus = eventBus;
    this.subscribeToEvents();
  }

  /**
   * Subscribe to game events.
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    // Damage events
    this.subscriptions.push(
      this.eventBus.on<DamageEvent>(GameEvents.DAMAGE, (event) => {
        this.recordDamage(event);
      })
    );

    // Kill events
    this.subscriptions.push(
      this.eventBus.on<EntityKilledEvent>(GameEvents.ENTITY_KILLED, (event) => {
        this.recordKill(event);
      })
    );

    // Weapon fired events
    this.subscriptions.push(
      this.eventBus.on<WeaponFiredEvent>(GameEvents.WEAPON_FIRED, (event) => {
        this.recordWeaponFired(event);
      })
    );

    // XP gained
    this.subscriptions.push(
      this.eventBus.on<{ amount: number }>(GameEvents.XP_GAINED, (event) => {
        this._xpEarned += event.amount;
      })
    );

    // Level up
    this.subscriptions.push(
      this.eventBus.on<{ newLevel: number }>(GameEvents.PLAYER_LEVEL_UP, (event) => {
        this._levelReached = Math.max(this._levelReached, event.newLevel);
      })
    );

    // Wave start
    this.subscriptions.push(
      this.eventBus.on<{ waveNumber: number }>(GameEvents.WAVE_START, (event) => {
        this._waveReached = Math.max(this._waveReached, event.waveNumber);
      })
    );

    // Boss spawn/kill (check if entity is boss type in kill event)
    this.subscriptions.push(
      this.eventBus.on<{ bossType: string }>(GameEvents.BOSS_SPAWN, () => {
        // Boss spawned, we track defeat in kill event
      })
    );
  }

  /**
   * Record damage dealt.
   */
  private recordDamage(event: DamageEvent): void {
    // Only track player damage
    this._totalDamageDealt += event.amount;
    this._damageInCurrentInterval += event.amount;
    this._totalHits++;
  }

  /**
   * Record enemy kill.
   */
  private recordKill(event: EntityKilledEvent): void {
    this._totalKills++;

    // Update combo
    const now = Date.now() / 1000;
    if (now - this._lastKillTime < COMBO_TIMEOUT) {
      this._currentCombo++;
    } else {
      this._currentCombo = 1;
    }
    this._highestCombo = Math.max(this._highestCombo, this._currentCombo);
    this._lastKillTime = now;

    // XP tracking is handled by XP_GAINED event
  }

  /**
   * Record weapon fired.
   */
  private recordWeaponFired(event: WeaponFiredEvent): void {
    this._totalShots += event.projectileCount;

    // Update weapon stats
    let weaponStat = this._weaponStats.get(event.weaponId);
    if (!weaponStat) {
      weaponStat = {
        id: event.weaponId,
        name: event.weaponId, // Will be updated with proper name if available
        damageDealt: 0,
        kills: 0,
        shotsFired: 0,
        hits: 0,
        timeUsed: 0,
      };
      this._weaponStats.set(event.weaponId, weaponStat);
    }
    weaponStat.shotsFired += event.projectileCount;

    // Update ability uses
    let abilityUse = this._abilityUses.get(event.weaponId);
    if (!abilityUse) {
      abilityUse = { name: event.weaponId, uses: 0 };
      this._abilityUses.set(event.weaponId, abilityUse);
    }
    abilityUse.uses++;
  }

  /**
   * Record enemy kill by type.
   */
  recordEnemyKill(enemyType: string, displayName: string, isBoss: boolean = false): void {
    let record = this._enemyKills.get(enemyType);
    if (!record) {
      record = {
        type: enemyType,
        count: 0,
        displayName,
      };
      this._enemyKills.set(enemyType, record);
    }
    record.count++;

    if (isBoss) {
      this._bossesDefeated++;
    }
  }

  /**
   * Record weapon damage.
   */
  recordWeaponDamage(weaponId: string, damage: number, isKill: boolean = false): void {
    let weaponStat = this._weaponStats.get(weaponId);
    if (!weaponStat) {
      weaponStat = {
        id: weaponId,
        name: weaponId,
        damageDealt: 0,
        kills: 0,
        shotsFired: 0,
        hits: 0,
        timeUsed: 0,
      };
      this._weaponStats.set(weaponId, weaponStat);
    }
    weaponStat.damageDealt += damage;
    weaponStat.hits++;
    if (isKill) {
      weaponStat.kills++;
    }
  }

  /**
   * Set weapon display name.
   */
  setWeaponName(weaponId: string, name: string): void {
    const weaponStat = this._weaponStats.get(weaponId);
    if (weaponStat) {
      weaponStat.name = name;
    }

    const abilityUse = this._abilityUses.get(weaponId);
    if (abilityUse) {
      abilityUse.name = name;
    }
  }

  /**
   * Update player position for distance tracking.
   */
  updatePosition(x: number, y: number): void {
    if (this._lastPosition) {
      const dx = x - this._lastPosition.x;
      const dy = y - this._lastPosition.y;
      this._distanceTraveled += Math.sqrt(dx * dx + dy * dy);
    }
    this._lastPosition = { x, y };
  }

  /**
   * Update tracker each frame.
   * @param dt Delta time in seconds
   */
  update(dt: number): void {
    this._timeSurvived += dt;

    // Check combo timeout
    const now = Date.now() / 1000;
    if (this._currentCombo > 0 && now - this._lastKillTime > COMBO_TIMEOUT) {
      this._currentCombo = 0;
    }

    // Sample DPS periodically
    if (this._timeSurvived - this._lastDPSSampleTime >= DPS_SAMPLE_INTERVAL) {
      const dps = this._damageInCurrentInterval / DPS_SAMPLE_INTERVAL;
      this._dpsHistory.push({
        time: this._timeSurvived,
        dps,
      });
      this._damageInCurrentInterval = 0;
      this._lastDPSSampleTime = this._timeSurvived;
    }
  }

  /**
   * Get complete game statistics.
   */
  getStats(): GameStats {
    // Calculate accuracy
    const accuracy = this._totalShots > 0
      ? (this._totalHits / this._totalShots) * 100
      : 0;

    // Calculate average and peak DPS
    let averageDPS = 0;
    let peakDPS = 0;
    if (this._dpsHistory.length > 0) {
      const totalDPS = this._dpsHistory.reduce((sum, point) => sum + point.dps, 0);
      averageDPS = totalDPS / this._dpsHistory.length;
      peakDPS = Math.max(...this._dpsHistory.map(p => p.dps));
    } else if (this._timeSurvived > 0) {
      averageDPS = this._totalDamageDealt / this._timeSurvived;
      peakDPS = averageDPS;
    }

    // Find most used ability
    let mostUsedAbility: { id: string; name: string; uses: number } | null = null;
    let maxUses = 0;
    this._abilityUses.forEach((ability, id) => {
      if (ability.uses > maxUses) {
        maxUses = ability.uses;
        mostUsedAbility = { id, name: ability.name, uses: ability.uses };
      }
    });

    return {
      totalDamageDealt: this._totalDamageDealt,
      highestCombo: this._highestCombo,
      enemiesKilledByType: Array.from(this._enemyKills.values()),
      totalEnemiesKilled: this._totalKills,
      weaponsUsed: Array.from(this._weaponStats.values()),
      mostUsedAbility,
      distanceTraveled: this._distanceTraveled,
      xpEarned: this._xpEarned,
      levelReached: this._levelReached,
      timeSurvived: this._timeSurvived,
      totalShots: this._totalShots,
      totalHits: this._totalHits,
      accuracy,
      dpsHistory: this._dpsHistory,
      averageDPS,
      peakDPS,
      waveReached: this._waveReached,
      bossesDefeated: this._bossesDefeated,
    };
  }

  /**
   * Reset all statistics.
   */
  reset(): void {
    this._totalDamageDealt = 0;
    this._currentCombo = 0;
    this._highestCombo = 0;
    this._lastKillTime = 0;
    this._enemyKills.clear();
    this._totalKills = 0;
    this._bossesDefeated = 0;
    this._weaponStats.clear();
    this._abilityUses.clear();
    this._distanceTraveled = 0;
    this._lastPosition = null;
    this._xpEarned = 0;
    this._levelReached = 1;
    this._waveReached = 1;
    this._timeSurvived = 0;
    this.__gameStartTime = Date.now();
    this._totalShots = 0;
    this._totalHits = 0;
    this._dpsHistory = [];
    this._damageInCurrentInterval = 0;
    this._lastDPSSampleTime = 0;
  }

  /**
   * Cleanup and unsubscribe from events.
   */
  destroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.eventBus = null;
  }

  // Getters for current values
  get currentCombo(): number {
    return this._currentCombo;
  }

  get totalKills(): number {
    return this._totalKills;
  }

  get totalDamage(): number {
    return this._totalDamageDealt;
  }

  get timeSurvived(): number {
    return this._timeSurvived;
  }
}

/**
 * Create a new StatsTracker instance.
 */
export function createStatsTracker(): StatsTracker {
  return new StatsTracker();
}
