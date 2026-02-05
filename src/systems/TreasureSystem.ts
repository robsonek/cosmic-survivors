/**
 * TreasureSystem - Manages treasure chest spawning and interaction
 *
 * Features:
 * - Random chest spawning every 60 seconds
 * - 3 tiers: Bronze (common), Silver (rare), Gold (epic)
 * - Proximity-based opening (2 seconds of standing near)
 * - Rewards: XP burst, temporary power-up, heal, or weapon upgrade
 * - Visual effects: glowing chest sprite, particles when opened
 * - Sound event triggers
 * - Integrates with existing PowerUpSystem for power-up rewards
 */

import * as Phaser from 'phaser';
import { PowerUpType } from './PowerUpSystem';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Treasure chest tiers with different drop rates and rewards
 */
export enum ChestTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
}

/**
 * Reward types that can drop from chests
 */
export enum RewardType {
  XP_BURST = 'xp_burst',
  POWER_UP = 'power_up',
  HEAL = 'heal',
  WEAPON_UPGRADE = 'weapon_upgrade',
}

// Re-export PowerUpType for convenience
export { PowerUpType };

/**
 * Configuration for each chest tier
 */
export interface IChestTierConfig {
  tier: ChestTier;
  spawnWeight: number;
  color: number;
  glowColor: number;
  glowIntensity: number;
  xpMultiplier: number;
  healMultiplier: number;
  powerUpDuration: number;
  rewardWeights: Record<RewardType, number>;
}

/**
 * Represents a spawned treasure chest
 */
export interface ITreasureChest {
  id: string;
  x: number;
  y: number;
  tier: ChestTier;
  openProgress: number;
  isOpening: boolean;
  isOpened: boolean;
  sprite: Phaser.GameObjects.Sprite | null;
  glowGraphics: Phaser.GameObjects.Graphics | null;
  progressBar: Phaser.GameObjects.Graphics | null;
  particles: Phaser.GameObjects.Particles.ParticleEmitter | null;
}

/**
 * Reward data structure
 */
export interface IChestReward {
  type: RewardType;
  value: number;
  powerUpType?: PowerUpType;
  duration?: number;
}

/**
 * Active power-up tracking
 */
export interface IActivePowerUp {
  type: PowerUpType;
  remainingTime: number;
  multiplier: number;
}

/**
 * Event callback types
 */
export type ChestSpawnCallback = (chest: ITreasureChest) => void;
export type ChestOpenCallback = (chest: ITreasureChest, reward: IChestReward) => void;
export type PowerUpActivateCallback = (powerUp: IActivePowerUp) => void;
export type PowerUpExpireCallback = (type: PowerUpType) => void;

// ============================================================================
// Chest Tier Configurations
// ============================================================================

const CHEST_TIER_CONFIGS: Record<ChestTier, IChestTierConfig> = {
  [ChestTier.BRONZE]: {
    tier: ChestTier.BRONZE,
    spawnWeight: 60,
    color: 0xcd7f32,     // Bronze color
    glowColor: 0xffa500, // Orange glow
    glowIntensity: 0.4,
    xpMultiplier: 1.0,
    healMultiplier: 1.0,
    powerUpDuration: 5,  // 5 seconds
    rewardWeights: {
      [RewardType.XP_BURST]: 40,
      [RewardType.POWER_UP]: 25,
      [RewardType.HEAL]: 30,
      [RewardType.WEAPON_UPGRADE]: 5,
    },
  },
  [ChestTier.SILVER]: {
    tier: ChestTier.SILVER,
    spawnWeight: 30,
    color: 0xc0c0c0,     // Silver color
    glowColor: 0x87ceeb, // Sky blue glow
    glowIntensity: 0.6,
    xpMultiplier: 2.0,
    healMultiplier: 1.5,
    powerUpDuration: 8,  // 8 seconds
    rewardWeights: {
      [RewardType.XP_BURST]: 30,
      [RewardType.POWER_UP]: 30,
      [RewardType.HEAL]: 25,
      [RewardType.WEAPON_UPGRADE]: 15,
    },
  },
  [ChestTier.GOLD]: {
    tier: ChestTier.GOLD,
    spawnWeight: 10,
    color: 0xffd700,     // Gold color
    glowColor: 0xffff00, // Yellow glow
    glowIntensity: 0.8,
    xpMultiplier: 4.0,
    healMultiplier: 2.5,
    powerUpDuration: 12, // 12 seconds
    rewardWeights: {
      [RewardType.XP_BURST]: 20,
      [RewardType.POWER_UP]: 25,
      [RewardType.HEAL]: 20,
      [RewardType.WEAPON_UPGRADE]: 35,
    },
  },
};

// ============================================================================
// Power-up Configurations for Chest Rewards
// Maps to existing PowerUpSystem types
// ============================================================================

const CHEST_POWER_UP_CONFIGS: Record<string, { type: PowerUpType; name: string; color: number }> = {
  damage: {
    type: PowerUpType.DoubleDamage,
    name: 'Double Damage',
    color: 0xff4444,
  },
  speed: {
    type: PowerUpType.SpeedBoost,
    name: 'Speed Boost',
    color: 0x4488ff,
  },
  fire_rate: {
    type: PowerUpType.RapidFire,
    name: 'Rapid Fire',
    color: 0xff8800,
  },
  invincibility: {
    type: PowerUpType.Invincibility,
    name: 'Invincibility',
    color: 0xffff00,
  },
  magnet: {
    type: PowerUpType.Magnet,
    name: 'Super Magnet',
    color: 0x44ff44,
  },
  multishot: {
    type: PowerUpType.MultiShot,
    name: 'Multi-Shot',
    color: 0xaa44ff,
  },
};

// Array of power-up keys for random selection
const CHEST_POWER_UP_KEYS = Object.keys(CHEST_POWER_UP_CONFIGS);

// ============================================================================
// TreasureSystem Class
// ============================================================================

export class TreasureSystem {
  private static instance: TreasureSystem | null = null;

  // Configuration
  private readonly spawnInterval: number = 60;        // Seconds between spawns
  private readonly openTime: number = 2.0;            // Seconds to open chest
  private readonly openRadius: number = 80;           // Pixels to be near chest
  private readonly baseXPReward: number = 100;        // Base XP reward
  private readonly baseHealAmount: number = 30;       // Base heal amount
  private readonly maxChestsOnScreen: number = 3;     // Maximum chests at once

  // State
  private chests: Map<string, ITreasureChest> = new Map();
  private spawnTimer: number = 0;
  private chestIdCounter: number = 0;
  private isEnabled: boolean = true;

  // Callbacks
  private onChestSpawn?: ChestSpawnCallback;
  private onChestOpen?: ChestOpenCallback;
  private onPowerUpActivate?: PowerUpActivateCallback;
  private _onPowerUpExpire?: PowerUpExpireCallback;

  // Sound event names
  public static readonly SOUND_CHEST_SPAWN = 'sfx_chest_spawn';
  public static readonly SOUND_CHEST_OPEN = 'sfx_chest_open';
  public static readonly SOUND_POWER_UP = 'sfx_power_up';

  // ========================================================================
  // Singleton Pattern
  // ========================================================================

  private constructor() {}

  public static getInstance(): TreasureSystem {
    if (!TreasureSystem.instance) {
      TreasureSystem.instance = new TreasureSystem();
    }
    return TreasureSystem.instance;
  }

  public static resetInstance(): void {
    TreasureSystem.instance = null;
  }

  // ========================================================================
  // Initialization & Reset
  // ========================================================================

  public reset(): void {
    this.chests.clear();
    this.spawnTimer = 0;
    this.chestIdCounter = 0;
    this.isEnabled = true;
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  // ========================================================================
  // Update Loop
  // ========================================================================

  /**
   * Main update method - call every frame
   * @param dt Delta time in seconds
   * @param playerX Player X position
   * @param playerY Player Y position
   * @param screenWidth Screen width for spawn bounds
   * @param screenHeight Screen height for spawn bounds
   */
  public update(
    dt: number,
    playerX: number,
    playerY: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    if (!this.isEnabled) return;

    // Update spawn timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.chests.size < this.maxChestsOnScreen) {
      this.spawnTimer = 0;
      this.spawnRandomChest(screenWidth, screenHeight, playerX, playerY);
    }

    // Update chest interactions
    this.updateChestInteractions(dt, playerX, playerY);

    // Update active power-ups
    this.updatePowerUps(dt);
  }

  // ========================================================================
  // Chest Spawning
  // ========================================================================

  /**
   * Spawn a chest at a random location
   */
  private spawnRandomChest(
    screenWidth: number,
    screenHeight: number,
    playerX: number,
    playerY: number
  ): ITreasureChest {
    // Random position with margin and away from player
    const margin = 100;
    let x: number, y: number;
    let attempts = 0;
    const minDistFromPlayer = 200;

    do {
      x = Phaser.Math.Between(margin, screenWidth - margin);
      y = Phaser.Math.Between(margin, screenHeight - margin);
      attempts++;
    } while (
      Phaser.Math.Distance.Between(x, y, playerX, playerY) < minDistFromPlayer &&
      attempts < 10
    );

    // Select random tier based on weights
    const tier = this.selectRandomTier();

    return this.createChest(x, y, tier);
  }

  /**
   * Create a chest at specific position
   */
  public createChest(x: number, y: number, tier: ChestTier): ITreasureChest {
    const id = `chest_${++this.chestIdCounter}`;

    const chest: ITreasureChest = {
      id,
      x,
      y,
      tier,
      openProgress: 0,
      isOpening: false,
      isOpened: false,
      sprite: null,
      glowGraphics: null,
      progressBar: null,
      particles: null,
    };

    this.chests.set(id, chest);

    // Trigger callback
    this.onChestSpawn?.(chest);

    return chest;
  }

  /**
   * Force spawn a chest immediately (for testing or events)
   */
  public forceSpawnChest(
    screenWidth: number,
    screenHeight: number,
    playerX: number,
    playerY: number,
    tier?: ChestTier
  ): ITreasureChest {
    const margin = 100;
    let x: number, y: number;
    let attempts = 0;
    const minDistFromPlayer = 150;

    do {
      x = Phaser.Math.Between(margin, screenWidth - margin);
      y = Phaser.Math.Between(margin, screenHeight - margin);
      attempts++;
    } while (
      Phaser.Math.Distance.Between(x, y, playerX, playerY) < minDistFromPlayer &&
      attempts < 10
    );

    return this.createChest(x, y, tier ?? this.selectRandomTier());
  }

  /**
   * Select a random tier based on spawn weights
   */
  private selectRandomTier(): ChestTier {
    const totalWeight = Object.values(CHEST_TIER_CONFIGS).reduce(
      (sum, config) => sum + config.spawnWeight,
      0
    );

    let random = Math.random() * totalWeight;

    for (const config of Object.values(CHEST_TIER_CONFIGS)) {
      random -= config.spawnWeight;
      if (random <= 0) {
        return config.tier;
      }
    }

    return ChestTier.BRONZE;
  }

  // ========================================================================
  // Chest Interaction
  // ========================================================================

  /**
   * Update chest open progress based on player proximity
   */
  private updateChestInteractions(dt: number, playerX: number, playerY: number): void {
    for (const [id, chest] of this.chests) {
      if (chest.isOpened) continue;

      const distance = Phaser.Math.Distance.Between(playerX, playerY, chest.x, chest.y);

      if (distance <= this.openRadius) {
        // Player is in range - start/continue opening
        chest.isOpening = true;
        chest.openProgress += dt;

        if (chest.openProgress >= this.openTime) {
          this.openChest(id);
        }
      } else {
        // Player left range - reset progress
        if (chest.isOpening) {
          chest.isOpening = false;
          chest.openProgress = Math.max(0, chest.openProgress - dt * 2); // Decay faster
        }
      }
    }
  }

  /**
   * Open a chest and generate reward
   */
  private openChest(chestId: string): void {
    const chest = this.chests.get(chestId);
    if (!chest || chest.isOpened) return;

    chest.isOpened = true;
    chest.openProgress = this.openTime;

    // Generate reward
    const reward = this.generateReward(chest.tier);

    // Trigger callback
    this.onChestOpen?.(chest, reward);

    // Apply reward
    this.applyReward(reward, chest.tier);
  }

  /**
   * Generate a reward based on chest tier
   */
  private generateReward(tier: ChestTier): IChestReward {
    const config = CHEST_TIER_CONFIGS[tier];
    const rewardType = this.selectWeightedReward(config.rewardWeights);

    const reward: IChestReward = {
      type: rewardType,
      value: 0,
    };

    switch (rewardType) {
      case RewardType.XP_BURST:
        reward.value = Math.floor(this.baseXPReward * config.xpMultiplier);
        break;

      case RewardType.HEAL:
        reward.value = Math.floor(this.baseHealAmount * config.healMultiplier);
        break;

      case RewardType.POWER_UP:
        // Select a random power-up from available chest power-ups
        const randomKey = CHEST_POWER_UP_KEYS[Math.floor(Math.random() * CHEST_POWER_UP_KEYS.length)];
        const powerUpConfig = CHEST_POWER_UP_CONFIGS[randomKey];
        reward.powerUpType = powerUpConfig.type;
        reward.duration = config.powerUpDuration;
        reward.value = 1; // Value is handled by PowerUpSystem
        break;

      case RewardType.WEAPON_UPGRADE:
        reward.value = 1; // One weapon level upgrade
        break;
    }

    return reward;
  }

  /**
   * Select a reward type based on weights
   */
  private selectWeightedReward(weights: Record<RewardType, number>): RewardType {
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return type as RewardType;
      }
    }

    return RewardType.XP_BURST;
  }

  /**
   * Apply the reward effect
   * Note: Power-ups are now handled externally via callbacks to integrate with PowerUpSystem
   */
  private applyReward(reward: IChestReward, tier: ChestTier): void {
    if (reward.type === RewardType.POWER_UP && reward.powerUpType) {
      // Create a lightweight power-up info for the callback
      // The actual power-up activation is handled by the callback in GameScene
      const powerUp: IActivePowerUp = {
        type: reward.powerUpType,
        remainingTime: reward.duration ?? CHEST_TIER_CONFIGS[tier].powerUpDuration,
        multiplier: 1, // Multiplier is handled by PowerUpSystem
      };

      // Don't track power-ups internally - let PowerUpSystem handle it
      this.onPowerUpActivate?.(powerUp);
    }
  }

  /**
   * Remove a chest from tracking
   */
  public removeChest(chestId: string): void {
    const chest = this.chests.get(chestId);
    if (chest) {
      // Clean up visual elements
      chest.sprite?.destroy();
      chest.glowGraphics?.destroy();
      chest.progressBar?.destroy();
      chest.particles?.destroy();
      this.chests.delete(chestId);
    }
  }

  // ========================================================================
  // Power-up Management (delegated to PowerUpSystem)
  // ========================================================================

  /**
   * Update power-ups - no longer needed as PowerUpSystem handles this
   * Kept as empty method for interface compatibility
   */
  private updatePowerUps(_dt: number): void {
    // Power-ups are now managed by the external PowerUpSystem
    // This method is kept for potential future use
  }

  // ========================================================================
  // Event Callbacks
  // ========================================================================

  public setOnChestSpawn(callback: ChestSpawnCallback): void {
    this.onChestSpawn = callback;
  }

  public setOnChestOpen(callback: ChestOpenCallback): void {
    this.onChestOpen = callback;
  }

  public setOnPowerUpActivate(callback: PowerUpActivateCallback): void {
    this.onPowerUpActivate = callback;
  }

  public setOnPowerUpExpire(callback: PowerUpExpireCallback): void {
    this._onPowerUpExpire = callback;
  }

  // ========================================================================
  // Getters
  // ========================================================================

  public getChests(): ITreasureChest[] {
    return Array.from(this.chests.values());
  }

  public getChest(id: string): ITreasureChest | undefined {
    return this.chests.get(id);
  }

  public getChestCount(): number {
    return this.chests.size;
  }

  public getTimeUntilNextSpawn(): number {
    return Math.max(0, this.spawnInterval - this.spawnTimer);
  }

  public getOpenRadius(): number {
    return this.openRadius;
  }

  public getOpenTime(): number {
    return this.openTime;
  }

  public getTierConfig(tier: ChestTier): IChestTierConfig {
    return CHEST_TIER_CONFIGS[tier];
  }

  /**
   * Get power-up display info for a given type
   */
  public getPowerUpDisplayInfo(type: PowerUpType): { name: string; color: number } | undefined {
    for (const config of Object.values(CHEST_POWER_UP_CONFIGS)) {
      if (config.type === type) {
        return { name: config.name, color: config.color };
      }
    }
    return undefined;
  }
}

// ============================================================================
// Default Export & Convenience
// ============================================================================

/**
 * Get the singleton treasure system instance
 */
export const getTreasureSystem = (): TreasureSystem => TreasureSystem.getInstance();

export default TreasureSystem;
