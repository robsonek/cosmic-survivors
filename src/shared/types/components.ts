/**
 * ECS Component definitions for bitECS.
 *
 * In bitECS, components are defined as objects with typed array stores.
 * Each property becomes a dense array where the index is the entity ID.
 *
 * Types: f32 (Float32Array), f64, i8, i16, i32, ui8, ui16, ui32
 */

import { Types, defineComponent } from 'bitecs';

// ============================================
// Transform Components
// ============================================

/**
 * Position in world space.
 */
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Velocity for movement.
 */
export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Rotation in radians.
 */
export const Rotation = defineComponent({
  angle: Types.f32,
  angularVelocity: Types.f32,
});

/**
 * Scale for rendering.
 */
export const Scale = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

// ============================================
// Rendering Components
// ============================================

/**
 * Sprite rendering data.
 */
export const Sprite = defineComponent({
  textureId: Types.ui16,    // Index into texture atlas
  frameIndex: Types.ui16,   // Current animation frame
  width: Types.f32,
  height: Types.f32,
  originX: Types.f32,       // 0-1
  originY: Types.f32,       // 0-1
  tint: Types.ui32,         // Color tint (ARGB)
  alpha: Types.f32,         // 0-1
  layer: Types.ui8,         // Render layer
  flipX: Types.ui8,         // Boolean as ui8
  flipY: Types.ui8,
  visible: Types.ui8,       // Boolean as ui8
});

/**
 * Animation state.
 */
export const Animation = defineComponent({
  animationId: Types.ui16,  // Current animation ID
  frameTime: Types.f32,     // Time on current frame
  frameIndex: Types.ui16,   // Current frame
  speed: Types.f32,         // Playback speed multiplier
  loop: Types.ui8,          // Boolean
  playing: Types.ui8,       // Boolean
});

/**
 * Particle emitter component.
 */
export const ParticleEmitter = defineComponent({
  emitterId: Types.ui16,    // Emitter definition ID
  active: Types.ui8,
  offsetX: Types.f32,
  offsetY: Types.f32,
});

// ============================================
// Physics Components
// ============================================

/**
 * Circular collider.
 */
export const CircleCollider = defineComponent({
  radius: Types.f32,
  offsetX: Types.f32,
  offsetY: Types.f32,
  layer: Types.ui16,        // Collision layer flags
  mask: Types.ui16,         // Collision mask
  isTrigger: Types.ui8,     // Boolean
});

/**
 * Rectangle collider.
 */
export const RectCollider = defineComponent({
  width: Types.f32,
  height: Types.f32,
  offsetX: Types.f32,
  offsetY: Types.f32,
  layer: Types.ui16,
  mask: Types.ui16,
  isTrigger: Types.ui8,
});

/**
 * Movement configuration.
 */
export const Movement = defineComponent({
  maxSpeed: Types.f32,
  acceleration: Types.f32,
  deceleration: Types.f32,
  friction: Types.f32,
  mass: Types.f32,
});

// ============================================
// Combat Components
// ============================================

/**
 * Health and damage tracking.
 */
export const Health = defineComponent({
  current: Types.f32,
  max: Types.f32,
  shield: Types.f32,
  shieldMax: Types.f32,
  armor: Types.f32,
  invulnerable: Types.ui8,
  invulnerableTime: Types.f32,
});

/**
 * Damage over time effects.
 */
export const DamageOverTime = defineComponent({
  damagePerSecond: Types.f32,
  duration: Types.f32,
  elapsed: Types.f32,
  type: Types.ui8,          // DamageType enum
  sourceEntity: Types.ui32,
});

/**
 * Weapon slot on entity.
 */
export const WeaponSlot = defineComponent({
  weaponId: Types.ui16,     // Weapon definition ID
  level: Types.ui8,
  cooldown: Types.f32,      // Time until next fire
  ammo: Types.ui16,         // Current ammo (-1 = infinite)
});

/**
 * Projectile data.
 */
export const Projectile = defineComponent({
  damage: Types.f32,
  damageType: Types.ui8,
  pierce: Types.ui8,        // Remaining pierce count
  lifetime: Types.f32,      // Remaining lifetime
  ownerEntity: Types.ui32,
  weaponId: Types.ui16,
  hitEntities: Types.ui32,  // Bitmask of hit entity flags (for pierce)
});

// ============================================
// AI Components
// ============================================

/**
 * AI controller state.
 */
export const AIController = defineComponent({
  behaviorId: Types.ui16,   // Current behavior ID
  state: Types.ui8,         // AIState enum
  targetEntity: Types.ui32, // Current target
  stateTime: Types.f32,     // Time in current state
  alertRadius: Types.f32,
  attackRadius: Types.f32,
  attackCooldown: Types.f32,
  lastAttackTime: Types.f32,
});

/**
 * Flocking behavior parameters.
 */
export const Flocking = defineComponent({
  separationWeight: Types.f32,
  alignmentWeight: Types.f32,
  cohesionWeight: Types.f32,
  neighborRadius: Types.f32,
  maxNeighbors: Types.ui8,
});

/**
 * Pathfinding state.
 */
export const Pathfinding = defineComponent({
  targetX: Types.f32,
  targetY: Types.f32,
  waypointIndex: Types.ui16,
  recalculateTime: Types.f32,
  pathId: Types.ui32,       // Reference to path data
});

// ============================================
// Player Components
// ============================================

/**
 * Player-specific data.
 */
export const Player = defineComponent({
  playerId: Types.ui32,     // Unique player ID (for multiplayer)
  characterId: Types.ui16,  // Character type
  level: Types.ui16,
  xp: Types.ui32,
  xpToNextLevel: Types.ui32,
  kills: Types.ui32,
});

/**
 * Player input state (networked).
 */
export const PlayerInput = defineComponent({
  moveX: Types.f32,         // -1 to 1
  moveY: Types.f32,         // -1 to 1
  aimX: Types.f32,          // Normalized
  aimY: Types.f32,          // Normalized
  actions: Types.ui8,       // Bit flags for actions
  inputTick: Types.ui32,    // Network tick this input was for
});

/**
 * Stats modifiers (from passives, talents, etc).
 */
export const StatModifiers = defineComponent({
  damageMultiplier: Types.f32,
  cooldownReduction: Types.f32,
  areaMultiplier: Types.f32,
  projectileCountBonus: Types.ui8,
  speedMultiplier: Types.f32,
  healthBonus: Types.f32,
  regenPerSecond: Types.f32,
  pickupRadius: Types.f32,
  xpMultiplier: Types.f32,
  critChance: Types.f32,
  critMultiplier: Types.f32,
  armorBonus: Types.f32,
});

// ============================================
// Network Components
// ============================================

/**
 * Network synchronization data.
 */
export const NetworkSync = defineComponent({
  networkId: Types.ui32,    // Unique network entity ID
  ownerPlayerId: Types.ui32,
  authority: Types.ui8,     // Who has authority (0=server, playerId)
  lastSyncTick: Types.ui32,
  interpolating: Types.ui8, // Boolean
});

/**
 * Network position interpolation buffer.
 */
export const NetworkInterpolation = defineComponent({
  prevX: Types.f32,
  prevY: Types.f32,
  targetX: Types.f32,
  targetY: Types.f32,
  prevTick: Types.ui32,
  targetTick: Types.ui32,
});

// ============================================
// Pickup Components
// ============================================

/**
 * XP orb pickup.
 */
export const XPOrb = defineComponent({
  value: Types.ui32,
  magnetized: Types.ui8,    // Being pulled to player
  targetEntity: Types.ui32, // Player being pulled to
});

/**
 * Health pickup.
 */
export const HealthPickup = defineComponent({
  healAmount: Types.f32,
  healPercent: Types.f32,   // % of max health
});

/**
 * Generic pickup.
 */
export const Pickup = defineComponent({
  type: Types.ui8,          // PickupType enum
  value: Types.f32,
  despawnTime: Types.f32,
});

// ============================================
// Tag Components (no data)
// ============================================

/**
 * Tag components - these have no data, just mark entities.
 * In bitECS, we can use empty components as tags.
 */
export const Tags = {
  Player: defineComponent({}),
  Enemy: defineComponent({}),
  Boss: defineComponent({}),
  Projectile: defineComponent({}),
  Pickup: defineComponent({}),
  Wall: defineComponent({}),
  LocalPlayer: defineComponent({}),
  NetworkControlled: defineComponent({}),
  Dead: defineComponent({}),
  Invulnerable: defineComponent({}),
} as const;

// ============================================
// Component Type Exports
// ============================================

export type PositionComponent = typeof Position;
export type VelocityComponent = typeof Velocity;
export type HealthComponent = typeof Health;
export type SpriteComponent = typeof Sprite;
export type CircleColliderComponent = typeof CircleCollider;
export type AIControllerComponent = typeof AIController;
export type ProjectileComponent = typeof Projectile;
export type PlayerComponent = typeof Player;
export type NetworkSyncComponent = typeof NetworkSync;
