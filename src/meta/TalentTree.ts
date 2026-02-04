/**
 * TalentTree - Manages player talent progression.
 *
 * Features:
 * - Node-based talent system with prerequisites
 * - Multiple levels per talent
 * - Modifier stacking
 * - Reset/refund functionality
 */

import type { ITalentTree, ITalentNode, ITalentModifiers } from '@shared/interfaces/IMeta';
import { getTalentDefinitionsMap } from './TalentDefinitions';
import { EventBus } from '@core/EventBus';

/**
 * Event data for talent-related events.
 */
export interface TalentUnlockedEvent {
  talentId: string;
  newLevel: number;
  totalPoints: number;
}

export interface TalentResetEvent {
  refundedPoints: number;
}

/**
 * Serializable state for saving/loading.
 */
export interface TalentTreeState {
  unlocked: Record<string, number>;
  availablePoints: number;
}

/**
 * TalentTree implementation for Cosmic Survivors.
 */
export class TalentTree implements ITalentTree {
  /** All talent node definitions */
  private _nodes: Map<string, ITalentNode>;

  /** Currently unlocked talents with their levels */
  private _unlocked: Map<string, number>;

  /** Available talent points to spend */
  private _availablePoints: number;

  /** EventBus for notifications */
  private eventBus: EventBus | null;

  constructor(eventBus?: EventBus) {
    this._nodes = getTalentDefinitionsMap();
    this._unlocked = new Map();
    this._availablePoints = 0;
    this.eventBus = eventBus ?? null;
  }

  /**
   * Get all talent nodes (read-only).
   */
  get nodes(): ReadonlyMap<string, ITalentNode> {
    return this._nodes;
  }

  /**
   * Get unlocked talents with levels (read-only).
   */
  get unlocked(): ReadonlyMap<string, number> {
    return this._unlocked;
  }

  /**
   * Get available talent points.
   */
  get availablePoints(): number {
    return this._availablePoints;
  }

  /**
   * Unlock or upgrade a talent.
   * @param talentId The talent to unlock/upgrade
   * @returns True if successful
   */
  unlock(talentId: string): boolean {
    if (!this.canUnlock(talentId)) {
      return false;
    }

    const node = this._nodes.get(talentId);
    if (!node) return false;

    const currentLevel = this._unlocked.get(talentId) ?? 0;
    const newLevel = currentLevel + 1;

    // Deduct cost
    this._availablePoints -= node.cost;

    // Set new level
    this._unlocked.set(talentId, newLevel);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit<TalentUnlockedEvent>('talent:unlocked', {
        talentId,
        newLevel,
        totalPoints: this._availablePoints,
      });
    }

    return true;
  }

  /**
   * Check if a talent can be unlocked/upgraded.
   * @param talentId The talent to check
   * @returns True if can be unlocked
   */
  canUnlock(talentId: string): boolean {
    const node = this._nodes.get(talentId);
    if (!node) return false;

    // Check if max level reached
    const currentLevel = this._unlocked.get(talentId) ?? 0;
    if (currentLevel >= node.maxLevel) {
      return false;
    }

    // Check if enough points
    if (this._availablePoints < node.cost) {
      return false;
    }

    // Check prerequisites
    for (const prereqId of node.prerequisites) {
      const prereqLevel = this._unlocked.get(prereqId) ?? 0;
      if (prereqLevel === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current level of a talent.
   * @param talentId The talent to check
   * @returns Current level (0 if not unlocked)
   */
  getLevel(talentId: string): number {
    return this._unlocked.get(talentId) ?? 0;
  }

  /**
   * Get total modifiers from all unlocked talents.
   * @returns Combined modifiers
   */
  getTotalModifiers(): ITalentModifiers {
    const total: ITalentModifiers = {};

    for (const [talentId, level] of this._unlocked) {
      if (level <= 0) continue;

      const node = this._nodes.get(talentId);
      if (!node) continue;

      // Add each modifier multiplied by level
      for (const [key, value] of Object.entries(node.modifiers)) {
        const modKey = key as keyof ITalentModifiers;

        if (typeof value === 'number') {
          const current = (total[modKey] as number) ?? 0;
          (total[modKey] as number) = current + value * level;
        } else if (typeof value === 'string') {
          // String modifiers (like startingWeapon) take the last value
          (total[modKey] as string) = value;
        }
      }
    }

    return total;
  }

  /**
   * Reset all talents and refund points.
   */
  reset(): void {
    let refundedPoints = 0;

    // Calculate total refund
    for (const [talentId, level] of this._unlocked) {
      const node = this._nodes.get(talentId);
      if (node) {
        refundedPoints += node.cost * level;
      }
    }

    // Clear unlocked talents
    this._unlocked.clear();

    // Add refunded points
    this._availablePoints += refundedPoints;

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit<TalentResetEvent>('talent:reset', {
        refundedPoints,
      });
    }
  }

  /**
   * Add talent points.
   * @param amount Points to add
   */
  addPoints(amount: number): void {
    if (amount <= 0) return;
    this._availablePoints += amount;

    if (this.eventBus) {
      this.eventBus.emit('talent:pointsAdded', { amount, total: this._availablePoints });
    }
  }

  /**
   * Get spent points count.
   * @returns Total points spent on talents
   */
  getSpentPoints(): number {
    let spent = 0;
    for (const [talentId, level] of this._unlocked) {
      const node = this._nodes.get(talentId);
      if (node) {
        spent += node.cost * level;
      }
    }
    return spent;
  }

  /**
   * Get total points (spent + available).
   * @returns Total talent points earned
   */
  getTotalPoints(): number {
    return this.getSpentPoints() + this._availablePoints;
  }

  /**
   * Check if a specific talent is unlocked (level > 0).
   * @param talentId The talent to check
   * @returns True if unlocked
   */
  isUnlocked(talentId: string): boolean {
    return (this._unlocked.get(talentId) ?? 0) > 0;
  }

  /**
   * Check if a specific talent is maxed.
   * @param talentId The talent to check
   * @returns True if at max level
   */
  isMaxed(talentId: string): boolean {
    const node = this._nodes.get(talentId);
    if (!node) return false;
    return this.getLevel(talentId) >= node.maxLevel;
  }

  /**
   * Get talents that can currently be unlocked.
   * @returns Array of unlockable talent IDs
   */
  getAvailableTalents(): string[] {
    const available: string[] = [];
    for (const [talentId] of this._nodes) {
      if (this.canUnlock(talentId)) {
        available.push(talentId);
      }
    }
    return available;
  }

  /**
   * Export state for saving.
   * @returns Serializable state
   */
  exportState(): TalentTreeState {
    const unlocked: Record<string, number> = {};
    for (const [id, level] of this._unlocked) {
      unlocked[id] = level;
    }
    return {
      unlocked,
      availablePoints: this._availablePoints,
    };
  }

  /**
   * Import state from save data.
   * @param state Saved state
   */
  importState(state: TalentTreeState): void {
    this._unlocked.clear();

    for (const [id, level] of Object.entries(state.unlocked)) {
      // Validate talent exists
      if (this._nodes.has(id) && level > 0) {
        this._unlocked.set(id, level);
      }
    }

    this._availablePoints = state.availablePoints;
  }

  /**
   * Set EventBus reference.
   * @param eventBus EventBus instance
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }
}
