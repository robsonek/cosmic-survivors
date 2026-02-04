/**
 * InputManager - Keyboard and mouse input handling.
 *
 * Features:
 * - WASD/Arrow key movement
 * - Mouse position tracking
 * - Key state tracking (down, pressed, released)
 * - Movement and aim direction helpers
 * - Customizable key bindings
 */

import type { IInputManager, IInputState } from '@shared/interfaces/IGame';

/**
 * Default key bindings.
 */
const DEFAULT_BINDINGS: Record<string, string> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  moveUp2: 'ArrowUp',
  moveDown2: 'ArrowDown',
  moveLeft2: 'ArrowLeft',
  moveRight2: 'ArrowRight',
  primaryAction: 'Mouse0',
  secondaryAction: 'Mouse2',
  pause: 'Escape',
};

/**
 * InputManager implementation for Cosmic Survivors.
 */
export class InputManager implements IInputManager {
  /** Current input state */
  private _state: IInputState;

  /** Whether using gamepad */
  private _usingGamepad = false;

  /** Whether input is enabled */
  private _enabled = true;

  /** Key bindings */
  private _bindings: Record<string, string>;

  /** Target element for events */
  private _target: HTMLElement | Window;

  /** Camera reference for world position calculation */
  private _camera: { x: number; y: number; zoom: number } | null = null;

  /** Bound event handlers for cleanup */
  private _boundHandlers: {
    keydown: (e: KeyboardEvent) => void;
    keyup: (e: KeyboardEvent) => void;
    mousedown: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    contextmenu: (e: Event) => void;
    blur: () => void;
  };

  constructor(target: HTMLElement | Window = window) {
    this._target = target;
    this._bindings = { ...DEFAULT_BINDINGS };

    // Initialize state
    this._state = {
      moveX: 0,
      moveY: 0,
      aimX: 1,
      aimY: 0,
      pointerX: 0,
      pointerY: 0,
      worldPointerX: 0,
      worldPointerY: 0,
      primaryAction: false,
      secondaryAction: false,
      keysDown: new Set(),
      keysPressed: new Set(),
      keysReleased: new Set(),
    };

    // Bind handlers
    this._boundHandlers = {
      keydown: this.handleKeyDown.bind(this),
      keyup: this.handleKeyUp.bind(this),
      mousedown: this.handleMouseDown.bind(this),
      mouseup: this.handleMouseUp.bind(this),
      mousemove: this.handleMouseMove.bind(this),
      contextmenu: this.handleContextMenu.bind(this),
      blur: this.handleBlur.bind(this),
    };

    this.attachEventListeners();
  }

  /**
   * Get current input state.
   */
  get state(): IInputState {
    return this._state;
  }

  /**
   * Check if using gamepad.
   */
  get usingGamepad(): boolean {
    return this._usingGamepad;
  }

  /**
   * Update input state (called each frame).
   * Clears per-frame key states.
   */
  update(): void {
    // Clear per-frame states
    this._state.keysPressed.clear();
    this._state.keysReleased.clear();

    // Update movement from current key states
    this.updateMovement();

    // Update world pointer position if camera is set
    this.updateWorldPointer();
  }

  /**
   * Check if key is currently down.
   * @param key Key code
   */
  isKeyDown(key: string): boolean {
    return this._state.keysDown.has(key);
  }

  /**
   * Check if key was pressed this frame.
   * @param key Key code
   */
  isKeyPressed(key: string): boolean {
    return this._state.keysPressed.has(key);
  }

  /**
   * Check if key was released this frame.
   * @param key Key code
   */
  isKeyReleased(key: string): boolean {
    return this._state.keysReleased.has(key);
  }

  /**
   * Get movement vector (normalized).
   * @returns Movement vector {x, y}
   */
  getMovement(): { x: number; y: number } {
    return {
      x: this._state.moveX,
      y: this._state.moveY,
    };
  }

  /**
   * Get aim direction (normalized).
   * @returns Aim direction {x, y}
   */
  getAimDirection(): { x: number; y: number } {
    return {
      x: this._state.aimX,
      y: this._state.aimY,
    };
  }

  /**
   * Set key bindings.
   * @param bindings Key bindings map
   */
  setBindings(bindings: Record<string, string>): void {
    this._bindings = { ...this._bindings, ...bindings };
  }

  /**
   * Enable/disable input.
   * @param enabled Enabled state
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;

    if (!enabled) {
      // Clear all input state when disabled
      this.clearAllState();
    }
  }

  /**
   * Set camera reference for world position calculation.
   * @param camera Camera object with x, y, zoom
   */
  setCamera(camera: { x: number; y: number; zoom: number }): void {
    this._camera = camera;
  }

  /**
   * Get pointer position in screen coordinates.
   */
  getPointerPosition(): { x: number; y: number } {
    return {
      x: this._state.pointerX,
      y: this._state.pointerY,
    };
  }

  /**
   * Get pointer position in world coordinates.
   */
  getWorldPointerPosition(): { x: number; y: number } {
    return {
      x: this._state.worldPointerX,
      y: this._state.worldPointerY,
    };
  }

  /**
   * Check if a bound action is active.
   * @param action Action name
   */
  isActionDown(action: string): boolean {
    const binding = this._bindings[action];
    if (!binding) return false;

    if (binding.startsWith('Mouse')) {
      const button = parseInt(binding.replace('Mouse', ''), 10);
      if (button === 0) return this._state.primaryAction;
      if (button === 2) return this._state.secondaryAction;
    }

    return this.isKeyDown(binding);
  }

  /**
   * Destroy input manager and remove listeners.
   */
  destroy(): void {
    this.detachEventListeners();
    this.clearAllState();
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Attach event listeners.
   */
  private attachEventListeners(): void {
    const target = this._target;
    const doc = document;

    doc.addEventListener('keydown', this._boundHandlers.keydown);
    doc.addEventListener('keyup', this._boundHandlers.keyup);

    if (target instanceof HTMLElement) {
      target.addEventListener('mousedown', this._boundHandlers.mousedown);
      target.addEventListener('mouseup', this._boundHandlers.mouseup);
      target.addEventListener('mousemove', this._boundHandlers.mousemove);
      target.addEventListener('contextmenu', this._boundHandlers.contextmenu);
    } else {
      window.addEventListener('mousedown', this._boundHandlers.mousedown);
      window.addEventListener('mouseup', this._boundHandlers.mouseup);
      window.addEventListener('mousemove', this._boundHandlers.mousemove);
      window.addEventListener('contextmenu', this._boundHandlers.contextmenu);
    }

    window.addEventListener('blur', this._boundHandlers.blur);
  }

  /**
   * Detach event listeners.
   */
  private detachEventListeners(): void {
    const target = this._target;
    const doc = document;

    doc.removeEventListener('keydown', this._boundHandlers.keydown);
    doc.removeEventListener('keyup', this._boundHandlers.keyup);

    if (target instanceof HTMLElement) {
      target.removeEventListener('mousedown', this._boundHandlers.mousedown);
      target.removeEventListener('mouseup', this._boundHandlers.mouseup);
      target.removeEventListener('mousemove', this._boundHandlers.mousemove);
      target.removeEventListener('contextmenu', this._boundHandlers.contextmenu);
    } else {
      window.removeEventListener('mousedown', this._boundHandlers.mousedown);
      window.removeEventListener('mouseup', this._boundHandlers.mouseup);
      window.removeEventListener('mousemove', this._boundHandlers.mousemove);
      window.removeEventListener('contextmenu', this._boundHandlers.contextmenu);
    }

    window.removeEventListener('blur', this._boundHandlers.blur);
  }

  /**
   * Handle keydown event.
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this._enabled) return;

    const key = e.code;

    // Prevent default for game keys
    if (this.isGameKey(key)) {
      e.preventDefault();
    }

    // Only add to pressed if not already down
    if (!this._state.keysDown.has(key)) {
      this._state.keysPressed.add(key);
    }

    this._state.keysDown.add(key);
  }

  /**
   * Handle keyup event.
   */
  private handleKeyUp(e: KeyboardEvent): void {
    if (!this._enabled) return;

    const key = e.code;

    this._state.keysDown.delete(key);
    this._state.keysReleased.add(key);
  }

  /**
   * Handle mousedown event.
   */
  private handleMouseDown(e: MouseEvent): void {
    if (!this._enabled) return;

    if (e.button === 0) {
      this._state.primaryAction = true;
      this._state.keysPressed.add('Mouse0');
      this._state.keysDown.add('Mouse0');
    } else if (e.button === 2) {
      this._state.secondaryAction = true;
      this._state.keysPressed.add('Mouse2');
      this._state.keysDown.add('Mouse2');
    }
  }

  /**
   * Handle mouseup event.
   */
  private handleMouseUp(e: MouseEvent): void {
    if (!this._enabled) return;

    if (e.button === 0) {
      this._state.primaryAction = false;
      this._state.keysDown.delete('Mouse0');
      this._state.keysReleased.add('Mouse0');
    } else if (e.button === 2) {
      this._state.secondaryAction = false;
      this._state.keysDown.delete('Mouse2');
      this._state.keysReleased.add('Mouse2');
    }
  }

  /**
   * Handle mousemove event.
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this._enabled) return;

    // Get position relative to target
    let x = e.clientX;
    let y = e.clientY;

    if (this._target instanceof HTMLElement) {
      const rect = this._target.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    this._state.pointerX = x;
    this._state.pointerY = y;

    // Update aim direction based on pointer position relative to screen center
    this.updateAimDirection();
  }

  /**
   * Handle contextmenu event (prevent right-click menu).
   */
  private handleContextMenu(e: Event): void {
    e.preventDefault();
  }

  /**
   * Handle window blur (clear all inputs).
   */
  private handleBlur(): void {
    this.clearAllState();
  }

  /**
   * Update movement from key states.
   */
  private updateMovement(): void {
    let moveX = 0;
    let moveY = 0;

    // Check movement keys
    const up =
      this.isKeyDown(this._bindings.moveUp) ||
      this.isKeyDown(this._bindings.moveUp2);
    const down =
      this.isKeyDown(this._bindings.moveDown) ||
      this.isKeyDown(this._bindings.moveDown2);
    const left =
      this.isKeyDown(this._bindings.moveLeft) ||
      this.isKeyDown(this._bindings.moveLeft2);
    const right =
      this.isKeyDown(this._bindings.moveRight) ||
      this.isKeyDown(this._bindings.moveRight2);

    if (up) moveY -= 1;
    if (down) moveY += 1;
    if (left) moveX -= 1;
    if (right) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 || moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
    }

    this._state.moveX = moveX;
    this._state.moveY = moveY;
  }

  /**
   * Update aim direction based on pointer position.
   */
  private updateAimDirection(): void {
    // Calculate aim direction from screen center to pointer
    let targetX = this._state.pointerX;
    let targetY = this._state.pointerY;

    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;

    if (this._target instanceof HTMLElement) {
      const rect = this._target.getBoundingClientRect();
      centerX = rect.width / 2;
      centerY = rect.height / 2;
    }

    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > 0) {
      this._state.aimX = dx / length;
      this._state.aimY = dy / length;
    }
  }

  /**
   * Update world pointer position based on camera.
   */
  private updateWorldPointer(): void {
    if (!this._camera) {
      this._state.worldPointerX = this._state.pointerX;
      this._state.worldPointerY = this._state.pointerY;
      return;
    }

    // Get screen center
    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;

    if (this._target instanceof HTMLElement) {
      const rect = this._target.getBoundingClientRect();
      centerX = rect.width / 2;
      centerY = rect.height / 2;
    }

    // Convert screen position to world position
    const screenOffsetX = this._state.pointerX - centerX;
    const screenOffsetY = this._state.pointerY - centerY;

    this._state.worldPointerX = this._camera.x + screenOffsetX / this._camera.zoom;
    this._state.worldPointerY = this._camera.y + screenOffsetY / this._camera.zoom;
  }

  /**
   * Check if key is a game key (should prevent default).
   */
  private isGameKey(key: string): boolean {
    const gameKeys = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'Tab',
    ]);
    return gameKeys.has(key);
  }

  /**
   * Clear all input state.
   */
  private clearAllState(): void {
    this._state.moveX = 0;
    this._state.moveY = 0;
    this._state.primaryAction = false;
    this._state.secondaryAction = false;
    this._state.keysDown.clear();
    this._state.keysPressed.clear();
    this._state.keysReleased.clear();
  }
}
