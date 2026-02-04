/**
 * MusicTracks - Music track definitions and configurations.
 *
 * Central registry of all music tracks used in the game.
 */

/**
 * Music track configuration.
 */
export interface MusicTrackConfig {
  key: string;
  loop: boolean;
  volume: number;
  fadeIn?: number; // Fade in duration (ms)
  bpm?: number; // Beats per minute for sync
  introEnd?: number; // Time where intro ends (seconds)
  loopStart?: number; // Custom loop start point (seconds)
  loopEnd?: number; // Custom loop end point (seconds)
}

/**
 * Available music tracks.
 */
export const MusicTracks = {
  // Menu
  MENU: {
    key: 'music_menu',
    loop: true,
    volume: 0.7,
    fadeIn: 1000,
    bpm: 100,
  },

  // Gameplay
  GAMEPLAY: {
    key: 'music_gameplay',
    loop: true,
    volume: 0.5,
    fadeIn: 500,
    bpm: 120,
  },

  // Alternative gameplay tracks for variety
  GAMEPLAY_INTENSE: {
    key: 'music_gameplay_intense',
    loop: true,
    volume: 0.55,
    fadeIn: 500,
    bpm: 140,
  },

  // Boss encounters
  BOSS: {
    key: 'music_boss',
    loop: true,
    volume: 0.6,
    fadeIn: 300,
    bpm: 150,
    // Boss music often has an intro
    introEnd: 4.0,
    loopStart: 4.0,
  },

  // Victory (non-looping fanfare)
  VICTORY: {
    key: 'music_victory',
    loop: false,
    volume: 0.8,
    fadeIn: 0,
  },

  // Game over
  GAMEOVER: {
    key: 'music_gameover',
    loop: false,
    volume: 0.6,
    fadeIn: 500,
  },

  // Upgrade/Level up screen
  UPGRADE: {
    key: 'music_upgrade',
    loop: true,
    volume: 0.4,
    fadeIn: 200,
    bpm: 80,
  },

  // Ambient/Quiet moments
  AMBIENT: {
    key: 'music_ambient',
    loop: true,
    volume: 0.3,
    fadeIn: 2000,
    bpm: 60,
  },
} as const;

/** Type for music track keys */
export type MusicTrackKey = keyof typeof MusicTracks;

/** Type for music track config */
export type MusicTrackConfigType = (typeof MusicTracks)[MusicTrackKey];

/**
 * Get music track configuration.
 */
export function getMusicTrack(trackKey: MusicTrackKey): MusicTrackConfig {
  return MusicTracks[trackKey];
}

/**
 * Get all music track keys for preloading.
 */
export function getAllMusicKeys(): string[] {
  return Object.values(MusicTracks).map((track) => track.key);
}

/**
 * Game state to music mapping.
 */
export const GameStateMusic: Record<string, MusicTrackKey> = {
  menu: 'MENU',
  gameplay: 'GAMEPLAY',
  boss: 'BOSS',
  victory: 'VICTORY',
  gameover: 'GAMEOVER',
  paused: 'GAMEPLAY', // Continue gameplay music when paused
  upgrade: 'UPGRADE',
};

/**
 * Get appropriate music for game state.
 */
export function getMusicForGameState(state: string): MusicTrackConfig | null {
  const trackKey = GameStateMusic[state];
  if (!trackKey) return null;
  return getMusicTrack(trackKey);
}
