One More Relic - Master Prompt v1.1

Current baseline: the original specification below plus [v1.1 additions and reworks](MASTER_SPEC_V1_1.md).

The v1.1 requirements take precedence where they change v1.0: dungeon parties support 1–8 players, all dungeons have 2–5 stages, common upgrade chests and rare relic vaults are separate systems, and duels use a continuing 2–4 player playlist. Preserve the editable chest base cost and per-opening increase added after v1.0. Preserve existing saves through explicit migrations.

The source text below is retained as the original v1.0 specification for requirements not superseded by v1.1. This document describes the target product; README.md records the current implementation and validation status.

---

One More Relic - Original Master Prompt v1.0

Use this prompt as the root instruction for Codex. Every future prompt should build upon this specification unless explicitly overridden.

Role

You are a senior game engineer, systems architect, UI/UX designer, and multiplayer backend developer responsible for building and maintaining One More Relic.

Your objective is to create a production-quality browser game that can be deployed to @Site at any time.

This is not a prototype.

Every change must maintain a functional, deployable build.

Game Vision

One More Relic is a browser-based cooperative roguelite where players create and share dungeons with friends.

Players publish dungeons to a public pool.

Published dungeons remain available while being played.

When a dungeon has not been played for 60 minutes, the published copy is automatically deleted.

The creator's local blueprint remains available for editing and republishing.

Players collect relics that combine into increasingly powerful builds.

No account is required.

Joining friends should be as simple as entering a room code.

The core emotional loop is:

"Let's do one more run."

"I just need one more relic."

Core Design Pillars
1. One More Run

Runs should be:

Fast to start
Easy to restart
Easy to join

Target duration:

10-20 minutes

Players should never spend excessive time in menus.

2. Player-Created Content

Players generate most game content.

Creators can build:

Dungeons
Monsters
Bosses
Encounters
Lighting challenges
Unique reward experiences

Developers provide systems, tools, balancing, and assets.

3. Temporary Worlds

Published content is intentionally temporary.

Dungeon lifecycle:

Blueprint Created
↓
Dungeon Published
↓
Players Join
↓
Dungeon Remains Active
↓
Last Player Leaves
↓
60 Minute Inactivity Timer Starts
↓
No Players Return
↓
Published Copy Deleted
↓
Creator Blueprint Preserved


This mechanic helps keep exploration fresh and prevents stale content.

4. Build Expression

Players start weak.

Relics stack and interact.

Power progression should feel:

Weak
↓
Capable
↓
Powerful
↓
Ridiculous


Relic combinations should create surprising outcomes.

Technical Stack

Frontend:

React
TypeScript
Phaser
Tailwind


Backend:

Node.js
TypeScript
Socket.IO


Storage:

Browser LocalStorage
JSON Exports
JSON Imports


Deployment:

Docker
Vercel-compatible frontend
Fly.io-compatible backend
@Site deployment ready

Production Requirements

All generated code must:

Build successfully
Pass type checking
Support production deployment
Avoid placeholder code
Avoid TODO-only implementations
Avoid broken imports
Avoid dead code


The project must remain deployable after every feature addition.

Save Data Requirements

No account system is required.

Primary persistence:

LocalStorage


Data saved locally:

Loadouts
Dungeon blueprints
Creator statistics
Settings
Saved Loadouts

Players can save multiple loadouts.

Example:

{
  "name": "Shadow Runner",
  "weapon": "Twin Daggers",
  "movementSkill": "Blink",
  "starterPerk": "Quickstep"
}


Requirements:

Create
Edit
Delete
Duplicate
Export
Import
Blueprint Storage

Player-created dungeons are stored locally.

Example:

{
  "name": "Crypt of Echoes",
  "tiles": [],
  "enemies": [],
  "boss": {},
  "relicReward": {}
}


Blueprints survive publication expiry.

Export / Import

Support:

Export Dungeon
Import Dungeon

Export Loadout
Import Loadout


Format:

JSON


Backward compatibility must be preserved.

Dungeon Editor

Creators must be able to build dungeons without coding knowledge.

Tile Types
Floor
Wall
Torch
Crystal
Water
Lava
Pit
Spawn
Chest
Boss Room

Dungeon Sizes

Default:

100 x 100


Large:

200 x 200


Maximum:

500 x 500


Implement chunk streaming for large maps.

Lighting System

Darkness is a gameplay mechanic.

Not merely decoration.

Lantern

Players begin with a lantern.

Properties:

Fuel
Light Radius
Recharge State


Behavior:

Fuel slowly drains
Radius shrinks when fuel is low
Recharged by environmental lights
Light Sources

Creators can place:

Torches
Crystals
Braziers
Magic Beacons


Capabilities:

Illuminate area
Recharge lantern
Guide navigation
Darkness Zones

Rooms may:

Reduce vision
Suppress lights
Create shadow enemies
Disable minimap
Trigger special mechanics

Monster Builder

Monsters are component-based.

No enemy should require custom code.

Monster Archetypes
Charger
Assassin
Tank
Spitter
Summoner
Support

Monster Stats
{
  "health": 100,
  "damage": 10,
  "speed": 4,
  "range": 250
}

Monster Modifiers
Explosive
Poison
Teleporting
Shielded
Reflective
Regenerating
Fast
Split On Death
Life Drain


Modifiers are combinable.

Example:

Spitter
+
Poison
+
Teleporting

Boss Builder

Bosses are phase driven.

Creators build bosses by selecting mechanics.

No coding required.

Phase One

Selectable attacks:

Charge
Fan Shot
Beam
Summon Minions
Ground Slam

Phase Two

Selectable mechanics:

Teleport
Darkness
Arena Hazards
Enrage
Shield Phase

Phase Three

Selectable mechanics:

Clone Copies
Meteor Rain
Arena Collapse
Infinite Summons
Void Zone

Relic System

Relics are the central progression mechanic.

Starter Relics

Selected before entering a dungeon.

Balanced and limited.

Run Relics

Found during gameplay.

Reset after each run.

Relic Philosophy

Relics should:

Stack
Interact
Scale
Create surprising synergies


Avoid generic stat boosts whenever possible.

Boss Relics

Creators attach a unique relic reward to their dungeon.

Examples:

Ice Crown
Venom Heart
King's Sigil
Shadow Lantern


The dungeon becomes associated with that reward.

Players revisit dungeons to hunt specific relics.

Creator Statistics

Track:

Plays
Unique Players
Deaths
Clear Rate
Average Completion Time
Likes


Example display:

The Hollow King

412 Players
3.8% Clear Rate
1274 Deaths

Multiplayer

Party Size:

2–8 Players


Joining Method:

Room Codes


Networking:

Socket.IO
WebSockets

Server Authority

Clients are never trusted.

Server validates:

Player Loadouts
Movement
Damage
Relics
Boss Rewards
Dungeon Publications


Prevent modified local saves from granting advantages.

Performance Requirements

Target:

60 FPS


Requirements:

Chunk Streaming
Object Pooling
Spatial Partitioning
Light Culling
Network Optimization
Efficient Collision Systems


Must function on average desktop and mobile browsers.

UI Principles

UI should be:

Clean
Readable
Responsive
Controller Friendly
Mobile Friendly
Fast


Prioritize gameplay over menu complexity.

Accessibility

Support:

Colorblind Modes
UI Scaling
Key Rebinding
Reduced Motion
Volume Controls
Subtitles

Save Compatibility

Never break:

Loadouts
Blueprints
Exports
Statistics
Settings


If schema changes occur:

Create migration
Detect version
Auto-upgrade data

Modding Philosophy

Every major system should be data-driven.

Avoid hardcoded content.

Prefer:

Configuration Files
JSON Definitions
Reusable Components
Composable Systems


Future modding support must always be considered.

Deployment Requirements

The project must always remain deployable to @Site.

Every commit should support:

npm run dev
npm run build
npm run start
docker build


No feature should leave the project in a non-deployable state.

Success Criteria

A completely new player should be able to:

Open the website.
Join with no account.
Enter a room code.
Play within seconds.
Collect relics.
Create a loadout.
Build a dungeon.
Create a boss.
Publish a dungeon.
Share it with friends.
Return later and continue playing.
Codex Working Rules

For every task:

Analyze existing code before modifying it.
Reuse systems when possible.
Preserve backward compatibility.
Keep the project deployable.
Prefer configurable systems.
Maintain strict TypeScript typing.
Document architectural changes.
Optimize for future expansion.
Avoid duplicated logic.
Build as if One More Relic will eventually support thousands of published dungeons simultaneously.

End of Master Prompt v1.0.
