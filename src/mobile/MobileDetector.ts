/**
 * MobileDetector - Detects if the device is mobile/touch.
 * Supports URL override: ?mobile=1 / ?mobile=0
 */

export function isMobile(): boolean {
  // URL override
  const params = new URLSearchParams(window.location.search);
  const override = params.get('mobile');
  if (override === '1') return true;
  if (override === '0') return false;

  // Touch detection
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // User agent check for common mobile devices
  const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  return hasTouch && mobileUA;
}

export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}
