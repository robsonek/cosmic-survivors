/**
 * AssetLoader - Asset loading and management system.
 *
 * Features:
 * - Manifest-based loading
 * - Progress tracking
 * - Support for images, spritesheets, audio, and JSON
 * - Caching and retrieval
 */

import type { IAssetLoader, IAssetManifest, AssetType } from '@shared/interfaces/IGame';

/**
 * Internal asset entry with type information.
 */
interface AssetEntry {
  type: AssetType;
  data: unknown;
  url: string;
}

/**
 * Spritesheet metadata for frame access.
 */
export interface SpritesheetData {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
}

/**
 * AssetLoader implementation for Cosmic Survivors.
 */
export class AssetLoader implements IAssetLoader {
  /** Loaded assets cache */
  private _assets: Map<string, AssetEntry> = new Map();

  /** Loading progress (0-1) */
  private _progress = 0;

  /** Whether loading is complete */
  private _isComplete = false;

  /** Progress callbacks */
  private _progressCallbacks: Array<(progress: number) => void> = [];

  /** Base path for assets */
  private _basePath: string;

  constructor(basePath = '/assets') {
    this._basePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  }

  /**
   * Get loading progress (0-1).
   */
  get progress(): number {
    return this._progress;
  }

  /**
   * Check if loading is complete.
   */
  get isComplete(): boolean {
    return this._isComplete;
  }

  /**
   * Load assets from manifest.
   * @param manifest Asset manifest
   */
  async loadManifest(manifest: IAssetManifest): Promise<void> {
    this._isComplete = false;
    this._progress = 0;

    // Calculate total items
    const totalItems =
      manifest.images.length +
      manifest.spritesheets.length +
      manifest.audio.length +
      manifest.json.length +
      manifest.fonts.length;

    if (totalItems === 0) {
      this._progress = 1;
      this._isComplete = true;
      this.notifyProgress(1);
      return;
    }

    let loadedItems = 0;

    const updateProgress = () => {
      loadedItems++;
      this._progress = loadedItems / totalItems;
      this.notifyProgress(this._progress);
    };

    // Create all loading promises
    const loadingPromises: Promise<void>[] = [];

    // Load images
    for (const item of manifest.images) {
      loadingPromises.push(
        this.loadImage(item.key, item.url).then(updateProgress).catch(err => {
          console.error(`Failed to load image "${item.key}":`, err);
          updateProgress();
        })
      );
    }

    // Load spritesheets
    for (const item of manifest.spritesheets) {
      loadingPromises.push(
        this.loadSpritesheet(
          item.key,
          item.url,
          item.frameWidth,
          item.frameHeight,
          item.frameCount
        ).then(updateProgress).catch(err => {
          console.error(`Failed to load spritesheet "${item.key}":`, err);
          updateProgress();
        })
      );
    }

    // Load audio
    for (const item of manifest.audio) {
      loadingPromises.push(
        this.loadAudio(item.key, item.url).then(updateProgress).catch(err => {
          console.error(`Failed to load audio "${item.key}":`, err);
          updateProgress();
        })
      );
    }

    // Load JSON
    for (const item of manifest.json) {
      loadingPromises.push(
        this.loadJSON(item.key, item.url).then(updateProgress).catch(err => {
          console.error(`Failed to load JSON "${item.key}":`, err);
          updateProgress();
        })
      );
    }

    // Load fonts
    for (const item of manifest.fonts) {
      loadingPromises.push(
        this.loadFont(item.key, item.url).then(updateProgress).catch(err => {
          console.error(`Failed to load font "${item.key}":`, err);
          updateProgress();
        })
      );
    }

    // Wait for all assets to load
    await Promise.all(loadingPromises);

    this._isComplete = true;
  }

  /**
   * Load a single asset.
   * @param type Asset type
   * @param key Asset key
   * @param url Asset URL
   */
  async load(type: AssetType, key: string, url: string): Promise<void> {
    const fullUrl = this.resolveUrl(url);

    switch (type) {
      case 'image' as AssetType:
        await this.loadImage(key, fullUrl);
        break;
      case 'audio' as AssetType:
        await this.loadAudio(key, fullUrl);
        break;
      case 'json' as AssetType:
        await this.loadJSON(key, fullUrl);
        break;
      case 'font' as AssetType:
        await this.loadFont(key, fullUrl);
        break;
      default:
        throw new Error(`Unknown asset type: ${type}`);
    }
  }

  /**
   * Get a loaded asset.
   * @param key Asset key
   * @returns Asset data or undefined
   */
  get<T>(key: string): T | undefined {
    const entry = this._assets.get(key);
    return entry?.data as T | undefined;
  }

  /**
   * Check if asset is loaded.
   * @param key Asset key
   * @returns True if loaded
   */
  has(key: string): boolean {
    return this._assets.has(key);
  }

  /**
   * Unload an asset.
   * @param key Asset key
   */
  unload(key: string): void {
    const entry = this._assets.get(key);
    if (!entry) return;

    // Clean up resources based on type
    if (entry.type === ('audio' as AssetType)) {
      const audio = entry.data as HTMLAudioElement;
      audio.src = '';
    }

    this._assets.delete(key);
  }

  /**
   * Clear all loaded assets.
   */
  clear(): void {
    // Clean up all resources
    for (const [key] of this._assets) {
      this.unload(key);
    }

    this._assets.clear();
    this._progress = 0;
    this._isComplete = false;
  }

  /**
   * Register progress callback.
   * @param callback Progress callback (0-1)
   */
  onProgress(callback: (progress: number) => void): void {
    this._progressCallbacks.push(callback);
  }

  /**
   * Get asset type.
   * @param key Asset key
   * @returns Asset type or undefined
   */
  getType(key: string): AssetType | undefined {
    return this._assets.get(key)?.type;
  }

  /**
   * Get all loaded asset keys.
   * @returns Array of asset keys
   */
  getKeys(): string[] {
    return Array.from(this._assets.keys());
  }

  // ============================================
  // Private Loading Methods
  // ============================================

  /**
   * Load an image.
   */
  private loadImage(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        this._assets.set(key, {
          type: 'image' as AssetType,
          data: img,
          url,
        });
        resolve();
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = this.resolveUrl(url);
    });
  }

  /**
   * Load a spritesheet.
   */
  private loadSpritesheet(
    key: string,
    url: string,
    frameWidth: number,
    frameHeight: number,
    frameCount?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const columns = Math.floor(img.width / frameWidth);
        const rows = Math.floor(img.height / frameHeight);
        const totalFrames = frameCount ?? columns * rows;

        const spritesheetData: SpritesheetData = {
          image: img,
          frameWidth,
          frameHeight,
          frameCount: totalFrames,
          columns,
          rows,
        };

        this._assets.set(key, {
          type: 'spritesheet' as AssetType,
          data: spritesheetData,
          url,
        });
        resolve();
      };

      img.onerror = () => {
        reject(new Error(`Failed to load spritesheet: ${url}`));
      };

      img.src = this.resolveUrl(url);
    });
  }

  /**
   * Load audio file.
   */
  private loadAudio(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';

      const handleCanPlay = () => {
        audio.removeEventListener('canplaythrough', handleCanPlay);
        this._assets.set(key, {
          type: 'audio' as AssetType,
          data: audio,
          url,
        });
        resolve();
      };

      const handleError = () => {
        audio.removeEventListener('error', handleError);
        reject(new Error(`Failed to load audio: ${url}`));
      };

      audio.addEventListener('canplaythrough', handleCanPlay);
      audio.addEventListener('error', handleError);

      audio.src = this.resolveUrl(url);
      audio.load();
    });
  }

  /**
   * Load JSON file.
   */
  private async loadJSON(key: string, url: string): Promise<void> {
    const response = await fetch(this.resolveUrl(url));
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${url} (${response.status})`);
    }

    const data = await response.json();

    this._assets.set(key, {
      type: 'json' as AssetType,
      data,
      url,
    });
  }

  /**
   * Load font using Font Loading API.
   */
  private async loadFont(key: string, url: string): Promise<void> {
    const resolvedUrl = this.resolveUrl(url);

    // Create a FontFace object
    const font = new FontFace(key, `url(${resolvedUrl})`);

    try {
      // Load the font
      const loadedFont = await font.load();

      // Add to document fonts
      document.fonts.add(loadedFont);

      this._assets.set(key, {
        type: 'font' as AssetType,
        data: loadedFont,
        url,
      });
    } catch (error) {
      throw new Error(`Failed to load font: ${url}`);
    }
  }

  /**
   * Resolve URL with base path.
   */
  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }

    if (url.startsWith('/')) {
      return url;
    }

    return `${this._basePath}/${url}`;
  }

  /**
   * Notify all progress callbacks.
   */
  private notifyProgress(progress: number): void {
    for (const callback of this._progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }
}
