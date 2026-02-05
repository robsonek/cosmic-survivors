/**
 * KillStreakSystem - Track kills without taking damage for Cosmic Survivors
 *
 * Tracks consecutive kills and awards bonuses at milestones:
 * - 10 kills: "KILLING SPREE" - Small XP bonus
 * - 25 kills: "RAMPAGE" - Temporary damage boost
 * - 50 kills: "UNSTOPPABLE" - Heal 25% HP
 * - 100 kills: "GODLIKE" - 10 seconds invincibility
 * - 200 kills: "LEGENDARY" - Screen-wide explosion
 *
 * Streak resets when player takes damage.
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Kill streak milestone definition
 */
export interface IKillStreakMilestone {
  /** Number of kills required to reach this milestone */
  kills: number;
  /** Display name shown on screen */
  name: string;
  /** Description of the reward */
  description: string;
  /** Color for visual effects */
  color: number;
  /** Sound effect key to play */
  soundKey: string;
  /** Reward type for handling logic */
  rewardType: KillStreakRewardType;
  /** Reward value (XP amount, damage multiplier, heal percentage, duration, damage) */
  rewardValue: number;
}

/**
 * Types of rewards that can be given for kill streaks
 */
export enum KillStreakRewardType {
  XP_BONUS = 'xp_bonus',
  DAMAGE_BOOST = 'damage_boost',
  HEAL_PERCENT = 'heal_percent',
  INVINCIBILITY = 'invincibility',
  SCREEN_EXPLOSION = 'screen_explosion',
}

/**
 * Current kill streak state
 */
export interface IKillStreakState {
  /** Current kill count */
  currentStreak: number;
  /** Highest streak achieved this game */
  bestStreak: number;
  /** Last reached milestone index (-1 if none) */
  lastMilestoneIndex: number;
  /** Active damage boost multiplier (1.0 = no boost) */
  activeDamageBoost: number;
  /** Time remaining on damage boost in seconds */
  damageBoostTimer: number;
  /** Whether player is currently invincible from streak */
  streakInvincible: boolean;
  /** Time remaining on invincibility in seconds */
  invincibilityTimer: number;
}

/**
 * Kill streak event data
 */
export interface IKillStreakEvent {
  /** Milestone that was reached */
  milestone: IKillStreakMilestone;
  /** Milestone index */
  milestoneIndex: number;
  /** Current kill count */
  currentStreak: number;
}

/**
 * Callback type for milestone reached
 */
export type MilestoneReachedCallback = (event: IKillStreakEvent) => void;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default kill streak milestones
 */
export const DEFAULT_KILL_STREAK_MILESTONES: IKillStreakMilestone[] = [
  {
    kills: 10,
    name: 'KILLING SPREE',
    description: '+50 XP Bonus',
    color: 0x00ff00,
    soundKey: 'sfx_powerup',
    rewardType: KillStreakRewardType.XP_BONUS,
    rewardValue: 50,
  },
  {
    kills: 25,
    name: 'RAMPAGE',
    description: '+50% Damage for 10s',
    color: 0xffaa00,
    soundKey: 'sfx_powerup',
    rewardType: KillStreakRewardType.DAMAGE_BOOST,
    rewardValue: 0.5, // 50% bonus damage
  },
  {
    kills: 50,
    name: 'UNSTOPPABLE',
    description: 'Heal 25% HP',
    color: 0xff00ff,
    soundKey: 'sfx_powerup',
    rewardType: KillStreakRewardType.HEAL_PERCENT,
    rewardValue: 0.25, // 25% heal
  },
  {
    kills: 100,
    name: 'GODLIKE',
    description: '10s Invincibility',
    color: 0xffff00,
    soundKey: 'sfx_levelup',
    rewardType: KillStreakRewardType.INVINCIBILITY,
    rewardValue: 10, // 10 seconds
  },
  {
    kills: 200,
    name: 'LEGENDARY',
    description: 'Screen-Wide Explosion!',
    color: 0xff0000,
    soundKey: 'sfx_levelup',
    rewardType: KillStreakRewardType.SCREEN_EXPLOSION,
    rewardValue: 500, // Explosion damage
  },
];

/**
 * Duration of damage boost effect in seconds
 */
export const DAMAGE_BOOST_DURATION = 10;

// ============================================================================
// KILL STREAK SYSTEM CLASS
// ============================================================================

/**
 * System for tracking kill streaks and awarding bonuses
 */
export class KillStreakSystem {
  private milestones: IKillStreakMilestone[];
  private state: IKillStreakState;
  private onMilestoneReached?: MilestoneReachedCallback;
  private onStreakReset?: (finalStreak: number) => void;

  constructor(milestones: IKillStreakMilestone[] = DEFAULT_KILL_STREAK_MILESTONES) {
    this.milestones = [...milestones].sort((a, b) => a.kills - b.kills);
    this.state = this.createInitialState();
  }

  /**
   * Creates the initial state
   */
  private createInitialState(): IKillStreakState {
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastMilestoneIndex: -1,
      activeDamageBoost: 1.0,
      damageBoostTimer: 0,
      streakInvincible: false,
      invincibilityTimer: 0,
    };
  }

  /**
   * Resets the system for a new game
   */
  public reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Called when player gets a kill
   * @returns Milestone reached (if any), or null
   */
  public addKill(): IKillStreakMilestone | null {
    this.state.currentStreak++;

    // Update best streak
    if (this.state.currentStreak > this.state.bestStreak) {
      this.state.bestStreak = this.state.currentStreak;
    }

    // Check for new milestone
    const nextMilestoneIndex = this.state.lastMilestoneIndex + 1;
    if (nextMilestoneIndex < this.milestones.length) {
      const nextMilestone = this.milestones[nextMilestoneIndex];
      if (this.state.currentStreak >= nextMilestone.kills) {
        this.state.lastMilestoneIndex = nextMilestoneIndex;

        // Apply milestone reward effect
        this.applyMilestoneReward(nextMilestone);

        // Trigger callback
        if (this.onMilestoneReached) {
          this.onMilestoneReached({
            milestone: nextMilestone,
            milestoneIndex: nextMilestoneIndex,
            currentStreak: this.state.currentStreak,
          });
        }

        return nextMilestone;
      }
    }

    return null;
  }

  /**
   * Applies the reward from a milestone
   */
  private applyMilestoneReward(milestone: IKillStreakMilestone): void {
    switch (milestone.rewardType) {
      case KillStreakRewardType.DAMAGE_BOOST:
        // Set damage boost (additive)
        this.state.activeDamageBoost = 1.0 + milestone.rewardValue;
        this.state.damageBoostTimer = DAMAGE_BOOST_DURATION;
        break;

      case KillStreakRewardType.INVINCIBILITY:
        this.state.streakInvincible = true;
        this.state.invincibilityTimer = milestone.rewardValue;
        break;

      // XP_BONUS, HEAL_PERCENT, SCREEN_EXPLOSION are handled externally
      // via the onMilestoneReached callback in GameScene
    }
  }

  /**
   * Called when player takes damage - resets the streak
   * @returns The final streak count before reset
   */
  public onPlayerDamaged(): number {
    // Don't reset if player is invincible from streak
    if (this.state.streakInvincible) {
      return this.state.currentStreak;
    }

    const finalStreak = this.state.currentStreak;

    // Reset streak
    this.state.currentStreak = 0;
    this.state.lastMilestoneIndex = -1;

    // Reset damage boost
    this.state.activeDamageBoost = 1.0;
    this.state.damageBoostTimer = 0;

    // Trigger callback
    if (this.onStreakReset && finalStreak > 0) {
      this.onStreakReset(finalStreak);
    }

    return finalStreak;
  }

  /**
   * Update timers (call every frame)
   * @param dt Delta time in seconds
   */
  public update(dt: number): void {
    // Update damage boost timer
    if (this.state.damageBoostTimer > 0) {
      this.state.damageBoostTimer -= dt;
      if (this.state.damageBoostTimer <= 0) {
        this.state.damageBoostTimer = 0;
        this.state.activeDamageBoost = 1.0;
      }
    }

    // Update invincibility timer
    if (this.state.invincibilityTimer > 0) {
      this.state.invincibilityTimer -= dt;
      if (this.state.invincibilityTimer <= 0) {
        this.state.invincibilityTimer = 0;
        this.state.streakInvincible = false;
      }
    }
  }

  /**
   * Gets the current kill streak count
   */
  public getCurrentStreak(): number {
    return this.state.currentStreak;
  }

  /**
   * Gets the best streak achieved this game
   */
  public getBestStreak(): number {
    return this.state.bestStreak;
  }

  /**
   * Gets the current damage multiplier from streak bonuses
   */
  public getDamageMultiplier(): number {
    return this.state.activeDamageBoost;
  }

  /**
   * Gets remaining time on damage boost
   */
  public getDamageBoostTimeRemaining(): number {
    return this.state.damageBoostTimer;
  }

  /**
   * Checks if player is invincible from streak
   */
  public isStreakInvincible(): boolean {
    return this.state.streakInvincible;
  }

  /**
   * Gets remaining time on streak invincibility
   */
  public getInvincibilityTimeRemaining(): number {
    return this.state.invincibilityTimer;
  }

  /**
   * Gets the next milestone to achieve
   */
  public getNextMilestone(): IKillStreakMilestone | null {
    const nextIndex = this.state.lastMilestoneIndex + 1;
    if (nextIndex < this.milestones.length) {
      return this.milestones[nextIndex];
    }
    return null;
  }

  /**
   * Gets kills remaining until next milestone
   */
  public getKillsToNextMilestone(): number {
    const nextMilestone = this.getNextMilestone();
    if (nextMilestone) {
      return Math.max(0, nextMilestone.kills - this.state.currentStreak);
    }
    return Infinity;
  }

  /**
   * Gets progress to next milestone (0-1)
   */
  public getProgressToNextMilestone(): number {
    const nextMilestone = this.getNextMilestone();
    if (!nextMilestone) {
      return 1;
    }

    const previousKills = this.state.lastMilestoneIndex >= 0
      ? this.milestones[this.state.lastMilestoneIndex].kills
      : 0;

    const range = nextMilestone.kills - previousKills;
    const current = this.state.currentStreak - previousKills;

    return Math.min(1, Math.max(0, current / range));
  }

  /**
   * Gets the current state (read-only)
   */
  public getState(): Readonly<IKillStreakState> {
    return { ...this.state };
  }

  /**
   * Gets all milestones
   */
  public getMilestones(): IKillStreakMilestone[] {
    return [...this.milestones];
  }

  /**
   * Registers callback for when a milestone is reached
   */
  public setOnMilestoneReached(callback: MilestoneReachedCallback): void {
    this.onMilestoneReached = callback;
  }

  /**
   * Registers callback for when streak is reset
   */
  public setOnStreakReset(callback: (finalStreak: number) => void): void {
    this.onStreakReset = callback;
  }

  /**
   * Checks if any temporary effects are active
   */
  public hasActiveEffects(): boolean {
    return this.state.damageBoostTimer > 0 || this.state.streakInvincible;
  }

  /**
   * Gets the last reached milestone (if any)
   */
  public getLastReachedMilestone(): IKillStreakMilestone | null {
    if (this.state.lastMilestoneIndex >= 0 && this.state.lastMilestoneIndex < this.milestones.length) {
      return this.milestones[this.state.lastMilestoneIndex];
    }
    return null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of KillStreakSystem
 */
export const killStreakSystem = new KillStreakSystem();

/**
 * Default export
 */
export default killStreakSystem;
