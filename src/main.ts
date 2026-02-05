/**
 * Cosmic Survivors - Main Entry Point
 *
 * Bullet Heaven / Roguelite multiplayer game
 */

import * as Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { isMobile } from './mobile/MobileDetector';

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
    const mobile = isMobile();

    // Phaser game configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: mobile ? window.innerWidth : 1280,
      height: mobile ? window.innerHeight : 720,
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
        mode: mobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: mobile ? '100%' : 1280,
        height: mobile ? '100%' : 720,
      },
      input: {
        touch: {
          capture: true,
        },
      },
    };

    // Create Phaser game
    const game = new Phaser.Game(config);

    // Hide loading when first scene starts
    game.events.once('ready', () => {
      hideLoading();
      console.log('✅ Cosmic Survivors initialized!');
    });

    // On mobile, request fullscreen on first touch to hide browser chrome
    if (mobile) {
      const requestFullscreen = () => {
        const doc = document.documentElement;
        const requestFS = doc.requestFullscreen
          || (doc as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
        if (requestFS) {
          requestFS.call(doc).catch(() => {
            // Fullscreen denied - scroll to hide address bar as fallback
            window.scrollTo(0, 1);
          });
        }
        document.removeEventListener('touchstart', requestFullscreen);
      };
      document.addEventListener('touchstart', requestFullscreen, { once: true });

      // Also try to lock orientation to landscape
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (orientation?.lock) {
        orientation.lock('landscape').catch(() => {
          // Orientation lock not supported - OrientationWarning handles this
        });
      }
    }

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
