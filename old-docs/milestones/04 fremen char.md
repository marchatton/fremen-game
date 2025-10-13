# Milestone 4: Low-Poly Character System

## Overview
Implement the playable Fremen character: procedural low-poly mesh, basic animations (idle, walk, run, jump), integrated with a responsive, networked character controller using client-side prediction and server reconciliation. Introduce basic survival mechanics (water).

## Requirements

### 4.1 Low-Poly Character Generation
- Refine `LowPolyMeshFactory`: Add function to generate a complete character mesh (target 150-300 polys total) within `client/src/lowpoly/` or `client/src/entities/`. Use simplified proportions (Unturned style). Generate a single mesh if possible. Use vertex coloring primarily; minimal UVs only if essential.
- Implement basic customization parameters (e.g., selecting from 2-3 pre-defined color palettes for clothing via vertex colors).
- Create simplified collision representation (Physics capsule: height, radius).
- Implement basic LOD (2 levels: 150-300 polys, 75-150 polys) based on distance.

### 4.2 Smooth Animation System
- Rig the generated character mesh: Use a minimal skeleton (target 12-15 bones). Ensure clean weights.
- Create core animations: Idle, Walk, Run, Jump (simple jump arc: take-off, apex, landing). Use minimal keyframes. Store animations potentially in `client/src/assets/animations/`.
- Implement Three.js `AnimationMixer`. Create a simple state machine (e.g., using strings or enums: `IDLE`, `WALKING`, `RUNNING`, `JUMPING`).
- Implement basic animation blending: Use `crossFadeTo()` for smooth transitions (target 100-200ms) between states.
- Network sync: Send current animation state ID (e.g., 1 byte enum value) in `S_GAME_STATE`. Client plays the corresponding animation on remote players, blending smoothly if the state changes.

### 4.3 Fortnite-Inspired Character Controller
- Client: Refine `InputManager` (M1). Map WASD to desired movement vectors, Space to jump intent, Shift to run intent.
- Client: Implement Client-Side Prediction loop (`client/src/physics/` or `client/src/game/`):
    - Store sequence number for each input.
    - Apply input locally to a *client-side physics simulation* (position, velocity). Use simple physics: apply force based on input, basic gravity, check against *client-side representation* of terrain height (from M3). Clamp position to terrain.
    - Send input packet `C_INPUT` {sequence number, input vector, jump pressed, dt} to server (e.g., ~20Hz).
    - Store history of recent inputs and resulting states.
- Server: Process `C_INPUT` (`server/src/core/` or `server/src/game/`):
    - Apply input to *server-side physics simulation* (using authoritative terrain height from M3). Clamp position.
    - Store processed input sequence number per player.
- Server: Modify `S_GAME_STATE` broadcast (~20Hz) to include {`playerId`, `position`, `rotation`, `velocity`, `animationState`, `lastProcessedInputSequence`}.
- Client: Implement Reconciliation (`client/src/networking/` or `client/src/physics/`):
    - On receiving `S_GAME_STATE`: Compare server position with client's predicted position for `lastProcessedInputSequence`.
    - If discrepancy > threshold (e.g., 0.1 units): Re-simulate client forward from the server state using stored inputs after `lastProcessedInputSequence`. Snap client state to the re-simulated state. *Alternative (simpler start):* Gently lerp client visual position towards server position over ~100ms. Log significant corrections.
- Implement basic jump logic (apply upward velocity on Space press, server validates). Implement basic run logic (increase movement speed on Shift press).
- Implement basic third-person camera follow logic: Camera position stays behind player, rotates with mouse/touch input. Basic collision detection (raycast from player to camera, move camera closer if obstructed).

### 4.4 Networked Player State
- Refine state sync: Ensure position, rotation, velocity, animation state, and sequence numbers are included in `S_GAME_STATE`. Use efficient serialization. Document the exact byte layout.
- Server validation: Add basic anti-cheat - validate movement speed based on inputs. Log violations.
- Implement client-side interpolation for *remote* players based on `S_GAME_STATE`. Ensure smooth movement.

### 4.5 Survival Mechanics (Water Only)
- Server: Add `waterLevel` (0-100) to player state. Decrease based on activity (use animation state). Clamp at 0.
- Server: Implement basic water collection placeholder: If player sends `C_INTERACT` near a predefined "water source" location, replenish water level. Add cooldown. Validate distance server-side.
- Server: Add `waterLevel` to `S_GAME_STATE`.
- Client: Display `waterLevel` on a basic HUD element (`client/src/components/hud/` or `ui/`). Add simple visual effect if water < 10%.

## Deliverables
- Low-poly Fremen character model generated procedurally.
- Basic Idle, Walk, Run, Jump animations integrated.
- Networked character controller with client-side prediction and server reconciliation.
- Basic third-person follow camera.
- Basic water survival mechanic (depletion, simple collection).
- Updated network protocol documentation for `C_INPUT` and `S_GAME_STATE`.

## Testing and Validation
- Characters generate procedurally within poly limits (150-300).
- Animations play correctly based on movement state.
- Movement feels responsive (<100ms perceived lag) with client prediction under moderate latency (e.g., 100ms).
- Server reconciliation corrects minor position errors smoothly.
- Players stay on terrain and basic server validation prevents impossible speeds.
- Water level decreases and can be replenished; HUD shows level.