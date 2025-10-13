# Milestone 13: Sietch Settlements and Social Hubs

## Overview
Implement a basic Fremen Sietch layout as a non-combat social hub, including placeholder NPCs offering basic services (trade interaction point). Introduce concept of clan housing (no customization yet).

## Requirements

### 13.1 Sietch Design and Generation
- Architecture: Define modular pieces (corridors, small/medium chambers) using low-poly style (`client/src/lowpoly/` or `assets/`). Use vertex colors.
- Generation: Implement simple procedural algorithm server-side to generate a basic Sietch layout at a predefined location. Store layout data. Server sends layout data `S_SIETCH_LAYOUT { data }` to clients entering the area.
- Client Rendering: Client receives layout data and generates/places the modular pieces. Add appropriate lighting. Add simple entrance interaction.

### 13.2 NPC System (Placeholders)
- NPCs: Server spawns placeholder static NPCs (simple Fremen character models from M4) at fixed locations within the generated Sietch layout. Assign basic roles (e.g., "Merchant", "Guard"). Broadcast NPC info {`id`, `position`, `role`} in Sietch state update.
- Dialogue Placeholder: Client interacts (`C_INTERACT_NPC { npcId }`). Server sends back hardcoded text based on NPC role `S_NPC_DIALOGUE { npcId, text }`. Client displays text in simple UI panel (`client/src/components/dialogue/`).

### 13.3 Social Hub Services (Trade Placeholder)
- Trading: Interacting with "Merchant" NPC opens a simple UI panel. Server defines basic items the merchant "sells". Player sends `C_TRADE_ITEM { npcId, itemId, action [buy/sell] }`. Server validates if player has enough spice/item, updates player inventory (M8), sends confirmation/error. Use placeholder prices.

### 13.4 Player Housing and Customization (Clan Association Only)
- Clan System: Implement basic server-side clan tracking (`playerId -> clanId`, `clanId -> memberIds[]`). Add server commands `/createClan name`, `/inviteToClan player`, `/joinClan clanId`, `/leaveClan`. Store associations in DrizzleORM (`server/src/db/`).
- Housing Placeholder: Designate one chamber within the generated Sietch as the "Clan Hall" for a specific clan (hardcoded association). Players of that clan see a simple "Clan Hall" label when inside.

### 13.5 Social Activities and Events (Defer)
- Defer ceremonies, competitions, entertainment, scheduled events.

## Deliverables
- Basic procedurally generated Sietch interior layout.
- Placeholder static NPCs with simple interaction dialogue.
- Basic NPC merchant trading functionality (buy/sell predefined items with Spice).
- Server-side clan creation/joining/leaving functionality with persistence.
- Designated "Clan Hall" concept within Sietch for clan members.

## Testing and Validation
- A basic procedurally generated Sietch interior can be entered.
- Placeholder Fremen NPCs are present.
- Interacting with NPCs displays simple text.
- Interacting with a Merchant NPC allows basic buying/selling of placeholder items using Spice resource.
- Players can create/join/leave clans via commands; membership persists.
- Clan members can identify a designated "Clan Hall" chamber.
- Sietch area supports multiple players concurrently without major issues.