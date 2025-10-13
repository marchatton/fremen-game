# Milestone 12: Environmental Variety and Weather

## Overview
Introduce distinct environmental regions (biomes) with visual differences, implement a basic dynamic weather system (sandstorm), and a functional day/night cycle impacting visuals and potentially gameplay (e.g., temperature affecting water rate).

## Requirements

### 12.1 Biome Diversity (Visual Only)
- Regions: Define 2-3 distinct biome types (e.g., Dune Sea, Rocky Waste, Salt Flat) using noise parameters in terrain generation (M3). Assign map areas to biomes.
- Visuals: Use different vertex color palettes in terrain shader (`client/src/shaders/`, `materials/`) based on biome. Place different placeholder environmental objects based on biome. Introduce biome-specific fog settings.
- Transitions: Implement simple blending between biome fog/color settings based on player position near borders.

### 12.2 Weather System (Sandstorm)
- Server Logic: Implement simple global weather state machine (`Clear`, `Sandstorm Approaching`, `Sandstorm Active`). Randomly trigger transitions. Server broadcasts current global weather state `S_WEATHER_UPDATE { state }` on change.
- Client Effects (`Sandstorm Active`): Activate dense particle effect, increase fog density/color (yellow/brown). Play loud wind/sandstorm sound loop. Reduce visibility range. Apply movement speed modifier (e.g., -25%).
- Client Effects (`Sandstorm Approaching`): Subtle wind sound increase, slight fog color shift.
- Sync: Ensure all clients receive `S_WEATHER_UPDATE` and apply effects consistently.

### 12.3 Day/Night Cycle
- Time Sync: Server maintains authoritative time of day (0-24 value). Accelerated cycle (e.g., 24 mins real-time = 24 hours game-time). Include current time in `S_TIME_UPDATE { time }` (or `S_GAME_STATE`).
- Lighting: Client updates directional light (sun) position and color based on synchronized time. Adjust ambient light intensity/color. Basic moonlight for night.
- Gameplay Impact: Modify base water consumption rate (M8) based on time (e.g., higher during day, lower at night). Server uses authoritative time.

### 12.4 Dynamic World Events (Spice Blow Placeholder)
- Spice Blow: Server randomly selects a location and triggers a "Spice Blow" event. Broadcast `S_SPICE_BLOW { position, duration }`.
- Client: Display visual effect (e.g., plume of orange particles, ground decal) at the location for the duration. Add sound effect.

### 12.5 Dynamic Storytelling (Defer)
- Defer discoverable lore, dynamic NPC events, environmental changes, atmospheric storytelling.

## Deliverables
- 2-3 visually distinct biomes implemented via terrain generation parameters and vertex coloring.
- Basic global sandstorm weather state synchronized across clients with visual/audio effects and gameplay modifiers (visibility, speed).
- Functioning day/night cycle affecting lighting and water consumption rate.
- Placeholder "Spice Blow" dynamic event with visual/audio cue.
- Network synchronization of time and weather state.

## Testing and Validation
- World shows distinct visual differences between defined biomes.
- Day/night cycle progresses, visibly changing lighting.
- Server triggers sandstorms globally; clients experience synchronized effects and modifiers.
- Server triggers placeholder spice blow events visible to clients.
- Water consumption rate varies slightly between day/night.
- Performance remains stable during weather events.