/**
 * WaveManager - System zarządzania falami wrogów dla Cosmic Survivors
 * Phaser 4, TypeScript
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Typ zachowania wroga
 */
export type EnemyBehavior = 'chase' | 'circle' | 'dash' | 'ranged';

/**
 * Konfiguracja typu wroga
 */
export interface IEnemyType {
    id: string;
    name: string;
    texture: string;
    hp: number;
    speed: number;
    damage: number;
    xpValue: number;
    scale: number;
    behavior: EnemyBehavior;
}

/**
 * Konfiguracja spawnu wroga w fali
 */
export interface IEnemySpawnConfig {
    type: string;
    spawnRate: number;  // wrogów na sekundę
    maxCount: number;   // maksymalna liczba tego typu w fali
}

/**
 * Konfiguracja fali
 */
export interface IWaveConfig {
    waveNumber: number;
    duration: number;   // w sekundach
    enemyTypes: IEnemySpawnConfig[];
    bossWave: boolean;
    bossType?: string;
}

/**
 * Stan aktualnej fali
 */
interface IWaveState {
    currentWave: number;
    elapsedTime: number;
    isActive: boolean;
    spawnedCounts: Map<string, number>;
    bossSpawned: boolean;
    totalEnemiesSpawned: number;
    totalEnemiesKilled: number;
}

// ============================================================================
// PREDEFINED ENEMY TYPES
// ============================================================================

/**
 * Predefiniowane typy wrogów
 */
export const ENEMY_TYPES: Record<string, IEnemyType> = {
    // Drone - podstawowy wróg, goni gracza
    drone: {
        id: 'drone',
        name: 'Drone',
        texture: 'enemy_drone',
        hp: 20,
        speed: 80,
        damage: 5,
        xpValue: 10,
        scale: 1.0,
        behavior: 'chase'
    },

    // Charger - szybki wróg z dash'em
    charger: {
        id: 'charger',
        name: 'Charger',
        texture: 'enemy_charger',
        hp: 15,
        speed: 60,
        damage: 15,
        xpValue: 20,
        scale: 0.9,
        behavior: 'dash'
    },

    // Tank - wolny, ale wytrzymały
    tank: {
        id: 'tank',
        name: 'Tank',
        texture: 'enemy_tank',
        hp: 100,
        speed: 40,
        damage: 20,
        xpValue: 35,
        scale: 1.5,
        behavior: 'chase'
    },

    // Shooter - strzela z dystansu
    shooter: {
        id: 'shooter',
        name: 'Shooter',
        texture: 'enemy_shooter',
        hp: 25,
        speed: 50,
        damage: 10,
        xpValue: 25,
        scale: 1.0,
        behavior: 'ranged'
    },

    // Swarm - mały, pojawia się w grupach
    swarm: {
        id: 'swarm',
        name: 'Swarm',
        texture: 'enemy_swarm',
        hp: 8,
        speed: 100,
        damage: 3,
        xpValue: 5,
        scale: 0.5,
        behavior: 'chase'
    }
};

/**
 * Predefiniowane typy bossów
 */
export const BOSS_TYPES: Record<string, IEnemyType> = {
    // Mothership - duży boss, spawnuje drony
    mothership: {
        id: 'mothership',
        name: 'Mothership',
        texture: 'boss_mothership',
        hp: 1000,
        speed: 30,
        damage: 25,
        xpValue: 500,
        scale: 3.0,
        behavior: 'circle'
    },

    // Destroyer - potężny laser, masywne HP
    destroyer: {
        id: 'destroyer',
        name: 'Destroyer',
        texture: 'boss_destroyer',
        hp: 2000,
        speed: 20,
        damage: 50,
        xpValue: 1000,
        scale: 4.0,
        behavior: 'chase'
    }
};

// ============================================================================
// WAVE MANAGER CLASS
// ============================================================================

/**
 * Klasa zarządzająca falami wrogów
 */
export class WaveManager {
    // Stan gry
    private state: IWaveState;

    // Konfiguracja
    private readonly baseDuration: number = 30;  // bazowy czas fali w sekundach
    private readonly bossWaveInterval: number = 5;  // boss co 5 fal
    private readonly difficultyScaling: number = 0.15;  // 15% wzrost na falę

    // Callbacks
    private onWaveStart?: (wave: IWaveConfig) => void;
    private onWaveEnd?: (waveNumber: number) => void;
    private onBossSpawn?: (bossType: string) => void;

    // Spawn timers
    private spawnTimers: Map<string, number> = new Map();

    constructor() {
        this.state = this.createInitialState();
    }

    /**
     * Tworzy początkowy stan gry
     */
    private createInitialState(): IWaveState {
        return {
            currentWave: 0,
            elapsedTime: 0,
            isActive: false,
            spawnedCounts: new Map(),
            bossSpawned: false,
            totalEnemiesSpawned: 0,
            totalEnemiesKilled: 0
        };
    }

    /**
     * Resetuje stan do wartości początkowych
     */
    public reset(): void {
        this.state = this.createInitialState();
        this.spawnTimers.clear();
    }

    /**
     * Rozpoczyna nową grę od fali 1
     */
    public startGame(): void {
        this.reset();
        this.startWave(1);
    }

    /**
     * Rozpoczyna konkretną falę
     */
    public startWave(waveNumber: number): void {
        this.state.currentWave = waveNumber;
        this.state.elapsedTime = 0;
        this.state.isActive = true;
        this.state.spawnedCounts.clear();
        this.state.bossSpawned = false;
        this.spawnTimers.clear();

        const waveConfig = this.generateWaveConfig(waveNumber);

        // Inicjalizuj timery spawnu
        for (const enemySpawn of waveConfig.enemyTypes) {
            this.spawnTimers.set(enemySpawn.type, 0);
            this.state.spawnedCounts.set(enemySpawn.type, 0);
        }

        this.onWaveStart?.(waveConfig);
    }

    /**
     * Aktualizacja stanu (wywoływana co klatkę)
     * @param dt Delta time w sekundach
     * @returns Lista wrogów do zespawnowania
     */
    public update(dt: number): { enemyType: string; count: number }[] {
        if (!this.state.isActive) {
            return [];
        }

        this.state.elapsedTime += dt;
        const waveConfig = this.getCurrentWave();
        const enemiesToSpawn: { enemyType: string; count: number }[] = [];

        // Sprawdź czy fala się skończyła
        if (this.state.elapsedTime >= waveConfig.duration) {
            this.endWave();
            return enemiesToSpawn;
        }

        // Boss wave - spawn bossa
        if (waveConfig.bossWave && !this.state.bossSpawned && waveConfig.bossType) {
            this.state.bossSpawned = true;
            enemiesToSpawn.push({ enemyType: waveConfig.bossType, count: 1 });
            this.onBossSpawn?.(waveConfig.bossType);
        }

        // Spawn zwykłych wrogów
        for (const enemySpawn of waveConfig.enemyTypes) {
            const currentTimer = this.spawnTimers.get(enemySpawn.type) || 0;
            const spawnedCount = this.state.spawnedCounts.get(enemySpawn.type) || 0;

            // Sprawdź czy możemy spawnować więcej tego typu
            if (spawnedCount >= enemySpawn.maxCount) {
                continue;
            }

            // Oblicz interwał spawnu
            const spawnInterval = 1 / enemySpawn.spawnRate;
            const newTimer = currentTimer + dt;

            if (newTimer >= spawnInterval) {
                // Spawn wroga
                const spawnCount = Math.floor(newTimer / spawnInterval);
                const actualSpawnCount = Math.min(
                    spawnCount,
                    enemySpawn.maxCount - spawnedCount
                );

                if (actualSpawnCount > 0) {
                    enemiesToSpawn.push({
                        enemyType: enemySpawn.type,
                        count: actualSpawnCount
                    });

                    this.state.spawnedCounts.set(
                        enemySpawn.type,
                        spawnedCount + actualSpawnCount
                    );
                    this.state.totalEnemiesSpawned += actualSpawnCount;
                }

                // Reset timer z resztą
                this.spawnTimers.set(enemySpawn.type, newTimer % spawnInterval);
            } else {
                this.spawnTimers.set(enemySpawn.type, newTimer);
            }
        }

        return enemiesToSpawn;
    }

    /**
     * Kończy aktualną falę i rozpoczyna następną
     */
    private endWave(): void {
        const completedWave = this.state.currentWave;
        this.state.isActive = false;

        this.onWaveEnd?.(completedWave);

        // Automatycznie rozpocznij następną falę po krótkim opóźnieniu
        // (w rzeczywistej grze to byłoby obsługiwane przez główną pętlę gry)
        this.startWave(completedWave + 1);
    }

    /**
     * Generuje konfigurację dla danej fali
     */
    public generateWaveConfig(waveNumber: number): IWaveConfig {
        const isBossWave = waveNumber % this.bossWaveInterval === 0;
        const difficultyMultiplier = 1 + (waveNumber - 1) * this.difficultyScaling;

        // Bazowy czas fali rośnie z każdą falą
        const duration = this.baseDuration + Math.floor(waveNumber / 3) * 5;

        // Generuj typy wrogów dla fali
        const enemyTypes = this.generateEnemySpawns(waveNumber, difficultyMultiplier);

        // Wybierz bossa dla boss wave
        let bossType: string | undefined;
        if (isBossWave) {
            const bossKeys = Object.keys(BOSS_TYPES);
            const bossIndex = Math.floor((waveNumber / this.bossWaveInterval - 1) % bossKeys.length);
            bossType = bossKeys[bossIndex];
        }

        return {
            waveNumber,
            duration,
            enemyTypes,
            bossWave: isBossWave,
            bossType
        };
    }

    /**
     * Generuje konfigurację spawnu wrogów dla fali
     */
    private generateEnemySpawns(waveNumber: number, difficultyMultiplier: number): IEnemySpawnConfig[] {
        const spawns: IEnemySpawnConfig[] = [];

        // Fala 1-2: tylko drony
        if (waveNumber <= 2) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.5 * difficultyMultiplier,
                maxCount: Math.floor(10 * difficultyMultiplier)
            });
        }
        // Fala 3-4: drony + swarm
        else if (waveNumber <= 4) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.6 * difficultyMultiplier,
                maxCount: Math.floor(12 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 1.0 * difficultyMultiplier,
                maxCount: Math.floor(20 * difficultyMultiplier)
            });
        }
        // Fala 5-7: dodaj chargery
        else if (waveNumber <= 7) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.7 * difficultyMultiplier,
                maxCount: Math.floor(15 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 1.2 * difficultyMultiplier,
                maxCount: Math.floor(25 * difficultyMultiplier)
            });
            spawns.push({
                type: 'charger',
                spawnRate: 0.3 * difficultyMultiplier,
                maxCount: Math.floor(5 * difficultyMultiplier)
            });
        }
        // Fala 8-10: dodaj shootery
        else if (waveNumber <= 10) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.8 * difficultyMultiplier,
                maxCount: Math.floor(18 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 1.5 * difficultyMultiplier,
                maxCount: Math.floor(30 * difficultyMultiplier)
            });
            spawns.push({
                type: 'charger',
                spawnRate: 0.4 * difficultyMultiplier,
                maxCount: Math.floor(8 * difficultyMultiplier)
            });
            spawns.push({
                type: 'shooter',
                spawnRate: 0.25 * difficultyMultiplier,
                maxCount: Math.floor(5 * difficultyMultiplier)
            });
        }
        // Fala 11+: wszystkie typy wrogów
        else {
            spawns.push({
                type: 'drone',
                spawnRate: 1.0 * difficultyMultiplier,
                maxCount: Math.floor(20 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 2.0 * difficultyMultiplier,
                maxCount: Math.floor(40 * difficultyMultiplier)
            });
            spawns.push({
                type: 'charger',
                spawnRate: 0.5 * difficultyMultiplier,
                maxCount: Math.floor(10 * difficultyMultiplier)
            });
            spawns.push({
                type: 'shooter',
                spawnRate: 0.35 * difficultyMultiplier,
                maxCount: Math.floor(8 * difficultyMultiplier)
            });
            spawns.push({
                type: 'tank',
                spawnRate: 0.15 * difficultyMultiplier,
                maxCount: Math.floor(3 * difficultyMultiplier)
            });
        }

        return spawns;
    }

    /**
     * Zwraca konfigurację aktualnej fali
     */
    public getCurrentWave(): IWaveConfig {
        return this.generateWaveConfig(this.state.currentWave);
    }

    /**
     * Zwraca numer aktualnej fali
     */
    public getCurrentWaveNumber(): number {
        return this.state.currentWave;
    }

    /**
     * Zwraca pozostały czas fali w sekundach
     */
    public getRemainingTime(): number {
        const waveConfig = this.getCurrentWave();
        return Math.max(0, waveConfig.duration - this.state.elapsedTime);
    }

    /**
     * Zwraca postęp fali (0-1)
     */
    public getWaveProgress(): number {
        const waveConfig = this.getCurrentWave();
        return Math.min(1, this.state.elapsedTime / waveConfig.duration);
    }

    /**
     * Zwraca aktualny spawn rate dla danego typu wroga
     */
    public getSpawnRate(enemyType: string): number {
        const waveConfig = this.getCurrentWave();
        const spawn = waveConfig.enemyTypes.find(e => e.type === enemyType);
        return spawn?.spawnRate || 0;
    }

    /**
     * Sprawdza czy to boss wave
     */
    public isBossWave(): boolean {
        return this.getCurrentWave().bossWave;
    }

    /**
     * Sprawdza czy boss powinien być zespawnowany
     */
    public shouldSpawnBoss(): boolean {
        const waveConfig = this.getCurrentWave();
        return waveConfig.bossWave && !this.state.bossSpawned;
    }

    /**
     * Zwraca typ wroga ze skalowaniem trudności
     */
    public getScaledEnemy(enemyId: string): IEnemyType | null {
        const baseEnemy = ENEMY_TYPES[enemyId] || BOSS_TYPES[enemyId];
        if (!baseEnemy) {
            return null;
        }

        const difficultyMultiplier = 1 + (this.state.currentWave - 1) * this.difficultyScaling;

        return {
            ...baseEnemy,
            hp: Math.floor(baseEnemy.hp * difficultyMultiplier),
            speed: Math.min(baseEnemy.speed * (1 + difficultyMultiplier * 0.1), baseEnemy.speed * 2),
            damage: Math.floor(baseEnemy.damage * (1 + difficultyMultiplier * 0.5)),
            xpValue: Math.floor(baseEnemy.xpValue * difficultyMultiplier)
        };
    }

    /**
     * Zwraca typ bossa ze skalowaniem trudności
     */
    public getScaledBoss(bossId: string): IEnemyType | null {
        const baseBoss = BOSS_TYPES[bossId];
        if (!baseBoss) {
            return null;
        }

        // Bossy skalują się mocniej
        const bossMultiplier = 1 + Math.floor(this.state.currentWave / this.bossWaveInterval) * 0.5;

        return {
            ...baseBoss,
            hp: Math.floor(baseBoss.hp * bossMultiplier),
            damage: Math.floor(baseBoss.damage * bossMultiplier),
            xpValue: Math.floor(baseBoss.xpValue * bossMultiplier)
        };
    }

    /**
     * Zgłasza zabicie wroga
     */
    public reportEnemyKilled(): void {
        this.state.totalEnemiesKilled++;
    }

    /**
     * Zwraca statystyki
     */
    public getStats(): {
        currentWave: number;
        totalSpawned: number;
        totalKilled: number;
        elapsedTime: number;
        isActive: boolean;
    } {
        return {
            currentWave: this.state.currentWave,
            totalSpawned: this.state.totalEnemiesSpawned,
            totalKilled: this.state.totalEnemiesKilled,
            elapsedTime: this.state.elapsedTime,
            isActive: this.state.isActive
        };
    }

    /**
     * Sprawdza czy fala jest aktywna
     */
    public isWaveActive(): boolean {
        return this.state.isActive;
    }

    /**
     * Rejestruje callback na start fali
     */
    public onWaveStartCallback(callback: (wave: IWaveConfig) => void): void {
        this.onWaveStart = callback;
    }

    /**
     * Rejestruje callback na koniec fali
     */
    public onWaveEndCallback(callback: (waveNumber: number) => void): void {
        this.onWaveEnd = callback;
    }

    /**
     * Rejestruje callback na spawn bossa
     */
    public onBossSpawnCallback(callback: (bossType: string) => void): void {
        this.onBossSpawn = callback;
    }

    /**
     * Pauzuje aktualną falę
     */
    public pause(): void {
        this.state.isActive = false;
    }

    /**
     * Wznawia aktualną falę
     */
    public resume(): void {
        if (this.state.currentWave > 0) {
            this.state.isActive = true;
        }
    }

    /**
     * Przeskakuje do konkretnej fali (debug/cheat)
     */
    public skipToWave(waveNumber: number): void {
        this.startWave(Math.max(1, waveNumber));
    }

    /**
     * Zwraca mnożnik trudności dla aktualnej fali
     */
    public getDifficultyMultiplier(): number {
        return 1 + (this.state.currentWave - 1) * this.difficultyScaling;
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instancja WaveManager
 */
export const waveManager = new WaveManager();

// Eksport domyślny
export default waveManager;
