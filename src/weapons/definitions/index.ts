/**
 * Weapon definitions index.
 *
 * Exports all weapon definitions for Cosmic Survivors.
 */

export { MagicWandDefinition } from './MagicWand';
export { KnifeDefinition } from './Knife';
export { GarlicDefinition } from './Garlic';
export { WhipDefinition } from './Whip';
export { FireWandDefinition } from './FireWand';

import { MagicWandDefinition } from './MagicWand';
import { KnifeDefinition } from './Knife';
import { GarlicDefinition } from './Garlic';
import { WhipDefinition } from './Whip';
import { FireWandDefinition } from './FireWand';
import type { IWeaponDefinition } from '../../shared/interfaces/IWeapon';

/**
 * All starter weapon definitions.
 */
export const StarterWeapons: IWeaponDefinition[] = [
  MagicWandDefinition,
  KnifeDefinition,
  GarlicDefinition,
  WhipDefinition,
  FireWandDefinition,
];

/**
 * Map of all weapon definitions by ID.
 */
export const WeaponDefinitionsMap: Map<string, IWeaponDefinition> = new Map([
  [MagicWandDefinition.id, MagicWandDefinition],
  [KnifeDefinition.id, KnifeDefinition],
  [GarlicDefinition.id, GarlicDefinition],
  [WhipDefinition.id, WhipDefinition],
  [FireWandDefinition.id, FireWandDefinition],
]);

/**
 * Get all weapon definitions.
 */
export function getAllWeaponDefinitions(): IWeaponDefinition[] {
  return Array.from(WeaponDefinitionsMap.values());
}

/**
 * Get weapon definition by ID.
 */
export function getWeaponDefinition(id: string): IWeaponDefinition | undefined {
  return WeaponDefinitionsMap.get(id);
}

/**
 * Register a new weapon definition.
 */
export function registerWeaponDefinition(definition: IWeaponDefinition): void {
  WeaponDefinitionsMap.set(definition.id, definition);
}
