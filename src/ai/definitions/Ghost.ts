/**
 * Ghost enemy definition.
 *
 * Medium speed elite enemy that can pass through walls.
 * Ghosts are dangerous because they ignore obstacles.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const GhostDefinition: IEnemyDefinition = {
  id: 'ghost',
  name: 'Ghost',
  type: EnemyType.Elite,

  // Combat stats - medium all around
  health: 35,
  damage: 10,
  speed: 90,
  xpValue: 5,

  // Rendering
  spriteKey: 'enemy_ghost',
  spriteWidth: 32,
  spriteHeight: 32,
  collisionRadius: 12,
  scale: 1,
  tint: 0xAAFFFFFF, // Semi-transparent white

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 90,
    detectionRange: 450,
    preferredRange: 20,
    attackRange: 30,
    attackCooldown: 1.0,

    // Light flocking
    useFlocking: true,
    separationWeight: 0.8,
    alignmentWeight: 0.6,
    cohesionWeight: 0.4,

    // Ghosts can flee when low HP (they're cowardly)
    fleeWhenLowHP: true,
    fleeThreshold: 0.3,
  },

  // Special flags
  flags: {
    // Ghosts can pass through walls
    ghosting: true,
  },
};
