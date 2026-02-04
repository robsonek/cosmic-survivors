/**
 * ECS World - Wrapper around bitECS world with system management.
 *
 * Provides:
 * - Entity creation/removal
 * - Component management
 * - System registration with priority and dependency sorting
 * - Query caching
 */

import {
  createWorld,
  addEntity,
  removeEntity as bitRemoveEntity,
  addComponent as bitAddComponent,
  removeComponent as bitRemoveComponent,
  hasComponent as bitHasComponent,
  defineQuery,
  entityExists as bitEntityExists,
  resetWorld,
  type IWorld as BitECSWorld,
} from 'bitecs';

import type { IWorld, EntityId, Component } from '@shared/interfaces/IWorld';
import type { ISystem, ISystemContext } from '@shared/interfaces/ISystem';
import { MAX_ENTITIES, FIXED_DT } from '@shared/constants/game';

/**
 * Cached query entry.
 */
interface QueryCache {
  components: Component[];
  query: ReturnType<typeof defineQuery>;
}

/**
 * System entry with enabled state.
 */
interface SystemEntry {
  system: ISystem;
  enabled: boolean;
}

/**
 * World implementation for Cosmic Survivors.
 */
export class World implements IWorld {
  /** Raw bitECS world */
  private _raw: BitECSWorld;

  /** Registered systems map */
  private _systems: Map<string, SystemEntry> = new Map();

  /** Sorted systems for execution */
  private _sortedSystems: ISystem[] = [];

  /** Systems with fixedUpdate */
  private _fixedUpdateSystems: ISystem[] = [];

  /** Systems with lateUpdate */
  private _lateUpdateSystems: ISystem[] = [];

  /** Cached queries */
  private _queryCache: Map<string, QueryCache> = new Map();

  /** Execution context */
  private _context: ISystemContext = {
    frame: 0,
    time: 0,
    dt: 0,
    fixedDt: FIXED_DT,
    isAuthority: true,
    networkTick: 0,
  };

  /** Whether world has been initialized */
  private _initialized = false;

  constructor() {
    this._raw = createWorld({ maxEntities: MAX_ENTITIES });
  }

  /**
   * Get raw bitECS world reference.
   */
  get raw(): object {
    return this._raw;
  }

  /**
   * Get all registered systems.
   */
  get systems(): ReadonlyMap<string, ISystem> {
    const systemMap = new Map<string, ISystem>();
    for (const [name, entry] of this._systems) {
      systemMap.set(name, entry.system);
    }
    return systemMap;
  }

  /**
   * Get current execution context.
   */
  get context(): ISystemContext {
    return this._context;
  }

  // ============================================
  // Entity Management
  // ============================================

  /**
   * Create a new entity.
   * @returns New entity ID
   */
  createEntity(): EntityId {
    return addEntity(this._raw);
  }

  /**
   * Remove an entity and all its components.
   * @param entity Entity to remove
   */
  removeEntity(entity: EntityId): void {
    if (this.entityExists(entity)) {
      bitRemoveEntity(this._raw, entity);
    }
  }

  /**
   * Check if entity exists.
   * @param entity Entity ID
   * @returns True if entity exists
   */
  entityExists(entity: EntityId): boolean {
    return bitEntityExists(this._raw, entity);
  }

  /**
   * Query for entities with specific components.
   * Uses cached queries for performance.
   * @param components Component types to query
   * @returns Array of matching entity IDs
   */
  query(...components: Component[]): EntityId[] {
    if (components.length === 0) {
      return [];
    }

    // Create cache key from component references
    const cacheKey = this.getQueryCacheKey(components);

    let cached = this._queryCache.get(cacheKey);
    if (!cached) {
      // Create and cache the query
      const queryFn = defineQuery(components);
      cached = {
        components,
        query: queryFn,
      };
      this._queryCache.set(cacheKey, cached);
    }

    return cached.query(this._raw) as EntityId[];
  }

  // ============================================
  // Component Management
  // ============================================

  /**
   * Add component to entity.
   * @param entity Entity ID
   * @param component Component type
   */
  addComponent(entity: EntityId, component: Component): void {
    if (this.entityExists(entity)) {
      bitAddComponent(this._raw, component, entity);
    }
  }

  /**
   * Remove component from entity.
   * @param entity Entity ID
   * @param component Component type
   */
  removeComponent(entity: EntityId, component: Component): void {
    if (this.entityExists(entity) && this.hasComponent(entity, component)) {
      bitRemoveComponent(this._raw, component, entity);
    }
  }

  /**
   * Check if entity has component.
   * @param entity Entity ID
   * @param component Component type
   * @returns True if entity has component
   */
  hasComponent(entity: EntityId, component: Component): boolean {
    if (!this.entityExists(entity)) {
      return false;
    }
    return bitHasComponent(this._raw, component, entity);
  }

  // ============================================
  // System Management
  // ============================================

  /**
   * Register a system.
   * @param system System to register
   */
  registerSystem(system: ISystem): void {
    if (this._systems.has(system.name)) {
      console.warn(`System "${system.name}" already registered, replacing.`);
      this.unregisterSystem(system.name);
    }

    this._systems.set(system.name, {
      system,
      enabled: system.enabled,
    });

    // Initialize if world is already initialized
    if (this._initialized) {
      system.init(this);
    }

    // Re-sort systems
    this.sortSystems();
  }

  /**
   * Unregister a system.
   * @param name System name
   */
  unregisterSystem(name: string): void {
    const entry = this._systems.get(name);
    if (entry) {
      entry.system.destroy();
      this._systems.delete(name);
      this.sortSystems();
    }
  }

  /**
   * Get system by name.
   * @param name System name
   * @returns System or undefined
   */
  getSystem<T extends ISystem>(name: string): T | undefined {
    const entry = this._systems.get(name);
    return entry?.system as T | undefined;
  }

  /**
   * Enable/disable a system.
   * @param name System name
   * @param enabled Enabled state
   */
  setSystemEnabled(name: string, enabled: boolean): void {
    const entry = this._systems.get(name);
    if (entry) {
      entry.enabled = enabled;
      entry.system.enabled = enabled;
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Initialize world and all systems.
   */
  async init(): Promise<void> {
    if (this._initialized) {
      console.warn('World already initialized');
      return;
    }

    // Sort systems before initialization
    this.sortSystems();

    // Initialize all systems in order
    for (const system of this._sortedSystems) {
      system.init(this);
    }

    this._initialized = true;
  }

  /**
   * Update all systems.
   * @param dt Delta time in seconds
   */
  update(dt: number): void {
    // Update context
    this._context.dt = dt;
    this._context.time += dt;
    this._context.frame++;

    // Update all enabled systems
    for (const system of this._sortedSystems) {
      if (system.enabled) {
        system.update(dt);
      }
    }

    // Late update
    for (const system of this._lateUpdateSystems) {
      if (system.enabled && system.lateUpdate) {
        system.lateUpdate(dt);
      }
    }
  }

  /**
   * Fixed update for physics systems.
   * @param fixedDt Fixed delta time
   */
  fixedUpdate(fixedDt: number): void {
    this._context.fixedDt = fixedDt;

    for (const system of this._fixedUpdateSystems) {
      if (system.enabled && system.fixedUpdate) {
        system.fixedUpdate(fixedDt);
      }
    }
  }

  /**
   * Clean up world and all systems.
   */
  destroy(): void {
    // Destroy all systems in reverse order
    const reversed = [...this._sortedSystems].reverse();
    for (const system of reversed) {
      system.destroy();
    }

    this._systems.clear();
    this._sortedSystems = [];
    this._fixedUpdateSystems = [];
    this._lateUpdateSystems = [];
    this._queryCache.clear();

    // Reset bitECS world
    resetWorld(this._raw);

    this._initialized = false;
  }

  /**
   * Update context values (called by GameLoop).
   */
  updateContext(updates: Partial<ISystemContext>): void {
    Object.assign(this._context, updates);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Sort systems by priority and dependencies.
   */
  private sortSystems(): void {
    const entries = Array.from(this._systems.values());
    const systems = entries.map(e => e.system);

    // Topological sort with priority
    this._sortedSystems = this.topologicalSort(systems);

    // Separate systems by update type
    this._fixedUpdateSystems = this._sortedSystems.filter(s => s.fixedUpdate);
    this._lateUpdateSystems = this._sortedSystems.filter(s => s.lateUpdate);
  }

  /**
   * Topological sort of systems based on dependencies and priority.
   */
  private topologicalSort(systems: ISystem[]): ISystem[] {
    const sorted: ISystem[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const systemMap = new Map<string, ISystem>();

    for (const system of systems) {
      systemMap.set(system.name, system);
    }

    const visit = (system: ISystem): void => {
      if (visited.has(system.name)) return;
      if (visiting.has(system.name)) {
        console.error(`Circular dependency detected involving system: ${system.name}`);
        return;
      }

      visiting.add(system.name);

      // Visit dependencies first
      for (const depName of system.dependencies) {
        const dep = systemMap.get(depName);
        if (dep) {
          visit(dep);
        } else {
          console.warn(`System "${system.name}" depends on unknown system "${depName}"`);
        }
      }

      visiting.delete(system.name);
      visited.add(system.name);
      sorted.push(system);
    };

    // Sort by priority first, then apply topological sort
    const byPriority = [...systems].sort((a, b) => a.priority - b.priority);

    for (const system of byPriority) {
      visit(system);
    }

    return sorted;
  }

  /**
   * Generate a cache key for component query.
   */
  private getQueryCacheKey(components: Component[]): string {
    // Use component object references to create unique key
    // This works because bitECS components are singleton objects
    return components.map(c => {
      // Get a unique identifier for each component
      // We use the component's property names as a fingerprint
      const keys = Object.keys(c).sort().join(',');
      return keys;
    }).join('|');
  }
}
