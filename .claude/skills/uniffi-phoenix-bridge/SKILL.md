---
name: uniffi-phoenix-bridge
description: |
  Set up uniffi bridge for React Native apps using Phoenix Channels. Use when:
  (1) integrating Rust renderer/logic with RN app that uses Phoenix Channels,
  (2) getting "UniFfiTag not found in crate root" compilation errors,
  (3) need type-safe bridge matching server channel event types, (4) bridging
  Elixir backend → TypeScript client → Rust native code. Covers uniffi scaffolding
  macro placement, type mirroring from channel.generated.ts, and integration with
  Phoenix channel event schemas.
author: Claude Code
version: 1.0.0
date: 2026-01-25
---

# Uniffi Bridge for Phoenix Channels + React Native

## Problem

When building React Native apps with:
- Elixir/Phoenix backend using Phoenix Channels (WebSocket)
- Auto-generated TypeScript types from channel events
- Rust native renderer/logic integrated via uniffi

You need a type-safe bridge that maintains consistency across the entire stack while avoiding common uniffi compilation pitfalls.

## Context / Trigger Conditions

Use this skill when:

1. **Error: "cannot find type `UniFfiTag` in the crate root"**
   - You've added `uniffi::include_scaffolding!()` to a submodule
   - Compilation fails with 50+ errors about missing UniFfiTag
   - Build.rs runs successfully but linking fails

2. **Integrating Phoenix Channels with Rust:**
   - Have existing `channel.generated.ts` types from server
   - Need Rust code to handle channel event payloads
   - Want type safety across Elixir → TS → Rust

3. **Setting up RN + Rust integration:**
   - Using React Native with native Rust logic
   - Need bidirectional data flow (RN ↔ Rust)
   - Want auto-generated bindings (Swift/Kotlin)

## Solution

### Step 1: Project Structure

```
your-project/
├── server/
│   ├── lib/*/channel/events.ex          # Elixir event definitions
│   ├── priv/schemas/channel_events.json # JSON schema (optional)
│   └── lib/mix/tasks/gen_channel_types.ex # Type generator
├── mobile/
│   └── src/types/channel.generated.ts   # Auto-generated TS types
└── rust-lib/
    ├── src/
    │   ├── lib.rs                       # ⚠️ SCAFFOLDING GOES HERE
    │   ├── your_lib.udl                 # Interface definition
    │   └── bridge/mod.rs                # Implementation
    ├── build.rs                         # Uniffi codegen
    └── Cargo.toml
```

### Step 2: Cargo.toml Configuration

```toml
[package]
name = "your-lib"
crate-type = ["cdylib", "staticlib", "rlib"]  # For mobile platforms

[dependencies]
uniffi = { version = "0.28", features = ["build"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
uniffi = { version = "0.28", features = ["build"] }
```

### Step 3: Create build.rs

```rust
fn main() {
    uniffi::generate_scaffolding("src/your_lib.udl").unwrap();
}
```

### Step 4: Define .udl Interface (Mirror Channel Types)

**Key insight:** Mirror your `channel.generated.ts` structure

```idl
// src/your_lib.udl
namespace your_lib {
    YourBridge create_bridge();
};

interface YourBridge {
    // Match Phoenix channel event handlers
    void update_game_state(string json_payload);
    void handle_room_update(string json_payload);
    void start_dialogue(string entity_id, string text, string choices_json);

    // Return data to RN
    string get_current_content();
    PlayerStats get_player_stats();
};

// Match TypeScript interfaces from channel.generated.ts
dictionary PlayerStats {
    u32 hp;
    u32 max_hp;
    u32 level;
};
```

### Step 5: Implement in Rust (bridge/mod.rs)

```rust
// src/bridge/mod.rs
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

// Data types matching .udl and channel.generated.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStats {
    pub hp: u32,
    pub max_hp: u32,
    pub level: u32,
}

pub struct YourBridge {
    state: Arc<Mutex<BridgeState>>,
}

impl YourBridge {
    fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(BridgeState::default())),
        }
    }

    pub fn update_game_state(&self, json_payload: String) {
        // Parse JSON from channel event
        // Update internal state
    }

    pub fn get_player_stats(&self) -> PlayerStats {
        let state = self.state.lock().unwrap();
        state.player_stats.clone()
    }
}

pub fn create_bridge() -> Arc<YourBridge> {
    Arc::new(YourBridge::new())
}
```

### Step 6: Include Scaffolding at Crate Root ⚠️ CRITICAL

**This is where the error happens if done wrong:**

```rust
// src/lib.rs - CRATE ROOT
pub mod bridge;

// Export types for uniffi
pub use bridge::{YourBridge, PlayerStats, create_bridge};

// ⚠️ MUST BE AT CRATE ROOT - NOT IN SUBMODULES
uniffi::include_scaffolding!("your_lib");
```

**❌ WRONG - Don't do this:**
```rust
// src/bridge/mod.rs - SUBMODULE
uniffi::include_scaffolding!("your_lib"); // ❌ CAUSES UniFfiTag ERROR
```

**Why:** The `include_scaffolding!` macro generates code that must be at the crate root scope. Calling it in a submodule causes Rust to look for `UniFfiTag` in the wrong namespace.

### Step 7: Generate Bindings

```bash
# Build the Rust library first
cargo build --release

# Generate TypeScript/Swift/Kotlin bindings
# (Using uniffi-bindgen-react-native for RN)
npx uniffi-bindgen-react-native --crate-dir ./rust-lib
```

### Step 8: Integrate with React Native

```typescript
// mobile/src/hooks/useRustBridge.ts
import { NativeModules } from 'react-native';
import type { GameStatePayload } from '../types/channel.generated';

const { YourLib } = NativeModules;

export function useRustBridge() {
  const [bridge, setBridge] = useState<number | null>(null);

  useEffect(() => {
    YourLib.createBridge().then(setBridge);
  }, []);

  // Channel event → Rust bridge
  const handleGameState = (payload: GameStatePayload) => {
    if (bridge) {
      YourLib.updateGameState(bridge, JSON.stringify(payload));
    }
  };

  return { bridge, handleGameState };
}
```

### Step 9: Connect Phoenix Channels to Bridge

```typescript
// In your game screen component
const { channel } = usePhoenixChannel();
const { handleGameState } = useRustBridge();

useEffect(() => {
  if (!channel) return;

  channel.on('game_state', handleGameState);
  channel.on('room_update', (payload) => {
    YourLib.handleRoomUpdate(bridge, JSON.stringify(payload));
  });

  return () => {
    channel.off('game_state');
    channel.off('room_update');
  };
}, [channel, bridge]);
```

## Type Safety Pattern

**Single Source of Truth:** Server Elixir event definitions

**Flow:**
1. Define events in Elixir (`events.ex`)
2. Generate TypeScript types (`mix gen.channel_types`)
3. Mirror types in `.udl` for Rust
4. Uniffi generates native bindings

**Maintaining Sync:**
- Extend your `mix gen.channel_types` task to also update `.udl`
- Add validation that checks TS types match .udl types
- Version your API and check compatibility at runtime

```elixir
# Extend existing mix task
defmodule Mix.Tasks.Gen.ChannelTypes do
  def run(_) do
    # Existing: Generate channel.generated.ts
    generate_typescript_types()

    # New: Regenerate uniffi .udl
    generate_uniffi_udl()

    # Rebuild Rust with new types
    System.cmd("cargo", ["build"], cd: "../rust-lib")
  end
end
```

## Verification

After setup, verify:

1. **Build succeeds:**
   ```bash
   cargo build --lib
   # Should succeed with only warnings, no errors
   ```

2. **Scaffolding generated:**
   ```bash
   find target/debug/build -name "*.uniffi.rs"
   # Should find generated scaffolding file
   ```

3. **Bindings work:**
   ```bash
   npx uniffi-bindgen-react-native --crate-dir .
   # Should generate TypeScript/Swift/Kotlin files
   ```

4. **Types match:**
   - Compare `channel.generated.ts` interfaces
   - With `.udl` dictionary definitions
   - Ensure same field names and types

## Common Errors and Fixes

### Error: "cannot find type `UniFfiTag` in the crate root"

**Cause:** `uniffi::include_scaffolding!` called in submodule instead of lib.rs

**Fix:**
```rust
// Move from src/bridge/mod.rs to src/lib.rs
pub mod bridge;
pub use bridge::*;

uniffi::include_scaffolding!("your_lib"); // At crate root!
```

### Error: "the trait bound `YourType: Deserialize` is not satisfied"

**Cause:** Data types in bridge/mod.rs missing serde derives

**Fix:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)] // Add these!
pub struct YourType {
    pub field: String,
}
```

### Error: Build succeeds but bindings fail

**Cause:** Type mismatch between .udl and Rust implementation

**Fix:**
- Ensure struct names match exactly
- Ensure field names and types match
- Check that all types in .udl have corresponding Rust types

## Example: Loka Book Client

**Architecture:**
```
Loka Server (Elixir)
  ↓ Phoenix Channels (WebSocket)
  ↓ channel.generated.ts (91 event types)
RN Mobile App
  ↓ [Uniffi Bridge]
  ↓ Swift/Kotlin bindings
Rust Book Renderer (Bevy 0.15)
```

**Key files:**
- `server/lib/loka/channel/events.ex` - Source of truth
- `mobile/src/types/channel.generated.ts` - Generated TS types
- `book-client/src/loka_book.udl` - Uniffi interface mirroring channel types
- `book-client/src/bridge/mod.rs` - Rust implementation
- `book-client/src/lib.rs` - Crate root with `include_scaffolding!`

**Type mirroring example:**
```typescript
// channel.generated.ts
export interface DialogueStartPayload {
  entity_id: string;
  node_id: string;
  text: string;
  choices: DialogueChoice[];
}
```

```idl
// loka_book.udl
dictionary DialogueStateData {
  string entity_id;
  string node_id;
  string current_text;
  sequence<DialogueChoiceData> choices;
};
```

```rust
// bridge/mod.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogueStateData {
    pub entity_id: String,
    pub node_id: String,
    pub current_text: String,
    pub choices: Vec<DialogueChoiceData>,
}
```

## Notes

- **Build times:** First build with uniffi takes 2-5 minutes (compiles many dependencies)
- **Versions:** Keep uniffi version consistent between dependencies and build-dependencies
- **Platform targets:** Use `cdylib` for mobile, `staticlib` for some platforms, `rlib` for Rust-only
- **JSON overhead:** Passing JSON strings is simple but has serialization cost - consider binary formats for high-frequency updates
- **Newer uniffi versions:** v0.28+ supports proc macros as alternative to .udl files
- **React Native Turbo Modules:** Mozilla's `uniffi-bindgen-react-native` (released Dec 2024) simplifies the RN integration

## References

- [Uniffi for React Native: Official Mozilla Announcement](https://hacks.mozilla.org/2024/12/introducing-uniffi-for-react-native-rust-powered-turbo-modules/)
- [uniffi-bindgen-react-native GitHub](https://github.com/jhugman/uniffi-bindgen-react-native)
- [Uniffi User Guide: Rust Scaffolding](https://mozilla.github.io/uniffi-rs/latest/tutorial/Rust_scaffolding.html)
- [Uniffi Proc Macros Guide](https://mozilla.github.io/uniffi-rs/latest/proc_macro/index.html)
- [Phoenix Channels Rust Client](https://github.com/liveview-native/phoenix-channels-client)
- [TypeScript-Rust Bridge Patterns](https://github.com/twop/ts-rust-bridge)
