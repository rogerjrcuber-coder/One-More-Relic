# v1.2 / v1.2.1 implementation plan

Status: specifications captured; implementation pending. This document describes required work, not shipped features.

## Requirements and precedence

The supplied [v1.2 specification](MASTER_SPEC_V1_2.md) defines multiplayer, Waves, and true PvP. [v1.2.1](MASTER_SPEC_V1_2_1.md) extends it with modular maps and procedural variation. These take precedence over conflicting v1.1 behavior. Preserve local loadouts, blueprints, backup imports/exports, chest pricing, and deletion only after a published map has no players for one hour.

Interpret the four additional PvP maps as additions to the ten-map v1.2 release pool: fourteen maps total. Retain suitable existing arenas for Waves and add four distinct arenas. Use the existing top-down presentation; elevations, bridges, lifts, and jump routes need explicit traversal and collision rules, not merely visual decoration.

## Current gaps verified in source

- `game.js` simulates enemy AI, projectiles, damage, pickups, keys, chests, doors, and stage advancement independently in each browser.
- `server/index.ts` accepts proposed player positions and checks endpoints. It has no combat simulation, protocol negotiation, acknowledged input sequence, or swept collision. Raising the client snap distance does not establish prediction/reconciliation.
- `server/rooms.ts` handles only dungeon and duel, gives players positional spawn offsets without checking those offsets for walls, and permits host-triggered stage advances without completion checks.
- Menus and browser blur set `game.paused`; network events and input timers have no complete run lifecycle cleanup.
- The smoke test verifies only one small positional increase. It cannot establish sustained synchronized movement, wall safety, shared combat, or deployment compatibility.
- The last live investigation found Railway serving an older movement protocol than the Sites frontend. Verify both deployed versions before claiming online fixes.

## 1. Establish simulation and protocol ownership

Create a typed, browser-independent simulation with shared movement/collision rules. Advance rooms at a fixed tick rate using bounded work per tick. Clients send sequenced input commands, never authoritative positions, health, damage, loot, or progression. The server validates loadouts, input bounds, action rates, and room membership.

Snapshots carry protocol/build version, room/run identity, stage revision, server tick, and last processed input sequence per player. Predict local movement with the same collision rules; reconcile by restoring acknowledged state and replaying only unacknowledged commands. Interpolate other entities from buffered snapshots. Limit any historical hit validation to a bounded server-owned history and server-validated timestamps.

Require an initial snapshot before accepting gameplay input. Clear pending inputs on stage changes, disconnect, leave, and reconnect. Expire held input after a short timeout. Reject incompatible clients visibly instead of allowing silent snap-back. Add build and protocol identifiers to health responses and deployment checks.

## 2. Move all shared gameplay to the server

Move existing weapon, relic, creature, and boss behavior into data and simulation modules. Preserve existing mechanics during extraction. The server owns AI targets, aggression, cast state, status effects, enemy death, projectiles, player health, damage, gold, keys, consumables, chest openings, reward choices, doors, and portal eligibility.

Resolve simultaneous interactions atomically. Preserve adjustable chest base price and per-opening increase. Validate proximity, line of sight, currency, and offered reward choices. Network clients render replicated state and may predict cosmetic effects; they do not run a second combat simulation.

Opening a menu or losing focus clears only that player's input while snapshots and world simulation continue. Multiplayer has no pause action. Define single-player pause as a server decision and automatically resume when another player joins.

## 3. Implement modes, progression, and quickplay

- Dungeon: 1-8 players; at least two distinct stages; shared progression, authored content, themed boss rewards, and server-managed active-map expiry.
- Waves: 1-8 players; co-op survival with increasing counts, themed groups, elites, modifiers, and boss frequency. Reward and rotate arena after each five-wave stage. Preserve the party and run progression.
- Duel: 2-4 players; genuine PvP without AI stand-ins; last survivor receives score, everyone resets temporary upgrades, and the next arena starts automatically. Support draws, disconnects, waiting for enough players, and a bounded round timer targeting 3-8 minutes.
- Quickplay: independent queues for all three modes, sensible late joining, and automatic start once minimum membership is satisfied.

Spawn match upgrades in Duel: triple shot, fire, ice, charge dash, poison, and chain lightning. Clear all match upgrades on rotation. Disable friendly damage in cooperative modes.

## 4. Player presence and interactions

Add replicated names, health, status effects, stage, and measured latency to party UI and scoreboard; include nearby teammates on the minimap. Add server-validated revives, location/entity pings, emotes, and build inspection. Gold/key/consumable transfers require owned balances and an atomic transfer; never let a requester debit another player. Define an explicit consumable inventory and use behavior so consumable trading is functional.

## 5. Modular content and procedural assembly

Build configurable room modules with tagged connectors, encounter sockets, objective slots, hazard zones, and room variants. Use a server-selected seed and distribute the resolved layout to every player. Preserve handcrafted creator maps through explicit schema migration; optional procedural sections must not rewrite existing blueprints.

Redesign Mosskeep with a main route, alternate route, secret area, key-gated reward branch, and risk/reward choices. Validate connected entrances/exits, player clearance, key-before-door reachability, and accessible boss/reward objectives. Generate stages with distinct structures and evolving themes.

Add Crystal Caverns, Sunken Ruins, Infernal Forge, and Forgotten Gardens with distinct visuals, lighting, enemies, bosses, and actual gameplay mechanics: reactive crystals/reflections/hidden paths; flooding and slow movement; lava/moving platforms/heat; poison plants/roots/foliage. Assemble encounters from biome pools.

Add optional-section probabilities, random room variants, boss-arena modifiers, and darkness, treasure, elite hunt, double key, empowered boss, and wandering merchant events. Merchant events require server-owned stock, prices, and purchases.

Add Corrupted Courtyard, The Furnace, Collapsed Fortress, and Crystal Basin to Waves, with randomized obstacles, spawn zones, elites, and hazards. Author fourteen distinct PvP compositions with validated balanced spawns, varied engagement distances, alternate traversal, and safe randomized shortcuts, bridges, lifts, and side areas.

## 6. Acceptance and deployment gates

- Sustained movement in two isolated browsers: both players travel beyond the old snap threshold, stop, dash, collide with walls, and see matching authoritative positions under added latency.
- Shared enemy targeting, casts, projectiles, health, death, loot, keys, doors, and stages. Concurrent chest claims cannot duplicate rewards.
- Open menus and blur one browser while another observes continued combat and timers; clear held input.
- Revive, ping, emote, inspect, and transfer each supported resource; reject invalid targets, amounts, and spoofed state.
- Dungeon completion, Waves scaling/rotation, Duel PvP/scoring/reset/draw, all quickplay paths, late joins, host departure, and reconnect cleanup.
- Many-seed topology tests plus visual review for biome identity, stage variety, fourteen Duel arenas, and additional Waves arenas. Verify traversal and mandatory objectives remain reachable.
- Existing local saves and JSON backups import successfully. Verify inactive-map expiry and blueprint retention.
- Run compilation, unit and integration checks, real browser regressions, and a measured room-load test. Report observed capacity rather than asserting support for hundreds of rooms without evidence.
- Publish compatible backend and frontend artifacts, verify deployed build identifiers and Socket.IO handshake, then run the sustained two-browser acceptance test against production before announcing success.

Keep each migration independently reviewable. Do not publish a partially converted combat path as the finished v1.2 release.
