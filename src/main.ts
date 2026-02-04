/**
 * Cosmic Survivors - Main Entry Point
 *
 * Bullet Heaven / Roguelite multiplayer game
 */

import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

// Hide loading screen when game starts
function hideLoading(): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
  }
}

// Show error on screen
function showError(message: string): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `
      <div style="color: #ff4444;">ERROR</div>
      <div style="font-size: 14px; margin-top: 10px; color: #ff8888;">${message}</div>
    `;
  }
}

// Main entry point
function main(): void {
  console.log('🚀 Cosmic Survivors starting...');

  try {
    // Phaser game configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      parent: 'game-container',
      backgroundColor: '#0a0a1a',
      physics: {
        default: 'arcade',
        arcade: {
          debug: import.meta.env.DEV,
        },
      },
      scene: [GameScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    // Create Phaser game
    const game = new Phaser.Game(config);

    // Hide loading when first scene starts
    game.events.once('ready', () => {
      hideLoading();
      console.log('✅ Cosmic Survivors initialized!');
    });

    // Expose game to window for debugging
    if (import.meta.env.DEV) {
      (window as unknown as { game: Phaser.Game }).game = game;
      console.log('🎮 Game instance available as window.game');
    }
  } catch (error) {
    console.error('❌ Failed to start game:', error);
    showError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
