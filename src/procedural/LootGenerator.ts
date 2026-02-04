/**
 * LootGenerator - Procedural loot and pickup generation.
 *
 * Handles:
 * - Enemy death drops (XP, health, special items)
 * - Chest loot
 * - Boss loot
 * - Loot tables with weighted probabilities
 *
 * Implements ILootGenerator interface.
 */

import type {
  ILootGenerator,
  ILootConfig,
  ILootDrop,
  ILootTableEntry,
  LootType,
} from '../shared/interfaces/IProcedural';
import { LootType as LootTypeEnum } from '../shared/interfaces/IProcedural';
import { WeaponRarity } from '../shared/interfaces/IWeapon';
import { randomRange, randomInt } from '../shared/utils/math';

/**
 * Default loot table entries.
 */
const DEFAULT_LOOT_TABLE: ILootTableEntry[] = [
  { type: LootTypeEnum.XPOrb, weight: 100, minValue: 1, maxValue: 3 },
  { type: LootTypeEnum.Health, weight: 5, minValue: 10, maxValue: 20 },
  { type: LootTypeEnum.Magnet, weight: 0.5 },
  { type: LootTypeEnum.Bomb, weight: 0.3 },
  { type: LootTypeEnum.Clock, weight: 0.2 },
  { type: LootTypeEnum.Gold, weight: 10, minValue: 1, maxValue: 5 },
];

/**
 * Chest loot configuration by rarity.
 */
const CHEST_LOOT_CONFIG: Record<
  WeaponRarity,
  { xpMultiplier: number; goldMultiplier: number; upgradeChance: number }
> = {
  [WeaponRarity.Common]: { xpMultiplier: 1, goldMultiplier: 1, upgradeChance: 0.3 },
  [WeaponRarity.Uncommon]: { xpMultiplier: 1.5, goldMultiplier: 2, upgradeChance: 0.5 },
  [WeaponRarity.Rare]: { xpMultiplier: 2, goldMultiplier: 3, upgradeChance: 0.7 },
  [WeaponRarity.Epic]: { xpMultiplier: 3, goldMultiplier: 5, upgradeChance: 0.85 },
  [WeaponRarity.Legendary]: { xpMultiplier: 5, goldMultiplier: 10, upgradeChance: 1.0 },
};

/**
 * Boss loot configuration.
 */
interface BossLootConfig {
  xpMultiplier: number;
  guaranteedDrops: LootType[];
  specialDropChance: number;
}

const BOSS_LOOT_CONFIGS: Record<string, BossLootConfig> = {
  default: {
    xpMultiplier: 10,
    guaranteedDrops: [LootTypeEnum.XPOrb, LootTypeEnum.Chest],
    specialDropChance: 0.5,
  },
  ogre: {
    xpMultiplier: 15,
    guaranteedDrops: [LootTypeEnum.XPOrb, LootTypeEnum.Health],
    specialDropChance: 0.3,
  },
};

/**
 * LootGenerator implementation.
 */
export class LootGenerator implements ILootGenerator {
  /** Current loot table */
  private lootTable: ILootTableEntry[];

  /** Total weight for probability calculation */
  private totalWeight: number;

  /** XP scaling based on difficulty/level */
  private xpScaling = 1.0;

  /** Drop rate modifier */
  private dropRateModifier = 1.0;

  constructor(lootTable?: ILootTableEntry[]) {
    this.lootTable = lootTable ?? [...DEFAULT_LOOT_TABLE];
    this.totalWeight = this.calculateTotalWeight();
  }

  // ============================================
  // ILootGenerator Implementation
  // ============================================

  /**
   * Generate loot from killed enemy.
   */
  generateEnemyLoot(config: ILootConfig): ILootDrop[] {
    const drops: ILootDrop[] = [];
    const { x, y, xpValue, healthDropChance, extraDrops } = config;

    // Always drop XP orbs
    const scaledXP = Math.floor(xpValue * this.xpScaling);
    if (scaledXP > 0) {
      drops.push({
        type: LootTypeEnum.XPOrb,
        x: x + randomRange(-10, 10),
        y: y + randomRange(-10, 10),
        value: scaledXP,
      });
    }

    // Chance to drop health
    if (Math.random() < healthDropChance * this.dropRateModifier) {
      const healthEntry = this.getEntryForType(LootTypeEnum.Health);
      const healAmount = healthEntry
        ? randomInt(healthEntry.minValue ?? 10, healthEntry.maxValue ?? 20)
        : 15;

      drops.push({
        type: LootTypeEnum.Health,
        x: x + randomRange(-15, 15),
        y: y + randomRange(-15, 15),
        value: healAmount,
      });
    }

    // Process extra drops
    if (extraDrops) {
      for (const extra of extraDrops) {
        if (Math.random() < extra.chance * this.dropRateModifier) {
          drops.push({
            type: extra.type,
            x: x + randomRange(-20, 20),
            y: y + randomRange(-20, 20),
            value: extra.value ?? 1,
          });
        }
      }
    }

    // Random special drops from loot table
    const specialDrop = this.rollLootTable();
    if (specialDrop && specialDrop.type !== LootTypeEnum.XPOrb) {
      drops.push({
        type: specialDrop.type,
        x: x + randomRange(-15, 15),
        y: y + randomRange(-15, 15),
        value: specialDrop.minValue
          ? randomInt(specialDrop.minValue, specialDrop.maxValue ?? specialDrop.minValue)
          : 1,
        rarity: specialDrop.rarity,
      });
    }

    return drops;
  }

  /**
   * Generate loot from chest.
   */
  generateChestLoot(rarity: WeaponRarity): ILootDrop[] {
    const drops: ILootDrop[] = [];
    const config = CHEST_LOOT_CONFIG[rarity];

    // Base position (will be set when spawning)
    const x = 0;
    const y = 0;

    // XP reward
    const baseXP = 50 + this.getRarityValue(rarity) * 20;
    drops.push({
      type: LootTypeEnum.XPOrb,
      x,
      y,
      value: Math.floor(baseXP * config.xpMultiplier * this.xpScaling),
    });

    // Gold reward
    const baseGold = 10 + this.getRarityValue(rarity) * 10;
    drops.push({
      type: LootTypeEnum.Gold,
      x: x + 20,
      y,
      value: Math.floor(baseGold * config.goldMultiplier),
    });

    // Upgrade/weapon chance
    if (Math.random() < config.upgradeChance) {
      drops.push({
        type: LootTypeEnum.Chest, // Represents upgrade choice
        x,
        y: y + 20,
        value: 1,
        rarity,
        upgradeId: this.getRandomUpgradeId(rarity),
      });
    }

    // Special items for rare+ chests
    if (this.getRarityValue(rarity) >= 2) {
      const specialType = this.getRandomSpecialItem();
      if (specialType) {
        drops.push({
          type: specialType,
          x: x - 20,
          y,
          value: 1,
        });
      }
    }

    return drops;
  }

  /**
   * Generate boss loot.
   */
  generateBossLoot(bossId: string): ILootDrop[] {
    const drops: ILootDrop[] = [];
    const config = BOSS_LOOT_CONFIGS[bossId] ?? BOSS_LOOT_CONFIGS.default;

    const x = 0;
    const y = 0;

    // Large XP reward
    const baseXP = 100 * config.xpMultiplier;
    drops.push({
      type: LootTypeEnum.XPOrb,
      x,
      y,
      value: Math.floor(baseXP * this.xpScaling),
    });

    // Guaranteed drops
    for (let i = 0; i < config.guaranteedDrops.length; i++) {
      const dropType = config.guaranteedDrops[i];
      const offset = i * 30;

      if (dropType === LootTypeEnum.Chest) {
        drops.push({
          type: dropType,
          x: x + offset,
          y,
          value: 1,
          rarity: this.getBossChestRarity(),
          upgradeId: this.getRandomUpgradeId(WeaponRarity.Rare),
        });
      } else {
        drops.push({
          type: dropType,
          x: x + offset,
          y,
          value: this.getDefaultValue(dropType),
        });
      }
    }

    // Special drops
    if (Math.random() < config.specialDropChance) {
      const specialType = this.getRandomSpecialItem();
      if (specialType) {
        drops.push({
          type: specialType,
          x: x - 30,
          y,
          value: 1,
        });
      }
    }

    // Gold
    drops.push({
      type: LootTypeEnum.Gold,
      x,
      y: y + 30,
      value: randomInt(50, 100),
    });

    return drops;
  }

  /**
   * Set the loot table.
   */
  setLootTable(entries: ILootTableEntry[]): void {
    this.lootTable = entries;
    this.totalWeight = this.calculateTotalWeight();
  }

  /**
   * Get drop chance for a specific loot type.
   */
  getDropChance(type: LootType): number {
    const entry = this.getEntryForType(type);
    if (!entry) return 0;
    return (entry.weight / this.totalWeight) * this.dropRateModifier;
  }

  // ============================================
  // Additional Methods
  // ============================================

  /**
   * Set XP scaling multiplier.
   */
  setXPScaling(multiplier: number): void {
    this.xpScaling = multiplier;
  }

  /**
   * Set drop rate modifier.
   */
  setDropRateModifier(modifier: number): void {
    this.dropRateModifier = modifier;
  }

  /**
   * Add entry to loot table.
   */
  addLootEntry(entry: ILootTableEntry): void {
    this.lootTable.push(entry);
    this.totalWeight = this.calculateTotalWeight();
  }

  /**
   * Remove entry from loot table by type.
   */
  removeLootEntry(type: LootType): void {
    this.lootTable = this.lootTable.filter(e => e.type !== type);
    this.totalWeight = this.calculateTotalWeight();
  }

  /**
   * Calculate XP orb value based on enemy stats.
   */
  calculateXPValue(baseXP: number, waveNumber: number, isElite: boolean): number {
    let xp = baseXP * this.xpScaling;

    // Wave scaling: 10% more XP per 5 waves
    xp *= 1 + Math.floor(waveNumber / 5) * 0.1;

    // Elite bonus
    if (isElite) {
      xp *= 2;
    }

    return Math.floor(xp);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Calculate total weight of loot table.
   */
  private calculateTotalWeight(): number {
    return this.lootTable.reduce((sum, entry) => sum + entry.weight, 0);
  }

  /**
   * Get loot table entry for type.
   */
  private getEntryForType(type: LootType): ILootTableEntry | undefined {
    return this.lootTable.find(e => e.type === type);
  }

  /**
   * Roll loot table and get a drop (may return null for no special drop).
   */
  private rollLootTable(): ILootTableEntry | null {
    // Only 10% chance to roll special drop at all
    if (Math.random() > 0.1 * this.dropRateModifier) {
      return null;
    }

    const roll = Math.random() * this.totalWeight;
    let cumulative = 0;

    for (const entry of this.lootTable) {
      cumulative += entry.weight;
      if (roll <= cumulative) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Get numeric value for rarity.
   */
  private getRarityValue(rarity: WeaponRarity): number {
    const values: Record<WeaponRarity, number> = {
      [WeaponRarity.Common]: 0,
      [WeaponRarity.Uncommon]: 1,
      [WeaponRarity.Rare]: 2,
      [WeaponRarity.Epic]: 3,
      [WeaponRarity.Legendary]: 4,
    };
    return values[rarity];
  }

  /**
   * Get random special item type.
   */
  private getRandomSpecialItem(): LootType | null {
    const specialItems: LootType[] = [
      LootTypeEnum.Magnet,
      LootTypeEnum.Bomb,
      LootTypeEnum.Clock,
    ];

    if (Math.random() < 0.3) {
      return specialItems[randomInt(0, specialItems.length - 1)];
    }

    return null;
  }

  /**
   * Get default value for loot type.
   */
  private getDefaultValue(type: LootType): number {
    switch (type) {
      case LootTypeEnum.XPOrb:
        return 10;
      case LootTypeEnum.Health:
        return 25;
      case LootTypeEnum.Gold:
        return 10;
      default:
        return 1;
    }
  }

  /**
   * Get chest rarity from boss.
   */
  private getBossChestRarity(): WeaponRarity {
    const roll = Math.random();
    if (roll < 0.5) return WeaponRarity.Rare;
    if (roll < 0.85) return WeaponRarity.Epic;
    return WeaponRarity.Legendary;
  }

  /**
   * Get random upgrade ID (placeholder - should integrate with UpgradePool).
   */
  private getRandomUpgradeId(_rarity: WeaponRarity): string {
    // This is a placeholder. In actual implementation,
    // this should query the UpgradePool for available upgrades.
    const upgrades = ['magicWand', 'knife', 'garlic', 'whip', 'fireWand'];
    return upgrades[randomInt(0, upgrades.length - 1)];
  }
}

/**
 * Create loot generator with default or custom loot table.
 */
export function createLootGenerator(lootTable?: ILootTableEntry[]): LootGenerator {
  return new LootGenerator(lootTable);
}
