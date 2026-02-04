/**
 * SaveSystem - Handles game save/load with local storage and optional cloud sync.
 *
 * Features:
 * - LocalStorage persistence
 * - Save versioning for migration
 * - Export/import for backup
 * - Optional cloud sync with Nakama
 * - Auto-save functionality
 * - Corruption recovery
 */

import type {
  ISaveSystem,
  ISaveData,
  IPlayerProgression,
  IGameSettings,
} from '@shared/interfaces/IMeta';
import { EventBus } from '@core/EventBus';

/** Current save data version */
const SAVE_VERSION = 1;

/** LocalStorage key for save data */
const SAVE_KEY = 'cosmic_survivors_save';

/** LocalStorage key for backup */
const BACKUP_KEY = 'cosmic_survivors_backup';

/** Auto-save interval in milliseconds */
const AUTO_SAVE_INTERVAL = 60000; // 1 minute

/**
 * Event for save system operations.
 */
export interface SaveEvent {
  type: 'save' | 'load' | 'error' | 'cloudSync';
  success: boolean;
  message?: string;
}

/**
 * Default game settings.
 */
export function getDefaultSettings(): IGameSettings {
  return {
    masterVolume: 1.0,
    musicVolume: 0.7,
    sfxVolume: 1.0,
    screenShake: true,
    damageNumbers: true,
    showFPS: false,
    language: 'en',
    controls: {
      moveUp: 'KeyW',
      moveDown: 'KeyS',
      moveLeft: 'KeyA',
      moveRight: 'KeyD',
      pause: 'Escape',
      interact: 'KeyE',
    },
  };
}

/**
 * Default player progression.
 */
export function getDefaultProgression(): IPlayerProgression {
  return {
    totalXP: 0,
    talentPoints: 0,
    unlockedTalents: [],
    unlockedWeapons: ['basic_gun'],
    unlockedCharacters: ['survivor'],
    achievements: [],
    highestWave: 0,
    totalKills: 0,
    totalPlayTime: 0,
    runsCompleted: 0,
    totalDeaths: 0,
    weaponStats: {},
    lifetimeGold: 0,
    currentGold: 0,
  };
}

/**
 * Create default save data.
 */
export function createDefaultSaveData(): ISaveData {
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    progression: getDefaultProgression(),
    settings: getDefaultSettings(),
  };
}

/**
 * SaveSystem implementation for Cosmic Survivors.
 */
export class SaveSystem implements ISaveSystem {
  /** Current save data in memory */
  private currentData: ISaveData | null = null;

  /** Auto-save timer ID */
  private autoSaveTimer: number | null = null;

  /** Cloud save timestamp (if available) */
  private cloudTimestamp: number = 0;

  /** EventBus for notifications */
  private eventBus: EventBus | null;

  /** Nakama client reference (optional) */
  private nakamaClient: unknown = null;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? null;
  }

  /**
   * Save game data to localStorage.
   * @param data Save data
   */
  async saveLocal(data: ISaveData): Promise<void> {
    try {
      // Update timestamp and version
      const saveData: ISaveData = {
        ...data,
        version: SAVE_VERSION,
        timestamp: Date.now(),
      };

      // Create backup of existing save
      const existingSave = localStorage.getItem(SAVE_KEY);
      if (existingSave) {
        localStorage.setItem(BACKUP_KEY, existingSave);
      }

      // Save new data
      const serialized = JSON.stringify(saveData);
      localStorage.setItem(SAVE_KEY, serialized);

      this.currentData = saveData;
      this.emitEvent('save', true);
    } catch (error) {
      console.error('Failed to save game:', error);
      this.emitEvent('save', false, 'Failed to save game data');
      throw error;
    }
  }

  /**
   * Load save data from localStorage.
   * @returns Save data or null if not found
   */
  async loadLocal(): Promise<ISaveData | null> {
    try {
      const serialized = localStorage.getItem(SAVE_KEY);

      if (!serialized) {
        // No save found, return null
        return null;
      }

      let data: ISaveData;

      try {
        data = JSON.parse(serialized);
      } catch {
        // Corrupted save, try backup
        console.warn('Main save corrupted, trying backup...');
        return this.loadBackup();
      }

      // Validate save data structure
      if (!this.validateSaveData(data)) {
        console.warn('Save data validation failed, trying backup...');
        return this.loadBackup();
      }

      // Migrate if needed
      if (data.version !== SAVE_VERSION) {
        data = this.migrateSaveData(data);
      }

      this.currentData = data;
      this.emitEvent('load', true);

      return data;
    } catch (error) {
      console.error('Failed to load game:', error);
      this.emitEvent('load', false, 'Failed to load game data');
      return null;
    }
  }

  /**
   * Sync with cloud storage (Nakama).
   */
  async syncCloud(): Promise<void> {
    if (!this.nakamaClient) {
      // Cloud sync not available
      return;
    }

    try {
      // This would integrate with Nakama storage API
      // For now, we'll just emit an event
      this.emitEvent('cloudSync', true, 'Cloud sync not implemented');
    } catch (error) {
      console.error('Cloud sync failed:', error);
      this.emitEvent('cloudSync', false, 'Cloud sync failed');
    }
  }

  /**
   * Check if cloud save is newer than local.
   * @returns True if cloud save is newer
   */
  async hasNewerCloudSave(): Promise<boolean> {
    if (!this.nakamaClient) {
      return false;
    }

    // Compare timestamps
    const localTimestamp = this.currentData?.timestamp ?? 0;
    return this.cloudTimestamp > localTimestamp;
  }

  /**
   * Export save data as string for backup.
   * @returns Base64 encoded save data
   */
  export(): string {
    const data = this.currentData ?? createDefaultSaveData();

    try {
      const json = JSON.stringify(data);
      // Use base64 encoding for export
      return btoa(encodeURIComponent(json));
    } catch (error) {
      console.error('Failed to export save:', error);
      throw new Error('Failed to export save data');
    }
  }

  /**
   * Import save data from string.
   * @param exportedData Base64 encoded save data
   */
  async import(exportedData: string): Promise<void> {
    try {
      // Decode base64
      const json = decodeURIComponent(atob(exportedData));
      const data: ISaveData = JSON.parse(json);

      // Validate imported data
      if (!this.validateSaveData(data)) {
        throw new Error('Invalid save data format');
      }

      // Migrate if needed
      const migratedData = data.version !== SAVE_VERSION
        ? this.migrateSaveData(data)
        : data;

      // Save imported data
      await this.saveLocal(migratedData);

      this.emitEvent('load', true, 'Save data imported successfully');
    } catch (error) {
      console.error('Failed to import save:', error);
      this.emitEvent('load', false, 'Failed to import save data');
      throw error;
    }
  }

  /**
   * Delete all save data.
   */
  async delete(): Promise<void> {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(BACKUP_KEY);
      this.currentData = null;

      // Stop auto-save
      this.stopAutoSave();

      this.emitEvent('save', true, 'Save data deleted');
    } catch (error) {
      console.error('Failed to delete save:', error);
      throw error;
    }
  }

  /**
   * Get current save data in memory.
   */
  getCurrentData(): ISaveData | null {
    return this.currentData;
  }

  /**
   * Set current save data in memory (for updates without immediate save).
   */
  setCurrentData(data: ISaveData): void {
    this.currentData = data;
  }

  /**
   * Start auto-save timer.
   * @param interval Interval in milliseconds (default: 1 minute)
   */
  startAutoSave(interval: number = AUTO_SAVE_INTERVAL): void {
    this.stopAutoSave();

    this.autoSaveTimer = window.setInterval(() => {
      if (this.currentData) {
        this.saveLocal(this.currentData).catch(err => {
          console.error('Auto-save failed:', err);
        });
      }
    }, interval);
  }

  /**
   * Stop auto-save timer.
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      window.clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Check if auto-save is running.
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSaveTimer !== null;
  }

  /**
   * Check if a save exists.
   */
  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  /**
   * Get save timestamp.
   */
  getSaveTimestamp(): number | null {
    return this.currentData?.timestamp ?? null;
  }

  /**
   * Set Nakama client for cloud sync.
   */
  setNakamaClient(client: unknown): void {
    this.nakamaClient = client;
  }

  /**
   * Set EventBus reference.
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Load backup save data.
   */
  private loadBackup(): ISaveData | null {
    const backup = localStorage.getItem(BACKUP_KEY);

    if (!backup) {
      console.warn('No backup available, returning default save');
      return createDefaultSaveData();
    }

    try {
      const data: ISaveData = JSON.parse(backup);

      if (this.validateSaveData(data)) {
        console.log('Backup loaded successfully');
        this.currentData = data;
        return data;
      }
    } catch {
      console.error('Backup also corrupted');
    }

    // Both corrupted, return default
    console.warn('All saves corrupted, returning default');
    return createDefaultSaveData();
  }

  /**
   * Validate save data structure.
   */
  private validateSaveData(data: unknown): data is ISaveData {
    if (!data || typeof data !== 'object') return false;

    const save = data as Record<string, unknown>;

    // Check required fields
    if (typeof save.version !== 'number') return false;
    if (typeof save.timestamp !== 'number') return false;
    if (!save.progression || typeof save.progression !== 'object') return false;
    if (!save.settings || typeof save.settings !== 'object') return false;

    return true;
  }

  /**
   * Migrate save data from older versions.
   */
  private migrateSaveData(data: ISaveData): ISaveData {
    let migrated = { ...data };

    // Version 0 -> 1 migration (example)
    if (migrated.version < 1) {
      // Add any missing fields
      migrated = {
        ...migrated,
        version: 1,
        progression: {
          ...getDefaultProgression(),
          ...migrated.progression,
        },
        settings: {
          ...getDefaultSettings(),
          ...migrated.settings,
        },
      };
    }

    // Add future migrations here...
    // if (migrated.version < 2) { ... }

    migrated.version = SAVE_VERSION;
    return migrated;
  }

  /**
   * Emit save system event.
   */
  private emitEvent(type: SaveEvent['type'], success: boolean, message?: string): void {
    if (this.eventBus) {
      this.eventBus.emit<SaveEvent>('save:event', { type, success, message });
    }
  }
}
