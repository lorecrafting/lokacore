# Loka Layer Separation Audit

Audit the three-layer architecture (Engine → Framework → World Data) for proper separation of concerns.

> **Timeout Budget**: 8 minutes

## Architecture Layers

```
┌─────────────────────────────────────────┐
│ WORLD DATA (priv/world/)                │  ← Game content (YAML)
│   prototypes/, config/, combat/, magic/ │
├─────────────────────────────────────────┤
│ FRAMEWORK (lib/loka/framework/)         │  ← Game-specific logic
│   22 subsystems: Combat, Quest, etc.    │
├─────────────────────────────────────────┤
│ ENGINE (lib/loka/engine/)               │  ← Game-agnostic core
│   Entities, Hooks, Events, Commands     │
└─────────────────────────────────────────┘

Allowed: Framework → Engine, World Data → Framework
FORBIDDEN: Engine → Framework, Framework → World Data (hardcoded)
```

## 1. Engine → Framework Violations (CRITICAL)

Search for Framework imports in Engine modules:

```bash
# Check engine/ for Framework imports
grep -rn "alias Loka.Framework" lib/loka/engine/
grep -rn "Loka.Framework\." lib/loka/engine/
```

Report any violations found. Check the task list to see if violations are already being tracked.

**Fix strategies**:
1. **Extension pattern** (preferred): Engine defines behaviour, Framework implements
   - Example: `Engine.ScriptingExtension` behaviour + `Framework.Scripting.GameScriptAPI`
   - Engine loads extensions via config at runtime
2. **Hooks pattern**: Use existing Hooks system for event-driven decoupling
3. **Protocol pattern**: Engine defines protocol, Framework implements for specific types
4. **Plugin registration**: Engine provides registration API, Framework registers handlers

## 2. Framework → World Data Violations (HIGH)

Search for hardcoded game data that should be in YAML:

**Check these modules for @module attributes with game data**:
- `combat/damage_types.ex` - damage/armor type definitions
- `combat/elements.ex` - elemental system definitions
- `combat/weapon_armor_types.ex` - effectiveness matrix
- `magic/spell_words.ex` - spell word definitions
- `world/day_night.ex` - time phase definitions
- `world/weather.ex` - weather type definitions

**Signs of hardcoded data**:
- Large @default_* module attributes with maps/lists
- `defp default_*` functions returning static data
- Magic numbers without configuration

**Fix**: Move to `priv/world/` YAML files, load via GenServer

## 3. Healthy Dependencies (verify these are correct)

**Framework → Engine** (ALLOWED):
```bash
# These should exist and are correct
grep -rn "alias Loka.Engine" lib/loka/framework/
```

**Expected**: Framework modules should import Entity, Hooks, Events, etc.

## 4. Circular Dependencies

Check for bidirectional imports between modules:

```bash
# Find modules that import each other
# Focus on engine/ and framework/ boundaries
```

## 5. Command Architecture

Commands should be pure Engine concerns or clearly delegated:

**Check**: `lib/loka/engine/commands/`
- Does each command use Engine-level abstractions only?
- Are Framework dependencies injected/abstracted?

## Reporting Format

### Layer Violation Summary

| Layer | Direction | Count | Severity |
|-------|-----------|-------|----------|
| Engine→Framework | FORBIDDEN | ? | CRITICAL |
| Framework→WorldData | FORBIDDEN | ? | HIGH |
| Framework→Engine | ALLOWED | ? | OK |

### File-by-File Violations

For each violation:
```
File: lib/loka/engine/commands/get_command.ex:18
Violation: Imports Loka.Framework.Inventory
Fix: Create Engine.CommandExtension behaviour, Framework implements
Priority: P1
```

Note: The scripting layer violation was fixed using the ScriptingExtension pattern.
See `Engine.ScriptingExtension` and `Framework.Scripting.GameScriptAPI` for reference.

### Hardcoded Data Inventory

For each hardcoded data module:
```
File: lib/loka/framework/combat/damage_types.ex
Data: 4 damage types, 9 armor types, effectiveness matrix
Lines: 70-112
Target YAML: priv/world/combat/damage_types.yml
YAML Loading: Partial (has infrastructure)
Priority: P1
```

## Follow-up Actions

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Present each layer violation in bead-ready format:
   - Exact file paths and line numbers
   - Current code snippet
   - Proposed fix with code example
   - Validation command to verify fix

2. Note if >5 related files affected (would be epic bead candidate)

3. Note if docs/architecture/layer-separation.md needs updates
