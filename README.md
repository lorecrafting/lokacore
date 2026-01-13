# Loka

A text-based RPG engine built with Elixir/Phoenix and React Native. Leverages Elixir's OTP concurrency, fault tolerance, and real-time LiveView for modern MUD development.

## What is Loka?

Loka is a MUD (Multi-User Dungeon) engine framework for building text-based RPGs. It provides:

- **Entity-Component-Behavior architecture** - Composition over inheritance for flexible game objects
- **Prototype system** - YAML templates with inheritance for rapid content creation
- **Real-time multiplayer** - Phoenix Channels for instant updates across all clients
- **Web and mobile clients** - LiveView web client + React Native mobile app
- **Sandboxed scripting** - Elixir-based scripting for game customization
- **Quest and dialogue systems** - Built-in support for narrative content

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Elixir 1.19 / Phoenix 1.8 |
| Real-time | Phoenix LiveView + Channels |
| Database | SQLite (via Ecto) |
| Mobile | React Native + Expo |
| Auth | Guardian JWT |

## Project Structure

```
lokacore/
├── server/           # Elixir/Phoenix backend
│   ├── lib/loka/     # Game engine and framework
│   └── priv/world/   # YAML game content (prototypes, quests, dialogues)
├── mobile/           # React Native mobile app
└── docs/             # Architecture documentation
```

## Quick Start

### Clone the Repository

```bash
# Fast clone (~2 MB, latest code only)
git clone --depth 1 https://github.com/lorecrafting/lokacore.git

# Full clone with history (~5 MB)
git clone https://github.com/lorecrafting/lokacore.git
```

### Prerequisites

- **Elixir** 1.19+ ([install guide](https://elixir-lang.org/install.html))
- **Node.js** 18+ (for assets and mobile)
- **SQLite** 3.x
- **Git LFS** (for audio assets): `brew install git-lfs && git lfs install`

### Elixir Server & React-Native Expo Dev Setup

```bash
cd server

# Install dependencies
mix deps.get
npm install --prefix assets

# Setup database
mix ecto.setup

cd ../mobile

# Install dependencies
npm install

# Start both elixir server and react-native expo server
mix loka.dev
```
React-native expo web client will be available at http://localhost:8081
The admin web client will be available at http://localhost:4000

### Standalone Mobile Setup (Optional)

```bash
cd mobile

# Install dependencies
npm install

# iOS (requires macOS + Xcode)
npx pod-install
npm run ios

# Android (requires Android Studio)
npm run android
```


## Development

### Running Tests

```bash
cd server

# Run all tests
mix test

# Validate game content (prototypes, quests, dialogues)
mix loka.test.validate

# Run full test suite including content validation
mix loka.test
```

### Key Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/play` | Web game client (requires login) |
| `/admin` | Admin dashboard |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register new account |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/refresh` | Refresh access token |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT - priv/world/ (YAML)                           │
│   Rooms, NPCs, Items, Quests, Dialogues                     │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK - lib/loka/framework/                        │
│   Combat, Quests, Inventory, Dialogue, Progression          │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE - lib/loka/engine/                              │
│   Entities, Prototypes, Events, Commands, Hooks, Scripting  │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM - Phoenix 1.8, LiveView, Ecto + SQLite             │
└─────────────────────────────────────────────────────────────┘
```

**Key concepts:**
- **Entities** are GenServer processes with components (data) and behaviors (logic)
- **Prototypes** are YAML templates with inheritance - define content without code
- **Hooks** provide 22 lifecycle extension points for game logic
- **Locks** offer string-based access control (`"perm(admin) OR has_item(key)"`)

See [Architecture Documentation](docs/architecture/README.md) for the full deep-dive.

## AI-Assisted Development

Loka is designed for AI-assisted development. The codebase includes context files that help LLMs understand the architecture:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Primary context - architecture, patterns, commands |
| `docs/architecture/` | Deep-dive documentation for each subsystem |
| `docs/llm/` | LLM-specific references for content creation |
| `.beads/` | Issue tracking with dependency graphs |

**Getting started with an AI assistant:**
1. Point it at `CLAUDE.md` for project context
2. Use `docs/llm/*.md` for content creation (quests, dialogues, entities)
3. Run `mix loka.test.validate` to verify content changes

The project uses [beads](https://github.com/anthropics/claude-code) for issue tracking - run `bd ready` to see available work.

## Documentation

| Topic | Location |
|-------|----------|
| Architecture Overview | [docs/architecture/README.md](docs/architecture/README.md) |
| Entity System | [docs/architecture/entity-system.md](docs/architecture/entity-system.md) |
| Hooks & Locks | [docs/architecture/hooks-and-locks.md](docs/architecture/hooks-and-locks.md) |
| Scripting | [docs/architecture/elixir-scripts-design.md](docs/architecture/elixir-scripts-design.md) |
| Channel API | [docs/api/channel-contract.md](docs/api/channel-contract.md) |
| UI Style Guide | [docs/ui/living-ebook-style-guide.md](docs/ui/living-ebook-style-guide.md) |
| Full Specification | [docs/Loka_Engine_Architecture.md](docs/Loka_Engine_Architecture.md) |

## Deployment

Designed for [Fly.io](https://fly.io) deployment:

```bash
fly deploy
```

## Acknowledgments

Special thanks to the [Evennia](https://github.com/evennia/evennia) project and community. Evennia's pioneering work in Python MUD development—particularly its elegant approaches to typeclasses, lock strings, and in-game scripting—provided invaluable inspiration and learning. If you're building a MUD in Python, Evennia is an excellent choice.

## License

MIT
