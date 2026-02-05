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
    // New passive stats
    thornsPercent: number;           // % of damage reflected to attackers
    lifeStealPercent: number;        // % of damage dealt healed
    luckyXpChance: number;           // % chance for double XP
    berserkerDamageBonus: number;    // Damage multiplier based on missing HP
    guardianAngelCharges: number;    // Number of revives available
    guardianAngelUsed: boolean;      // Whether revive has been used this run
    momentumSpeedBonus: number;      // Speed bonus per kill (accumulated)
    momentumKillCount: number;       // Kills for momentum tracking
    momentumDecayRate: number;       // How fast momentum decays
    glassCannonActive: boolean;      // Whether Glass Cannon is active
    areaMultiplier: number;          // AOE size multiplier
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
    areaSize: number;       // Base AOE size for area weapons
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
 * Rarity weights for random selection (increased chances for rare upgrades)
 */
const RARITY_WEIGHTS: Record<UpgradeRarity, number> = {
    [UpgradeRarity.COMMON]: 40,
    [UpgradeRarity.UNCOMMON]: 30,
    [UpgradeRarity.RARE]: 20,
    [UpgradeRarity.EPIC]: 8,
    [UpgradeRarity.LEGENDARY]: 2
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

    // XP scaling configuration (reduced by 40% for faster progression)
    private readonly baseXpRequired: number = 60;
    private readonly xpScalingFactor: number = 1.12;
    private readonly xpFlatIncrease: number = 15;

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
                description: 'Increases maximum HP by 30',
                icon: '❤️',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    // +30 HP per level (was +20)
                    ctx.playerStats.maxHp = 100 + (30 * level);
                }
            },
            {
                id: 'hp_regen',
                name: 'Regeneration',
                description: 'Regenerate 2 HP per second',
                icon: '💚',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    // 2 HP/s per level (was 1 HP/s)
                    ctx.playerStats.hpRegenPerSecond = level * 2;
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
                description: 'Increases damage by 40%',
                icon: '⚔️',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    // +40% damage per level (was +25%)
                    const multiplier = 1 + (0.40 * level);
                    ctx.weaponStats.damage = Math.floor(10 * multiplier);
                }
            },
            {
                id: 'fire_rate',
                name: 'Rapid Fire',
                description: 'Reduces fire cooldown by 15%',
                icon: '🔥',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    // -15% cooldown per level (was -10%)
                    const multiplier = Math.pow(0.85, level);
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
                description: 'Increases movement speed by 50',
                icon: '👟',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    // +50 speed per level (was +35 equivalent)
                    ctx.playerStats.moveSpeed = 200 + (50 * level); // Base 200
                }
            },
            {
                id: 'xp_magnet',
                name: 'XP Magnet',
                description: 'Increases XP pickup range by 60',
                icon: '🧲',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.COMMON,
                effect: (ctx, level) => {
                    // +60 radius per level (was +40 equivalent)
                    ctx.playerStats.xpMagnetRange = 50 + (60 * level); // Base 50
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
            },

            // ========================================
            // NEW PASSIVE UPGRADES (8 total)
            // ========================================

            // 1. THORNS - Reflect damage to attackers
            {
                id: 'thorns',
                name: 'Thorns',
                description: 'Reflect 20% damage to attackers',
                icon: '🌵',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    // Level 1: 20%, Level 2: 40%, Level 3: 60%, Level 4: 80%, Level 5: 100%
                    ctx.playerStats.thornsPercent = 0.20 * level;
                }
            },

            // 2. LIFE STEAL - Heal from damage dealt
            {
                id: 'life_steal',
                name: 'Life Steal',
                description: 'Heal 5% of damage dealt',
                icon: '🩸',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.RARE,
                effect: (ctx, level) => {
                    // Level 1: 5%, Level 2: 10%, Level 3: 15%, Level 4: 20%, Level 5: 25%
                    ctx.playerStats.lifeStealPercent = 0.05 * level;
                }
            },

            // 3. LUCKY - Chance for double XP
            {
                id: 'lucky',
                name: 'Lucky',
                description: '10% chance for double XP',
                icon: '🍀',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    // Level 1: 10%, Level 2: 20%, Level 3: 30%, Level 4: 40%, Level 5: 50%
                    ctx.playerStats.luckyXpChance = 0.10 * level;
                }
            },

            // 4. BERSERKER - Damage increases as HP decreases
            {
                id: 'berserker',
                name: 'Berserker',
                description: 'Damage increases as HP decreases',
                icon: '🔥',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.RARE,
                effect: (ctx, level) => {
                    // Bonus damage = (1 - HP%) * level * 20%
                    // At 50% HP with level 5: 50% extra damage
                    // At 10% HP with level 5: 90% extra damage
                    const missingHpPercent = 1 - (ctx.playerStats.currentHp / ctx.playerStats.maxHp);
                    ctx.playerStats.berserkerDamageBonus = missingHpPercent * level * 0.20;
                }
            },

            // 5. GUARDIAN ANGEL - Revive once with 25% HP
            {
                id: 'guardian_angel',
                name: 'Guardian Angel',
                description: 'Revive once with 25% HP',
                icon: '👼',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.DEFENSE,
                rarity: UpgradeRarity.EPIC,
                effect: (ctx, level) => {
                    // Level 1: 25% HP, Level 2: 35% HP, Level 3: 45% HP, Level 4: 55% HP, Level 5: 65% HP
                    // Each level also adds invulnerability time after revive
                    if (!ctx.playerStats.guardianAngelUsed) {
                        ctx.playerStats.guardianAngelCharges = 1;
                    }
                    // Store revive HP percent: 25% + 10% per additional level
                    // This is applied in the actual revive logic, tracked here for reference
                }
            },

            // 6. MOMENTUM - Speed increases with kills
            {
                id: 'momentum',
                name: 'Momentum',
                description: 'Speed increases with kills',
                icon: '💨',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.UTILITY,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    // Each kill adds +2% speed per level (up to 50% max bonus)
                    // Speed bonus decays over time
                    // Level affects: bonus per kill and max cap
                    // Level 1: +2% per kill, 10% max
                    // Level 2: +4% per kill, 20% max
                    // Level 3: +6% per kill, 30% max
                    // Level 4: +8% per kill, 40% max
                    // Level 5: +10% per kill, 50% max
                    const maxBonus = 0.10 * level;
                    const currentBonus = Math.min(ctx.playerStats.momentumSpeedBonus, maxBonus);
                    ctx.playerStats.moveSpeed *= (1 + currentBonus);
                    ctx.playerStats.momentumDecayRate = 0.02; // 2% decay per second
                }
            },

            // 7. GLASS CANNON - More damage, less HP
            {
                id: 'glass_cannon',
                name: 'Glass Cannon',
                description: '+50% damage, -25% HP',
                icon: '💎',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.SPECIAL,
                rarity: UpgradeRarity.EPIC,
                effect: (ctx, level) => {
                    // Level 1: +50% damage, -25% HP
                    // Level 2: +75% damage, -22% HP (less penalty)
                    // Level 3: +100% damage, -19% HP
                    // Level 4: +125% damage, -16% HP
                    // Level 5: +150% damage, -13% HP
                    const damageBonus = 0.50 + (0.25 * (level - 1));
                    const hpPenalty = 0.25 - (0.03 * (level - 1));

                    ctx.weaponStats.damage *= (1 + damageBonus);
                    ctx.playerStats.maxHp *= (1 - hpPenalty);
                    ctx.playerStats.glassCannonActive = true;
                }
            },

            // 8. AREA MASTER - Increased AOE size
            {
                id: 'area_master',
                name: 'Area Master',
                description: '+30% AOE size',
                icon: '🔮',
                maxLevel: 5,
                currentLevel: 0,
                category: UpgradeCategory.OFFENSE,
                rarity: UpgradeRarity.UNCOMMON,
                effect: (ctx, level) => {
                    // Level 1: +30%, Level 2: +60%, Level 3: +90%, Level 4: +120%, Level 5: +150%
                    const areaBonus = 0.30 * level;
                    ctx.playerStats.areaMultiplier = 1 + areaBonus;
                    ctx.weaponStats.areaSize *= ctx.playerStats.areaMultiplier;
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
        // 4 upgrades to choose from (was 3)
        const availableUpgrades = this.getRandomUpgrades(4);
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

        // Reset Guardian Angel used state
        this.guardianAngelUsed = false;
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
            // +40% damage per level (was +25%)
            damage *= 1 + (0.40 * damageUpgrade.currentLevel);
        }

        if (this.rollCritical()) {
            damage *= this.getCritMultiplier();
        }

        return Math.floor(damage);
    }

    // ========================================================================
    // New Passive Upgrade Helper Methods
    // ========================================================================

    /**
     * Get thorns damage to reflect back to attacker
     * @param damageTaken The damage taken by the player
     * @returns The damage to reflect back to the attacker
     */
    public getThornsReflectDamage(damageTaken: number): number {
        const thornsUpgrade = this.getUpgrade('thorns');
        if (!thornsUpgrade || thornsUpgrade.currentLevel === 0) {
            return 0;
        }
        // 20% per level
        const reflectPercent = 0.20 * thornsUpgrade.currentLevel;
        return Math.floor(damageTaken * reflectPercent);
    }

    /**
     * Get life steal healing amount from damage dealt
     * @param damageDealt The damage dealt by the player
     * @returns The amount to heal
     */
    public getLifeStealHealing(damageDealt: number): number {
        const lifeStealUpgrade = this.getUpgrade('life_steal');
        if (!lifeStealUpgrade || lifeStealUpgrade.currentLevel === 0) {
            return 0;
        }
        // 5% per level
        const healPercent = 0.05 * lifeStealUpgrade.currentLevel;
        return Math.floor(damageDealt * healPercent);
    }

    /**
     * Check if lucky double XP triggers
     * @returns true if XP should be doubled
     */
    public rollLuckyDoubleXp(): boolean {
        const luckyUpgrade = this.getUpgrade('lucky');
        if (!luckyUpgrade || luckyUpgrade.currentLevel === 0) {
            return false;
        }
        // 10% per level
        const chance = 0.10 * luckyUpgrade.currentLevel;
        return Math.random() < chance;
    }

    /**
     * Get berserker damage multiplier based on missing HP
     * @param currentHp Current HP
     * @param maxHp Maximum HP
     * @returns Damage multiplier (1.0 = no bonus)
     */
    public getBerserkerMultiplier(currentHp: number, maxHp: number): number {
        const berserkerUpgrade = this.getUpgrade('berserker');
        if (!berserkerUpgrade || berserkerUpgrade.currentLevel === 0) {
            return 1.0;
        }
        const missingHpPercent = 1 - (currentHp / maxHp);
        // 20% bonus damage per level per 100% missing HP
        const damageBonus = missingHpPercent * berserkerUpgrade.currentLevel * 0.20;
        return 1 + damageBonus;
    }

    /**
     * Check if Guardian Angel can revive
     * @returns true if revive is available
     */
    public canGuardianAngelRevive(): boolean {
        const guardianUpgrade = this.getUpgrade('guardian_angel');
        if (!guardianUpgrade || guardianUpgrade.currentLevel === 0) {
            return false;
        }
        // Check if already used (stored in upgrade state tracking)
        return !this.guardianAngelUsed;
    }

    /**
     * Get Guardian Angel revive HP percent
     * @returns The percentage of max HP to revive with (0-1)
     */
    public getGuardianAngelRevivePercent(): number {
        const guardianUpgrade = this.getUpgrade('guardian_angel');
        if (!guardianUpgrade || guardianUpgrade.currentLevel === 0) {
            return 0;
        }
        // 25% + 10% per additional level
        return 0.25 + (0.10 * (guardianUpgrade.currentLevel - 1));
    }

    /**
     * Get Guardian Angel invulnerability duration after revive
     * @returns Duration in seconds
     */
    public getGuardianAngelInvulnerabilityDuration(): number {
        const guardianUpgrade = this.getUpgrade('guardian_angel');
        if (!guardianUpgrade || guardianUpgrade.currentLevel === 0) {
            return 0;
        }
        // 1 second base + 0.5s per level
        return 1.0 + (0.5 * guardianUpgrade.currentLevel);
    }

    /**
     * Use Guardian Angel revive
     */
    public useGuardianAngel(): void {
        this.guardianAngelUsed = true;
    }

    /** Track if Guardian Angel has been used */
    private guardianAngelUsed = false;

    /**
     * Get momentum speed bonus per kill
     * @returns Speed bonus multiplier per kill
     */
    public getMomentumBonusPerKill(): number {
        const momentumUpgrade = this.getUpgrade('momentum');
        if (!momentumUpgrade || momentumUpgrade.currentLevel === 0) {
            return 0;
        }
        // 2% per level per kill
        return 0.02 * momentumUpgrade.currentLevel;
    }

    /**
     * Get maximum momentum speed bonus
     * @returns Maximum speed bonus (0-1)
     */
    public getMomentumMaxBonus(): number {
        const momentumUpgrade = this.getUpgrade('momentum');
        if (!momentumUpgrade || momentumUpgrade.currentLevel === 0) {
            return 0;
        }
        // 10% max per level
        return 0.10 * momentumUpgrade.currentLevel;
    }

    /**
     * Get Glass Cannon damage multiplier
     * @returns Damage multiplier from Glass Cannon
     */
    public getGlassCannonDamageMultiplier(): number {
        const glassCannonUpgrade = this.getUpgrade('glass_cannon');
        if (!glassCannonUpgrade || glassCannonUpgrade.currentLevel === 0) {
            return 1.0;
        }
        // 50% + 25% per additional level
        const bonus = 0.50 + (0.25 * (glassCannonUpgrade.currentLevel - 1));
        return 1 + bonus;
    }

    /**
     * Get Glass Cannon HP penalty multiplier
     * @returns HP multiplier (less than 1.0)
     */
    public getGlassCannonHpMultiplier(): number {
        const glassCannonUpgrade = this.getUpgrade('glass_cannon');
        if (!glassCannonUpgrade || glassCannonUpgrade.currentLevel === 0) {
            return 1.0;
        }
        // 25% penalty reduced by 3% per additional level
        const penalty = 0.25 - (0.03 * (glassCannonUpgrade.currentLevel - 1));
        return 1 - penalty;
    }

    /**
     * Get Area Master AOE multiplier
     * @returns AOE size multiplier
     */
    public getAreaMasterMultiplier(): number {
        const areaMasterUpgrade = this.getUpgrade('area_master');
        if (!areaMasterUpgrade || areaMasterUpgrade.currentLevel === 0) {
            return 1.0;
        }
        // 30% per level
        return 1 + (0.30 * areaMasterUpgrade.currentLevel);
    }

    /**
     * Get upgrade description with current level stats
     * @param upgradeId The upgrade ID
     * @returns Description with level-specific values
     */
    public getUpgradeDescriptionWithLevel(upgradeId: string): string {
        const upgrade = this.getUpgrade(upgradeId);
        if (!upgrade) return '';

        const level = upgrade.currentLevel;
        const nextLevel = level + 1;

        switch (upgradeId) {
            case 'thorns':
                return `Reflect ${nextLevel * 20}% damage to attackers`;
            case 'life_steal':
                return `Heal ${nextLevel * 5}% of damage dealt`;
            case 'lucky':
                return `${nextLevel * 10}% chance for double XP`;
            case 'berserker':
                return `Up to +${nextLevel * 20}% damage at low HP`;
            case 'guardian_angel': {
                const reviveHp = 25 + (nextLevel - 1) * 10;
                return `Revive with ${reviveHp}% HP`;
            }
            case 'momentum': {
                const perKill = nextLevel * 2;
                const maxBonus = nextLevel * 10;
                return `+${perKill}% speed per kill (max ${maxBonus}%)`;
            }
            case 'glass_cannon': {
                const dmgBonus = 50 + (nextLevel - 1) * 25;
                const hpPenalty = 25 - (nextLevel - 1) * 3;
                return `+${dmgBonus}% damage, -${hpPenalty}% HP`;
            }
            case 'area_master':
                return `+${nextLevel * 30}% AOE size`;
            default:
                return upgrade.description;
        }
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
