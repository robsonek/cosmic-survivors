/**
 * AI Module - Enemy AI systems, behaviors, and spawning.
 *
 * This module provides:
 * - AISystem: ECS system for AI state machine and behavior execution
 * - Behaviors: Chase, Wander, Attack, Flocking
 * - SpawnManager: Enemy spawning with formations and position strategies
 * - Enemy Definitions: Predefined enemy types (Bat, Skeleton, Zombie, Ghost, Ogre)
 * - Steering: Basic steering behaviors for smooth AI movement
 */

// Main AI System
export { AISystem } from './AISystem';

// Behaviors
export {
  ChasePlayerBehavior,
  WanderBehavior,
  AttackBehavior,
  AttackType,
  FlockingBehavior,
} from './behaviors';

export type {
  IChaseConfig,
  IWanderConfig,
  IAttackConfig,
  IFlockingConfig,
} from './behaviors';

// Spawning
export { SpawnManager } from './spawning';

// Enemy Definitions
export {
  EnemyRegistry,
  BatDefinition,
  SkeletonDefinition,
  ZombieDefinition,
  GhostDefinition,
  OgreDefinition,
  registerAllEnemies,
  AllEnemyDefinitions,
} from './definitions';

export type { IEnemyDefinition, EnemyFlags } from './definitions';

// Pathfinding / Steering
export { Steering } from './pathfinding';
export type { ISteeringResult, IObstacle } from './pathfinding';

// Re-export relevant interfaces from shared
export {
  AIState,
  EnemyType,
  SpawnPosition,
  SpawnFormation,
} from '../shared/interfaces/IAI';

export type {
  IAIBehavior,
  IAIBehaviorConfig,
  IAIContext,
  ISpawnConfig,
  ISpawner,
  IPath,
  IPathfinding,
} from '../shared/interfaces/IAI';
