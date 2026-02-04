/**
 * PlayerFactory - Creates player entities with all required components.
 */

import { addEntity, addComponent } from 'bitecs';
import type { IWorld } from '../shared/interfaces/IWorld';
import {
  Position,
  Velocity,
  Movement,
  Health,
  Sprite,
  CircleCollider,
  Player,
  PlayerInput,
  StatModifiers,
  Tags,
} from '../shared/types/components';
import { CollisionLayer, CollisionMasks } from '../shared/interfaces/IPhysics';
import {
  PLAYER_BASE_HEALTH,
  PLAYER_BASE_SPEED,
  PLAYER_BASE_PICKUP_RADIUS,
} from '../shared/constants/game';

/**
 * Player character definition.
 */
export interface ICharacterDefinition {
  id: string;
  name: string;
  description: string;
  spriteKey: string;

  /** Base stats modifiers */
  health: number;
  speed: number;
  armor: number;

  /** Starting weapon ID */
  startingWeapon: string;

  /** Passive ability (optional) */
  passiveAbility?: string;

  /** Unlock condition */
  unlockCondition?: string;
}

/**
 * Built-in character definitions.
 */
export const Characters: Record<string, ICharacterDefinition> = {
  antonio: {
    id: 'antonio',
    name: 'Antonio',
    description: 'A balanced fighter with no special abilities.',
    spriteKey: 'player_antonio',
    health: PLAYER_BASE_HEALTH,
    speed: PLAYER_BASE_SPEED,
    armor: 0,
    startingWeapon: 'magic_wand',
  },
  imelda: {
    id: 'imelda',
    name: 'Imelda',
    description: 'Gains 10% more experience.',
    spriteKey: 'player_imelda',
    health: PLAYER_BASE_HEALTH,
    speed: PLAYER_BASE_SPEED,
    armor: 0,
    startingWeapon: 'magic_wand',
    passiveAbility: 'xp_boost_10',
  },
  pasqualina: {
    id: 'pasqualina',
    name: 'Pasqualina',
    description: 'Starts with +30% projectile speed.',
    spriteKey: 'player_pasqualina',
    health: PLAYER_BASE_HEALTH,
    speed: PLAYER_BASE_SPEED,
    armor: 0,
    startingWeapon: 'knife',
    passiveAbility: 'projectile_speed_30',
  },
  gennaro: {
    id: 'gennaro',
    name: 'Gennaro',
    description: 'Starts with +1 projectile.',
    spriteKey: 'player_gennaro',
    health: PLAYER_BASE_HEALTH,
    speed: PLAYER_BASE_SPEED,
    armor: 0,
    startingWeapon: 'knife',
    passiveAbility: 'extra_projectile',
  },
  arca: {
    id: 'arca',
    name: 'Arca',
    description: 'Recovers 0.5 HP per second.',
    spriteKey: 'player_arca',
    health: PLAYER_BASE_HEALTH,
    speed: PLAYER_BASE_SPEED,
    armor: 0,
    startingWeapon: 'fire_wand',
    passiveAbility: 'hp_regen',
  },
};

/**
 * Player creation options.
 */
export interface PlayerCreateOptions {
  characterId?: string;
  playerId?: number;
  x?: number;
  y?: number;
  isLocal?: boolean;
  isNetworkControlled?: boolean;
}

/**
 * Factory for creating player entities.
 */
export class PlayerFactory {
  private world: IWorld;
  private textureMap: Map<string, number> = new Map();
  private textureIdCounter = 0;

  constructor(world: IWorld) {
    this.world = world;
  }

  /**
   * Register texture key and get numeric ID.
   */
  registerTexture(key: string): number {
    if (this.textureMap.has(key)) {
      return this.textureMap.get(key)!;
    }
    const id = this.textureIdCounter++;
    this.textureMap.set(key, id);
    return id;
  }

  /**
   * Create a player entity.
   */
  createPlayer(options: PlayerCreateOptions = {}): number {
    const {
      characterId = 'antonio',
      playerId = 0,
      x = 0,
      y = 0,
      isLocal = true,
      isNetworkControlled = false,
    } = options;

    const character = Characters[characterId] || Characters.antonio;
    const entity = addEntity(this.world.raw as any);

    // Position
    addComponent(this.world.raw as any, Position, entity);
    Position.x[entity] = x;
    Position.y[entity] = y;

    // Velocity
    addComponent(this.world.raw as any, Velocity, entity);
    Velocity.x[entity] = 0;
    Velocity.y[entity] = 0;

    // Movement
    addComponent(this.world.raw as any, Movement, entity);
    Movement.maxSpeed[entity] = character.speed;
    Movement.acceleration[entity] = character.speed * 10;
    Movement.deceleration[entity] = character.speed * 8;
    Movement.friction[entity] = 0.9;
    Movement.mass[entity] = 1;

    // Health
    addComponent(this.world.raw as any, Health, entity);
    Health.current[entity] = character.health;
    Health.max[entity] = character.health;
    Health.shield[entity] = 0;
    Health.shieldMax[entity] = 0;
    Health.armor[entity] = character.armor;
    Health.invulnerable[entity] = 0;
    Health.invulnerableTime[entity] = 0;

    // Sprite
    addComponent(this.world.raw as any, Sprite, entity);
    Sprite.textureId[entity] = this.registerTexture(character.spriteKey);
    Sprite.frameIndex[entity] = 0;
    Sprite.width[entity] = 32;
    Sprite.height[entity] = 32;
    Sprite.originX[entity] = 0.5;
    Sprite.originY[entity] = 0.5;
    Sprite.tint[entity] = 0xFFFFFFFF;
    Sprite.alpha[entity] = 1;
    Sprite.layer[entity] = 50; // RenderLayer.Entities
    Sprite.flipX[entity] = 0;
    Sprite.flipY[entity] = 0;
    Sprite.visible[entity] = 1;

    // Collider
    addComponent(this.world.raw as any, CircleCollider, entity);
    CircleCollider.radius[entity] = 12;
    CircleCollider.offsetX[entity] = 0;
    CircleCollider.offsetY[entity] = 0;
    CircleCollider.layer[entity] = CollisionLayer.Player;
    CircleCollider.mask[entity] = CollisionMasks.Player;
    CircleCollider.isTrigger[entity] = 0;

    // Player
    addComponent(this.world.raw as any, Player, entity);
    Player.playerId[entity] = playerId;
    Player.characterId[entity] = this.registerTexture(characterId);
    Player.level[entity] = 1;
    Player.xp[entity] = 0;
    Player.xpToNextLevel[entity] = 5;
    Player.kills[entity] = 0;

    // Player Input
    addComponent(this.world.raw as any, PlayerInput, entity);
    PlayerInput.moveX[entity] = 0;
    PlayerInput.moveY[entity] = 0;
    PlayerInput.aimX[entity] = 1;
    PlayerInput.aimY[entity] = 0;
    PlayerInput.actions[entity] = 0;
    PlayerInput.inputTick[entity] = 0;

    // Stat Modifiers (base values, will be modified by passives/talents)
    addComponent(this.world.raw as any, StatModifiers, entity);
    StatModifiers.damageMultiplier[entity] = 1;
    StatModifiers.cooldownReduction[entity] = 0;
    StatModifiers.areaMultiplier[entity] = 1;
    StatModifiers.projectileCountBonus[entity] = 0;
    StatModifiers.speedMultiplier[entity] = 1;
    StatModifiers.healthBonus[entity] = 0;
    StatModifiers.regenPerSecond[entity] = 0;
    StatModifiers.pickupRadius[entity] = PLAYER_BASE_PICKUP_RADIUS;
    StatModifiers.xpMultiplier[entity] = 1;
    StatModifiers.critChance[entity] = 0;
    StatModifiers.critMultiplier[entity] = 2;
    StatModifiers.armorBonus[entity] = 0;

    // Apply character passive ability
    this.applyPassiveAbility(entity, character.passiveAbility);

    // Tags
    addComponent(this.world.raw as any, Tags.Player, entity);

    if (isLocal) {
      addComponent(this.world.raw as any, Tags.LocalPlayer, entity);
    }

    if (isNetworkControlled) {
      addComponent(this.world.raw as any, Tags.NetworkControlled, entity);
    }

    return entity;
  }

  /**
   * Apply character's passive ability.
   */
  private applyPassiveAbility(entity: number, passiveAbility?: string): void {
    if (!passiveAbility) return;

    switch (passiveAbility) {
      case 'xp_boost_10':
        StatModifiers.xpMultiplier[entity] = 1.1;
        break;
      case 'projectile_speed_30':
        // This would be handled by weapon system
        break;
      case 'extra_projectile':
        StatModifiers.projectileCountBonus[entity] = 1;
        break;
      case 'hp_regen':
        StatModifiers.regenPerSecond[entity] = 0.5;
        break;
    }
  }

  /**
   * Get character definition.
   */
  getCharacter(characterId: string): ICharacterDefinition | undefined {
    return Characters[characterId];
  }

  /**
   * Get all available characters.
   */
  getAllCharacters(): ICharacterDefinition[] {
    return Object.values(Characters);
  }

  /**
   * Check if character is unlocked (stub - integrate with ProgressionManager).
   */
  isCharacterUnlocked(characterId: string): boolean {
    const character = Characters[characterId];
    if (!character) return false;

    // Antonio is always unlocked
    if (characterId === 'antonio') return true;

    // Other characters need to be unlocked
    // This should be integrated with ProgressionManager
    return true; // TODO: Check actual unlock status
  }
}

/**
 * Get default export.
 */
export function createPlayerFactory(world: IWorld): PlayerFactory {
  return new PlayerFactory(world);
}
