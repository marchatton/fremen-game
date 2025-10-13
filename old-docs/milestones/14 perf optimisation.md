# Milestone 14: Performance Optimization and Scaling

## Overview
Implement foundational performance optimizations across rendering, networking, and memory management. Introduce basic performance monitoring tools. *(Focus areas include rendering logic in `client/src/core/`, shaders in `client/src/shaders/`, network code in `client/src/networking/` and `server/src/networking/`, memory management across client systems, server logic in `server/src/core/`, and DB interactions)*.

## Requirements

### 14.1 Rendering Optimization
- LOD Refinement: Improve LOD transitions (e.g., smooth blending/dithering) for terrain (M3), characters (M4), AI (M10), worms (M5). Ensure LOD levels are aggressively used.
- Culling: Implement basic frustum culling for all major entities. Measure draw calls. Consider basic occlusion culling for static elements like Sietch interiors.
- Instancing: Implement GPU instancing (`InstancedMesh`) for frequently repeated environmental objects (e.g., rocks from M3).
- Shaders: Analyze shader complexity (`client/src/shaders/`). Simplify where possible. Ensure shaders reuse uniforms efficiently.
- Assets: Implement basic texture compression (e.g., Basis Universal via KTX2Loader) for major textures (`client/src/assets/`).

### 14.2 Network Optimization
- Serialization: Switch key state sync messages (`S_GAME_STATE`, `S_AI_STATE`) from JSON to a basic binary format (e.g., using DataView or msgpack). Quantize floats, use appropriate integer sizes. Measure bandwidth reduction.
- Delta Compression: Implement basic delta compression for player/AI/worm position/rotation: only send updates if change exceeds threshold.
- Interest Management: Server only sends state updates for entities within a certain radius of the client (e.g., 300m). Implement basic prioritization (player > AI > object).

### 14.3 Memory Management
- Pooling: Implement object pools (`ObjectPool` class in `client/src/utils/` or `core/`) for frequently created/destroyed objects (projectiles, ping effects, particles). Reuse objects.
- Asset Unloading: Implement basic mechanism to unload terrain chunk geometry/textures when far outside view distance.
- Monitoring: Add basic logging of vertex/texture memory usage (`renderer.info.memory`). Track number of active objects/entities.

### 14.4 Performance Monitoring and Analysis
- Metrics: Implement more detailed client-side FPS counter showing average/min/max. Add display for draw calls, active triangles (`renderer.info.render`). Add basic network stats display (messages in/out per second, rough bandwidth). Use Dune UI style (M15).
- Profiling Tools: Use browser built-in profiler (Performance tab) for client CPU bottlenecks. Use Spector.js or similar for GPU/shader analysis.

### 14.5 Server and Database Scaling (Minimal)
- Server Optimization: Profile server-side code (Node.js/Bun profiler). Optimize hot paths (AI updates, state sync preparation).
- DB Optimization: Analyze DrizzleORM query performance. Add basic indexes to tables for common lookups (e.g., `playerId` in `player_missions`, `player_resources`). Use connection pooling correctly.

## Deliverables
- Improved LOD transitions for key assets.
- Frustum culling implemented for major entities.
- GPU instancing used for repeated environmental objects.
- Basic texture compression applied.
- Key network messages converted to binary format with basic delta compression.
- Basic network interest management (radius-based updates).
- Object pooling implemented for projectiles/effects.
- Basic terrain chunk unloading.
- Enhanced client-side performance monitoring UI.
- Basic server and database query optimizations based on profiling.

## Testing and Validation
- Measurable improvements in client FPS (~10-20% target increase or hitting 60fps target more consistently).
- Measurable reduction in draw calls (~20-40%).
- Measurable reduction in network bandwidth usage (~30-50%).
- Memory usage is stable over time (no obvious leaks).
- Basic performance metrics are visible via debug UI.
- Server CPU usage reduced for core loops.