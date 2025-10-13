# Milestone 11: Mission and Objective System

## Overview
Implement a system for players to accept, track, and complete simple missions with basic objective types (e.g., go-to, collect, eliminate) and receive placeholder rewards. Persist mission state.

## Requirements

### 11.1 Mission Framework
- Data Structure: Define simple mission structure (JS object/JSON): `id`, `title`, `description`, `objectives` (array), `rewards` (placeholder text). Define basic objective structure: `id`, `type` (GOTO, COLLECT, ELIMINATE), `target` (position, itemId, aiId), `requiredAmount`, `currentAmount`. Store mission definitions server-side.
- Management: Implement server logic to track active missions per player/team (`playerId -> activeMissionIds[]`, `missionId -> {progress}`). Allow players to accept missions (e.g., via interaction or command). Send `C_ACCEPT_MISSION { missionId }`. Server validates, adds to player's active list, sends initial state.
- Synchronization: Server sends `S_MISSION_UPDATE { missionId, objectiveId, currentAmount, isComplete }` when progress occurs. Client updates UI. On connect, server sends state of all active missions.
- Persistence (DrizzleORM): Store `player_missions` table (`playerId`, `missionId`, `status`, `objectiveProgress` [JSON blob]). Load/save on connect/disconnect/completion.

### 11.2 Objective Types and Mechanics (Basic Set)
- `GOTO`: Target = position. Server checks if player position is within radius. Update `currentAmount`.
- `COLLECT`: Target = itemId (from M8), requiredAmount. Server checks player inventory. Update `currentAmount`.
- `ELIMINATE`: Target = aiId or aiType (from M10), requiredAmount. Server increments `currentAmount` on player kill (requires kill attribution in M10).
- Server Logic: Hook into relevant systems (movement, inventory, AI death) to check objective progress. Update progress and send `S_MISSION_UPDATE`.

### 11.3 Mission UI and Tracking
- Mission Log UI: Simple panel (`client/src/components/missions/`) showing list of Active/Completed missions (titles). Allow selecting one mission to "track".
- Objective Indicators: If tracking a mission: Display current objective text on HUD. Show waypoint marker for `GOTO` or relevant targets. Use Dune UI style (M15).
- Notifications: Simple text pop-up ("Objective Updated", "Mission Complete") triggered by `S_MISSION_UPDATE`.

### 11.4 Reward System (Placeholder)
- Definition: Add placeholder reward info to mission definition (e.g., `rewards: { xp: 100, items: ["Spice Pouch"] }`).
- Distribution: When server detects mission completion, send `S_MISSION_COMPLETE { missionId, rewards }`. Log reward distribution server-side.
- Client: Show "Mission Complete" notification. Move mission to "Completed" list in UI.

### 11.5 Mission Progression and Narrative (Minimal)
- Basic Chain: Implement simple prerequisite logic (Mission B available after Mission A complete). Server checks completion status from DB.
- Narrative: Use mission title/description/objective text for basic context.

## Deliverables
- Server-side framework for defining and tracking missions/objectives.
- Basic objective types implemented (GoTo, Collect, Eliminate).
- Simple UI for viewing active missions and tracking current objective.
- Waypoint system for tracked objectives.
- Placeholder reward notification on mission completion.
- DrizzleORM persistence for player mission progress.

## Testing and Validation
- Player can accept missions.
- Mission appears in UI log.
- Active objectives displayed on HUD with waypoints if applicable.
- Progress updates correctly based on player actions (moving, collecting spice, eliminating AI).
- Mission completion triggers notification and placeholder reward info.
- Mission state persists across sessions.