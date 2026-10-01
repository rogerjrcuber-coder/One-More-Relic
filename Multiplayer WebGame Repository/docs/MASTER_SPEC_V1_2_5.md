# One More Relic v1.2.5 — World Interaction, Workshop UX, Keys & Environment

This addendum extends the cumulative master specification. It takes precedence
over earlier requirements where they conflict. Preserve existing saves,
loadouts, blueprints, multiplayer synchronization, and performance settings.

## Keys and collectible feedback

Keys are recognizable physical world models, not generic shards. Each key has
a clear silhouette and biome-appropriate treatment, with at least red iron,
blue crystal, green vine, purple arcane, and gold royal variants. A player
should identify a key at a glance and distinguish it from gold or ordinary
loot.

Gold and keys use server-authoritative pickup magnetism. On entering a pickup
radius, the collectible accelerates toward the eligible player and is collected
on contact. Key attraction is slightly stronger than gold. Replicate the
movement and collection result to every client.

## Typed doors and progression keys

Creators can place any practical number of locked doors. Every door stores a
name, position, colour, and required key type. The initial colour set is red,
blue, green, purple, and gold; adding future types must be data-driven.

Maps support repeated same-colour doors and mixed door/key puzzles. Door keys
are consumed only by their matching locked doors and are intended for stage
progression, secrets, boss access, optional areas, and branching routes.

Vaults never consume door keys. Vault costs use gold, boss tokens, ancient
coins, or other dungeon currency so a player cannot accidentally spend a
required progression key.

## Merchants

Merchants may be placed by creators and generated procedurally. They offer
server-authoritative purchases for a gold price, including health, mana,
shield, speed, damage, and revive potions; lantern fuel; and temporary buffs.
Merchant inventory, prices, stock, and effects are explicit data so future
items can be added without special-case code.

## Environmental layers and decoration

Each run has a gameplay layer, visual layer, and exploration layer:

- Gameplay: enemies, typed keys, typed doors, objectives, and rewards.
- Visual: biome-specific foliage, debris, lighting, atmosphere, and decor.
- Exploration: secrets, merchants, rare events, optional areas, and routes.

Procedural decoration varies every run and is based on biome. Supported
families include bushes, grass, flowers, roots, crystals, rocks, bones,
statues, mushrooms, debris, and torches.

Decor only appears on walkable floor tiles. It never overlaps walls, doors,
water, pits, lava, objectives, pickups, or gameplay-critical entities. Keep at
least ten tiles between independent decor placements unless a defined cluster
asset deliberately manages its own spacing. Decorations remain visual-only and
must not alter authoritative collision or make navigation unreadable.

## Workshop UX

On desktop, the workshop behaves as a fit-to-window level editor: no page-level
horizontal or vertical scrollbars, responsive panels, unused-space collapse,
scaled sections, and a canvas that resizes to the available editor area.
Mobile may use vertical scrolling when necessary.

Door editing includes colour, name, and required-key selection. Merchant
placement and configuration are first-class workshop tools. Workshop UI keeps
its existing creator, enemy, lighting, and pricing controls.

## Multi-boss progression

Dungeons support multiple bosses across stages or in the same stage, within
explicit balancing limits. Creators can create sequential, parallel, split-path,
mini-boss, and stage-progression encounters.

Every required boss is an objective. A stage exit remains locked while any
required boss lives and unlocks only when all required bosses are defeated.
The objective UI always lists remaining bosses or reports the remaining count.

Boss configuration supports type, duplication, removal, required status, final
boss designation, and rewards. Rewards may grant keys, doors, vault access,
merchant access, relics, secret routes, and stage-exit progress.

A final boss has the largest reward pool and can own final relic drops and the
victory trigger. Active bosses scale for party size through health, minions,
mechanics, and attack frequency; scaling must add encounter complexity rather
than only health.

## Acceptance criteria

A finished v1.2.5 implementation provides recognizable keys, satisfying
server-synchronized collection, multiple typed door puzzles, non-key vault
costs, useful merchants, varied biome decor, a clean desktop workshop, and
multi-boss objectives with clear exit locking and multiplayer scaling.
