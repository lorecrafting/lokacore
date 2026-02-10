# Plugin Migration Analysis

> **For Developers**: Evaluation of framework systems for migration to plugins
>
> **Status (Feb 2026):** All three systems analyzed below (Farming, Housing, Companion) were **deleted** as dead code. They had zero content usage and no integration points. If these features are needed in the future, they should be re-implemented as plugins from the start using the migration template below.

---

## Overview

Three framework systems were evaluated as plugin candidates:
- `Loka.Framework.Farming` — **Deleted** (Feb 2026, no content using it)
- `Loka.Framework.Housing` — **Deleted** (Feb 2026, no content using it)
- `Loka.Framework.Companion` — **Deleted** (Feb 2026, superseded by Spark)

---

## Evaluation Criteria

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| **Optional** | High | Can the system be removed without breaking core gameplay? |
| **Loosely Coupled** | High | Few dependencies on other framework systems? |
| **Self-Contained** | Medium | Has own state, logic, and data structures? |
| **In Active Use** | High | Is this actually being used in production content? |

---

## Analysis

### Farming System

**Location:** `lib/loka/framework/farming/`

**Components:**
- `farming.ex` - Core farming logic
- `crop.ex` - Crop definitions
- `crop_registry.ex` - Crop prototype loader
- `farm_plot.ex` - Farm plot state management

**Dependencies:**
- `GameState` - Player state integration
- No dependencies on Combat, Quest, or other systems

**Coupling:** ⭐⭐⭐⭐⭐ (Very loose)

**Plugin Candidate:** ✅ **YES**

**Reasons:**
- Completely optional feature
- Self-contained with own registry
- No tight coupling to other systems
- Has clear plugin boundaries (crop types, farming actions)

**Migration Effort:** **Low** (~2-4 hours)
- Move to `lib/loka/plugins/farming/`
- Create `FarmingPlugin` module implementing `Loka.Engine.Plugin`
- Register in `config/config.exs`
- Update imports in any consuming code

**Blockers:** None

**Recommendation:** ⏸️ **Defer** - Not actively used in production. Migrate when farming becomes part of the game.

---

### Housing System

**Location:** `lib/loka/framework/housing/`

**Components:**
- `housing.ex` - Housing management logic

**Dependencies:**
- `GameState` - Player state integration
- No dependencies on other systems

**Coupling:** ⭐⭐⭐⭐⭐ (Very loose)

**Plugin Candidate:** ✅ **YES**

**Reasons:**
- Completely optional feature
- Simple, single-file implementation
- No tight coupling
- Clear plugin API (buy, rent, furnish, recall)

**Migration Effort:** **Very Low** (~1-2 hours)
- Move to `lib/loka/plugins/housing/`
- Create `HousingPlugin` module
- Register in config

**Blockers:** None

**Recommendation:** ⏸️ **Defer** - Not actively used. Migrate when housing is implemented in content.

---

### Companion System

**Location:** `lib/loka/framework/companion/`

**Components:**
- `companion.ex` - Pet/follower system

**Dependencies:**
- `GameState` - Player state integration
- No other system dependencies

**Coupling:** ⭐⭐⭐⭐⭐ (Very loose)

**Plugin Candidate:** ✅ **YES** (but...)

**Reasons to migrate:**
- Optional feature
- Self-contained logic
- No tight coupling

**Reasons NOT to migrate:**
- **Spark system** (`lib/loka/framework/spark/`) is the actual companion implementation
- This generic companion system is unused
- Confusing to have both

**Migration Effort:** **N/A** - Should be removed or merged with Spark

**Blockers:** Overlap with Spark system

**Recommendation:** ❌ **Don't migrate** - Instead:
1. **Option A:** Remove `companion.ex` entirely (Spark is the real companion system)
2. **Option B:** Refactor Spark to extend generic Companion, then plugin-ify both
3. **Option C:** Keep as-is until we need generic companions (future multi-companion support)

**Preferred:** Option A (remove) - Spark is specific to Loka's design, generic companions aren't needed.

---

## Migration Priority

If these systems are activated in production:

### Priority 1: Housing (Easiest)
- **Effort:** 1-2 hours
- **Risk:** Minimal
- **Impact:** Clean architecture, clear optional feature

### Priority 2: Farming (Medium)
- **Effort:** 2-4 hours
- **Risk:** Low
- **Impact:** Good plugin example, self-contained system

### Priority 3: Companion (Complex)
- **Effort:** 4-8 hours (if refactoring with Spark)
- **Risk:** Medium (Spark integration issues)
- **Impact:** Architecture cleanup, but Spark may be enough

---

## Migration Template

When ready to migrate, follow this pattern:

```elixir
# 1. Create plugin module
# lib/loka/plugins/farming/plugin.ex
defmodule Loka.Plugins.Farming do
  use Loka.Engine.Plugin

  @impl true
  def name, do: :farming

  @impl true
  def version, do: "1.0.0"

  @impl true
  def description, do: "Crop planting, growth, and harvesting system"

  @impl true
  def dependencies, do: []  # Or [:inventory, :timers] if needed

  @impl true
  def children do
    [
      Loka.Plugins.Farming.CropRegistry
    ]
  end

  @impl true
  def hooks do
    [
      {:at_room_enter, Loka.Plugins.Farming.Hooks, :check_farm_plot, priority: 50}
    ]
  end
end
```

```elixir
# 2. Move framework code to plugin directory
lib/loka/framework/farming/ → lib/loka/plugins/farming/
```

```elixir
# 3. Register plugin
# config/config.exs
config :loka, :plugins, [
  Loka.Plugins.Guilds,
  Loka.Plugins.Farming  # <-- Add here
]
```

```elixir
# 4. Update module names
Loka.Framework.Farming → Loka.Plugins.Farming
```

---

## Why Defer Migration?

### Current State
- **Farming:** No content using it
- **Housing:** No content using it
- **Companion:** Superseded by Spark

### Migration Costs
- Code moves (risk of breaking references)
- Testing burden (ensure nothing broke)
- Documentation updates
- Developer confusion during transition

### Migration Benefits (Current)
- Architectural purity ✅
- Clearer boundaries ✅
- Example for future plugins ✅
- **Actual gameplay impact:** ❌ None (systems unused)

**Verdict:** Wait until systems are in active use, then migrate for real benefit.

---

## Systems That Should NOT Become Plugins

These are core to every MUD and should stay in framework:

| System | Why Framework | Evidence |
|--------|---------------|----------|
| **Combat** | Universal need | Every MUD has combat |
| **Quest** | Universal need | Quest tracking is core |
| **Inventory** | Universal need | Items are fundamental |
| **Social** | Universal need | Chat, parties, channels |
| **Progression** | Universal need | Leveling, stats |
| **Actions** | Engine-level | Command resolution |
| **Scripting** | Engine-level | Content system |
| **Spark** | Loka-specific | But core to Loka's identity |

**Rule:** If removing it would make Loka "not a MUD", it's framework.

---

## Future Plugin Opportunities

When these features are developed, start as plugins:

- **Mounts** - Optional travel system
- **Achievements** - Optional meta-progression
- **Minigames** - Optional diversions (card games, puzzles)
- **Auction House** - Optional economy feature
- **Territory Control** - Optional PvP/guild feature
- **Weather Effects** - Optional atmospheric system

**Start as plugin from day one** to avoid migration later.

---

## Conclusion

### Immediate Action
**None** - All three systems are good plugin candidates but unused in production.

### Deferred Action
When systems go live in content:
1. **Housing** - Migrate first (easiest)
2. **Farming** - Migrate second (good example)
3. **Companion** - Remove or merge with Spark (don't migrate)

### Long-Term Strategy
- **New optional features** → Start as plugins
- **Core gameplay** → Keep in framework
- **Loka-specific but core** (like Spark) → Framework is fine

---

**Last Updated:** 2026-01-24
**See Also:**
- `lib/loka/engine/plugin.ex` - Plugin behavior definition
- `lib/loka/plugins/guilds/` - Existing plugin example
- `docs/architecture/behavior-systems-explained.md` - Framework vs plugins distinction
