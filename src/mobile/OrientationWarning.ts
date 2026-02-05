/**
 * OrientationWarning - DOM overlay shown when device is in portrait mode.
 * Uses raw DOM (not Phaser) with high z-index to cover everything.
 */

export class OrientationWarning {
  private overlay: HTMLDivElement;
  private boundCheck: () => void;
  private boundOrientationCheck: () => void;

  constructor() {
    this.boundCheck = () => this.check();
    this.boundOrientationCheck = () => {
      setTimeout(() => this.check(), 100);
    };

    this.overlay = document.createElement('div');
    this.overlay.id = 'orientation-warning';
    this.overlay.innerHTML = `
      <div style="font-size:48px;margin-bottom:16px;">&#x1F504;</div>
      <div style="font-size:20px;font-weight:bold;">Obróć urządzenie</div>
      <div style="font-size:14px;margin-top:8px;opacity:0.7;">Gra wymaga trybu poziomego</div>
    `;

    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      color: '#ffffff',
      display: 'none',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '99999',
      fontFamily: 'monospace',
      textAlign: 'center',
    });

    document.body.appendChild(this.overlay);

    this.check();
    window.addEventListener('resize', this.boundCheck);
    window.addEventListener('orientationchange', this.boundOrientationCheck);
  }

  private check(): void {
    const isPortrait = window.innerHeight > window.innerWidth;
    this.overlay.style.display = isPortrait ? 'flex' : 'none';
  }

  destroy(): void {
    window.removeEventListener('resize', this.boundCheck);
    window.removeEventListener('orientationchange', this.boundOrientationCheck);
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
