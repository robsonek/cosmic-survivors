/**
 * Bat enemy definition.
 *
 * Fast, low HP swarm enemy. Bats attack in groups and move quickly.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const BatDefinition: IEnemyDefinition = {
  id: 'bat',
  name: 'Bat',
  type: EnemyType.Minion,

  // Combat stats
  health: 10,
  damage: 5,
  speed: 150,
  xpValue: 1,

  // Rendering
  spriteKey: 'enemy_bat',
  spriteWidth: 24,
  spriteHeight: 24,
  collisionRadius: 10,
  scale: 1,

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 150,
    detectionRange: 400,
    preferredRange: 20,
    attackRange: 25,
    attackCooldown: 0.8,

    // Flocking - bats swarm together
    useFlocking: true,
    separationWeight: 1.2,
    alignmentWeight: 1.0,
    cohesionWeight: 1.5,

    // Don't flee
    fleeWhenLowHP: false,
  },

  // No special flags
  flags: {},
};
