# Fremen's Vengeance

A tactical multiplayer game where Fremen squads coordinate to attract, mount, and ride sandworms across the deserts of Arrakis. Deploy thumpers strategically, manage water resources, complete objectives, and evade Harkonnen patrols in this low-poly procedural experience.

## 🎮 Core Gameplay

- **Squad Cooperation**: 2-4 players with specialized roles (Scout, Thumper Specialist, Rider, Harvester)
- **Worm Riding**: Deploy thumpers to attract sandworms, mount them, and steer across the desert
- **Strategic Risk/Reward**: Louder thumpers attract worms faster but also alert enemies
- **Resource Management**: Balance water survival with spice collection
- **PvE Combat**: Defend against Harkonnen AI patrols and assault their outposts

## 🛠 Tech Stack

- **Client**: Three.js + Vite + TypeScript (deployed on Vercel)
- **Server**: Node.js + Socket.io + TypeScript (deployed on Railway)
- **Database**: DrizzleORM + PostgreSQL
- **Package Manager**: pnpm with monorepo workspaces
- **Network**: Authoritative server with client prediction/reconciliation
- **Graphics**: Low-poly procedural generation, vertex colors, toon shading

## 📁 Repository Structure

```
fremen-game/
├── apps/
│   ├── client/          # Three.js frontend
│   └── server/          # Node.js backend
├── packages/
│   ├── shared/          # Shared types & constants
│   ├── protocol/        # Network message schemas
│   └── config/          # Shared tooling configs
├── docs/                # Architecture & design docs
│   ├── 00-overview.md
│   ├── 01-architecture.md
│   ├── 02-network-protocol.md
│   ├── 03-gameplay-mechanics.md
│   ├── 04-edge-cases-resilience.md
│   ├── 05-diagrams.md
│   └── milestones/      # VS1-VS6 development plan
└── AGENTS.md            # AI coding assistant guide

```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (runs both client and server)
pnpm run dev

# Build all packages
pnpm run --parallel build

# Run tests
pnpm test

# Type checking
pnpm run typecheck

# Linting
pnpm run lint
```

## 📖 Documentation

Start with these key documents:

1. **[Overview](docs/00-overview.md)** - Vision, MVP, roadmap
2. **[Architecture](docs/01-architecture.md)** - Monorepo structure, state sync, testing strategy
3. **[Network Protocol](docs/02-network-protocol.md)** - Message schemas, timing, interest management
4. **[Gameplay Mechanics](docs/03-gameplay-mechanics.md)** - Worm behavior, combat, resources, progression
5. **[Edge Cases](docs/04-edge-cases-resilience.md)** - Bot backfill, disconnections, exploits, failures
6. **[Diagrams](docs/05-diagrams.md)** - Visual architecture references

### Development Milestones

The project follows **vertical slice** development (VS1-VS6):

- **VS1** (2-4 weeks): Online Sandbox - Basic networking, terrain, worm patrol, thumper attraction
- **VS2** (4-6 weeks): **Worm Riding Core** ⭐ - Mount/steer mechanics, first playable objective
- **VS3** (3-4 weeks): Resource Loop - Spice harvesting, water survival, persistence
- **VS4** (4-5 weeks): PvE Combat - Harkonnen AI, combat system, bot backfill
- **VS5** (3-4 weeks): Squad Cooperation - Role specialization, team objectives
- **VS6** (4-6 weeks): Polish & Scale - Performance, UI/UX, stability, launch prep

**Total estimated timeline**: 5-6 months to public playtest

## 🎯 Development Philosophy

- **TDD**: Test-first for core systems (movement, state sync, combat)
- **SOLID**: Single responsibility, dependency inversion
- **YAGNI**: Start simple (JSON protocol), add complexity only when metrics demand it
- **Vertical Slices**: Build playable features end-to-end rather than horizontal layers
- **Edge-Case Ready**: Bot backfill, disconnection handling, and exploit prevention from day one

## 🤝 Contributing

This is currently a personal project. Documentation is maintained for AI coding assistants and potential collaborators.

See [AGENTS.md](AGENTS.md) for AI assistant guidelines.

## 📊 Current Status

**Phase**: Documentation & Planning (Pre-VS1)

- [x] Architecture design
- [x] Network protocol specification  
- [x] Gameplay mechanics design
- [x] Edge case planning
- [x] Milestone breakdown
- [ ] Monorepo scaffolding (VS1 start)
- [ ] Basic networking (VS1)
- [ ] Worm riding prototype (VS2)

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details

## 🌟 Inspiration

Inspired by Frank Herbert's Dune universe with gameplay influences from:
- Fortnite (network architecture, client prediction)
- Unturned (low-poly aesthetic)
- Deep Rock Galactic (cooperative PvE, role specialization)
