/**
 * ProgressionManager - Manages permanent player progression.
 *
 * Tracks:
 * - Total XP and talent points
 * - Kill/death statistics
 * - Play time
 * - Unlocked weapons/characters
 * - Weapon usage stats
 */

import type {
  IPlayerProgression,
  IWeaponUsageStats,
} from '@shared/interfaces/IMeta';
import { EventBus } from '@core/EventBus';

/**
 * XP thresholds for talent point milestones.
 * Player earns a talent point every time they reach a new threshold.
 */
const XP_THRESHOLDS: number[] = [
  1000, 2500, 5000, 10000, 20000, 35000, 50000, 75000, 100000,
  150000, 200000, 300000, 400000, 500000, 750000, 1000000,
];

/**
 * Result from a completed run for progression tracking.
 */
export interface RunResult {
  xpEarned: number;
  goldEarned: number;
  kills: number;
  waveReached: number;
  surviveTime: number;
  levelReached: number;
  weaponsUsed: Map<string, IWeaponUsageStats>;
  evolutions: number;
  bossesKilled: number;
  died: boolean;
}

/**
 * Event for progression updates.
 */
export interface ProgressionUpdateEvent {
  type: 'xp' | 'gold' | 'talentPoint' | 'unlock' | 'stats';
  data: unknown;
}

/**
 * ProgressionManager implementation for Cosmic Survivors.
 */
export class ProgressionManager {
  /** Current progression state */
  private progression: IPlayerProgression;

  /** EventBus for notifications */
  private eventBus: EventBus | null;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? null;
    this.progression = this.createDefaultProgression();
  }

  /**
   * Get current progression state (read-only copy).
   */
  getProgression(): Readonly<IPlayerProgression> {
    return { ...this.progression };
  }

  /**
   * Get total XP.
   */
  get totalXP(): number {
    return this.progression.totalXP;
  }

  /**
   * Get available talent points.
   */
  get talentPoints(): number {
    return this.progression.talentPoints;
  }

  /**
   * Get total kills.
   */
  get totalKills(): number {
    return this.progression.totalKills;
  }

  /**
   * Get highest wave reached.
   */
  get highestWave(): number {
    return this.progression.highestWave;
  }

  /**
   * Get total play time in seconds.
   */
  get totalPlayTime(): number {
    return this.progression.totalPlayTime;
  }

  /**
   * Get current gold.
   */
  get currentGold(): number {
    return this.progression.currentGold;
  }

  /**
   * Apply run results to permanent progression.
   * @param result Run results
   */
  applyRunResult(result: RunResult): void {
    const previousXP = this.progression.totalXP;

    // Add XP
    this.progression.totalXP += result.xpEarned;

    // Calculate new talent points earned
    const newTalentPoints = this.calculateNewTalentPoints(previousXP, this.progression.totalXP);
    if (newTalentPoints > 0) {
      this.progression.talentPoints += newTalentPoints;
      this.emitEvent('talentPoint', { earned: newTalentPoints, total: this.progression.talentPoints });
    }

    // Add gold
    this.progression.currentGold += result.goldEarned;
    this.progression.lifetimeGold += result.goldEarned;

    // Update stats
    this.progression.totalKills += result.kills;
    this.progression.totalPlayTime += result.surviveTime;
    this.progression.runsCompleted += 1;

    if (result.died) {
      this.progression.totalDeaths += 1;
    }

    // Update highest wave
    if (result.waveReached > this.progression.highestWave) {
      this.progression.highestWave = result.waveReached;
    }

    // Update weapon stats
    for (const [weaponId, stats] of result.weaponsUsed) {
      this.updateWeaponStats(weaponId, stats);
    }

    this.emitEvent('stats', { runsCompleted: this.progression.runsCompleted });
  }

  /**
   * Add XP directly.
   * @param amount XP to add
   */
  addXP(amount: number): void {
    if (amount <= 0) return;

    const previousXP = this.progression.totalXP;
    this.progression.totalXP += amount;

    const newTalentPoints = this.calculateNewTalentPoints(previousXP, this.progression.totalXP);
    if (newTalentPoints > 0) {
      this.progression.talentPoints += newTalentPoints;
      this.emitEvent('talentPoint', { earned: newTalentPoints, total: this.progression.talentPoints });
    }

    this.emitEvent('xp', { added: amount, total: this.progression.totalXP });
  }

  /**
   * Add gold directly.
   * @param amount Gold to add
   */
  addGold(amount: number): void {
    if (amount <= 0) return;

    this.progression.currentGold += amount;
    this.progression.lifetimeGold += amount;

    this.emitEvent('gold', { added: amount, current: this.progression.currentGold });
  }

  /**
   * Spend gold.
   * @param amount Gold to spend
   * @returns True if successful
   */
  spendGold(amount: number): boolean {
    if (amount <= 0) return false;
    if (this.progression.currentGold < amount) return false;

    this.progression.currentGold -= amount;
    this.emitEvent('gold', { spent: amount, current: this.progression.currentGold });

    return true;
  }

  /**
   * Add talent points directly.
   * @param amount Points to add
   */
  addTalentPoints(amount: number): void {
    if (amount <= 0) return;

    this.progression.talentPoints += amount;
    this.emitEvent('talentPoint', { earned: amount, total: this.progression.talentPoints });
  }

  /**
   * Spend talent points.
   * @param amount Points to spend
   * @returns True if successful
   */
  spendTalentPoints(amount: number): boolean {
    if (amount <= 0) return false;
    if (this.progression.talentPoints < amount) return false;

    this.progression.talentPoints -= amount;
    return true;
  }

  /**
   * Unlock a weapon.
   * @param weaponId Weapon ID
   * @returns True if newly unlocked
   */
  unlockWeapon(weaponId: string): boolean {
    if (this.progression.unlockedWeapons.includes(weaponId)) {
      return false;
    }

    this.progression.unlockedWeapons.push(weaponId);
    this.emitEvent('unlock', { type: 'weapon', id: weaponId });

    return true;
  }

  /**
   * Check if weapon is unlocked.
   * @param weaponId Weapon ID
   * @returns True if unlocked
   */
  isWeaponUnlocked(weaponId: string): boolean {
    return this.progression.unlockedWeapons.includes(weaponId);
  }

  /**
   * Get all unlocked weapons.
   */
  getUnlockedWeapons(): string[] {
    return [...this.progression.unlockedWeapons];
  }

  /**
   * Unlock a character.
   * @param characterId Character ID
   * @returns True if newly unlocked
   */
  unlockCharacter(characterId: string): boolean {
    if (this.progression.unlockedCharacters.includes(characterId)) {
      return false;
    }

    this.progression.unlockedCharacters.push(characterId);
    this.emitEvent('unlock', { type: 'character', id: characterId });

    return true;
  }

  /**
   * Check if character is unlocked.
   * @param characterId Character ID
   * @returns True if unlocked
   */
  isCharacterUnlocked(characterId: string): boolean {
    return this.progression.unlockedCharacters.includes(characterId);
  }

  /**
   * Get all unlocked characters.
   */
  getUnlockedCharacters(): string[] {
    return [...this.progression.unlockedCharacters];
  }

  /**
   * Add unlocked achievement.
   * @param achievementId Achievement ID
   */
  addAchievement(achievementId: string): void {
    if (!this.progression.achievements.includes(achievementId)) {
      this.progression.achievements.push(achievementId);
    }
  }

  /**
   * Check if achievement is unlocked.
   * @param achievementId Achievement ID
   */
  hasAchievement(achievementId: string): boolean {
    return this.progression.achievements.includes(achievementId);
  }

  /**
   * Get weapon stats.
   * @param weaponId Weapon ID
   */
  getWeaponStats(weaponId: string): IWeaponUsageStats | undefined {
    return this.progression.weaponStats[weaponId];
  }

  /**
   * Get all weapon stats.
   */
  getAllWeaponStats(): Record<string, IWeaponUsageStats> {
    return { ...this.progression.weaponStats };
  }

  /**
   * Calculate talent points earned from XP.
   * @returns Total talent points that should be earned from current XP
   */
  calculateTalentPointsFromXP(): number {
    let points = 0;
    for (const threshold of XP_THRESHOLDS) {
      if (this.progression.totalXP >= threshold) {
        points++;
      }
    }
    return points;
  }

  /**
   * Export progression state for saving.
   */
  exportState(): IPlayerProgression {
    return JSON.parse(JSON.stringify(this.progression));
  }

  /**
   * Import progression state from save.
   * @param state Saved state
   */
  importState(state: IPlayerProgression): void {
    this.progression = {
      ...this.createDefaultProgression(),
      ...state,
    };

    // Ensure arrays exist
    if (!Array.isArray(this.progression.unlockedWeapons)) {
      this.progression.unlockedWeapons = [];
    }
    if (!Array.isArray(this.progression.unlockedCharacters)) {
      this.progression.unlockedCharacters = [];
    }
    if (!Array.isArray(this.progression.achievements)) {
      this.progression.achievements = [];
    }
    if (!Array.isArray(this.progression.unlockedTalents)) {
      this.progression.unlockedTalents = [];
    }

    // Ensure weapon stats object exists
    if (!this.progression.weaponStats || typeof this.progression.weaponStats !== 'object') {
      this.progression.weaponStats = {};
    }
  }

  /**
   * Reset all progression (for testing or new game).
   */
  reset(): void {
    this.progression = this.createDefaultProgression();
  }

  /**
   * Set EventBus reference.
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Create default progression state.
   */
  private createDefaultProgression(): IPlayerProgression {
    return {
      totalXP: 0,
      talentPoints: 0,
      unlockedTalents: [],
      unlockedWeapons: ['basic_gun'], // Start with basic weapon
      unlockedCharacters: ['survivor'], // Start with default character
      achievements: [],
      highestWave: 0,
      totalKills: 0,
      totalPlayTime: 0,
      runsCompleted: 0,
      totalDeaths: 0,
      weaponStats: {},
      lifetimeGold: 0,
      currentGold: 0,
    };
  }

  /**
   * Calculate new talent points earned between two XP values.
   */
  private calculateNewTalentPoints(previousXP: number, newXP: number): number {
    let points = 0;
    for (const threshold of XP_THRESHOLDS) {
      if (previousXP < threshold && newXP >= threshold) {
        points++;
      }
    }
    return points;
  }

  /**
   * Update weapon usage stats.
   */
  private updateWeaponStats(weaponId: string, stats: IWeaponUsageStats): void {
    const existing = this.progression.weaponStats[weaponId];

    if (existing) {
      existing.timesUsed += stats.timesUsed;
      existing.damageDealt += stats.damageDealt;
      existing.kills += stats.kills;
      existing.evolutions += stats.evolutions;
      if (stats.maxLevel > existing.maxLevel) {
        existing.maxLevel = stats.maxLevel;
      }
    } else {
      this.progression.weaponStats[weaponId] = { ...stats };
    }
  }

  /**
   * Emit progression event.
   */
  private emitEvent(type: string, data: unknown): void {
    if (this.eventBus) {
      this.eventBus.emit<ProgressionUpdateEvent>('progression:update', {
        type: type as ProgressionUpdateEvent['type'],
        data,
      });
    }
  }
}
