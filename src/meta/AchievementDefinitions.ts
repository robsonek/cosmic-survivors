/**
 * AchievementDefinitions - All achievement definitions for Cosmic Survivors.
 *
 * Categories:
 * - Combat: Kill-based achievements
 * - Survival: Wave/time survival achievements
 * - Progression: Level/XP achievements
 * - Weapons: Weapon-related achievements
 * - Multiplayer: Coop/PvP achievements
 */

import {
  IAchievement,
  AchievementRarity,
  AchievementCondition,
} from '@shared/interfaces/IMeta';

/**
 * All achievement definitions.
 */
export const ACHIEVEMENT_DEFINITIONS: IAchievement[] = [
  // ==================== COMBAT ACHIEVEMENTS ====================
  {
    id: 'combat_first_blood',
    name: 'First Blood',
    description: 'Kill your first enemy.',
    icon: 'achievement_first_blood',
    rarity: AchievementRarity.Common,
    hidden: false,
    rewards: { xp: 100 },
    condition: AchievementCondition.KillCount,
    target: 1,
  },
  {
    id: 'combat_slayer_100',
    name: 'Novice Slayer',
    description: 'Kill 100 enemies.',
    icon: 'achievement_slayer_100',
    rarity: AchievementRarity.Common,
    hidden: false,
    rewards: { xp: 250, gold: 100 },
    condition: AchievementCondition.KillCount,
    target: 100,
  },
  {
    id: 'combat_slayer_1000',
    name: 'Slayer',
    description: 'Kill 1,000 enemies.',
    icon: 'achievement_slayer_1000',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 500, gold: 250, talentPoints: 1 },
    condition: AchievementCondition.KillCount,
    target: 1000,
  },
  {
    id: 'combat_slayer_10000',
    name: 'Genocide',
    description: 'Kill 10,000 enemies.',
    icon: 'achievement_genocide',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1000, gold: 500, talentPoints: 2 },
    condition: AchievementCondition.KillCount,
    target: 10000,
  },
  {
    id: 'combat_slayer_100000',
    name: 'Cosmic Executioner',
    description: 'Kill 100,000 enemies.',
    icon: 'achievement_executioner',
    rarity: AchievementRarity.Epic,
    hidden: false,
    rewards: { xp: 5000, gold: 2000, talentPoints: 5 },
    condition: AchievementCondition.KillCount,
    target: 100000,
  },
  {
    id: 'combat_boss_1',
    name: 'Boss Hunter',
    description: 'Defeat your first boss.',
    icon: 'achievement_boss_1',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 500, gold: 200 },
    condition: AchievementCondition.BossKilled,
    target: 1,
  },
  {
    id: 'combat_boss_10',
    name: 'Boss Slayer',
    description: 'Defeat 10 bosses.',
    icon: 'achievement_boss_10',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1500, gold: 750, talentPoints: 2 },
    condition: AchievementCondition.BossKilled,
    target: 10,
  },
  {
    id: 'combat_boss_no_hit',
    name: 'Perfect Execution',
    description: 'Kill a boss without taking any damage.',
    icon: 'achievement_boss_nohit',
    rarity: AchievementRarity.Epic,
    hidden: false,
    rewards: { xp: 2000, gold: 1000, talentPoints: 3, title: 'The Untouchable' },
    condition: AchievementCondition.BossNoHit,
    target: 1,
  },
  {
    id: 'combat_combo_50',
    name: 'Combo Master',
    description: 'Achieve a 50x kill combo.',
    icon: 'achievement_combo_50',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1000, gold: 500, talentPoints: 2 },
    condition: AchievementCondition.ComboCount,
    target: 50,
  },

  // ==================== SURVIVAL ACHIEVEMENTS ====================
  {
    id: 'survival_time_5min',
    name: 'Five Minute Stand',
    description: 'Survive for 5 minutes in a single run.',
    icon: 'achievement_survive_5',
    rarity: AchievementRarity.Common,
    hidden: false,
    rewards: { xp: 150, gold: 50 },
    condition: AchievementCondition.SurviveTime,
    target: 300, // 5 minutes in seconds
  },
  {
    id: 'survival_time_10min',
    name: 'Ten Minute Warrior',
    description: 'Survive for 10 minutes in a single run.',
    icon: 'achievement_survive_10',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 400, gold: 150, talentPoints: 1 },
    condition: AchievementCondition.SurviveTime,
    target: 600, // 10 minutes in seconds
  },
  {
    id: 'survival_time_15min',
    name: 'Quarter Hour Hero',
    description: 'Survive for 15 minutes in a single run.',
    icon: 'achievement_survive_15',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 800, gold: 400, talentPoints: 2 },
    condition: AchievementCondition.SurviveTime,
    target: 900, // 15 minutes in seconds
  },
  {
    id: 'survival_wave_5',
    name: 'Getting Started',
    description: 'Reach wave 5.',
    icon: 'achievement_wave_5',
    rarity: AchievementRarity.Common,
    hidden: false,
    rewards: { xp: 100 },
    condition: AchievementCondition.WaveReached,
    target: 5,
  },
  {
    id: 'survival_wave_10',
    name: 'Survivor',
    description: 'Reach wave 10.',
    icon: 'achievement_wave_10',
    rarity: AchievementRarity.Common,
    hidden: false,
    rewards: { xp: 250, gold: 100 },
    condition: AchievementCondition.WaveReached,
    target: 10,
  },
  {
    id: 'survival_wave_25',
    name: 'Veteran',
    description: 'Reach wave 25.',
    icon: 'achievement_wave_25',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 750, gold: 300, talentPoints: 1 },
    condition: AchievementCondition.WaveReached,
    target: 25,
  },
  {
    id: 'survival_wave_50',
    name: 'Legend',
    description: 'Reach wave 50.',
    icon: 'achievement_wave_50',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 2000, gold: 1000, talentPoints: 3 },
    condition: AchievementCondition.WaveReached,
    target: 50,
  },
  {
    id: 'survival_wave_100',
    name: 'Immortal',
    description: 'Reach wave 100.',
    icon: 'achievement_wave_100',
    rarity: AchievementRarity.Legendary,
    hidden: true,
    rewards: { xp: 10000, gold: 5000, talentPoints: 10, title: 'The Immortal' },
    condition: AchievementCondition.WaveReached,
    target: 100,
  },
  {
    id: 'survival_no_hit',
    name: 'Untouchable',
    description: 'Complete a wave without taking damage.',
    icon: 'achievement_no_hit',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1000, gold: 500, talentPoints: 1 },
    condition: AchievementCondition.NoHitWave,
    target: 1,
  },
  {
    id: 'survival_no_hit_10',
    name: 'Ghost',
    description: 'Complete 10 waves without taking damage.',
    icon: 'achievement_ghost',
    rarity: AchievementRarity.Epic,
    hidden: true,
    rewards: { xp: 5000, gold: 2500, talentPoints: 5, title: 'The Ghost' },
    condition: AchievementCondition.NoHitWave,
    target: 10,
  },

  // ==================== PROGRESSION ACHIEVEMENTS ====================
  {
    id: 'progression_level_10',
    name: 'Double Digits',
    description: 'Reach level 10 in a single run.',
    icon: 'achievement_level_10',
    rarity: AchievementRarity.Common,
    hidden: false,
    rewards: { xp: 200, gold: 75 },
    condition: AchievementCondition.MaxLevel,
    target: 10,
  },
  {
    id: 'progression_level_20',
    name: 'Twenty and Rising',
    description: 'Reach level 20 in a single run.',
    icon: 'achievement_level_20',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 500, gold: 200, talentPoints: 1 },
    condition: AchievementCondition.MaxLevel,
    target: 20,
  },
  {
    id: 'progression_level_25',
    name: 'Experienced',
    description: 'Reach level 25 in a single run.',
    icon: 'achievement_level_25',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 500, gold: 200 },
    condition: AchievementCondition.MaxLevel,
    target: 25,
  },
  {
    id: 'progression_level_50',
    name: 'Max Power',
    description: 'Reach level 50 in a single run.',
    icon: 'achievement_level_50',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1500, gold: 750, talentPoints: 2 },
    condition: AchievementCondition.MaxLevel,
    target: 50,
  },
  {
    id: 'progression_total_xp',
    name: 'XP Hoarder',
    description: 'Collect 100,000 total XP.',
    icon: 'achievement_xp_hoarder',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 1000, gold: 500 },
    condition: AchievementCondition.CollectXP,
    target: 100000,
  },
  {
    id: 'progression_total_playtime',
    name: 'Dedicated',
    description: 'Play for 10 hours total.',
    icon: 'achievement_dedicated',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 2000, gold: 1000, talentPoints: 2 },
    condition: AchievementCondition.TotalPlayTime,
    target: 36000, // 10 hours in seconds
  },

  // ==================== WEAPON ACHIEVEMENTS ====================
  {
    id: 'weapon_first_evolution',
    name: 'Evolution',
    description: 'Evolve a weapon for the first time.',
    icon: 'achievement_evolution',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 500, gold: 250 },
    condition: AchievementCondition.FullEvolutions,
    target: 1,
  },
  {
    id: 'weapon_evolutions_5',
    name: 'Weapon Master',
    description: 'Evolve 5 different weapons.',
    icon: 'achievement_weapon_master',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1500, gold: 750, talentPoints: 2 },
    condition: AchievementCondition.FullEvolutions,
    target: 5,
  },
  {
    id: 'weapon_collector',
    name: 'Collector',
    description: 'Unlock all basic weapons.',
    icon: 'achievement_collector',
    rarity: AchievementRarity.Epic,
    hidden: false,
    rewards: { xp: 3000, gold: 1500, talentPoints: 3 },
    condition: AchievementCondition.WeaponMastery,
    target: 10, // Assuming 10 basic weapons
  },
  {
    id: 'weapon_mastery_single',
    name: 'Specialist',
    description: 'Deal 1,000,000 damage with a single weapon type.',
    icon: 'achievement_specialist',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 2000, gold: 1000, talentPoints: 2 },
    condition: AchievementCondition.WeaponMastery,
    target: 1000000,
  },

  // ==================== MULTIPLAYER ACHIEVEMENTS ====================
  {
    id: 'multiplayer_first_coop',
    name: 'Team Player',
    description: 'Complete a co-op run.',
    icon: 'achievement_team_player',
    rarity: AchievementRarity.Uncommon,
    hidden: false,
    rewards: { xp: 500, gold: 250 },
    condition: AchievementCondition.MultiplayerWin,
    target: 1,
  },
  {
    id: 'multiplayer_mvp',
    name: 'MVP',
    description: 'Get the most kills in a multiplayer game.',
    icon: 'achievement_mvp',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1000, gold: 500, talentPoints: 1, title: 'MVP' },
    condition: AchievementCondition.MultiplayerWin,
    target: 1,
  },
  {
    id: 'multiplayer_coop_10',
    name: 'Social Butterfly',
    description: 'Complete 10 co-op runs.',
    icon: 'achievement_social',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 2000, gold: 1000, talentPoints: 2 },
    condition: AchievementCondition.MultiplayerWin,
    target: 10,
  },
  {
    id: 'multiplayer_revive',
    name: 'Guardian Angel',
    description: 'Revive a teammate 5 times.',
    icon: 'achievement_guardian',
    rarity: AchievementRarity.Rare,
    hidden: false,
    rewards: { xp: 1500, gold: 750, talentPoints: 1, title: 'Guardian' },
    condition: AchievementCondition.MultiplayerWin,
    target: 5,
  },
];

/**
 * Get achievement definitions as a Map for quick lookup.
 */
export function getAchievementDefinitionsMap(): Map<string, IAchievement> {
  const map = new Map<string, IAchievement>();
  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    map.set(achievement.id, { ...achievement });
  }
  return map;
}

/**
 * Get achievements by rarity.
 */
export function getAchievementsByRarity(rarity: AchievementRarity): IAchievement[] {
  return ACHIEVEMENT_DEFINITIONS.filter(a => a.rarity === rarity);
}

/**
 * Get achievements by condition.
 */
export function getAchievementsByCondition(condition: AchievementCondition): IAchievement[] {
  return ACHIEVEMENT_DEFINITIONS.filter(a => a.condition === condition);
}

/**
 * Get hidden achievements.
 */
export function getHiddenAchievements(): IAchievement[] {
  return ACHIEVEMENT_DEFINITIONS.filter(a => a.hidden);
}

/**
 * Get total achievement count.
 */
export function getTotalAchievementCount(): number {
  return ACHIEVEMENT_DEFINITIONS.length;
}
