/**
 * Upgrade System for Cosmic Survivors
 * Manages player progression, leveling, and upgrades
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Effect context passed to upgrade callbacks
 */
export interface IUpgradeEffectContext {
    playerStats: IPlayerStats;
    weaponStats: IWeaponStats;
    gameState: IGameState;
}

/**
 * Player statistics that can be modified by upgrades
 */
export interface IPlayerStats {
    maxHp: number;
    currentHp: number;
    moveSpeed: number;
    xpMagnetRange: number;
    hpRegenPerSecond: number;
    shieldCooldown: number;
    shieldActive: boolean;
    lastShieldTime: number;
}

/**
 * Weapon statistics that can be modified by upgrades
 */
export interface IWeaponStats {
    damage: number;
    fireRate: number;
    projectileCount: number;
    piercing: boolean;
    critChance: number;
    critMultiplier: number;
}

/**
 * Game state for upgrade context
 */
export interface IGameState {
    deltaTime: number;
    currentTime: number;
}

/**
 * Upgrade effect callback type
 */
export type UpgradeEffectCallback = (
    context: IUpgradeEffectContext,
    level: number
) => void;

/**
 * Interface for upgrade definition
 */
export interface IUpgrade {
    /** Unique identifier for the upgrade */
    id: string;
    /** Display name */
    name: string;
    /** Description shown to player */
    description: string;
    /** Icon (emoji or sprite key) */
    icon: string;
    /** Maximum level this upgrade can reach */
    maxLevel: number;
    /** Current level of the upgrade (0 = not acquired) */
    currentLevel: number;
    /** Callback that applies the upgrade effect */
    effect: UpgradeEffectCallback;
    /** Category for grouping upgrades */
    category: UpgradeCategory;
    /** Rarity affects drop chance */
    rarity: UpgradeRarity;
}

/**
 * Upgrade categories for organization
 */
export enum UpgradeCategory {
    DEFENSE = 'defense',
    OFFENSE = 'offense',
    UTILITY = 'utility',
    SPECIAL = 'special'
}

/**
 * Upgrade rarity levels
 */
export enum UpgradeRarity {
    COMMON = 'common',
    UNCOMMON = 'uncommon',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary'
}

/**
 * Rarity weights for random selection
 */
const RARITY_WEIGHTS: Record<UpgradeRarity, number> = {
    [UpgradeRarity.COMMON]: 50,
    [UpgradeRarity.UNCOMMON]: 30,
    [UpgradeRarity.RARE]: 15,
    [UpgradeRarity.EPIC]: 4,
    [UpgradeRarity.LEGENDARY]: 1
};

/**
 * Level up event data
 */
export interface ILevelUpEvent {
    newLevel: number;
    previousLevel: number;
    availableUpgrades: IUpgrade[];
}

/**
 * Upgrade selected event data
 */
export interface IUpgradeSelectedEvent {
    upgrade: IUpgrade;
    newLevel: number;
}

/**
 * Event listener callback types
 */
export type LevelUpListener = (event: ILevelUpEvent) => void;
export type UpgradeSelectedListener = (event: IUpgradeSelectedEvent) => void;

// ============================================================================
// Upgrade System Class
// ============================================================================

/**
 * Singleton class managing the upgrade system
 */
export class UpgradeSystem {
    private static instance: UpgradeSystem | null = null;

    // Player progression
    private _level: number = 1;
    private _currentXp: number = 0;
    private _totalXp: number = 0;

    // XP scaling configuration
    private readonly baseXpRequired: number = 100;
    private readonly xpScalingFactor: number = 1.15;
    private readonly xpFlatIncrease: number = 25;

    // Upgrades
    private upgrades: Map<string, IUpgrade> = new Map();
    private acquiredUpgradeIds: Set<string> = new Set();

    // Event listeners
    private levelUpListeners: LevelUpListener[] = [];
    private upgradeSelectedListeners: UpgradeSelectedListener[] = [];

    // ========================================================================
    // Singleton Pattern
    // ========================================================================

    private constructor() {
        this.initializeUpgrades();
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): UpgradeSystem {
        if (!UpgradeSystem.instance) {
            UpgradeSystem.instance = new UpgradeSystem();
        }
        return UpgradeSystem.instance;
    }

    /**
     * Reset the singleton (useful for testing or new game)
     */
    public static resetInstance(): void {
        UpgradeSystem.instance = null;
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize all predefined upgrades
     */
    private initializeUpgrades(): void {
        const upgradeDefinitions: IUpgrade[] = [
            // DEFENSE UPGRADES
            {
                id: 'hp_boost',
                name: 'Vital Force',
                description: 'Increases maximum HP by 20%',
                icon: '❤️',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    const multiplier = 1 + (0.20 * level);
                    ctx.playerStats.maxHp = Math.floor(100 * multiplier);
                }
            },
            {
                id: 'hp_regen',
                name: 'Regeneration',
                description: 'Regenerate 1 HP per second',
                icon: '💚',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    ctx.playerStats.hpRegenPerSecond = level;
                }
            },
            {
                id: 'shield',
                name: 'Energy Shield',
                description: 'Block 1 hit every 10 seconds',
                icon: '🛡️',
                maxLevel: 3,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.RARE,
                effect: (ctx, level) => {
                    // Reduce cooldown by 2s per level (10s -> 8s -> 6s)
                    ctx.playerStats.shieldCooldown = 10 - (level - 1) * 2;

                    // Check if shield should reactivate
                    const timeSinceLastShield = ctx.gameState.currentTime - ctx.playerStats.lastShieldTime;
                    if (timeSinceLastShield >= ctx.playerStats.shieldCooldown * 1000) {
                        ctx.playerStats.shieldActive = true;
                    }
                }
            },

            // OFFENSE UPGRADES
            {
                id: 'damage_boost',
                name: 'Power Strike',
                description: 'Increases damage by 25%',
                icon: '⚔️',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    const multiplier = 1 + (0.25 * level);
                    ctx.weaponStats.damage = Math.floor(10 * multiplier);
                }
            },
            {
                id: 'fire_rate',
                name: 'Rapid Fire',
                description: 'Reduces fire cooldown by 10%',
                icon: '🔥',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    const multiplier = Math.pow(0.90, level);
                    ctx.weaponStats.fireRate = 1000 * multiplier; // Base 1000ms
                }
            },
            {
                id: 'extra_projectile',
                name: 'Multishot',
                description: 'Fire an additional projectile',
                icon: '🎯',
                maxLevel: 4,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.RARE,
                effect: (ctx, level) => {
                    ctx.weaponStats.projectileCount = 1 + level;
                }
            },
            {
                id: 'piercing',
                name: 'Piercing Rounds',
                description: 'Projectiles pass through enemies',
                icon: '📍',
                maxLevel: 1,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.EPIC,
                effect: (ctx, level) => {
                    ctx.weaponStats.piercing = level > 0;
                }
            },
            {
                id: 'critical_hit',
                name: 'Critical Strike',
                description: '10% chance for 2x damage',
                icon: '💥',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    ctx.weaponStats.critChance = 0.10 * level;
                    ctx.weaponStats.critMultiplier = 2.0;
                }
            },

            // UTILITY UPGRADES
            {
                id: 'move_speed',
                name: 'Swift Feet',
                description: 'Increases movement speed by 15%',
                icon: '👟',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    const multiplier = 1 + (0.15 * level);
                    ctx.playerStats.moveSpeed = 200 * multiplier; // Base 200
                }
            },
            {
                id: 'xp_magnet',
                name: 'XP Magnet',
                description: 'Increases XP pickup range by 30%',
                icon: '🧲',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    const multiplier = 1 + (0.30 * level);
                    ctx.playerStats.xpMagnetRange = 50 * multiplier; // Base 50
                }
            },

            // SPECIAL/LEGENDARY UPGRADES
            {
                id: 'vampirism',
                name: 'Vampirism',
                description: 'Heal 5% of damage dealt',
                icon: '🦇',
                maxLevel: 3,
                currentLevel: 0,
                category: UpgradeCategory.SPECIAL,
                rarity: UpgradeRarity.EPIC,
                effect: (ctx, level) => {
                    // This effect would be applied in combat system
                    // Here we just track the level for reference
                }
            },
            {
                id: 'explosion',
                name: 'Explosive Rounds',
                description: 'Projectiles explode on impact',
                icon: '💣',
                maxLevel: 3,
                currentLevel: 0,
                category: UpgradeCategory.SPECIAL,
                rarity: UpgradeRarity.LEGENDARY,
                effect: (ctx, level) => {
                    // Explosion radius scales with level
                    // Applied in projectile collision system
                }
            },
            {
                id: 'time_slow',
                name: 'Time Dilation',
                description: 'Slow nearby enemies by 20%',
                icon: '⏱️',
                maxLevel: 3,
                currentLevel: 0,
                category: UpgradeCategory.SPECIAL,
                rarity: UpgradeRarity.LEGENDARY,
                effect: (ctx, level) => {
                    // Applied to enemies in range
                    // Slow amount: 20% * level
                }
            },
            {
                id: 'double_xp',
                name: 'Wisdom',
                description: 'Gain 15% more XP',
                icon: '📚',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    // Applied when collecting XP orbs
                    // Multiplier: 1 + (0.15 * level)
                }
            }
        ];

        // Register all upgrades
        for (const upgrade of upgradeDefinitions) {
            this.upgrades.set(upgrade.id, upgrade);
        }
    }

    // ========================================================================
    // Level & XP Management
    // ========================================================================

    /**
     * Get current player level
     */
    public get level(): number {
        return this._level;
    }

    /**
     * Get current XP towards next level
     */
    public get currentXp(): number {
        return this._currentXp;
    }

    /**
     * Get total XP earned
     */
    public get totalXp(): number {
        return this._totalXp;
    }

    /**
     * Calculate XP required for a specific level
     */
    public getXpRequiredForLevel(level: number): number {
        if (level <= 1) return 0;

        // Formula: base * (scalingFactor ^ (level - 1)) + flatIncrease * (level - 1)
        const scaled = this.baseXpRequired * Math.pow(this.xpScalingFactor, level - 1);
        const flat = this.xpFlatIncrease * (level - 1);

        return Math.floor(scaled + flat);
    }

    /**
     * Get XP required for next level
     */
    public get xpToNextLevel(): number {
        return this.getXpRequiredForLevel(this._level + 1);
    }

    /**
     * Get progress towards next level (0-1)
     */
    public get levelProgress(): number {
        const required = this.xpToNextLevel;
        return required > 0 ? this._currentXp / required : 0;
    }

    /**
     * Add XP and handle level ups
     * @returns true if leveled up
     */
    public addXp(amount: number): boolean {
        if (amount <= 0) return false;

        // Apply XP multiplier from wisdom upgrade
        const wisdomUpgrade = this.getUpgrade('double_xp');
        if (wisdomUpgrade && wisdomUpgrade.currentLevel > 0) {
            amount = Math.floor(amount * (1 + 0.15 * wisdomUpgrade.currentLevel));
        }

        this._currentXp += amount;
        this._totalXp += amount;

        let didLevelUp = false;

        // Check for level ups (could be multiple)
        while (this._currentXp >= this.xpToNextLevel) {
            this._currentXp -= this.xpToNextLevel;
            this._level++;
            didLevelUp = true;

            // Emit level up event
            this.emitLevelUp();
        }

        return didLevelUp;
    }

    /**
     * Emit level up event to all listeners
     */
    private emitLevelUp(): void {
        const availableUpgrades = this.getRandomUpgrades(3);
        const event: ILevelUpEvent = {
            newLevel: this._level,
            previousLevel: this._level - 1,
            availableUpgrades
        };

        for (const listener of this.levelUpListeners) {
            listener(event);
        }
    }

    // ========================================================================
    // Upgrade Management
    // ========================================================================

    /**
     * Get an upgrade by ID
     */
    public getUpgrade(id: string): IUpgrade | undefined {
        return this.upgrades.get(id);
    }

    /**
     * Get all upgrades
     */
    public getAllUpgrades(): IUpgrade[] {
        return Array.from(this.upgrades.values());
    }

    /**
     * Get all acquired upgrades (level > 0)
     */
    public getAcquiredUpgrades(): IUpgrade[] {
        return this.getAllUpgrades().filter(u => u.currentLevel > 0);
    }

    /**
     * Get upgrades that can still be leveled up
     */
    public getAvailableUpgrades(): IUpgrade[] {
        return this.getAllUpgrades().filter(u => u.currentLevel < u.maxLevel);
    }

    /**
     * Get random upgrades for selection
     * Weighted by rarity
     */
    public getRandomUpgrades(count: number): IUpgrade[] {
        const available = this.getAvailableUpgrades();

        if (available.length === 0) {
            return [];
        }

        if (available.length <= count) {
            return [...available];
        }

        // Calculate total weight
        const weightedUpgrades = available.map(upgrade => ({
            upgrade,
            weight: RARITY_WEIGHTS[upgrade.rarity]
        }));

        const totalWeight = weightedUpgrades.reduce((sum, wu) => sum + wu.weight, 0);

        // Select upgrades using weighted random
        const selected: IUpgrade[] = [];
        const usedIndices = new Set<number>();

        while (selected.length < count && usedIndices.size < available.length) {
            let random = Math.random() * totalWeight;

            for (let i = 0; i < weightedUpgrades.length; i++) {
                if (usedIndices.has(i)) continue;

                random -= weightedUpgrades[i].weight;

                if (random <= 0) {
                    selected.push(weightedUpgrades[i].upgrade);
                    usedIndices.add(i);
                    break;
                }
            }

            // Fallback: pick first available if random selection fails
            if (selected.length < usedIndices.size) {
                for (let i = 0; i < weightedUpgrades.length; i++) {
                    if (!usedIndices.has(i)) {
                        selected.push(weightedUpgrades[i].upgrade);
                        usedIndices.add(i);
                        break;
                    }
                }
            }
        }

        return selected;
    }

    /**
     * Apply an upgrade (increase its level)
     * @returns true if successful
     */
    public selectUpgrade(upgradeId: string): boolean {
        const upgrade = this.upgrades.get(upgradeId);

        if (!upgrade) {
            console.warn(`Upgrade not found: ${upgradeId}`);
            return false;
        }

        if (upgrade.currentLevel >= upgrade.maxLevel) {
            console.warn(`Upgrade already at max level: ${upgradeId}`);
            return false;
        }

        upgrade.currentLevel++;
        this.acquiredUpgradeIds.add(upgradeId);

        // Emit upgrade selected event
        const event: IUpgradeSelectedEvent = {
            upgrade,
            newLevel: upgrade.currentLevel
        };

        for (const listener of this.upgradeSelectedListeners) {
            listener(event);
        }

        return true;
    }

    /**
     * Apply all active upgrade effects to the context
     */
    public applyUpgradeEffects(context: IUpgradeEffectContext): void {
        for (const upgrade of this.getAcquiredUpgrades()) {
            upgrade.effect(context, upgrade.currentLevel);
        }
    }

    /**
     * Check if an upgrade has been acquired
     */
    public hasUpgrade(upgradeId: string): boolean {
        const upgrade = this.upgrades.get(upgradeId);
        return upgrade ? upgrade.currentLevel > 0 : false;
    }

    /**
     * Get upgrade level (0 if not acquired)
     */
    public getUpgradeLevel(upgradeId: string): number {
        const upgrade = this.upgrades.get(upgradeId);
        return upgrade ? upgrade.currentLevel : 0;
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================

    /**
     * Register a level up listener
     */
    public onLevelUp(listener: LevelUpListener): void {
        this.levelUpListeners.push(listener);
    }

    /**
     * Remove a level up listener
     */
    public offLevelUp(listener: LevelUpListener): void {
        const index = this.levelUpListeners.indexOf(listener);
        if (index !== -1) {
            this.levelUpListeners.splice(index, 1);
        }
    }

    /**
     * Register an upgrade selected listener
     */
    public onUpgradeSelected(listener: UpgradeSelectedListener): void {
        this.upgradeSelectedListeners.push(listener);
    }

    /**
     * Remove an upgrade selected listener
     */
    public offUpgradeSelected(listener: UpgradeSelectedListener): void {
        const index = this.upgradeSelectedListeners.indexOf(listener);
        if (index !== -1) {
            this.upgradeSelectedListeners.splice(index, 1);
        }
    }

    // ========================================================================
    // Persistence & Reset
    // ========================================================================

    /**
     * Reset all progress (for new game)
     */
    public reset(): void {
        this._level = 1;
        this._currentXp = 0;
        this._totalXp = 0;
        this.acquiredUpgradeIds.clear();

        // Reset all upgrade levels
        for (const upgrade of this.upgrades.values()) {
            upgrade.currentLevel = 0;
        }
    }

    /**
     * Export state for saving
     */
    public exportState(): object {
        const upgradeStates: Record<string, number> = {};

        for (const [id, upgrade] of this.upgrades) {
            if (upgrade.currentLevel > 0) {
                upgradeStates[id] = upgrade.currentLevel;
            }
        }

        return {
            level: this._level,
            currentXp: this._currentXp,
            totalXp: this._totalXp,
            upgrades: upgradeStates
        };
    }

    /**
     * Import state from save
     */
    public importState(state: {
        level?: number;
        currentXp?: number;
        totalXp?: number;
        upgrades?: Record<string, number>;
    }): void {
        this.reset();

        if (state.level !== undefined) this._level = state.level;
        if (state.currentXp !== undefined) this._currentXp = state.currentXp;
        if (state.totalXp !== undefined) this._totalXp = state.totalXp;

        if (state.upgrades) {
            for (const [id, level] of Object.entries(state.upgrades)) {
                const upgrade = this.upgrades.get(id);
                if (upgrade) {
                    upgrade.currentLevel = Math.min(level, upgrade.maxLevel);
                    if (upgrade.currentLevel > 0) {
                        this.acquiredUpgradeIds.add(id);
                    }
                }
            }
        }
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Get upgrades by category
     */
    public getUpgradesByCategory(category: UpgradeCategory): IUpgrade[] {
        return this.getAllUpgrades().filter(u => u.category === category);
    }

    /**
     * Get upgrades by rarity
     */
    public getUpgradesByRarity(rarity: UpgradeRarity): IUpgrade[] {
        return this.getAllUpgrades().filter(u => u.rarity === rarity);
    }

    /**
     * Check if a crit occurs (based on critical_hit upgrade)
     */
    public rollCritical(): boolean {
        const critUpgrade = this.getUpgrade('critical_hit');
        if (!critUpgrade || critUpgrade.currentLevel === 0) {
            return false;
        }
        return Math.random() < (0.10 * critUpgrade.currentLevel);
    }

    /**
     * Get crit multiplier
     */
    public getCritMultiplier(): number {
        return 2.0;
    }

    /**
     * Calculate final damage with upgrades
     */
    public calculateDamage(baseDamage: number): number {
        const damageUpgrade = this.getUpgrade('damage_boost');
        let damage = baseDamage;

        if (damageUpgrade && damageUpgrade.currentLevel > 0) {
            damage *= 1 + (0.25 * damageUpgrade.currentLevel);
        }

        if (this.rollCritical()) {
            damage *= this.getCritMultiplier();
        }

        return Math.floor(damage);
    }
}

// ============================================================================
// Default Export & Convenience
// ============================================================================

/**
 * Get the singleton upgrade system instance
 */
export const getUpgradeSystem = (): UpgradeSystem => UpgradeSystem.getInstance();

export default UpgradeSystem;
