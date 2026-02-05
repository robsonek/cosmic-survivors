/**
 * Splitter enemy definition.
 *
 * Medium enemy that splits into 2-3 smaller versions when killed.
 * Requires special death handling in the combat system.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const SplitterDefinition: IEnemyDefinition = {
  id: 'splitter',
  name: 'Splitter',
  type: EnemyType.Minion,

  // Combat stats - medium HP to survive splitting
  health: 60,
  damage: 8,
  speed: 75,
  xpValue: 45,

  // Rendering
  spriteKey: 'enemy_splitter',
  spriteWidth: 40,
  spriteHeight: 40,
  collisionRadius: 18,
  scale: 1.3,
  tint: 0xFF88FF88, // Greenish tint

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 75,
    detectionRange: 450,
    preferredRange: 30,
    attackRange: 35,
    attackCooldown: 1.2,

    // Light flocking
    useFlocking: true,
    separationWeight: 1.5,
    alignmentWeight: 0.5,
    cohesionWeight: 0.8,

    fleeWhenLowHP: false,
  },

  // Split on death
  flags: {
    spawnsOnDeath: true,
    spawnCount: 3, // Spawns 2-3 minis (random in combat system)
    spawnEnemyId: 'splitter_mini',
  },
};

/**
 * Splitter Mini - smaller version spawned when parent dies.
 */
export const SplitterMiniDefinition: IEnemyDefinition = {
  id: 'splitter_mini',
  name: 'Splitter Mini',
  type: EnemyType.Minion,

  // Combat stats - weaker version
  health: 20,
  damage: 4,
  speed: 95,
  xpValue: 15,

  // Rendering - smaller
  spriteKey: 'enemy_splitter_mini',
  spriteWidth: 24,
  spriteHeight: 24,
  collisionRadius: 10,
  scale: 0.7,
  tint: 0xFF66FF66, // Lighter green

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior - more aggressive
  behaviorConfig: {
    moveSpeed: 95,
    detectionRange: 400,
    preferredRange: 20,
    attackRange: 25,
    attackCooldown: 0.9,

    // Swarm behavior
    useFlocking: true,
    separationWeight: 1.0,
    alignmentWeight: 1.2,
    cohesionWeight: 1.5,

    fleeWhenLowHP: false,
  },

  // No special flags - doesn't split further
  flags: {},
};
