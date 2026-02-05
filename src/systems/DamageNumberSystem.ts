/**
 * DamageNumberSystem - Enhanced floating damage number system.
 * Features:
 * - Numbers float up and fade out with easing
 * - Size based on damage amount
 * - Color coding: white=normal, yellow=crit, red=player damage, green=heal
 * - Combines nearby damage into single bigger numbers
 * - Comic-style text for special hits (POW!, CRIT!, OVERKILL!)
 * - Numbers spread to avoid overlap
 * - Smooth animation with multiple easing functions
 */

import * as Phaser from 'phaser';

/**
 * Damage number types for color coding and styling
 */
export enum DamageNumberType {
  Normal = 'normal',           // White - regular enemy damage
  Critical = 'critical',       // Yellow - critical hits
  PlayerDamage = 'playerDamage', // Red - player taking damage
  Heal = 'heal',               // Green - healing
  Shield = 'shield',           // Cyan - shield effects
  XP = 'xp',                   // Gold - XP gains
  Overkill = 'overkill',       // Purple - overkill damage
  ComboHit = 'combo',          // Orange - combo damage
}

/**
 * Special text types for comic-style effects
 */
export enum SpecialTextType {
  None = 'none',
  Pow = 'pow',
  Crit = 'crit',
  Overkill = 'overkill',
  Combo = 'combo',
  Miss = 'miss',
  Blocked = 'blocked',
  Immune = 'immune',
}

/**
 * Configuration for showing damage numbers
 */
export interface DamageNumberConfig {
  /** Damage/heal value to display */
  value: number;
  /** World X position */
  x: number;
  /** World Y position */
  y: number;
  /** Type of damage for styling */
  type?: DamageNumberType;
  /** Whether this was a critical hit */
  isCritical?: boolean;
  /** Whether this was overkill damage */
  isOverkill?: boolean;
  /** Combo count for combo display */
  comboCount?: number;
  /** Custom text override */
  customText?: string;
  /** Custom color override */
  customColor?: number;
  /** Scale multiplier */
  scale?: number;
  /** Source entity for combining nearby damage */
  sourceEntity?: number;
  /** Target entity for combining nearby damage */
  targetEntity?: number;
}

/**
 * Style configuration for each damage type
 */
interface DamageStyle {
  color: number;
  strokeColor: number;
  strokeWidth: number;
  baseFontSize: number;
  fontStyle: string;
  baseScale: number;
  duration: number;
  floatDistance: number;
  fadeStartRatio: number;
  bounceScale: number;      // Initial pop/bounce scale
  shake: boolean;           // Whether to apply shake
}

/**
 * Internal damage number instance
 */
interface DamageNumber {
  text: Phaser.GameObjects.Text;
  specialText: Phaser.GameObjects.Text | null;
  x: number;
  y: number;
  startX: number;
  startY: number;
  elapsed: number;
  duration: number;
  floatDistance: number;
  fadeStartRatio: number;
  baseScale: number;
  bounceScale: number;
  style: DamageStyle;
  offsetX: number;          // Horizontal offset for spreading
  active: boolean;
  targetEntity: number;     // For combining
  value: number;            // For combining
  lastCombineTime: number;  // For combining
}

/**
 * Style presets for damage types
 */
const DAMAGE_STYLES: Record<DamageNumberType, DamageStyle> = {
  [DamageNumberType.Normal]: {
    color: 0xffffff,
    strokeColor: 0x000000,
    strokeWidth: 4,
    baseFontSize: 20,
    fontStyle: 'bold',
    baseScale: 1,
    duration: 1000,
    floatDistance: 60,
    fadeStartRatio: 0.5,
    bounceScale: 1.3,
    shake: false,
  },
  [DamageNumberType.Critical]: {
    color: 0xffff00,
    strokeColor: 0xff6600,
    strokeWidth: 5,
    baseFontSize: 28,
    fontStyle: 'bold',
    baseScale: 1.3,
    duration: 1200,
    floatDistance: 80,
    fadeStartRatio: 0.4,
    bounceScale: 1.6,
    shake: true,
  },
  [DamageNumberType.PlayerDamage]: {
    color: 0xff4444,
    strokeColor: 0x660000,
    strokeWidth: 4,
    baseFontSize: 24,
    fontStyle: 'bold',
    baseScale: 1.1,
    duration: 1000,
    floatDistance: 50,
    fadeStartRatio: 0.5,
    bounceScale: 1.4,
    shake: true,
  },
  [DamageNumberType.Heal]: {
    color: 0x44ff44,
    strokeColor: 0x006600,
    strokeWidth: 4,
    baseFontSize: 22,
    fontStyle: 'bold',
    baseScale: 1,
    duration: 1100,
    floatDistance: 70,
    fadeStartRatio: 0.5,
    bounceScale: 1.3,
    shake: false,
  },
  [DamageNumberType.Shield]: {
    color: 0x44ddff,
    strokeColor: 0x004466,
    strokeWidth: 3,
    baseFontSize: 18,
    fontStyle: 'bold',
    baseScale: 0.9,
    duration: 900,
    floatDistance: 50,
    fadeStartRatio: 0.5,
    bounceScale: 1.2,
    shake: false,
  },
  [DamageNumberType.XP]: {
    color: 0xffd700,
    strokeColor: 0x886600,
    strokeWidth: 3,
    baseFontSize: 16,
    fontStyle: 'normal',
    baseScale: 0.9,
    duration: 1300,
    floatDistance: 55,
    fadeStartRatio: 0.6,
    bounceScale: 1.2,
    shake: false,
  },
  [DamageNumberType.Overkill]: {
    color: 0xff00ff,
    strokeColor: 0x660066,
    strokeWidth: 5,
    baseFontSize: 32,
    fontStyle: 'bold',
    baseScale: 1.4,
    duration: 1400,
    floatDistance: 90,
    fadeStartRatio: 0.35,
    bounceScale: 1.8,
    shake: true,
  },
  [DamageNumberType.ComboHit]: {
    color: 0xff8800,
    strokeColor: 0x663300,
    strokeWidth: 4,
    baseFontSize: 26,
    fontStyle: 'bold',
    baseScale: 1.2,
    duration: 1100,
    floatDistance: 75,
    fadeStartRatio: 0.45,
    bounceScale: 1.5,
    shake: true,
  },
};

/**
 * Special text configurations
 */
const SPECIAL_TEXTS: Record<SpecialTextType, { text: string; color: number; scale: number }> = {
  [SpecialTextType.None]: { text: '', color: 0xffffff, scale: 1 },
  [SpecialTextType.Pow]: { text: 'POW!', color: 0xff6600, scale: 1.2 },
  [SpecialTextType.Crit]: { text: 'CRIT!', color: 0xffff00, scale: 1.3 },
  [SpecialTextType.Overkill]: { text: 'OVERKILL!', color: 0xff00ff, scale: 1.5 },
  [SpecialTextType.Combo]: { text: 'COMBO!', color: 0xff8800, scale: 1.2 },
  [SpecialTextType.Miss]: { text: 'MISS', color: 0xaaaaaa, scale: 0.9 },
  [SpecialTextType.Blocked]: { text: 'BLOCKED', color: 0x666666, scale: 0.9 },
  [SpecialTextType.Immune]: { text: 'IMMUNE', color: 0x8888ff, scale: 1.0 },
};

/**
 * Enhanced damage number system with pooling, combining, and special effects
 */
export class DamageNumberSystem {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  // Object pools
  private textPool: Phaser.GameObjects.Text[] = [];
  private activeNumbers: DamageNumber[] = [];

  // Configuration
  private maxActiveNumbers: number = 100;
  private poolSize: number = 60;
  private combineRadius: number = 50;
  private combineTimeWindow: number = 200; // ms
  private spreadRadius: number = 30;

  // Offset tracking for spreading numbers
  private recentPositions: Map<string, { time: number; offsetIndex: number }> = new Map();
  private spreadOffsets: number[] = [-20, 20, -10, 10, 0, -30, 30];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create container for all damage numbers
    this.container = scene.add.container(0, 0);
    this.container.setDepth(150); // Above most game elements

    // Pre-populate text pool
    this.createTextPool();
  }

  /**
   * Create pool of text objects for reuse
   */
  private createTextPool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          fill: true,
        },
      });

      text.setOrigin(0.5, 0.5);
      text.setVisible(false);
      this.container.add(text);
      this.textPool.push(text);
    }
  }

  /**
   * Get a text object from the pool
   */
  private getPooledText(): Phaser.GameObjects.Text | null {
    // First try to find an invisible text
    for (const text of this.textPool) {
      if (!text.visible) {
        return text;
      }
    }

    // Pool exhausted - create new if under limit
    if (this.textPool.length < this.maxActiveNumbers) {
      const text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      });
      text.setOrigin(0.5, 0.5);
      this.container.add(text);
      this.textPool.push(text);
      return text;
    }

    return null;
  }

  /**
   * Show a damage number with all enhanced features
   */
  show(config: DamageNumberConfig): void {
    // Determine damage type
    let type = config.type ?? DamageNumberType.Normal;
    if (config.isOverkill) type = DamageNumberType.Overkill;
    else if (config.isCritical) type = DamageNumberType.Critical;

    // Check for combining nearby damage
    if (config.targetEntity !== undefined) {
      const combined = this.tryCombineDamage(config, type);
      if (combined) return; // Damage was combined with existing number
    }

    // Get style for this damage type
    const style = DAMAGE_STYLES[type];

    // Calculate size multiplier based on damage
    const damageScale = this.calculateDamageScale(config.value, type);

    // Get spread offset for nearby numbers
    const offsetX = this.getSpreadOffset(config.x, config.y);

    // Get text from pool
    const text = this.getPooledText();
    if (!text) {
      // Pool exhausted, remove oldest number
      this.removeOldest();
      const retryText = this.getPooledText();
      if (!retryText) return;
    }

    const mainText = text ?? this.getPooledText();
    if (!mainText) return;

    // Format value text
    const displayValue = this.formatValue(config.value, type, config.customText);

    // Configure text styling
    const finalScale = style.baseScale * damageScale * (config.scale ?? 1);
    const color = config.customColor ?? style.color;

    mainText.setText(displayValue);
    mainText.setStyle({
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: `${style.baseFontSize}px`,
      fontStyle: style.fontStyle,
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: `#${style.strokeColor.toString(16).padStart(6, '0')}`,
      strokeThickness: style.strokeWidth,
    });
    mainText.setPosition(config.x + offsetX, config.y);
    mainText.setScale(finalScale * style.bounceScale); // Start with bounce scale
    mainText.setAlpha(1);
    mainText.setVisible(true);

    // Create special text for crits, overkills, etc.
    let specialText: Phaser.GameObjects.Text | null = null;
    const specialType = this.getSpecialTextType(config);

    if (specialType !== SpecialTextType.None) {
      specialText = this.getPooledText();
      if (specialText) {
        const specialConfig = SPECIAL_TEXTS[specialType];
        specialText.setText(specialConfig.text);
        specialText.setStyle({
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: `#${specialConfig.color.toString(16).padStart(6, '0')}`,
          stroke: '#000000',
          strokeThickness: 3,
        });
        specialText.setPosition(config.x + offsetX, config.y - 25);
        specialText.setScale(specialConfig.scale * 0.8);
        specialText.setAlpha(1);
        specialText.setVisible(true);
        specialText.setAngle(-10 + Math.random() * 20); // Slight random tilt
      }
    }

    // Create damage number record
    const damageNumber: DamageNumber = {
      text: mainText,
      specialText,
      x: config.x + offsetX,
      y: config.y,
      startX: config.x + offsetX,
      startY: config.y,
      elapsed: 0,
      duration: style.duration,
      floatDistance: style.floatDistance,
      fadeStartRatio: style.fadeStartRatio,
      baseScale: finalScale,
      bounceScale: style.bounceScale,
      style,
      offsetX,
      active: true,
      targetEntity: config.targetEntity ?? -1,
      value: config.value,
      lastCombineTime: this.scene.time.now,
    };

    this.activeNumbers.push(damageNumber);

    // Camera shake for high-impact hits
    if (style.shake && config.value > 50) {
      const intensity = Math.min(0.01, config.value / 5000);
      this.scene.cameras.main.shake(100, intensity);
    }
  }

  /**
   * Try to combine damage with existing nearby number
   */
  private tryCombineDamage(config: DamageNumberConfig, type: DamageNumberType): boolean {
    if (config.targetEntity === undefined) return false;

    const now = this.scene.time.now;

    for (const num of this.activeNumbers) {
      if (!num.active) continue;
      if (num.targetEntity !== config.targetEntity) continue;
      if (now - num.lastCombineTime > this.combineTimeWindow) continue;

      const dist = Math.sqrt(
        Math.pow(num.startX - config.x, 2) +
        Math.pow(num.startY - config.y, 2)
      );

      if (dist > this.combineRadius) continue;

      // Combine damage!
      num.value += config.value;
      num.lastCombineTime = now;

      // Update text
      const style = DAMAGE_STYLES[type];
      const newScale = this.calculateDamageScale(num.value, type) * style.baseScale;

      num.text.setText(this.formatValue(num.value, type));
      num.baseScale = newScale;

      // Pop effect for combined damage
      num.text.setScale(newScale * 1.3);

      // Flash effect
      num.text.setTint(0xffffff);
      this.scene.time.delayedCall(50, () => {
        num.text.clearTint();
      });

      // Reset animation slightly
      num.elapsed = Math.max(0, num.elapsed - 100);

      return true;
    }

    return false;
  }

  /**
   * Calculate scale based on damage amount
   */
  private calculateDamageScale(value: number, type: DamageNumberType): number {
    // Base scale is 1.0 for typical damage values
    // Scale up for larger damage, logarithmically

    let baseValue = 20; // "normal" damage amount

    if (type === DamageNumberType.Heal) baseValue = 15;
    else if (type === DamageNumberType.XP) baseValue = 10;

    const ratio = value / baseValue;

    // Logarithmic scaling with minimum of 0.8 and max of 2.0
    const scale = 0.8 + Math.log10(Math.max(1, ratio)) * 0.4;

    return Math.min(2.0, Math.max(0.8, scale));
  }

  /**
   * Get horizontal offset to spread overlapping numbers
   */
  private getSpreadOffset(x: number, y: number): number {
    const key = `${Math.round(x / this.spreadRadius)}_${Math.round(y / this.spreadRadius)}`;
    const now = this.scene.time.now;

    // Clean up old positions
    for (const [k, v] of this.recentPositions) {
      if (now - v.time > 500) {
        this.recentPositions.delete(k);
      }
    }

    const existing = this.recentPositions.get(key);
    let offsetIndex = 0;

    if (existing && now - existing.time < 300) {
      offsetIndex = (existing.offsetIndex + 1) % this.spreadOffsets.length;
    }

    this.recentPositions.set(key, { time: now, offsetIndex });

    return this.spreadOffsets[offsetIndex];
  }

  /**
   * Determine special text type based on config
   */
  private getSpecialTextType(config: DamageNumberConfig): SpecialTextType {
    if (config.isOverkill) return SpecialTextType.Overkill;
    if (config.isCritical) return SpecialTextType.Crit;
    if (config.comboCount && config.comboCount >= 5) return SpecialTextType.Combo;

    // Random chance for POW on high damage hits
    if (config.value > 100 && Math.random() < 0.3) {
      return SpecialTextType.Pow;
    }

    return SpecialTextType.None;
  }

  /**
   * Format damage value for display
   */
  private formatValue(value: number, type: DamageNumberType, customText?: string): string {
    if (customText) return customText;

    const absValue = Math.abs(Math.round(value));
    let formatted: string;

    if (absValue >= 1000000) {
      formatted = `${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 10000) {
      formatted = `${(absValue / 1000).toFixed(0)}K`;
    } else if (absValue >= 1000) {
      formatted = `${(absValue / 1000).toFixed(1)}K`;
    } else {
      formatted = absValue.toString();
    }

    // Add prefix for heals and XP
    if (type === DamageNumberType.Heal || type === DamageNumberType.XP) {
      return `+${formatted}`;
    }

    return formatted;
  }

  /**
   * Remove oldest damage number
   */
  private removeOldest(): void {
    let oldest: DamageNumber | null = null;
    let oldestIndex = -1;

    for (let i = 0; i < this.activeNumbers.length; i++) {
      const num = this.activeNumbers[i];
      if (num.active && (!oldest || num.elapsed > oldest.elapsed)) {
        oldest = num;
        oldestIndex = i;
      }
    }

    if (oldest && oldestIndex >= 0) {
      this.releaseNumber(oldest, oldestIndex);
    }
  }

  /**
   * Release a damage number back to pool
   */
  private releaseNumber(num: DamageNumber, index: number): void {
    num.text.setVisible(false);
    num.active = false;

    if (num.specialText) {
      num.specialText.setVisible(false);
    }

    this.activeNumbers.splice(index, 1);
  }

  // ============================================
  // Easing Functions
  // ============================================

  /**
   * Ease out quad - smooth deceleration
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Ease out cubic - smoother deceleration
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Ease out back - slight overshoot then settle
   */
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * Ease out elastic - bouncy effect
   */
  private easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;

    if (t === 0) return 0;
    if (t === 1) return 1;

    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  // ============================================
  // Convenience Methods
  // ============================================

  /**
   * Show regular damage number
   */
  showDamage(x: number, y: number, damage: number, isCritical: boolean = false, targetEntity?: number): void {
    this.show({
      value: damage,
      x,
      y,
      type: DamageNumberType.Normal,
      isCritical,
      targetEntity,
    });
  }

  /**
   * Show player taking damage
   */
  showPlayerDamage(x: number, y: number, damage: number): void {
    this.show({
      value: damage,
      x,
      y,
      type: DamageNumberType.PlayerDamage,
    });
  }

  /**
   * Show healing number
   */
  showHeal(x: number, y: number, amount: number): void {
    this.show({
      value: amount,
      x,
      y,
      type: DamageNumberType.Heal,
    });
  }

  /**
   * Show XP gain
   */
  showXP(x: number, y: number, amount: number): void {
    this.show({
      value: amount,
      x,
      y,
      type: DamageNumberType.XP,
    });
  }

  /**
   * Show shield damage/block
   */
  showShield(x: number, y: number, amount: number): void {
    this.show({
      value: amount,
      x,
      y,
      type: DamageNumberType.Shield,
    });
  }

  /**
   * Show miss text
   */
  showMiss(x: number, y: number): void {
    this.show({
      value: 0,
      x,
      y,
      type: DamageNumberType.Normal,
      customText: 'MISS',
      customColor: 0xaaaaaa,
      scale: 0.8,
    });
  }

  /**
   * Show blocked text
   */
  showBlocked(x: number, y: number): void {
    this.show({
      value: 0,
      x,
      y,
      type: DamageNumberType.Normal,
      customText: 'BLOCKED',
      customColor: 0x666666,
      scale: 0.8,
    });
  }

  /**
   * Show custom text
   */
  showText(x: number, y: number, text: string, color: number = 0xffffff, scale: number = 1): void {
    this.show({
      value: 0,
      x,
      y,
      customText: text,
      customColor: color,
      scale,
    });
  }

  /**
   * Show overkill damage
   */
  showOverkill(x: number, y: number, damage: number, targetEntity?: number): void {
    this.show({
      value: damage,
      x,
      y,
      isOverkill: true,
      targetEntity,
    });
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update all active damage numbers
   */
  update(delta: number): void {
    const dt = delta; // Already in seconds if passed from Phaser
    const toRemove: number[] = [];

    for (let i = 0; i < this.activeNumbers.length; i++) {
      const num = this.activeNumbers[i];
      if (!num.active) continue;

      num.elapsed += dt * 1000; // Convert to ms

      const progress = Math.min(1, num.elapsed / num.duration);

      if (progress >= 1) {
        toRemove.push(i);
        continue;
      }

      // Calculate float position (ease out cubic for smooth deceleration)
      const floatProgress = this.easeOutCubic(progress);
      num.y = num.startY - floatProgress * num.floatDistance;

      // Small horizontal wobble
      const wobble = Math.sin(num.elapsed * 0.015) * 2 * (1 - progress);
      num.x = num.startX + wobble;

      // Calculate alpha (fade out after fadeStartRatio)
      let alpha = 1;
      if (progress > num.fadeStartRatio) {
        const fadeProgress = (progress - num.fadeStartRatio) / (1 - num.fadeStartRatio);
        alpha = 1 - this.easeOutQuad(fadeProgress);
      }

      // Calculate scale (bounce effect at start, shrink at end)
      let scale = num.baseScale;

      if (progress < 0.15) {
        // Initial bounce: start big, settle to base
        const bounceProgress = progress / 0.15;
        const bounceEase = this.easeOutElastic(bounceProgress);
        scale = num.baseScale * (num.bounceScale - (num.bounceScale - 1) * bounceEase);
      } else if (progress > 0.85) {
        // End shrink
        const shrinkProgress = (progress - 0.85) / 0.15;
        scale = num.baseScale * (1 - shrinkProgress * 0.3);
      }

      // Apply to main text
      num.text.setPosition(num.x, num.y);
      num.text.setAlpha(alpha);
      num.text.setScale(scale);

      // Apply to special text (floats up faster, fades quicker)
      if (num.specialText) {
        const specialProgress = Math.min(1, num.elapsed / (num.duration * 0.6));
        const specialY = num.startY - 25 - this.easeOutQuad(specialProgress) * 40;
        const specialAlpha = progress < 0.4 ? 1 : Math.max(0, 1 - (progress - 0.4) / 0.3);

        num.specialText.setPosition(num.x, specialY);
        num.specialText.setAlpha(specialAlpha);

        // Special text has its own bounce
        if (progress < 0.1) {
          const specialBounce = this.easeOutBack(progress / 0.1);
          num.specialText.setScale(specialBounce * 1.2);
        }
      }
    }

    // Remove completed numbers (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const index = toRemove[i];
      this.releaseNumber(this.activeNumbers[index], index);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get count of active damage numbers
   */
  getActiveCount(): number {
    return this.activeNumbers.filter(n => n.active).length;
  }

  /**
   * Clear all damage numbers
   */
  clearAll(): void {
    for (const num of this.activeNumbers) {
      num.text.setVisible(false);
      if (num.specialText) {
        num.specialText.setVisible(false);
      }
    }
    this.activeNumbers = [];
    this.recentPositions.clear();
  }

  /**
   * Pause all damage number animations
   */
  pause(): void {
    // Numbers will simply not update when update() isn't called
  }

  /**
   * Destroy the damage number system
   */
  destroy(): void {
    this.clearAll();

    for (const text of this.textPool) {
      text.destroy();
    }
    this.textPool = [];

    this.container.destroy();
  }
}
