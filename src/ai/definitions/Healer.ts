/**
 * Healer enemy definition.
 *
 * Support enemy that heals nearby allies. Priority target that
 * should be killed first. Stays behind the frontline and avoids
 * direct combat.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const HealerDefinition: IEnemyDefinition = {
  id: 'healer',
  name: 'Healer',
  type: EnemyType.Elite, // Elite - high priority target

  // Combat stats - supportive, not combat focused
  health: 50,
  damage: 5, // Low damage - support role
  speed: 65, // Slow - stays behind
  xpValue: 80, // High XP - priority target reward

  // Rendering
  spriteKey: 'enemy_healer',
  spriteWidth: 36,
  spriteHeight: 36,
  collisionRadius: 16,
  scale: 1.1,
  tint: 0xFF44FF44, // Bright green - healing theme

  // Attack configuration
  attackType: AttackType.Ranged, // Attacks from distance

  // AI Behavior - supportive, stays back
  behaviorConfig: {
    moveSpeed: 65,
    detectionRange: 500,
    preferredRange: 150, // Stays far from player
    attackRange: 100, // Ranged attack
    attackCooldown: 2.0, // Slow attacks

    // Light flocking with other enemies
    useFlocking: true,
    separationWeight: 2.0, // Stays away from frontline
    alignmentWeight: 0.5,
    cohesionWeight: 0.3,

    // Flees when low HP
    fleeWhenLowHP: true,
    fleeThreshold: 0.4, // Flees at 40% HP
  },

  // Healing ability
  flags: {
    canHealAllies: true,
    healAmount: 5, // Heals 5 HP per tick
    healTickRate: 1.0, // Heals every 1 second
    healRadius: 120, // Heals allies within 120 units
    ranged: true,
  },
};
