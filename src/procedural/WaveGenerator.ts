/**
 * WaveGenerator - Procedural wave generation system.
 *
 * Generates enemy waves based on:
 * - Wave number
 * - Player count
 * - Difficulty level
 * - Wave templates
 *
 * Implements IWaveGenerator interface.
 */

import type { IWaveGenerator, IWaveDefinition } from '../shared/interfaces/IProcedural';
import type { ISpawnConfig } from '../shared/interfaces/IAI';
import { SpawnPosition, SpawnFormation } from '../shared/interfaces/IAI';
import type { IEventBus } from '../shared/interfaces/IEventBus';
import {
  GameEvents,
  type WaveStartEvent,
  type WaveCompleteEvent,
  type BossSpawnEvent,
} from '../shared/interfaces/IEventBus';
import {
  getWaveTemplate,
  getBossWaveConfig,
  isBossWave,
  selectEnemyFromPool,
  calculateEnemyCount,
  getModifierMultipliers,
  type EnemyPoolEntry,
} from './WaveDefinitions';
import { DifficultyScaler } from './DifficultyScaler';
import {
  WAVE_START_DELAY,
  WAVE_INTERVAL,
  MAX_WAVE_DURATION,
} from '../shared/constants/game';

/**
 * Seeded random number generator for deterministic wave generation.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate next random number [0, 1).
   */
  next(): number {
    // Mulberry32 algorithm
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Reset seed.
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }
}

/**
 * WaveGenerator implementation.
 */
export class WaveGenerator implements IWaveGenerator {
  /** Current wave number */
  private _currentWave = 0;

  /** Time elapsed in current wave */
  private _waveTime = 0;

  /** Whether a wave is currently active */
  private _isWaveActive = false;

  /** Total game time */
  private _gameTime = 0;

  /** Current wave definition */
  private currentWaveDefinition: IWaveDefinition | null = null;

  /** Event bus for emitting events */
  private eventBus: IEventBus;

  /** Difficulty scaler reference */
  private difficultyScaler: DifficultyScaler;

  /** Seeded random generator */
  private random: SeededRandom;

  /** Player count */
  private playerCount = 1;

  /** Enemies killed in current wave */
  private enemiesKilledInWave = 0;

  /** Time between waves */
  private waveInterval: number = WAVE_INTERVAL;

  /** Time until next wave starts */
  private nextWaveTimer = 0;

  /** Boss spawn scheduled */
  private bossSpawnScheduled = false;
  private bossSpawnTimer = 0;
  private scheduledBossId: string | null = null;

  constructor(
    eventBus: IEventBus,
    difficultyScaler: DifficultyScaler,
    seed: number = Date.now()
  ) {
    this.eventBus = eventBus;
    this.difficultyScaler = difficultyScaler;
    this.random = new SeededRandom(seed);
  }

  // ============================================
  // IWaveGenerator Implementation
  // ============================================

  get currentWave(): number {
    return this._currentWave;
  }

  get waveTime(): number {
    return this._waveTime;
  }

  get isWaveActive(): boolean {
    return this._isWaveActive;
  }

  get gameTime(): number {
    return this._gameTime;
  }

  /**
   * Generate wave definition.
   */
  generateWave(waveNumber: number, playerCount: number, difficulty: number): IWaveDefinition {
    // Get template for this wave
    const template = getWaveTemplate(waveNumber);
    const bossConfig = getBossWaveConfig(waveNumber);
    const isBoss = isBossWave(waveNumber);

    // Calculate enemy count
    const baseCount = calculateEnemyCount(waveNumber, playerCount, difficulty);

    // Get modifier multipliers
    const modifiers = template.modifiers ?? [];
    const modMults = getModifierMultipliers(modifiers);

    // Generate spawn configurations
    const spawns = this.generateSpawnConfigs(
      template.enemyPool,
      Math.floor(baseCount * modMults.count),
      template.eliteChance,
      template.spawnPosition ?? SpawnPosition.EdgeOfScreen,
      template.formation
    );

    // Calculate XP bonus
    let xpBonus = template.xpBonus ?? waveNumber * 10;
    if (isBoss && bossConfig) {
      xpBonus += bossConfig.xpBonus;
    }

    // Build wave definition
    const waveDefinition: IWaveDefinition = {
      waveNumber,
      duration: MAX_WAVE_DURATION,
      spawns,
      modifiers,
      xpBonus,
    };

    // Add boss spawn if boss wave
    if (isBoss && bossConfig) {
      waveDefinition.boss = {
        bossId: bossConfig.bossId,
        spawnTime: bossConfig.bossSpawnDelay,
      };

      // Add support enemies
      const supportSpawns = this.generateSpawnConfigs(
        bossConfig.supportPool,
        bossConfig.supportCount,
        0.2, // Higher elite chance for boss support
        SpawnPosition.EdgeOfScreen
      );
      waveDefinition.spawns.push(...supportSpawns);
    }

    return waveDefinition;
  }

  /**
   * Start next wave.
   */
  startNextWave(): void {
    this._currentWave++;
    this._waveTime = 0;
    this._isWaveActive = true;
    this.enemiesKilledInWave = 0;
    this.bossSpawnScheduled = false;
    this.bossSpawnTimer = 0;
    this.scheduledBossId = null;

    // Generate wave definition
    this.currentWaveDefinition = this.generateWave(
      this._currentWave,
      this.playerCount,
      this.difficultyScaler.difficulty
    );

    // Schedule boss spawn if needed
    if (this.currentWaveDefinition.boss) {
      this.bossSpawnScheduled = true;
      this.bossSpawnTimer = this.currentWaveDefinition.boss.spawnTime;
      this.scheduledBossId = this.currentWaveDefinition.boss.bossId;
    }

    // Emit wave start event
    const enemyTypes = [...new Set(this.currentWaveDefinition.spawns.map(s => s.enemyId))];
    const totalEnemies = this.currentWaveDefinition.spawns.reduce((sum, s) => sum + s.count, 0);

    this.eventBus.emit<WaveStartEvent>(GameEvents.WAVE_START, {
      waveNumber: this._currentWave,
      enemyTypes,
      totalEnemies,
      duration: this.currentWaveDefinition.duration,
    });
  }

  /**
   * End current wave.
   */
  endWave(): void {
    if (!this._isWaveActive) return;

    this._isWaveActive = false;

    // Emit wave complete event
    if (this.currentWaveDefinition) {
      this.eventBus.emit<WaveCompleteEvent>(GameEvents.WAVE_COMPLETE, {
        waveNumber: this._currentWave,
        enemiesKilled: this.enemiesKilledInWave,
        timeElapsed: this._waveTime,
        bonusXP: this.currentWaveDefinition.xpBonus,
      });
    }

    // Start timer for next wave
    this.nextWaveTimer = this.waveInterval;
  }

  /**
   * Update wave state.
   */
  update(dt: number): void {
    this._gameTime += dt;

    if (this._isWaveActive) {
      this._waveTime += dt;

      // Handle boss spawn
      if (this.bossSpawnScheduled) {
        this.bossSpawnTimer -= dt;
        if (this.bossSpawnTimer <= 0 && this.scheduledBossId) {
          this.spawnBoss(this.scheduledBossId);
          this.bossSpawnScheduled = false;
        }
      }

      // Check for wave timeout
      if (this.currentWaveDefinition && this._waveTime >= this.currentWaveDefinition.duration) {
        this.endWave();
      }
    } else {
      // Between waves
      if (this.nextWaveTimer > 0) {
        this.nextWaveTimer -= dt;
        if (this.nextWaveTimer <= 0) {
          this.startNextWave();
        }
      }
    }
  }

  /**
   * Get current wave definition.
   */
  getCurrentWave(): IWaveDefinition | null {
    return this.currentWaveDefinition;
  }

  /**
   * Check if wave is a boss wave.
   */
  isBossWave(waveNumber: number): boolean {
    return isBossWave(waveNumber);
  }

  // ============================================
  // Additional Methods
  // ============================================

  /**
   * Set player count for scaling.
   */
  setPlayerCount(count: number): void {
    this.playerCount = Math.max(1, count);
  }

  /**
   * Set wave interval.
   */
  setWaveInterval(seconds: number): void {
    this.waveInterval = seconds;
  }

  /**
   * Record enemy kill in current wave.
   */
  recordEnemyKill(): void {
    this.enemiesKilledInWave++;
  }

  /**
   * Get spawns for current wave.
   */
  getSpawns(): ISpawnConfig[] {
    return this.currentWaveDefinition?.spawns ?? [];
  }

  /**
   * Get time until next wave.
   */
  getTimeUntilNextWave(): number {
    return this._isWaveActive ? 0 : Math.max(0, this.nextWaveTimer);
  }

  /**
   * Start the first wave (with initial delay).
   */
  startGame(): void {
    this._currentWave = 0;
    this._gameTime = 0;
    this.nextWaveTimer = WAVE_START_DELAY;
    this._isWaveActive = false;
  }

  /**
   * Reset wave generator.
   */
  reset(): void {
    this._currentWave = 0;
    this._waveTime = 0;
    this._gameTime = 0;
    this._isWaveActive = false;
    this.currentWaveDefinition = null;
    this.nextWaveTimer = 0;
    this.enemiesKilledInWave = 0;
    this.bossSpawnScheduled = false;
    this.bossSpawnTimer = 0;
    this.scheduledBossId = null;
  }

  /**
   * Set random seed for deterministic generation.
   */
  setSeed(seed: number): void {
    this.random.setSeed(seed);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Generate spawn configurations from enemy pool.
   */
  private generateSpawnConfigs(
    pool: EnemyPoolEntry[],
    totalCount: number,
    eliteChance: number,
    spawnPosition: SpawnPosition,
    formation?: SpawnFormation
  ): ISpawnConfig[] {
    const spawns: ISpawnConfig[] = [];
    const enemyCounts: Map<string, number> = new Map();

    // Distribute enemies based on weights
    for (let i = 0; i < totalCount; i++) {
      const enemyId = selectEnemyFromPool(pool, () => this.random.next());
      enemyCounts.set(enemyId, (enemyCounts.get(enemyId) ?? 0) + 1);
    }

    // Create spawn configs
    for (const [enemyId, count] of enemyCounts) {
      // Check for elite conversion
      let eliteCount = 0;
      if (eliteChance > 0) {
        for (let i = 0; i < count; i++) {
          if (this.random.next() < eliteChance) {
            eliteCount++;
          }
        }
      }

      const normalCount = count - eliteCount;

      // Add normal enemies
      if (normalCount > 0) {
        spawns.push({
          enemyId,
          count: normalCount,
          spawnPosition,
          formation: formation ?? SpawnFormation.None,
          spawnAsGroup: normalCount > 1,
          spawnDelay: 0.1,
        });
      }

      // Add elite enemies (using ogre for now as elite variant)
      if (eliteCount > 0 && enemyId !== 'ogre') {
        spawns.push({
          enemyId: 'ogre', // TODO: Use proper elite variant system
          count: Math.ceil(eliteCount / 2), // Fewer but stronger
          spawnPosition,
          formation: SpawnFormation.None,
          spawnDelay: 0.5,
        });
      }
    }

    return spawns;
  }

  /**
   * Spawn boss and emit event.
   */
  private spawnBoss(bossId: string): void {
    // Emit boss spawn event (actual spawning handled by game systems)
    this.eventBus.emit<BossSpawnEvent>(GameEvents.BOSS_SPAWN, {
      bossType: bossId,
      position: { x: 0, y: 0 }, // Position determined by SpawnManager
      entity: -1, // Entity created by SpawnManager
    });
  }
}

/**
 * Create wave generator with event bus and difficulty scaler.
 */
export function createWaveGenerator(
  eventBus: IEventBus,
  difficultyScaler?: DifficultyScaler,
  seed?: number
): WaveGenerator {
  const scaler = difficultyScaler ?? new DifficultyScaler();
  return new WaveGenerator(eventBus, scaler, seed);
}
