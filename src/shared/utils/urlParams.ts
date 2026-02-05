/**
 * URL parameter utilities for game configuration.
 */

export function getGameMode(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') || 'standard';
}

export function getDifficultyParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('difficulty');
}
