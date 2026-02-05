# Cosmic Survivors - Claude Code Project Guide

## Przegląd Projektu

**Cosmic Survivors** to gra Bullet Heaven/Roguelite z multiplayer (do 4 graczy), zbudowana w architekturze Multi-Agent AI.

### Stack Technologiczny
- **Engine:** Phaser 4 + bitECS
- **Build:** Vite + TypeScript (strict mode)
- **Backend:** Nakama (open-source)
- **Real-time:** WebSocket + WebRTC
- **Graphics:** WebGPU (fallback WebGL2)

### Statystyki
- ~170 plików TypeScript
- ~55,000 linii kodu
- 0 błędów kompilacji

---

## Struktura Katalogów

```
/cosmic-survivors/
├── /src/
│   ├── /core/              # Game.ts, GameLoop.ts, EventBus.ts, AssetLoader.ts, InputManager.ts
│   ├── /ecs/               # World.ts, /components/, /systems/, /queries/
│   ├── /rendering/         # Renderer.ts, SpriteSystem.ts, Camera.ts, AnimationSystem.ts
│   ├── /effects/           # ParticleSystem.ts, ScreenEffects.ts, GameScreenEffects.ts, TrailEffects.ts
│   ├── /physics/           # PhysicsSystem.ts, CollisionSystem.ts, MovementSystem.ts
│   ├── /spatial/           # SpatialHash.ts
│   ├── /ai/                # AISystem.ts, /behaviors/, /pathfinding/, /spawning/, /definitions/
│   ├── /weapons/           # WeaponFactory.ts, /definitions/
│   ├── /combat/            # DamageSystem.ts, ProjectileSystem.ts, WeaponSystem.ts
│   ├── /systems/           # ComboSystem, KillStreakSystem, PowerUpSystem, TreasureSystem, etc.
│   ├── /networking/        # NetworkManager.ts, NakamaClient.ts, StateSync.ts, Prediction.ts
│   ├── /procedural/        # WaveGenerator.ts, LootGenerator.ts, DifficultyScaler.ts
│   ├── /ui/                # UIManager.ts, /hud/, /screens/, /components/
│   ├── /audio/             # AudioManager.ts, SFXPlayer.ts, MusicPlayer.ts, SFXTriggers.ts
│   ├── /meta/              # ProgressionManager.ts, TalentTree.ts, AchievementSystem.ts
│   ├── /entities/          # PlayerFactory.ts, EnemyFactory.ts
│   ├── /scenes/            # GameScene.ts (główna scena gry)
│   └── /shared/            # /interfaces/, /types/, /constants/, /utils/
├── /data/                  # JSON: weapons, enemies, waves, talents, achievements
├── /assets/                # sprites, particles, audio, fonts, shaders
├── /.agent-workspace/      # contracts.json, progress.json
└── package.json, tsconfig.json, vite.config.ts
```

---

## Kluczowe Interfejsy

Wszystkie interfejsy znajdują się w `/src/shared/interfaces/`:

| Interfejs | Plik | Opis |
|-----------|------|------|
| `ISystem` | ISystem.ts | Bazowy interfejs dla systemów ECS |
| `IWorld` | IWorld.ts | Wrapper na bitECS World |
| `IEventBus` | IEventBus.ts | System eventów + definicje GameEvents |
| `IGame` | IGame.ts | Główny interfejs gry |
| `IRenderer` | IRenderer.ts | Rendering, sprites, particles |
| `IPhysics` | IPhysics.ts | Kolizje, spatial hash, raycast |
| `IAI` | IAI.ts | Behaviors, spawning, pathfinding |
| `IWeapon` | IWeapon.ts | Bronie, pociski, ewolucje |
| `INetworking` | INetworking.ts | Nakama, sync, prediction |
| `IAudio` | IAudio.ts | SFX, muzyka, spatial audio |
| `IUI` | IUI.ts | HUD, ekrany, komponenty UI |
| `IProcedural` | IProcedural.ts | Fale, loot, difficulty |
| `IMeta` | IMeta.ts | Talenty, osiągnięcia, save |

---

## Komponenty ECS

Zdefiniowane w `/src/shared/types/components.ts`:

### Transform
- `Position` (x, y)
- `Velocity` (x, y)
- `Rotation` (angle, angularVelocity)
- `Scale` (x, y)

### Rendering
- `Sprite` (textureId, frame, tint, alpha, layer)
- `Animation` (animationId, frameTime, speed, loop)
- `ParticleEmitter` (emitterId, active)

### Physics
- `CircleCollider` (radius, layer, mask, isTrigger)
- `RectCollider` (width, height, layer, mask)
- `Movement` (maxSpeed, acceleration, friction, mass)

### Combat
- `Health` (current, max, shield, armor, invulnerable)
- `Projectile` (damage, type, pierce, lifetime, owner)
- `WeaponSlot` (weaponId, level, cooldown)
- `DamageOverTime` (dps, duration, type)

### AI
- `AIController` (behaviorId, state, target, attackCooldown)
- `Flocking` (separation, alignment, cohesion weights)
- `Pathfinding` (targetX, targetY, waypointIndex)

### Player
- `Player` (playerId, characterId, level, xp, kills)
- `PlayerInput` (moveX, moveY, aimX, aimY, actions)
- `StatModifiers` (damageMultiplier, cooldownReduction, etc.)

### Network
- `NetworkSync` (networkId, ownerPlayerId, authority)
- `NetworkInterpolation` (prevPos, targetPos, ticks)

### Pickups
- `XPOrb` (value, magnetized, targetEntity)
- `HealthPickup` (healAmount, healPercent)
- `Pickup` (type, value, despawnTime)

### Tags (bez danych)
- `Tags.Player`, `Tags.Enemy`, `Tags.Boss`, `Tags.Projectile`
- `Tags.Pickup`, `Tags.Wall`, `Tags.LocalPlayer`, `Tags.Dead`

---

## Stałe Gry

Zdefiniowane w `/src/shared/constants/game.ts`:

```typescript
// Game Settings
GAME_WIDTH = 1920
GAME_HEIGHT = 1080
TARGET_FPS = 60
FIXED_UPDATE_RATE = 60

// ECS
MAX_ENTITIES = 10000

// Physics
SPATIAL_CELL_SIZE = 64

// Player
PLAYER_BASE_HEALTH = 100
PLAYER_BASE_SPEED = 200
PLAYER_MAX_WEAPONS = 6
PLAYER_MAX_PASSIVES = 6

// Enemies
MAX_ENEMIES = 1000
ENEMY_SPAWN_MARGIN = 100

// Waves
WAVE_INTERVAL = 30.0  // seconds
BOSS_WAVE_INTERVAL = 5  // every 5th wave

// Network
NETWORK_TICK_RATE = 20  // Hz
NETWORK_INTERPOLATION_DELAY = 100  // ms
```

---

## Eventy (GameEvents)

```typescript
// Combat
GameEvents.DAMAGE
GameEvents.ENTITY_KILLED
GameEvents.WEAPON_FIRED

// Progression
GameEvents.PLAYER_LEVEL_UP
GameEvents.UPGRADE_SELECTED
GameEvents.XP_GAINED

// Waves
GameEvents.WAVE_START
GameEvents.WAVE_COMPLETE
GameEvents.BOSS_SPAWN

// Network
GameEvents.PLAYER_CONNECTED
GameEvents.PLAYER_DISCONNECTED
GameEvents.NETWORK_STATE_UPDATE

// Audio
GameEvents.PLAY_SFX
GameEvents.PLAY_MUSIC

// Game State
GameEvents.GAME_PAUSE
GameEvents.GAME_RESUME
GameEvents.GAME_OVER
GameEvents.GAME_WIN
```

---

## Zaimplementowane Systemy

### Faza 0: Przygotowanie ✅
- Struktura katalogów
- Wszystkie interfejsy TypeScript
- Komponenty ECS (26)
- Stałe gry
- Konfiguracja Vite/TypeScript

### Faza 1: Core Foundation ✅
| System | Plik | Priority | Opis |
|--------|------|----------|------|
| EventBus | core/EventBus.ts | - | Pub/sub z typami |
| World | ecs/World.ts | - | bitECS wrapper |
| GameLoop | core/GameLoop.ts | - | Fixed timestep (60Hz) |
| AssetLoader | core/AssetLoader.ts | - | Images, audio, JSON |
| InputManager | core/InputManager.ts | - | WASD, mouse, gamepad |
| Renderer | rendering/Renderer.ts | 100 | Phaser 4 backend |
| SpriteSystem | rendering/SpriteSystem.ts | 100 | ECS -> Phaser sprites |
| AnimationSystem | rendering/AnimationSystem.ts | 95 | Frame animations |
| Camera | rendering/Camera.ts | - | Follow, shake, flash |
| SpatialHash | spatial/SpatialHash.ts | - | Grid-based (64px cells) |
| CollisionSystem | physics/CollisionSystem.ts | 15 | Broad + narrow phase |
| MovementSystem | physics/MovementSystem.ts | 10 | Velocity integration |
| PhysicsSystem | physics/PhysicsSystem.ts | 10 | Raycast, queries |

### Faza 2: Gameplay Core ✅
| System | Plik | Priority | Opis |
|--------|------|----------|------|
| DamageSystem | combat/DamageSystem.ts | 20 | Armor, crits, shields |
| ProjectileSystem | combat/ProjectileSystem.ts | 25 | Pierce, lifetime |
| WeaponSystem | combat/WeaponSystem.ts | 30 | Auto-fire, targeting |
| AISystem | ai/AISystem.ts | 40 | State machine |
| SpawnManager | ai/spawning/SpawnManager.ts | - | Edge/circle spawn |
| ParticleSystem | effects/ParticleSystem.ts | 90 | Phaser particles |
| EffectsManager | effects/EffectsManager.ts | - | Koordynator efektów |

### Faza 3: Progression & UI ✅
| System | Plik | Opis |
|--------|------|------|
| UIManager | ui/UIManager.ts | Screen stack, HUD control |
| HUD | ui/hud/HUD.ts | Health, XP, weapons, timer, kills |
| UpgradeScreen | ui/screens/UpgradeSelectionScreen.ts | 3 cards, keyboard 1/2/3 |
| PauseScreen | ui/screens/PauseScreen.ts | Resume, settings, quit |
| GameOverScreen | ui/screens/GameOverScreen.ts | Stats, restart |
| WaveGenerator | procedural/WaveGenerator.ts | Boss every 5 waves |
| DifficultyScaler | procedural/DifficultyScaler.ts | +5%/min, adaptive |
| LootGenerator | procedural/LootGenerator.ts | XP, health, specials |
| UpgradePool | procedural/UpgradePool.ts | Weighted choices |
| XPSystem | procedural/XPSystem.ts | level^1.15 scaling |
| PickupSystem | procedural/PickupSystem.ts | Magnet, collection |
| AudioManager | audio/AudioManager.ts | Master/music/SFX volumes |
| SFXPlayer | audio/SFXPlayer.ts | Pooling, spatial |
| MusicPlayer | audio/MusicPlayer.ts | Crossfade, loop points |

### Faza 4: Multiplayer ✅
| System | Plik | Opis |
|--------|------|------|
| NakamaClient | networking/NakamaClient.ts | SDK wrapper |
| NetworkManager | networking/NetworkManager.ts | INetworkManager impl |
| StateSync | networking/StateSync.ts | Snapshots, delta compression |
| Prediction | networking/Prediction.ts | Client-side, rollback |
| Interpolation | networking/Interpolation.ts | 100ms buffer |
| MatchHandler | networking/MatchHandler.ts | Lobby, ready, host migration |

### Faza 5: Content & Polish ✅ (NOWA)

#### Systemy Gameplay
| System | Plik | Opis |
|--------|------|------|
| ComboSystem | systems/ComboSystem.ts | Combo 1-10x, milestones 5/10/25/50/100 kills |
| KillStreakSystem | systems/KillStreakSystem.ts | 5 milestones: XP, +50% DMG, heal, invincibility, AOE |
| PowerUpSystem | systems/PowerUpSystem.ts | 6 power-upów (10s duration, 5% drop) |
| TreasureSystem | systems/TreasureSystem.ts | Skrzynie Bronze/Silver/Gold |
| HazardSystem | systems/HazardSystem.ts | 5 typów zagrożeń (po wave 10) |
| BossSystem | systems/BossSystem.ts | Wzorce ataków bossów, fazy |
| EliteSystem | systems/EliteSystem.ts | 5 modyfikatorów elit (5% spawn, 3x XP) |
| WeaponEvolution | systems/WeaponEvolution.ts | 3 ewolucje broni |
| DifficultySystem | systems/DifficultySystem.ts | Easy/Normal/Nightmare + endless scaling |
| DamageNumberSystem | systems/DamageNumberSystem.ts | Latające cyfry, kolory, tekst komiksowy |
| UpgradeSystem | systems/UpgradeSystem.ts | 8 nowych pasywnych zdolności |
| WaveManager | systems/WaveManager.ts | Zarządzanie falami wrogów |
| WeaponManager | systems/WeaponManager.ts | 10 broni, auto-fire, targeting |

#### Efekty Wizualne
| System | Plik | Opis |
|--------|------|------|
| GameScreenEffects | effects/GameScreenEffects.ts | Hit stop, slow motion, chromatic, vignette |
| TrailEffects | effects/TrailEffects.ts | Afterimages, trails, eksplozje, glow |

#### UI Komponenty
| System | Plik | Opis |
|--------|------|------|
| MiniMap | ui/hud/MiniMap.ts | Radar 150x150px (gracz, wrogowie, bossy, XP) |
| WaveAnnouncer | ui/WaveAnnouncer.ts | Dramatyczne ogłoszenia fal i milestones |
| AchievementPopup | ui/AchievementPopup.ts | 10 osiągnięć z animacjami slide-in |
| StatsScreen | ui/screens/StatsScreen.ts | 4 zakładki: Overview, Combat, Weapons, DPS Graph |
| StatsTracker | ui/screens/StatsTracker.ts | Śledzenie statystyk, best scores w localStorage |
| DifficultySelectionScreen | ui/screens/DifficultySelectionScreen.ts | Wybór trudności, high scores |

#### Audio
| System | Plik | Opis |
|--------|------|------|
| SFXTriggers | audio/SFXTriggers.ts | Auto-triggery na eventy, combo, abilities |

### Faza 6: Meta-Progression ✅
| System | Plik | Opis |
|--------|------|------|
| TalentTree | meta/TalentTree.ts | 26 talentów, 4 branches |
| AchievementSystem | meta/AchievementSystem.ts | 30 osiągnięć |
| ProgressionManager | meta/ProgressionManager.ts | Persistent stats |
| SaveSystem | meta/SaveSystem.ts | LocalStorage + cloud |
| SettingsManager | meta/SettingsManager.ts | Volume, controls |

---

## Bronie (10)

### Bazowe (5)
| Broń | Typ | Opis |
|------|-----|------|
| Basic Laser | Projectile | Auto-target, szybki fire rate |
| Spread Shot | Projectile | 5 pocisków w wachlarzu |
| Homing Missiles | Projectile | Śledzą wrogów |
| Plasma Cannon | Projectile | Powolny, wysokie DMG |
| Energy Shield | Area | Pasywna aura obronna |

### Nowe (5)
| Broń | Typ | Opis |
|------|-----|------|
| Lightning Chain | Chain | Przeskakuje między 4 wrogami |
| Orbital Blades | Orbital | 3 ostrza krążące wokół gracza |
| Missile Swarm | Projectile | 5 rakiet homing |
| Freeze Ray | Beam | Promień z 50% slow |
| Black Hole | Vortex | Przyciąga wrogów (pull force) |

### Ewolucje Broni
| Bazowa + Pasywna | Ewolucja | Efekt |
|------------------|----------|-------|
| Basic Laser + Damage Boost | Death Ray | Przebija wszystkich wrogów |
| Spread Shot + Multishot | Bullet Storm | 20 pocisków |
| Homing Missiles + Piercing | Smart Missiles | Idealne śledzenie + eksplozje |

---

## Wrogowie (10)

### Bazowi (5)
| Wróg | Typ | HP | DMG | Zachowanie |
|------|-----|-----|-----|------------|
| Drone | Minion | 30 | 5 | Szybki, prosty ruch |
| Charger | Minion | 25 | 15 | Szarżuje na gracza |
| Tank | Minion | 120 | 20 | Powolny, dużo HP |
| Shooter | Minion | 45 | 12 | Strzela z dystansu |
| Swarm | Minion | 15 | 3 | Bardzo szybki, słaby |

### Nowi (5)
| Wróg | Typ | HP | Specjalne |
|------|-----|-----|-----------|
| Splitter | Minion | 40 | Dzieli się na 2-3 mini przy śmierci |
| Teleporter | Minion | 35 | Teleportuje się co 3s |
| Shielder | Minion | 50 | Tarcza 120° z przodu |
| Exploder | Minion | 30 | AOE 80 radius przy śmierci |
| Healer | Support | 40 | Leczy sojuszników 5 HP/s |

### Bossy
| Boss | HP | Ataki |
|------|-----|-------|
| Mothership | 1500 | Bullet Hell, Summon Minions |
| Destroyer | 3000 | Laser Sweep, Ground Slam, Enrage |

### Elite Modifiers (5% spawn chance, 3x XP)
- **Vampiric** - Leczy się przy trafieniu
- **Fast** - +50% prędkość
- **Giant** - 2x rozmiar, 2x HP
- **Shielded** - Tarcza regenerująca
- **Explosive** - Eksploduje przy śmierci

---

## Power-Upy (6)

| Power-Up | Kolor | Efekt | Czas |
|----------|-------|-------|------|
| Double Damage | Czerwony | 2x DMG | 10s |
| Speed Boost | Żółty | +50% speed | 10s |
| Invincibility | Biały | Nieśmiertelność | 5s |
| Magnet | Zielony | Przyciąga XP/pickup | 10s |
| Multi-Shot | Niebieski | +2 pociski | 10s |
| Rapid Fire | Pomarańczowy | 2x fire rate | 10s |

Drop rate: 5% z wrogów

---

## Pasywne Zdolności (8 nowych)

| Pasywna | Efekt |
|---------|-------|
| Thorns | Odbija 20% DMG |
| Life Steal | 5% DMG = heal |
| Lucky | +15% crit chance |
| Berserker | +1% DMG za każdy 1% brakującego HP |
| Guardian Angel | Raz na grę: przeżyj z 1 HP |
| Momentum | +1% DMG za każdą sekundę ruchu (max 50%) |
| Glass Cannon | +100% DMG, -50% HP |
| Area Master | +30% obszar efektów |

---

## Zagrożenia Środowiskowe (po wave 10)

| Hazard | Efekt |
|--------|-------|
| Meteor Shower | Losowe meteory spadają z nieba |
| Electric Zone | Pulsujące strefy elektryczne |
| Poison Cloud | Wolno poruszająca się chmura DOT |
| Ice Patch | Śliska strefa, zmniejsza kontrolę |
| Lava Crack | Linie lawy, DMG przy kontakcie |

---

## System Trudności

| Poziom | HP Mult | DMG Mult | Speed | XP Mult | Odblokowanie |
|--------|---------|----------|-------|---------|--------------|
| Easy | 0.7x | 0.7x | 1.0x | 1.5x | Domyślnie |
| Normal | 1.0x | 1.0x | 1.0x | 1.0x | Domyślnie |
| Nightmare | 1.5x | 1.5x | 2.0x | 2.0x | 15 min na Normal |

**Endless Scaling:** Po 20 minutach +5%/min do HP/DMG wrogów

---

## Screen Effects

| Efekt | Trigger | Opis |
|-------|---------|------|
| Hit Stop | Critical hit | 50ms pauza |
| Slow Motion | Boss kill | 0.5x przez 0.5s |
| Chromatic Aberration | Duża eksplozja | RGB split |
| Low Health Vignette | HP < 25% | Pulsujący czerwony vignette |
| Kill Streak Glow | Serie zabójstw | Świecąca ramka |

---

## Kill Streak Milestones

| Streak | Nazwa | Nagroda |
|--------|-------|---------|
| 10 | Killing Spree | +50 XP |
| 25 | Rampage | +50% DMG przez 10s |
| 50 | Unstoppable | Heal 25% HP |
| 100 | Godlike | 10s nieśmiertelności |
| 200 | Legendary | AOE 500 DMG na cały ekran |

---

## Komendy

```bash
# Development
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run preview      # Preview production build

# Type checking
npm run typecheck    # tsc --noEmit

# Testing
npm run test         # Run vitest
npm run test:unit    # Unit tests only
npm run test:integration  # Integration tests

# Linting
npm run lint         # ESLint
```

---

## Konwencje Kodowania

### Systems
```typescript
export class MySystem implements ISystem {
  readonly name = 'MySystem';
  readonly priority = 50;  // Lower = earlier
  readonly dependencies = ['OtherSystem'];
  enabled = true;

  init(world: IWorld): void { }
  update(dt: number): void { }
  fixedUpdate?(fixedDt: number): void { }
  destroy(): void { }
}
```

### Components (bitECS)
```typescript
import { defineComponent, Types } from 'bitecs';

export const MyComponent = defineComponent({
  value: Types.f32,
  flag: Types.ui8,
});

// Usage
MyComponent.value[entity] = 100;
```

### Events
```typescript
// Emit
eventBus.emit(GameEvents.DAMAGE, {
  source: attackerEntity,
  target: targetEntity,
  amount: 50,
  type: DamageType.Physical,
  isCritical: false,
  position: { x: 100, y: 200 }
});

// Subscribe
eventBus.on<DamageEvent>(GameEvents.DAMAGE, (data) => {
  console.log(`${data.target} took ${data.amount} damage`);
});
```

---

## Ownership Agentów

| Agent | Katalogi |
|-------|----------|
| Agent-Architect | /src/shared/, /docs/ |
| Agent-Core | /src/core/, /src/ecs/ |
| Agent-Rendering | /src/rendering/, /src/effects/ |
| Agent-Physics | /src/physics/, /src/spatial/ |
| Agent-AI | /src/ai/ |
| Agent-Combat | /src/weapons/, /src/combat/ |
| Agent-Networking | /src/networking/ |
| Agent-Procedural | /src/procedural/ |
| Agent-UI | /src/ui/ |
| Agent-Audio | /src/audio/ |
| Agent-Meta | /src/meta/, /src/progression/ |

---

## Znane Problemy i Rozwiązania

### Screen Effects przy Game Over
- Problem: Czerwony vignette pozostawał po śmierci
- Rozwiązanie: `screenEffects.clearAll()` przed `isPaused = true` w `gameOver()`
- Plik: `src/scenes/GameScene.ts:2297`

### noUnusedLocals w TypeScript
- Wyłączone w `tsconfig.json` dla kompatybilności z nowym kodem
- Zmienne przygotowane na przyszłe użycie mają prefix `_`

---

## TODO (Pozostałe)

- [ ] Dodanie assetów graficznych (sprites, particles)
- [ ] Dodanie assetów audio (SFX, music)
- [ ] Balans parametrów (damage, health, speed)
- [ ] Więcej ewolucji broni
- [ ] Dodatkowe postacie do wyboru
- [ ] Lokalizacja (i18n)
- [ ] Tutorial
- [ ] Testy E2E
- [ ] Optymalizacja dla mobile
