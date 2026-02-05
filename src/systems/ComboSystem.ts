/**
 * ComboSystem - Tracks consecutive kills and provides XP bonuses
 *
 * Features:
 * - Tracks consecutive kills within 2 second time window
 * - Combo multiplier scales up to 10x
 * - XP bonus based on combo level
 * - Visual feedback: combo counter UI
 * - Sound triggers at milestones (5, 10, 25, 50, 100)
 * - Screen flash effects on high combos
 * - Auto-reset if no kill within 2 seconds
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Combo milestone definition
 */
export interface IComboMilestone {
  /** Kill count threshold */
  threshold: number;
  /** Sound effect to play */
  sfxId: string;
  /** Whether to trigger screen flash */
  screenFlash: boolean;
  /** Flash color (hex) */
  flashColor: number;
  /** Announcement text */
  announcement: string;
}

/**
 * Combo state snapshot
 */
export interface IComboState {
  /** Current combo count */
  count: number;
  /** Current multiplier */
  multiplier: number;
  /** Time since last kill (seconds) */
  timeSinceLastKill: number;
  /** Time remaining before combo expires */
  timeRemaining: number;
  /** Whether combo is active */
  isActive: boolean;
  /** Current tier/milestone name */
  tierName: string;
  /** Total XP bonus accumulated this combo */
  totalXPBonus: number;
}

/**
 * Combo event data for listeners
 */
export interface IComboEvent {
  type: 'kill' | 'milestone' | 'expire' | 'reset';
  count: number;
  multiplier: number;
  xpBonus: number;
  milestone?: IComboMilestone;
}

/**
 * Event listener callback type
 */
export type ComboEventListener = (event: IComboEvent) => void;

// ============================================================================
// Constants
// ============================================================================

/** Time window for combo continuation (seconds) */
const COMBO_TIME_WINDOW = 2.0;

/** Maximum combo multiplier */
const MAX_COMBO_MULTIPLIER = 10;

/** Base XP bonus per kill in combo (percentage) */
const BASE_XP_BONUS_PERCENT = 0.05; // 5% per combo level

/** Combo milestones configuration */
const COMBO_MILESTONES: IComboMilestone[] = [
  {
    threshold: 5,
    sfxId: 'sfx_combo_5',
    screenFlash: false,
    flashColor: 0xffff00,
    announcement: 'NICE!'
  },
  {
    threshold: 10,
    sfxId: 'sfx_combo_10',
    screenFlash: true,
    flashColor: 0xff8800,
    announcement: 'GREAT!'
  },
  {
    threshold: 25,
    sfxId: 'sfx_combo_25',
    screenFlash: true,
    flashColor: 0xff4400,
    announcement: 'AMAZING!'
  },
  {
    threshold: 50,
    sfxId: 'sfx_combo_50',
    screenFlash: true,
    flashColor: 0xff00ff,
    announcement: 'UNSTOPPABLE!'
  },
  {
    threshold: 100,
    sfxId: 'sfx_combo_100',
    screenFlash: true,
    flashColor: 0x00ffff,
    announcement: 'GODLIKE!'
  }
];

/** Tier names based on combo count */
const COMBO_TIERS: { min: number; name: string; color: number }[] = [
  { min: 0, name: '', color: 0xffffff },
  { min: 3, name: 'COMBO', color: 0xffff00 },
  { min: 5, name: 'NICE', color: 0x88ff00 },
  { min: 10, name: 'GREAT', color: 0xff8800 },
  { min: 25, name: 'AMAZING', color: 0xff4400 },
  { min: 50, name: 'UNSTOPPABLE', color: 0xff00ff },
  { min: 100, name: 'GODLIKE', color: 0x00ffff }
];

// ============================================================================
// ComboSystem Class
// ============================================================================

/**
 * Singleton class managing the combo system
 */
export class ComboSystem {
  private static instance: ComboSystem | null = null;

  // Combo state
  private _count: number = 0;
  private _timeSinceLastKill: number = 0;
  private _isActive: boolean = false;
  private _totalXPBonus: number = 0;
  private _lastMilestoneReached: number = 0;

  // Statistics
  private _highestCombo: number = 0;
  private _totalCombosStarted: number = 0;
  private _totalKillsInCombos: number = 0;

  // Event listeners
  private eventListeners: ComboEventListener[] = [];

  // ========================================================================
  // Singleton Pattern
  // ========================================================================

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ComboSystem {
    if (!ComboSystem.instance) {
      ComboSystem.instance = new ComboSystem();
    }
    return ComboSystem.instance;
  }

  /**
   * Reset the singleton (for new game)
   */
  public static resetInstance(): void {
    if (ComboSystem.instance) {
      ComboSystem.instance.reset();
    }
  }

  // ========================================================================
  // Core Combo Logic
  // ========================================================================

  /**
   * Register a kill and update combo
   * @param baseXPValue - Base XP value of the killed enemy
   * @returns XP bonus to add (on top of base XP)
   */
  public registerKill(baseXPValue: number): number {
    // Start new combo if not active
    if (!this._isActive) {
      this._isActive = true;
      this._count = 0;
      this._totalXPBonus = 0;
      this._lastMilestoneReached = 0;
      this._totalCombosStarted++;
    }

    // Increment combo
    this._count++;
    this._timeSinceLastKill = 0;
    this._totalKillsInCombos++;

    // Update highest combo
    if (this._count > this._highestCombo) {
      this._highestCombo = this._count;
    }

    // Calculate XP bonus
    const multiplier = this.getMultiplier();
    const xpBonus = Math.floor(baseXPValue * BASE_XP_BONUS_PERCENT * (this._count - 1));
    this._totalXPBonus += xpBonus;

    // Check for milestones
    const milestone = this.checkMilestone();

    // Emit kill event
    this.emitEvent({
      type: 'kill',
      count: this._count,
      multiplier,
      xpBonus,
      milestone: milestone || undefined
    });

    // Emit milestone event if reached
    if (milestone) {
      this.emitEvent({
        type: 'milestone',
        count: this._count,
        multiplier,
        xpBonus: 0,
        milestone
      });
    }

    return xpBonus;
  }

  /**
   * Update combo timer - call each frame
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    if (!this._isActive) return;

    this._timeSinceLastKill += deltaTime;

    // Check for combo expiration
    if (this._timeSinceLastKill >= COMBO_TIME_WINDOW) {
      this.expireCombo();
    }
  }

  /**
   * Expire the current combo
   */
  private expireCombo(): void {
    if (!this._isActive) return;

    const finalCount = this._count;
    const finalMultiplier = this.getMultiplier();
    const finalXPBonus = this._totalXPBonus;

    // Emit expire event
    this.emitEvent({
      type: 'expire',
      count: finalCount,
      multiplier: finalMultiplier,
      xpBonus: finalXPBonus
    });

    // Reset state
    this._isActive = false;
    this._count = 0;
    this._timeSinceLastKill = 0;
    this._totalXPBonus = 0;
    this._lastMilestoneReached = 0;
  }

  /**
   * Force reset the combo (e.g., on player death)
   */
  public reset(): void {
    if (this._isActive) {
      this.emitEvent({
        type: 'reset',
        count: this._count,
        multiplier: this.getMultiplier(),
        xpBonus: this._totalXPBonus
      });
    }

    this._isActive = false;
    this._count = 0;
    this._timeSinceLastKill = 0;
    this._totalXPBonus = 0;
    this._lastMilestoneReached = 0;
  }

  /**
   * Full reset including statistics (for new game)
   */
  public fullReset(): void {
    this.reset();
    this._highestCombo = 0;
    this._totalCombosStarted = 0;
    this._totalKillsInCombos = 0;
  }

  // ========================================================================
  // Multiplier & Bonuses
  // ========================================================================

  /**
   * Get current combo multiplier (1x to 10x)
   */
  public getMultiplier(): number {
    if (this._count <= 1) return 1;

    // Multiplier scales: 1x at 1 kill, increases by 1 every 10 kills, max 10x
    const multiplier = 1 + Math.floor((this._count - 1) / 10);
    return Math.min(multiplier, MAX_COMBO_MULTIPLIER);
  }

  /**
   * Get XP multiplier for current combo (1.0 to 2.0)
   */
  public getXPMultiplier(): number {
    if (this._count <= 1) return 1.0;

    // XP multiplier: 1.0 at start, +5% per combo level, max 2.0
    const bonus = Math.min(this._count * BASE_XP_BONUS_PERCENT, 1.0);
    return 1.0 + bonus;
  }

  /**
   * Check if a milestone was just reached
   */
  private checkMilestone(): IComboMilestone | null {
    for (const milestone of COMBO_MILESTONES) {
      if (this._count === milestone.threshold && this._lastMilestoneReached < milestone.threshold) {
        this._lastMilestoneReached = milestone.threshold;
        return milestone;
      }
    }
    return null;
  }

  // ========================================================================
  // State Getters
  // ========================================================================

  /**
   * Get current combo count
   */
  public get count(): number {
    return this._count;
  }

  /**
   * Get current multiplier
   */
  public get multiplier(): number {
    return this.getMultiplier();
  }

  /**
   * Check if combo is active
   */
  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get time remaining before combo expires
   */
  public get timeRemaining(): number {
    if (!this._isActive) return 0;
    return Math.max(0, COMBO_TIME_WINDOW - this._timeSinceLastKill);
  }

  /**
   * Get time since last kill
   */
  public get timeSinceLastKill(): number {
    return this._timeSinceLastKill;
  }

  /**
   * Get current tier name
   */
  public get tierName(): string {
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
      if (this._count >= COMBO_TIERS[i].min) {
        return COMBO_TIERS[i].name;
      }
    }
    return '';
  }

  /**
   * Get current tier color
   */
  public get tierColor(): number {
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
      if (this._count >= COMBO_TIERS[i].min) {
        return COMBO_TIERS[i].color;
      }
    }
    return 0xffffff;
  }

  /**
   * Get full combo state snapshot
   */
  public getState(): IComboState {
    return {
      count: this._count,
      multiplier: this.getMultiplier(),
      timeSinceLastKill: this._timeSinceLastKill,
      timeRemaining: this.timeRemaining,
      isActive: this._isActive,
      tierName: this.tierName,
      totalXPBonus: this._totalXPBonus
    };
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get highest combo achieved
   */
  public get highestCombo(): number {
    return this._highestCombo;
  }

  /**
   * Get total combos started
   */
  public get totalCombosStarted(): number {
    return this._totalCombosStarted;
  }

  /**
   * Get total kills in combos
   */
  public get totalKillsInCombos(): number {
    return this._totalKillsInCombos;
  }

  /**
   * Export statistics for saving
   */
  public exportStats(): object {
    return {
      highestCombo: this._highestCombo,
      totalCombosStarted: this._totalCombosStarted,
      totalKillsInCombos: this._totalKillsInCombos
    };
  }

  /**
   * Import statistics from save
   */
  public importStats(stats: {
    highestCombo?: number;
    totalCombosStarted?: number;
    totalKillsInCombos?: number;
  }): void {
    if (stats.highestCombo !== undefined) this._highestCombo = stats.highestCombo;
    if (stats.totalCombosStarted !== undefined) this._totalCombosStarted = stats.totalCombosStarted;
    if (stats.totalKillsInCombos !== undefined) this._totalKillsInCombos = stats.totalKillsInCombos;
  }

  // ========================================================================
  // Event Listeners
  // ========================================================================

  /**
   * Register an event listener
   */
  public addEventListener(listener: ComboEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  public removeEventListener(listener: ComboEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: IComboEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Get the combo time window constant
   */
  public static getComboTimeWindow(): number {
    return COMBO_TIME_WINDOW;
  }

  /**
   * Get the max multiplier constant
   */
  public static getMaxMultiplier(): number {
    return MAX_COMBO_MULTIPLIER;
  }

  /**
   * Get all combo milestones
   */
  public static getMilestones(): readonly IComboMilestone[] {
    return COMBO_MILESTONES;
  }

  /**
   * Get all combo tiers
   */
  public static getTiers(): readonly { min: number; name: string; color: number }[] {
    return COMBO_TIERS;
  }
}

// ============================================================================
// Default Export & Convenience
// ============================================================================

/**
 * Get the singleton combo system instance
 */
export const getComboSystem = (): ComboSystem => ComboSystem.getInstance();

export default ComboSystem;
