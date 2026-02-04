/**
 * SpatialHash - Spatial partitioning for efficient collision detection.
 *
 * Uses a grid-based spatial hashing approach where entities are inserted
 * into cells based on their position and radius. Supports efficient queries
 * for entities in a given radius or rectangle.
 */

import type { EntityId } from '../shared/interfaces/IWorld';
import type { ISpatialHash } from '../shared/interfaces/IPhysics';
import { CollisionLayer } from '../shared/interfaces/IPhysics';
import { SPATIAL_CELL_SIZE } from '../shared/constants/game';

/**
 * Entity data stored in the spatial hash.
 */
interface SpatialEntity {
  entity: EntityId;
  x: number;
  y: number;
  radius: number;
  layer: CollisionLayer;
  cells: Set<number>; // Set of cell keys this entity occupies
}

/**
 * Grid-based spatial hash for O(1) average case entity queries.
 */
export class SpatialHash implements ISpatialHash {
  public readonly cellSize: number;

  // Map from cell key to set of entity IDs in that cell
  private readonly cells: Map<number, Set<EntityId>> = new Map();

  // Map from entity ID to its spatial data
  private readonly entities: Map<EntityId, SpatialEntity> = new Map();

  // Object pool for reusing sets
  private readonly setPool: Set<EntityId>[] = [];

  // Temporary array for query results (reused to avoid allocations)
  private readonly queryResultBuffer: EntityId[] = [];
  private readonly seenEntities: Set<EntityId> = new Set();

  constructor(cellSize: number = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  /**
   * Get a unique key for a cell at grid coordinates.
   * Uses Cantor pairing function for unique 2D -> 1D mapping.
   */
  private getCellKey(cellX: number, cellY: number): number {
    // Handle negative coordinates by shifting to positive space
    // Supports worlds up to ~65536 cells in each direction
    const x = cellX + 32768;
    const y = cellY + 32768;
    return x + y * 65536;
  }

  /**
   * Convert world coordinates to cell coordinates.
   */
  private worldToCellX(x: number): number {
    return Math.floor(x / this.cellSize);
  }

  private worldToCellY(y: number): number {
    return Math.floor(y / this.cellSize);
  }

  /**
   * Get or create a cell set from pool.
   */
  private getSet(): Set<EntityId> {
    const set = this.setPool.pop();
    if (set) {
      return set;
    }
    return new Set();
  }

  /**
   * Return a set to the pool.
   */
  private returnSet(set: Set<EntityId>): void {
    set.clear();
    if (this.setPool.length < 1000) {
      this.setPool.push(set);
    }
  }

  /**
   * Get all cells that an entity overlaps based on position and radius.
   */
  private getEntityCells(x: number, y: number, radius: number): Set<number> {
    const cellSet = new Set<number>();

    const minCellX = this.worldToCellX(x - radius);
    const maxCellX = this.worldToCellX(x + radius);
    const minCellY = this.worldToCellY(y - radius);
    const maxCellY = this.worldToCellY(y + radius);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        cellSet.add(this.getCellKey(cx, cy));
      }
    }

    return cellSet;
  }

  /**
   * Insert entity into spatial hash.
   */
  insert(entity: EntityId, x: number, y: number, radius: number, layer: CollisionLayer = CollisionLayer.None): void {
    // Remove if already exists
    if (this.entities.has(entity)) {
      this.remove(entity);
    }

    const cells = this.getEntityCells(x, y, radius);

    const spatialEntity: SpatialEntity = {
      entity,
      x,
      y,
      radius,
      layer,
      cells,
    };

    this.entities.set(entity, spatialEntity);

    // Add to all overlapping cells
    for (const cellKey of cells) {
      let cell = this.cells.get(cellKey);
      if (!cell) {
        cell = this.getSet();
        this.cells.set(cellKey, cell);
      }
      cell.add(entity);
    }
  }

  /**
   * Remove entity from spatial hash.
   */
  remove(entity: EntityId): void {
    const spatialEntity = this.entities.get(entity);
    if (!spatialEntity) {
      return;
    }

    // Remove from all cells
    for (const cellKey of spatialEntity.cells) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        cell.delete(entity);
        if (cell.size === 0) {
          this.returnSet(cell);
          this.cells.delete(cellKey);
        }
      }
    }

    this.entities.delete(entity);
  }

  /**
   * Update entity position in spatial hash.
   */
  update(entity: EntityId, x: number, y: number, radius: number, layer?: CollisionLayer): void {
    const existing = this.entities.get(entity);

    if (!existing) {
      // Entity doesn't exist, insert it
      this.insert(entity, x, y, radius, layer);
      return;
    }

    // Calculate new cells
    const newCells = this.getEntityCells(x, y, radius);

    // Check if cells changed
    let cellsChanged = newCells.size !== existing.cells.size;
    if (!cellsChanged) {
      for (const cellKey of newCells) {
        if (!existing.cells.has(cellKey)) {
          cellsChanged = true;
          break;
        }
      }
    }

    if (cellsChanged) {
      // Remove from old cells that are no longer occupied
      for (const cellKey of existing.cells) {
        if (!newCells.has(cellKey)) {
          const cell = this.cells.get(cellKey);
          if (cell) {
            cell.delete(entity);
            if (cell.size === 0) {
              this.returnSet(cell);
              this.cells.delete(cellKey);
            }
          }
        }
      }

      // Add to new cells
      for (const cellKey of newCells) {
        if (!existing.cells.has(cellKey)) {
          let cell = this.cells.get(cellKey);
          if (!cell) {
            cell = this.getSet();
            this.cells.set(cellKey, cell);
          }
          cell.add(entity);
        }
      }

      existing.cells = newCells;
    }

    // Update position data
    existing.x = x;
    existing.y = y;
    existing.radius = radius;
    if (layer !== undefined) {
      existing.layer = layer;
    }
  }

  /**
   * Query entities within a radius.
   */
  queryRadius(x: number, y: number, radius: number): EntityId[] {
    this.seenEntities.clear();
    this.queryResultBuffer.length = 0;

    const minCellX = this.worldToCellX(x - radius);
    const maxCellX = this.worldToCellX(x + radius);
    const minCellY = this.worldToCellY(y - radius);
    const maxCellY = this.worldToCellY(y + radius);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const cellKey = this.getCellKey(cx, cy);
        const cell = this.cells.get(cellKey);

        if (!cell) continue;

        for (const entityId of cell) {
          if (this.seenEntities.has(entityId)) continue;
          this.seenEntities.add(entityId);

          const entity = this.entities.get(entityId);
          if (!entity) continue;

          // Check actual distance including entity radius
          const dx = entity.x - x;
          const dy = entity.y - y;
          const distSq = dx * dx + dy * dy;
          const combinedRadius = radius + entity.radius;

          if (distSq <= combinedRadius * combinedRadius) {
            this.queryResultBuffer.push(entityId);
          }
        }
      }
    }

    // Return a copy to avoid mutation issues
    return [...this.queryResultBuffer];
  }

  /**
   * Query entities within a rectangle.
   */
  queryRect(x: number, y: number, width: number, height: number): EntityId[] {
    this.seenEntities.clear();
    this.queryResultBuffer.length = 0;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const minCellX = this.worldToCellX(x - halfWidth);
    const maxCellX = this.worldToCellX(x + halfWidth);
    const minCellY = this.worldToCellY(y - halfHeight);
    const maxCellY = this.worldToCellY(y + halfHeight);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const cellKey = this.getCellKey(cx, cy);
        const cell = this.cells.get(cellKey);

        if (!cell) continue;

        for (const entityId of cell) {
          if (this.seenEntities.has(entityId)) continue;
          this.seenEntities.add(entityId);

          const entity = this.entities.get(entityId);
          if (!entity) continue;

          // AABB check including entity radius
          const entityLeft = entity.x - entity.radius;
          const entityRight = entity.x + entity.radius;
          const entityTop = entity.y - entity.radius;
          const entityBottom = entity.y + entity.radius;

          const rectLeft = x - halfWidth;
          const rectRight = x + halfWidth;
          const rectTop = y - halfHeight;
          const rectBottom = y + halfHeight;

          if (entityRight >= rectLeft && entityLeft <= rectRight &&
              entityBottom >= rectTop && entityTop <= rectBottom) {
            this.queryResultBuffer.push(entityId);
          }
        }
      }
    }

    return [...this.queryResultBuffer];
  }

  /**
   * Query entities by layer within a radius.
   */
  queryRadiusWithLayer(x: number, y: number, radius: number, layer: CollisionLayer): EntityId[] {
    this.seenEntities.clear();
    this.queryResultBuffer.length = 0;

    const minCellX = this.worldToCellX(x - radius);
    const maxCellX = this.worldToCellX(x + radius);
    const minCellY = this.worldToCellY(y - radius);
    const maxCellY = this.worldToCellY(y + radius);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const cellKey = this.getCellKey(cx, cy);
        const cell = this.cells.get(cellKey);

        if (!cell) continue;

        for (const entityId of cell) {
          if (this.seenEntities.has(entityId)) continue;
          this.seenEntities.add(entityId);

          const entity = this.entities.get(entityId);
          if (!entity) continue;

          // Check layer
          if ((entity.layer & layer) === 0) continue;

          // Check actual distance including entity radius
          const dx = entity.x - x;
          const dy = entity.y - y;
          const distSq = dx * dx + dy * dy;
          const combinedRadius = radius + entity.radius;

          if (distSq <= combinedRadius * combinedRadius) {
            this.queryResultBuffer.push(entityId);
          }
        }
      }
    }

    return [...this.queryResultBuffer];
  }

  /**
   * Get entity spatial data.
   */
  getEntityData(entity: EntityId): SpatialEntity | undefined {
    return this.entities.get(entity);
  }

  /**
   * Set entity layer.
   */
  setEntityLayer(entity: EntityId, layer: CollisionLayer): void {
    const data = this.entities.get(entity);
    if (data) {
      data.layer = layer;
    }
  }

  /**
   * Clear all entities from spatial hash.
   */
  clear(): void {
    // Return all cell sets to pool
    for (const cell of this.cells.values()) {
      this.returnSet(cell);
    }

    this.cells.clear();
    this.entities.clear();
    this.seenEntities.clear();
    this.queryResultBuffer.length = 0;
  }

  /**
   * Get statistics for debugging.
   */
  getStats(): { entityCount: number; cellCount: number; avgEntitiesPerCell: number } {
    const entityCount = this.entities.size;
    const cellCount = this.cells.size;

    let totalInCells = 0;
    for (const cell of this.cells.values()) {
      totalInCells += cell.size;
    }

    const avgEntitiesPerCell = cellCount > 0 ? totalInCells / cellCount : 0;

    return { entityCount, cellCount, avgEntitiesPerCell };
  }
}
