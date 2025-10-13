## File Structure Guidelines

### Client (Vite-based)
- **src/**: Source files
  - **assets/**: Game assets (textures, sounds)
  - **components/**: UI components
  - **core/**: Core game systems
    - **engine/**: Three.js engine setup
    - **input/**: Input handling
    - **physics/**: Physics system
    - **audio/**: Audio system
  - **entities/**: Game entities
    - **player/**: Player-related code
    - **enemies/**: Enemy-related code
    - **worms/**: Sandworm-related code
  - **networking/**: Client-side networking
    - **protocol/**: Network protocol
    - **sync/**: State synchronization
    - **debug/**: Network debugging tools
  - **terrain/**: Terrain generation and management
  - **lowpoly/**: Low-poly generation code
  - **utils/**: Utility functions
  - **App.ts**: Main app component
  - **main.ts**: Entry point
- **public/**: Public assets
- **index.html**: HTML template
- **package.json**: Dependencies
- **tsconfig.json**: TypeScript config
- **vite.config.ts**: Vite config

### Server (Bun-based)
- **src/**: Source files
  - **auth/**: Authentication and authorization
  - **core/**: Core server systems
    - **game/**: Game logic
    - **loop/**: Game loop
    - **physics/**: Server-side physics
  - **db/**: Database interactions
    - **models/**: Data models
    - **migrations/**: Database migrations
  - **networking/**: Server-side networking
    - **protocol/**: Network protocol
    - **sync/**: State synchronization
    - **rooms/**: Room management
  - **utils/**: Utility functions
  - **index.ts**: Server entry point
- **package.json**: Dependencies
- **tsconfig.json**: TypeScript config
- **bunfig.toml**: Bun configuration 