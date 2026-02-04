/**
 * DamageNumberRenderer - Renders floating damage numbers.
 * Uses object pooling for performance optimization.
 */

import * as Phaser from 'phaser';
import type { Renderer } from '../rendering/Renderer';
import { ObjectPool, type IPoolable } from '../shared/utils/pool';

/**
 * Damage number type for styling.
 */
export enum DamageNumberType {
  Normal = 'normal',
  Critical = 'critical',
  Heal = 'heal',
  Shield = 'shield',
  XP = 'xp',
  Blocked = 'blocked',
  Miss = 'miss',
}

/**
 * Damage number configuration.
 */
export interface DamageNumberConfig {
  /** Damage/heal amount to display */
  value: number;
  /** Type of damage for styling */
  type: DamageNumberType;
  /** World X position */
  x: number;
  /** World Y position */
  y: number;
  /** Custom text (overrides value) */
  text?: string;
  /** Custom color (overrides type default) */
  color?: number;
  /** Scale multiplier */
  scale?: number;
}

/**
 * Style configuration for damage number types.
 */
interface DamageNumberStyle {
  color: number;
  fontSize: number;
  fontStyle: string;
  stroke: number;
  strokeWidth: number;
  scale: number;
  duration: number;
  floatDistance: number;
  fadeStart: number;
}

/**
 * Active damage number instance.
 */
class DamageNumber implements IPoolable {
  /** Text object */
  text: Phaser.GameObjects.Text | null = null;

  /** World position */
  x: number = 0;
  y: number = 0;

  /** Start position for animation */
  startY: number = 0;

  /** Animation state */
  elapsed: number = 0;
  duration: number = 1000;
  floatDistance: number = 50;
  fadeStart: number = 0.5;

  /** Active state */
  active: boolean = false;

  /** Style reference */
  style: DamageNumberStyle | null = null;

  /** Base scale */
  baseScale: number = 1;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.startY = 0;
    this.elapsed = 0;
    this.duration = 1000;
    this.floatDistance = 50;
    this.fadeStart = 0.5;
    this.active = false;
    this.style = null;
    this.baseScale = 1;

    if (this.text) {
      this.text.setVisible(false);
      this.text.setAlpha(1);
      this.text.setScale(1);
    }
  }
}

/**
 * DamageNumberRenderer manages floating combat text.
 */
export class DamageNumberRenderer {
  /** Scene reference */

  /** Scene reference */
  private scene: Phaser.Scene | null = null;

  /** Container for damage numbers */
  private container: Phaser.GameObjects.Container | null = null;

  /** Object pool for damage numbers */
  private pool: ObjectPool<DamageNumber>;

  /** Active damage numbers */
  private activeNumbers: Set<DamageNumber> = new Set();

  /** Text pool for reuse */
  private textPool: Phaser.GameObjects.Text[] = [];
  private textPoolIndex: number = 0;

  /** Style presets for different damage types */
  private styles: Map<DamageNumberType, DamageNumberStyle> = new Map();

  /** Random offset range */
  private randomOffsetX: number = 20;
  private randomOffsetY: number = 10;

  /** Maximum visible numbers */
  private maxVisible: number = 100;

  constructor(renderer: Renderer) {
    this.scene = renderer.getScene();

    // Initialize pool
    this.pool = new ObjectPool(() => new DamageNumber(), 50, 200);

    // Set up styles
    this.initializeStyles();

    // Set up container and text pool
    this.setupContainer();
    this.createTextPool();
  }

  /**
   * Initialize damage number styles.
   */
  private initializeStyles(): void {
    this.styles.set(DamageNumberType.Normal, {
      color: 0xffffff,
      fontSize: 16,
      fontStyle: 'bold',
      stroke: 0x000000,
      strokeWidth: 3,
      scale: 1,
      duration: 800,
      floatDistance: 40,
      fadeStart: 0.5,
    });

    this.styles.set(DamageNumberType.Critical, {
      color: 0xffff00,
      fontSize: 24,
      fontStyle: 'bold',
      stroke: 0xff6600,
      strokeWidth: 4,
      scale: 1.3,
      duration: 1000,
      floatDistance: 60,
      fadeStart: 0.4,
    });

    this.styles.set(DamageNumberType.Heal, {
      color: 0x00ff00,
      fontSize: 18,
      fontStyle: 'bold',
      stroke: 0x006600,
      strokeWidth: 3,
      scale: 1,
      duration: 900,
      floatDistance: 50,
      fadeStart: 0.5,
    });

    this.styles.set(DamageNumberType.Shield, {
      color: 0x00aaff,
      fontSize: 16,
      fontStyle: 'bold',
      stroke: 0x0044aa,
      strokeWidth: 3,
      scale: 1,
      duration: 800,
      floatDistance: 35,
      fadeStart: 0.5,
    });

    this.styles.set(DamageNumberType.XP, {
      color: 0xffd700,
      fontSize: 14,
      fontStyle: 'normal',
      stroke: 0x886600,
      strokeWidth: 2,
      scale: 0.9,
      duration: 1200,
      floatDistance: 45,
      fadeStart: 0.6,
    });

    this.styles.set(DamageNumberType.Blocked, {
      color: 0x888888,
      fontSize: 14,
      fontStyle: 'italic',
      stroke: 0x444444,
      strokeWidth: 2,
      scale: 0.8,
      duration: 600,
      floatDistance: 25,
      fadeStart: 0.4,
    });

    this.styles.set(DamageNumberType.Miss, {
      color: 0xaaaaaa,
      fontSize: 14,
      fontStyle: 'italic',
      stroke: 0x444444,
      strokeWidth: 2,
      scale: 0.8,
      duration: 600,
      floatDistance: 30,
      fadeStart: 0.4,
    });
  }

  /**
   * Set up container for damage numbers.
   */
  private setupContainer(): void {
    if (!this.scene) return;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(110); // Above most effects
  }

  /**
   * Create pool of text objects.
   */
  private createTextPool(): void {
    if (!this.scene) return;

    const poolSize = 50;

    for (let i = 0; i < poolSize; i++) {
      const text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });

      text.setOrigin(0.5, 0.5);
      text.setVisible(false);

      if (this.container) {
        this.container.add(text);
      }

      this.textPool.push(text);
    }
  }

  /**
   * Get text object from pool.
   */
  private getPooledText(): Phaser.GameObjects.Text | null {
    // Find next available text
    const startIndex = this.textPoolIndex;
    do {
      const text = this.textPool[this.textPoolIndex];
      this.textPoolIndex = (this.textPoolIndex + 1) % this.textPool.length;

      if (!text.visible) {
        return text;
      }
    } while (this.textPoolIndex !== startIndex);

    // Pool exhausted, create new text if under limit
    if (this.textPool.length < this.maxVisible && this.scene) {
      const text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });

      text.setOrigin(0.5, 0.5);

      if (this.container) {
        this.container.add(text);
      }

      this.textPool.push(text);
      return text;
    }

    return null;
  }

  // ============================================
  // Display Methods
  // ============================================

  /**
   * Show a damage number.
   */
  show(config: DamageNumberConfig): void {
    if (this.activeNumbers.size >= this.maxVisible) {
      // Remove oldest number
      const oldest = this.activeNumbers.values().next().value;
      if (oldest) {
        this.releaseNumber(oldest);
      }
    }

    const style = this.styles.get(config.type) ?? this.styles.get(DamageNumberType.Normal)!;
    const text = this.getPooledText();

    if (!text) return;

    // Get number from pool
    const damageNumber = this.pool.acquire();

    // Random offset
    const offsetX = (Math.random() - 0.5) * this.randomOffsetX * 2;
    const offsetY = (Math.random() - 0.5) * this.randomOffsetY * 2;

    // Set up damage number
    damageNumber.x = config.x + offsetX;
    damageNumber.y = config.y + offsetY;
    damageNumber.startY = damageNumber.y;
    damageNumber.elapsed = 0;
    damageNumber.duration = style.duration;
    damageNumber.floatDistance = style.floatDistance;
    damageNumber.fadeStart = style.fadeStart;
    damageNumber.style = style;
    damageNumber.baseScale = (config.scale ?? 1) * style.scale;
    damageNumber.active = true;
    damageNumber.text = text;

    // Format text
    const displayText = config.text ?? this.formatValue(config.value, config.type);

    // Configure text object
    const color = config.color ?? style.color;
    text.setText(displayText);
    text.setPosition(damageNumber.x, damageNumber.y);
    text.setStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: `${style.fontSize}px`,
      fontStyle: style.fontStyle,
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: `#${style.stroke.toString(16).padStart(6, '0')}`,
      strokeThickness: style.strokeWidth,
    });
    text.setScale(damageNumber.baseScale);
    text.setAlpha(1);
    text.setVisible(true);

    // Apply pop-in effect for criticals
    if (config.type === DamageNumberType.Critical) {
      text.setScale(damageNumber.baseScale * 1.5);
    }

    this.activeNumbers.add(damageNumber);
  }

  /**
   * Format damage value for display.
   */
  private formatValue(value: number, type: DamageNumberType): string {
    if (type === DamageNumberType.Miss) {
      return 'MISS';
    }
    if (type === DamageNumberType.Blocked) {
      return 'BLOCKED';
    }

    const absValue = Math.abs(Math.round(value));
    let formatted: string;

    if (absValue >= 1000000) {
      formatted = `${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      formatted = `${(absValue / 1000).toFixed(1)}K`;
    } else {
      formatted = absValue.toString();
    }

    // Add prefix
    if (type === DamageNumberType.Heal) {
      return `+${formatted}`;
    }
    if (type === DamageNumberType.XP) {
      return `+${formatted} XP`;
    }

    return formatted;
  }

  /**
   * Show damage number at position.
   */
  showDamage(x: number, y: number, damage: number, isCritical: boolean = false): void {
    this.show({
      value: damage,
      type: isCritical ? DamageNumberType.Critical : DamageNumberType.Normal,
      x,
      y,
    });
  }

  /**
   * Show heal number.
   */
  showHeal(x: number, y: number, amount: number): void {
    this.show({
      value: amount,
      type: DamageNumberType.Heal,
      x,
      y,
    });
  }

  /**
   * Show XP gain.
   */
  showXP(x: number, y: number, amount: number): void {
    this.show({
      value: amount,
      type: DamageNumberType.XP,
      x,
      y,
    });
  }

  /**
   * Show blocked damage.
   */
  showBlocked(x: number, y: number): void {
    this.show({
      value: 0,
      type: DamageNumberType.Blocked,
      x,
      y,
    });
  }

  /**
   * Show miss.
   */
  showMiss(x: number, y: number): void {
    this.show({
      value: 0,
      type: DamageNumberType.Miss,
      x,
      y,
    });
  }

  /**
   * Show custom text.
   */
  showText(x: number, y: number, text: string, color: number = 0xffffff): void {
    this.show({
      value: 0,
      type: DamageNumberType.Normal,
      x,
      y,
      text,
      color,
    });
  }

  // ============================================
  // Update Loop
  // ============================================

  /**
   * Update all damage numbers.
   */
  update(dt: number): void {
    const toRemove: DamageNumber[] = [];

    for (const damageNumber of this.activeNumbers) {
      damageNumber.elapsed += dt * 1000; // Convert to ms

      const progress = Math.min(1, damageNumber.elapsed / damageNumber.duration);

      if (progress >= 1) {
        toRemove.push(damageNumber);
        continue;
      }

      // Update position (float up)
      const floatProgress = this.easeOutQuad(progress);
      damageNumber.y = damageNumber.startY - floatProgress * damageNumber.floatDistance;

      // Update alpha (fade out)
      let alpha = 1;
      if (progress > damageNumber.fadeStart) {
        const fadeProgress = (progress - damageNumber.fadeStart) / (1 - damageNumber.fadeStart);
        alpha = 1 - fadeProgress;
      }

      // Update scale (pop effect for criticals)
      let scale = damageNumber.baseScale;
      if (damageNumber.style && progress < 0.1) {
        const popProgress = progress / 0.1;
        const popScale = 1.5 - 0.5 * this.easeOutElastic(popProgress);
        scale = damageNumber.baseScale * popScale;
      }

      // Apply to text
      if (damageNumber.text) {
        damageNumber.text.setPosition(damageNumber.x, damageNumber.y);
        damageNumber.text.setAlpha(alpha);
        damageNumber.text.setScale(scale);
      }
    }

    // Remove completed numbers
    for (const num of toRemove) {
      this.releaseNumber(num);
    }
  }

  /**
   * Release a damage number back to pool.
   */
  private releaseNumber(damageNumber: DamageNumber): void {
    if (damageNumber.text) {
      damageNumber.text.setVisible(false);
    }

    this.activeNumbers.delete(damageNumber);
    this.pool.release(damageNumber);
  }

  /**
   * Ease out quad function.
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Ease out elastic function (for pop effect).
   */
  private easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;

    if (t === 0) return 0;
    if (t === 1) return 1;

    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get number of active damage numbers.
   */
  getActiveCount(): number {
    return this.activeNumbers.size;
  }

  /**
   * Clear all damage numbers.
   */
  clearAll(): void {
    for (const num of this.activeNumbers) {
      if (num.text) {
        num.text.setVisible(false);
      }
      this.pool.release(num);
    }
    this.activeNumbers.clear();
  }

  /**
   * Set style for a damage type.
   */
  setStyle(type: DamageNumberType, style: Partial<DamageNumberStyle>): void {
    const existing = this.styles.get(type);
    if (existing) {
      this.styles.set(type, { ...existing, ...style });
    }
  }

  /**
   * Destroy damage number renderer.
   */
  destroy(): void {
    this.clearAll();
    this.pool.clear();

    for (const text of this.textPool) {
      text.destroy();
    }
    this.textPool = [];

    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}
