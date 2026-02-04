/**
 * EnemyFactory - Factory for creating enemy entities.
 *
 * Creates enemy entities with all required components based on
 * enemy definitions.
 */

import { addComponent } from 'bitecs';
import type { IWorld, EntityId } from '../shared/interfaces/IWorld';
import type { IEnemyDefinition } from '../ai/definitions/EnemyDefinition';
import { EnemyRegistry } from '../ai/definitions/EnemyDefinition';
import { AIState } from '../shared/interfaces/IAI';
import { CollisionLayer, CollisionMasks } from '../shared/interfaces/IPhysics';
import {
  Position,
  Velocity,
  Health,
  Sprite,
  CircleCollider,
  AIController,
  Flocking,
  Movement,
  Tags,
} from '../shared/types/components';

/**
 * Map AI state enum to numeric value for ECS component.
 */
const AIStateToNumber: Record<AIState, number> = {
  [AIState.Idle]: 0,
  [AIState.Wander]: 1,
  [AIState.Chase]: 2,
  [AIState.Attack]: 3,
  [AIState.Flee]: 4,
  [AIState.Stunned]: 5,
  [AIState.Dead]: 6,
};

/**
 * Factory for creating enemy entities.
 */
export class EnemyFactory {
  private world: IWorld;
  private behaviorIdCounter = 0;
  private readonly behaviorIdMap: Map<string, number> = new Map();

  constructor(world: IWorld) {
    this.world = world;
  }

  /**
   * Get or create a behavior ID for an enemy type.
   */
  private getBehaviorId(enemyId: string): number {
    let id = this.behaviorIdMap.get(enemyId);
    if (id === undefined) {
      id = this.behaviorIdCounter++;
      this.behaviorIdMap.set(enemyId, id);
    }
    return id;
  }

  /**
   * Create an enemy entity from a definition.
   *
   * @param definition Enemy definition
   * @param x Spawn X position
   * @param y Spawn Y position
   * @returns Created entity ID
   */
  createEnemy(definition: IEnemyDefinition, x: number, y: number): EntityId {
    const entity = this.world.createEntity();
    const rawWorld = this.world.raw;

    // Add Position component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Position, entity);
    Position.x[entity] = x;
    Position.y[entity] = y;

    // Add Velocity component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Velocity, entity);
    Velocity.x[entity] = 0;
    Velocity.y[entity] = 0;

    // Add Movement component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Movement, entity);
    Movement.maxSpeed[entity] = definition.speed;
    Movement.acceleration[entity] = definition.speed * 5; // Quick acceleration
    Movement.deceleration[entity] = definition.speed * 3;
    Movement.friction[entity] = 0.1;
    Movement.mass[entity] = definition.flags?.knockbackImmune ? 100 : 1;

    // Add Health component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Health, entity);
    Health.current[entity] = definition.health;
    Health.max[entity] = definition.health;
    Health.shield[entity] = 0;
    Health.shieldMax[entity] = 0;
    Health.armor[entity] = 0;
    Health.invulnerable[entity] = 0;
    Health.invulnerableTime[entity] = 0;

    // Add Sprite component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Sprite, entity);
    Sprite.textureId[entity] = this.getSpriteTextureId(definition.spriteKey);
    Sprite.frameIndex[entity] = 0;
    Sprite.width[entity] = definition.spriteWidth ?? 32;
    Sprite.height[entity] = definition.spriteHeight ?? 32;
    Sprite.originX[entity] = 0.5;
    Sprite.originY[entity] = 0.5;
    Sprite.tint[entity] = definition.tint ?? 0xFFFFFFFF;
    Sprite.alpha[entity] = 1;
    Sprite.layer[entity] = 10; // Enemy layer
    Sprite.flipX[entity] = 0;
    Sprite.flipY[entity] = 0;
    Sprite.visible[entity] = 1;

    // Add CircleCollider component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], CircleCollider, entity);
    CircleCollider.radius[entity] = definition.collisionRadius ?? 16;
    CircleCollider.offsetX[entity] = 0;
    CircleCollider.offsetY[entity] = 0;
    CircleCollider.layer[entity] = CollisionLayer.Enemy;
    CircleCollider.mask[entity] = CollisionMasks.Enemy;
    CircleCollider.isTrigger[entity] = definition.flags?.ghosting ? 1 : 0;

    // Add AIController component
    addComponent(rawWorld as Parameters<typeof addComponent>[0], AIController, entity);
    AIController.behaviorId[entity] = this.getBehaviorId(definition.id);
    AIController.state[entity] = AIStateToNumber[AIState.Idle];
    AIController.targetEntity[entity] = 0;
    AIController.stateTime[entity] = 0;
    AIController.alertRadius[entity] = definition.behaviorConfig.detectionRange;
    AIController.attackRadius[entity] = definition.behaviorConfig.attackRange;
    AIController.attackCooldown[entity] = definition.behaviorConfig.attackCooldown;
    AIController.lastAttackTime[entity] = 0;

    // Add Flocking component if enabled
    if (definition.behaviorConfig.useFlocking) {
      addComponent(rawWorld as Parameters<typeof addComponent>[0], Flocking, entity);
      Flocking.separationWeight[entity] = definition.behaviorConfig.separationWeight ?? 1.5;
      Flocking.alignmentWeight[entity] = definition.behaviorConfig.alignmentWeight ?? 1.0;
      Flocking.cohesionWeight[entity] = definition.behaviorConfig.cohesionWeight ?? 1.0;
      Flocking.neighborRadius[entity] = 100;
      Flocking.maxNeighbors[entity] = 10;
    }

    // Add Enemy tag
    addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Enemy, entity);

    // Add Boss tag if applicable
    if (definition.type === 'boss') {
      addComponent(rawWorld as Parameters<typeof addComponent>[0], Tags.Boss, entity);
    }

    return entity;
  }

  /**
   * Create an enemy by ID.
   *
   * @param enemyId Enemy definition ID
   * @param x Spawn X position
   * @param y Spawn Y position
   * @returns Created entity ID or null if definition not found
   */
  createEnemyById(enemyId: string, x: number, y: number): EntityId | null {
    const definition = EnemyRegistry.get(enemyId);
    if (!definition) {
      console.warn(`Enemy definition not found: ${enemyId}`);
      return null;
    }
    return this.createEnemy(definition, x, y);
  }

  /**
   * Create multiple enemies in a formation.
   *
   * @param definition Enemy definition
   * @param centerX Center X position
   * @param centerY Center Y position
   * @param count Number of enemies to spawn
   * @param formation Formation type
   * @returns Array of created entity IDs
   */
  createEnemyFormation(
    definition: IEnemyDefinition,
    centerX: number,
    centerY: number,
    count: number,
    formation: 'line' | 'circle' | 'triangle' | 'square' = 'circle'
  ): EntityId[] {
    const entities: EntityId[] = [];
    const positions = this.getFormationPositions(centerX, centerY, count, formation);

    for (const pos of positions) {
      const entity = this.createEnemy(definition, pos.x, pos.y);
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Calculate positions for a formation.
   */
  private getFormationPositions(
    centerX: number,
    centerY: number,
    count: number,
    formation: 'line' | 'circle' | 'triangle' | 'square'
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const spacing = 40;

    switch (formation) {
      case 'line':
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * spacing;
          positions.push({ x: centerX + offset, y: centerY });
        }
        break;

      case 'circle':
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const radius = Math.max(spacing, spacing * count / (2 * Math.PI));
          positions.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
          });
        }
        break;

      case 'triangle':
        {
          let row = 0;
          let col = 0;
          let rowCount = 1;
          for (let i = 0; i < count; i++) {
            const rowOffset = (rowCount - 1) * spacing / 2;
            positions.push({
              x: centerX + col * spacing - rowOffset,
              y: centerY + row * spacing,
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

      case 'square':
        {
          const side = Math.ceil(Math.sqrt(count));
          for (let i = 0; i < count; i++) {
            const row = Math.floor(i / side);
            const col = i % side;
            const offsetX = (side - 1) * spacing / 2;
            const offsetY = (Math.ceil(count / side) - 1) * spacing / 2;
            positions.push({
              x: centerX + col * spacing - offsetX,
              y: centerY + row * spacing - offsetY,
            });
          }
        }
        break;
    }

    return positions;
  }

  /**
   * Get sprite texture ID from key.
   * This would normally look up the texture atlas, but for now returns a hash.
   */
  private getSpriteTextureId(spriteKey: string): number {
    // Simple hash function for sprite key -> texture ID
    let hash = 0;
    for (let i = 0; i < spriteKey.length; i++) {
      const char = spriteKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 65535;
  }

  /**
   * Get the world reference.
   */
  getWorld(): IWorld {
    return this.world;
  }

  /**
   * Set a new world reference.
   */
  setWorld(world: IWorld): void {
    this.world = world;
  }
}
