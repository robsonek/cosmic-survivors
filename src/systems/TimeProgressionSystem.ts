/**
 * TimeProgressionSystem - System progresji czasowej broni dla Cosmic Survivors
 *
 * Zwiększa moc gracza wraz z czasem gry używając krzywej logarytmicznej
 * z progami czasowymi (power spikes).
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Konfiguracja progu czasowego
 */
export interface ITimeThreshold {
  /** Czas w minutach, kiedy próg zostaje osiągnięty */
  minutes: number;
  /** Nazwa progu wyświetlana w UI */
  name: string;
  /** Bonus do obrażeń (0.2 = +20%) */
  damageBonus: number;
  /** Dodatkowe pociski */
  projectileBonus: number;
  /** Bonus do szybkości strzelania (0.1 = +10%) */
  fireRateBonus: number;
  /** Kolor progu dla efektów wizualnych */
  color: number;
}

/**
 * Konfiguracja systemu progresji czasowej
 */
export interface ITimeProgressionConfig {
  /** Progi czasowe */
  thresholds: ITimeThreshold[];
  /** Współczynnik logarytmiczny dla obrażeń */
  logDamageScale: number;
  /** Współczynnik logarytmiczny dla pocisków */
  logProjectileScale: number;
  /** Współczynnik logarytmiczny dla fire rate */
  logFireRateScale: number;
  /** Bazowy współczynnik czasu dla logarytmu */
  timeScale: number;
}

/**
 * Wynikowe mnożniki z systemu progresji
 */
export interface ITimeProgressionMultipliers {
  /** Mnożnik obrażeń (1.0 = bez zmiany) */
  damageMultiplier: number;
  /** Dodatkowe pociski */
  additionalProjectiles: number;
  /** Mnożnik szybkości strzelania (1.0 = bez zmiany) */
  fireRateMultiplier: number;
  /** Aktualny próg czasowy (lub null jeśli brak) */
  currentThreshold: ITimeThreshold | null;
  /** Indeks aktualnego progu (-1 jeśli brak) */
  currentThresholdIndex: number;
  /** Czas gry w sekundach */
  gameTimeSeconds: number;
  /** Czas gry w minutach */
  gameTimeMinutes: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Domyślne progi czasowe
 */
export const DEFAULT_TIME_THRESHOLDS: ITimeThreshold[] = [
  {
    minutes: 0,
    name: 'Start',
    damageBonus: 0,
    projectileBonus: 0,
    fireRateBonus: 0,
    color: 0xffffff,
  },
  {
    minutes: 3,
    name: 'Warming Up',
    damageBonus: 0.20,
    projectileBonus: 0,
    fireRateBonus: 0.10,
    color: 0x88ff88,
  },
  {
    minutes: 5,
    name: 'Getting Stronger',
    damageBonus: 0.30,
    projectileBonus: 1,
    fireRateBonus: 0.15,
    color: 0x00ff00,
  },
  {
    minutes: 8,
    name: 'Power Surge',
    damageBonus: 0.40,
    projectileBonus: 1,
    fireRateBonus: 0.20,
    color: 0x00ffff,
  },
  {
    minutes: 12,
    name: 'Unstoppable',
    damageBonus: 0.50,
    projectileBonus: 2,
    fireRateBonus: 0.25,
    color: 0x00aaff,
  },
  {
    minutes: 18,
    name: 'Godlike',
    damageBonus: 0.70,
    projectileBonus: 2,
    fireRateBonus: 0.30,
    color: 0xff00ff,
  },
  {
    minutes: 25,
    name: 'Ascended',
    damageBonus: 1.00,
    projectileBonus: 3,
    fireRateBonus: 0.35,
    color: 0xffff00,
  },
];

/**
 * Domyślna konfiguracja systemu
 */
export const DEFAULT_PROGRESSION_CONFIG: ITimeProgressionConfig = {
  thresholds: DEFAULT_TIME_THRESHOLDS,
  logDamageScale: 0.4,
  logProjectileScale: 0.5,
  logFireRateScale: 0.15,
  timeScale: 0.5,
};

// ============================================================================
// TIME PROGRESSION SYSTEM CLASS
// ============================================================================

/**
 * System progresji czasowej
 *
 * Oblicza mnożniki mocy gracza na podstawie czasu gry.
 * Używa krzywej logarytmicznej + progów czasowych.
 */
export class TimeProgressionSystem {
  private config: ITimeProgressionConfig;
  private lastThresholdIndex: number = -1;
  private onThresholdReached?: (threshold: ITimeThreshold, index: number) => void;

  constructor(config: ITimeProgressionConfig = DEFAULT_PROGRESSION_CONFIG) {
    this.config = { ...config };
  }

  /**
   * Oblicza mnożniki progresji dla danego czasu gry
   *
   * @param gameTimeSeconds - Czas gry w sekundach
   * @returns Mnożniki progresji
   */
  public calculate(gameTimeSeconds: number): ITimeProgressionMultipliers {
    const minutes = gameTimeSeconds / 60;

    // Znajdź aktualny próg
    let currentThreshold: ITimeThreshold | null = null;
    let currentThresholdIndex = -1;

    for (let i = this.config.thresholds.length - 1; i >= 0; i--) {
      if (minutes >= this.config.thresholds[i].minutes) {
        currentThreshold = this.config.thresholds[i];
        currentThresholdIndex = i;
        break;
      }
    }

    // Sprawdź czy osiągnięto nowy próg
    if (currentThresholdIndex > this.lastThresholdIndex) {
      this.lastThresholdIndex = currentThresholdIndex;
      if (currentThreshold && this.onThresholdReached) {
        this.onThresholdReached(currentThreshold, currentThresholdIndex);
      }
    }

    // Oblicz bazowe mnożniki logarytmiczne
    // Formula: 1 + log(1 + minutes * timeScale) * scale
    const logBase = Math.log(1 + minutes * this.config.timeScale);

    const baseDamageMultiplier = 1 + logBase * this.config.logDamageScale;
    const baseProjectiles = Math.floor(logBase * this.config.logProjectileScale);
    const baseFireRateMultiplier = 1 + logBase * this.config.logFireRateScale;

    // Dodaj bonusy z progu czasowego
    const thresholdDamageBonus = currentThreshold?.damageBonus ?? 0;
    const thresholdProjectileBonus = currentThreshold?.projectileBonus ?? 0;
    const thresholdFireRateBonus = currentThreshold?.fireRateBonus ?? 0;

    return {
      damageMultiplier: baseDamageMultiplier + thresholdDamageBonus,
      additionalProjectiles: baseProjectiles + thresholdProjectileBonus,
      fireRateMultiplier: baseFireRateMultiplier + thresholdFireRateBonus,
      currentThreshold,
      currentThresholdIndex,
      gameTimeSeconds,
      gameTimeMinutes: minutes,
    };
  }

  /**
   * Resetuje system do stanu początkowego
   */
  public reset(): void {
    this.lastThresholdIndex = -1;
  }

  /**
   * Rejestruje callback wywoływany przy osiągnięciu nowego progu
   *
   * @param callback - Funkcja wywoływana z progiem i jego indeksem
   */
  public setOnThresholdReached(callback: (threshold: ITimeThreshold, index: number) => void): void {
    this.onThresholdReached = callback;
  }

  /**
   * Zwraca następny próg do osiągnięcia
   *
   * @param gameTimeSeconds - Aktualny czas gry w sekundach
   * @returns Następny próg lub null jeśli osiągnięto wszystkie
   */
  public getNextThreshold(gameTimeSeconds: number): ITimeThreshold | null {
    const minutes = gameTimeSeconds / 60;

    for (const threshold of this.config.thresholds) {
      if (threshold.minutes > minutes) {
        return threshold;
      }
    }

    return null;
  }

  /**
   * Zwraca czas pozostały do następnego progu
   *
   * @param gameTimeSeconds - Aktualny czas gry w sekundach
   * @returns Czas w sekundach lub Infinity jeśli osiągnięto wszystkie progi
   */
  public getTimeToNextThreshold(gameTimeSeconds: number): number {
    const nextThreshold = this.getNextThreshold(gameTimeSeconds);

    if (!nextThreshold) {
      return Infinity;
    }

    return (nextThreshold.minutes * 60) - gameTimeSeconds;
  }

  /**
   * Zwraca postęp do następnego progu (0-1)
   *
   * @param gameTimeSeconds - Aktualny czas gry w sekundach
   * @returns Postęp od 0 do 1
   */
  public getProgressToNextThreshold(gameTimeSeconds: number): number {
    const minutes = gameTimeSeconds / 60;

    let previousMinutes = 0;
    let nextMinutes = Infinity;

    for (let i = 0; i < this.config.thresholds.length; i++) {
      const threshold = this.config.thresholds[i];

      if (threshold.minutes <= minutes) {
        previousMinutes = threshold.minutes;
      } else {
        nextMinutes = threshold.minutes;
        break;
      }
    }

    if (nextMinutes === Infinity) {
      return 1;
    }

    const range = nextMinutes - previousMinutes;
    const current = minutes - previousMinutes;

    return Math.min(1, current / range);
  }

  /**
   * Zwraca wszystkie progi
   */
  public getThresholds(): ITimeThreshold[] {
    return [...this.config.thresholds];
  }

  /**
   * Zwraca aktualną konfigurację
   */
  public getConfig(): ITimeProgressionConfig {
    return { ...this.config };
  }

  /**
   * Aktualizuje konfigurację
   */
  public setConfig(config: Partial<ITimeProgressionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instancja TimeProgressionSystem
 */
export const timeProgressionSystem = new TimeProgressionSystem();

/**
 * Eksport domyślny
 */
export default timeProgressionSystem;
