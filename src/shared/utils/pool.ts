/**
 * Object pool for recycling frequently created objects.
 * Reduces garbage collection pressure.
 */

export interface IPoolable {
  /** Reset object to initial state */
  reset(): void;
}

export class ObjectPool<T extends IPoolable> {
  private pool: T[] = [];
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize = 0, maxSize = 1000) {
    this.factory = factory;
    this.maxSize = maxSize;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /**
   * Get object from pool or create new one.
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /**
   * Return object to pool.
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      obj.reset();
      this.pool.push(obj);
    }
  }

  /**
   * Clear the pool.
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get current pool size.
   */
  get size(): number {
    return this.pool.length;
  }
}

/**
 * Simple vector class that can be pooled.
 */
export class Vec2 implements IPoolable {
  x: number = 0;
  y: number = 0;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: { x: number; y: number }): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v: { x: number; y: number }): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: { x: number; y: number }): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  normalize(): this {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  dot(v: { x: number; y: number }): number {
    return this.x * v.x + this.y * v.y;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}

// Global vector pool
const vecPool = new ObjectPool(() => new Vec2(), 100, 500);

/**
 * Get a vector from pool.
 */
export function vec2(x = 0, y = 0): Vec2 {
  return vecPool.acquire().set(x, y);
}

/**
 * Release vector back to pool.
 */
export function releaseVec2(v: Vec2): void {
  vecPool.release(v);
}

/**
 * Ring buffer for fixed-size FIFO storage.
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private _size = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add item to buffer.
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this._size < this.capacity) {
      this._size++;
    } else {
      // Overwriting oldest item
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Remove and return oldest item.
   */
  shift(): T | undefined {
    if (this._size === 0) return undefined;

    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this._size--;

    return item;
  }

  /**
   * Get item at index (0 = oldest).
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._size) return undefined;
    return this.buffer[(this.head + index) % this.capacity];
  }

  /**
   * Get most recent item.
   */
  latest(): T | undefined {
    if (this._size === 0) return undefined;
    return this.buffer[(this.tail - 1 + this.capacity) % this.capacity];
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this._size = 0;
  }

  get size(): number {
    return this._size;
  }

  get isEmpty(): boolean {
    return this._size === 0;
  }

  get isFull(): boolean {
    return this._size === this.capacity;
  }

  /**
   * Iterate over all items (oldest first).
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this._size; i++) {
      yield this.get(i)!;
    }
  }
}
