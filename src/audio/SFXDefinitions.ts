/**
 * SFXDefinitions - Sound effect keys and configurations.
 *
 * Central registry of all sound effect asset keys used in the game.
 * These keys correspond to loaded audio assets.
 */

/**
 * All available SFX keys in the game.
 */
export const SFXKeys = {
  // Weapons
  WEAPON_FIRE_WAND: 'sfx_wand_fire',
  WEAPON_FIRE_KNIFE: 'sfx_knife_throw',
  WEAPON_FIRE_WHIP: 'sfx_whip_crack',
  WEAPON_GARLIC: 'sfx_garlic_pulse',
  WEAPON_FIRE_GENERIC: 'sfx_weapon_fire',

  // Combat
  HIT_ENEMY: 'sfx_hit_enemy',
  HIT_PLAYER: 'sfx_hit_player',
  CRITICAL_HIT: 'sfx_critical',
  ENEMY_DEATH: 'sfx_enemy_death',
  PLAYER_DEATH: 'sfx_player_death',

  // Pickups
  PICKUP_XP: 'sfx_pickup_xp',
  PICKUP_HEALTH: 'sfx_pickup_health',
  PICKUP_CHEST: 'sfx_chest_open',
  PICKUP_MAGNET: 'sfx_pickup_magnet',
  PICKUP_COIN: 'sfx_pickup_coin',

  // UI
  UI_CLICK: 'sfx_ui_click',
  UI_HOVER: 'sfx_ui_hover',
  UI_BACK: 'sfx_ui_back',
  UI_CONFIRM: 'sfx_ui_confirm',
  LEVEL_UP: 'sfx_level_up',
  UPGRADE_SELECT: 'sfx_upgrade_select',

  // Game Events
  WAVE_START: 'sfx_wave_start',
  WAVE_COMPLETE: 'sfx_wave_complete',
  BOSS_SPAWN: 'sfx_boss_spawn',
  BOSS_DEATH: 'sfx_boss_death',
  GAME_OVER: 'sfx_game_over',
  VICTORY: 'sfx_victory',

  // Player
  PLAYER_HURT: 'sfx_player_hurt',
  PLAYER_HEAL: 'sfx_player_heal',
  DASH: 'sfx_dash',

  // Environment
  EXPLOSION: 'sfx_explosion',
  AMBIENT_LOOP: 'sfx_ambient_loop',
} as const;

/** Type for SFX keys */
export type SFXKey = (typeof SFXKeys)[keyof typeof SFXKeys];

/**
 * SFX configuration with default settings.
 */
export interface SFXConfig {
  key: SFXKey;
  volume: number;
  pitchVariation: number; // Random pitch range (+/-)
  priority: number; // Higher = more important (won't be cut)
  cooldown: number; // Min time between plays (ms)
  poolSize: number; // Pre-allocated pool size
  spatial: boolean; // Use spatial audio by default
}

/**
 * Default configurations for SFX.
 * Override these in specific play calls as needed.
 */
export const SFXConfigs: Partial<Record<SFXKey, Partial<SFXConfig>>> = {
  // Weapons - medium priority, small pitch variation
  [SFXKeys.WEAPON_FIRE_WAND]: {
    volume: 0.6,
    pitchVariation: 0.1,
    priority: 5,
    cooldown: 50,
    poolSize: 8,
    spatial: true,
  },
  [SFXKeys.WEAPON_FIRE_KNIFE]: {
    volume: 0.5,
    pitchVariation: 0.15,
    priority: 5,
    cooldown: 30,
    poolSize: 10,
    spatial: true,
  },
  [SFXKeys.WEAPON_FIRE_WHIP]: {
    volume: 0.7,
    pitchVariation: 0.1,
    priority: 5,
    cooldown: 100,
    poolSize: 4,
    spatial: true,
  },
  [SFXKeys.WEAPON_GARLIC]: {
    volume: 0.4,
    pitchVariation: 0.05,
    priority: 3,
    cooldown: 500,
    poolSize: 2,
    spatial: true,
  },

  // Combat - varied priorities
  [SFXKeys.HIT_ENEMY]: {
    volume: 0.4,
    pitchVariation: 0.2,
    priority: 3,
    cooldown: 10,
    poolSize: 16,
    spatial: true,
  },
  [SFXKeys.HIT_PLAYER]: {
    volume: 0.8,
    pitchVariation: 0.1,
    priority: 8,
    cooldown: 100,
    poolSize: 4,
    spatial: false,
  },
  [SFXKeys.CRITICAL_HIT]: {
    volume: 0.7,
    pitchVariation: 0.1,
    priority: 6,
    cooldown: 50,
    poolSize: 8,
    spatial: true,
  },
  [SFXKeys.ENEMY_DEATH]: {
    volume: 0.5,
    pitchVariation: 0.25,
    priority: 4,
    cooldown: 10,
    poolSize: 16,
    spatial: true,
  },

  // Pickups - low priority, high pitch variation
  [SFXKeys.PICKUP_XP]: {
    volume: 0.3,
    pitchVariation: 0.3,
    priority: 2,
    cooldown: 20,
    poolSize: 12,
    spatial: true,
  },
  [SFXKeys.PICKUP_HEALTH]: {
    volume: 0.6,
    pitchVariation: 0.1,
    priority: 5,
    cooldown: 100,
    poolSize: 4,
    spatial: false,
  },
  [SFXKeys.PICKUP_CHEST]: {
    volume: 0.8,
    pitchVariation: 0.05,
    priority: 7,
    cooldown: 200,
    poolSize: 2,
    spatial: false,
  },

  // UI - high priority, no spatial
  [SFXKeys.UI_CLICK]: {
    volume: 0.5,
    pitchVariation: 0.05,
    priority: 9,
    cooldown: 50,
    poolSize: 4,
    spatial: false,
  },
  [SFXKeys.UI_HOVER]: {
    volume: 0.3,
    pitchVariation: 0.05,
    priority: 8,
    cooldown: 30,
    poolSize: 4,
    spatial: false,
  },
  [SFXKeys.LEVEL_UP]: {
    volume: 0.9,
    pitchVariation: 0,
    priority: 10,
    cooldown: 500,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.UPGRADE_SELECT]: {
    volume: 0.7,
    pitchVariation: 0,
    priority: 9,
    cooldown: 100,
    poolSize: 2,
    spatial: false,
  },

  // Game Events - highest priority
  [SFXKeys.WAVE_START]: {
    volume: 0.8,
    pitchVariation: 0,
    priority: 10,
    cooldown: 1000,
    poolSize: 1,
    spatial: false,
  },
  [SFXKeys.BOSS_SPAWN]: {
    volume: 1.0,
    pitchVariation: 0,
    priority: 10,
    cooldown: 2000,
    poolSize: 1,
    spatial: false,
  },
  [SFXKeys.GAME_OVER]: {
    volume: 0.9,
    pitchVariation: 0,
    priority: 10,
    cooldown: 0,
    poolSize: 1,
    spatial: false,
  },
};

/**
 * Get SFX config with defaults.
 */
export function getSFXConfig(key: SFXKey): SFXConfig {
  const config = SFXConfigs[key] ?? {};
  return {
    key,
    volume: config.volume ?? 1.0,
    pitchVariation: config.pitchVariation ?? 0,
    priority: config.priority ?? 5,
    cooldown: config.cooldown ?? 0,
    poolSize: config.poolSize ?? 4,
    spatial: config.spatial ?? true,
  };
}

/**
 * Map weapon IDs to SFX keys.
 */
export const WeaponSFXMap: Record<string, SFXKey> = {
  fire_wand: SFXKeys.WEAPON_FIRE_WAND,
  magic_wand: SFXKeys.WEAPON_FIRE_WAND,
  knife: SFXKeys.WEAPON_FIRE_KNIFE,
  whip: SFXKeys.WEAPON_FIRE_WHIP,
  garlic: SFXKeys.WEAPON_GARLIC,
};

/**
 * Get weapon fire SFX key.
 */
export function getWeaponSFX(weaponId: string): SFXKey {
  return WeaponSFXMap[weaponId] ?? SFXKeys.WEAPON_FIRE_GENERIC;
}
