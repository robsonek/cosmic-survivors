/**
 * Whip - Melee sweep weapon.
 *
 * A horizontal sweep attack that hits multiple enemies
 * in a wide arc. High damage, but requires enemies to be close.
 */

import type { IWeaponDefinition } from '../../shared/interfaces/IWeapon';
import {
  WeaponCategory,
  WeaponRarity,
  WeaponTargeting,
} from '../../shared/interfaces/IWeapon';
import { DamageType } from '../../shared/interfaces/IEventBus';

/**
 * Whip weapon definition.
 */
export const WhipDefinition: IWeaponDefinition = {
  id: 'whip',
  name: 'Whip',
  description: 'Attacks horizontally, passing through enemies. Hits all enemies in its path.',
  category: WeaponCategory.Melee,
  rarity: WeaponRarity.Common,
  targeting: WeaponTargeting.Directional,

  baseStats: {
    damage: 15,
    damageType: DamageType.Physical,
    cooldown: 1.2, // Slower attack speed
    range: 80, // Melee range
    area: 60, // Width of the sweep
    duration: 0.3, // Duration of the hitbox
    knockback: 10,
    critChance: 0.05,
    critMultiplier: 1.5,
  },

  maxLevel: 8,

  levelScaling: {
    damage: 5, // +5 damage per level
    area: 8, // +8 area per level
    cooldown: -0.05, // -0.05s cooldown per level
  },

  spriteKey: 'weapon_whip',
  sfxKey: 'sfx_whip_crack',

  evolutionWith: ['hollow_heart'],
  evolutionInto: 'bloody_tear',

  synergies: ['hollow_heart', 'spinach'],
};
