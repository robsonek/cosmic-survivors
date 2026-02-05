/**
 * UpgradePool - Manages available upgrades for level-up choices.
 *
 * Features:
 * - Rarity-based weighting
 * - Availability checking based on player state
 * - No duplicate choices
 * - Prioritizes new weapons early game
 * - Evolution tracking
 *
 * Implements IUpgradePool interface.
 */

import type { IUpgradePool } from '../shared/interfaces/IProcedural';
import { WeaponRarity } from '../shared/interfaces/IWeapon';
import type { IPassiveItem } from '../shared/interfaces/IWeapon';
import { getAllWeaponDefinitions, getWeaponDefinition } from '../weapons/definitions';
import { shuffle } from '../shared/utils/math';

/**
 * Upgrade entry in the pool.
 */
export interface UpgradeEntry {
  /** Unique upgrade ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Upgrade type */
  type: 'weapon' | 'passive' | 'evolution';
  /** Rarity for weighting */
  rarity: WeaponRarity;
  /** Maximum level */
  maxLevel: number;
  /** Associated weapon ID (for weapon upgrades) */
  weaponId?: string;
  /** Associated passive ID (for passive upgrades) */
  passiveId?: string;
  /** Evolution requirements */
  evolutionFrom?: { weaponId: string; passiveId: string };
  /** Custom weight modifier */
  weightModifier?: number;
}

/**
 * Player weapon state for availability checking.
 */
interface PlayerWeaponState {
  weaponId: string;
  level: number;
}

/**
 * Player passive state.
 */
interface PlayerPassiveState {
  passiveId: string;
  level: number;
}

/**
 * Player state snapshot for upgrade decisions.
 */
interface PlayerUpgradeState {
  level: number;
  weapons: PlayerWeaponState[];
  passives: PlayerPassiveState[];
  availableSlots: number;
}

// ============================================
// Rarity Weights
// ============================================

const RARITY_WEIGHTS: Record<WeaponRarity, number> = {
  [WeaponRarity.Common]: 100,
  [WeaponRarity.Uncommon]: 60,
  [WeaponRarity.Rare]: 30,
  [WeaponRarity.Epic]: 10,
  [WeaponRarity.Legendary]: 3,
};

// ============================================
// Built-in Passive Items
// ============================================

const PASSIVE_ITEMS: IPassiveItem[] = [
  {
    id: 'spinach',
    name: 'Spinach',
    description: '+10% Might',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { damageMultiplier: 1.1 },
    levelScaling: { damageMultiplier: 0.1 },
  },
  {
    id: 'armor',
    name: 'Armor',
    description: '+1 Armor',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { armorBonus: 1 },
    levelScaling: { armorBonus: 1 },
  },
  {
    id: 'hollowHeart',
    name: 'Hollow Heart',
    description: '+20% Max Health',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { healthBonus: 20 },
    levelScaling: { healthBonus: 20 },
  },
  {
    id: 'pummarola',
    name: 'Pummarola',
    description: '+0.2 HP/s Recovery',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: { regenBonus: 0.2 },
    levelScaling: { regenBonus: 0.2 },
  },
  {
    id: 'emptyTome',
    name: 'Empty Tome',
    description: '-8% Cooldown',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: { cooldownReduction: 0.08 },
    levelScaling: { cooldownReduction: 0.08 },
  },
  {
    id: 'candelabrador',
    name: 'Candelabrador',
    description: '+10% Area',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { areaMultiplier: 1.1 },
    levelScaling: { areaMultiplier: 0.1 },
  },
  {
    id: 'bracer',
    name: 'Bracer',
    description: '+10% Projectile Speed',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { speedMultiplier: 1.1 },
    levelScaling: { speedMultiplier: 0.1 },
  },
  {
    id: 'spellbinder',
    name: 'Spellbinder',
    description: '+10% Duration',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: {}, // Duration not in modifiers yet
    levelScaling: {},
  },
  {
    id: 'duplicator',
    name: 'Duplicator',
    description: '+1 Amount',
    rarity: WeaponRarity.Rare,
    maxLevel: 2,
    modifiers: { projectileCountBonus: 1 },
    levelScaling: { projectileCountBonus: 1 },
  },
  {
    id: 'wings',
    name: 'Wings',
    description: '+10% Movement Speed',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { speedMultiplier: 1.1 },
    levelScaling: { speedMultiplier: 0.1 },
  },
  {
    id: 'attractorb',
    name: 'Attractorb',
    description: '+50% Pickup Radius',
    rarity: WeaponRarity.Common,
    maxLevel: 5,
    modifiers: { pickupRadius: 50 },
    levelScaling: { pickupRadius: 50 },
  },
  {
    id: 'clover',
    name: 'Clover',
    description: '+10% Luck',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: { critChanceBonus: 0.05 },
    levelScaling: { critChanceBonus: 0.05 },
  },
  {
    id: 'crown',
    name: 'Crown',
    description: '+8% Growth (XP)',
    rarity: WeaponRarity.Rare,
    maxLevel: 5,
    modifiers: { xpMultiplier: 1.08 },
    levelScaling: { xpMultiplier: 0.08 },
  },
  {
    id: 'stoneMask',
    name: 'Stone Mask',
    description: '+10% Greed (Gold)',
    rarity: WeaponRarity.Rare,
    maxLevel: 5,
    modifiers: {}, // Gold modifier not implemented
    levelScaling: {},
  },

  // ========================================
  // NEW PASSIVE ITEMS (8 total)
  // ========================================

  // 1. Thorns - Reflect damage to attackers
  {
    id: 'thorns',
    name: 'Thorns',
    description: '+20% Damage Reflection',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 2. Life Steal - Heal from damage dealt
  {
    id: 'life_steal',
    name: 'Life Steal',
    description: '+5% Life Steal',
    rarity: WeaponRarity.Rare,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 3. Lucky - Chance for double XP
  {
    id: 'lucky',
    name: 'Lucky',
    description: '+10% Double XP Chance',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 4. Berserker - Damage increases as HP decreases
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+20% Damage at Low HP',
    rarity: WeaponRarity.Rare,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 5. Guardian Angel - Revive once
  {
    id: 'guardian_angel',
    name: 'Guardian Angel',
    description: 'Revive with 25% HP',
    rarity: WeaponRarity.Epic,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 6. Momentum - Speed increases with kills
  {
    id: 'momentum',
    name: 'Momentum',
    description: '+2% Speed per Kill',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 7. Glass Cannon - More damage, less HP
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: '+50% Damage, -25% HP',
    rarity: WeaponRarity.Epic,
    maxLevel: 5,
    modifiers: {}, // Handled in UpgradeSystem
    levelScaling: {},
  },

  // 8. Area Master - Increased AOE size
  {
    id: 'area_master',
    name: 'Area Master',
    description: '+30% AOE Size',
    rarity: WeaponRarity.Uncommon,
    maxLevel: 5,
    modifiers: { areaMultiplier: 1.3 },
    levelScaling: { areaMultiplier: 0.3 },
  },
];

/**
 * UpgradePool implementation.
 */
export class UpgradePool implements IUpgradePool {
  /** All available upgrades */
  private upgrades: Map<string, UpgradeEntry> = new Map();

  /** Custom weight modifiers */
  private weightModifiers: Map<string, number> = new Map();

  /** Player state cache (entity -> state) */
  private playerStateCache: Map<number, PlayerUpgradeState> = new Map();

  /** Callback to get player state */
  private getPlayerStateCallback?: (entity: number) => PlayerUpgradeState | null;

  constructor() {
    this.initializeUpgrades();
  }

  // ============================================
  // IUpgradePool Implementation
  // ============================================

  /**
   * Get upgrade choices for level up.
   */
  getUpgradeChoices(playerEntity: number, count: number): string[] {
    const playerState = this.getPlayerState(playerEntity);
    if (!playerState) {
      return [];
    }

    // Get all available upgrades
    const available = this.getAvailableUpgradesForPlayer(playerState);

    // Calculate weights
    const weighted = available.map(upgrade => ({
      upgrade,
      weight: this.calculateWeight(upgrade, playerState),
    }));

    // Sort by weight and shuffle within tiers
    weighted.sort((a, b) => b.weight - a.weight);

    // Select top choices with some randomization
    const choices: string[] = [];
    const used = new Set<string>();

    // First, try to get diverse choices
    for (const category of ['new_weapon', 'weapon_upgrade', 'passive_new', 'passive_upgrade', 'evolution']) {
      if (choices.length >= count) break;

      const categoryUpgrades = weighted.filter(w => {
        if (used.has(w.upgrade.id)) return false;

        switch (category) {
          case 'new_weapon':
            return w.upgrade.type === 'weapon' && !playerState.weapons.find(pw => pw.weaponId === w.upgrade.weaponId);
          case 'weapon_upgrade':
            return w.upgrade.type === 'weapon' && playerState.weapons.find(pw => pw.weaponId === w.upgrade.weaponId);
          case 'passive_new':
            return w.upgrade.type === 'passive' && !playerState.passives.find(pp => pp.passiveId === w.upgrade.passiveId);
          case 'passive_upgrade':
            return w.upgrade.type === 'passive' && playerState.passives.find(pp => pp.passiveId === w.upgrade.passiveId);
          case 'evolution':
            return w.upgrade.type === 'evolution';
          default:
            return true;
        }
      });

      if (categoryUpgrades.length > 0) {
        const selected = this.weightedSelect(categoryUpgrades);
        if (selected) {
          choices.push(selected.upgrade.id);
          used.add(selected.upgrade.id);
        }
      }
    }

    // Fill remaining slots randomly
    const remaining = weighted.filter(w => !used.has(w.upgrade.id));
    while (choices.length < count && remaining.length > 0) {
      const selected = this.weightedSelect(remaining);
      if (selected) {
        choices.push(selected.upgrade.id);
        used.add(selected.upgrade.id);
        remaining.splice(remaining.indexOf(selected), 1);
      } else {
        break;
      }
    }

    // Shuffle final choices
    return shuffle([...choices]);
  }

  /**
   * Check if upgrade is available for player.
   */
  isAvailable(playerEntity: number, upgradeId: string): boolean {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return false;

    const playerState = this.getPlayerState(playerEntity);
    if (!playerState) return false;

    return this.isUpgradeAvailable(upgrade, playerState);
  }

  /**
   * Get all possible upgrades.
   */
  getAllUpgrades(): string[] {
    return Array.from(this.upgrades.keys());
  }

  /**
   * Add custom weight modifier.
   */
  addWeightModifier(upgradeId: string, modifier: number): void {
    this.weightModifiers.set(upgradeId, modifier);
  }

  /**
   * Get available evolutions for player.
   */
  getAvailableEvolutions(playerEntity: number): string[] {
    const playerState = this.getPlayerState(playerEntity);
    if (!playerState) return [];

    const evolutions: string[] = [];

    for (const [id, upgrade] of this.upgrades) {
      if (upgrade.type !== 'evolution') continue;
      if (this.isUpgradeAvailable(upgrade, playerState)) {
        evolutions.push(id);
      }
    }

    return evolutions;
  }

  // ============================================
  // Additional Methods
  // ============================================

  /**
   * Set callback to get player state.
   */
  setPlayerStateCallback(callback: (entity: number) => PlayerUpgradeState | null): void {
    this.getPlayerStateCallback = callback;
  }

  /**
   * Update cached player state.
   */
  updatePlayerState(entity: number, state: PlayerUpgradeState): void {
    this.playerStateCache.set(entity, state);
  }

  /**
   * Get upgrade entry by ID.
   */
  getUpgrade(upgradeId: string): UpgradeEntry | undefined {
    return this.upgrades.get(upgradeId);
  }

  /**
   * Register a new upgrade.
   */
  registerUpgrade(upgrade: UpgradeEntry): void {
    this.upgrades.set(upgrade.id, upgrade);
  }

  /**
   * Remove an upgrade from pool.
   */
  removeUpgrade(upgradeId: string): void {
    this.upgrades.delete(upgradeId);
  }

  /**
   * Get all upgrades of a specific type.
   */
  getUpgradesByType(type: 'weapon' | 'passive' | 'evolution'): UpgradeEntry[] {
    return Array.from(this.upgrades.values()).filter(u => u.type === type);
  }

  /**
   * Register an evolution recipe from WeaponEvolution system.
   * This allows external systems to add evolution upgrades.
   */
  registerEvolutionRecipe(recipe: {
    id: string;
    name: string;
    description: string;
    baseWeaponId: string;
    requiredPassiveId: string;
    evolvedWeaponId: string;
  }): void {
    const evolutionEntry: UpgradeEntry = {
      id: `evolution_${recipe.baseWeaponId}_${recipe.requiredPassiveId}`,
      name: recipe.name,
      description: recipe.description,
      type: 'evolution',
      rarity: WeaponRarity.Legendary,
      maxLevel: 1,
      weaponId: recipe.evolvedWeaponId,
      evolutionFrom: {
        weaponId: recipe.baseWeaponId,
        passiveId: recipe.requiredPassiveId,
      },
    };

    this.upgrades.set(evolutionEntry.id, evolutionEntry);
  }

  /**
   * Register multiple evolution recipes at once.
   */
  registerEvolutionRecipes(recipes: Array<{
    id: string;
    name: string;
    description: string;
    baseWeaponId: string;
    requiredPassiveId: string;
    evolvedWeaponId: string;
  }>): void {
    for (const recipe of recipes) {
      this.registerEvolutionRecipe(recipe);
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Initialize upgrades from weapon and passive definitions.
   */
  private initializeUpgrades(): void {
    // Add weapon upgrades
    const weapons = getAllWeaponDefinitions();
    for (const weapon of weapons) {
      this.upgrades.set(weapon.id, {
        id: weapon.id,
        name: weapon.name,
        description: weapon.description,
        type: 'weapon',
        rarity: weapon.rarity,
        maxLevel: weapon.maxLevel,
        weaponId: weapon.id,
      });
    }

    // Add passive upgrades
    for (const passive of PASSIVE_ITEMS) {
      this.upgrades.set(passive.id, {
        id: passive.id,
        name: passive.name,
        description: passive.description,
        type: 'passive',
        rarity: passive.rarity,
        maxLevel: passive.maxLevel,
        passiveId: passive.id,
      });
    }

    // Add evolution upgrades
    for (const weapon of weapons) {
      if (weapon.evolutionInto && weapon.evolutionWith) {
        const evolvedWeapon = getWeaponDefinition(weapon.evolutionInto);
        if (evolvedWeapon) {
          this.upgrades.set(`evolution_${weapon.id}`, {
            id: `evolution_${weapon.id}`,
            name: `${evolvedWeapon.name}`,
            description: `Evolve ${weapon.name} into ${evolvedWeapon.name}`,
            type: 'evolution',
            rarity: WeaponRarity.Legendary,
            maxLevel: 1,
            weaponId: weapon.evolutionInto,
            evolutionFrom: {
              weaponId: weapon.id,
              passiveId: weapon.evolutionWith[0],
            },
          });
        }
      }
    }
  }

  /**
   * Get player state.
   */
  private getPlayerState(entity: number): PlayerUpgradeState | null {
    // Try callback first
    if (this.getPlayerStateCallback) {
      const state = this.getPlayerStateCallback(entity);
      if (state) {
        this.playerStateCache.set(entity, state);
        return state;
      }
    }

    // Fall back to cache
    return this.playerStateCache.get(entity) ?? null;
  }

  /**
   * Get all available upgrades for player.
   */
  private getAvailableUpgradesForPlayer(playerState: PlayerUpgradeState): UpgradeEntry[] {
    const available: UpgradeEntry[] = [];

    for (const upgrade of this.upgrades.values()) {
      if (this.isUpgradeAvailable(upgrade, playerState)) {
        available.push(upgrade);
      }
    }

    return available;
  }

  /**
   * Check if specific upgrade is available.
   */
  private isUpgradeAvailable(upgrade: UpgradeEntry, state: PlayerUpgradeState): boolean {
    switch (upgrade.type) {
      case 'weapon': {
        const existing = state.weapons.find(w => w.weaponId === upgrade.weaponId);
        if (existing) {
          // Can upgrade if not max level
          return existing.level < upgrade.maxLevel;
        } else {
          // Can add if have slots
          return state.availableSlots > 0 || state.weapons.length < 6;
        }
      }

      case 'passive': {
        const existing = state.passives.find(p => p.passiveId === upgrade.passiveId);
        if (existing) {
          return existing.level < upgrade.maxLevel;
        } else {
          return state.passives.length < 6;
        }
      }

      case 'evolution': {
        if (!upgrade.evolutionFrom) return false;

        // Check if player has max level weapon and required passive
        const weapon = state.weapons.find(w => w.weaponId === upgrade.evolutionFrom!.weaponId);
        const passive = state.passives.find(p => p.passiveId === upgrade.evolutionFrom!.passiveId);

        const weaponDef = getWeaponDefinition(upgrade.evolutionFrom.weaponId);
        const maxLevel = weaponDef?.maxLevel ?? 8;

        return weapon !== undefined && weapon.level >= maxLevel && passive !== undefined;
      }

      default:
        return false;
    }
  }

  /**
   * Calculate weight for upgrade selection.
   */
  private calculateWeight(upgrade: UpgradeEntry, state: PlayerUpgradeState): number {
    let weight = RARITY_WEIGHTS[upgrade.rarity];

    // Apply custom modifier
    const customModifier = this.weightModifiers.get(upgrade.id);
    if (customModifier !== undefined) {
      weight *= customModifier;
    }

    // Apply upgrade-specific modifier
    if (upgrade.weightModifier !== undefined) {
      weight *= upgrade.weightModifier;
    }

    // Early game: prioritize new weapons
    if (state.level < 10 && upgrade.type === 'weapon') {
      const hasWeapon = state.weapons.some(w => w.weaponId === upgrade.weaponId);
      if (!hasWeapon) {
        weight *= 2.0; // Double weight for new weapons early
      }
    }

    // Evolutions get priority when available
    if (upgrade.type === 'evolution') {
      weight *= 3.0;
    }

    // Weapon upgrades slightly prioritized
    if (upgrade.type === 'weapon') {
      const existing = state.weapons.find(w => w.weaponId === upgrade.weaponId);
      if (existing && existing.level < 5) {
        weight *= 1.3; // Encourage leveling weapons
      }
    }

    return weight;
  }

  /**
   * Weighted random selection.
   */
  private weightedSelect<T extends { weight: number }>(items: T[]): T | null {
    if (items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) {
        return item;
      }
    }

    return items[items.length - 1];
  }
}

/**
 * Create upgrade pool with default settings.
 */
export function createUpgradePool(): UpgradePool {
  return new UpgradePool();
}
