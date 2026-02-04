/**
 * Core game constants.
 */

// ============================================
// Game Settings
// ============================================

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const TARGET_FPS = 60;
export const FIXED_UPDATE_RATE = 60;
export const FIXED_DT = 1 / FIXED_UPDATE_RATE;

// ============================================
// ECS Settings
// ============================================

export const MAX_ENTITIES = 10000;
export const MAX_COMPONENTS = 64;

// ============================================
// Physics Settings
// ============================================

export const SPATIAL_CELL_SIZE = 64;
export const MAX_COLLISION_CHECKS_PER_FRAME = 5000;
export const PHYSICS_SUBSTEPS = 1;

// ============================================
// Player Settings
// ============================================

export const PLAYER_BASE_HEALTH = 100;
export const PLAYER_BASE_SPEED = 200;
export const PLAYER_BASE_PICKUP_RADIUS = 50;
export const PLAYER_INVULNERABILITY_TIME = 1.0; // seconds
export const PLAYER_MAX_WEAPONS = 6;
export const PLAYER_MAX_PASSIVES = 6;
export const PLAYER_XP_SCALING = 1.15; // XP needed multiplier per level

// ============================================
// Enemy Settings
// ============================================

export const MAX_ENEMIES = 1000;
export const ENEMY_SPAWN_MARGIN = 100; // pixels outside screen
export const ENEMY_DESPAWN_DISTANCE = 1500; // pixels from all players
export const ENEMY_BASE_XP_VALUE = 1;

// ============================================
// Projectile Settings
// ============================================

export const MAX_PROJECTILES = 2000;
export const PROJECTILE_DEFAULT_LIFETIME = 3.0; // seconds
export const PROJECTILE_HIT_FLASH_DURATION = 0.1; // seconds

// ============================================
// Pickup Settings
// ============================================

export const XP_ORB_LIFETIME = 30.0; // seconds
export const XP_ORB_MAGNET_SPEED = 500;
export const XP_ORB_MERGE_DISTANCE = 20;
export const HEALTH_PICKUP_LIFETIME = 20.0;

// ============================================
// Combat Settings
// ============================================

export const CRITICAL_HIT_MULTIPLIER = 2.0;
export const BASE_CRITICAL_CHANCE = 0.0;
export const MAX_CRITICAL_CHANCE = 0.75;
export const KNOCKBACK_DURATION = 0.15; // seconds
export const DAMAGE_NUMBER_DURATION = 0.8; // seconds

// ============================================
// Wave Settings
// ============================================

export const WAVE_START_DELAY = 3.0; // seconds before first wave
export const WAVE_INTERVAL = 30.0; // seconds between waves
export const BOSS_WAVE_INTERVAL = 5; // every 5th wave is boss
export const MAX_WAVE_DURATION = 120.0; // seconds

// ============================================
// Network Settings
// ============================================

export const NETWORK_TICK_RATE = 20; // ticks per second
export const NETWORK_INTERPOLATION_DELAY = 100; // ms
export const NETWORK_MAX_PREDICTION_FRAMES = 10;
export const NETWORK_STATE_BUFFER_SIZE = 64;
export const NETWORK_INPUT_BUFFER_SIZE = 32;
export const RECONNECT_TIMEOUT = 10000; // ms

// ============================================
// UI Settings
// ============================================

export const HUD_UPDATE_INTERVAL = 0.1; // seconds
export const NOTIFICATION_DURATION = 3.0; // seconds
export const UPGRADE_CHOICE_COUNT = 3;
export const DAMAGE_NUMBER_OFFSET_Y = -30;

// ============================================
// Audio Settings
// ============================================

export const MAX_SIMULTANEOUS_SFX = 32;
export const SPATIAL_AUDIO_MAX_DISTANCE = 800;
export const MUSIC_CROSSFADE_DURATION = 2000; // ms

// ============================================
// Meta/Progression Settings
// ============================================

export const TALENT_POINT_PER_LEVEL = 1;
export const XP_TO_TALENT_POINT = 1000;
export const MAX_TALENT_LEVEL = 5;

// ============================================
// Performance Thresholds
// ============================================

export const FPS_WARNING_THRESHOLD = 45;
export const FPS_CRITICAL_THRESHOLD = 30;
export const ENTITY_WARNING_THRESHOLD = 8000;
