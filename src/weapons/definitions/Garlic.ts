/**
 * Garlic - Passive area damage weapon.
 *
 * Creates a damaging aura around the player that damages
 * nearby enemies continuously. Great for survival.
 */

import type { IWeaponDefinition } from '../../shared/interfaces/IWeapon';
import {
  WeaponCategory,
  WeaponRarity,
  WeaponTargeting,
} from '../../shared/interfaces/IWeapon';
import { DamageType } from '../../shared/interfaces/IEventBus';

/**
 * Garlic weapon definition.
 */
export const GarlicDefinition: IWeaponDefinition = {
  id: 'garlic',
  name: 'Garlic',
  description: 'Creates a damaging aura around you. Enemies that get too close take damage.',
  category: WeaponCategory.Area,
  rarity: WeaponRarity.Common,
  targeting: WeaponTargeting.Area,

  baseStats: {
    damage: 5, // Damage per tick
    damageType: DamageType.Physical,
    cooldown: 0.5, // Re-applies every 0.5s (tick rate)
    range: 0, // Not used for area weapons
    area: 40, // Radius of aura
    duration: 999, // Persistent effect
    knockback: 5, // Small pushback
  },

  maxLevel: 8,

  levelScaling: {
    damage: 1.5, // +1.5 damage per level
    area: 5, // +5 radius per level
    knockback: 1, // +1 knockback per level
  },

  spriteKey: 'weapon_garlic',
  sfxKey: 'sfx_garlic_pulse',

  evolutionWith: ['pummarola'],
  evolutionInto: 'soul_eater',

  synergies: ['pummarola', 'armor'],
};
