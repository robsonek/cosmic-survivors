/**
 * UI Constants for Cosmic Survivors.
 * Contains colors, fonts, and depth values for UI elements.
 */

// ============================================
// Colors
// ============================================

export const UIColors = {
  // Primary colors
  PRIMARY: 0x4a90d9,
  PRIMARY_DARK: 0x3a70b9,
  PRIMARY_LIGHT: 0x6ab0f9,

  // Accent colors
  ACCENT: 0xf5a623,
  ACCENT_DARK: 0xd58603,
  SUCCESS: 0x7ed321,
  WARNING: 0xf5a623,
  ERROR: 0xd0021b,
  CRITICAL: 0xff4444,

  // Text colors
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xcccccc,
  TEXT_DISABLED: 0x888888,
  TEXT_ACCENT: 0xf5a623,
  TEXT_DAMAGE: 0xff4444,
  TEXT_HEAL: 0x7ed321,
  TEXT_CRITICAL: 0xffff00,
  TEXT_XP: 0x66ccff,

  // Background colors
  PANEL_BG: 0x1a1a2e,
  PANEL_HEADER: 0x2a2a4e,
  OVERLAY_BG: 0x000000,
  TOOLTIP_BG: 0x16213e,

  // Button colors
  BUTTON_NORMAL: 0x2a2a4e,
  BUTTON_HOVER: 0x3a3a6e,
  BUTTON_PRESSED: 0x1a1a3e,
  BUTTON_DISABLED: 0x1a1a2e,

  // Progress bar colors
  PROGRESS_BG: 0x1a1a2e,
  PROGRESS_FILL: 0x4a90d9,
  HEALTH_FILL: 0xd0021b,
  HEALTH_LOW: 0xff4444,
  XP_FILL: 0x66ccff,
  SHIELD_FILL: 0x00ffff,
  COOLDOWN_FILL: 0x888888,

  // Border colors
  BORDER: 0x4a4a6e,
  BORDER_LIGHT: 0x6a6a8e,
  BORDER_ACCENT: 0xf5a623,

  // Rarity colors
  RARITY_COMMON: 0xcccccc,
  RARITY_UNCOMMON: 0x7ed321,
  RARITY_RARE: 0x4a90d9,
  RARITY_EPIC: 0x9b59b6,
  RARITY_LEGENDARY: 0xf5a623,
} as const;

// ============================================
// Fonts
// ============================================

export const UIFonts = {
  PRIMARY: 'Arial, Helvetica, sans-serif',
  MONO: 'Courier New, Courier, monospace',
  TITLE: 'Impact, Arial Black, sans-serif',
} as const;

// ============================================
// Z-Depth for UI layers
// ============================================

export const UIDepth = {
  BACKGROUND: 1000,
  HUD: 1010,
  BUTTONS: 1020,
  PANELS: 1030,
  SCREENS: 1040,
  MODALS: 1050,
  TOOLTIP: 1060,
  NOTIFICATIONS: 1070,
  DAMAGE_NUMBERS: 1080,
  OVERLAY: 1090,
} as const;

// ============================================
// Animation durations (ms)
// ============================================

export const UIAnimations = {
  FAST: 100,
  NORMAL: 200,
  SLOW: 400,
  SCREEN_TRANSITION: 300,
  DAMAGE_NUMBER: 800,
  NOTIFICATION: 3000,
} as const;

// ============================================
// Size constants
// ============================================

export const UISizes = {
  // HUD
  HEALTH_BAR_WIDTH: 250,
  HEALTH_BAR_HEIGHT: 24,
  XP_BAR_WIDTH: 400,
  XP_BAR_HEIGHT: 16,
  WEAPON_SLOT_SIZE: 56,
  WEAPON_SLOT_GAP: 8,

  // Screens
  UPGRADE_CARD_WIDTH: 280,
  UPGRADE_CARD_HEIGHT: 380,
  UPGRADE_CARD_GAP: 24,

  // Buttons
  BUTTON_HEIGHT: 48,
  BUTTON_PADDING: 24,

  // Panels
  PANEL_PADDING: 16,
  PANEL_BORDER_RADIUS: 12,

  // Text
  TITLE_FONT_SIZE: 48,
  HEADING_FONT_SIZE: 32,
  BODY_FONT_SIZE: 18,
  SMALL_FONT_SIZE: 14,
} as const;

// ============================================
// Rarity color mapping
// ============================================

import { WeaponRarity } from '@shared/interfaces/IWeapon';

export function getRarityColor(rarity: WeaponRarity): number {
  switch (rarity) {
    case WeaponRarity.Common:
      return UIColors.RARITY_COMMON;
    case WeaponRarity.Uncommon:
      return UIColors.RARITY_UNCOMMON;
    case WeaponRarity.Rare:
      return UIColors.RARITY_RARE;
    case WeaponRarity.Epic:
      return UIColors.RARITY_EPIC;
    case WeaponRarity.Legendary:
      return UIColors.RARITY_LEGENDARY;
    default:
      return UIColors.RARITY_COMMON;
  }
}

export function getRarityName(rarity: WeaponRarity): string {
  switch (rarity) {
    case WeaponRarity.Common:
      return 'Common';
    case WeaponRarity.Uncommon:
      return 'Uncommon';
    case WeaponRarity.Rare:
      return 'Rare';
    case WeaponRarity.Epic:
      return 'Epic';
    case WeaponRarity.Legendary:
      return 'Legendary';
    default:
      return 'Unknown';
  }
}
