import type { IWorld } from './IWorld';

/**
 * Base interface for all ECS systems.
 * Systems process entities with specific component combinations.
 */
export interface ISystem {
  /** Unique system identifier */
  readonly name: string;

  /** Execution priority (lower = earlier). Default systems: 0-100 */
  readonly priority: number;

  /** Names of systems that must run before this one */
  readonly dependencies: string[];

  /** Whether this system is currently enabled */
  enabled: boolean;

  /**
   * Initialize the system with world reference.
   * Called once when system is added to the world.
   */
  init(world: IWorld): void;

  /**
   * Update the system.
   * @param dt Delta time in seconds since last frame
   */
  update(dt: number): void;

  /**
   * Fixed update for physics systems.
   * Called at fixed intervals (default 60Hz).
   * @param fixedDt Fixed delta time (1/60 by default)
   */
  fixedUpdate?(fixedDt: number): void;

  /**
   * Late update after all regular updates.
   * Useful for camera, UI sync, etc.
   */
  lateUpdate?(dt: number): void;

  /**
   * Clean up resources when system is removed.
   */
  destroy(): void;
}

/**
 * System with network authority awareness.
 * Used for systems that behave differently based on authority.
 */
export interface INetworkAwareSystem extends ISystem {
  /** Whether this system only runs on the authoritative instance */
  readonly authorityOnly: boolean;

  /** Whether this system runs on clients (with prediction) */
  readonly clientPredicted: boolean;
}

/**
 * System execution context provided each frame.
 */
export interface ISystemContext {
  /** Current frame number */
  frame: number;

  /** Total elapsed time in seconds */
  time: number;

  /** Delta time in seconds */
  dt: number;

  /** Fixed delta time for physics */
  fixedDt: number;

  /** Whether this is an authoritative update (server or single-player) */
  isAuthority: boolean;

  /** Current network tick (for multiplayer sync) */
  networkTick: number;
}
