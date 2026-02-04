/**
 * SpawnManager - Manager for spawning enemy entities.
 *
 * Handles spawn configurations, formations, and position strategies.
 * Implements the ISpawner interface.
 */

import type { IWorld, EntityId } from '../../shared/interfaces/IWorld';
import type { ISpawner, ISpawnConfig } from '../../shared/interfaces/IAI';
import { SpawnPosition, SpawnFormation } from '../../shared/interfaces/IAI';
import { EnemyFactory } from '../../entities/EnemyFactory';
import { EnemyRegistry } from '../definitions/EnemyDefinition';
import { Position, Tags } from '../../shared/types/components';
import { defineQuery } from 'bitecs';
import { MAX_ENEMIES, ENEMY_SPAWN_MARGIN, GAME_WIDTH, GAME_HEIGHT } from '../../shared/constants/game';
import { randomRange, randomElement, TWO_PI } from '../../shared/utils/math';

/**
 * Spawn point calculated by position strategy.
 */
interface SpawnPoint {
  x: number;
  y: number;
}

/**
 * SpawnManager - Handles enemy spawning.
 */
export class SpawnManager implements ISpawner {
  private world: IWorld;
  private factory: EnemyFactory;
  private enemyEntities: Set<EntityId> = new Set();
  private maxEnemies: number = MAX_ENEMIES;

  // Query for players (to spawn around them)
  private playerQuery: ReturnType<typeof defineQuery> | null = null;

  // Camera/viewport info for edge spawning
  private viewportX = 0;
  private viewportY = 0;
  private viewportWidth = GAME_WIDTH;
  private viewportHeight = GAME_HEIGHT;

  // Arena bounds
  private arenaMinX = 0;
  private arenaMinY = 0;
  private arenaMaxX = GAME_WIDTH * 2;
  private arenaMaxY = GAME_HEIGHT * 2;

  constructor(world: IWorld) {
    this.world = world;
    this.factory = new EnemyFactory(world);

    // Define player query
    this.playerQuery = defineQuery([Position, Tags.Player]);
  }

  /**
   * Set the viewport for edge spawning calculations.
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    this.viewportX = x;
    this.viewportY = y;
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Set the arena bounds.
   */
  setArenaBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.arenaMinX = minX;
    this.arenaMinY = minY;
    this.arenaMaxX = maxX;
    this.arenaMaxY = maxY;
  }

  /**
   * Set maximum enemies allowed.
   */
  setMaxEnemies(max: number): void {
    this.maxEnemies = max;
  }

  /**
   * Spawn enemies based on configuration.
   */
  spawn(config: ISpawnConfig): EntityId[] {
    const spawned: EntityId[] = [];

    // Check if we can spawn more enemies
    const remainingSlots = this.maxEnemies - this.enemyEntities.size;
    const countToSpawn = Math.min(config.count, remainingSlots);

    if (countToSpawn <= 0) {
      console.warn('SpawnManager: Max enemies reached, cannot spawn more');
      return spawned;
    }

    // Get enemy definition
    const definition = EnemyRegistry.get(config.enemyId);
    if (!definition) {
      console.warn(`SpawnManager: Enemy definition not found: ${config.enemyId}`);
      return spawned;
    }

    // Calculate spawn positions
    const positions = this.calculateSpawnPositions(config, countToSpawn);

    // Spawn enemies
    for (const pos of positions) {
      const entity = this.factory.createEnemy(definition, pos.x, pos.y);
      this.enemyEntities.add(entity);
      spawned.push(entity);
    }

    return spawned;
  }

  /**
   * Spawn a single enemy at a specific position.
   */
  spawnEnemy(enemyId: string, x: number, y: number): EntityId {
    // Check if we can spawn
    if (this.enemyEntities.size >= this.maxEnemies) {
      console.warn('SpawnManager: Max enemies reached');
      return -1;
    }

    const entity = this.factory.createEnemyById(enemyId, x, y);
    if (entity !== null) {
      this.enemyEntities.add(entity);
      return entity;
    }

    return -1;
  }

  /**
   * Spawn a boss enemy.
   */
  spawnBoss(bossId: string): EntityId {
    const definition = EnemyRegistry.get(bossId);
    if (!definition) {
      console.warn(`SpawnManager: Boss definition not found: ${bossId}`);
      return -1;
    }

    // Bosses spawn at edge of screen
    const position = this.getEdgeSpawnPosition();
    const entity = this.factory.createEnemy(definition, position.x, position.y);
    this.enemyEntities.add(entity);

    return entity;
  }

  /**
   * Get current enemy count.
   */
  getEnemyCount(): number {
    return this.enemyEntities.size;
  }

  /**
   * Get maximum allowed enemies.
   */
  getMaxEnemies(): number {
    return this.maxEnemies;
  }

  /**
   * Clear all enemies.
   */
  clearAllEnemies(): void {
    for (const entity of this.enemyEntities) {
      if (this.world.entityExists(entity)) {
        this.world.removeEntity(entity);
      }
    }
    this.enemyEntities.clear();
  }

  /**
   * Remove an enemy from tracking (called when enemy dies).
   */
  removeEnemy(entity: EntityId): void {
    this.enemyEntities.delete(entity);
  }

  /**
   * Calculate spawn positions based on configuration.
   */
  private calculateSpawnPositions(config: ISpawnConfig, count: number): SpawnPoint[] {
    // Get base positions based on spawn position strategy
    const basePositions = this.getBaseSpawnPositions(config, count);

    // Apply formation if spawning as group
    if (config.spawnAsGroup && config.formation && config.formation !== SpawnFormation.None) {
      // Use the first base position as formation center
      const center = basePositions[0] || { x: this.viewportX + this.viewportWidth / 2, y: this.viewportY + this.viewportHeight / 2 };
      return this.applyFormation(center, count, config.formation);
    }

    // Otherwise, return base positions (one per enemy)
    return basePositions.slice(0, count);
  }

  /**
   * Get base spawn positions based on spawn strategy.
   */
  private getBaseSpawnPositions(config: ISpawnConfig, count: number): SpawnPoint[] {
    const positions: SpawnPoint[] = [];

    switch (config.spawnPosition) {
      case SpawnPosition.EdgeOfScreen:
        for (let i = 0; i < count; i++) {
          positions.push(this.getEdgeSpawnPosition());
        }
        break;

      case SpawnPosition.AroundPlayers:
        positions.push(...this.getAroundPlayersPositions(config, count));
        break;

      case SpawnPosition.Random:
        for (let i = 0; i < count; i++) {
          positions.push(this.getRandomPosition());
        }
        break;

      case SpawnPosition.FixedPoint:
        // For fixed point, all spawn at same location (will be spread by formation)
        for (let i = 0; i < count; i++) {
          positions.push({
            x: this.viewportX + this.viewportWidth / 2,
            y: this.viewportY + this.viewportHeight / 2,
          });
        }
        break;

      default:
        // Default to edge spawning
        for (let i = 0; i < count; i++) {
          positions.push(this.getEdgeSpawnPosition());
        }
    }

    return positions;
  }

  /**
   * Get a spawn position at the edge of the screen.
   */
  private getEdgeSpawnPosition(): SpawnPoint {
    const margin = ENEMY_SPAWN_MARGIN;

    // Pick a random edge (0=top, 1=right, 2=bottom, 3=left)
    const edge = Math.floor(Math.random() * 4);

    let x: number, y: number;

    switch (edge) {
      case 0: // Top
        x = randomRange(this.viewportX - margin, this.viewportX + this.viewportWidth + margin);
        y = this.viewportY - margin;
        break;
      case 1: // Right
        x = this.viewportX + this.viewportWidth + margin;
        y = randomRange(this.viewportY - margin, this.viewportY + this.viewportHeight + margin);
        break;
      case 2: // Bottom
        x = randomRange(this.viewportX - margin, this.viewportX + this.viewportWidth + margin);
        y = this.viewportY + this.viewportHeight + margin;
        break;
      case 3: // Left
      default:
        x = this.viewportX - margin;
        y = randomRange(this.viewportY - margin, this.viewportY + this.viewportHeight + margin);
        break;
    }

    // Clamp to arena bounds
    x = Math.max(this.arenaMinX, Math.min(this.arenaMaxX, x));
    y = Math.max(this.arenaMinY, Math.min(this.arenaMaxY, y));

    return { x, y };
  }

  /**
   * Get spawn positions around players.
   */
  private getAroundPlayersPositions(config: ISpawnConfig, count: number): SpawnPoint[] {
    const positions: SpawnPoint[] = [];

    // Get player positions
    const rawWorld = this.world.raw;
    const players = this.playerQuery ? this.playerQuery(rawWorld) : [];

    if (players.length === 0) {
      // No players, fall back to random
      for (let i = 0; i < count; i++) {
        positions.push(this.getRandomPosition());
      }
      return positions;
    }

    const minDist = config.minDistanceFromPlayers ?? 200;
    const maxDist = config.maxDistanceFromPlayers ?? 400;

    for (let i = 0; i < count; i++) {
      // Pick a random player
      const player = randomElement([...players]);
      const playerX = Position.x[player];
      const playerY = Position.y[player];

      // Random angle and distance
      const angle = Math.random() * TWO_PI;
      const distance = randomRange(minDist, maxDist);

      let x = playerX + Math.cos(angle) * distance;
      let y = playerY + Math.sin(angle) * distance;

      // Clamp to arena bounds
      x = Math.max(this.arenaMinX, Math.min(this.arenaMaxX, x));
      y = Math.max(this.arenaMinY, Math.min(this.arenaMaxY, y));

      positions.push({ x, y });
    }

    return positions;
  }

  /**
   * Get a random position within arena.
   */
  private getRandomPosition(): SpawnPoint {
    return {
      x: randomRange(this.arenaMinX, this.arenaMaxX),
      y: randomRange(this.arenaMinY, this.arenaMaxY),
    };
  }

  /**
   * Apply a formation to spawn positions.
   */
  private applyFormation(center: SpawnPoint, count: number, formation: SpawnFormation): SpawnPoint[] {
    const positions: SpawnPoint[] = [];
    const spacing = 50;

    switch (formation) {
      case SpawnFormation.Line:
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * spacing;
          positions.push({ x: center.x + offset, y: center.y });
        }
        break;

      case SpawnFormation.Circle:
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * TWO_PI;
          const radius = Math.max(spacing, spacing * count / (2 * Math.PI));
          positions.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
          });
        }
        break;

      case SpawnFormation.Triangle:
        {
          let row = 0;
          let col = 0;
          let rowCount = 1;
          for (let i = 0; i < count; i++) {
            const rowOffset = (rowCount - 1) * spacing / 2;
            positions.push({
              x: center.x + col * spacing - rowOffset,
              y: center.y + row * spacing * 0.866, // 0.866 = sqrt(3)/2 for equilateral
            });
            col++;
            if (col >= rowCount) {
              row++;
              col = 0;
              rowCount++;
            }
          }
        }
        break;

      case SpawnFormation.Square:
        {
          const side = Math.ceil(Math.sqrt(count));
          for (let i = 0; i < count; i++) {
            const row = Math.floor(i / side);
            const col = i % side;
            const offsetX = (side - 1) * spacing / 2;
            const offsetY = (Math.ceil(count / side) - 1) * spacing / 2;
            positions.push({
              x: center.x + col * spacing - offsetX,
              y: center.y + row * spacing - offsetY,
            });
          }
        }
        break;

      default:
        // No formation, just center position
        for (let i = 0; i < count; i++) {
          positions.push({ ...center });
        }
    }

    return positions;
  }

  /**
   * Spawn a wave of enemies.
   * Convenience method for spawning multiple enemy types.
   */
  spawnWave(configs: ISpawnConfig[]): EntityId[] {
    const allSpawned: EntityId[] = [];

    for (const config of configs) {
      const spawned = this.spawn(config);
      allSpawned.push(...spawned);
    }

    return allSpawned;
  }

  /**
   * Get the enemy factory.
   */
  getFactory(): EnemyFactory {
    return this.factory;
  }

  /**
   * Check if an entity is tracked as an enemy.
   */
  isEnemy(entity: EntityId): boolean {
    return this.enemyEntities.has(entity);
  }

  /**
   * Get all tracked enemy entities.
   */
  getAllEnemies(): EntityId[] {
    return Array.from(this.enemyEntities);
  }
}
