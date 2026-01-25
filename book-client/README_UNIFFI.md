# Uniffi Bridge Setup

This document explains the React Native ↔ Rust bridge using uniffi.

## Architecture

```
Server (Elixir/Phoenix)
  ↓ WebSocket (Phoenix Channels)
  ↓ channel.generated.ts (auto-generated TypeScript types)
RN App (TypeScript)
  ↓ [Uniffi Bridge - THIS LAYER]
  ↓ loka_book.{h,swift,kt} (auto-generated native bindings)
Rust Book Renderer (Bevy)
```

## Files

| File | Purpose |
|------|---------|
| `src/loka_book.udl` | Interface definition (mirrors channel types) |
| `src/bridge/mod.rs` | Rust implementation of the bridge |
| `build.rs` | Uniffi scaffolding generator |
| `Cargo.toml` | Dependencies (uniffi crate) |

## Type Mapping

The bridge types mirror the channel event payloads:

| Channel Event | Bridge Function | Rust Type |
|---------------|-----------------|-----------|
| `game_state` | `update_game_state(json)` | Internal state |
| `dialogue_start` | `start_dialogue(...)` | `DialogueStateData` |
| `combat_start` | `start_combat(...)` | Combat state |
| `container_open` | `open_container(...)` | Container state |

## Generating Bindings

### For iOS (Swift)

```bash
cargo build --release --target aarch64-apple-ios
uniffi-bindgen generate src/loka_book.udl --language swift --out-dir ../mobile/ios/
```

### For Android (Kotlin)

```bash
cargo build --release --target aarch64-linux-android
uniffi-bindgen generate src/loka_book.udl --language kotlin --out-dir ../mobile/android/
```

## Usage from React Native

### 1. Install the native module

```typescript
// mobile/src/nativeModules/LokaBook.ts
import { NativeModules } from 'react-native';

const { LokaBook } = NativeModules;

export interface LokaBookBridge {
  createBridge(): Promise<number>; // Returns bridge handle
  updateGameState(handle: number, json: string): void;
  getCurrentPageContent(handle: number): Promise<string>;
  // ... other methods
}

export default LokaBook as LokaBookBridge;
```

### 2. Use in components

```typescript
// mobile/src/hooks/useBookRenderer.ts
import { useEffect, useState } from 'react';
import LokaBook from '../nativeModules/LokaBook';

export function useBookRenderer() {
  const [bridge, setBridge] = useState<number | null>(null);
  const [pageContent, setPageContent] = useState<string>('');

  useEffect(() => {
    // Initialize bridge
    LokaBook.createBridge().then(setBridge);
  }, []);

  // Update from channel events
  const updateFromChannel = (payload: GameStatePayload) => {
    if (bridge) {
      LokaBook.updateGameState(bridge, JSON.stringify(payload));

      // Get rendered content
      LokaBook.getCurrentPageContent(bridge)
        .then(setPageContent);
    }
  };

  return { bridge, pageContent, updateFromChannel };
}
```

### 3. Connect to Phoenix channels

```typescript
// mobile/app/game.tsx
import { usePhoenix } from '../src/hooks/usePhoenix';
import { useBookRenderer } from '../src/hooks/useBookRenderer';

export default function GameScreen() {
  const { channel } = usePhoenix();
  const { pageContent, updateFromChannel } = useBookRenderer();

  useEffect(() => {
    if (!channel) return;

    // Listen to channel events
    channel.on('game_state', updateFromChannel);
    channel.on('room_update', (payload) => {
      // Update book renderer
      if (bridge) {
        LokaBook.updateRoom(bridge, JSON.stringify(payload));
      }
    });

    return () => {
      channel.off('game_state');
      channel.off('room_update');
    };
  }, [channel, bridge]);

  return (
    <BookView content={pageContent} />
  );
}
```

## Integration with mix tasks

The existing `mix loka.gen.channel_types` generates TypeScript types. We should extend this:

```bash
# Generate both TS types AND uniffi bindings
mix loka.gen.types

# This should:
# 1. Generate mobile/src/types/channel.generated.ts (existing)
# 2. Update book-client/src/loka_book.udl if schema changed
# 3. Regenerate uniffi bindings
```

## Next Steps

1. ✅ Create uniffi interface (.udl)
2. ✅ Implement Rust bridge
3. ✅ Add build configuration
4. 🔄 Test build and generate bindings
5. ⏭ Create RN native module wrapper
6. ⏭ Update mix task to regenerate uniffi bindings
7. ⏭ Test end-to-end: Server → RN → Rust → RN display
