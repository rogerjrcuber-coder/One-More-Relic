# One More Relic v1.2.6

A top-down dungeon crawler built around short multiplayer expeditions, player-made dungeons, escalating run upgrades, rare relic combinations, and a rolling duel playlist.

## Run locally

Double-click **START-GAME.cmd**. It builds the TypeScript server, starts One More Relic on `http://127.0.0.1:8000`, and serves the Socket.IO multiplayer client. If the local runtime is missing, run:

```powershell
python scripts/bootstrap_node.py
```

For development:

```powershell
npm install
npm run dev
```

Production-style commands are `npm run build`, `npm test`, and `npm start`. Copy `.env.example` to `.env` when configuring a public host or origin.

## Game modes

- **Play:** create or join a 1–8 player dungeon room with a five-character code, including authored maps already in progress. Starting a private room alone switches directly to a solo run.
- **Quickplay:** match into an active public session or wait in a queue. Quickplay requires at least two players and starts automatically when player two joins.
- **Waves:** 1–8 players share an arena across five-wave sets, then move together to the next arena.
- **Duel playlist:** 2–4 players remain together while fourteen arenas rotate. Health and temporary power reset each round.
- **Dungeon Creator:** build 2–5 stage expeditions on maps up to 64 × 44 tiles. Place enemies, bosses, upgrade chests, relic vaults, keys, locked doors, traps, and lights. Published local maps expire after one hour with no active run; blueprints remain saved.

Dungeon stages use branching modular layouts across Mosskeep, Crystal Caverns, Sunken Ruins, Infernal Forge, and Forgotten Gardens. Procedural events, optional vaults, secrets, biome hazards, and customized enemies vary each expedition. Party size and stage depth scale enemy and boss pressure.

## Controls

- WASD or arrows: move
- Mouse and hold left click: aim and attack
- Space: dash
- E: open a nearby chest or unlock a door
- L: toggle the wide lantern beam
- P: pause

Touch devices use the movement pad, automatic targeting, and on-screen Dash/Open controls.

Graphics Quality defaults to Detailed. Choose Low / potato mode in Settings to reduce render resolution, wall-aware light rays, particles, glow, and texture detail.

## Progression and saves

Upgrade chests grant direct run upgrades such as attack speed, critical chance, elemental shots, dash recovery, and wards. Relic vaults cost more gold or consume a dungeon key and offer one of three stackable relics. Chest price is `baseCost + increase × openedChests`, configured per dungeon.

Loadouts, blueprints, published local maps, settings, cosmetic unlocks, and selected skins use browser local storage. Existing v1 saves migrate in place: old chest tiles become relic vaults and retain their original map, creature, lighting, and pricing data. JSON backup import/export remains available.

## Authoritative multiplayer

The Express and Socket.IO TypeScript server owns movement, collision, enemies, projectiles, damage, loot, chests, doors, revives, stages, waves, duel rounds, trades, and room membership. Clients send sequenced inputs, predict their own movement, replay unacknowledged inputs after snapshots, and interpolate other entities. Protocol 12 rejects incompatible frontend/backend deployments rather than allowing corrupt sessions.

Published custom maps are server validated, can be joined by room code after a run starts, and expire after one hour without an active room. The current map and room registries live in one server process; multi-instance deployment requires a shared state service and sticky Socket.IO routing.

`Dockerfile` and `.env.example` provide deployment scaffolding. The full product and engineering requirements are in [docs/MASTER_SPEC.md](Multiplayer%20WebGame%20Repository/docs/MASTER_SPEC.md), [v1.2](Multiplayer%20WebGame%20Repository/docs/MASTER_SPEC_V1_2.md), and [v1.2.1](Multiplayer%20WebGame%20Repository/docs/MASTER_SPEC_V1_2_1.md).

## Tests

The regression suites use isolated headless Edge contexts and never access a real browser profile:

```powershell
python smoke_test.py
python feature_test.py
python chest_test.py
python v11_test.py
```

Server checks run with:

```powershell
npm run build
npm test
npm run test:multiplayer
```

Screenshots are written to `test-results/`. All game art is drawn locally with Canvas and CSS.

## Railway deployment

This repository includes `Multiplayer WebGame Repository/railway.json` for deploying the Node/Socket.IO server through GitHub. In Railway, create a service from this repository, set the service root directory to `Multiplayer WebGame Repository`, and use the generated public Railway URL as the backend address.

Set these variables in Railway:

```text
HOST=0.0.0.0
PUBLIC_ORIGIN=https://your-sites-domain.example
```

Railway supplies `PORT` automatically. The service uses `npm ci && npm run build`, starts with `npm start`, and checks `/api/health`. The frontend's `omr-server-url` meta tag should contain the Railway URL when the frontend remains on Sites; leave it empty when Railway serves the frontend and backend from the same origin.
