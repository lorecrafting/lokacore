# Guardrails & Validation System

This document describes Loka's guardrails system - a set of validation mechanisms
designed to catch errors at definition time rather than runtime, making LLM-assisted
development more deterministic and safe.

## Philosophy

The core principle is **"Fail Fast, Fail Loud"**:
- Errors caught in development are cheaper than errors in production
- Schemas and types create guardrails that prevent entire classes of bugs
- Automated validation in CI prevents regressions

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SINGLE SOURCE OF TRUTH                   │
│         priv/schemas/*.json - JSON Schema definitions       │
├─────────────────────────────────────────────────────────────┤
│  SERVER VALIDATION           │  CLIENT GENERATION           │
│  - Runtime payload checks    │  - TypeScript types          │
│  - mix loka.test.validate    │  - mix loka.generate.*       │
├──────────────────────────────┴──────────────────────────────┤
│                    CONTENT VALIDATION                        │
│  - Quest completability      - Prototype definitions         │
│  - Dialogue trees            - World connectivity            │
│  - Crafting recipes          - UI/data consistency           │
└─────────────────────────────────────────────────────────────┘
```

## YAML Content Schemas

JSON Schema definitions exist for validating YAML game content:

| Schema | Location | Validates |
|--------|----------|-----------|
| Quest | `priv/schemas/quest.schema.json` | Quest YAML files |
| NPC | `priv/schemas/npc.schema.json` | NPC prototype fields |
| Room | `priv/schemas/room.schema.json` | Room definitions |
| Storyline | `priv/schemas/storyline.schema.json` | Storyline structure |

These schemas are used by content validators in `mix loka.test.validate`.

## Channel Event Schemas

### Location
- Schema: `priv/schemas/channel_events.json`
- Elixir: `LokaWeb.Channels.ChannelSchema`

### Workflow for Adding New Events

1. **Define schema** in `priv/schemas/channel_events.json`:
   ```json
   "my_new_event": {
     "description": "What this event does",
     "payload": {
       "type": "object",
       "properties": {
         "my_field": { "type": "string" }
       },
       "required": ["my_field"]
     }
   }
   ```

2. **Run validation** to check schema is valid:
   ```bash
   mix loka.test.validate --only channel
   ```

3. **Generate TypeScript types** for mobile:
   ```bash
   mix loka.generate.channel_types
   ```

4. **Implement handler** in `GameChannel`:
   ```elixir
   def handle_in("my_new_event", %{"my_field" => value}, socket) do
     # Handler implementation
     {:reply, :ok, socket}
   end
   ```

5. **Run validation again** to verify handler exists:
   ```bash
   mix loka.test.validate --only channel
   ```

### Runtime Validation

> **Note:** `ChannelValidator` was designed but never wired into the pipeline (removed Feb 2026).
> Channel events are validated by pattern matching in `GameChannel.handle_in/3`.
> Runtime validation can be re-implemented if needed using the schema definitions above.

## Content Validation

### Available Validators

Run `mix loka.test.validate` to execute all validators:

| Validator | Description | Flag |
|-----------|-------------|------|
| World | Room connectivity, exit consistency | `--only world` |
| Quest | Completability, valid targets | `--only quest` |
| Prototype | Valid parents, required fields | `--only prototype` |
| Dialogue | Node references, actions | `--only dialogue` |
| Reachability | Items, NPCs accessible | `--only reachability` |
| Crafting | Recipes, ingredients | `--only crafting` |
| Channel | Handler-schema sync | `--only channel` |

### Strict Mode

Use `--strict` to treat warnings as errors:
```bash
mix loka.test.validate --strict
```

This is recommended for CI pipelines.

## Type Generator Scripts

### Channel Types
```bash
# Generate to default location (mobile/src/types/channel.generated.ts)
mix loka.generate.channel_types

# Preview output
mix loka.generate.channel_types --stdout

# Custom output
mix loka.generate.channel_types --output ./types/events.ts
```

### Generated File Structure
```typescript
// channel.generated.ts

// Shared types from definitions
export type Uuid = string;
export type Direction = 'north' | 'south' | ...;

// Event names union
export type ChannelEvent = 'navigate' | 'click_entity' | ...;

// Individual payload types
export type NavigatePayload = { direction: Direction };
export type ClickEntityPayload = { entity_id: Uuid } | { id: Uuid; type: EntityType };

// Type-safe push helper
export type PushEvent<E extends ChannelEvent> = ...;
```

## Future Guardrails (Roadmap)

### Phase 1: Input Validation (High Priority)
- [ ] Command context validation
- [ ] Dialogue action payload validation
- [ ] Quest ID validation at acceptance

### Phase 2: State Machines (High Priority)
- [ ] Quest state transitions
- [ ] Combat state machine
- [ ] Status effect lifecycle

### Phase 3: Business Invariants (High Priority)
- [ ] Non-negative currency
- [ ] HP pool bounds
- [ ] Inventory quantity validation

### Phase 4: YAML Schemas (Already Implemented)
- [x] Quest YAML schema (`priv/schemas/quest.schema.json`)
- [x] NPC YAML schema (`priv/schemas/npc.schema.json`)
- [x] Room YAML schema (`priv/schemas/room.schema.json`)
- [x] Storyline YAML schema (`priv/schemas/storyline.schema.json`)
- [ ] Prototype YAML schema (items, weapons, armor)
- [ ] Dialogue YAML schema

### Phase 5: Cross-Layer Contracts (Medium Priority)
- [ ] Hook return value validation
- [ ] Event payload schemas
- [ ] Command context requirements

## Best Practices for LLM Development

### DO:
- ✅ Define schemas BEFORE implementing handlers
- ✅ Run `mix loka.test.validate` after every significant change
- ✅ Use enums/constants instead of magic strings
- ✅ Add guard clauses for public function inputs
- ✅ Update TypeScript types when schemas change

### DON'T:
- ❌ Add channel handlers without schema definitions
- ❌ Use `String.to_atom/1` on untrusted input
- ❌ Skip validation in "quick fixes"
- ❌ Hardcode values that should be configurable
- ❌ Bypass type guards with pattern matching

## Troubleshooting

### "Handler exists but not in schema"
Add the event to `priv/schemas/channel_events.json`.

### "Schema defines event but no handler found"
Implement `handle_in/3` for the event in `GameChannel`.

### "TypeScript types out of sync"
Run `mix loka.generate.channel_types`.

### Validation passes locally but fails in CI
Ensure you've committed:
- `priv/schemas/*.json`
- `mobile/src/types/*.generated.ts`
