/**
 * Enemy definitions module exports.
 */

export { EnemyRegistry } from './EnemyDefinition';
export type { IEnemyDefinition, EnemyFlags } from './EnemyDefinition';

// Enemy definitions - original
export { BatDefinition } from './Bat';
export { SkeletonDefinition } from './Skeleton';
export { ZombieDefinition } from './Zombie';
export { GhostDefinition } from './Ghost';
export { OgreDefinition } from './Ogre';

// Enemy definitions - new special types (Wave 5+)
export { SplitterDefinition, SplitterMiniDefinition } from './Splitter';
export { TeleporterDefinition } from './Teleporter';
export { ShielderDefinition } from './Shielder';
export { ExploderDefinition } from './Exploder';
export { HealerDefinition } from './Healer';

// Import all definitions for auto-registration
import { EnemyRegistry } from './EnemyDefinition';
import { BatDefinition } from './Bat';
import { SkeletonDefinition } from './Skeleton';
import { ZombieDefinition } from './Zombie';
import { GhostDefinition } from './Ghost';
import { OgreDefinition } from './Ogre';
import { SplitterDefinition, SplitterMiniDefinition } from './Splitter';
import { TeleporterDefinition } from './Teleporter';
import { ShielderDefinition } from './Shielder';
import { ExploderDefinition } from './Exploder';
import { HealerDefinition } from './Healer';

/**
 * Register all built-in enemy definitions.
 * Call this at game initialization.
 */
export function registerAllEnemies(): void {
  // Original enemies
  EnemyRegistry.register(BatDefinition);
  EnemyRegistry.register(SkeletonDefinition);
  EnemyRegistry.register(ZombieDefinition);
  EnemyRegistry.register(GhostDefinition);
  EnemyRegistry.register(OgreDefinition);

  // New special enemies (Wave 5+)
  EnemyRegistry.register(SplitterDefinition);
  EnemyRegistry.register(SplitterMiniDefinition);
  EnemyRegistry.register(TeleporterDefinition);
  EnemyRegistry.register(ShielderDefinition);
  EnemyRegistry.register(ExploderDefinition);
  EnemyRegistry.register(HealerDefinition);
}

/**
 * All enemy definitions for easy iteration.
 */
export const AllEnemyDefinitions = [
  // Original enemies
  BatDefinition,
  SkeletonDefinition,
  ZombieDefinition,
  GhostDefinition,
  OgreDefinition,
  // New special enemies
  SplitterDefinition,
  SplitterMiniDefinition,
  TeleporterDefinition,
  ShielderDefinition,
  ExploderDefinition,
  HealerDefinition,
] as const;
