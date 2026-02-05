/**
 * AutoAimSystem - Auto-targets closest enemy for mobile.
 * Recalculates every 100ms for performance.
 * Falls back to movement direction when no enemies in range.
 */

export interface AimTarget {
  angle: number;
  hasTarget: boolean;
}

interface EnemyLike {
  x: number;
  y: number;
  active: boolean;
}

export class AutoAimSystem {
  private readonly maxRange = 500;
  private readonly updateInterval = 0.1; // 100ms
  private timer = 0;

  private _targetAngle = 0;
  private _hasTarget = false;

  /** Fallback angle used when no enemies in range */
  private fallbackAngle = 0;

  get targetAngle(): number { return this._targetAngle; }
  get hasTarget(): boolean { return this._hasTarget; }

  /**
   * Update auto-aim. Call every frame.
   * @param dt Delta time in seconds
   * @param playerX Player X position
   * @param playerY Player Y position
   * @param enemies Array of enemy-like objects with x, y, active
   * @param moveX Joystick X for fallback direction (-1..1)
   * @param moveY Joystick Y for fallback direction (-1..1)
   */
  update(
    dt: number,
    playerX: number,
    playerY: number,
    enemies: EnemyLike[],
    moveX: number,
    moveY: number
  ): void {
    this.timer += dt;

    // Update fallback angle from movement direction
    if (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1) {
      this.fallbackAngle = Math.atan2(moveY, moveX);
    }

    if (this.timer < this.updateInterval) return;
    this.timer = 0;

    // Find closest enemy in range
    let closestDist = this.maxRange;
    let closestEnemy: EnemyLike | null = null;

    for (const enemy of enemies) {
      if (!enemy.active) continue;

      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      this._targetAngle = Math.atan2(
        closestEnemy.y - playerY,
        closestEnemy.x - playerX
      );
      this._hasTarget = true;
    } else {
      this._targetAngle = this.fallbackAngle;
      this._hasTarget = false;
    }
  }

  reset(): void {
    this.timer = 0;
    this._targetAngle = 0;
    this._hasTarget = false;
    this.fallbackAngle = 0;
  }
}
