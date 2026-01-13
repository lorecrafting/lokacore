# Live Operations Guide

**Last Updated:** 2026-01-01
**Status:** Current State Analysis + Recommendations

This document provides a comprehensive analysis of Loka's capabilities for running a production MMORPG with hundreds of concurrent players while using LLM-assisted development for rapid iteration. It covers hot-reload mechanisms, content update workflows, session persistence, and recommended practices for minimizing player disruption during updates.

---

## Table of Contents

1. [Current Capabilities](#current-capabilities)
2. [Hot-Reload Mechanisms](#hot-reload-mechanisms)
3. [Content Update Workflows](#content-update-workflows)
4. [Session & State Management](#session--state-management)
5. [Player Experience During Updates](#player-experience-during-updates)
6. [LLM-Assisted Development Workflows](#llm-assisted-development-workflows)
7. [Critical Gaps](#critical-gaps)
8. [Recommended Improvements](#recommended-improvements)
9. [Change Impact Matrix](#change-impact-matrix)

---

## Current Capabilities

### ✅ Strong Foundations

**Content Hot-Reload:**
- `PrototypeLoader.reload()` - YAML prototypes update without restart
- 15+ content registries with reload support:
  - QuestRegistry, ZoneLoader, SocialLoader
  - ResourceRegistry, GatheringRegistry, CraftingRegistry
  - WeatherRegistry, FactionRegistry, StatusRegistry
  - SpellWords, DamageTypes, Elements, Tactical
- ETS with `read_concurrency: true` for fast concurrent lookups

**Session Resilience:**
- 30-second reconnect grace period (`lib/loka/session/server.ex:69`)
- Multi-client support (same player on multiple devices)
- Combat state persists across LiveView crashes (10-min timeout via CombatServer)

**Data Safety:**
- Auto-save every 60 seconds for entities (`lib/loka/engine/entity_server.ex:42`)
- Save-on-termination for graceful stops (`entity_server.ex:325-355`)
- Comprehensive validation suite (`mix loka.test.validate`)

**LLM Development Tooling:**
- `Loka.WorldBuilder.Analysis.DependencyGraph` - Content impact analysis
- Content validators (`Loka.Testing.Content.*`) - Validation with detailed errors
- `/project:check-work` - Post-implementation verification checklist
- API validation endpoints (`POST /api/test/validate`)

---

## Hot-Reload Mechanisms

### Prototype Hot-Reload (YAML Content)

**File:** `lib/loka/engine/prototype_loader.ex`

**Status:** ✅ FULLY SUPPORTED

```elixir
# Lines 127-129: Hot-reload API
@doc """
Reloads all prototypes from disk. Hot-reload without restart.
"""
def reload(server \\ __MODULE__)
```

**How it works:**
1. `PrototypeLoader.reload()` re-reads all YAML files from `priv/world/prototypes/`
2. Parses and validates prototypes
3. Resolves parent inheritance chains
4. Updates ETS table atomically (lines 404-420)

**Key Implementation (lines 404-420):**
```elixir
defp update_ets(table, resolved_prototypes) do
  # Insert/update all new prototypes atomically
  Enum.each(resolved_prototypes, fn {key, proto} ->
    :ets.insert(table, {key, proto})
  end)
  # Remove orphaned entries (keys that no longer exist)
  Enum.each(orphaned_keys, fn key ->
    :ets.delete(table, key)
  end)
end
```

**Gap:** ❌ No notification mechanism to inform running EntityServers that their prototype changed.

### Elixir Script Hot-Reload

**File:** `lib/loka/engine/scripting.ex`

**Status:** ⚠️ PARTIAL SUPPORT

- Scripts stored in database (`lib/loka/engine/scripts.ex`)
- Scripts loaded fresh on each execution (not cached)
- Admin dashboard can edit and test scripts at runtime

**Gap:** ❌ No bulk script reload or invalidation mechanism.

### Elixir Code Hot-Swapping

**Status:** ⚠️ INHERENT OTP SUPPORT, NOT EXPLICITLY CONFIGURED

- Elixir/OTP supports hot code loading natively
- No explicit `.appup` or `.relup` files found
- Current deployment uses full release replacement

---

## Content Update Workflows

### Workflow A: Content Changes (YAML/Prototypes)

**Best for:** Room descriptions, NPC dialogue, item stats, quest definitions

**Recommended Process:**

```bash
# 1. Make changes locally
edit priv/world/prototypes/npcs/merchant.yml

# 2. Validate changes
mix loka.test.validate --only dialogue,quest,reachability

# 3. Use dependency analysis tools
iex> alias Loka.WorldBuilder.Analysis.DependencyGraph
iex> {:ok, graph} = DependencyGraph.build()
iex> DependencyGraph.dependencies_for(graph, "quest:monastery_arc")

# 4. Deploy to production
git add priv/world/prototypes
git commit -m "Update merchant dialogue"
git push  # Triggers GitHub Actions deploy

# 5. Hot-reload on live server (via IEx or admin API)
iex> Session.broadcast_all("[System] Content update in 30 seconds...")
iex> :timer.sleep(30_000)
iex> PrototypeLoader.reload()
iex> QuestRegistry.reload()
iex> Session.broadcast_all("[System] New content loaded!")
```

**Player Impact:** ⭐ **Minimal** - Prototypes reload seamlessly, existing sessions unaffected

**Current Gaps:**
- ❌ No notification to running EntityServers when their prototype changes
- ❌ Admin dashboard doesn't have "Reload Content" button (must use IEx)

### Workflow B: Combat Mechanics Changes

**Best for:** Damage formulas, ability cooldowns, balance tuning

**Current State:** ⚠️ **REQUIRES CODE DEPLOYMENT**

**File:** `lib/loka/framework/combat/combat.ex` (lines 272-300, 679-700)

Combat formulas are hardcoded in Elixir:

```elixir
# Base attack formula
base_damage = player_str + weapon_bonus + strength_training_bonus
damage = max(1, base_damage - enemy_def)
variance = :rand.uniform(41) - 21  # +/- 20%
final_damage = max(1, trunc(damage * (1 + variance / 100)))

# Power Strike formula
damage = max(1, trunc((base_damage - enemy_def) * 1.5))  # 150% damage
```

**Temporary Workaround:**

```bash
# 1. Make code changes
edit lib/loka/framework/combat/combat.ex

# 2. Run tests
mix test test/loka/framework/combat/

# 3. Deploy with announcement
# (Players will be disconnected during deploy)
```

**Player Impact:** 🔴 **High disruption** (requires restart currently)

### Workflow C: Code Deployments (Bug Fixes, Features)

**Current Deployment Strategy:** Single-instance replacement (Fly.io)

**File:** `fly.toml`

```toml
kill_signal = 'SIGTERM'
kill_timeout = '30s'
min_machines_running = 1
```

**Current Player Experience:**
1. Server receives SIGTERM
2. 30-second kill timeout window
3. All sessions terminated
4. Players see disconnect message
5. New server starts
6. Players manually reconnect within 30 seconds (session preserved if within grace period)
7. **Combat is lost** (no persistence across restarts)

**Current Gaps:**
- ❌ No pre-shutdown announcement system
- ❌ Sessions don't survive restart (all players disconnected)
- ❌ No maintenance mode (can't prevent new logins)
- ❌ Combat state lost on restart

---

## Session & State Management

### Session Persistence

**File:** `lib/loka/session/server.ex`

**Strengths:**
- **30-second disconnect timeout** (line 69): `@disconnect_timeout :timer.seconds(30)`
- **Multi-client support**: Same player can be on multiple devices simultaneously
- **Process monitoring**: Automatic cleanup when client processes terminate
- **Session state tracking**: Current room, combat state, dialogue state

**Session State Captured:**
```elixir
defstruct [
  :player_id,
  :player,
  :session_id,
  :current_room_id,
  :combat_state,
  :dialogue_state,
  :disconnect_timer,
  :created_at,
  clients: %{}
]
```

**Critical Gap:** ❌ Sessions are marked as `:temporary` restart strategy (line 61), meaning **sessions do NOT survive server restarts**. When the server restarts, all session processes terminate and players must fully reconnect.

### Entity State Preservation

**File:** `lib/loka/engine/entity_server.ex`

**Strengths:**
- **Auto-save every 60 seconds** (line 42): `@default_save_interval_ms 60_000`
- **Save on termination** (lines 325-355): `terminate/2` callback saves dirty state to database
- **Dirty flag tracking**: Only saves when state has actually changed
- **Graceful shutdown**: Saves before stopping due to idle timeout

**Player State Persisted (Database):**

**File:** `lib/loka/framework/player/game_state.ex`

- `inventory` - Item list
- `equipment` - Equipped items by slot
- `quests` - Quest progress (active and completed)
- `flags` - Game state flags
- `stats` - Player stats (level, XP, attributes)
- `health` - Current and max HP
- `resources` - Mana, movement points
- `skills` - Skill levels
- `settings` - Player preferences
- `current_room_id` - Current location

**Gap:** ⚠️ Up to 60-second data loss window if crash occurs between auto-saves.

### Combat State Management

**File:** `lib/loka/framework/combat/combat_server.ex`

**Strengths:**
- **Separate GenServer process per combat** (survives LiveView crashes)
- **10-minute idle timeout** (line 41): `@timeout 10 * 60 * 1_000`
- **Registry-based lookup** for reconnection
- **State persists across LiveView disconnections**

**From moduledoc:**
> GenServer that persists combat state across LiveView disconnections.
> Combat state is stored per-player and survives connection drops.
> Players can reconnect and resume combat within the timeout window.

**Gap:** ❌ CombatServer uses `:one_for_one` DynamicSupervisor with no restart strategy override - if combat server crashes, combat state is lost. On server restart, all combat sessions are lost.

---

## Player Experience During Updates

### Graceful Degradation

**File:** `lib/loka_web/live/game_live/room_manager.ex`

**Room Fallback Mechanism (lines 71-91):**
```elixir
def load_player_room(game_state) do
  case try_load_room(game_state.current_room_id) do
    {:ok, room} ->
      # Normal case - room loaded successfully
      ...
    {:error, :not_found} ->
      # Fallback to starting room
      starting_room_id = RoomLoader.get_starting_room_id() || WorldLoader.get_starting_room_id()
      case try_load_room(starting_room_id) do
        {:ok, room} -> ...
        {:error, :not_found} -> {RoomLoader.empty_room(), game_state}
      end
  end
end
```

**Empty Room Fallback:**

**File:** `lib/loka/framework/world/room.ex` (lines 106-118)

```elixir
def empty_room do
  %{
    id: nil,
    title: "The Void",
    description: "There is nothing here. The world has not been created yet...",
    ...
  }
end
```

**Gaps:**
- ❌ If an NPC's prototype is removed during dialogue, no explicit handling exists
- ❌ If a room is deleted while players are in it, players fall back to "The Void" with no explanation

### Communication Mechanisms

**File:** `lib/loka/session.ex`

**Broadcast Capabilities:**

1. **Server-wide announcements** (lines 243-253):
```elixir
def broadcast_all(message) do
  for {_player_id, session_pid, _meta} <- Registry.list_sessions() do
    send(session_pid, {:broadcast, message})
  end
  :ok
end
```

2. **Room-specific broadcasts** (lines 227-234):
```elixir
def broadcast_to_room(room_id, message)
```

3. **Player-specific messages** (lines 192-202):
```elixir
def send_to_player(player_id, message)
```

**File:** `lib/loka_web/live/game_live.ex` (lines 1853-1860)

**Message Handling:**
```elixir
defp handle_session_message({:announcement, text}, socket) do
  event = %{text: "[Announcement] #{text}", timestamp: DateTime.utc_now()}
  {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
end

defp handle_session_message({:force_disconnect, reason}, socket) do
  {:noreply, redirect(socket, to: ~p"/players/log-in?reason=#{reason}")}
end
```

**Gap:** ❌ No maintenance mode concept - admins can broadcast announcements but cannot:
- Prevent new logins during maintenance
- Gracefully drain connections before restart
- Show countdown timers for scheduled restarts

---

## LLM-Assisted Development Workflows

### Pre-Deployment Safety Checklist

**Before LLM makes any content change:**

```bash
# 1. Validate syntax and schema
mix loka.test.validate

# 2. Check for broken references
iex> alias Loka.WorldBuilder.Analysis.DependencyGraph
iex> {:ok, graph} = DependencyGraph.build()
iex> DependencyGraph.find_broken_references(graph)

# 3. Analyze change impact
iex> DependencyGraph.dependencies_for(graph, "quest:monastery_arc")

# 4. Run automated tests
mix test
mix loka.test.balance --quick
```

### Content Safety Rails (Implemented)

**Validation Layers:**

**File:** `lib/loka/engine/content_validator.ex`

1. **Prototype schema validation** - Ecto changesets catch malformed YAML
2. **ContentValidator** - Startup validation with `:strict` mode
3. **Quest dependency analysis** - `lib/loka/testing/content/quest_validator.ex`
4. **Dialogue tree validation** - `lib/loka/testing/content/dialogue_validator.ex`
5. **World reachability check** - BFS traversal ensures no orphaned rooms

**LLM-Friendly Dependency Analysis:**

**File:** `lib/loka/world_builder/analysis/dependency_graph.ex`

```elixir
iex> alias Loka.WorldBuilder.Analysis.DependencyGraph
iex> {:ok, graph} = DependencyGraph.build()
iex> DependencyGraph.find_broken_references(graph)
# Returns list of broken references:
[
  %{from: "quest:monastery_arc", to: "npc:abbot_missing", type: :giver},
  %{from: "room:temple_hall", to: "room:missing_room", type: :exit}
]
```

### Rollback Capabilities (Implemented)

**World State Export/Import:**

**Files:** `lib/loka/engine/world_exporter.ex`, `lib/loka/engine/world_importer.ex`

```bash
# Before making risky changes
iex> Loka.Engine.WorldExporter.export_all("/tmp/backup.yml")

# If something breaks
iex> Loka.Engine.WorldImporter.import_from_file("/tmp/backup.yml")
```

**Prototype Versioning (Git):**
```bash
# Rollback content changes
git log --oneline priv/world/prototypes/
git revert <commit>
git push
# Then reload on server:
iex> PrototypeLoader.reload()
```

### Current LLM Integration Points

**Files:**
- `lib/loka_web/controllers/api/validate_controller.ex` - Validation API endpoint
- `lib/loka_web/controllers/api/test_controller.ex` - Test harness API
- `.claude/commands/check-work.md` - Post-implementation verification checklist
- `docs/llm/README.md` - LLM tooling documentation

**Validation API:**
```bash
# Validate content without deploying
curl -X POST http://localhost:4000/api/test/validate \
  -H "Content-Type: application/json" \
  -d '{"type": "quest", "data": {...}}'
```

---

## Critical Gaps

### Priority 1: Session Persistence Across Restarts

**Current State:** Sessions marked `:temporary` - do NOT survive restart

**Impact:** 🔴 All players forcibly disconnected on deploy

**File:** `lib/loka/session/server.ex:61`

**Recommended Solution:**

```elixir
# Option A: Persist session to database before shutdown
defmodule Loka.Session.Server do
  def prepare_for_shutdown do
    state = %{
      player_id: player_id,
      current_room_id: current_room_id,
      combat_state: combat_state,
      dialogue_state: dialogue_state
    }
    SessionStore.save(player_id, state)
  end
end

# Option B: Use Horde for distributed sessions
# Replace Registry with Horde.Registry (cluster-aware)
```

**Effort:** Medium (2-3 days)

### Priority 2: Graceful Shutdown with Announcements

**Current State:** No pre-shutdown broadcast

**Impact:** 🔴 Players disconnected without warning

**Recommended Solution:**

```elixir
# lib/loka/deployment/shutdown_handler.ex
defmodule Loka.Deployment.ShutdownHandler do
  def graceful_shutdown(countdown_seconds \\ 300) do
    # 5-minute warning
    Session.broadcast_all("[System] Server restart in 5 minutes. Please finish combat.")
    :timer.sleep(240_000)

    # 1-minute warning
    Session.broadcast_all("[System] Server restart in 1 minute.")
    :timer.sleep(30_000)

    # 30-second warning + force-save
    Session.broadcast_all("[System] Server restart in 30 seconds. Saving all progress...")
    force_save_all_entities()
    :timer.sleep(30_000)

    # Shutdown
    System.stop()
  end
end
```

**Wire into Dockerfile:**
```dockerfile
# Use custom shutdown script
STOPSIGNAL SIGUSR1
```

**Effort:** Low (1 day)

### Priority 3: Data-Driven Combat Formulas

**Current State:** Hardcoded in `lib/loka/framework/combat/combat.ex` lines 272-300

**Impact:** 🔴 Cannot tune combat balance without code deployment

**Recommended Solution:**

```yaml
# priv/world/config/combat_formulas.yml (proposed)
base_attack:
  formula: "player_str + weapon_bonus + skill_bonus"
  variance: 20  # +/- 20%
  min_damage: 1

power_strike:
  damage_multiplier: 1.5
  stamina_cost: 15
  cooldown: 8
```

```elixir
# lib/loka/framework/combat/formula_engine.ex
defmodule Loka.Framework.Combat.FormulaEngine do
  def calculate_damage(attacker, defender, ability) do
    formula = CombatConfig.get_formula(ability.formula_key)
    eval_formula(formula, %{
      attacker: attacker,
      defender: defender,
      ability: ability
    })
  end

  def reload_formulas do
    CombatConfig.reload()
  end
end
```

**Effort:** Medium-High (3-5 days)

### Priority 4: Maintenance Mode

**Current State:** Not implemented

**Impact:** 🟡 Cannot prevent new logins during risky operations

**Recommended Solution:**

```elixir
# lib/loka/deployment/maintenance.ex
defmodule Loka.Deployment.Maintenance do
  def enter_maintenance_mode(reason) do
    MaintenanceFlag.set(true, reason)
    Session.broadcast_all("[Maintenance] #{reason}")
  end

  def exit_maintenance_mode do
    MaintenanceFlag.set(false)
    Session.broadcast_all("[System] Server is back online!")
  end
end

# In auth pipeline (lib/loka_web/plugs/auth.ex)
plug :check_maintenance_mode
defp check_maintenance_mode(conn, _opts) do
  if MaintenanceFlag.enabled?() and not is_admin?(conn) do
    halt_with_maintenance_page(conn)
  else
    conn
  end
end
```

**Effort:** Low (1 day)

---

## Recommended Improvements

### Quick Wins (Can Implement Today)

1. **Add "Reload Content" button to Admin Dashboard**
   - Location: `lib/loka_web/live/admin_live/system_tab.ex`
   - Action: Call `PrototypeLoader.reload()` + all registry reloads
   - Effort: 30 minutes

2. **Create pre-shutdown announcement task**
   - Mix task: `mix loka.deploy.announce "Restarting in 5 minutes"`
   - Effort: 1 hour

3. **Document hot-reload workflow in CLAUDE.md**
   - Add section: "Deploying Content Changes"
   - Effort: 15 minutes

### Medium-Term (Next Sprint)

4. **Implement graceful shutdown handler**
   - Dockerfile `STOPSIGNAL` customization
   - 5-min countdown + force-save
   - Effort: 1 day

5. **Add maintenance mode**
   - Block new logins during deploys
   - Show "Maintenance in progress" page
   - Effort: 1 day

6. **Move combat formulas to YAML config**
   - Extract hardcoded formulas to data
   - Implement formula DSL or simple eval
   - Effort: 3-5 days

### Long-Term (Future Roadmap)

7. **Session persistence across restarts**
   - Save session state before shutdown
   - Restore on reconnect
   - Effort: 2-3 days

8. **Combat state persistence**
   - Snapshot to DB every turn
   - Restore from DB on reconnection
   - Effort: 2-3 days

9. **Rolling deploys**
   - Multi-machine Fly.io setup
   - Cluster-aware Registry (Horde)
   - Zero-downtime deploys
   - Effort: 1-2 weeks

10. **Prototype change notifications**
    - Notify EntityServers when their prototype updates
    - Optional: Auto-refresh entity from new prototype
    - Effort: 2-3 days

---

## Change Impact Matrix

| Change Type | Current Method | Restart Required? | Player Disconnect? | Recommended Improvement |
|-------------|---------------|-------------------|-------------------|------------------------|
| Room descriptions | Edit YAML → reload | ❌ No | ❌ No | ✅ Already optimal |
| NPC dialogue | Edit YAML → reload | ❌ No | ❌ No | ✅ Already optimal |
| Quest definitions | Edit YAML → reload | ❌ No | ❌ No | Add registry reload button |
| Item stats | Edit YAML → reload | ❌ No | ❌ No | Notify EntityServers of change |
| Combat formulas | Edit code → deploy | ✅ Yes | ✅ Yes (30s) | **Move to YAML config** |
| Database schema | Migration → deploy | ✅ Yes | ✅ Yes (30s) | Add graceful shutdown |
| New features | Code → deploy | ✅ Yes | ✅ Yes (30s) | Use feature flags |
| Bug fixes | Code → deploy | ✅ Yes | ✅ Yes (30s) | Add pre-shutdown announcement |

---

## Summary

**What Works Well:**
- ✅ Prototype hot-reload (YAML content)
- ✅ 30-second session reconnect grace period
- ✅ Combat state persistence across LiveView crashes
- ✅ Comprehensive validation suite for LLM-generated content
- ✅ Entity auto-save and save-on-termination
- ✅ World export/import for backup and rollback

**Critical Gaps:**
- 🔴 Sessions don't survive server restarts
- 🔴 Combat state lost on server restart
- 🔴 No pre-shutdown player announcements
- 🔴 Combat formulas hardcoded (requires deploy to tune)
- 🔴 No maintenance mode

**For LLM-Assisted Development:**
- ✅ Strong validation infrastructure
- ✅ Dependency graph analysis tools
- ✅ Human-readable error formatting
- ✅ Content rollback via WorldExporter/Git
- ⚠️ Admin dashboard lacks "Reload Content" button

**Recommended Priority Order:**
1. Add graceful shutdown with announcements (1 day)
2. Add "Reload Content" admin button (30 min)
3. Implement maintenance mode (1 day)
4. Move combat formulas to YAML config (3-5 days)
5. Session persistence across restarts (2-3 days)
6. Combat state persistence to DB (2-3 days)

---

## References

**Key Files Analyzed:**
- `lib/loka/engine/prototype_loader.ex` - Prototype hot-reload
- `lib/loka/engine/entity_server.ex` - Entity lifecycle
- `lib/loka/session/server.ex` - Session management
- `lib/loka/framework/combat/combat_server.ex` - Combat state
- `lib/loka/testing/llm/error_formatter.ex` - LLM tooling
- `lib/loka/testing/llm/dependency_graph.ex` - Impact analysis
- `fly.toml` - Deployment configuration

**Related Documentation:**
- `docs/architecture/entity-lifecycle.md` - Entity server patterns
- `docs/llm/README.md` - LLM development tools
- `.claude/commands/check-work.md` - Verification checklist
- `CLAUDE.md` - Project overview
