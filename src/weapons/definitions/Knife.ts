/**
 * Knife - Fast directional projectile weapon.
 *
 * A rapid-fire weapon that shoots knives in the direction
 * the player is moving. High attack speed, moderate damage.
 */

import type { IWeaponDefinition } from '../../shared/interfaces/IWeapon';
import {
  WeaponCategory,
  WeaponRarity,
  WeaponTargeting,
} from '../../shared/interfaces/IWeapon';
import { DamageType } from '../../shared/interfaces/IEventBus';

/**
 * Knife weapon definition.
 */
export const KnifeDefinition: IWeaponDefinition = {
  id: 'knife',
  name: 'Knife',
  description: 'Throws knives in the direction you move. Fast and precise.',
  category: WeaponCategory.Projectile,
  rarity: WeaponRarity.Common,
  targeting: WeaponTargeting.Directional,

  baseStats: {
    damage: 8,
    damageType: DamageType.Physical,
    cooldown: 0.5, // 0.5 seconds between shots (fast!)
    range: 400,
    projectileCount: 1,
    projectileSpeed: 500, // Very fast
    pierce: 0,
    critChance: 0.1, // Higher crit chance
    critMultiplier: 2.0,
  },

  maxLevel: 8,

  levelScaling: {
    damage: 2, // +2 damage per level
    projectileCount: 0.33, // +1 projectile every 3 levels
    cooldown: -0.03, // -0.03s cooldown per level
    projectileSpeed: 20, // +20 speed per level
    critChance: 0.01, // +1% crit chance per level
  },

  spriteKey: 'weapon_knife',
  projectileKey: 'projectile_knife',
  sfxKey: 'sfx_knife_throw',

  evolutionWith: ['bracer'],
  evolutionInto: 'thousand_edge',

  synergies: ['bracer', 'wings'],
};
