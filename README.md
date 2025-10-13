# Fremen's Vengeance

A tactical multiplayer game where Fremen squads coordinate to attract, mount, and ride sandworms to complete objectives.

## Tech Stack

- **Client**: Three.js + Vite + TypeScript
- **Server**: Node.js + Socket.io + TypeScript  
- **Package Manager**: pnpm (monorepo)
- **Database**: DrizzleORM + PostgreSQL

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development (client + server)
pnpm run dev

# Build all packages
pnpm run build

# Run tests
pnpm test

# Lint
pnpm run lint

# Typecheck
pnpm run typecheck
```

## Project Structure

```
apps/
  client/          # Three.js + Vite frontend
  server/          # Node.js + Socket.io backend
packages/
  shared/          # Types, constants, utilities
  protocol/        # Network message schemas
  config/          # Shared tsconfig/eslint
docs/              # Architecture & milestone docs
```

## Development Phase

**Current**: Pre-VS1 (Scaffolding Complete)  
**Next**: VS1 - Online Sandbox (2-4 weeks)

See [docs/milestones/VS1-online-sandbox.md](docs/milestones/VS1-online-sandbox.md) for details.

## Environment Setup

```bash
# Client
cp apps/client/.env.example apps/client/.env

# Server
cp apps/server/.env.example apps/server/.env
```

## Documentation

- [00-overview.md](docs/00-overview.md) - Vision & roadmap
- [VS1-online-sandbox.md](docs/milestones/VS1-online-sandbox.md) - Current milestone

## License

See [LICENSE](LICENSE)
