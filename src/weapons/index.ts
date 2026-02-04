/**
 * Weapons module exports.
 *
 * Provides weapon factory and definitions for Cosmic Survivors.
 */

export { WeaponFactory } from './WeaponFactory';

// Re-export definitions
export {
  MagicWandDefinition,
  KnifeDefinition,
  GarlicDefinition,
  WhipDefinition,
  FireWandDefinition,
  StarterWeapons,
  WeaponDefinitionsMap,
  getAllWeaponDefinitions,
  getWeaponDefinition,
  registerWeaponDefinition,
} from './definitions';
