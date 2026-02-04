/**
 * Client-side Prediction for Cosmic Survivors.
 * Handles input prediction, state reconciliation, and rollback.
 */

import { IPrediction, INetworkInput, INetworkEntityState } from '../shared/interfaces/INetworking';
import type { EntityId } from '../shared/interfaces/IWorld';

/**
 * Maximum number of prediction frames to store.
 */
const MAX_PREDICTION_FRAMES = 10;

/**
 * Input buffer size.
 */
const INPUT_BUFFER_SIZE = 32;

/**
 * Default player movement speed (units per tick).
 */
const DEFAULT_MOVE_SPEED = 5;

/**
 * Stored input with predicted state.
 */
interface IStoredInput {
  tick: number;
  input: INetworkInput;
  predictedState: {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
  };
}

/**
 * Entity prediction state.
 */
interface IEntityPrediction {
  entity: EntityId;
  inputs: Map<number, IStoredInput>;
  lastServerState: INetworkEntityState | null;
  lastServerTick: number;
  currentState: {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
  };
  moveSpeed: number;
}

/**
 * Prediction - Client-side prediction system.
 */
export class Prediction implements IPrediction {
  private entities: Map<EntityId, IEntityPrediction> = new Map();
  private localEntity: EntityId | null = null;
  private currentTick: number = 0;

  // Configuration
  private readonly maxPredictionFrames: number;
  private readonly inputBufferSize: number;
  private readonly reconciliationThreshold: number;

  constructor(config: {
    maxPredictionFrames?: number;
    inputBufferSize?: number;
    reconciliationThreshold?: number;
  } = {}) {
    this.maxPredictionFrames = config.maxPredictionFrames ?? MAX_PREDICTION_FRAMES;
    this.inputBufferSize = config.inputBufferSize ?? INPUT_BUFFER_SIZE;
    this.reconciliationThreshold = config.reconciliationThreshold ?? 0.1; // Position error threshold
  }

  /**
   * Set the local player entity.
   */
  setLocalEntity(entity: EntityId, initialState?: { x: number; y: number; moveSpeed?: number }): void {
    this.localEntity = entity;

    if (!this.entities.has(entity)) {
      this.entities.set(entity, {
        entity,
        inputs: new Map(),
        lastServerState: null,
        lastServerTick: 0,
        currentState: {
          x: initialState?.x ?? 0,
          y: initialState?.y ?? 0,
          velocityX: 0,
          velocityY: 0,
        },
        moveSpeed: initialState?.moveSpeed ?? DEFAULT_MOVE_SPEED,
      });
    }
  }

  /**
   * Update current tick.
   */
  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Store input for prediction.
   */
  storeInput(tick: number, input: INetworkInput): void {
    if (this.localEntity === null) {
      console.warn('Prediction: No local entity set');
      return;
    }

    const entityPrediction = this.entities.get(this.localEntity);
    if (!entityPrediction) {
      console.warn('Prediction: Local entity not found in prediction map');
      return;
    }

    // Predict the new state based on input
    const predictedState = this.applyInput(entityPrediction.currentState, input, entityPrediction.moveSpeed);

    // Store input and predicted state
    entityPrediction.inputs.set(tick, {
      tick,
      input,
      predictedState: { ...predictedState },
    });

    // Update current state
    entityPrediction.currentState = predictedState;

    // Clean up old inputs
    this.cleanupOldInputs(entityPrediction, tick - this.inputBufferSize);
  }

  /**
   * Get predicted position based on stored inputs.
   */
  predictPosition(entity: EntityId, _currentTick: number): { x: number; y: number } {
    const entityPrediction = this.entities.get(entity);
    if (!entityPrediction) {
      return { x: 0, y: 0 };
    }

    return {
      x: entityPrediction.currentState.x,
      y: entityPrediction.currentState.y,
    };
  }

  /**
   * Get full predicted state including velocity.
   */
  getPredictedState(entity: EntityId): INetworkEntityState | null {
    const entityPrediction = this.entities.get(entity);
    if (!entityPrediction) {
      return null;
    }

    return {
      entity,
      x: entityPrediction.currentState.x,
      y: entityPrediction.currentState.y,
      velocityX: entityPrediction.currentState.velocityX,
      velocityY: entityPrediction.currentState.velocityY,
    };
  }

  /**
   * Reconcile with server state.
   * If there's a significant difference, rollback and replay inputs.
   */
  reconcile(serverTick: number, serverState: INetworkEntityState): void {
    const entityPrediction = this.entities.get(serverState.entity);
    if (!entityPrediction) {
      // Create new prediction entry for this entity
      this.entities.set(serverState.entity, {
        entity: serverState.entity,
        inputs: new Map(),
        lastServerState: serverState,
        lastServerTick: serverTick,
        currentState: {
          x: serverState.x,
          y: serverState.y,
          velocityX: serverState.velocityX,
          velocityY: serverState.velocityY,
        },
        moveSpeed: DEFAULT_MOVE_SPEED,
      });
      return;
    }

    // Store last server state
    entityPrediction.lastServerState = serverState;
    entityPrediction.lastServerTick = serverTick;

    // Check if this is the local entity
    if (serverState.entity !== this.localEntity) {
      // For remote entities, just update the state directly
      entityPrediction.currentState = {
        x: serverState.x,
        y: serverState.y,
        velocityX: serverState.velocityX,
        velocityY: serverState.velocityY,
      };
      return;
    }

    // Get the predicted state for the server tick
    const storedInput = entityPrediction.inputs.get(serverTick);
    if (!storedInput) {
      // No stored input for this tick, just accept server state
      entityPrediction.currentState = {
        x: serverState.x,
        y: serverState.y,
        velocityX: serverState.velocityX,
        velocityY: serverState.velocityY,
      };
      return;
    }

    // Calculate prediction error
    const dx = storedInput.predictedState.x - serverState.x;
    const dy = storedInput.predictedState.y - serverState.y;
    const error = Math.sqrt(dx * dx + dy * dy);

    // If error is below threshold, prediction was correct
    if (error < this.reconciliationThreshold) {
      // Clear inputs up to server tick
      this.clearOldInputs(serverTick);
      return;
    }

    // Prediction error detected - perform rollback and replay
    console.log(`Prediction: Reconciliation needed, error=${error.toFixed(3)}`);
    this.rollbackAndReplay(entityPrediction, serverTick, serverState);
  }

  /**
   * Rollback to server state and replay all inputs since then.
   */
  private rollbackAndReplay(
    entityPrediction: IEntityPrediction,
    serverTick: number,
    serverState: INetworkEntityState
  ): void {
    // Start from server state
    let state = {
      x: serverState.x,
      y: serverState.y,
      velocityX: serverState.velocityX,
      velocityY: serverState.velocityY,
    };

    // Get all inputs after server tick
    const inputsToReplay: IStoredInput[] = [];
    for (const [tick, input] of entityPrediction.inputs) {
      if (tick > serverTick) {
        inputsToReplay.push(input);
      }
    }

    // Sort by tick
    inputsToReplay.sort((a, b) => a.tick - b.tick);

    // Limit replay to max prediction frames
    const replayInputs = inputsToReplay.slice(0, this.maxPredictionFrames);

    // Replay inputs
    for (const storedInput of replayInputs) {
      state = this.applyInput(state, storedInput.input, entityPrediction.moveSpeed);

      // Update stored predicted state
      storedInput.predictedState = { ...state };
    }

    // Update current state
    entityPrediction.currentState = state;

    // Clear old inputs
    this.clearOldInputs(serverTick);
  }

  /**
   * Apply input to state and return new state.
   */
  private applyInput(
    state: { x: number; y: number; velocityX: number; velocityY: number },
    input: INetworkInput,
    moveSpeed: number
  ): { x: number; y: number; velocityX: number; velocityY: number } {
    // Calculate velocity from input
    const velocityX = input.moveX * moveSpeed;
    const velocityY = input.moveY * moveSpeed;

    // Apply velocity to position (assuming 1/20 second per tick at 20Hz)
    const dt = 1 / 20;
    const newX = state.x + velocityX * dt;
    const newY = state.y + velocityY * dt;

    return {
      x: newX,
      y: newY,
      velocityX,
      velocityY,
    };
  }

  /**
   * Clear old inputs before a tick.
   */
  clearOldInputs(beforeTick: number): void {
    if (this.localEntity === null) return;

    const entityPrediction = this.entities.get(this.localEntity);
    if (!entityPrediction) return;

    this.cleanupOldInputs(entityPrediction, beforeTick);
  }

  /**
   * Clean up old inputs from entity prediction.
   */
  private cleanupOldInputs(entityPrediction: IEntityPrediction, beforeTick: number): void {
    for (const tick of entityPrediction.inputs.keys()) {
      if (tick < beforeTick) {
        entityPrediction.inputs.delete(tick);
      }
    }
  }

  /**
   * Get input history for debugging.
   */
  getInputHistory(entity?: EntityId): IStoredInput[] {
    const targetEntity = entity ?? this.localEntity;
    if (targetEntity === null) return [];

    const entityPrediction = this.entities.get(targetEntity);
    if (!entityPrediction) return [];

    return Array.from(entityPrediction.inputs.values())
      .sort((a, b) => a.tick - b.tick);
  }

  /**
   * Get prediction statistics.
   */
  getStats(): {
    entityCount: number;
    localEntity: EntityId | null;
    inputsStored: number;
    lastServerTick: number;
    currentTick: number;
  } {
    const localPrediction = this.localEntity !== null
      ? this.entities.get(this.localEntity)
      : null;

    return {
      entityCount: this.entities.size,
      localEntity: this.localEntity,
      inputsStored: localPrediction?.inputs.size ?? 0,
      lastServerTick: localPrediction?.lastServerTick ?? 0,
      currentTick: this.currentTick,
    };
  }

  /**
   * Remove entity from prediction system.
   */
  removeEntity(entity: EntityId): void {
    this.entities.delete(entity);
    if (this.localEntity === entity) {
      this.localEntity = null;
    }
  }

  /**
   * Clear all prediction data.
   */
  clear(): void {
    this.entities.clear();
    this.localEntity = null;
    this.currentTick = 0;
  }

  /**
   * Set entity move speed.
   */
  setEntityMoveSpeed(entity: EntityId, speed: number): void {
    const entityPrediction = this.entities.get(entity);
    if (entityPrediction) {
      entityPrediction.moveSpeed = speed;
    }
  }

  /**
   * Check if we have stored input for a tick.
   */
  hasInputForTick(tick: number): boolean {
    if (this.localEntity === null) return false;

    const entityPrediction = this.entities.get(this.localEntity);
    return entityPrediction?.inputs.has(tick) ?? false;
  }

  /**
   * Get stored input for a tick.
   */
  getInputForTick(tick: number): INetworkInput | null {
    if (this.localEntity === null) return null;

    const entityPrediction = this.entities.get(this.localEntity);
    return entityPrediction?.inputs.get(tick)?.input ?? null;
  }
}
