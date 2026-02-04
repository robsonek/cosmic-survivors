/**
 * Magic Wand - Basic projectile weapon.
 *
 * A beginner-friendly weapon that fires magic projectiles
 * at the closest enemy. Good all-around weapon with balanced stats.
 */

import type { IWeaponDefinition } from '../../shared/interfaces/IWeapon';
import {
  WeaponCategory,
  WeaponRarity,
  WeaponTargeting,
} from '../../shared/interfaces/IWeapon';
import { DamageType } from '../../shared/interfaces/IEventBus';

/**
 * Magic Wand weapon definition.
 */
export const MagicWandDefinition: IWeaponDefinition = {
  id: 'magic_wand',
  name: 'Magic Wand',
  description: 'Fires magic missiles at the closest enemy. A reliable starter weapon.',
  category: WeaponCategory.Projectile,
  rarity: WeaponRarity.Common,
  targeting: WeaponTargeting.Closest,

  baseStats: {
    damage: 10,
    damageType: DamageType.Arcane,
    cooldown: 1.0, // 1 second between shots
    range: 300,
    projectileCount: 1,
    projectileSpeed: 350,
    pierce: 0,
    critChance: 0.05,
    critMultiplier: 1.5,
  },

  maxLevel: 8,

  levelScaling: {
    damage: 3, // +3 damage per level
    projectileCount: 0.25, // +1 projectile every 4 levels (at levels 4 and 8)
    cooldown: -0.05, // -0.05s cooldown per level
    projectileSpeed: 10, // +10 speed per level
  },

  spriteKey: 'weapon_magic_wand',
  projectileKey: 'projectile_magic',
  sfxKey: 'sfx_magic_wand',

  evolutionWith: ['empty_tome'],
  evolutionInto: 'holy_wand',

  synergies: ['empty_tome', 'duplicator'],
};
