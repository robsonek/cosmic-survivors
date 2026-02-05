/**
 * Exploder enemy definition.
 *
 * Fast enemy that rushes at the player and explodes on death,
 * dealing AOE damage. Low HP but high threat if it reaches you.
 * Players must kill it at range or take explosion damage.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const ExploderDefinition: IEnemyDefinition = {
  id: 'exploder',
  name: 'Exploder',
  type: EnemyType.Minion,

  // Combat stats - low HP, fast, designed to die near player
  health: 25,
  damage: 10, // Contact damage
  speed: 130, // Very fast - rushes player
  xpValue: 35,

  // Rendering
  spriteKey: 'enemy_exploder',
  spriteWidth: 28,
  spriteHeight: 28,
  collisionRadius: 12,
  scale: 0.9,
  tint: 0xFFFF6644, // Red/orange tint - danger color

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior - aggressive rush
  behaviorConfig: {
    moveSpeed: 130,
    detectionRange: 500,
    preferredRange: 0, // Wants to be ON the player
    attackRange: 20,
    attackCooldown: 0.5, // Fast attacks if it reaches you

    // No flocking - solo rushers
    useFlocking: false,

    // Never flees - suicidal behavior
    fleeWhenLowHP: false,
  },

  // Explosion on death
  flags: {
    explodesOnDeath: true,
    explosionRadius: 80, // 80 unit radius explosion
    explosionDamage: 30, // High AOE damage
  },
};
