/**
 * UIManager for Cosmic Survivors.
 * Central manager for all UI elements implementing IUIManager interface.
 */

import * as Phaser from 'phaser';
import type {
  IUIManager,
  IUpgradeChoice,
} from '@shared/interfaces/IUI';
import {
  UIScreen,
  HUDElement,
  NotificationType,
} from '@shared/interfaces/IUI';
import type { IEventBus } from '@shared/interfaces/IEventBus';
import { GameEvents } from '@shared/interfaces/IEventBus';
import { UIColors, UIFonts, UIDepth, UIAnimations } from './UIConstants';
import { HUD } from './hud/HUD';
import { UpgradeSelectionScreen } from './screens/UpgradeSelectionScreen';
import { PauseScreen, type PauseStats } from './screens/PauseScreen';
import { GameOverScreen, type GameOverStats } from './screens/GameOverScreen';
import { UIFactory } from './UIFactory';
import { Tooltip } from './components/Tooltip';
import { AchievementPopup } from './AchievementPopup';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/constants/game';

export interface UIManagerConfig {
  scene: Phaser.Scene;
  eventBus?: IEventBus;
  screenWidth?: number;
  screenHeight?: number;
}

interface DamageNumber {
  text: Phaser.GameObjects.Text;
  startTime: number;
  startY: number;
}

interface Notification {
  container: Phaser.GameObjects.Container;
  startTime: number;
  duration: number;
}

/**
 * Central UI Manager implementing IUIManager interface.
 */
export class UIManager implements IUIManager {
  private scene: Phaser.Scene;
  private eventBus?: IEventBus;
  private screenWidth: number;
  private screenHeight: number;

  // Screen management
  private screenStack: UIScreen[] = [];
  private _currentScreen: UIScreen = UIScreen.Game;
  private _isBlocking: boolean = false;

  // UI Components
  private hud: HUD;
  private upgradeScreen: UpgradeSelectionScreen;
  private pauseScreen: PauseScreen;
  private gameOverScreen: GameOverScreen;
  private tooltip: Tooltip;
  private factory: UIFactory;
  private achievementPopup: AchievementPopup;

  // Damage numbers
  private damageNumbers: DamageNumber[] = [];
  private damageNumberPool: Phaser.GameObjects.Text[] = [];
  private damageContainer: Phaser.GameObjects.Container;

  // Floating text
  private floatingTexts: Phaser.GameObjects.Text[] = [];

  // Notifications
  private notifications: Notification[] = [];
  private notificationContainer: Phaser.GameObjects.Container;
  private maxNotifications: number = 5;

  // Confirm dialog
  private confirmContainer?: Phaser.GameObjects.Container;
  private confirmResolve?: (result: boolean) => void;

  // Input state
  private _inputConsumed: boolean = false;

  constructor(config: UIManagerConfig) {
    this.scene = config.scene;
    this.eventBus = config.eventBus;
    this.screenWidth = config.screenWidth ?? GAME_WIDTH;
    this.screenHeight = config.screenHeight ?? GAME_HEIGHT;

    // Create factory
    this.factory = new UIFactory(this.scene);

    // Create damage number container
    this.damageContainer = this.scene.add.container(0, 0);
    this.damageContainer.setDepth(UIDepth.DAMAGE_NUMBERS);

    // Create notification container
    this.notificationContainer = this.scene.add.container(this.screenWidth - 20, 20);
    this.notificationContainer.setDepth(UIDepth.NOTIFICATIONS);
    this.notificationContainer.setScrollFactor(0);

    // Create HUD
    this.hud = new HUD(this.scene, {
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
    });

    // Create screens
    this.upgradeScreen = new UpgradeSelectionScreen(this.scene, {
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
    });

    this.pauseScreen = new PauseScreen(this.scene, {
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      onResume: () => this.hideScreen(),
      onSettings: () => this.showScreen(UIScreen.Settings),
      onQuit: () => {
        this.eventBus?.emit(GameEvents.GAME_OVER, { reason: 'quit' });
      },
    });

    this.gameOverScreen = new GameOverScreen(this.scene, {
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      onRestart: () => {
        // Emit restart event
        this.hideScreen();
      },
      onMainMenu: () => {
        this.showScreen(UIScreen.MainMenu);
      },
    });

    // Create tooltip
    this.tooltip = new Tooltip(this.scene);

    // Create achievement popup
    this.achievementPopup = new AchievementPopup({
      scene: this.scene,
      eventBus: this.eventBus,
      screenWidth: this.screenWidth,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Pre-populate damage number pool
    this.initDamageNumberPool(50);
  }

  // ============================================
  // IUIManager Properties
  // ============================================

  get currentScreen(): UIScreen {
    return this._currentScreen;
  }

  get isBlocking(): boolean {
    return this._isBlocking;
  }

  // ============================================
  // Screen Management
  // ============================================

  showScreen(screen: UIScreen, data?: unknown): void {
    // Push current screen to stack
    if (this._currentScreen !== screen) {
      this.screenStack.push(this._currentScreen);
    }

    this._currentScreen = screen;
    this._isBlocking = true;

    switch (screen) {
      case UIScreen.Game:
        this._isBlocking = false;
        this.hideAllScreens();
        this.showHUD();
        break;

      case UIScreen.Pause:
        this.pauseScreen.updateStats(data as PauseStats);
        this.pauseScreen.show();
        break;

      case UIScreen.UpgradeSelection:
        // Handled by showUpgradeSelection
        break;

      case UIScreen.GameOver:
      case UIScreen.Victory:
        this.gameOverScreen.showWithStats(data as GameOverStats);
        break;

      default:
        console.warn(`Screen ${screen} not implemented`);
    }
  }

  hideScreen(): void {
    // Hide current screen
    switch (this._currentScreen) {
      case UIScreen.Pause:
        this.pauseScreen.hide();
        break;
      case UIScreen.GameOver:
      case UIScreen.Victory:
        this.gameOverScreen.hide();
        break;
      default:
        break;
    }

    // Go back to previous screen
    this.goBack();
  }

  goBack(): void {
    const previousScreen = this.screenStack.pop();
    if (previousScreen !== undefined) {
      this._currentScreen = previousScreen;
      this._isBlocking = previousScreen !== UIScreen.Game;
    } else {
      this._currentScreen = UIScreen.Game;
      this._isBlocking = false;
    }
  }

  private hideAllScreens(): void {
    this.pauseScreen.hide();
    this.gameOverScreen.hide();
  }

  // ============================================
  // HUD Management
  // ============================================

  updateHUD(element: HUDElement, data: unknown): void {
    this.hud.updateElement(element, data);
  }

  setHUDVisible(element: HUDElement, visible: boolean): void {
    this.hud.setElementVisible(element, visible);
  }

  showHUD(): void {
    this.hud.show();
  }

  hideHUD(): void {
    this.hud.hide();
  }

  // ============================================
  // Damage Numbers
  // ============================================

  showDamageNumber(x: number, y: number, damage: number, isCritical: boolean): void {
    const text = this.getDamageNumberFromPool();

    // Format damage
    const damageStr = isCritical ? `${Math.round(damage)}!` : Math.round(damage).toString();
    text.setText(damageStr);

    // Style based on critical
    const fontSize = isCritical ? 28 : 20;
    const color = isCritical ? UIColors.TEXT_CRITICAL : UIColors.TEXT_DAMAGE;

    text.setStyle({
      fontFamily: UIFonts.PRIMARY,
      fontSize: `${fontSize}px`,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });

    text.setPosition(x, y);
    text.setAlpha(1);
    text.setScale(isCritical ? 1.2 : 1);
    text.setVisible(true);

    // Add to active list
    this.damageNumbers.push({
      text,
      startTime: this.scene.time.now,
      startY: y,
    });

    // Critical hit scale animation
    if (isCritical) {
      this.scene.tweens.add({
        targets: text,
        scale: 1,
        duration: 200,
        ease: 'Back.easeOut',
      });
    }
  }

  private getDamageNumberFromPool(): Phaser.GameObjects.Text {
    // Find inactive text in pool
    for (const text of this.damageNumberPool) {
      if (!text.visible) {
        return text;
      }
    }

    // Create new one if pool exhausted
    const text = this.scene.add.text(0, 0, '', {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
    });
    text.setOrigin(0.5);
    text.setVisible(false);
    this.damageContainer.add(text);
    this.damageNumberPool.push(text);

    return text;
  }

  private initDamageNumberPool(size: number): void {
    for (let i = 0; i < size; i++) {
      const text = this.scene.add.text(0, 0, '', {
        fontFamily: UIFonts.PRIMARY,
        fontSize: '20px',
      });
      text.setOrigin(0.5);
      text.setVisible(false);
      this.damageContainer.add(text);
      this.damageNumberPool.push(text);
    }
  }

  // ============================================
  // Floating Text
  // ============================================

  showFloatingText(x: number, y: number, text: string, color: number = UIColors.TEXT_PRIMARY): void {
    const floatText = this.scene.add.text(x, y, text, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '18px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    floatText.setOrigin(0.5);
    floatText.setDepth(UIDepth.DAMAGE_NUMBERS);

    this.floatingTexts.push(floatText);

    // Animate
    this.scene.tweens.add({
      targets: floatText,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        const index = this.floatingTexts.indexOf(floatText);
        if (index !== -1) {
          this.floatingTexts.splice(index, 1);
        }
        floatText.destroy();
      },
    });
  }

  // ============================================
  // Notifications
  // ============================================

  showNotification(message: string, type: NotificationType = NotificationType.Info, duration: number = UIAnimations.NOTIFICATION): void {
    // Remove oldest if at max
    if (this.notifications.length >= this.maxNotifications) {
      const oldest = this.notifications.shift();
      if (oldest) {
        this.removeNotification(oldest);
      }
    }

    // Create notification container
    const container = this.scene.add.container(0, 0);

    // Get color based on type
    let bgColor: number = UIColors.PANEL_BG;
    let borderColor: number = UIColors.BORDER;
    let iconText = 'i';

    switch (type) {
      case NotificationType.Success:
        borderColor = UIColors.SUCCESS;
        iconText = '\u2713';
        break;
      case NotificationType.Warning:
        borderColor = UIColors.WARNING;
        iconText = '!';
        break;
      case NotificationType.Error:
        borderColor = UIColors.ERROR;
        iconText = '\u2717';
        break;
      case NotificationType.Achievement:
        borderColor = UIColors.ACCENT;
        bgColor = UIColors.PANEL_HEADER;
        iconText = '\u2605';
        break;
      default:
        borderColor = UIColors.PRIMARY;
        iconText = 'i';
    }

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(bgColor, 0.95);
    bg.fillRoundedRect(-300, 0, 280, 50, 8);
    bg.lineStyle(2, borderColor);
    bg.strokeRoundedRect(-300, 0, 280, 50, 8);
    container.add(bg);

    // Icon
    const icon = this.scene.add.text(-280, 25, iconText, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(borderColor).rgba,
      fontStyle: 'bold',
    });
    icon.setOrigin(0.5);
    container.add(icon);

    // Message
    const msgText = this.scene.add.text(-260, 25, message, {
      fontFamily: UIFonts.PRIMARY,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
      wordWrap: { width: 230 },
    });
    msgText.setOrigin(0, 0.5);
    container.add(msgText);

    // Position based on existing notifications
    const yOffset = this.notifications.reduce((sum, _n) => sum + 60, 0);
    container.setY(yOffset);
    container.setAlpha(0);
    container.setX(50);

    this.notificationContainer.add(container);

    // Animate in
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      x: 0,
      duration: 200,
      ease: 'Quad.easeOut',
    });

    // Add to list
    const notification: Notification = {
      container,
      startTime: this.scene.time.now,
      duration,
    };
    this.notifications.push(notification);
  }

  private removeNotification(notification: Notification): void {
    this.scene.tweens.add({
      targets: notification.container,
      alpha: 0,
      x: 50,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        notification.container.destroy();
      },
    });
  }

  // ============================================
  // Confirm Dialog
  // ============================================

  showConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmResolve = resolve;
      this._isBlocking = true;

      // Create overlay
      this.confirmContainer = this.scene.add.container(0, 0);
      this.confirmContainer.setDepth(UIDepth.MODALS);
      this.confirmContainer.setScrollFactor(0);

      // Dark background
      const overlay = this.scene.add.graphics();
      overlay.fillStyle(UIColors.OVERLAY_BG, 0.7);
      overlay.fillRect(0, 0, this.screenWidth, this.screenHeight);
      this.confirmContainer.add(overlay);

      // Dialog panel
      const panelWidth = 400;
      const panelHeight = 200;
      const panelX = (this.screenWidth - panelWidth) / 2;
      const panelY = (this.screenHeight - panelHeight) / 2;

      const panel = this.scene.add.graphics();
      panel.fillStyle(UIColors.PANEL_BG, 0.95);
      panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
      panel.lineStyle(2, UIColors.BORDER);
      panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
      this.confirmContainer.add(panel);

      // Title
      const titleText = this.scene.add.text(
        this.screenWidth / 2,
        panelY + 30,
        title,
        {
          fontFamily: UIFonts.PRIMARY,
          fontSize: '24px',
          color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_PRIMARY).rgba,
          fontStyle: 'bold',
        }
      );
      titleText.setOrigin(0.5);
      this.confirmContainer.add(titleText);

      // Message
      const msgText = this.scene.add.text(
        this.screenWidth / 2,
        panelY + 80,
        message,
        {
          fontFamily: UIFonts.PRIMARY,
          fontSize: '16px',
          color: Phaser.Display.Color.IntegerToColor(UIColors.TEXT_SECONDARY).rgba,
          align: 'center',
          wordWrap: { width: panelWidth - 40 },
        }
      );
      msgText.setOrigin(0.5);
      this.confirmContainer.add(msgText);

      // Buttons
      const confirmBtn = this.factory.createPrimaryButton({
        x: this.screenWidth / 2 - 70,
        y: panelY + 150,
        width: 120,
        height: 40,
        text: 'Yes',
        onClick: () => {
          this.closeConfirm(true);
        },
      });
      this.confirmContainer.add(confirmBtn.getContainer());

      const cancelBtn = this.factory.createDangerButton({
        x: this.screenWidth / 2 + 70,
        y: panelY + 150,
        width: 120,
        height: 40,
        text: 'No',
        onClick: () => {
          this.closeConfirm(false);
        },
      });
      this.confirmContainer.add(cancelBtn.getContainer());

      // Animate in
      this.confirmContainer.setAlpha(0);
      this.scene.tweens.add({
        targets: this.confirmContainer,
        alpha: 1,
        duration: 200,
      });
    });
  }

  private closeConfirm(result: boolean): void {
    if (!this.confirmContainer) return;

    this.scene.tweens.add({
      targets: this.confirmContainer,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.confirmContainer?.destroy();
        this.confirmContainer = undefined;
        this._isBlocking = this._currentScreen !== UIScreen.Game;

        if (this.confirmResolve) {
          this.confirmResolve(result);
          this.confirmResolve = undefined;
        }
      },
    });
  }

  // ============================================
  // Upgrade Selection
  // ============================================

  async showUpgradeSelection(choices: IUpgradeChoice[]): Promise<string> {
    this._currentScreen = UIScreen.UpgradeSelection;
    this._isBlocking = true;

    const result = await this.upgradeScreen.showWithChoices(choices);

    this._currentScreen = UIScreen.Game;
    this._isBlocking = false;

    return result;
  }

  // ============================================
  // Input
  // ============================================

  consumedInput(): boolean {
    const consumed = this._inputConsumed;
    this._inputConsumed = false;
    return consumed || this._isBlocking;
  }

  // ============================================
  // Event Listeners
  // ============================================

  private setupEventListeners(): void {
    if (!this.eventBus) return;

    // Listen for damage events to show damage numbers
    this.eventBus.on(GameEvents.DAMAGE, (event: { position: { x: number; y: number }; amount: number; isCritical: boolean }) => {
      this.showDamageNumber(event.position.x, event.position.y, event.amount, event.isCritical);
    });

    // Listen for UI update events
    this.eventBus.on(GameEvents.SHOW_NOTIFICATION, (event: { message: string; type?: NotificationType }) => {
      this.showNotification(event.message, event.type);
    });

    // Listen for game state changes
    this.eventBus.on(GameEvents.GAME_PAUSE, () => {
      this.showScreen(UIScreen.Pause);
    });

    this.eventBus.on(GameEvents.GAME_RESUME, () => {
      this.hideScreen();
    });
  }

  // ============================================
  // Lifecycle
  // ============================================

  update(dt: number): void {
    // Update HUD
    this.hud.update(dt);

    // Update damage numbers
    this.updateDamageNumbers();

    // Update notifications
    this.updateNotifications();

    // Update achievement popup
    this.achievementPopup.update(dt);
  }

  private updateDamageNumbers(): void {
    const now = this.scene.time.now;
    const duration = UIAnimations.DAMAGE_NUMBER;

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      const elapsed = now - dn.startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        // Return to pool
        dn.text.setVisible(false);
        this.damageNumbers.splice(i, 1);
      } else {
        // Animate upward and fade
        dn.text.setY(dn.startY - progress * 50);
        dn.text.setAlpha(1 - progress * progress);
      }
    }
  }

  private updateNotifications(): void {
    const now = this.scene.time.now;

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const notification = this.notifications[i];
      const elapsed = now - notification.startTime;

      if (elapsed >= notification.duration) {
        this.notifications.splice(i, 1);
        this.removeNotification(notification);
      }
    }

    // Reposition remaining notifications
    let yOffset = 0;
    for (const notification of this.notifications) {
      this.scene.tweens.add({
        targets: notification.container,
        y: yOffset,
        duration: 200,
        ease: 'Quad.easeOut',
      });
      yOffset += 60;
    }
  }

  resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.hud.resize(width, height);

    // Reposition notification container
    this.notificationContainer.setPosition(width - 20, 20);

    // Resize achievement popup
    this.achievementPopup.resize(width, height);
  }

  destroy(): void {
    this.hud.destroy();
    this.upgradeScreen.destroy();
    this.pauseScreen.destroy();
    this.gameOverScreen.destroy();
    this.tooltip.destroy();
    this.achievementPopup.destroy();

    // Clean up damage numbers
    this.damageNumberPool.forEach(text => text.destroy());
    this.damageNumbers = [];
    this.damageNumberPool = [];
    this.damageContainer.destroy();

    // Clean up floating texts
    this.floatingTexts.forEach(text => text.destroy());
    this.floatingTexts = [];

    // Clean up notifications
    this.notifications.forEach(n => n.container.destroy());
    this.notifications = [];
    this.notificationContainer.destroy();

    // Clean up confirm dialog
    if (this.confirmContainer) {
      this.confirmContainer.destroy();
    }
  }

  // ============================================
  // Getters for components
  // ============================================

  getHUD(): HUD {
    return this.hud;
  }

  getFactory(): UIFactory {
    return this.factory;
  }

  getTooltip(): Tooltip {
    return this.tooltip;
  }

  getAchievementPopup(): AchievementPopup {
    return this.achievementPopup;
  }

  /**
   * Show tooltip at position.
   */
  showTooltip(x: number, y: number, title: string, body: string): void {
    this.tooltip.showAt(x, y, title, body);
  }

  /**
   * Hide tooltip.
   */
  hideTooltip(): void {
    this.tooltip.hide();
  }
}
