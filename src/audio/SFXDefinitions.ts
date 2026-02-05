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
  // Weapons - per weapon type
  WEAPON_FIRE_WAND: 'sfx_wand_fire',
  WEAPON_FIRE_KNIFE: 'sfx_knife_throw',
  WEAPON_FIRE_WHIP: 'sfx_whip_crack',
  WEAPON_GARLIC: 'sfx_garlic_pulse',
  WEAPON_FIRE_GENERIC: 'sfx_weapon_fire',
  WEAPON_FIRE_BOLT: 'sfx_fire_bolt',
  WEAPON_CROSS: 'sfx_cross_throw',
  WEAPON_AXE: 'sfx_axe_throw',
  WEAPON_BIBLE: 'sfx_bible_orbit',
  WEAPON_LIGHTNING: 'sfx_lightning_strike',

  // Combat - hits and deaths
  HIT_ENEMY: 'sfx_hit_enemy',
  HIT_PLAYER: 'sfx_hit_player',
  CRITICAL_HIT: 'sfx_critical',
  ENEMY_DEATH: 'sfx_enemy_death',
  PLAYER_DEATH: 'sfx_player_death',

  // Pickups - satisfying collect sounds
  PICKUP_XP: 'sfx_pickup_xp',
  PICKUP_HEALTH: 'sfx_pickup_health',
  PICKUP_CHEST: 'sfx_chest_open',
  PICKUP_MAGNET: 'sfx_pickup_magnet',
  PICKUP_COIN: 'sfx_pickup_coin',
  PICKUP_POWERUP: 'sfx_powerup_collect',

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

  // Boss Attacks
  BOSS_PHASE_CHANGE: 'sfx_boss_phase_change',
  BOSS_ENRAGE: 'sfx_boss_enrage',
  BOSS_BULLET_HELL_START: 'sfx_boss_bullet_hell',
  BOSS_LASER_CHARGE: 'sfx_boss_laser_charge',
  BOSS_LASER_FIRE: 'sfx_boss_laser_fire',
  BOSS_SUMMON: 'sfx_boss_summon',
  BOSS_SLAM_CHARGE: 'sfx_boss_slam_charge',
  BOSS_SLAM_IMPACT: 'sfx_boss_slam_impact',
  MINION_SPAWN: 'sfx_minion_spawn',
  WARNING_INDICATOR: 'sfx_warning_indicator',

  // Player abilities
  PLAYER_HURT: 'sfx_player_hurt',
  PLAYER_HEAL: 'sfx_player_heal',
  DASH: 'sfx_dash',
  DASH_WHOOSH: 'sfx_dash_whoosh',
  ULTIMATE_ACTIVATE: 'sfx_ultimate_activate',
  ULTIMATE_CHARGE: 'sfx_ultimate_charge',
  SHIELD_ACTIVATE: 'sfx_shield_activate',
  SHIELD_HIT: 'sfx_shield_hit',
  SHIELD_BREAK: 'sfx_shield_break',

  // Combo milestones - escalating
  COMBO_10: 'sfx_combo_10',
  COMBO_25: 'sfx_combo_25',
  COMBO_50: 'sfx_combo_50',
  COMBO_100: 'sfx_combo_100',
  COMBO_BREAK: 'sfx_combo_break',

  // Environment
  EXPLOSION: 'sfx_explosion',
  AMBIENT_LOOP: 'sfx_ambient_loop',
  ARENA_SHRINK: 'sfx_arena_shrink',
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
  [SFXKeys.BOSS_PHASE_CHANGE]: {
    volume: 0.9,
    pitchVariation: 0,
    priority: 10,
    cooldown: 1000,
    poolSize: 1,
    spatial: false,
  },
  [SFXKeys.BOSS_ENRAGE]: {
    volume: 1.0,
    pitchVariation: 0,
    priority: 10,
    cooldown: 5000,
    poolSize: 1,
    spatial: false,
  },
  [SFXKeys.BOSS_BULLET_HELL_START]: {
    volume: 0.8,
    pitchVariation: 0,
    priority: 9,
    cooldown: 500,
    poolSize: 1,
    spatial: true,
  },
  [SFXKeys.BOSS_LASER_CHARGE]: {
    volume: 0.7,
    pitchVariation: 0,
    priority: 8,
    cooldown: 500,
    poolSize: 2,
    spatial: true,
  },
  [SFXKeys.BOSS_LASER_FIRE]: {
    volume: 0.9,
    pitchVariation: 0,
    priority: 9,
    cooldown: 100,
    poolSize: 2,
    spatial: true,
  },
  [SFXKeys.BOSS_SUMMON]: {
    volume: 0.8,
    pitchVariation: 0,
    priority: 8,
    cooldown: 500,
    poolSize: 2,
    spatial: true,
  },
  [SFXKeys.BOSS_SLAM_CHARGE]: {
    volume: 0.7,
    pitchVariation: 0,
    priority: 8,
    cooldown: 500,
    poolSize: 2,
    spatial: true,
  },
  [SFXKeys.BOSS_SLAM_IMPACT]: {
    volume: 1.0,
    pitchVariation: 0.05,
    priority: 10,
    cooldown: 200,
    poolSize: 2,
    spatial: true,
  },
  [SFXKeys.MINION_SPAWN]: {
    volume: 0.5,
    pitchVariation: 0.15,
    priority: 6,
    cooldown: 50,
    poolSize: 8,
    spatial: true,
  },
  [SFXKeys.WARNING_INDICATOR]: {
    volume: 0.6,
    pitchVariation: 0.1,
    priority: 7,
    cooldown: 100,
    poolSize: 4,
    spatial: true,
  },
  [SFXKeys.GAME_OVER]: {
    volume: 0.9,
    pitchVariation: 0,
    priority: 10,
    cooldown: 0,
    poolSize: 1,
    spatial: false,
  },

  // Player abilities - high priority
  [SFXKeys.DASH]: {
    volume: 0.7,
    pitchVariation: 0.1,
    priority: 8,
    cooldown: 100,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.DASH_WHOOSH]: {
    volume: 0.6,
    pitchVariation: 0.15,
    priority: 7,
    cooldown: 50,
    poolSize: 4,
    spatial: true,
  },
  [SFXKeys.ULTIMATE_ACTIVATE]: {
    volume: 1.0,
    pitchVariation: 0,
    priority: 10,
    cooldown: 500,
    poolSize: 1,
    spatial: false,
  },
  [SFXKeys.ULTIMATE_CHARGE]: {
    volume: 0.6,
    pitchVariation: 0,
    priority: 6,
    cooldown: 100,
    poolSize: 1,
    spatial: false,
  },
  [SFXKeys.SHIELD_ACTIVATE]: {
    volume: 0.8,
    pitchVariation: 0,
    priority: 8,
    cooldown: 200,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.SHIELD_HIT]: {
    volume: 0.5,
    pitchVariation: 0.15,
    priority: 6,
    cooldown: 50,
    poolSize: 4,
    spatial: false,
  },
  [SFXKeys.SHIELD_BREAK]: {
    volume: 0.8,
    pitchVariation: 0.05,
    priority: 8,
    cooldown: 200,
    poolSize: 2,
    spatial: false,
  },

  // Combo milestones - escalating priority
  [SFXKeys.COMBO_10]: {
    volume: 0.5,
    pitchVariation: 0,
    priority: 6,
    cooldown: 500,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.COMBO_25]: {
    volume: 0.6,
    pitchVariation: 0,
    priority: 7,
    cooldown: 500,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.COMBO_50]: {
    volume: 0.7,
    pitchVariation: 0,
    priority: 8,
    cooldown: 500,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.COMBO_100]: {
    volume: 0.9,
    pitchVariation: 0,
    priority: 9,
    cooldown: 500,
    poolSize: 2,
    spatial: false,
  },
  [SFXKeys.COMBO_BREAK]: {
    volume: 0.4,
    pitchVariation: 0.1,
    priority: 4,
    cooldown: 200,
    poolSize: 2,
    spatial: false,
  },

  // Additional weapons
  [SFXKeys.WEAPON_FIRE_BOLT]: {
    volume: 0.65,
    pitchVariation: 0.1,
    priority: 5,
    cooldown: 60,
    poolSize: 8,
    spatial: true,
  },
  [SFXKeys.WEAPON_CROSS]: {
    volume: 0.6,
    pitchVariation: 0.1,
    priority: 5,
    cooldown: 100,
    poolSize: 4,
    spatial: true,
  },
  [SFXKeys.WEAPON_AXE]: {
    volume: 0.7,
    pitchVariation: 0.1,
    priority: 5,
    cooldown: 150,
    poolSize: 4,
    spatial: true,
  },
  [SFXKeys.WEAPON_BIBLE]: {
    volume: 0.4,
    pitchVariation: 0.05,
    priority: 3,
    cooldown: 500,
    poolSize: 2,
    spatial: true,
  },
  [SFXKeys.WEAPON_LIGHTNING]: {
    volume: 0.8,
    pitchVariation: 0.1,
    priority: 6,
    cooldown: 80,
    poolSize: 6,
    spatial: true,
  },

  // Explosion - medium priority, spatial
  [SFXKeys.EXPLOSION]: {
    volume: 0.9,
    pitchVariation: 0.15,
    priority: 7,
    cooldown: 30,
    poolSize: 8,
    spatial: true,
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
  // Wands and magic
  fire_wand: SFXKeys.WEAPON_FIRE_WAND,
  magic_wand: SFXKeys.WEAPON_FIRE_WAND,
  fire_bolt: SFXKeys.WEAPON_FIRE_BOLT,

  // Throwables
  knife: SFXKeys.WEAPON_FIRE_KNIFE,
  cross: SFXKeys.WEAPON_CROSS,
  axe: SFXKeys.WEAPON_AXE,

  // Melee
  whip: SFXKeys.WEAPON_FIRE_WHIP,

  // Auras
  garlic: SFXKeys.WEAPON_GARLIC,
  bible: SFXKeys.WEAPON_BIBLE,

  // Special
  lightning: SFXKeys.WEAPON_LIGHTNING,
  lightning_ring: SFXKeys.WEAPON_LIGHTNING,

  // Basic weapons
  basic_laser: SFXKeys.WEAPON_FIRE_GENERIC,
  laser: SFXKeys.WEAPON_FIRE_GENERIC,
};

/**
 * Get weapon fire SFX key.
 */
export function getWeaponSFX(weaponId: string): SFXKey {
  return WeaponSFXMap[weaponId] ?? SFXKeys.WEAPON_FIRE_GENERIC;
}

/**
 * Get combo milestone SFX key based on count.
 */
export function getComboSFX(comboCount: number): SFXKey | null {
  if (comboCount >= 100) return SFXKeys.COMBO_100;
  if (comboCount >= 50) return SFXKeys.COMBO_50;
  if (comboCount >= 25) return SFXKeys.COMBO_25;
  if (comboCount >= 10) return SFXKeys.COMBO_10;
  return null;
}
