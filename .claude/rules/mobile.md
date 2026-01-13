---
paths: ["mobile/**"]
---

# Mobile Development Context

This context auto-loads when working in the React Native mobile app.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | React Native + Expo |
| Language | TypeScript |
| Navigation | Expo Router |
| State | React Context + hooks |
| Styling | React Native StyleSheet |

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── index.tsx          # Entry/login
│   ├── game.tsx           # Main game screen
│   └── _layout.tsx        # Navigation layout
├── src/
│   ├── components/        # UI components
│   ├── hooks/             # Custom hooks
│   │   ├── useAuth.ts     # Authentication
│   │   └── usePhoenix.ts  # WebSocket connection
│   ├── types/             # TypeScript types
│   └── theme.ts           # Design tokens
└── assets/                # Images, fonts
```

## Server Communication

### WebSocket Connection
```typescript
// usePhoenix.ts handles Phoenix channel connection
const { channel, connected } = usePhoenix();

// Send message
channel.push("move", { direction: "north" });

// Receive events
channel.on("room_update", (payload) => {
  setRoom(payload);
});
```

### Channel Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `move` | Client → Server | Navigation |
| `talk` | Client → Server | Start dialogue |
| `dialogue_choice` | Client → Server | Select choice |
| `room_update` | Server → Client | Room changed |
| `game_state` | Server → Client | State sync |

## UI Components

### Living Ebook Style
The app follows a "Living Ebook" aesthetic:
- Sepia/parchment backgrounds
- Serif fonts for narrative
- Subtle animations
- Minimal chrome

### Key Components
- `RoomView` - Main game display
- `BottomBar` - Action bar
- `ContainerModal` - Inventory/menus
- `EbookText` - Styled narrative text

## TypeScript Types

```typescript
// types/game.ts
interface Room {
  key: string;
  name: string;
  description: string;
  exits: Exit[];
  entities: Entity[];
}

interface GameState {
  room: Room;
  player: Player;
  quests: Quest[];
}
```

## Development Commands

```bash
# Start development server
cd mobile
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Server API

### Authentication
```typescript
// POST /api/v1/auth/login
const response = await fetch(`${API_URL}/api/v1/auth/login`, {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { access_token, refresh_token } = await response.json();
```

### WebSocket
```typescript
// Connect to Phoenix socket
const socket = new Socket(`${WS_URL}/socket`, {
  params: { token: accessToken }
});
socket.connect();

// Join game channel
const channel = socket.channel("game:lobby");
channel.join();
```

## Testing

```bash
# E2E tests (Maestro)
cd mobile
maestro test .maestro/

# Unit tests
npm test
```

## Common Patterns

### Safe Area Handling
```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

<SafeAreaView style={styles.container}>
  {/* content */}
</SafeAreaView>
```

### Keyboard Handling
```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  {/* content */}
</KeyboardAvoidingView>
```

## Documentation

- `docs/reference/game-client.md`
- `docs/api/channel-contract.md`
- `docs/ui/living-ebook-style-guide.md`
