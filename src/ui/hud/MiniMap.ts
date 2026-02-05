/**
 * MiniMap - Radar-style minimap for Cosmic Survivors HUD.
 * Shows player, enemies, bosses, XP orbs, and map boundaries.
 */

import * as Phaser from 'phaser';
import type { IUIComponent } from '@shared/interfaces/IUI';
import { UIDepth } from '../UIConstants';

export interface MiniMapConfig {
  x: number;
  y: number;
  size?: number;
  range?: number; // World units visible on minimap
}

export interface MiniMapEntity {
  x: number;
  y: number;
  type: 'player' | 'enemy' | 'boss' | 'xpOrb';
}

export interface MiniMapData {
  playerX: number;
  playerY: number;
  mapWidth: number;
  mapHeight: number;
  entities: MiniMapEntity[];
}

/**
 * MiniMap UI component displaying a radar-style view of the game world.
 */
export class MiniMap implements IUIComponent {
  readonly id: string;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private entityLayer: Phaser.GameObjects.Graphics;
  private borderLayer: Phaser.GameObjects.Graphics;
  private config: Required<MiniMapConfig>;
  private _visible: boolean = true;
  private _interactive: boolean = false;

  // Boss pulsing animation state
  private bossPulseTime: number = 0;
  private readonly BOSS_PULSE_SPEED: number = 3; // Pulses per second

  // Entity sizes
  private readonly PLAYER_DOT_SIZE: number = 4;
  private readonly ENEMY_DOT_SIZE: number = 2;
  private readonly BOSS_DOT_SIZE: number = 5;
  private readonly XP_DOT_SIZE: number = 1.5;
  private readonly EDGE_INDICATOR_SIZE: number = 3;

  // Colors
  private readonly PLAYER_COLOR: number = 0x00ffff;
  private readonly ENEMY_COLOR: number = 0xff4444;
  private readonly BOSS_COLOR: number = 0xff0000;
  private readonly XP_COLOR: number = 0x88ff88;
  private readonly BOUNDARY_COLOR: number = 0x4a4a6e;
  private readonly BG_COLOR: number = 0x0a0a1e;
  private readonly BORDER_COLOR: number = 0x00ffff;

  constructor(scene: Phaser.Scene, config: MiniMapConfig) {
    this.id = `minimap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scene = scene;
    this.config = {
      size: 150,
      range: 800, // Default view range in world units
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(UIDepth.HUD + 5); // Slightly above other HUD elements
    this.container.setScrollFactor(0);

    // Create background layer
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Create entity layer
    this.entityLayer = scene.add.graphics();
    this.container.add(this.entityLayer);

    // Create border layer (on top)
    this.borderLayer = scene.add.graphics();
    this.container.add(this.borderLayer);

    this.drawBackground();
    this.drawBorder();
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    this.container.setVisible(value);
  }

  get interactive(): boolean {
    return this._interactive;
  }

  set interactive(value: boolean) {
    this._interactive = value;
  }

  /**
   * Draw the semi-transparent background.
   */
  private drawBackground(): void {
    const size = this.config.size;
    const radius = size / 2;

    this.background.clear();

    // Semi-transparent dark background
    this.background.fillStyle(this.BG_COLOR, 0.7);
    this.background.fillCircle(radius, radius, radius);

    // Subtle grid lines for radar effect
    this.background.lineStyle(1, this.BOUNDARY_COLOR, 0.3);

    // Concentric circles
    for (let i = 1; i <= 3; i++) {
      this.background.strokeCircle(radius, radius, (radius * i) / 3);
    }

    // Cross lines
    this.background.lineBetween(0, radius, size, radius);
    this.background.lineBetween(radius, 0, radius, size);
  }

  /**
   * Draw the minimap border.
   */
  private drawBorder(): void {
    const size = this.config.size;
    const radius = size / 2;

    this.borderLayer.clear();

    // Outer glow effect
    this.borderLayer.lineStyle(3, this.BORDER_COLOR, 0.3);
    this.borderLayer.strokeCircle(radius, radius, radius + 1);

    // Main border
    this.borderLayer.lineStyle(2, this.BORDER_COLOR, 0.8);
    this.borderLayer.strokeCircle(radius, radius, radius);
  }

  /**
   * Update the minimap with current game state.
   */
  updateData(data: MiniMapData): void {
    this.entityLayer.clear();

    const size = this.config.size;
    const radius = size / 2;
    const range = this.config.range;

    // Draw map boundaries (relative to player)
    this.drawMapBoundaries(data, radius, range);

    // Draw entities
    for (const entity of data.entities) {
      // Calculate relative position from player
      const relX = entity.x - data.playerX;
      const relY = entity.y - data.playerY;

      // Convert to minimap coordinates
      const mapX = radius + (relX / range) * radius;
      const mapY = radius + (relY / range) * radius;

      // Calculate distance from center
      const distFromCenter = Math.sqrt(
        Math.pow(mapX - radius, 2) + Math.pow(mapY - radius, 2)
      );

      // Check if entity is within minimap bounds
      const isInBounds = distFromCenter < radius - 2;

      if (isInBounds) {
        // Draw entity at its position
        this.drawEntity(mapX, mapY, entity.type);
      } else if (entity.type === 'enemy' || entity.type === 'boss') {
        // Draw at edge for out-of-range enemies
        this.drawEdgeIndicator(mapX, mapY, radius, entity.type);
      }
    }

    // Draw player at center (always on top)
    this.drawPlayer(radius, radius);
  }

  /**
   * Draw map boundaries on the minimap.
   */
  private drawMapBoundaries(
    data: MiniMapData,
    center: number,
    range: number
  ): void {
    const halfSize = center;

    // Calculate boundary positions relative to player
    const leftEdge = center + ((-data.playerX) / range) * halfSize;
    const rightEdge = center + ((data.mapWidth - data.playerX) / range) * halfSize;
    const topEdge = center + ((-data.playerY) / range) * halfSize;
    const bottomEdge = center + ((data.mapHeight - data.playerY) / range) * halfSize;

    this.entityLayer.lineStyle(1, this.BOUNDARY_COLOR, 0.6);

    // Only draw edges that are visible on the minimap
    const size = this.config.size;
    const margin = 2;

    // Left edge
    if (leftEdge > margin && leftEdge < size - margin) {
      const y1 = Math.max(margin, topEdge);
      const y2 = Math.min(size - margin, bottomEdge);
      this.entityLayer.lineBetween(leftEdge, y1, leftEdge, y2);
    }

    // Right edge
    if (rightEdge > margin && rightEdge < size - margin) {
      const y1 = Math.max(margin, topEdge);
      const y2 = Math.min(size - margin, bottomEdge);
      this.entityLayer.lineBetween(rightEdge, y1, rightEdge, y2);
    }

    // Top edge
    if (topEdge > margin && topEdge < size - margin) {
      const x1 = Math.max(margin, leftEdge);
      const x2 = Math.min(size - margin, rightEdge);
      this.entityLayer.lineBetween(x1, topEdge, x2, topEdge);
    }

    // Bottom edge
    if (bottomEdge > margin && bottomEdge < size - margin) {
      const x1 = Math.max(margin, leftEdge);
      const x2 = Math.min(size - margin, rightEdge);
      this.entityLayer.lineBetween(x1, bottomEdge, x2, bottomEdge);
    }
  }

  /**
   * Draw player dot at center.
   */
  private drawPlayer(x: number, y: number): void {
    // Outer glow
    this.entityLayer.fillStyle(this.PLAYER_COLOR, 0.3);
    this.entityLayer.fillCircle(x, y, this.PLAYER_DOT_SIZE + 2);

    // Inner dot
    this.entityLayer.fillStyle(this.PLAYER_COLOR, 1);
    this.entityLayer.fillCircle(x, y, this.PLAYER_DOT_SIZE);
  }

  /**
   * Draw an entity on the minimap.
   */
  private drawEntity(x: number, y: number, type: 'player' | 'enemy' | 'boss' | 'xpOrb'): void {
    switch (type) {
      case 'enemy':
        this.entityLayer.fillStyle(this.ENEMY_COLOR, 0.9);
        this.entityLayer.fillCircle(x, y, this.ENEMY_DOT_SIZE);
        break;

      case 'boss':
        this.drawBoss(x, y);
        break;

      case 'xpOrb':
        this.entityLayer.fillStyle(this.XP_COLOR, 0.7);
        this.entityLayer.fillCircle(x, y, this.XP_DOT_SIZE);
        break;

      default:
        break;
    }
  }

  /**
   * Draw a boss with pulsing effect.
   */
  private drawBoss(x: number, y: number): void {
    // Calculate pulse scale (0.8 to 1.2)
    const pulseScale = 1 + Math.sin(this.bossPulseTime * Math.PI * 2) * 0.3;
    const size = this.BOSS_DOT_SIZE * pulseScale;

    // Outer pulsing glow
    const glowAlpha = 0.3 + Math.sin(this.bossPulseTime * Math.PI * 2) * 0.2;
    this.entityLayer.fillStyle(this.BOSS_COLOR, glowAlpha);
    this.entityLayer.fillCircle(x, y, size + 3);

    // Inner dot
    this.entityLayer.fillStyle(this.BOSS_COLOR, 1);
    this.entityLayer.fillCircle(x, y, size);

    // Bright center
    this.entityLayer.fillStyle(0xffffff, 0.5);
    this.entityLayer.fillCircle(x, y, size * 0.4);
  }

  /**
   * Draw edge indicator for entities outside minimap range.
   */
  private drawEdgeIndicator(
    x: number,
    y: number,
    radius: number,
    type: 'enemy' | 'boss'
  ): void {
    // Calculate angle from center
    const angle = Math.atan2(y - radius, x - radius);

    // Position on edge of circle
    const edgeX = radius + Math.cos(angle) * (radius - 4);
    const edgeY = radius + Math.sin(angle) * (radius - 4);

    const color = type === 'boss' ? this.BOSS_COLOR : this.ENEMY_COLOR;
    const size = type === 'boss' ? this.EDGE_INDICATOR_SIZE + 1 : this.EDGE_INDICATOR_SIZE;

    // Draw arrow-like indicator pointing outward
    this.entityLayer.fillStyle(color, 0.8);

    // Triangle pointing outward
    const points = [
      { x: edgeX + Math.cos(angle) * size, y: edgeY + Math.sin(angle) * size },
      { x: edgeX + Math.cos(angle + 2.5) * size, y: edgeY + Math.sin(angle + 2.5) * size },
      { x: edgeX + Math.cos(angle - 2.5) * size, y: edgeY + Math.sin(angle - 2.5) * size },
    ];

    this.entityLayer.fillTriangle(
      points[0].x, points[0].y,
      points[1].x, points[1].y,
      points[2].x, points[2].y
    );

    // For bosses, add pulsing effect to edge indicator too
    if (type === 'boss') {
      const pulseAlpha = 0.3 + Math.sin(this.bossPulseTime * Math.PI * 2) * 0.2;
      this.entityLayer.fillStyle(color, pulseAlpha);
      this.entityLayer.fillCircle(edgeX, edgeY, size + 2);
    }
  }

  /**
   * Set minimap position.
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Update minimap (called every frame).
   */
  update(dt: number): void {
    // Update boss pulse animation
    this.bossPulseTime += dt * this.BOSS_PULSE_SPEED;
    if (this.bossPulseTime >= 1) {
      this.bossPulseTime -= Math.floor(this.bossPulseTime);
    }
  }

  /**
   * Show minimap with fade-in animation.
   */
  show(): void {
    this.visible = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 200,
    });
  }

  /**
   * Hide minimap with fade-out animation.
   */
  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  /**
   * Destroy the minimap and clean up resources.
   */
  destroy(): void {
    this.container.destroy();
  }

  /**
   * Get the container for adding to parent containers.
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Set the view range of the minimap.
   */
  setRange(range: number): void {
    this.config.range = range;
  }

  /**
   * Get the current view range.
   */
  getRange(): number {
    return this.config.range;
  }
}
