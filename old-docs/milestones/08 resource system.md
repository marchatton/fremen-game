# Milestone 8: Resource System Implementation (Water, Spice Basics, Equipment Placeholders)

## Overview
Implement core resource loops: water consumption/collection, basic spice node interaction, and placeholder equipment slots affecting water rate. Persist basic resource state using DrizzleORM.

## Requirements

### 8.1 Water Resource System
- Refine M4 system: Server decreases water based on activity (Idle/Walk/Run state). Environmental factors (placeholder: simple "hot day" flag halves starting water). Add thirst stages (mild: slight speed debuff; moderate: stronger debuff, visual effect; severe: health drain - *requires basic health system*).
- Water Collection: Implement specific "Oasis" zones. Player sends `C_INTERACT` when inside zone. Server validates, replenishes water (e.g., +50), adds cooldown (e.g., 5 mins per oasis). Track oasis cooldowns server-side.
- Persistence: On player disconnect, save current `waterLevel` to DB (DrizzleORM). On connect, load `waterLevel`.
- Feedback: Refine HUD indicator. Add sound effect on entering thirst stages.

### 8.2 Spice Resource Collection (Basic)
- Spice Nodes: Server procedurally places "Spice Node" locations (simple coordinates) based on seed. Add state {`id`, `position`, `currentAmount`, `maxAmount`, `respawnTimer`}. Broadcast node locations/state in `S_GAME_STATE` (or separate message if too large).
- Client: Render simple visual representation (e.g., shimmering particle effect) at spice node locations.
- Collection: Player sends `C_INTERACT { nodeId }` when near a node. Server validates distance. If valid and `currentAmount > 0`:
    - Give player "spice" resource (add `spiceAmount` to server-side player state).
    - Decrement `nodeAmount`.
    - If `nodeAmount` reaches 0, start `respawnTimer` (e.g., 5-10 mins).
    - Send updated player `spiceAmount` and node state.
- Client: Update HUD to show `spiceAmount`. Update node visual when depleted/respawning.
- Persistence: Save/load player `spiceAmount`. Save/load spice node states (or regenerate based on seed and track elapsed time).

### 8.3 Equipment Management (Placeholders)
- Conceptual Slots: Server adds placeholder slots to player state (e.g., `headSlot`, `bodySlot`) storing an item ID (initially `null`).
- Basic Items: Define 2-3 basic items conceptually (e.g., `Basic Stillsuit`, `Improved Stillsuit`). Give them IDs.
- Equip Command: Server command `/equip playerId slotId itemId`. Server validates item exists, updates player slot state.
- Effect: Modify server-side water consumption rate based on equipped `bodySlot` item (e.g., Basic Stillsuit = -25% rate, Improved = -50%).
- Persistence: Save/load equipped item IDs per slot.

### 8.4 Resource UI and Feedback
- Refine HUD: Show Water level, Spice amount.
- Add basic inventory screen placeholder: Simple UI panel listing equipped items (by name/ID) and Spice amount.
- Feedback: Add simple text notification ("+1 Spice collected", "Water replenished", "Thirsty"). Add sound effects for collection.

### 8.5 Shared Resources and Trading (Defer)
- Defer all sharing, trading, faction systems.

### Database Integration (DrizzleORM)
- Set up DrizzleORM (`server/src/db/` or `core/`) with basic schema for `players` table ( `playerId`, `waterLevel`, `spiceAmount`, `headSlotItemId`, `bodySlotItemId`, etc.).
- Implement basic load/save functions triggered on player connect/disconnect. Ensure DB calls are async and don't block server loop.
- Potentially add schema for `spiceNodes` if saving their state is preferred over regeneration.

## Deliverables
- Refined water management system with consumption rates and thirst effects.
- Basic spice node generation and collection mechanic.
- Placeholder equipment slots impacting water consumption.
- Basic HUD/UI for displaying resources.
- Server-side validation for resource interactions.
- DrizzleORM integration saving/loading core resource/equipment state per player.

## Testing and Validation
- Player water level decreases based on activity and equipped suit (via command).
- Player can collect water at designated oasis zones.
- Spice nodes appear in the world; players can interact to collect spice, depleting the node which then respawns.
- HUD shows water/spice amounts.
- Basic player resource/equipment state persists between sessions using DrizzleORM.
- Server validation prevents basic exploits (e.g., collecting from empty node).
