# Milestone 7: Worm Riding Mechanics (Basic Mounting/Control)

## Overview
Implement the core worm riding loop: mounting a worm attracted by a thumper, basic directional control, and dismounting.

## Requirements

### 7.1 Mounting Mechanics
- Server Worm AI: Add `APPROACHING_THUMPER` state. When worm gets close (<10m) to an active thumper it's attracted to, it slows down and enters this state for a period (e.g., 10-15s), becoming mountable.
- Client: Display a visual indicator (e.g., highlight, icon) on worm segments when the worm is in `APPROACHING_THUMPER` state and player is nearby (<5m). This is the mounting zone/window.
- Client: Add "Mount" interaction prompt. If player interacts during this window: send `C_ATTEMPT_MOUNT { wormId }`.
- Server: On `C_ATTEMPT_MOUNT`: Validate worm exists, is in `APPROACHING_THUMPER` state, player is close enough. If valid:
    - Set player state to `RIDING {wormId}`.
    - Set worm state to `RIDDEN_BY {playerId}`.
    - Disable regular player physics/controls for the rider.
    - Parent player's logical position to a point on the worm's back (e.g., 2nd segment).
    - Broadcast the state change in `S_GAME_STATE`.
- Client: On receiving state update showing player is `RIDING`: Attach player model visually to the worm model. Change camera to "worm riding" mode. Change input context.

### 7.2 Worm Riding Controls (Basic Steering)
- Client: When player state is `RIDING`, interpret WASD/input not as player movement, but as worm steering intent (Left/Right changes desired direction, W increases target speed slightly, S decreases). Send `C_WORM_RIDE_INPUT { wormId, directionIntent, speedIntent }`.
- Server: When worm is `RIDDEN_BY {playerId}`:
    - Ignore regular worm AI pathfinding.
    - Process `C_WORM_RIDE_INPUT` from the controlling player.
    - Update the worm's spline curve target direction based on `directionIntent`. Limit turn rate.
    - Update the worm's target speed based on `speedIntent`. Limit min/max speed (e.g., 5-25 m/s).
    - Continue updating worm segment positions based on the spline in the server loop.
    - Continue broadcasting worm state (control points) in relevant state update message.
- Client: Player visually follows worm movement. Camera stays in riding mode.

### 7.3 Multi-Rider Mechanics (Defer)
- Defer passenger system, roles, team coordination. Only one rider per worm for now.

### 7.4 Special Worm Capabilities (Defer)
- Defer combat, terrain manipulation, special movement. Worm is primarily transport.

### 7.5 Dismounting and Consequences
- Client: Add "Dismount" key/button (e.g., 'E'). Send `C_DISMOUNT { wormId }`.
- Server: On `C_DISMOUNT`:
    - Validate player is riding the specified worm.
    - Set player state back to `ACTIVE`. Re-enable player physics/controls slightly away from the worm.
    - Set worm state back to `PATROLLING` (after a short cooldown).
    - Broadcast state changes.
- Client: On receiving state update showing player is no longer `RIDING`: Detach player model visually, switch camera back, restore normal input context.

## Deliverables
- Ability for worms to enter a temporary "mountable" state near thumpers.
- Client-side interaction prompt for mounting.
- Server-side validation for mounting attempts.
- Player state change to "riding" with visual attachment and camera change.
- Basic worm steering controls driven by player input when mounted.
- Basic dismounting mechanic restoring player control.
- Network synchronization of riding state and player-controlled worm movement.

## Testing and Validation
- Player can deploy a thumper, attract a worm.
- When the worm slows near the thumper, the player can approach and use an interaction to mount it.
- Player character model attaches visually. Camera changes.
- Player can use basic directional controls (WASD) to steer the worm.
- The worm's movement updates across all clients.
- Player can dismount safely, detaching from the worm.