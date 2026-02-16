# Live Operations Guide

**Last Updated:** 2026-02-15
**Status:** Current State Analysis + Recommendations (V2 Unified Entity System)

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

**Content Hot-Reload (V2):**
- `EntitySeeder.seed()` - Re-seeds all content entities from YAML
- Content types: quest, dialogue, script, zone, skill, recipe, cutscene, etc.
- SQLite storage with `Entities` API for queries
- Content modules provide type-safe accessors (`Content.Quest`, `Content.Dialogue`, etc.)

**Session Resilience:**
- 30-second reconnect grace period (`lib/loka/session/server.ex:69`)
- Multi-client support (same player on multiple devices)
- Combat state persists across LiveView crashes (10-min timeout via CombatServer)

**Data Safety:**
- Auto-save every 60 seconds for entities (`lib/loka/engine/entity_server.ex:42`)
- Save-on-termination for graceful stops (`entity_server.ex:325-355`)
- Comprehensive validation suite (`mix loka.test.validate`)

**LLM Development Tooling:**
- Content validators (`Loka.Testing.Content.*`) - Validation with detailed errors
- `/project:check-work` - Post-implementation verification checklist
- API validation endpoints (`POST /api/test/validate`)

---

## Hot-Reload Mechanisms

### Content Hot-Reload (YAML Prototypes)

**Status:** ✅ FULLY SUPPORTED (V2)

**V2 Implementation:**
- Content entities (quests, dialogues, scripts, zones) seeded into SQLite at startup via `EntitySeeder`
- Runtime reload via `EntitySeeder.seed()` (full re-seed, ~650ms)
- Entities fetched via `Entities.find_one(key: key, type: :quest)`
- Content modules (`Content.Quest`, `Content.Dialogue`, etc.) provide type-safe APIs

**How it works:**
1. `EntitySeeder.seed()` reads YAML from `priv/world/`
2. Transforms to entity structs with `components["data"]` containing content
3. Inserts/updates SQLite `entities` table
4. Content modules query via `Entities` API

**Limitations:**
- ❌ Full re-seed required (no incremental updates yet)
- ❌ No notification to running EntityServers when content changes
- ⚠️ Expensive operation (~650ms) - use judiciously

### Elixir Script Hot-Reload

**Status:** ✅ FULLY SUPPORTED (V2)

**V2 Implementation:**
- Scripts are content entities (`type: :script`) seeded from YAML
- Loaded via `Content.Script.get(key)`
- Scripts fetched fresh on each execution (no caching)
- Reload via `EntitySeeder.seed()` like other content

**Trait Scripts:**
- Script traits: `%{"script" => "ambient_emote", "config" => %{}}` in `entity.traits`
- Dispatched via `dispatch_script_traits_tick/1` in EntityServer
- Sandboxed execution with bindings (`get_trait_state`, `set_trait_state`, etc.)

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

# 3. Deploy to production
git add priv/world/prototypes
git commit -m "Update merchant dialogue"
git push  # Triggers GitHub Actions deploy

# 4. Hot-reload on live server (via IEx)
iex> Session.broadcast_all("[System] Content update in 30 seconds...")
iex> :timer.sleep(30_000)
iex> Loka.Engine.EntitySeeder.seed()
iex> Session.broadcast_all("[System] New content loaded!")
```

**Player Impact:** ⭐ **Minimal** - Content re-seeded seamlessly, existing sessions unaffected

**Current Gaps:**
- ❌ No notification to running EntityServers when content changes
- ❌ Admin builder doesn't have "Reload Content" command (must use IEx)
- ❌ Full re-seed only (no incremental updates)

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

In V2, player state is stored in entity components (character entity in `entities` table):

- `components["combatant"]` - Health, stats, combat state
- `components["equipment"]` - Equipped items by slot
- `components["quest_progress"]` - Quest progress (active and completed)
- `components["skills"]` - Skill levels
- `components["resources"]` - Mana, stamina, etc.
- `entity.location_id` - Current room
- `entity.metadata` - Flags, settings, preferences

**Note:** `GameState` (V1) still exists as a bridge during migration but is being phased out.

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

# 2. Run automated tests
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

### Rollback Capabilities (Implemented)

**World State Export/Import:**

**Files:** `lib/loka/engine/world_exporter.ex`, `lib/loka/engine/world_importer.ex`

```bash
# Before making risky changes
iex> Loka.Engine.WorldExporter.export_all("/tmp/backup.yml")

# If something breaks
iex> Loka.Engine.WorldImporter.import_from_file("/tmp/backup.yml")
```

**Content Versioning (Git):**
```bash
# Rollback content changes
git log --oneline priv/world/prototypes/
git revert <commit>
git push
# Then re-seed on server:
iex> Loka.Engine.EntitySeeder.seed()
```

### Current LLM Integration Points

**Files:**
- `lib/loka_web/controllers/api/validate_controller.ex` - Validation API endpoint
- `lib/loka_web/controllers/api/test_controller.ex` - Test harness API
- `.claude/commands/check-work.md` - Post-implementation verification checklist
- `docs/builder-reference/README.md` - LLM tooling documentation

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

1. **Add "reload" command to Builder**
   - Location: `lib/loka_web/channels/game_channel/builder_commands/`
   - Action: Call `EntitySeeder.seed()` with safety checks
   - Effort: 1 hour

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
| Room descriptions | Edit YAML → re-seed | ❌ No | ❌ No | Add builder reload command |
| NPC dialogue | Edit YAML → re-seed | ❌ No | ❌ No | Add builder reload command |
| Quest definitions | Edit YAML → re-seed | ❌ No | ❌ No | Add builder reload command |
| Item stats | Edit YAML → re-seed | ❌ No | ❌ No | Notify EntityServers of change |
| Combat formulas | Edit code → deploy | ✅ Yes | ✅ Yes (30s) | **Move to YAML config** |
| Database schema | Migration → deploy | ✅ Yes | ✅ Yes (30s) | Add graceful shutdown |
| New features | Code → deploy | ✅ Yes | ✅ Yes (30s) | Use feature flags |
| Bug fixes | Code → deploy | ✅ Yes | ✅ Yes (30s) | Add pre-shutdown announcement |

---

## Summary

**What Works Well:**
- ✅ Content re-seeding (YAML → SQLite entities)
- ✅ 30-second session reconnect grace period
- ✅ Single DB truth (no ETS/DB sync issues)
- ✅ Comprehensive validation suite (`mix loka.test.validate`)
- ✅ Entity auto-save and save-on-termination (60s interval)
- ✅ Git-based content versioning and rollback

**Critical Gaps:**
- 🔴 Sessions don't survive server restarts
- 🔴 Combat state lost on server restart
- 🔴 No pre-shutdown player announcements
- 🔴 Combat formulas hardcoded (requires deploy to tune)
- 🔴 No maintenance mode

**For LLM-Assisted Development:**
- ✅ Strong validation infrastructure (`mix loka.test.validate`)
- ✅ Dependency graph analysis tools
- ✅ Human-readable error formatting
- ✅ Content rollback via Git (YAML files)
- ⚠️ Builder lacks "reload" command (must use IEx)

**Recommended Priority Order:**
1. Add graceful shutdown with announcements (1 day)
2. Add "reload" builder command (1 hour)
3. Implement maintenance mode (1 day)
4. Move combat formulas to components (2-3 days)
5. Session persistence across restarts (2-3 days)
6. Incremental content updates (no full re-seed) (3-5 days)

---

## References

**Key Files Analyzed:**
- `lib/loka/engine/entity_seeder.ex` - Content seeding from YAML
- `lib/loka/engine/entity_server.ex` - Entity lifecycle
- `lib/loka/session/server.ex` - Session management
- `lib/loka/game/actions/combat.ex` - Combat actions
- `fly.toml` - Deployment configuration

**Related Documentation:**
- `docs/architecture/entity-lifecycle.md` - Entity server patterns
- `docs/builder-reference/README.md` - LLM development tools
- `.claude/commands/check-work.md` - Verification checklist
- `CLAUDE.md` - Project overview
