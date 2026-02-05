# Cosmic Survivors

**Survive. Evolve. Dominate.**

Bullet Heaven / Roguelite multiplayer game built with Phaser 4, bitECS and Nakama.

Battle endless waves of cosmic enemies, build devastating weapon combinations, unlock power thresholds and become the ultimate survivor.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)
![Phaser 4](https://img.shields.io/badge/Phaser-4.0--beta-purple.svg)

---

## Features

- **Bullet Heaven gameplay** - auto-firing weapons, hordes of enemies, satisfying power scaling
- **11 weapons** - Basic Laser, Spread Shot, Homing Missiles, Orbital Shield, Lightning, Flamethrower, Lightning Chain, Orbital Blades, Missile Swarm, Freeze Ray, Black Hole
- **12 enemy types** - Drone, Charger, Tank, Shooter, Swarm, Splitter, Teleporter, Shielder, Exploder, Healer + 2 bosses (Mothership, Destroyer)
- **Time progression system** - 7 power thresholds with logarithmic scaling (Warming Up → Ascended)
- **Weapon evolution** - upgrade weapons into powerful evolved forms
- **Combo & kill streak systems** - chain kills for multipliers and rewards
- **3 difficulty modes** - Easy, Normal, Nightmare
- **Practice mode** - test weapons and builds without pressure
- **Environmental hazards** - asteroid fields, ion storms, ice patches, fire zones, gravity wells
- **Elite enemies** - 5% spawn chance with special modifiers and 3x XP
- **Power-ups** - 6 types with 10-second duration
- **Treasure chests** - Bronze, Silver, Gold with scaling rewards
- **Meta progression** - 26 talents across 4 branches, 30 achievements, persistent save
- **Multiplayer ready** - Nakama backend with client-side prediction and server reconciliation
- **Full website** - 10-page promotional site with game guide, bestiary and changelog

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | [Phaser 4](https://phaser.io/) (beta) |
| ECS | [bitECS](https://github.com/NateTheGreatt/bitECS) |
| Language | TypeScript (strict mode) |
| Build | Vite 5 |
| Backend | [Nakama](https://heroiclabs.com/nakama/) |
| Deploy | Vercel |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Type check
npm run typecheck

# Production build (game + website)
npm run build:deploy
```

## URL Parameters

The game supports URL parameters for quick configuration:

```
# Standard mode (default)
http://localhost:3000/

# Practice mode - invincible, no enemies, auto-level every 5s
http://localhost:3000/?mode=practice

# Difficulty selection
http://localhost:3000/?difficulty=easy
http://localhost:3000/?difficulty=normal
http://localhost:3000/?difficulty=nightmare
```

## Project Structure

```
src/
├── core/           # GameLoop, EventBus, InputManager, AssetLoader
├── ecs/            # bitECS World, components, systems, queries
├── rendering/      # Phaser renderer, sprites, camera, animations
├── effects/        # Particles, screen effects, damage numbers, trails
├── physics/        # Collision, movement, spatial hash
├── ai/             # Enemy behaviors, pathfinding, spawning
├── weapons/        # Weapon definitions and evolution
├── combat/         # Damage, projectiles, weapon system
├── networking/     # Nakama client, state sync, prediction
├── procedural/     # Waves, loot, difficulty, upgrades, XP
├── ui/             # HUD, upgrade screen, pause, game over
├── audio/          # SFX, music, spatial audio
├── meta/           # Talents, achievements, save system
├── systems/        # Combo, kill streaks, hazards, power-ups, etc.
├── scenes/         # GameScene (main gameplay)
└── shared/         # Interfaces, types, constants, utils
website/            # Promotional website (10 HTML pages)
```

## Stats

- 170 TypeScript files
- ~64,000 lines of code
- 37+ game systems
- 0 compilation errors

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow Keys | Move |
| Mouse | Aim |
| Space | Dash |
| Q | Ultimate |
| E | Bomb |
| R | Shield |
| 1 / 2 / 3 | Select upgrade |
| ESC | Pause |

## License

MIT

## Built With AI

This project was built using a multi-agent AI architecture with 11 specialized agents, each responsible for a different game subsystem.
