# Milestone 1: Core Three.js Low-Poly Engine Setup

## Overview
Establish the foundational Three.js engine with low-poly asset generation capabilities, focusing on rendering pipeline, camera systems, input, and basic scene management using Vite, adopting a structured project layout.

## Requirements

### 1.1 Project Initialization
- Set up monorepo structure (optional, but recommended) containing `client/` and `server/` directories.
- **Client Setup (`client/`):**
    - Initialize Vite project (`cd client && npm create vite@latest . -- --template vanilla-ts`).
    - Configure `client/tsconfig.json` (strict mode) and ESLint.
    - Establish initial **client source structure** (`client/src/`):
        - `assets/`: Static assets (initial textures, sounds).
        - `components/`: Placeholder for UI or ECS components.
        - `core/`: Core engine systems (Renderer setup, Asset Manager, Input Manager).
        - `entities/`: Placeholder for player, AI, worm entities.
        - `lowpoly/`: Procedural mesh generation logic (`LowPolyMeshFactory`).
        - `materials/`: Material management/definitions.
        - `networking/`: Client-side network code (`NetworkManager`).
        - `physics/`: Placeholder for client-side physics helpers/prediction logic.
        - `shaders/`: GLSL shader files (vertex, fragment).
        - `terrain/`: Terrain generation/management code.
        - `utils/`: Common utility functions.
        - `tests/`: Directory for unit/integration tests.
        - `main.ts`: Main application entry point.
        - `style.css`: Basic styles.
    - Install Three.js (`npm install three @types/three`).
    - Implement basic `AssetManager` in `core/` using `LoadingManager`.
    - Add `client/vercel.json` for Vercel deployment configuration.
- **Server Setup Placeholder (`server/`):**
    - Create basic `server/` directory structure (`src/`, `package.json`, `tsconfig.json`, `.gitignore`).
    - `server/src/`: `core/`, `auth/`, `networking/`, `rooms/`, `types/`, `tests/`, `index.ts`. *(Actual server implementation starts in M2)*.
    - Add basic `server/Dockerfile` and `railway.json` placeholders.

### 1.2 Rendering Pipeline
- Create WebGL renderer (`client/src/core/Renderer.ts` or similar) with appropriate settings (antialias, precision, colorSpace, shadows).
- Implement adaptive resolution scaling *later* (M14); focus on baseline 60fps. Add simple FPS counter UI.
- Set up basic lighting (Directional, Ambient).
- Create shader loading utility (`client/src/utils/shaderLoader.ts`) and basic vertex/fragment shaders (`client/src/shaders/`). Handle compilation errors.

### 1.3 Low-Poly Asset Generation System (Foundation)
- Create `LowPolyMeshFactory` (`client/src/lowpoly/`) generating basic shapes (cube, sphere) with vertex colors. Target < 50 polys each.
- Implement simple `MaterialManager` (`client/src/materials/`) caching basic `MeshStandardMaterial` with vertex colors enabled.

### 1.4 Camera System
- Implement `PerspectiveCamera` and `OrbitControls` (`client/src/core/Camera.ts` or similar) for debugging.

### 1.5 Core Input System
- Implement basic `InputManager` (`client/src/core/InputManager.ts`) capturing keyboard/mouse/touch events and mapping basic actions (WASD, jump intent).

## Deliverables
- Functioning Three.js client environment with Vite build system.
- Established `client/` and basic `server/` project structure.
- Low-poly asset generation foundation (`LowPolyMeshFactory`).
- Basic desert scene rendering with a procedurally generated shape.
- Debug camera controls and basic input handling.
- Initial Vercel deployment configuration for the client.

## Testing and Validation
- Client runs at target 60fps on medium-spec devices.
- Basic procedural mesh generates correctly (< 100ms).
- Orbit controls function smoothly.
- Basic input actions are logged.
- Client builds and previews correctly via Vite.
