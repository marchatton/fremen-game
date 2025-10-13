# Milestone 3: Low-Poly Procedural Terrain Generation

## Overview
Generate a deterministic, chunked, low-poly desert terrain mesh with basic LOD, vertex coloring, and integrate it with a simplified physics system for basic *server-side* collision detection (player vs. terrain). *(Terrain generation logic likely resides in `client/src/terrain/`, client-side physics aspects in `client/src/physics/`, server-side collision checks in `server/src/core/` or `server/src/physics/`)*.

## Requirements

### 3.1 Low-Poly Procedural Terrain Generation
- Implement seed-based generation: Use a specific seed (e.g., hardcoded for now, later from server) for noise generation. Use a standard JS noise library (e.g., `simplex-noise`).
- Generate height data using multi-octave Simplex noise (3-4 octaves recommended). Define parameters (frequency, amplitude, persistence, lacunarity) to create desert features (large dunes, flats, rocky areas - use noise value thresholds). Ensure this generation logic is identical on client and server (shared utility function).
- Implement chunking: Define chunk size (e.g., 32x32 units). Generate `BufferGeometry` for each chunk based on the height data. Target polygon counts per chunk LOD level (e.g., 800 -> 400 -> 200 -> 100 polys). Ensure correct indexing and normal calculation. Use vertex colors based on height and slope (e.g., brown/yellow for sand, grey for rock). Apply vertex welding to reduce vertex count.
- Implement dynamic chunk loading/unloading based on player position (simple radius check, e.g., 6 chunks view distance). Use a `Map` to store active chunks. Implement basic async generation (e.g., using Promises or async functions) to avoid blocking the main thread.
- Implement simple LOD: Based on distance from camera to chunk center, switch between pre-generated mesh representations (or regenerate with lower resolution). Use simple distance thresholds.

### 3.2 Stylized Sand Rendering
- Create a basic GLSL shader for the terrain material (`client/src/shaders/terrain.vert/.frag`, managed by `client/src/materials/`). Use `MeshStandardMaterial` as base is fine. Use vertex colors for the primary look. Add a subtle effect based on world position/time for wind ripples (simple vertex displacement in vertex shader).

### 3.3 Optimized Physics System (Server-Side Focus)
- Server: Store terrain height data efficiently (e.g., 2D array per chunk).
- Server: Implement *basic* server-side physics validation. On receiving `C_UPDATE_PLAYER_STATE` (from M2), check if the player's `y` position is above the terrain height at their `x, z` coordinates. If below, clamp their `y` position to the terrain height (+ small offset). Include this corrected position in the `S_GAME_STATE` broadcast.
- Client: Player movement simulation remains simple for now. The client *receives* the server-corrected position via `S_GAME_STATE` and interpolates towards it.

### 3.4 Environmental Objects (Minimal)
- Implement procedural object placement *logic* based on the world seed and terrain type (e.g., place "rock" points in areas where noise indicates rock). Use density maps.
- Generate *placeholder* low-poly objects (e.g., simple polyhedral rocks using `LowPolyMeshFactory` from M1) at these locations. Keep poly count very low (15-30 polys). Use vertex colors. Objects are static scenery.

### 3.5 Physics Debugging and Tools (Minimal Server)
- Server: Add logging when player position is corrected due to terrain collision.
- Client: Add a debug toggle to visualize chunk boundaries (e.g., simple wireframe boxes).
- Client: Display current chunk coordinates the player is in.

## Deliverables
- Procedurally generated, chunked desert terrain viewable by client.
- Basic vertex coloring based on height/slope.
- Basic LOD switching based on distance.
- Simple environmental object placeholders.
- Server-side heightmap collision detection correcting player state.
- Deterministic generation based on seed.
- Basic chunk loading/unloading around player.

## Testing and Validation
- Client connects, sees procedurally generated, chunked terrain.
- Player cube (from M2) appears to rest on the terrain surface due to server-side height correction.
- Placeholder rocks appear in appropriate areas based on noise/rules.
- Terrain generation is deterministic based on a seed.
- Chunk loading/unloading occurs around the player.
- Performance remains stable (~60fps) with terrain rendering.