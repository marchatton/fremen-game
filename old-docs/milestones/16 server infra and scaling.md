# Milestone 16: Server Infrastructure and Scaling

## Overview
Prepare the server infrastructure for reliable deployment and basic scaling on Railway. Implement core matchmaking logic and basic administration/monitoring tools. Harden security. *(Core server logic in `server/src/core/`, networking in `server/src/networking/`, session/room management logic potentially in `server/src/rooms/`)*.

## Requirements

### 16.1 Bun/Railway Infrastructure
- Containerization: Finalize `server/Dockerfile` for the Node.js/TypeScript server. Ensure environment variables are used correctly.
- Statelessness: Ensure server instances do *not* store critical session state locally. Player state loaded from DrizzleORM on connect.
- Health Checks: Implement robust `/health` endpoint checking DB connection. Configure Railway deployment health checks.
- CI/CD: Set up GitHub Actions (or similar) to automatically build Docker image and deploy to Railway staging/production on pushes/tags. Include automated test runs (M17).

### 16.2 Matchmaking and Session Management
- Matchmaking Logic (Basic): Implement simple queue-based matchmaking (`server/src/core/matchmaking/`). Players send `C_REQUEST_MATCH`. Server adds player to queue. Periodically form teams (e.g., groups of 4) from queue based on FIFO. Assign matched players to a specific game instance/room (`server/src/rooms/`).
- Session Management: Server manages game rooms/sessions. Track players per room. Handle join/leave updates robustly. Ensure player state is loaded/saved correctly.
- Server Browser (Basic): Implement server endpoint `/listServers` returning basic info about active public rooms (room name, player count). Client fetches and displays this in Server Browser UI (M15). Add "Join Room" functionality.
- Private Sessions: Allow creating rooms with optional passwords. Add password field to join flow.

### 16.3 Administration and Monitoring
- Monitoring: Integrate basic Railway metrics monitoring. Add custom server-side structured logging (e.g., Pino) for key events (connect/disconnect, errors, matchmaking). Set up basic Railway alerts for high error rates or resource usage.
- Basic Admin Tools: Implement simple password-protected web interface (or CLI commands) for basic actions: view online players, view active rooms, kick player, broadcast server message.

### 16.4 Security and Anti-Cheat
- Hardening: Review all server endpoints/socket events for input sanitization/validation. Ensure rate limiting is robust. Ensure JWT validation is strict. Use Helmet.js or similar if exposing HTTP endpoints.
- Anti-Cheat: Implement basic server-side validation checks: position limits, movement speed validation (M4), resource gain validation. Log violations silently.

### 16.5 Database and State Management
- Optimization: Review final DrizzleORM schema. Ensure necessary indexes are present for common queries (`playerId` lookups). Optimize connection pool settings for Railway plan.
- Backup/Recovery: Configure automated backups via Railway database service. Understand recovery procedures.

## Deliverables
- Reliable, containerized server deployment process to Railway via CI/CD.
- Basic queue-based matchmaking system placing players into rooms.
- Basic server browser functionality (list rooms, join room).
- Private room support with passwords.
- Basic server monitoring integrated with Railway metrics and structured logging.
- Simple admin tools (view players/rooms, kick, broadcast).
- Hardened security measures (input validation, rate limiting, JWT).
- Basic server-side anti-cheat validations (position, speed, resources).
- Optimized database schema with indexes and configured backups.

## Testing and Validation
- Server deploys reliably to Railway via CI/CD.
- Basic matchmaking places players into rooms.
- Server handles moderate load (e.g., 30-50 concurrent users) stably in a single region.
- Basic monitoring shows server health via logs/Railway metrics.
- Basic admin commands work.
- Core security validations are in place.
- Player state persists reliably via DrizzleORM.