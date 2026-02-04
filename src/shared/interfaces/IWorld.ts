import type { ISystem, ISystemContext } from './ISystem';

/** Entity ID type (number in bitECS) */
export type EntityId = number;

/** Component type for bitECS */
export type Component = Record<string, Float32Array | Int32Array | Uint32Array | Uint8Array>;

/**
 * ECS World interface.
 * Wraps bitECS world with additional functionality.
 */
export interface IWorld {
  /** Raw bitECS world reference */
  readonly raw: object;

  /** All registered systems */
  readonly systems: ReadonlyMap<string, ISystem>;

  /** Current execution context */
  readonly context: ISystemContext;

  // Entity Management

  /**
   * Create a new entity.
   * @returns New entity ID
   */
  createEntity(): EntityId;

  /**
   * Remove an entity and all its components.
   * @param entity Entity to remove
   */
  removeEntity(entity: EntityId): void;

  /**
   * Check if entity exists.
   */
  entityExists(entity: EntityId): boolean;

  /**
   * Get all entities with specific components.
   * @param components Component types to query
   */
  query(...components: Component[]): EntityId[];

  // Component Management

  /**
   * Add component to entity.
   */
  addComponent(entity: EntityId, component: Component): void;

  /**
   * Remove component from entity.
   */
  removeComponent(entity: EntityId, component: Component): void;

  /**
   * Check if entity has component.
   */
  hasComponent(entity: EntityId, component: Component): boolean;

  // System Management

  /**
   * Register a system.
   */
  registerSystem(system: ISystem): void;

  /**
   * Unregister a system.
   */
  unregisterSystem(name: string): void;

  /**
   * Get system by name.
   */
  getSystem<T extends ISystem>(name: string): T | undefined;

  /**
   * Enable/disable a system.
   */
  setSystemEnabled(name: string, enabled: boolean): void;

  // Lifecycle

  /**
   * Initialize world and all systems.
   */
  init(): Promise<void>;

  /**
   * Update all systems.
   */
  update(dt: number): void;

  /**
   * Fixed update for physics systems.
   */
  fixedUpdate(fixedDt: number): void;

  /**
   * Clean up world and all systems.
   */
  destroy(): void;
}

/**
 * Query definition for efficient entity queries.
 */
export interface IQuery {
  /** Components that entities must have */
  readonly all: Component[];

  /** Components that entities must NOT have */
  readonly none?: Component[];

  /** Components where entity must have at least one */
  readonly any?: Component[];
}
