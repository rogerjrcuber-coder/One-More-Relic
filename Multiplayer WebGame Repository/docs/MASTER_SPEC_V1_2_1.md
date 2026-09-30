One More Relic - Master Prompt v1.2.1 (Map Variety & Procedural Layout Rework)

This update addresses a major design issue:

Maps currently feel repetitive, predictable, and solved too quickly.

The goal is to make every run feel slightly different while still allowing handcrafted content and dungeon creation.

Map Design Philosophy

Maps should not feel identical between runs.

Players should know:

"I'm in the Crystal Caverns"


while still feeling:

"This run is different from last time."


Maps should combine:

Handcrafted structure
Procedural variation
Random encounters
Random objectives
Optional branches
Original Dungeon Rework

The current dungeon must be redesigned.

Problems:

Predictable routes
Repeated layouts
Low exploration value
Minimal decision making


Goals:

Multiple paths
Optional routes
Key-gated areas
Secret rooms
Branching progression
Randomized sections


Players should make route decisions instead of simply moving toward the exit.

4 New Dungeon Biomes

Add four new major dungeon environments.

Each biome requires:

Unique visuals
Unique enemies
Unique lighting
Unique hazards
Unique boss themes

Crystal Caverns

Features:

Light-reactive crystals
Reflective projectiles
Hidden crystal paths
Dark cavern sections

Sunken Ruins

Features:

Flooded rooms
Water movement penalties
Collapsed passages
Underwater treasure vaults

Infernal Forge

Features:

Lava hazards
Moving platforms
Fire enemies
Heat-based mechanics

Forgotten Gardens

Features:

Poison plants
Living roots
Dense foliage
Nature-themed bosses

Dungeon Module System

Maps should be built from reusable modules.

Never hardcode entire dungeon layouts.

Module Examples
Combat Room
Crossroads
Treasure Room
Dark Room
Puzzle Room
Vault Room
Boss Antechamber
Secret Passage
Key Room
Merchant Room

Assembly Logic

Example:

Entrance
↓
Random Combat Room
↓
Crossroads
↓
Random Branch
↓
Key Room
↓
Locked Door
↓
Boss Room


The same dungeon can produce multiple valid layouts.

Random Spawn Sections

Maps may contain optional sections.

Each section has a spawn chance.

Example:

Hidden Vault
40% Chance


Possible outcomes:

Appears
or
Does Not Appear


This increases replayability.

Dynamic Room Variants

Rooms should support variations.

Example:

Crystal Room A
Crystal Room B
Crystal Room C


When generated:

Random Variant Selected


Players should not immediately recognize every room.

Procedural Dungeon Events

Each run may choose random events.

Examples:

Darkness Event
Treasure Event
Elite Hunt
Double Key Event
Boss Empowerment
Wandering Merchant


These modify a run without changing the core map.

Branching Path System

Maps should contain:

Main Path
Optional Path
Secret Path
Risk/Reward Path


Example:

Proceed to Exit

or

Explore Gold Key Branch


The optional path should offer stronger rewards.

Multi-Stage Map Logic

All dungeon stages should feel unique.

Avoid:

Stage 1 = Stage 2


Examples:

Stage 1
Crystal Mines

Stage 2
Ancient Crystal Temple

Stage 3
Crystal King's Throne


Each stage evolves the theme.

Waves Mode Map Expansion

Waves mode requires additional arenas.

Current arena count is insufficient.

Add:

4 New Waves Arenas


Examples:

Corrupted Courtyard
The Furnace
Collapsed Fortress
Crystal Basin

Waves Arena Variation

Every arena should support:

Random Obstacles
Random Enemy Spawn Zones
Random Elite Events
Random Hazard Events


Example:

Match 1:
Lava Hazard

Match 2:
Darkness Hazard

Match 3:
Poison Hazard


Same arena feels different.

Duel Mode Map Expansion

Add:

4 New PvP Maps

Duel Map Design

Each map should support different playstyles.

Examples:

Arena Type
Symmetrical
Competitive
Skill Driven

Vertical Arena
Platforms
Jump Routes
Ambush Opportunities

Close Quarters Arena
Fast Combat
Shotgun Friendly

Open Battleground
Long Range Combat
High Mobility

Duel Randomization

A duel map should not always play the same.

Possible randomized features:

Blocked Hallway
Open Shortcut
Elevator Enabled
Bridge Spawned
Side Area Open


Players should adapt every match.

Encounter Randomization

Enemy groups should not be fixed.

Avoid:

Room A always has the same enemies


Instead:

Room A pulls enemies from a themed pool


Example:

Crystal Zone

Pool:
Crystal Charger
Crystal Spitter
Crystal Mage
Crystal Tank


Random group compositions are generated.

Boss Arena Variants

Boss arenas can also randomize.

Possible additions:

Extra Pillars
Darkness Mode
Lava Pools
Poison Pools
Side Minion Spawners


The same boss encounter should remain recognizable but not identical every run.

Long-Term Goal

Every run should have players asking:

"What spawned this time?"

rather than:

"I already know exactly what's around the next corner."

All dungeon, waves, and duel maps should be built using modular, reusable, configurable room systems that support future procedural generation while preserving handcrafted quality.