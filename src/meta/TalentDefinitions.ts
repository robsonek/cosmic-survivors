/**
 * TalentDefinitions - All talent node definitions for the talent tree.
 *
 * Defines talents across four branches:
 * - Offense: Damage, crit, cooldown, projectiles
 * - Defense: Health, armor, regen, shield
 * - Utility: Speed, pickup radius, XP gain, duration
 * - Special: Starting weapon, revival, luck
 */

import { ITalentNode, TalentBranch } from '@shared/interfaces/IMeta';

/**
 * All talent definitions organized by branch.
 */
export const TALENT_DEFINITIONS: ITalentNode[] = [
  // ==================== OFFENSE BRANCH ====================
  {
    id: 'offense_damage_1',
    name: 'Power Strike',
    description: 'Increases all damage by 5% per level.',
    icon: 'talent_damage',
    cost: 1,
    maxLevel: 5,
    modifiers: { damagePercent: 0.05 },
    prerequisites: [],
    position: { x: 0, y: 0 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_damage_2',
    name: 'Brutal Force',
    description: 'Increases all damage by 10% per level.',
    icon: 'talent_damage_2',
    cost: 2,
    maxLevel: 3,
    modifiers: { damagePercent: 0.10 },
    prerequisites: ['offense_damage_1'],
    position: { x: 0, y: 1 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_crit_chance',
    name: 'Precision',
    description: 'Increases critical hit chance by 3% per level.',
    icon: 'talent_crit',
    cost: 1,
    maxLevel: 5,
    modifiers: { critChance: 0.03 },
    prerequisites: ['offense_damage_1'],
    position: { x: 1, y: 1 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_crit_damage',
    name: 'Deadly Strikes',
    description: 'Increases critical hit damage by 15% per level.',
    icon: 'talent_crit_damage',
    cost: 2,
    maxLevel: 3,
    modifiers: { critDamage: 0.15 },
    prerequisites: ['offense_crit_chance'],
    position: { x: 1, y: 2 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_cooldown',
    name: 'Quick Reflexes',
    description: 'Reduces all cooldowns by 3% per level.',
    icon: 'talent_cooldown',
    cost: 1,
    maxLevel: 5,
    modifiers: { cooldownReduction: 0.03 },
    prerequisites: ['offense_damage_1'],
    position: { x: -1, y: 1 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_cooldown_2',
    name: 'Rapid Fire',
    description: 'Reduces all cooldowns by 5% per level.',
    icon: 'talent_cooldown_2',
    cost: 2,
    maxLevel: 3,
    modifiers: { cooldownReduction: 0.05 },
    prerequisites: ['offense_cooldown'],
    position: { x: -1, y: 2 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_projectiles',
    name: 'Multi-Shot',
    description: 'Adds 1 additional projectile per level.',
    icon: 'talent_projectiles',
    cost: 3,
    maxLevel: 2,
    modifiers: { projectileCount: 1 },
    prerequisites: ['offense_damage_2', 'offense_cooldown_2'],
    position: { x: 0, y: 3 },
    branch: TalentBranch.Offense,
  },
  {
    id: 'offense_area',
    name: 'Blast Radius',
    description: 'Increases area of effect by 10% per level.',
    icon: 'talent_area',
    cost: 2,
    maxLevel: 3,
    modifiers: { areaPercent: 0.10 },
    prerequisites: ['offense_damage_2'],
    position: { x: 0, y: 2 },
    branch: TalentBranch.Offense,
  },

  // ==================== DEFENSE BRANCH ====================
  {
    id: 'defense_health_1',
    name: 'Vitality',
    description: 'Increases max health by 5% per level.',
    icon: 'talent_health',
    cost: 1,
    maxLevel: 5,
    modifiers: { healthPercent: 0.05 },
    prerequisites: [],
    position: { x: 3, y: 0 },
    branch: TalentBranch.Defense,
  },
  {
    id: 'defense_health_2',
    name: 'Iron Constitution',
    description: 'Increases max health by 10% per level.',
    icon: 'talent_health_2',
    cost: 2,
    maxLevel: 3,
    modifiers: { healthPercent: 0.10 },
    prerequisites: ['defense_health_1'],
    position: { x: 3, y: 1 },
    branch: TalentBranch.Defense,
  },
  {
    id: 'defense_armor',
    name: 'Thick Skin',
    description: 'Reduces damage taken by 3% per level.',
    icon: 'talent_armor',
    cost: 1,
    maxLevel: 5,
    modifiers: { healthPercent: 0.03 }, // Using healthPercent as proxy for armor
    prerequisites: ['defense_health_1'],
    position: { x: 4, y: 1 },
    branch: TalentBranch.Defense,
  },
  {
    id: 'defense_regen',
    name: 'Regeneration',
    description: 'Increases health regeneration by 5% per level.',
    icon: 'talent_regen',
    cost: 2,
    maxLevel: 3,
    modifiers: { healthPercent: 0.05 },
    prerequisites: ['defense_health_2'],
    position: { x: 3, y: 2 },
    branch: TalentBranch.Defense,
  },
  {
    id: 'defense_shield',
    name: 'Energy Shield',
    description: 'Grants a shield that absorbs damage.',
    icon: 'talent_shield',
    cost: 3,
    maxLevel: 2,
    modifiers: { healthPercent: 0.15 },
    prerequisites: ['defense_regen', 'defense_armor'],
    position: { x: 3, y: 3 },
    branch: TalentBranch.Defense,
  },

  // ==================== UTILITY BRANCH ====================
  {
    id: 'utility_speed_1',
    name: 'Swift Feet',
    description: 'Increases movement speed by 3% per level.',
    icon: 'talent_speed',
    cost: 1,
    maxLevel: 5,
    modifiers: { speedPercent: 0.03 },
    prerequisites: [],
    position: { x: 6, y: 0 },
    branch: TalentBranch.Utility,
  },
  {
    id: 'utility_speed_2',
    name: 'Lightning Speed',
    description: 'Increases movement speed by 5% per level.',
    icon: 'talent_speed_2',
    cost: 2,
    maxLevel: 3,
    modifiers: { speedPercent: 0.05 },
    prerequisites: ['utility_speed_1'],
    position: { x: 6, y: 1 },
    branch: TalentBranch.Utility,
  },
  {
    id: 'utility_pickup',
    name: 'Magnetic Field',
    description: 'Increases pickup radius by 10% per level.',
    icon: 'talent_pickup',
    cost: 1,
    maxLevel: 5,
    modifiers: { pickupRadius: 0.10 },
    prerequisites: ['utility_speed_1'],
    position: { x: 7, y: 1 },
    branch: TalentBranch.Utility,
  },
  {
    id: 'utility_pickup_2',
    name: 'Gravity Well',
    description: 'Increases pickup radius by 15% per level.',
    icon: 'talent_pickup_2',
    cost: 2,
    maxLevel: 3,
    modifiers: { pickupRadius: 0.15 },
    prerequisites: ['utility_pickup'],
    position: { x: 7, y: 2 },
    branch: TalentBranch.Utility,
  },
  {
    id: 'utility_xp',
    name: 'Fast Learner',
    description: 'Increases XP gain by 5% per level.',
    icon: 'talent_xp',
    cost: 1,
    maxLevel: 5,
    modifiers: { xpGain: 0.05 },
    prerequisites: ['utility_speed_1'],
    position: { x: 5, y: 1 },
    branch: TalentBranch.Utility,
  },
  {
    id: 'utility_xp_2',
    name: 'Knowledge Seeker',
    description: 'Increases XP gain by 10% per level.',
    icon: 'talent_xp_2',
    cost: 2,
    maxLevel: 3,
    modifiers: { xpGain: 0.10 },
    prerequisites: ['utility_xp'],
    position: { x: 5, y: 2 },
    branch: TalentBranch.Utility,
  },
  {
    id: 'utility_duration',
    name: 'Extended Effects',
    description: 'Increases effect duration by 10% per level.',
    icon: 'talent_duration',
    cost: 2,
    maxLevel: 3,
    modifiers: { cooldownReduction: 0.05 }, // Proxy for duration
    prerequisites: ['utility_xp_2', 'utility_pickup_2'],
    position: { x: 6, y: 3 },
    branch: TalentBranch.Utility,
  },

  // ==================== SPECIAL BRANCH ====================
  {
    id: 'special_luck',
    name: 'Fortune',
    description: 'Increases luck and rare drop chance.',
    icon: 'talent_luck',
    cost: 2,
    maxLevel: 3,
    modifiers: { xpGain: 0.05 }, // Proxy for luck
    prerequisites: [],
    position: { x: 9, y: 0 },
    branch: TalentBranch.Special,
  },
  {
    id: 'special_starting_weapon_1',
    name: 'Armed & Ready',
    description: 'Start with an additional basic weapon.',
    icon: 'talent_weapon',
    cost: 5,
    maxLevel: 1,
    modifiers: { startingWeapon: 'basic_gun' },
    prerequisites: ['special_luck'],
    position: { x: 9, y: 1 },
    branch: TalentBranch.Special,
  },
  {
    id: 'special_starting_weapon_2',
    name: 'Heavy Ordinance',
    description: 'Start with a powerful explosive weapon.',
    icon: 'talent_weapon_2',
    cost: 8,
    maxLevel: 1,
    modifiers: { startingWeapon: 'explosive_launcher' },
    prerequisites: ['special_starting_weapon_1'],
    position: { x: 9, y: 2 },
    branch: TalentBranch.Special,
  },
  {
    id: 'special_revival',
    name: 'Second Chance',
    description: 'Revive once per run with 50% health.',
    icon: 'talent_revival',
    cost: 10,
    maxLevel: 1,
    modifiers: { revivals: 1 },
    prerequisites: ['special_luck'],
    position: { x: 10, y: 1 },
    branch: TalentBranch.Special,
  },
  {
    id: 'special_revival_2',
    name: 'Phoenix',
    description: 'Revive with full health and temporary invincibility.',
    icon: 'talent_revival_2',
    cost: 15,
    maxLevel: 1,
    modifiers: { revivals: 1 },
    prerequisites: ['special_revival'],
    position: { x: 10, y: 2 },
    branch: TalentBranch.Special,
  },
  {
    id: 'special_luck_2',
    name: "Gambler's Spirit",
    description: 'Greatly increases rare weapon drop chance.',
    icon: 'talent_luck_2',
    cost: 3,
    maxLevel: 2,
    modifiers: { xpGain: 0.10 }, // Proxy for luck
    prerequisites: ['special_luck'],
    position: { x: 8, y: 1 },
    branch: TalentBranch.Special,
  },
];

/**
 * Get talent definitions as a Map for quick lookup.
 */
export function getTalentDefinitionsMap(): Map<string, ITalentNode> {
  const map = new Map<string, ITalentNode>();
  for (const talent of TALENT_DEFINITIONS) {
    map.set(talent.id, talent);
  }
  return map;
}

/**
 * Get talents by branch.
 */
export function getTalentsByBranch(branch: TalentBranch): ITalentNode[] {
  return TALENT_DEFINITIONS.filter(t => t.branch === branch);
}

/**
 * Get total cost to max all talents.
 */
export function getTotalTalentCost(): number {
  return TALENT_DEFINITIONS.reduce(
    (sum, talent) => sum + talent.cost * talent.maxLevel,
    0
  );
}
