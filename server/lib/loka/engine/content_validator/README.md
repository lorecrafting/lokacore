# Content Validator Architecture

The content validation system is split across two layers by design:

```
┌─────────────────────────────────────────────────────────────┐
│ FRAMEWORK LAYER - Domain-Specific Validators                │
│ lib/loka/framework/content_validator/                       │
│                                                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ quest_plugin.ex │ │dialogue_plugin.ex│ │ world_plugin.ex │ │
│ │   Quest refs    │ │ Dialogue trees  │ │ Room connectivity│ │
│ │   NPC targets   │ │ Node validation │ │ Exit validation │ │
│ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘ │
│          │                   │                   │          │
│          └───────────────────┼───────────────────┘          │
│                              │                               │
│               implements     │                               │
├──────────────────────────────┼───────────────────────────────┤
│ ENGINE LAYER - Infrastructure & Behaviour                    │
│ lib/loka/engine/content_validator/                           │
│                              │                               │
│ ┌────────────────────────────▼────────────────────────────┐ │
│ │                    plugin.ex                             │ │
│ │            @behaviour ContentValidator.Plugin            │ │
│ │   Defines: name/0, ready?/0, validate/0 callbacks       │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │               prototype_plugin.ex                        │ │
│ │     Validates: YAML syntax, parent refs, field types     │ │
│ │     Engine-level validation (no framework knowledge)     │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Why the Split?

### Engine Layer (`lib/loka/engine/content_validator/`)
Contains:
- **Plugin behaviour** (`plugin.ex`) - The contract all validators must implement
- **Prototype validator** (`prototype_plugin.ex`) - Validates YAML structure and inheritance

The Engine layer provides:
1. **Infrastructure** - The behaviour definition and plugin discovery mechanism
2. **Low-level validation** - Prototype parsing, parent resolution, field validation
3. **No framework dependencies** - Can run independently of game systems

### Framework Layer (`lib/loka/framework/content_validator/`)
Contains domain-specific validators that understand game semantics:
- **Quest validator** (`quest_plugin.ex`) - Validates quest definitions, NPC targets, prerequisites
- **Dialogue validator** (`dialogue_plugin.ex`) - Validates dialogue tree structure, node references
- **World validator** (`world_plugin.ex`) - Validates room connectivity, exit destinations

The Framework layer provides:
1. **Domain knowledge** - Understanding of quests, dialogue, NPCs, etc.
2. **Cross-system validation** - Checking that quests reference valid NPCs, etc.
3. **Depends on Framework systems** - Needs QuestRegistry, TypedObject.Loader, etc.

## Layer Dependency Rules

```
Framework.ContentValidator → Engine.ContentValidator  ✓ (allowed)
Engine.ContentValidator → Framework.ContentValidator  ✗ (forbidden)
```

## Creating a New Validator

1. **Decide the layer:**
   - Does it validate low-level structure? → Engine
   - Does it need framework systems (quests, combat, etc.)? → Framework

2. **Implement the behaviour:**
   ```elixir
   defmodule Loka.Framework.ContentValidator.MyPlugin do
     @behaviour Loka.Engine.ContentValidator.Plugin

     @impl true
     def name, do: :my_validator

     @impl true
     def ready?, do: Process.whereis(SomeRegistry) != nil

     @impl true
     def validate do
       # Return %{critical: [...], warnings: [...]}
     end
   end
   ```

3. **Register in config:**
   ```elixir
   config :loka, :content_validator_plugins, [
     # Engine plugins
     Loka.Engine.ContentValidator.PrototypePlugin,
     # Framework plugins
     Loka.Framework.ContentValidator.QuestPlugin,
     Loka.Framework.ContentValidator.DialoguePlugin,
     Loka.Framework.ContentValidator.WorldPlugin,
     # Your plugin
     Loka.Framework.ContentValidator.MyPlugin
   ]
   ```

## Running Validators

```bash
# Run all validators
mix loka.test.validate

# Run specific validator
mix loka.test.validate --only quest

# Strict mode (warnings become errors)
mix loka.test.validate --strict
```
