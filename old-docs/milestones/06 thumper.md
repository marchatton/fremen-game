# Milestone 6: Thumper and Worm Attraction System

## Overview
Implement deployable Thumpers that generate persistent vibrations, attracting nearby worms based on the simple AI developed in M5.

## Requirements

### 6.1 Low-Poly Thumper Items
- Model 1-2 basic thumper variants (`client/src/entities/thumper/`) using `LowPolyMeshFactory` (target 100-200 polys). Use vertex colors. Add simple animation (e.g., rotating/pulsing part) when active.
- Inventory Placeholder: Server command `/giveThumper playerId type` adds a thumper to player's conceptual inventory. Client UI shows if player has a thumper.
- Deployment: Client sends `C_DEPLOY_THUMPER { position }`. Server validates position (on terrain, not too close to another thumper). If valid, create a thumper entity server-side at that position, assign unique ID, set state to `ACTIVE`, set timer (e.g., 60s). Remove from player's conceptual inventory. Add thumper state {`id`, `position`, `type`, `isActive`, `remainingTime`} to `S_GAME_STATE` (or `S_OBJECT_STATE`).
- Client: Show placement preview (simple cylinder) before sending `C_DEPLOY_THUMPER`. Render thumpers based on broadcasted state, playing animation if active.

### 6.2 Vibration Propagation Mechanics (Server-Side)
- Server: When a thumper becomes `ACTIVE`, mark it as a persistent vibration source at its location with a specific intensity (e.g., Small=5, Medium=8) and range (e.g., Small=100m, Medium=200m).
- Server: Worm AI Enhancement: In the worm's update loop, check for active thumpers within its detection range. Calculate perceived intensity based on distance (simple falloff).

### 6.3 Worm Attraction Behavior
- Server Worm AI: Modify state machine:
    - If patrolling and detect thumper vibration > threshold: Switch to `ATTRACTED_TO_THUMPER` state.
    - `ATTRACTED_TO_THUMPER`: Set target destination to the thumper's position. Move towards it (using spline path generation from M5). If thumper becomes inactive or worm gets very close (e.g., <10m), switch back to `PATROLLING` after a delay.

### 6.4 Visual and Audio Feedback
- Client: Enhance active thumper visuals: Add simple particle effect (e.g., pulsing dust cloud) around active thumpers.
- Client: Enhance thumper audio: Play positional looping "thump" sound for active thumpers.
- Client: Basic worm attraction feedback: If player is near (<50m) an active thumper that a worm is `ATTRACTED_TO_THUMPER`, show a simple directional indicator pointing towards the incoming worm. Use worm state from broadcast.

### 6.5 Multiplayer Strategic Elements (Minimal)
- Allow multiple players to deploy thumpers. Worms should be attracted to the *strongest* perceived vibration source. Server calculates this.

## Deliverables
- Basic deployable Thumper item (1-2 variants).
- Server-side vibration source representation for active thumpers.
- Worm AI modified to be attracted to active thumpers.
- Network synchronization of thumper state (position, active status, timer).
- Basic visual/audio feedback for active thumpers and attracted worms.

## Testing and Validation
- Players can deploy thumpers via command/simple UI action.
- Thumpers appear in the world and are synchronized.
- Active thumpers emit sound/visuals.
- Worms within range change behavior to move towards active thumpers.
- If multiple thumpers are active, worms move towards the most attractive one.
- Thumpers deactivate after a timer.