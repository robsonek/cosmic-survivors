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
export type EnemyBehavior = 'chase' | 'circle' | 'dash' | 'ranged' | 'teleport' | 'shield' | 'explode' | 'support';

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
 * BUFF: HP 3x, DMG 2x dla lepszego balansu z systemem progresji czasowej
 */
export const ENEMY_TYPES: Record<string, IEnemyType> = {
    // Drone - podstawowy wróg, goni gracza
    drone: {
        id: 'drone',
        name: 'Drone',
        texture: 'enemy_drone',
        hp: 30,           // 3x (było 10)
        speed: 90,        // +10 (było 80)
        damage: 5,        // 2.5x (było 2)
        xpValue: 20,
        scale: 1.0,
        behavior: 'chase'
    },

    // Charger - szybki wróg z dash'em
    charger: {
        id: 'charger',
        name: 'Charger',
        texture: 'enemy_charger',
        hp: 25,           // 3x (było 8)
        speed: 70,        // +10 (było 60)
        damage: 15,       // 2x (było 7)
        xpValue: 40,
        scale: 0.9,
        behavior: 'dash'
    },

    // Tank - wolny, ale wytrzymały
    tank: {
        id: 'tank',
        name: 'Tank',
        texture: 'enemy_tank',
        hp: 120,          // 3x (było 40)
        speed: 45,        // +5 (było 40)
        damage: 20,       // 2x (było 10)
        xpValue: 70,
        scale: 1.5,
        behavior: 'chase'
    },

    // Shooter - strzela z dystansu
    shooter: {
        id: 'shooter',
        name: 'Shooter',
        texture: 'enemy_shooter',
        hp: 45,           // 3x (było 15)
        speed: 55,        // +5 (było 50)
        damage: 12,       // 2.4x (było 5)
        xpValue: 50,
        scale: 1.0,
        behavior: 'ranged'
    },

    // Swarm - mały, pojawia się w grupach
    swarm: {
        id: 'swarm',
        name: 'Swarm',
        texture: 'enemy_swarm',
        hp: 15,           // 3x (było 5)
        speed: 110,       // +10 (było 100)
        damage: 3,        // 3x (było 1)
        xpValue: 10,
        scale: 0.5,
        behavior: 'chase'
    },

    // ========================================================================
    // NEW ENEMY TYPES (Wave 5+)
    // ========================================================================

    // Splitter - when killed, splits into 2-3 smaller versions
    splitter: {
        id: 'splitter',
        name: 'Splitter',
        texture: 'enemy_splitter',
        hp: 60,           // Medium HP - needs to survive to split
        speed: 75,        // Moderate speed
        damage: 8,        // Moderate damage
        xpValue: 45,      // Good XP reward for the complexity
        scale: 1.3,       // Larger to show it can split
        behavior: 'chase'
    },

    // Splitter Mini - smaller version spawned when Splitter dies
    splitter_mini: {
        id: 'splitter_mini',
        name: 'Splitter Mini',
        texture: 'enemy_splitter_mini',
        hp: 20,           // Low HP
        speed: 95,        // Faster than parent
        damage: 4,        // Lower damage
        xpValue: 15,      // Small XP reward
        scale: 0.7,       // Smaller version
        behavior: 'chase'
    },

    // Teleporter - blinks/teleports towards player every 3 seconds
    teleporter: {
        id: 'teleporter',
        name: 'Teleporter',
        texture: 'enemy_teleporter',
        hp: 35,           // Low HP - glass cannon
        speed: 60,        // Slow base speed (relies on teleport)
        damage: 18,       // High damage - reward for reaching player
        xpValue: 55,      // Good XP for difficulty
        scale: 1.0,
        behavior: 'teleport'
    },

    // Shielder - has a front-facing shield that blocks projectiles
    shielder: {
        id: 'shielder',
        name: 'Shielder',
        texture: 'enemy_shielder',
        hp: 80,           // Tanky - shield + HP
        speed: 50,        // Slow - shield makes them defensive
        damage: 12,       // Moderate damage
        xpValue: 60,      // High XP for difficulty
        scale: 1.2,
        behavior: 'shield'
    },

    // Exploder - runs at player and explodes on death dealing AOE damage
    exploder: {
        id: 'exploder',
        name: 'Exploder',
        texture: 'enemy_exploder',
        hp: 25,           // Low HP - designed to die near player
        speed: 130,       // Very fast - rushes player
        damage: 10,       // Contact damage (explosion is separate)
        xpValue: 35,      // Medium XP
        scale: 0.9,
        behavior: 'explode'
    },

    // Healer - heals nearby enemies, priority target
    healer: {
        id: 'healer',
        name: 'Healer',
        texture: 'enemy_healer',
        hp: 50,           // Medium HP - needs protection
        speed: 65,        // Slow - stays behind frontline
        damage: 5,        // Low damage - support role
        xpValue: 80,      // High XP - priority target
        scale: 1.1,
        behavior: 'support'
    }
};

/**
 * Predefiniowane typy bossów
 * BUFF: HP 2.5x, DMG 2x dla lepszego balansu z systemem progresji czasowej
 */
export const BOSS_TYPES: Record<string, IEnemyType> = {
    // Mothership - duży boss, spawnuje drony
    mothership: {
        id: 'mothership',
        name: 'Mothership',
        texture: 'boss_mothership',
        hp: 1500,         // 2.5x (było 600)
        speed: 30,
        damage: 25,       // 2x (było 12)
        xpValue: 1000,
        scale: 3.0,
        behavior: 'circle'
    },

    // Destroyer - potężny laser, masywne HP
    destroyer: {
        id: 'destroyer',
        name: 'Destroyer',
        texture: 'boss_destroyer',
        hp: 3000,         // 2.5x (było 1200)
        speed: 20,
        damage: 50,       // 2x (było 25)
        xpValue: 2000,
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
    private readonly baseDuration: number = 40;  // bazowy czas fali w sekundach (zwiększony dla łatwiejszej rozgrywki)
    private readonly bossWaveInterval: number = 7;  // boss co 7 fal (rzadziej)
    private readonly difficultyScaling: number = 0.12;  // 12% wzrost na falę (zwiększone dla balansu z progresją czasową)

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

        // Fala 1-2: tylko drony (spawn rate zmniejszony o 30%)
        if (waveNumber <= 2) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.35 * difficultyMultiplier,
                maxCount: Math.floor(10 * difficultyMultiplier)
            });
        }
        // Fala 3-4: drony + swarm (spawn rate zmniejszony o 30%)
        else if (waveNumber <= 4) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.42 * difficultyMultiplier,
                maxCount: Math.floor(12 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 0.7 * difficultyMultiplier,
                maxCount: Math.floor(20 * difficultyMultiplier)
            });
        }
        // Fala 5-7: dodaj chargery + nowe typy wrogów (spawn rate zmniejszony o 30%)
        else if (waveNumber <= 7) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.49 * difficultyMultiplier,
                maxCount: Math.floor(15 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 0.84 * difficultyMultiplier,
                maxCount: Math.floor(25 * difficultyMultiplier)
            });
            spawns.push({
                type: 'charger',
                spawnRate: 0.21 * difficultyMultiplier,
                maxCount: Math.floor(5 * difficultyMultiplier)
            });
            // New enemy types starting wave 5
            spawns.push({
                type: 'splitter',
                spawnRate: 0.08 * difficultyMultiplier,
                maxCount: Math.floor(3 * difficultyMultiplier)
            });
            spawns.push({
                type: 'exploder',
                spawnRate: 0.12 * difficultyMultiplier,
                maxCount: Math.floor(4 * difficultyMultiplier)
            });
        }
        // Fala 8-10: dodaj shootery + więcej nowych typów (spawn rate zmniejszony o 30%)
        else if (waveNumber <= 10) {
            spawns.push({
                type: 'drone',
                spawnRate: 0.56 * difficultyMultiplier,
                maxCount: Math.floor(18 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 1.05 * difficultyMultiplier,
                maxCount: Math.floor(30 * difficultyMultiplier)
            });
            spawns.push({
                type: 'charger',
                spawnRate: 0.28 * difficultyMultiplier,
                maxCount: Math.floor(8 * difficultyMultiplier)
            });
            spawns.push({
                type: 'shooter',
                spawnRate: 0.175 * difficultyMultiplier,
                maxCount: Math.floor(5 * difficultyMultiplier)
            });
            // More new enemy types
            spawns.push({
                type: 'splitter',
                spawnRate: 0.1 * difficultyMultiplier,
                maxCount: Math.floor(4 * difficultyMultiplier)
            });
            spawns.push({
                type: 'exploder',
                spawnRate: 0.15 * difficultyMultiplier,
                maxCount: Math.floor(5 * difficultyMultiplier)
            });
            spawns.push({
                type: 'teleporter',
                spawnRate: 0.06 * difficultyMultiplier,
                maxCount: Math.floor(2 * difficultyMultiplier)
            });
            spawns.push({
                type: 'healer',
                spawnRate: 0.04 * difficultyMultiplier,
                maxCount: Math.floor(2 * difficultyMultiplier)
            });
        }
        // Fala 11+: wszystkie typy wrogów (spawn rate zmniejszony o 30%)
        else {
            spawns.push({
                type: 'drone',
                spawnRate: 0.7 * difficultyMultiplier,
                maxCount: Math.floor(20 * difficultyMultiplier)
            });
            spawns.push({
                type: 'swarm',
                spawnRate: 1.4 * difficultyMultiplier,
                maxCount: Math.floor(40 * difficultyMultiplier)
            });
            spawns.push({
                type: 'charger',
                spawnRate: 0.35 * difficultyMultiplier,
                maxCount: Math.floor(10 * difficultyMultiplier)
            });
            spawns.push({
                type: 'shooter',
                spawnRate: 0.245 * difficultyMultiplier,
                maxCount: Math.floor(8 * difficultyMultiplier)
            });
            spawns.push({
                type: 'tank',
                spawnRate: 0.105 * difficultyMultiplier,
                maxCount: Math.floor(3 * difficultyMultiplier)
            });
            // All new enemy types at full strength
            spawns.push({
                type: 'splitter',
                spawnRate: 0.14 * difficultyMultiplier,
                maxCount: Math.floor(5 * difficultyMultiplier)
            });
            spawns.push({
                type: 'exploder',
                spawnRate: 0.2 * difficultyMultiplier,
                maxCount: Math.floor(6 * difficultyMultiplier)
            });
            spawns.push({
                type: 'teleporter',
                spawnRate: 0.08 * difficultyMultiplier,
                maxCount: Math.floor(3 * difficultyMultiplier)
            });
            spawns.push({
                type: 'shielder',
                spawnRate: 0.06 * difficultyMultiplier,
                maxCount: Math.floor(2 * difficultyMultiplier)
            });
            spawns.push({
                type: 'healer',
                spawnRate: 0.05 * difficultyMultiplier,
                maxCount: Math.floor(2 * difficultyMultiplier)
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
