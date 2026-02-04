/**
 * Zombie enemy definition.
 *
 * Slow, high HP tanky enemy. Zombies are relentless pursuers.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const ZombieDefinition: IEnemyDefinition = {
  id: 'zombie',
  name: 'Zombie',
  type: EnemyType.Minion,

  // Combat stats - high HP, high damage, slow
  health: 50,
  damage: 12,
  speed: 40,
  xpValue: 3,

  // Rendering
  spriteKey: 'enemy_zombie',
  spriteWidth: 32,
  spriteHeight: 32,
  collisionRadius: 16,
  scale: 1,

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 40,
    detectionRange: 500, // Large detection range - they always come
    preferredRange: 25,
    attackRange: 35,
    attackCooldown: 1.5,

    // No flocking - zombies shamble individually
    useFlocking: false,

    // Don't flee - zombies are mindless
    fleeWhenLowHP: false,
  },

  // Special flags
  flags: {
    // Zombies are immune to knockback due to their mass
    knockbackImmune: true,
  },
};
