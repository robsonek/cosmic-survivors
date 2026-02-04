/**
 * Fire Wand - Slow, powerful piercing projectile weapon.
 *
 * Fires large fireballs that pierce through enemies.
 * Slower than Magic Wand but deals more damage and hits multiple targets.
 */

import type { IWeaponDefinition } from '../../shared/interfaces/IWeapon';
import {
  WeaponCategory,
  WeaponRarity,
  WeaponTargeting,
} from '../../shared/interfaces/IWeapon';
import { DamageType } from '../../shared/interfaces/IEventBus';

/**
 * Fire Wand weapon definition.
 */
export const FireWandDefinition: IWeaponDefinition = {
  id: 'fire_wand',
  name: 'Fire Wand',
  description: 'Shoots fireballs that pierce through enemies. Slow but devastating.',
  category: WeaponCategory.Projectile,
  rarity: WeaponRarity.Uncommon,
  targeting: WeaponTargeting.Closest,

  baseStats: {
    damage: 20,
    damageType: DamageType.Fire,
    cooldown: 1.5, // Slower attack speed
    range: 350,
    projectileCount: 1,
    projectileSpeed: 250, // Slower projectiles
    pierce: 2, // Pierces through 2 enemies by default
    area: 15, // Slightly larger projectile
    critChance: 0.08,
    critMultiplier: 1.8,
  },

  maxLevel: 8,

  levelScaling: {
    damage: 6, // +6 damage per level
    pierce: 0.5, // +1 pierce every 2 levels
    cooldown: -0.08, // -0.08s cooldown per level
    projectileCount: 0.2, // +1 projectile every 5 levels
    area: 2, // +2 area per level
  },

  spriteKey: 'weapon_fire_wand',
  projectileKey: 'projectile_fire',
  sfxKey: 'sfx_fireball',

  evolutionWith: ['spinach'],
  evolutionInto: 'hellfire',

  synergies: ['spinach', 'candelabrador'],
};
