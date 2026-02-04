/**
 * Audio Module - Central audio system for Cosmic Survivors.
 *
 * Provides:
 * - AudioManager: Central audio management
 * - SFXPlayer: Sound effects playback with pooling and spatial audio
 * - MusicPlayer: Music playback with crossfading and BPM sync
 * - SoundPool: Object pooling for frequently played sounds
 * - AudioEventHandler: Automatic sound playback based on game events
 * - SFXDefinitions: Sound effect key definitions
 * - MusicTracks: Music track definitions
 */

// Core audio management
export {
  AudioManager,
  getAudioManager,
  resetAudioManager,
  type AudioManagerConfig,
} from './AudioManager';

// SFX playback
export { SFXPlayer, type SFXPlayerConfig } from './SFXPlayer';

// Music playback
export { MusicPlayer, type MusicPlayerConfig, type BeatCallback } from './MusicPlayer';

// Sound pooling
export {
  SoundPool,
  SoundPoolManager,
  type SoundPoolConfig,
} from './SoundPool';

// Event-based audio
export {
  AudioEventHandler,
  createAudioEventHandler,
  type AudioEventHandlerConfig,
} from './AudioEventHandler';

// SFX definitions
export {
  SFXKeys,
  SFXConfigs,
  getSFXConfig,
  getWeaponSFX,
  WeaponSFXMap,
  type SFXKey,
  type SFXConfig,
} from './SFXDefinitions';

// Music definitions
export {
  MusicTracks,
  getMusicTrack,
  getAllMusicKeys,
  getMusicForGameState,
  GameStateMusic,
  type MusicTrackConfig,
  type MusicTrackKey,
} from './MusicTracks';

// Re-export shared audio interfaces
export type {
  AudioChannel,
  ISoundConfig,
  ISoundInstance,
  IMusicConfig,
  IAudioManager,
  ISoundPool,
} from '@shared/interfaces/IAudio';
