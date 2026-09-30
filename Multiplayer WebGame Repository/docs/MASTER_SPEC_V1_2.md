One More Relic - Master Prompt v1.2 (Multiplayer & Game Mode Rework)

Use this prompt to update the architecture and gameplay systems of One More Relic.

Core Multiplayer Philosophy

One More Relic is a multiplayer-first game.

The game must feel alive because players are sharing the same world.

Players should never feel like they are playing separate instances of the same dungeon.

Server Authority Requirements

The server is authoritative.

The server owns:

Enemy Positions
Enemy AI
Boss AI
Enemy Health
Player Health
Damage Calculation
Relic Rewards
Dungeon State
Stage Progression
Loot Spawns
Key Spawns
Door States


Clients are visualization layers only.

No gameplay-critical logic should exist solely on the client.

Pause System Rework

Multiplayer sessions cannot be paused.

When more than one player is connected:

Pause Disabled


Opening menus should:

Freeze Inputs
Keep World Running
Keep Simulation Running


Never stop:

Enemy AI
Projectiles
Timers
Boss Mechanics
Networking


If a player opens inventory during combat, the game continues normally.

Networked Enemy System

All enemies must be synchronized across:

Server
Player 1
Player 2
Player 3
Player 4


Enemy updates include:

Position
Animation State
Current Target
Aggro State
Health
Status Effects
Ability Casts
Death State


Every player must see the same enemy behavior.

Player Interaction System

Players must be able to interact with one another throughout the game.

Player Interactions

Support:

Revive Players
Ping Locations
Trade Gold
Trade Keys
Trade Consumables
Emotes
Inspect Builds
View Equipped Relics


Future support:

Guilds
Friends
Parties
Clans

Waves Mode (Former Duels)

The existing "Duel" mode is renamed.

New name:

Waves


Purpose:

Cooperative Survival

Waves Flow

Players survive increasingly difficult enemy waves.

Wave 1
↓
Wave 2
↓
Wave 3
↓
...


Each wave becomes harder.

Scaling Variables

Increase:

Enemy Count
Enemy Variety
Elite Spawns
Boss Frequency
Modifier Frequency

Stage Progression

Every few waves:

Stage Complete
↓
Rewards
↓
New Arena
↓
Continue


Example:

Stage 1
Wave 1-5
↓
Stage 2
Wave 6-10
↓
Stage 3
Wave 11-15

New Duel Mode

Duel becomes a true PvP mode.

Purpose:

Player vs Player Combat

Duel Player Count
2-4 Players

Duel Flow
Players Spawn
↓
Fight
↓
Last Player Standing Wins
↓
Score Awarded
↓
Next Map Loads

Player Damage

Players can damage:

Other Players


Players cannot damage teammates in non-PvP modes.

Duel Match Duration

Target:

3-8 Minutes


Fast and replayable.

Duel Rotation System

Duels use a rolling playlist.

Players stay together after a match ends.

Rotation Flow
Map Ends
↓
Winner Declared
↓
Temporary Upgrades Removed
↓
New Map Loads
↓
Next Match Begins


No lobby return unless players leave.

Arena Upgrade System

Upgrade pickups spawn during matches.

Examples:

Triple Shot
Fire Damage
Ice Projectiles
Charge Dash
Poison Shots
Chain Lightning

Upgrade Reset

At the end of every duel:

All Match Upgrades Removed


Everybody starts the next arena equally.

Duel Map Pool

Release target:

10 Handcrafted PvP Maps


Examples:

Ancient Garden
Lava Core
Crystal Cavern
Ruined Temple
Frozen Fortress
Shadow Arena
Sunken Ruins
Storm Citadel
Void Platform
Forgotten Keep

Quickplay Rework

Quickplay now supports all major modes.

Quickplay Menu
Dungeon Quickplay
Waves Quickplay
Duel Quickplay

Quickplay Dungeon

Joins:

Active Public Dungeon

Quickplay Waves

Joins:

Existing Survival Session


or

Creates New Session

Quickplay Duel

Joins:

Existing PvP Playlist


or

Creates New Duel Session

Multi-Stage Progression Requirements

Every gameplay mode should have progression.

Dungeon Stages

Minimum:

2 Stages


Example:

Crypt Entrance
↓
Frozen Depths
↓
Boss Chamber

Waves Stages

Example:

Arena 1
5 Waves
↓
Arena 2
5 Waves
↓
Arena 3
Final Boss

Player Presence System

Players should never feel isolated.

Always display:

Player Names
Health
Status Effects
Current Stage
Ping Indicator


Nearby players should be visible on:

Minimap
Party UI
Scoreboard

Social Features

Add lightweight multiplayer communication.

Emotes

Examples:

Wave
Laugh
Point
Dance
Thumbs Up

Ping System

Players can ping:

Enemies
Doors
Keys
Loot
Bosses
Locations

Updated Game Modes
Dungeon
1-8 Players
Cooperative
Multi-Stage
Player-Created Content
Boss Relics

Waves
1-8 Players
Cooperative Survival
Infinite Scaling
Stage Progression

Duel
2-4 Players
PvP
Rolling Playlist
Upgrade Pickups
10 Arena Maps

Architecture Requirements

Codex must build networking around:

Server Authority
State Replication
Client Prediction
Server Reconciliation
Lag Compensation
Interpolation


The game should be designed to scale from:

Small Friend Groups


to

Hundreds of Concurrent Rooms


without requiring architectural redesign.

Success Criteria

A player should be able to:

Launch the game.
Join friends instantly.
Interact with teammates.
Complete multi-stage dungeons.
Survive Waves mode.
Enter PvP Duel playlists.
Fight other players fairly.
See synchronized enemies across all clients.
Experience smooth multiplayer without desync.
Never encounter gameplay that can be paused by another player.

End of Master Prompt v1.2 - Multiplayer, Waves, and PvP Rework.