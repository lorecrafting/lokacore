# Loka Mobile E2E Testing

End-to-end tests for the Loka mobile app using [Maestro](https://maestro.mobile.dev/).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Maestro Test Runner                       │
├─────────────────────────────────────────────────────────────┤
│                 YAML Test Flows (.maestro/flows/)           │
├─────────────────────────────────────────────────────────────┤
│        React Native App (Expo) with testID props            │
├─────────────────────────────────────────────────────────────┤
│              Phoenix WebSocket (real backend)               │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **Real Backend**: Tests run against a real Phoenix server, not mocks
- **testID Props**: Components use `testID` props for reliable element selection
- **YAML Flows**: Tests are written in YAML for readability and maintainability

## Prerequisites

1. **Install Maestro CLI**:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **iOS Simulator** or **Android Emulator** running

3. **Server running** at `localhost:4000`:
   ```bash
   cd server && mix phx.server
   ```

4. **Expo app** running:
   ```bash
   cd mobile && npm start
   ```

## Quick Start

```bash
# Run smoke tests (recommended for CI)
npm run test:e2e:smoke

# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e:auth
npm run test:e2e:navigation
npm run test:e2e:dialogue

# Record test run as video
npm run test:e2e:record

# Open Maestro Studio (interactive test builder)
npm run maestro:studio
```

## Test Structure

```
mobile/.maestro/
├── config.yaml              # Global configuration
├── flows/
│   ├── smoke-test.yaml      # Critical path smoke test
│   ├── auth/
│   │   └── guest-login.yaml # Guest authentication
│   ├── navigation/
│   │   ├── room-navigation.yaml
│   │   └── helpers/
│   │       ├── try-navigate-north.yaml
│   │       └── try-navigate-east.yaml
│   ├── dialogue/
│   │   ├── npc-conversation.yaml    # Basic NPC interaction
│   │   └── dialogue-depth.yaml      # Multi-turn dialogue, choices
│   ├── inventory/
│   │   ├── pick-up-item.yaml        # Item pickup
│   │   └── inventory-management.yaml # Full inventory UI
│   ├── combat/
│   │   └── basic-combat.yaml        # Combat overlay & health bars
│   ├── quest/
│   │   └── quest-tracking.yaml      # Quest journal UI
│   ├── crafting/
│   │   └── crafting-system.yaml     # Crafting panel UI
│   ├── character/
│   │   └── character-stats.yaml     # Character stats display
│   ├── chat/
│   │   └── chat-system.yaml         # Chat modal, say/shout
│   └── storyline/
│       └── main-storyline.yaml      # Full storyline navigation
└── output/                  # Test artifacts (screenshots, recordings)
```

## Test Coverage Matrix

| Layer | What's Tested | Test File |
|-------|--------------|-----------|
| **Auth** | Login, name input, world entry | `auth/guest-login.yaml` |
| **Navigation** | Room movement (N/S/E/W/Up/Down) | `navigation/room-navigation.yaml` |
| **Dialogue UI** | Modal opens, choices render, history | `dialogue/dialogue-depth.yaml` |
| **Quest UI** | Quest panel, active/completed tabs | `quest/quest-tracking.yaml` |
| **Combat UI** | Combat overlay, health bars, flee | `combat/basic-combat.yaml` |
| **Inventory UI** | Equipment slots, item list | `inventory/inventory-management.yaml` |
| **Crafting UI** | Recipe list, ingredients | `crafting/crafting-system.yaml` |
| **Character UI** | Stats, vitals, attributes | `character/character-stats.yaml` |
| **Chat UI** | Say/shout modes, send/cancel | `chat/chat-system.yaml` |

### Complementary to ChannelBot

These Maestro tests cover the **UI layer** that ChannelBot cannot test:

| ChannelBot Tests (Server) | Maestro Tests (UI) |
|--------------------------|-------------------|
| Quest objective tracking | Quest panel renders objectives |
| Dialogue tree navigation | Dialogue choices are tappable |
| Combat damage calculations | Health bars update visually |
| Item pickup logic | Item appears in inventory panel |
| Chat message delivery | Chat modal UI works |

## Writing Tests

### Basic Flow Structure

```yaml
# flows/my-test.yaml
appId: com.loka.game
tags:
  - mytag
---
# Test steps go here
- launchApp
- assertVisible:
    id: "some-testid"
- tapOn:
    id: "button-testid"
```

### Available testIDs

| Component | testID | Purpose |
|-----------|--------|---------|
| **Welcome Screen** | | |
| Name input | `name-input` | Player name entry |
| Enter button | `enter-button` | Submit name |
| **Game Screen** | | |
| Room view | `room-view` | Main room container |
| Room title | `room-title` | Room name |
| Room description | `room-description` | Room text |
| Entity text | `entity-text` | NPCs/players paragraph |
| Room items | `room-items` | Ground items area |
| Room events | `room-events` | Game log messages |
| Bottom bar | `bottom-bar` | Navigation area |
| Menu button | `menu-button` | Opens menu panel |
| Vitals display | `vitals-display` | Health/time/condition |
| **Navigation** | | |
| North | `nav-north` | Navigate north |
| South | `nav-south` | Navigate south |
| East | `nav-east` | Navigate east |
| West | `nav-west` | Navigate west |
| Up | `nav-up` | Navigate up |
| Down | `nav-down` | Navigate down |
| **Chat** | | |
| Say button | `chat-say-button` | Opens chat |
| Chat modal | `chat-modal` | Chat dialog |
| Chat input | `chat-input` | Message input |
| Send button | `chat-send-button` | Send message |
| Cancel button | `chat-cancel-button` | Close chat |
| Mode: Say | `chat-mode-say` | Local broadcast |
| Mode: Shout | `chat-mode-shout` | Larger radius |
| **Entities** | | |
| NPC at index N | `entity-npc-N` | Tap to interact |
| Item at index N | `entity-item-N` | Tap to interact |
| Player at index N | `entity-player-N` | Other players |
| **Entity Context** | | |
| Modal | `entity-context-modal` | Entity details |
| Entity name | `entity-name` | NPC/item name |
| Entity description | `entity-description` | Long description |
| Action menu | `action-menu` | Available actions |
| Action list | `action-list` | Action buttons |
| Action: talk | `action-talk` | Start dialogue |
| Action: get | `action-get` | Pick up item |
| Action: attack | `action-attack` | Attack entity |
| Action: shop | `action-shop` | Open shop |
| Action: open | `action-open` | Open container |
| Close modal | `close-modal` | Leave/close |
| **Dialogue** | | |
| Content area | `dialogue-content` | Dialogue container |
| History | `dialogue-history` | Past dialogue |
| Text entry N | `dialogue-text-N` | Individual line |
| Choices area | `dialogue-choices` | Response options |
| Choice N | `dialogue-choice-N` | Select option |
| Leave button | `dialogue-leave` | Exit dialogue |
| **Menu Panel** | | |
| Panel | `menu-panel` | Menu modal |
| Close button | `close-menu` | Close menu |
| Tab bar | `menu-tabs` | Tab navigation |
| Tab: character | `menu-tab-character` | Character tab |
| Tab: inventory | `menu-tab-inventory` | Inventory tab |
| Tab: quest | `menu-tab-quest` | Quest tab |
| Tab: craft | `menu-tab-craft` | Crafting tab |
| Tab: socials | `menu-tab-socials` | Socials tab |
| Tab: settings | `menu-tab-settings` | Settings tab |
| Character panel | `character-panel` | Character content |
| Inventory panel | `inventory-panel` | Inventory content |
| Quest panel | `quest-panel` | Quest content |
| Craft panel | `craft-panel` | Crafting content |
| Socials panel | `socials-panel` | Socials content |
| Settings panel | `settings-panel` | Settings content |
| **Combat** | | |
| Overlay | `combat-overlay` | Combat UI |
| Indicator | `combat-indicator` | "COMBAT" badge |
| Enemy name | `combat-enemy-name` | vs Enemy Name |
| Health section | `combat-health-section` | Health bars |
| Player health | `combat-player-health` | Your HP bar |
| Enemy health | `combat-enemy-health` | Enemy HP bar |
| Info | `combat-info` | Auto-combat message |
| Flee button | `combat-flee-button` | Escape combat |
| **Bardo (Death)** | | |
| Overlay | `bardo-overlay` | Death screen |
| Title | `bardo-title` | "The Bardo" |
| Messages | `bardo-messages` | Death messages |
| Message N | `bardo-message-N` | Individual message |
| Reincarnate | `reincarnate-button` | Return to life |
| Bind point | `bardo-bind-point` | Respawn location |

### Common Patterns

**Wait for element:**
```yaml
- extendedWaitUntil:
    visible:
      id: "room-view"
    timeout: 15000
```

**Conditional execution:**
```yaml
- runFlow:
    when:
      visible:
        id: "nav-north"
    commands:
      - tapOn:
          id: "nav-north"
```

**Take screenshot:**
```yaml
- takeScreenshot: "descriptive_name"
```

**Input text:**
```yaml
- tapOn:
    id: "chat-input"
- inputText: "Hello world"
- hideKeyboard
```

## Backend Integration

Tests run against the real Phoenix backend. The test runner script (`scripts/e2e-test.sh`) handles:

1. **Server check**: Verifies server is running, starts it if needed
2. **Fixture setup**: Runs `mix loka.e2e.setup` to prepare test data
3. **Test execution**: Runs Maestro flows
4. **Cleanup**: Runs `mix loka.e2e.cleanup` to remove test data

### Server-Side Tasks

```bash
# Setup test fixtures
cd server && mix loka.e2e.setup --test-run-id 12345

# Cleanup test data
cd server && mix loka.e2e.cleanup --test-run-id 12345
```

## CI Integration

For CI (GitHub Actions), add to your workflow:

```yaml
e2e-mobile:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install Maestro
      run: curl -Ls "https://get.maestro.mobile.dev" | bash

    - name: Start iOS Simulator
      run: |
        xcrun simctl boot "iPhone 15" || true
        xcrun simctl list devices

    - name: Setup Elixir
      uses: erlef/setup-beam@v1
      with:
        elixir-version: '1.19'
        otp-version: '28'

    - name: Install dependencies
      run: |
        cd server && mix deps.get
        cd ../mobile && npm install

    - name: Start server
      run: |
        cd server
        mix ecto.setup
        mix phx.server &
        sleep 10

    - name: Start Expo
      run: |
        cd mobile
        npx expo start --ios &
        sleep 30

    - name: Run E2E tests
      run: |
        cd mobile
        npm run test:e2e:smoke
```

## Debugging

### Maestro Studio
Interactive test builder with live preview:
```bash
npm run maestro:studio
```

### Screenshots
Tests automatically take screenshots at key points. Find them in:
```
mobile/.maestro/output/<test-run-id>/
```

### Logs
View test output:
```bash
# Verbose mode
maestro test --debug .maestro/flows/smoke-test.yaml
```

### Common Issues

1. **"Element not found"**: Check testID is correctly set on component
2. **"Timeout waiting for element"**: Increase timeout or check server is running
3. **"App not launching"**: Ensure Expo is running and simulator is booted
4. **"Connection refused"**: Server not running at localhost:4000

## Adding New Tests

1. Create a new `.yaml` file in the appropriate `flows/` subdirectory
2. Add testIDs to any new components being tested
3. Use existing patterns from similar tests
4. Run locally first: `maestro test .maestro/flows/your-test.yaml`
5. Add to appropriate test suite (smoke if critical)

## Test Data Requirements

Tests expect these fixtures to exist:

| Fixture | Purpose | Location |
|---------|---------|----------|
| `meditation_cell` room | Starting room | `priv/world/rooms/` |
| `novice_pema` NPC | Test NPC with dialogue | `priv/world/prototypes/npcs/` |
| `prayer_beads` item | Pickup test item | `priv/world/prototypes/items/` |

See `server/lib/mix/tasks/loka.e2e.setup.ex` for fixture verification.
