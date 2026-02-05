/**
 * Teleporter enemy definition.
 *
 * Blinks/teleports towards the player every 3 seconds.
 * Glass cannon - high damage but low HP. Relies on teleportation
 * to close distance and surprise players.
 */

import { EnemyType } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';
import type { IEnemyDefinition } from './EnemyDefinition';

export const TeleporterDefinition: IEnemyDefinition = {
  id: 'teleporter',
  name: 'Teleporter',
  type: EnemyType.Elite, // Elite due to special ability

  // Combat stats - glass cannon
  health: 35,
  damage: 18,
  speed: 60, // Slow base speed, relies on teleport
  xpValue: 55,

  // Rendering
  spriteKey: 'enemy_teleporter',
  spriteWidth: 32,
  spriteHeight: 32,
  collisionRadius: 14,
  scale: 1.0,
  tint: 0xFFAA66FF, // Purple tint for mystical appearance

  // Attack configuration
  attackType: AttackType.Melee,

  // AI Behavior
  behaviorConfig: {
    moveSpeed: 60,
    detectionRange: 600, // Long detection for teleport targeting
    preferredRange: 25,
    attackRange: 30,
    attackCooldown: 1.0,

    // No flocking - acts independently
    useFlocking: false,

    // Flee when low HP
    fleeWhenLowHP: true,
    fleeThreshold: 0.25,
  },

  // Teleport ability
  flags: {
    canTeleport: true,
    teleportCooldown: 3.0, // Teleport every 3 seconds
    teleportDistance: 200, // Teleport up to 200 units towards target
    ghosting: true, // Can teleport through walls
  },
};
