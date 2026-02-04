import type { EntityId } from './IWorld';

/**
 * AI behavior state.
 */
export enum AIState {
  Idle = 'idle',
  Wander = 'wander',
  Chase = 'chase',
  Attack = 'attack',
  Flee = 'flee',
  Stunned = 'stunned',
  Dead = 'dead',
}

/**
 * Enemy type classification.
 */
export enum EnemyType {
  Minion = 'minion',         // Weak, swarm enemies
  Elite = 'elite',           // Stronger, special abilities
  Boss = 'boss',             // Main boss encounters
  Spawner = 'spawner',       // Spawns other enemies
}

/**
 * AI behavior configuration.
 */
export interface IAIBehaviorConfig {
  /** Movement speed */
  moveSpeed: number;

  /** Detection range for targets */
  detectionRange: number;

  /** Preferred distance from target */
  preferredRange: number;

  /** Attack range */
  attackRange: number;

  /** Attack cooldown in seconds */
  attackCooldown: number;

  /** Whether to use flocking behavior */
  useFlocking: boolean;

  /** Flocking separation weight */
  separationWeight?: number;

  /** Flocking alignment weight */
  alignmentWeight?: number;

  /** Flocking cohesion weight */
  cohesionWeight?: number;

  /** Whether to flee when low HP */
  fleeWhenLowHP?: boolean;

  /** HP threshold for fleeing (0-1) */
  fleeThreshold?: number;
}

/**
 * AI behavior interface (Strategy pattern).
 */
export interface IAIBehavior {
  /** Behavior name */
  readonly name: string;

  /** Priority (higher = more important) */
  readonly priority: number;

  /**
   * Check if this behavior should activate.
   * @param entity The AI entity
   * @param context Current behavior context
   */
  shouldActivate(entity: EntityId, context: IAIContext): boolean;

  /**
   * Execute the behavior.
   * @param entity The AI entity
   * @param context Current behavior context
   * @param dt Delta time
   */
  execute(entity: EntityId, context: IAIContext, dt: number): void;

  /**
   * Called when behavior ends.
   */
  onExit?(entity: EntityId): void;
}

/**
 * Context provided to AI behaviors.
 */
export interface IAIContext {
  /** Current AI state */
  state: AIState;

  /** Target entity (usually player) */
  target: EntityId | null;

  /** Distance to target */
  targetDistance: number;

  /** Direction to target (normalized) */
  targetDirection: { x: number; y: number };

  /** Nearby allies for flocking */
  nearbyAllies: EntityId[];

  /** Nearby enemies (other faction) */
  nearbyEnemies: EntityId[];

  /** Time in current state */
  stateTime: number;

  /** Entity's current position */
  position: { x: number; y: number };

  /** Entity's current velocity */
  velocity: { x: number; y: number };

  /** Entity's current HP ratio (0-1) */
  hpRatio: number;

  /** Custom data for specific behaviors */
  customData: Record<string, unknown>;
}

/**
 * Pathfinding result.
 */
export interface IPath {
  /** Waypoints from start to end */
  waypoints: Array<{ x: number; y: number }>;

  /** Current waypoint index */
  currentIndex: number;

  /** Total path length */
  totalLength: number;

  /** Whether path is complete */
  isComplete: boolean;
}

/**
 * Pathfinding interface.
 */
export interface IPathfinding {
  /**
   * Find path from start to end.
   * @param startX Start X position
   * @param startY Start Y position
   * @param endX End X position
   * @param endY End Y position
   * @returns Path or null if no path found
   */
  findPath(startX: number, startY: number, endX: number, endY: number): IPath | null;

  /**
   * Check if position is walkable.
   */
  isWalkable(x: number, y: number): boolean;

  /**
   * Update navigation mesh/grid.
   * Called when obstacles change.
   */
  updateNavigation(): void;

  /**
   * Get smooth direction to target using steering.
   */
  getSteeringDirection(
    entityX: number,
    entityY: number,
    targetX: number,
    targetY: number,
    avoidObstacles: boolean
  ): { x: number; y: number };
}

/**
 * Spawn configuration for enemy waves.
 */
export interface ISpawnConfig {
  /** Enemy type ID */
  enemyId: string;

  /** Number to spawn */
  count: number;

  /** Spawn position strategy */
  spawnPosition: SpawnPosition;

  /** Delay between spawns in seconds */
  spawnDelay?: number;

  /** Whether to spawn as a group */
  spawnAsGroup?: boolean;

  /** Formation type for group spawns */
  formation?: SpawnFormation;

  /** Min distance from players */
  minDistanceFromPlayers?: number;

  /** Max distance from players */
  maxDistanceFromPlayers?: number;
}

export enum SpawnPosition {
  EdgeOfScreen = 'edgeOfScreen',    // Spawn at screen edges
  Random = 'random',                 // Random within arena
  AroundPlayers = 'aroundPlayers',  // Circle around players
  FixedPoint = 'fixedPoint',        // Specific coordinates
}

export enum SpawnFormation {
  None = 'none',
  Line = 'line',
  Circle = 'circle',
  Triangle = 'triangle',
  Square = 'square',
}

/**
 * Spawner system interface.
 */
export interface ISpawner {
  /**
   * Spawn enemies based on config.
   */
  spawn(config: ISpawnConfig): EntityId[];

  /**
   * Spawn a single enemy.
   */
  spawnEnemy(enemyId: string, x: number, y: number): EntityId;

  /**
   * Spawn boss.
   */
  spawnBoss(bossId: string): EntityId;

  /**
   * Get current enemy count.
   */
  getEnemyCount(): number;

  /**
   * Get max allowed enemies.
   */
  getMaxEnemies(): number;

  /**
   * Clear all enemies.
   */
  clearAllEnemies(): void;
}
