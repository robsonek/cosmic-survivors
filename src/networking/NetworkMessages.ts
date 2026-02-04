/**
 * Network message encoding/decoding for Cosmic Survivors.
 * Provides efficient binary serialization for network messages.
 */

import { NetMessageType, INetworkInput, INetworkEntityState, IStateSnapshot, IStateDelta } from '../shared/interfaces/INetworking';
import type { EntityId } from '../shared/interfaces/IWorld';

/**
 * Float precision for position/velocity encoding.
 */
const VELOCITY_PRECISION = 100;
const ROTATION_PRECISION = 1000;

/**
 * Message registry for type safety.
 */
export interface IMessageTypeMap {
  [NetMessageType.PlayerInput]: INetworkInput;
  [NetMessageType.PlayerPosition]: INetworkEntityState;
  [NetMessageType.StateSnapshot]: IStateSnapshot;
  [NetMessageType.StateDelta]: IStateDelta;
  [NetMessageType.WeaponFire]: IWeaponFireMessage;
  [NetMessageType.DamageDealt]: IDamageMessage;
  [NetMessageType.EntityKilled]: IEntityKilledMessage;
  [NetMessageType.XPCollected]: IXPCollectedMessage;
  [NetMessageType.WaveStart]: IWaveStartMessage;
  [NetMessageType.WaveEnd]: IWaveEndMessage;
  [NetMessageType.BossSpawn]: IBossSpawnMessage;
  [NetMessageType.UpgradeSelected]: IUpgradeSelectedMessage;
  [NetMessageType.LevelUp]: ILevelUpMessage;
  [NetMessageType.StartMatch]: IStartMatchMessage;
  [NetMessageType.PauseMatch]: IPauseMatchMessage;
  [NetMessageType.EndMatch]: IEndMatchMessage;
  [NetMessageType.PlayerReady]: IPlayerReadyMessage;
}

/**
 * Weapon fire message.
 */
export interface IWeaponFireMessage {
  entity: EntityId;
  weaponId: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  tick: number;
}

/**
 * Damage dealt message.
 */
export interface IDamageMessage {
  source: EntityId;
  target: EntityId;
  amount: number;
  damageType: number;
  isCritical: boolean;
  tick: number;
}

/**
 * Entity killed message.
 */
export interface IEntityKilledMessage {
  entity: EntityId;
  killer: EntityId;
  xpValue: number;
  x: number;
  y: number;
  tick: number;
}

/**
 * XP collected message.
 */
export interface IXPCollectedMessage {
  player: EntityId;
  amount: number;
  totalXP: number;
  tick: number;
}

/**
 * Wave start message.
 */
export interface IWaveStartMessage {
  waveNumber: number;
  enemyTypes: number[];
  totalEnemies: number;
  duration: number;
}

/**
 * Wave end message.
 */
export interface IWaveEndMessage {
  waveNumber: number;
  enemiesKilled: number;
  timeElapsed: number;
  bonusXP: number;
}

/**
 * Boss spawn message.
 */
export interface IBossSpawnMessage {
  bossType: number;
  entity: EntityId;
  x: number;
  y: number;
  health: number;
}

/**
 * Upgrade selected message.
 */
export interface IUpgradeSelectedMessage {
  player: EntityId;
  upgradeId: number;
  upgradeType: number;
  tick: number;
}

/**
 * Level up message.
 */
export interface ILevelUpMessage {
  player: EntityId;
  newLevel: number;
  upgradeChoices: number[];
}

/**
 * Start match message.
 */
export interface IStartMatchMessage {
  matchId: string;
  seed: number;
  tick: number;
}

/**
 * Pause match message.
 */
export interface IPauseMatchMessage {
  paused: boolean;
  tick: number;
}

/**
 * End match message.
 */
export interface IEndMatchMessage {
  reason: number; // 0=win, 1=lose, 2=timeout, 3=disconnect
  stats: {
    duration: number;
    totalKills: number;
    totalXP: number;
    waveReached: number;
  };
}

/**
 * Player ready message.
 */
export interface IPlayerReadyMessage {
  playerId: string;
  ready: boolean;
  characterId: number;
}

/**
 * NetworkMessages - Message encoding/decoding utilities.
 */
export class NetworkMessages {
  private static textEncoder = new TextEncoder();
  private static textDecoder = new TextDecoder();

  /**
   * Encode a message to binary format.
   */
  static encode(type: NetMessageType, data: unknown): Uint8Array {
    switch (type) {
      case NetMessageType.PlayerInput:
        return this.encodePlayerInput(data as INetworkInput);
      case NetMessageType.PlayerPosition:
        return this.encodeEntityState(data as INetworkEntityState);
      case NetMessageType.StateSnapshot:
        return this.encodeStateSnapshot(data as IStateSnapshot);
      case NetMessageType.StateDelta:
        return this.encodeStateDelta(data as IStateDelta);
      default:
        // For other messages, use JSON encoding
        return this.encodeJSON(data);
    }
  }

  /**
   * Decode a message from binary format.
   */
  static decode<T = unknown>(type: NetMessageType, data: Uint8Array): T {
    switch (type) {
      case NetMessageType.PlayerInput:
        return this.decodePlayerInput(data) as T;
      case NetMessageType.PlayerPosition:
        return this.decodeEntityState(data) as T;
      case NetMessageType.StateSnapshot:
        return this.decodeStateSnapshot(data) as T;
      case NetMessageType.StateDelta:
        return this.decodeStateDelta(data) as T;
      default:
        // For other messages, use JSON decoding
        return this.decodeJSON(data);
    }
  }

  /**
   * Encode player input (highly optimized binary format).
   * Format: tick(4) + moveX(2) + moveY(2) + aimX(2) + aimY(2) + actions(1) = 13 bytes
   */
  private static encodePlayerInput(input: INetworkInput): Uint8Array {
    const buffer = new ArrayBuffer(13);
    const view = new DataView(buffer);

    view.setUint32(0, input.tick, true);
    view.setInt16(4, Math.round(input.moveX * 32767), true); // -1 to 1 as int16
    view.setInt16(6, Math.round(input.moveY * 32767), true);
    view.setInt16(8, Math.round(input.aimX * 32767), true);
    view.setInt16(10, Math.round(input.aimY * 32767), true);
    view.setUint8(12, input.actions);

    return new Uint8Array(buffer);
  }

  /**
   * Decode player input.
   */
  private static decodePlayerInput(data: Uint8Array): INetworkInput {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    return {
      tick: view.getUint32(0, true),
      moveX: view.getInt16(4, true) / 32767,
      moveY: view.getInt16(6, true) / 32767,
      aimX: view.getInt16(8, true) / 32767,
      aimY: view.getInt16(10, true) / 32767,
      actions: view.getUint8(12),
    };
  }

  /**
   * Encode entity state.
   * Format: entity(4) + x(4) + y(4) + vx(2) + vy(2) + health(2) + rotation(2) + state(1) = 21 bytes
   */
  private static encodeEntityState(state: INetworkEntityState): Uint8Array {
    const buffer = new ArrayBuffer(21);
    const view = new DataView(buffer);

    view.setUint32(0, state.entity, true);
    view.setFloat32(4, state.x, true);
    view.setFloat32(8, state.y, true);
    view.setInt16(12, Math.round(state.velocityX * VELOCITY_PRECISION), true);
    view.setInt16(14, Math.round(state.velocityY * VELOCITY_PRECISION), true);
    view.setUint16(16, Math.round((state.health ?? 100) * 10), true); // 0.1 precision
    view.setInt16(18, Math.round((state.rotation ?? 0) * ROTATION_PRECISION), true);
    view.setUint8(20, state.state ?? 0);

    return new Uint8Array(buffer);
  }

  /**
   * Decode entity state.
   */
  private static decodeEntityState(data: Uint8Array): INetworkEntityState {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    return {
      entity: view.getUint32(0, true),
      x: view.getFloat32(4, true),
      y: view.getFloat32(8, true),
      velocityX: view.getInt16(12, true) / VELOCITY_PRECISION,
      velocityY: view.getInt16(14, true) / VELOCITY_PRECISION,
      health: view.getUint16(16, true) / 10,
      rotation: view.getInt16(18, true) / ROTATION_PRECISION,
      state: view.getUint8(20),
    };
  }

  /**
   * Encode state snapshot.
   * Header: tick(4) + timestamp(8) + waveNumber(2) + entityCount(2) + xpOrbCount(2)
   * Then: entities + xpOrbs
   */
  private static encodeStateSnapshot(snapshot: IStateSnapshot): Uint8Array {
    const entityCount = snapshot.entities.length;
    const xpOrbCount = snapshot.xpOrbs.length;

    // Calculate total size
    const headerSize = 18;
    const entitySize = 21;
    const xpOrbSize = 12; // x(4) + y(4) + value(4)
    const totalSize = headerSize + (entityCount * entitySize) + (xpOrbCount * xpOrbSize);

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Header
    view.setUint32(offset, snapshot.tick, true); offset += 4;
    view.setFloat64(offset, snapshot.timestamp, true); offset += 8;
    view.setUint16(offset, snapshot.waveNumber, true); offset += 2;
    view.setUint16(offset, entityCount, true); offset += 2;
    view.setUint16(offset, xpOrbCount, true); offset += 2;

    // Entities
    for (const entity of snapshot.entities) {
      const entityData = this.encodeEntityState(entity);
      new Uint8Array(buffer, offset, entitySize).set(entityData);
      offset += entitySize;
    }

    // XP Orbs
    for (const orb of snapshot.xpOrbs) {
      view.setFloat32(offset, orb.x, true); offset += 4;
      view.setFloat32(offset, orb.y, true); offset += 4;
      view.setUint32(offset, orb.value, true); offset += 4;
    }

    return new Uint8Array(buffer);
  }

  /**
   * Decode state snapshot.
   */
  private static decodeStateSnapshot(data: Uint8Array): IStateSnapshot {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // Header
    const tick = view.getUint32(offset, true); offset += 4;
    const timestamp = view.getFloat64(offset, true); offset += 8;
    const waveNumber = view.getUint16(offset, true); offset += 2;
    const entityCount = view.getUint16(offset, true); offset += 2;
    const xpOrbCount = view.getUint16(offset, true); offset += 2;

    // Entities
    const entities: INetworkEntityState[] = [];
    const entitySize = 21;
    for (let i = 0; i < entityCount; i++) {
      const entityData = new Uint8Array(data.buffer, data.byteOffset + offset, entitySize);
      entities.push(this.decodeEntityState(entityData));
      offset += entitySize;
    }

    // XP Orbs
    const xpOrbs: Array<{ x: number; y: number; value: number }> = [];
    for (let i = 0; i < xpOrbCount; i++) {
      xpOrbs.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        value: view.getUint32(offset + 8, true),
      });
      offset += 12;
    }

    return { tick, timestamp, entities, waveNumber, xpOrbs };
  }

  /**
   * Encode state delta.
   * Header: tick(4) + timestamp(8) + addedCount(2) + updatedCount(2) + removedCount(2)
   * Then: added entities + updated (entity + change flags + changed values) + removed entity IDs
   */
  private static encodeStateDelta(delta: IStateDelta): Uint8Array {
    // For delta compression, we use a more complex format
    // This is a simplified version - real implementation would use bit flags for changed fields
    const json = JSON.stringify({
      tick: delta.tick,
      timestamp: delta.timestamp,
      added: delta.added,
      updated: delta.updated,
      removed: delta.removed,
    });

    const encoded = this.textEncoder.encode(json);
    const result = new Uint8Array(encoded.length + 1);
    result[0] = 0x01; // Version/flag byte indicating JSON encoding
    result.set(encoded, 1);
    return result;
  }

  /**
   * Decode state delta.
   */
  private static decodeStateDelta(data: Uint8Array): IStateDelta {
    // Check version byte
    if (data[0] === 0x01) {
      const json = this.textDecoder.decode(data.subarray(1));
      return JSON.parse(json);
    }
    throw new Error('Unknown delta format version');
  }

  /**
   * Encode any message as JSON (fallback).
   */
  private static encodeJSON<T>(data: T): Uint8Array {
    const json = JSON.stringify(data);
    const encoded = this.textEncoder.encode(json);
    return encoded;
  }

  /**
   * Decode JSON message.
   */
  private static decodeJSON<T>(data: Uint8Array): T {
    const json = this.textDecoder.decode(data);
    return JSON.parse(json);
  }

  /**
   * Compress data using simple RLE for repeated values.
   */
  static compress(data: Uint8Array): Uint8Array {
    // Simple compression - for production, use a proper compression library
    // This is a placeholder that just returns the original data
    // In real implementation, consider using pako (zlib) or lz4
    return data;
  }

  /**
   * Decompress data.
   */
  static decompress(data: Uint8Array): Uint8Array {
    // Matching decompression
    return data;
  }

  /**
   * Calculate checksum for data integrity.
   */
  static checksum(data: Uint8Array): number {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return hash >>> 0;
  }

  /**
   * Create a packet with header for reliable transport.
   */
  static createPacket(type: NetMessageType, data: Uint8Array, sequenceNumber: number): Uint8Array {
    const packet = new Uint8Array(8 + data.length);
    const view = new DataView(packet.buffer);

    view.setUint16(0, type, true);
    view.setUint16(2, data.length, true);
    view.setUint32(4, sequenceNumber, true);
    packet.set(data, 8);

    return packet;
  }

  /**
   * Parse a packet header.
   */
  static parsePacketHeader(packet: Uint8Array): { type: NetMessageType; length: number; sequence: number } {
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);

    return {
      type: view.getUint16(0, true) as NetMessageType,
      length: view.getUint16(2, true),
      sequence: view.getUint32(4, true),
    };
  }

  /**
   * Get packet data (without header).
   */
  static getPacketData(packet: Uint8Array): Uint8Array {
    return packet.subarray(8);
  }
}
