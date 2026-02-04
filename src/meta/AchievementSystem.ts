/**
 * AchievementSystem - Manages achievement tracking and unlocking.
 *
 * Features:
 * - Progress tracking per condition
 * - Auto-unlock when conditions met
 * - Reward distribution through EventBus
 * - Persistent unlocked state
 */

import type {
  IAchievementSystem,
  IAchievement,
  IAchievementRewards,
  AchievementCondition,
} from '@shared/interfaces/IMeta';
import { getAchievementDefinitionsMap, getTotalAchievementCount } from './AchievementDefinitions';
import { EventBus } from '@core/EventBus';

/**
 * Event data for achievement unlocked.
 */
export interface AchievementUnlockedEvent {
  achievement: IAchievement;
  rewards: IAchievementRewards;
}

/**
 * Event data for achievement progress.
 */
export interface AchievementProgressEvent {
  achievementId: string;
  progress: number;
  target: number;
  percent: number;
}

/**
 * Serializable state for saving/loading.
 */
export interface AchievementSystemState {
  unlocked: string[];
  progress: Record<string, number>;
}

/**
 * AchievementSystem implementation for Cosmic Survivors.
 */
export class AchievementSystem implements IAchievementSystem {
  /** All achievement definitions with progress */
  private _achievements: Map<string, IAchievement>;

  /** Set of unlocked achievement IDs */
  private _unlocked: Set<string>;

  /** Progress tracking per condition type */
  private progressByCondition: Map<AchievementCondition, number>;

  /** EventBus for notifications */
  private eventBus: EventBus | null;

  constructor(eventBus?: EventBus) {
    this._achievements = getAchievementDefinitionsMap();
    this._unlocked = new Set();
    this.progressByCondition = new Map();
    this.eventBus = eventBus ?? null;
  }

  /**
   * Get all achievements (read-only).
   */
  get achievements(): ReadonlyMap<string, IAchievement> {
    return this._achievements;
  }

  /**
   * Get unlocked achievement IDs (read-only).
   */
  get unlocked(): ReadonlySet<string> {
    return this._unlocked;
  }

  /**
   * Check all achievements and unlock any that meet conditions.
   */
  check(): void {
    for (const [id, achievement] of this._achievements) {
      if (this._unlocked.has(id)) continue;

      const progress = this.progressByCondition.get(achievement.condition) ?? 0;
      if (progress >= achievement.target) {
        this.unlockAchievement(id);
      }
    }
  }

  /**
   * Update progress for a specific condition.
   * @param condition The condition type
   * @param value The new value (absolute, not delta)
   */
  updateProgress(condition: AchievementCondition, value: number): void {
    const currentValue = this.progressByCondition.get(condition) ?? 0;

    // Only update if new value is higher
    if (value > currentValue) {
      this.progressByCondition.set(condition, value);

      // Update progress on relevant achievements and emit events
      for (const [id, achievement] of this._achievements) {
        if (achievement.condition !== condition) continue;
        if (this._unlocked.has(id)) continue;

        // Update achievement progress
        achievement.progress = value;

        // Emit progress event
        if (this.eventBus) {
          this.eventBus.emit<AchievementProgressEvent>('achievement:progress', {
            achievementId: id,
            progress: value,
            target: achievement.target,
            percent: Math.min(100, (value / achievement.target) * 100),
          });
        }

        // Check for unlock
        if (value >= achievement.target) {
          this.unlockAchievement(id);
        }
      }
    }
  }

  /**
   * Add progress for a specific condition (delta).
   * @param condition The condition type
   * @param delta Amount to add
   */
  addProgress(condition: AchievementCondition, delta: number): void {
    const currentValue = this.progressByCondition.get(condition) ?? 0;
    this.updateProgress(condition, currentValue + delta);
  }

  /**
   * Get achievement by ID.
   * @param id Achievement ID
   * @returns Achievement or undefined
   */
  get(id: string): IAchievement | undefined {
    const achievement = this._achievements.get(id);
    if (!achievement) return undefined;

    // If hidden and not unlocked, return masked version
    if (achievement.hidden && !this._unlocked.has(id)) {
      return {
        ...achievement,
        name: '???',
        description: 'Hidden achievement',
      };
    }

    return achievement;
  }

  /**
   * Check if achievement is unlocked.
   * @param id Achievement ID
   * @returns True if unlocked
   */
  isUnlocked(id: string): boolean {
    return this._unlocked.has(id);
  }

  /**
   * Get completion percentage.
   * @returns Percentage of achievements unlocked
   */
  getCompletionPercent(): number {
    const total = getTotalAchievementCount();
    if (total === 0) return 100;
    return (this._unlocked.size / total) * 100;
  }

  /**
   * Get progress for a specific condition.
   * @param condition The condition type
   * @returns Current progress value
   */
  getProgress(condition: AchievementCondition): number {
    return this.progressByCondition.get(condition) ?? 0;
  }

  /**
   * Get all unlocked achievements.
   * @returns Array of unlocked achievements
   */
  getUnlockedAchievements(): IAchievement[] {
    const result: IAchievement[] = [];
    for (const id of this._unlocked) {
      const achievement = this._achievements.get(id);
      if (achievement) {
        result.push(achievement);
      }
    }
    return result;
  }

  /**
   * Get achievements near completion.
   * @param threshold Minimum progress percentage (0-100)
   * @returns Array of achievements near completion
   */
  getNearCompletion(threshold: number = 75): IAchievement[] {
    const result: IAchievement[] = [];

    for (const [id, achievement] of this._achievements) {
      if (this._unlocked.has(id)) continue;

      const progress = this.progressByCondition.get(achievement.condition) ?? 0;
      const percent = (progress / achievement.target) * 100;

      if (percent >= threshold && percent < 100) {
        result.push({ ...achievement, progress });
      }
    }

    return result;
  }

  /**
   * Get total rewards from unlocked achievements.
   * @returns Combined rewards
   */
  getTotalRewards(): IAchievementRewards {
    const total: IAchievementRewards = {
      xp: 0,
      gold: 0,
      talentPoints: 0,
    };

    for (const id of this._unlocked) {
      const achievement = this._achievements.get(id);
      if (!achievement) continue;

      const { rewards } = achievement;
      if (rewards.xp) total.xp! += rewards.xp;
      if (rewards.gold) total.gold! += rewards.gold;
      if (rewards.talentPoints) total.talentPoints! += rewards.talentPoints;
    }

    return total;
  }

  /**
   * Export state for saving.
   * @returns Serializable state
   */
  exportState(): AchievementSystemState {
    const progress: Record<string, number> = {};
    for (const [condition, value] of this.progressByCondition) {
      progress[condition] = value;
    }

    return {
      unlocked: Array.from(this._unlocked),
      progress,
    };
  }

  /**
   * Import state from save data.
   * @param state Saved state
   */
  importState(state: AchievementSystemState): void {
    // Import unlocked achievements
    this._unlocked.clear();
    for (const id of state.unlocked) {
      if (this._achievements.has(id)) {
        this._unlocked.add(id);
      }
    }

    // Import progress
    this.progressByCondition.clear();
    for (const [conditionStr, value] of Object.entries(state.progress)) {
      const condition = conditionStr as AchievementCondition;
      this.progressByCondition.set(condition, value);

      // Update achievement progress values
      for (const achievement of this._achievements.values()) {
        if (achievement.condition === condition) {
          achievement.progress = value;
        }
      }
    }
  }

  /**
   * Manually unlock an achievement (for testing/admin).
   * @param id Achievement ID
   * @returns True if newly unlocked
   */
  forceUnlock(id: string): boolean {
    if (this._unlocked.has(id)) return false;
    if (!this._achievements.has(id)) return false;

    this.unlockAchievement(id);
    return true;
  }

  /**
   * Set EventBus reference.
   * @param eventBus EventBus instance
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Internal: Unlock an achievement and grant rewards.
   */
  private unlockAchievement(id: string): void {
    const achievement = this._achievements.get(id);
    if (!achievement) return;
    if (this._unlocked.has(id)) return;

    // Mark as unlocked
    this._unlocked.add(id);
    achievement.progress = achievement.target;

    // Emit unlock event with rewards
    if (this.eventBus) {
      this.eventBus.emit<AchievementUnlockedEvent>('achievement:unlocked', {
        achievement,
        rewards: achievement.rewards,
      });

      // Emit individual reward events for handling
      if (achievement.rewards.xp) {
        this.eventBus.emit('reward:xp', { amount: achievement.rewards.xp, source: 'achievement' });
      }
      if (achievement.rewards.gold) {
        this.eventBus.emit('reward:gold', { amount: achievement.rewards.gold, source: 'achievement' });
      }
      if (achievement.rewards.talentPoints) {
        this.eventBus.emit('reward:talentPoints', {
          amount: achievement.rewards.talentPoints,
          source: 'achievement',
        });
      }
      if (achievement.rewards.unlockWeapon) {
        this.eventBus.emit('reward:unlockWeapon', {
          weaponId: achievement.rewards.unlockWeapon,
          source: 'achievement',
        });
      }
      if (achievement.rewards.unlockCharacter) {
        this.eventBus.emit('reward:unlockCharacter', {
          characterId: achievement.rewards.unlockCharacter,
          source: 'achievement',
        });
      }
      if (achievement.rewards.title) {
        this.eventBus.emit('reward:title', {
          title: achievement.rewards.title,
          source: 'achievement',
        });
      }
    }
  }
}
