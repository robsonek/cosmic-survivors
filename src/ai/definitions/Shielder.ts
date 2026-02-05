/**
 * Shielder enemy definition.
 *
 * Has a front-facing shield that blocks projectiles.
 * Forces players to flank or use area attacks.
 * Moves slowly but is very tanky when approached from the front.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const ShielderDefinition: IEnemyDefinition = {
  id: 'shielder',
  name: 'Shielder',
  type: EnemyType.Elite, // Elite due to special defense

  // Combat stats - tanky
  health: 80,
  damage: 12,
  speed: 50, // Slow - shield makes them defensive
  xpValue: 60,

  // Rendering
  spriteKey: 'enemy_shielder',
  spriteWidth: 40,
  spriteHeight: 40,
  collisionRadius: 18,
  scale: 1.2,
  tint: 0xFF6688FF, // Blue tint for shield theme

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 50,
    detectionRange: 400,
    preferredRange: 40, // Stays at range, uses shield
    attackRange: 45,
    attackCooldown: 1.5,

    // No flocking - individual tank behavior
    useFlocking: false,

    // Doesn't flee - stands ground
    fleeWhenLowHP: false,
  },

  // Shield ability
  flags: {
    hasShield: true,
    shieldArc: 120, // 120 degree frontal shield coverage
    shieldHealth: 50, // Shield can absorb 50 damage before breaking
    shieldRegenTime: 5.0, // Shield regenerates after 5 seconds
    knockbackImmune: true, // Hard to push back
  },
};
