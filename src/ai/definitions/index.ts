/**
 * Enemy definitions module exports.
 */

export { EnemyRegistry } from './EnemyDefinition';
export type { IEnemyDefinition, EnemyFlags } from './EnemyDefinition';

// Enemy definitions
export { BatDefinition } from './Bat';
export { SkeletonDefinition } from './Skeleton';
export { ZombieDefinition } from './Zombie';
export { GhostDefinition } from './Ghost';
export { OgreDefinition } from './Ogre';

// Import all definitions for auto-registration
import { EnemyRegistry } from './EnemyDefinition';
import { BatDefinition } from './Bat';
import { SkeletonDefinition } from './Skeleton';
import { ZombieDefinition } from './Zombie';
import { GhostDefinition } from './Ghost';
import { OgreDefinition } from './Ogre';

/**
 * Register all built-in enemy definitions.
 * Call this at game initialization.
 */
export function registerAllEnemies(): void {
  EnemyRegistry.register(BatDefinition);
  EnemyRegistry.register(SkeletonDefinition);
  EnemyRegistry.register(ZombieDefinition);
  EnemyRegistry.register(GhostDefinition);
  EnemyRegistry.register(OgreDefinition);
}

/**
 * All enemy definitions for easy iteration.
 */
export const AllEnemyDefinitions = [
  BatDefinition,
  SkeletonDefinition,
  ZombieDefinition,
  GhostDefinition,
  OgreDefinition,
] as const;
