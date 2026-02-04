/**
 * SettingsManager - Manages game settings with localStorage persistence.
 *
 * Features:
 * - Volume controls (master, music, SFX)
 * - Visual settings (screen shake, damage numbers, FPS)
 * - Control key bindings
 * - Language selection
 * - Auto-persist on change
 */

import type { IGameSettings, IControlSettings } from '@shared/interfaces/IMeta';
import { EventBus } from '@core/EventBus';

/** LocalStorage key for settings */
const SETTINGS_KEY = 'cosmic_survivors_settings';

/**
 * Event for settings changes.
 */
export interface SettingsChangedEvent {
  setting: string;
  value: unknown;
  previousValue: unknown;
}

/**
 * Default control settings.
 */
export function getDefaultControls(): IControlSettings {
  return {
    moveUp: 'KeyW',
    moveDown: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    pause: 'Escape',
    interact: 'KeyE',
  };
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
    controls: getDefaultControls(),
  };
}

/**
 * Supported languages.
 */
export const SUPPORTED_LANGUAGES = ['en', 'pl', 'de', 'fr', 'es', 'pt', 'ru', 'zh', 'ja', 'ko'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * SettingsManager implementation for Cosmic Survivors.
 */
export class SettingsManager {
  /** Current settings */
  private settings: IGameSettings;

  /** EventBus for notifications */
  private eventBus: EventBus | null;

  /** Auto-save enabled */
  private autoSave: boolean = true;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? null;
    this.settings = getDefaultSettings();
  }

  /**
   * Get all settings (read-only copy).
   */
  getSettings(): Readonly<IGameSettings> {
    return { ...this.settings };
  }

  // ==================== VOLUME SETTINGS ====================

  /**
   * Get master volume (0-1).
   */
  get masterVolume(): number {
    return this.settings.masterVolume;
  }

  /**
   * Set master volume.
   * @param value Volume (0-1)
   */
  setMasterVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.setSetting('masterVolume', clamped);
  }

  /**
   * Get music volume (0-1).
   */
  get musicVolume(): number {
    return this.settings.musicVolume;
  }

  /**
   * Set music volume.
   * @param value Volume (0-1)
   */
  setMusicVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.setSetting('musicVolume', clamped);
  }

  /**
   * Get SFX volume (0-1).
   */
  get sfxVolume(): number {
    return this.settings.sfxVolume;
  }

  /**
   * Set SFX volume.
   * @param value Volume (0-1)
   */
  setSfxVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.setSetting('sfxVolume', clamped);
  }

  /**
   * Get effective music volume (music * master).
   */
  getEffectiveMusicVolume(): number {
    return this.settings.musicVolume * this.settings.masterVolume;
  }

  /**
   * Get effective SFX volume (sfx * master).
   */
  getEffectiveSfxVolume(): number {
    return this.settings.sfxVolume * this.settings.masterVolume;
  }

  /**
   * Mute all audio.
   */
  mute(): void {
    this.setSetting('masterVolume', 0);
  }

  /**
   * Check if audio is muted.
   */
  isMuted(): boolean {
    return this.settings.masterVolume === 0;
  }

  // ==================== VISUAL SETTINGS ====================

  /**
   * Get screen shake enabled.
   */
  get screenShake(): boolean {
    return this.settings.screenShake;
  }

  /**
   * Set screen shake enabled.
   */
  setScreenShake(enabled: boolean): void {
    this.setSetting('screenShake', enabled);
  }

  /**
   * Toggle screen shake.
   */
  toggleScreenShake(): boolean {
    const newValue = !this.settings.screenShake;
    this.setScreenShake(newValue);
    return newValue;
  }

  /**
   * Get damage numbers enabled.
   */
  get damageNumbers(): boolean {
    return this.settings.damageNumbers;
  }

  /**
   * Set damage numbers enabled.
   */
  setDamageNumbers(enabled: boolean): void {
    this.setSetting('damageNumbers', enabled);
  }

  /**
   * Toggle damage numbers.
   */
  toggleDamageNumbers(): boolean {
    const newValue = !this.settings.damageNumbers;
    this.setDamageNumbers(newValue);
    return newValue;
  }

  /**
   * Get FPS display enabled.
   */
  get showFPS(): boolean {
    return this.settings.showFPS;
  }

  /**
   * Set FPS display enabled.
   */
  setShowFPS(enabled: boolean): void {
    this.setSetting('showFPS', enabled);
  }

  /**
   * Toggle FPS display.
   */
  toggleShowFPS(): boolean {
    const newValue = !this.settings.showFPS;
    this.setShowFPS(newValue);
    return newValue;
  }

  // ==================== LANGUAGE SETTINGS ====================

  /**
   * Get current language.
   */
  get language(): string {
    return this.settings.language;
  }

  /**
   * Set language.
   * @param lang Language code (e.g., 'en', 'pl')
   */
  setLanguage(lang: string): void {
    if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
      this.setSetting('language', lang);
    } else {
      console.warn(`Unsupported language: ${lang}, defaulting to 'en'`);
      this.setSetting('language', 'en');
    }
  }

  /**
   * Get supported languages.
   */
  getSupportedLanguages(): readonly string[] {
    return SUPPORTED_LANGUAGES;
  }

  // ==================== CONTROL SETTINGS ====================

  /**
   * Get all control bindings.
   */
  getControls(): Readonly<IControlSettings> {
    return { ...this.settings.controls };
  }

  /**
   * Get binding for a specific control.
   * @param action Control action name
   */
  getBinding(action: keyof IControlSettings): string {
    return this.settings.controls[action];
  }

  /**
   * Set binding for a control.
   * @param action Control action name
   * @param key Key code (e.g., 'KeyW', 'ArrowUp')
   */
  setBinding(action: keyof IControlSettings, key: string): void {
    const previousValue = this.settings.controls[action];

    // Check for duplicate bindings
    for (const [existingAction, existingKey] of Object.entries(this.settings.controls)) {
      if (existingAction !== action && existingKey === key) {
        console.warn(`Key ${key} already bound to ${existingAction}`);
        // Swap bindings
        this.settings.controls[existingAction as keyof IControlSettings] = previousValue;
      }
    }

    this.settings.controls[action] = key;

    this.emitChange(`controls.${action}`, key, previousValue);

    if (this.autoSave) {
      this.save();
    }
  }

  /**
   * Reset controls to default.
   */
  resetControls(): void {
    this.settings.controls = getDefaultControls();

    this.emitChange('controls', this.settings.controls, null);

    if (this.autoSave) {
      this.save();
    }
  }

  /**
   * Get all bindings as a map of key -> action.
   */
  getKeyToActionMap(): Map<string, keyof IControlSettings> {
    const map = new Map<string, keyof IControlSettings>();
    for (const [action, key] of Object.entries(this.settings.controls)) {
      map.set(key, action as keyof IControlSettings);
    }
    return map;
  }

  // ==================== PERSISTENCE ====================

  /**
   * Save settings to localStorage.
   */
  save(): void {
    try {
      const serialized = JSON.stringify(this.settings);
      localStorage.setItem(SETTINGS_KEY, serialized);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Load settings from localStorage.
   */
  load(): void {
    try {
      const serialized = localStorage.getItem(SETTINGS_KEY);

      if (!serialized) {
        this.settings = getDefaultSettings();
        return;
      }

      const loaded = JSON.parse(serialized);

      // Merge with defaults to handle missing fields
      this.settings = {
        ...getDefaultSettings(),
        ...loaded,
        controls: {
          ...getDefaultControls(),
          ...(loaded.controls || {}),
        },
      };

      // Validate values
      this.validateSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = getDefaultSettings();
    }
  }

  /**
   * Reset all settings to default.
   */
  reset(): void {
    this.settings = getDefaultSettings();

    if (this.autoSave) {
      this.save();
    }

    this.emitChange('all', this.settings, null);
  }

  /**
   * Import settings from object.
   * @param settings Settings object
   */
  importSettings(settings: Partial<IGameSettings>): void {
    this.settings = {
      ...getDefaultSettings(),
      ...settings,
      controls: {
        ...getDefaultControls(),
        ...(settings.controls || {}),
      },
    };

    this.validateSettings();

    if (this.autoSave) {
      this.save();
    }
  }

  /**
   * Export settings object.
   */
  exportSettings(): IGameSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  /**
   * Set auto-save enabled.
   */
  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled;
  }

  /**
   * Check if auto-save is enabled.
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSave;
  }

  /**
   * Set EventBus reference.
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Set a setting and handle persistence/events.
   */
  private setSetting<K extends keyof IGameSettings>(
    key: K,
    value: IGameSettings[K]
  ): void {
    const previousValue = this.settings[key];

    if (previousValue === value) {
      return; // No change
    }

    this.settings[key] = value;
    this.emitChange(key, value, previousValue);

    if (this.autoSave) {
      this.save();
    }
  }

  /**
   * Emit settings change event.
   */
  private emitChange(setting: string, value: unknown, previousValue: unknown): void {
    if (this.eventBus) {
      this.eventBus.emit<SettingsChangedEvent>('settings:changed', {
        setting,
        value,
        previousValue,
      });
    }
  }

  /**
   * Validate settings values.
   */
  private validateSettings(): void {
    // Clamp volumes
    this.settings.masterVolume = Math.max(0, Math.min(1, this.settings.masterVolume));
    this.settings.musicVolume = Math.max(0, Math.min(1, this.settings.musicVolume));
    this.settings.sfxVolume = Math.max(0, Math.min(1, this.settings.sfxVolume));

    // Validate language
    if (!SUPPORTED_LANGUAGES.includes(this.settings.language as SupportedLanguage)) {
      this.settings.language = 'en';
    }

    // Ensure booleans
    this.settings.screenShake = Boolean(this.settings.screenShake);
    this.settings.damageNumbers = Boolean(this.settings.damageNumbers);
    this.settings.showFPS = Boolean(this.settings.showFPS);
  }
}
