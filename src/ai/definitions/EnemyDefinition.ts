/**
 * Enemy definition interface for defining enemy types.
 */

import { EnemyType, type IAIBehaviorConfig } from '../../shared/interfaces/IAI';
import { AttackType } from '../behaviors/AttackBehavior';

/**
 * Complete enemy definition.
 */
export interface IEnemyDefinition {
  /** Unique enemy ID */
  id: string;

  /** Display name */
  name: string;

  /** Enemy type classification */
  type: EnemyType;

  /** Base health */
  health: number;

  /** Base damage */
  damage: number;

  /** Movement speed */
  speed: number;

  /** XP value when killed */
  xpValue: number;

  /** Sprite key for rendering */
  spriteKey: string;

  /** Collision radius */
  collisionRadius?: number;

  /** AI behavior configuration */
  behaviorConfig: IAIBehaviorConfig;

  /** Attack type */
  attackType?: AttackType;

  /** Special abilities or flags */
  flags?: EnemyFlags;

  /** Sprite dimensions */
  spriteWidth?: number;
  spriteHeight?: number;

  /** Scale multiplier */
  scale?: number;

  /** Color tint (ARGB) */
  tint?: number;
}

/**
 * Enemy flags for special behaviors.
 */
export interface EnemyFlags {
  /** Can pass through walls */
  ghosting?: boolean;

  /** Immune to knockback */
  knockbackImmune?: boolean;

  /** Spawns minions on death */
  spawnsOnDeath?: boolean;

  /** Number of minions to spawn on death */
  spawnCount?: number;

  /** ID of enemy to spawn on death */
  spawnEnemyId?: string;

  /** Has ranged attack */
  ranged?: boolean;

  /** Explodes on death */
  explodesOnDeath?: boolean;

  /** Explosion radius */
  explosionRadius?: number;

  /** Explosion damage */
  explosionDamage?: number;
}

/**
 * Registry for all enemy definitions.
 */
export class EnemyRegistry {
  private static readonly enemies: Map<string, IEnemyDefinition> = new Map();

  /**
   * Register an enemy definition.
   */
  static register(definition: IEnemyDefinition): void {
    EnemyRegistry.enemies.set(definition.id, definition);
  }

  /**
   * Get enemy definition by ID.
   */
  static get(id: string): IEnemyDefinition | undefined {
    return EnemyRegistry.enemies.get(id);
  }

  /**
   * Get all registered enemy definitions.
   */
  static getAll(): IEnemyDefinition[] {
    return Array.from(EnemyRegistry.enemies.values());
  }

  /**
   * Get enemies by type.
   */
  static getByType(type: EnemyType): IEnemyDefinition[] {
    return EnemyRegistry.getAll().filter(e => e.type === type);
  }

  /**
   * Check if enemy exists.
   */
  static has(id: string): boolean {
    return EnemyRegistry.enemies.has(id);
  }

  /**
   * Clear all registrations.
   */
  static clear(): void {
    EnemyRegistry.enemies.clear();
  }
}
