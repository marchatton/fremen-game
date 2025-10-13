# Tech Stack Overview (Updated)
## Dune: Fremen's Vengeance Multiplayer

This document outlines the simplified technology stack for the Dune: Fremen's Vengeance multiplayer game and explains how each component fits into the overall architecture.

## Client-Side Technologies

### Core Engine & Language
-   **TypeScript**: Primary language for client-side development, providing type safety.
-   **Three.js**: 3D rendering engine providing WebGL-based graphics.
    * Used for rendering low-poly procedurally generated assets.
    * Simplified shader pipeline for toon/cell-shaded rendering (`client/src/shaders/`).
    * Optimized for consistent cross-device performance.
-   **Vite**: Modern build tool for fast development (HMR) and optimized production builds using the `vanilla-ts` template.
    * Efficient code splitting and asset bundling.

### Assets & Visuals
-   **Low-Poly Generation**: Core feature (`client/src/lowpoly/`).
    * Procedural generation of characters (target 150-300 polygons), objects, terrain.
    * Unturned-inspired stylized aesthetic.
    * Vertex coloring preferred over complex textures (`client/src/materials/`).
    * Deterministic generation using shared seeds.
-   **Audio**: Simple positional audio with WebAudio API (`client/src/core/audio/` or similar).
    * Basic sound effects and ambient soundscape.

### UI/UX
-   **HTML/CSS Overlay (Recommended)**: Standard browser tech for building UI elements (`client/src/components/`, `client/src/style.css`).
    * Allows leveraging CSS for styling (Dune aesthetic - M15) and accessibility.
    * Or, a lightweight UI library compatible with Three.js if needed.

### Deployment
-   **Vercel**: Hosting platform for the client application.
    * Automatic deployments from Git (configured via `client/vercel.json`).
    * Edge network for global low-latency access.

## Server-Side Technologies

### Backend Runtime & Language
-   **Node.js**: JavaScript runtime environment. (Can consider **Bun** later if benchmarks show significant advantage for the specific workload, but Node.js is default for stability/ecosystem).
-   **TypeScript (Recommended)**: Primary language for server-side development for consistency and type safety.

### Networking
-   **Socket.io**: Real-time bidirectional communication library.
    * Handles WebSocket connections, rooms, events (`server/src/networking/`, `server/src/rooms/`).
    * Supports binary data transfer for efficiency.

### Database
-   **DrizzleORM**: TypeScript ORM for SQL databases (`server/src/db/`).
    * Type-safe schema definitions and queries.
    * Used for persisting player state, inventory, mission progress, clan info, etc.
-   **PostgreSQL (Recommended)**: Robust SQL database, typically available on Railway.

### Hosting
-   **Railway**: Platform for hosting the game server and database.
    * Container deployment using Docker (`server/Dockerfile`).
    * Auto-scaling capabilities (configure as needed).
    * Managed database services.
    * Integrated monitoring and logging.

## State Synchronization Architecture

*(Refers to the separate State Synchronization Architecture document)*
-   **Authoritative Server Model**: Server (`server/`) is the source of truth.
-   **Fortnite-Inspired Client Prediction & Reconciliation**: Client (`client/`) predicts, server validates and corrects.
-   **State Transfer Optimizations**: Delta compression, interest management, binary format preferred.

## Authentication & Security

### Player Identity
-   **JWT (JSON Web Tokens)**: Secure authentication handled server-side (`server/src/auth/`).
-   Token-based session management (e.g., 24-hour expiration).

### Security Measures
-   Server-side validation for all game actions (`server/src/core/`).
-   Rate limiting on server endpoints/actions.
-   Input sanitization.
-   Basic anti-cheat detection server-side.

## Performance Optimization Targets (See M14)

-   **Client-Side**: Low-poly assets, vertex colors, minimal bones, LOD, culling, object pooling, instancing.
-   **Network**: Binary protocol, delta compression, interest management, update throttling.

## Development Workflow & Structure

-   **Monorepo Structure:** `client/` and `server/` directories recommended.
-   **Version Control:** Git-based workflow.
-   **CI/CD:** Automated testing and deployment via GitHub Actions (or similar) to Vercel/Railway.
-   **Testing:** Unit and Integration tests (`client/src/tests/`, `server/src/tests/`). Manual playtesting. Network simulation.

This tech stack provides a solid foundation using modern, well-supported technologies suitable for building a performant, secure, and scalable multiplayer game, aligned with the project's low-poly and optimization goals.