/**
 * Ogre enemy definition.
 *
 * Slow, very high HP elite/mini-boss enemy.
 * Ogres are devastating in melee but slow to approach.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const OgreDefinition: IEnemyDefinition = {
  id: 'ogre',
  name: 'Ogre',
  type: EnemyType.Elite,

  // Combat stats - very tanky, high damage
  health: 150,
  damage: 25,
  speed: 35,
  xpValue: 15,

  // Rendering - larger sprite
  spriteKey: 'enemy_ogre',
  spriteWidth: 48,
  spriteHeight: 48,
  collisionRadius: 24,
  scale: 1.5,

  // Attack configuration - slow but powerful
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 35,
    detectionRange: 400,
    preferredRange: 40,
    attackRange: 50, // Large attack range due to size
    attackCooldown: 2.0, // Slow attack rate

    // No flocking - ogres are solitary
    useFlocking: false,

    // Ogres don't flee
    fleeWhenLowHP: false,
  },

  // Special flags
  flags: {
    // Ogres are immune to knockback
    knockbackImmune: true,

    // Spawns two skeletons on death
    spawnsOnDeath: true,
    spawnCount: 2,
    spawnEnemyId: 'skeleton',
  },
};
