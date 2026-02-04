/**
 * XPSystem - Experience point management system.
 *
 * Handles:
 * - XP required per level calculation
 * - Level up progression
 * - XP orb collection
 * - XP magnet functionality
 * - Multiplayer shared XP (optional)
 *
 * Uses scaling formula: baseXP * level^1.15
 */

import type { IEventBus } from '../shared/interfaces/IEventBus';
import { GameEvents, type PlayerLevelUpEvent } from '../shared/interfaces/IEventBus';
import { PLAYER_XP_SCALING } from '../shared/constants/game';

/**
 * XP system configuration.
 */
export interface XPSystemConfig {
  /** Base XP required for level 2 */
  baseXP: number;
  /** Scaling exponent per level */
  scalingExponent: number;
  /** Maximum player level */
  maxLevel: number;
  /** Whether to share XP in multiplayer */
  sharedXP: boolean;
  /** XP share percentage in multiplayer (0-1) */
  sharePercentage: number;
}

/** Default configuration */
const DEFAULT_CONFIG: XPSystemConfig = {
  baseXP: 100,
  scalingExponent: PLAYER_XP_SCALING,
  maxLevel: 999,
  sharedXP: false,
  sharePercentage: 0.5,
};

/**
 * Player XP state.
 */
export interface PlayerXPState {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
}

/**
 * XP gain event data.
 */
export interface XPGainEvent {
  entity: number;
  amount: number;
  source: 'enemy' | 'orb' | 'wave_bonus' | 'shared';
}

/**
 * XPSystem class for managing experience points.
 */
export class XPSystem {
  /** Configuration */
  private config: XPSystemConfig;

  /** Event bus for level up events */
  private eventBus: IEventBus;

  /** Cached XP requirements per level */
  private xpRequirements: Map<number, number> = new Map();

  /** Player XP states */
  private playerStates: Map<number, PlayerXPState> = new Map();

  /** Upgrade pool for level up choices (injected) */
  private upgradePool?: { getUpgradeChoices(entity: number, count: number): string[] };

  constructor(eventBus: IEventBus, config: Partial<XPSystemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = eventBus;

    // Pre-calculate XP requirements for first 100 levels
    for (let level = 1; level <= 100; level++) {
      this.xpRequirements.set(level, this.calculateXPForLevel(level));
    }
  }

  // ============================================
  // Core XP Methods
  // ============================================

  /**
   * Calculate XP required for a specific level.
   * Formula: baseXP * level^scalingExponent
   */
  calculateXPForLevel(level: number): number {
    if (level <= 1) return 0;

    // Check cache
    const cached = this.xpRequirements.get(level);
    if (cached !== undefined) return cached;

    // Calculate and cache
    const xp = Math.floor(
      this.config.baseXP * Math.pow(level, this.config.scalingExponent)
    );
    this.xpRequirements.set(level, xp);
    return xp;
  }

  /**
   * Get XP required to reach next level from current level.
   */
  getXPToNextLevel(currentLevel: number): number {
    return this.calculateXPForLevel(currentLevel + 1);
  }

  /**
   * Get total XP accumulated at a given level.
   */
  getTotalXPAtLevel(level: number): number {
    let total = 0;
    for (let l = 1; l <= level; l++) {
      total += this.calculateXPForLevel(l);
    }
    return total;
  }

  /**
   * Calculate level from total XP.
   */
  getLevelFromTotalXP(totalXP: number): number {
    let level = 1;
    let accumulated = 0;

    while (level < this.config.maxLevel) {
      const required = this.calculateXPForLevel(level + 1);
      if (accumulated + required > totalXP) {
        break;
      }
      accumulated += required;
      level++;
    }

    return level;
  }

  // ============================================
  // Player Management
  // ============================================

  /**
   * Initialize player XP state.
   */
  initializePlayer(entity: number, startLevel: number = 1): void {
    this.playerStates.set(entity, {
      level: startLevel,
      currentXP: 0,
      xpToNextLevel: this.getXPToNextLevel(startLevel),
      totalXP: this.getTotalXPAtLevel(startLevel),
    });
  }

  /**
   * Get player XP state.
   */
  getPlayerState(entity: number): PlayerXPState | null {
    return this.playerStates.get(entity) ?? null;
  }

  /**
   * Award XP to a player.
   */
  awardXP(entity: number, amount: number, source: 'enemy' | 'orb' | 'wave_bonus' | 'shared' = 'orb'): void {
    const state = this.playerStates.get(entity);
    if (!state) {
      console.warn(`XPSystem: No state for entity ${entity}`);
      return;
    }

    // Apply XP multiplier from stats (if available)
    const xpMultiplier = this.getXPMultiplier(entity);
    const scaledAmount = Math.floor(amount * xpMultiplier);

    state.currentXP += scaledAmount;
    state.totalXP += scaledAmount;

    // Emit XP gained event
    this.eventBus.emit<XPGainEvent>(GameEvents.XP_GAINED, {
      entity,
      amount: scaledAmount,
      source,
    });

    // Check for level up(s)
    while (state.currentXP >= state.xpToNextLevel && state.level < this.config.maxLevel) {
      this.levelUp(entity, state);
    }

    // Handle multiplayer XP sharing
    if (this.config.sharedXP && source !== 'shared') {
      this.shareXP(entity, scaledAmount);
    }
  }

  /**
   * Process level up.
   */
  private levelUp(entity: number, state: PlayerXPState): void {
    state.currentXP -= state.xpToNextLevel;
    state.level++;
    state.xpToNextLevel = this.getXPToNextLevel(state.level);

    // Get upgrade choices
    let upgradeChoices: string[] = [];
    if (this.upgradePool) {
      upgradeChoices = this.upgradePool.getUpgradeChoices(entity, 3);
    }

    // Emit level up event
    this.eventBus.emit<PlayerLevelUpEvent>(GameEvents.PLAYER_LEVEL_UP, {
      entity,
      newLevel: state.level,
      upgradeChoices,
    });
  }

  /**
   * Share XP with other players.
   */
  private shareXP(sourceEntity: number, amount: number): void {
    const sharedAmount = Math.floor(amount * this.config.sharePercentage);
    if (sharedAmount <= 0) return;

    for (const [entity, _state] of this.playerStates) {
      if (entity !== sourceEntity) {
        this.awardXP(entity, sharedAmount, 'shared');
      }
    }
  }

  /**
   * Get XP multiplier for entity (from stat modifiers).
   */
  private getXPMultiplier(_entity: number): number {
    // In actual implementation, this would read from StatModifiers component
    // For now, return 1.0
    // TODO: Integrate with component system
    return 1.0;
  }

  // ============================================
  // Orb Collection
  // ============================================

  /**
   * Process XP orb collection.
   */
  collectXPOrb(playerEntity: number, orbValue: number): void {
    this.awardXP(playerEntity, orbValue, 'orb');
  }

  /**
   * Calculate magnetism effect for XP orbs.
   * Returns velocity adjustment toward player.
   */
  calculateMagnetism(
    orbX: number,
    orbY: number,
    playerX: number,
    playerY: number,
    pickupRadius: number,
    magnetSpeed: number
  ): { velocityX: number; velocityY: number; shouldCollect: boolean } {
    const dx = playerX - orbX;
    const dy = playerY - orbY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check for collection
    if (distance < 10) {
      return { velocityX: 0, velocityY: 0, shouldCollect: true };
    }

    // Check for magnetism range
    if (distance <= pickupRadius) {
      const factor = magnetSpeed / distance;
      return {
        velocityX: dx * factor,
        velocityY: dy * factor,
        shouldCollect: false,
      };
    }

    return { velocityX: 0, velocityY: 0, shouldCollect: false };
  }

  // ============================================
  // Configuration & Setup
  // ============================================

  /**
   * Set upgrade pool for level up choices.
   */
  setUpgradePool(pool: { getUpgradeChoices(entity: number, count: number): string[] }): void {
    this.upgradePool = pool;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<XPSystemConfig>): void {
    this.config = { ...this.config, ...config };
    // Recalculate XP requirements if scaling changed
    if (config.baseXP !== undefined || config.scalingExponent !== undefined) {
      this.xpRequirements.clear();
      for (let level = 1; level <= 100; level++) {
        this.xpRequirements.set(level, this.calculateXPForLevel(level));
      }
    }
  }

  /**
   * Enable/disable XP sharing.
   */
  setSharedXP(enabled: boolean, percentage: number = 0.5): void {
    this.config.sharedXP = enabled;
    this.config.sharePercentage = percentage;
  }

  /**
   * Remove player from tracking.
   */
  removePlayer(entity: number): void {
    this.playerStates.delete(entity);
  }

  /**
   * Reset all player states.
   */
  reset(): void {
    this.playerStates.clear();
  }

  /**
   * Get all tracked players.
   */
  getAllPlayers(): number[] {
    return Array.from(this.playerStates.keys());
  }

  /**
   * Get XP progress percentage (0-1).
   */
  getXPProgress(entity: number): number {
    const state = this.playerStates.get(entity);
    if (!state) return 0;
    if (state.xpToNextLevel === 0) return 1;
    return state.currentXP / state.xpToNextLevel;
  }
}

/**
 * Create XP system with configuration.
 */
export function createXPSystem(
  eventBus: IEventBus,
  config?: Partial<XPSystemConfig>
): XPSystem {
  return new XPSystem(eventBus, config);
}

/**
 * XP value scaling based on wave number.
 */
export function scaleXPValue(baseXP: number, waveNumber: number): number {
  // 5% more XP per wave
  return Math.floor(baseXP * (1 + waveNumber * 0.05));
}
