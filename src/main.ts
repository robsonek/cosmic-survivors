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

/**
 * Check if running as installed PWA (standalone mode).
 * In standalone mode the browser chrome is already hidden.
 */
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Request fullscreen + orientation lock.
 * Returns a promise that resolves when done (or fails silently).
 */
async function enterFullscreen(): Promise<void> {
  // Try Fullscreen API (works on Android Chrome, not iOS Safari)
  const doc = document.documentElement;
  const requestFS = doc.requestFullscreen
    || (doc as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;

  if (requestFS) {
    try {
      await requestFS.call(doc);
    } catch {
      // Fullscreen denied — fallback: scroll to hide address bar
      window.scrollTo(0, 1);
    }
  } else {
    // No Fullscreen API (iOS Safari) — scroll trick
    window.scrollTo(0, 1);
  }

  // Try to lock orientation to landscape
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  if (orientation?.lock) {
    orientation.lock('landscape').catch(() => {
      // Orientation lock not supported
    });
  }
}

/**
 * Show the mobile splash screen overlay.
 * Waits for user tap, then enters fullscreen and starts the game.
 */
function showMobileSplash(): Promise<void> {
  return new Promise((resolve) => {
    const splash = document.getElementById('mobile-splash');
    if (!splash) { resolve(); return; }

    splash.style.display = 'flex';

    // Hide the loading text underneath
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    const onTap = async () => {
      splash.removeEventListener('touchstart', onTap);
      splash.removeEventListener('click', onTap);

      // Enter fullscreen from this user gesture
      await enterFullscreen();

      // Hide splash
      splash.style.display = 'none';

      resolve();
    };

    splash.addEventListener('touchstart', onTap, { once: true, passive: true });
    splash.addEventListener('click', onTap, { once: true });
  });
}

// Main entry point
async function main(): Promise<void> {
  console.log('🚀 Cosmic Survivors starting...');

  try {
    const mobile = isMobile();

    // On mobile: show splash overlay to get user gesture for fullscreen
    // Skip splash if already in standalone PWA mode (no browser chrome)
    if (mobile && !isStandalone()) {
      await showMobileSplash();
    }

    // Phaser game configuration
    const gameWidth = mobile ? window.innerWidth : 1280;
    const gameHeight = mobile ? window.innerHeight : 720;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: gameWidth,
      height: gameHeight,
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
        width: gameWidth,
        height: gameHeight,
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

    // Re-enter fullscreen if user exits it (e.g. swipe down on Android)
    if (mobile) {
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
          // Show a small "tap to go fullscreen" button
          showFullscreenButton();
        } else {
          hideFullscreenButton();
        }
      });
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

/**
 * Small floating button to re-enter fullscreen after exiting.
 */
function showFullscreenButton(): void {
  if (document.getElementById('fs-btn')) return;
  const btn = document.createElement('div');
  btn.id = 'fs-btn';
  btn.textContent = '⛶';
  Object.assign(btn.style, {
    position: 'fixed',
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '40px',
    height: '40px',
    lineHeight: '40px',
    textAlign: 'center',
    fontSize: '24px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#00ffff',
    borderRadius: '8px',
    zIndex: '100001',
    cursor: 'pointer',
    border: '1px solid rgba(0,255,255,0.3)',
  });
  btn.addEventListener('touchstart', async (e) => {
    e.preventDefault();
    await enterFullscreen();
  }, { once: true, passive: false });
  btn.addEventListener('click', async () => {
    await enterFullscreen();
  }, { once: true });
  document.body.appendChild(btn);
}

function hideFullscreenButton(): void {
  const btn = document.getElementById('fs-btn');
  if (btn) btn.remove();
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
