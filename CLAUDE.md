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
- 137 plików TypeScript
- ~38,500 linii kodu
- 0 błędów kompilacji

---

## Struktura Katalogów

```
/cosmic-survivors/
├── /src/
│   ├── /core/              # Game.ts, GameLoop.ts, EventBus.ts, AssetLoader.ts, InputManager.ts
│   ├── /ecs/               # World.ts, /components/, /systems/, /queries/
│   ├── /rendering/         # Renderer.ts, SpriteSystem.ts, Camera.ts, AnimationSystem.ts
│   ├── /effects/           # ParticleSystem.ts, ScreenEffects.ts, DamageNumberRenderer.ts, TrailRenderer.ts
│   ├── /physics/           # PhysicsSystem.ts, CollisionSystem.ts, MovementSystem.ts
│   ├── /spatial/           # SpatialHash.ts
│   ├── /ai/                # AISystem.ts, /behaviors/, /pathfinding/, /spawning/, /definitions/
│   ├── /weapons/           # WeaponFactory.ts, /definitions/ (5 broni)
│   ├── /combat/            # DamageSystem.ts, ProjectileSystem.ts, WeaponSystem.ts
│   ├── /networking/        # NetworkManager.ts, NakamaClient.ts, StateSync.ts, Prediction.ts, Interpolation.ts
│   ├── /procedural/        # WaveGenerator.ts, LootGenerator.ts, DifficultyScaler.ts, UpgradePool.ts, XPSystem.ts
│   ├── /ui/                # UIManager.ts, /hud/, /screens/, /components/
│   ├── /audio/             # AudioManager.ts, SFXPlayer.ts, MusicPlayer.ts
│   ├── /meta/              # ProgressionManager.ts, TalentTree.ts, AchievementSystem.ts, SaveSystem.ts
│   ├── /entities/          # PlayerFactory.ts, EnemyFactory.ts
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

**Bronie (5):**
- MagicWand (Projectile, auto-target)
- Knife (Projectile, directional, fast)
- Garlic (Area, passive aura)
- Whip (Melee, horizontal sweep)
- FireWand (Projectile, pierce, slow)

**Wrogowie (5):**
- Bat (Minion, fast swarm)
- Skeleton (Minion, balanced)
- Zombie (Minion, slow tanky)
- Ghost (Elite, pass through walls)
- Ogre (Elite, very tanky)

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

### Faza 6: Meta-Progression ✅
| System | Plik | Opis |
|--------|------|------|
| TalentTree | meta/TalentTree.ts | 26 talentów, 4 branches |
| AchievementSystem | meta/AchievementSystem.ts | 30 osiągnięć |
| ProgressionManager | meta/ProgressionManager.ts | Persistent stats |
| SaveSystem | meta/SaveSystem.ts | LocalStorage + cloud |
| SettingsManager | meta/SettingsManager.ts | Volume, controls |

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

## TODO (Faza 5: Content & Polish)

- [ ] Dodanie assetów graficznych (sprites, particles)
- [ ] Dodanie assetów audio (SFX, music)
- [ ] Balans parametrów (damage, health, speed)
- [ ] Pozostałe 45 broni + ewolucje
- [ ] Więcej typów wrogów
- [ ] Boss encounters
- [ ] Dodatkowe postacie
- [ ] Lokalizacja (i18n)
- [ ] Tutorial
- [ ] Testy E2E
