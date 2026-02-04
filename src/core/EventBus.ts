/**
 * EventBus - Central event system for decoupled communication.
 *
 * Provides typed, publish/subscribe event handling with support for:
 * - One-time subscriptions
 * - Delayed emission
 * - Multiple handlers per event
 */

import type { IEventBus, EventHandler, ISubscription } from '@shared/interfaces/IEventBus';

/**
 * Internal handler entry with metadata.
 */
interface HandlerEntry<T = unknown> {
  handler: EventHandler<T>;
  once: boolean;
}

/**
 * EventBus implementation for Cosmic Survivors.
 */
export class EventBus implements IEventBus {
  /** Map of event names to handler entries */
  private handlers: Map<string, HandlerEntry[]> = new Map();

  /** Active delayed emission timeouts */
  private delayedEmits: Set<number> = new Set();

  /**
   * Subscribe to an event.
   * @param event Event name
   * @param handler Handler function
   * @returns Subscription handle for unsubscribing
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): ISubscription {
    return this.addHandler(event, handler, false);
  }

  /**
   * Subscribe to an event (fires only once).
   * @param event Event name
   * @param handler Handler function
   * @returns Subscription handle for unsubscribing
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): ISubscription {
    return this.addHandler(event, handler, true);
  }

  /**
   * Unsubscribe from an event.
   * @param event Event name
   * @param handler Handler function to remove
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const entries = this.handlers.get(event);
    if (!entries) return;

    const index = entries.findIndex(entry => entry.handler === handler);
    if (index !== -1) {
      entries.splice(index, 1);
      if (entries.length === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Emit an event synchronously.
   * @param event Event name
   * @param data Event data
   */
  emit<T = unknown>(event: string, data: T): void {
    const entries = this.handlers.get(event);
    if (!entries) return;

    // Create a copy to safely iterate (handlers might unsubscribe during emit)
    const entriesCopy = [...entries];
    const toRemove: HandlerEntry[] = [];

    for (const entry of entriesCopy) {
      try {
        entry.handler(data);
        if (entry.once) {
          toRemove.push(entry);
        }
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    }

    // Remove one-time handlers
    for (const entry of toRemove) {
      const idx = entries.indexOf(entry);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
    }

    if (entries.length === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * Emit an event with delay.
   * @param event Event name
   * @param data Event data
   * @param delayMs Delay in milliseconds
   */
  emitDelayed<T = unknown>(event: string, data: T, delayMs: number): void {
    const timeoutId = window.setTimeout(() => {
      this.delayedEmits.delete(timeoutId);
      this.emit(event, data);
    }, delayMs);

    this.delayedEmits.add(timeoutId);
  }

  /**
   * Remove all handlers for an event.
   * @param event Event name
   */
  clear(event: string): void {
    this.handlers.delete(event);
  }

  /**
   * Remove all handlers for all events and cancel pending delayed emits.
   */
  clearAll(): void {
    this.handlers.clear();

    // Cancel all pending delayed emits
    for (const timeoutId of this.delayedEmits) {
      window.clearTimeout(timeoutId);
    }
    this.delayedEmits.clear();
  }

  /**
   * Check if event has any handlers.
   * @param event Event name
   * @returns True if event has handlers
   */
  hasHandlers(event: string): boolean {
    const entries = this.handlers.get(event);
    return entries !== undefined && entries.length > 0;
  }

  /**
   * Get the number of handlers for an event.
   * @param event Event name
   * @returns Number of handlers
   */
  getHandlerCount(event: string): number {
    const entries = this.handlers.get(event);
    return entries ? entries.length : 0;
  }

  /**
   * Get all registered event names.
   * @returns Array of event names
   */
  getEventNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Add a handler entry for an event.
   */
  private addHandler<T>(
    event: string,
    handler: EventHandler<T>,
    once: boolean
  ): ISubscription {
    let entries = this.handlers.get(event);
    if (!entries) {
      entries = [];
      this.handlers.set(event, entries);
    }

    const entry: HandlerEntry = { handler: handler as EventHandler, once };
    entries.push(entry);

    // Return subscription handle
    return {
      unsubscribe: () => {
        this.off(event, handler);
      },
    };
  }
}
