/**
 * Skeleton enemy definition.
 *
 * Medium speed, medium HP standard enemy.
 * A balanced minion that forms the backbone of enemy waves.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const SkeletonDefinition: IEnemyDefinition = {
  id: 'skeleton',
  name: 'Skeleton',
  type: EnemyType.Minion,

  // Combat stats
  health: 25,
  damage: 8,
  speed: 80,
  xpValue: 2,

  // Rendering
  spriteKey: 'enemy_skeleton',
  spriteWidth: 32,
  spriteHeight: 32,
  collisionRadius: 14,
  scale: 1,

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 80,
    detectionRange: 350,
    preferredRange: 30,
    attackRange: 40,
    attackCooldown: 1.2,

    // Light flocking
    useFlocking: true,
    separationWeight: 1.0,
    alignmentWeight: 0.5,
    cohesionWeight: 0.3,

    // Don't flee
    fleeWhenLowHP: false,
  },

  // No special flags
  flags: {},
};
