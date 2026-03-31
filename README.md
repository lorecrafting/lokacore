# Loka

A text-based RPG engine built with Elixir/Phoenix and React Native. Leverages Elixir's OTP concurrency, fault tolerance, and real-time Phoenix Channels for modern MUD development.

## What is Loka?

Loka is a MUD (Multi-User Dungeon) engine framework for building text-based RPGs. It provides:

- **Entity-Component-Behavior architecture** - Composition over inheritance for flexible game objects
- **Prototype system** - YAML templates with inheritance for rapid content creation
- **Real-time multiplayer** - Phoenix Channels for instant updates across all clients
- **Web and mobile clients** - Admin LiveView dashboard + React Native (Expo) mobile client
- **Sandboxed scripting** - Elixir-based scripting for game customization
- **Quest and dialogue systems** - Built-in support for narrative content

## Project Structure

```
lokacore/
├── server/           # Elixir/Phoenix backend
│   ├── lib/loka/     # Game engine and framework
│   └── priv/world/   # YAML game content (prototypes, quests, dialogues)
├── rn-client/        # React Native (Expo) mobile client
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
- **Node.js** 18+ (for assets and React Native)
- **SQLite** 3.x
- **Git LFS** (for audio assets): `brew install git-lfs && git lfs install`

### Server Setup

```bash
cd server

# Install dependencies
mix deps.get
npm install --prefix assets

# Setup database
mix ecto.setup

# Start server
mix phx.server
```

Server runs at http://localhost:4000. Admin dashboard at http://localhost:4000/admin.

### React Native Client Setup

```bash
cd rn-client

# Install dependencies
npm install

# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## Development

See `CLAUDE.md` for the comprehensive development guide, including architecture details, all routes and API endpoints, test commands, deployment, and coding conventions.

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

## Documentation

Organized by [traditional MUD roles](docs/README.md):

| Role | Directory | Content |
|------|-----------|---------|
| **Builder** | [docs/builder-reference/](docs/builder-reference/) | YAML specs (quests, dialogues, entities) |
| **Developer** | [docs/architecture/](docs/architecture/), [docs/framework/](docs/framework/) | Elixir code, system design |
| **Admin** | [docs/admin/](docs/admin/), [docs/operations/](docs/operations/) | Dashboard, live ops, security |

## Deployment

Designed for [Fly.io](https://fly.io) deployment:

```bash
fly deploy
```

## Acknowledgments

Special thanks to the [Evennia](https://github.com/evennia/evennia) project and community. Evennia's pioneering work in Python MUD development provided invaluable inspiration and learning. If you're building a MUD in Python, Evennia is an excellent choice.

## License

MIT
