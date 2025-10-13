# Milestone 5: Low-Poly Sandworm System

## Overview
Implement basic sandworms: procedural low-poly model, spline-based movement, simple AI (patrol, respond to vibration placeholder), and networked synchronization. Focus on achieving the intended *fluid animation* style.

## Requirements

### 5.1 Low-Poly Worm Modeling and Fluid Animation
- Procedural generation: Create function in `LowPolyMeshFactory` to generate a worm mesh (`client/src/entities/worm/`). Use a segment-based approach (e.g., 10-16 segments). Each segment target 100-150 polys. Define distinct head/tail segments. Use vertex colors. Total polys might be 1k-2.5k.
- Fluid Animation: Use `THREE.CatmullRomCurve3` to define the worm's path.
    - Represent the worm's state as a series of points defining the curve.
    - In the render loop, generate segment positions/orientations along the curve. Position segments equidistant. Orient segments to face along the curve tangent.
    - Implement basic undulation by adding a sine wave offset perpendicular to the curve direction, varying along the curve's length. Tune wavelength/amplitude.
- Network Optimization: Send only the curve control points (e.g., 8-12 points) in `S_GAME_STATE` (or `S_AI_STATE`) for each worm.
- Client Interpolation: Client receives control points. Recreate the CatmullRom curve locally. Interpolate *control point positions* smoothly (`lerp`) between updates before recreating the curve for rendering. Target smooth visuals even with 10-20Hz updates.

### 5.2 Fluid Worm Physics and Movement (Server AI Driven)
- Server AI (`server/src/core/ai/` or `server/src/entities/ai/`): Implement simple state machine (e.g., `PATROLLING`, `INVESTIGATING`).
    - `PATROLLING`: Define a target point. Generate a CatmullRom curve towards the target. Update curve control points over time to simulate movement. Check terrain height to keep worm "on" sand. Define basic speed (e.g., 10-20 m/s). Pick a new target point when close.
    - `INVESTIGATING`: Placeholder - If a "vibration" event occurs nearby, switch state, move towards the source, then return to `PATROLLING`.
- Server Physics: Keep very simple. Use the curve for position. Perform basic terrain height checks.
- Network: Server updates worm state (control points, AI state) and includes it in `S_GAME_STATE` or `S_AI_STATE`.

### 5.3 Worm AI Behavior (Basic)
- Implement the simple `PATROLLING`/`INVESTIGATING` state machine described above.
- Vibration Detection Placeholder: Add a server-side debug command `/emitVibration x z` that triggers worms within a radius to enter `INVESTIGATING` state.

### 5.4 Networked Worm Spawning
- Server: Maintain a list of active worms (e.g., max 1-3 for testing).
- Implement simple spawning: On server start, or via debug command `/spawnWorm x z`, create a new worm entity with a unique ID, initialize its state (`PATROLLING`), and add it to the state broadcast. Spawn away from players initially.
- Implement simple despawning: If a worm is very far from all players, or via debug command `/despawnWorm id`, remove it from the state broadcast.

### 5.5 Worm-Environment Interaction (Minimal)
- Implement basic sound: Play a looping "rumble" sound effect client-side, positionally based on the worm's head location. Adjust volume based on distance.

## Deliverables
- Procedurally generated low-poly sandworm model.
- Smooth, spline-based worm movement animation.
- Basic server-side AI (patrol, placeholder investigation).
- Network synchronization of worm state (control points).
- Basic worm spawning/despawning via debug commands.
- Basic positional audio for worms.

## Testing and Validation
- Server can spawn/despawn worms via debug commands.
- Clients see worms appear/disappear.
- Worms move smoothly across the terrain using spline-based animation.
- Worm movement is synchronized across clients using interpolated control points.
- Basic patrol behavior is visible.
- Debug command can trigger a temporary "investigation" movement.
- Performance stays acceptable with a few worms active.