/**
 * ECS module exports.
 *
 * Re-exports the World class and related types.
 */

export { World } from './World';

// Re-export bitECS functions that may be needed externally
export {
  defineQuery,
  enterQuery,
  exitQuery,
  Changed,
  Not,
  Types,
  defineComponent,
} from 'bitecs';
