# One More Relic v1.1

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

- **Play:** create or join a 1–8 player dungeon room with a five-character code, or play solo.
- **Quickplay:** enter an active public dungeon or duel lobby; a new room is created when none is available.
- **Duel playlist:** 2–4 players remain together while ten arenas rotate. Health and temporary power reset each round, and defeated rivals drop temporary upgrades.
- **Dungeon Creator:** build 2–5 stage expeditions on maps up to 64 × 44 tiles. Place enemies, bosses, upgrade chests, relic vaults, keys, locked doors, traps, and lights. Published local maps expire after one hour with no active run; blueprints remain saved.

Dungeon stages increase enemy health, damage, elite frequency, and encounter pressure. The final stage contains the authored boss. Party size raises boss health and adds reinforcement and projectile mechanics at larger player counts.

## Controls

- WASD or arrows: move
- Mouse and hold left click: aim and attack
- Space: dash
- E: open a nearby chest or unlock a door
- L: toggle the wide lantern beam
- P: pause

Touch devices use the movement pad, automatic targeting, and on-screen Dash/Open controls.

## Progression and saves

Upgrade chests grant direct run upgrades such as attack speed, critical chance, elemental shots, dash recovery, and wards. Relic vaults cost more gold or consume a dungeon key and offer one of three stackable relics. Chest price is `baseCost + increase × openedChests`, configured per dungeon.

Loadouts, blueprints, published local maps, settings, cosmetic unlocks, and selected skins use browser local storage. Existing v1 saves migrate in place: old chest tiles become relic vaults and retain their original map, creature, lighting, and pricing data. JSON backup import/export remains available.

## Architecture and current scope

The client is a Canvas/JavaScript game. An Express and Socket.IO TypeScript server owns room membership, room codes, capacity, host actions, movement bounds, stage/round rotation, and public quickplay discovery. Remote movement and party state are synchronized. Combat entities still run in each client for this local mock-up; moving combat resolution into a persistent authoritative simulation is the main production hardening step.

`Dockerfile` and `.env.example` provide deployment scaffolding. The full product and engineering requirements are in [docs/MASTER_SPEC.md](docs/MASTER_SPEC.md) and [docs/MASTER_SPEC_V1_1.md](docs/MASTER_SPEC_V1_1.md).

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
