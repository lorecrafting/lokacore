# World Builder System Audit
**Date:** 2026-01-08
**Scope:** Comprehensive architecture, UX, layer separation, and code quality audit

## Executive Summary

**Overall Health Score: 7.5/10**

The World Builder system demonstrates solid architectural foundations with proper layer separation, clean module organization, and innovative LLM integration. However, several critical issues require immediate attention before production deployment.

### Critical Priorities
1. **Memory leaks in GenServers** (PreviewManager, BulkGenerator)
2. **Missing test coverage** (0% for World Builder modules)
3. **Runtime error in ValidationManager** (incorrect validator return type handling)
4. **Duplicate/confusing systems** (WorldBuilderLive vs WorldDesignerTab)

---

## 1. Architecture & Layer Separation

**Health Score: 9/10**

### ✅ Strengths

**Proper Engine Layer Dependencies:**
- World Builder correctly depends only on Engine layer components:
  - `Loka.Engine.TypedObject` ✓
  - `Loka.Engine.Spawner` ✓
  - `Loka.Engine.EntityServer` ✓
  - `Loka.Engine.TypedObject.Registry` ✓
- **Zero Framework layer violations** - excellent separation!

**Clean Module Organization:**
```
lib/loka/world_builder/
├── room_manager.ex           # CRUD for rooms
├── entity_manager.ex          # CRUD for NPCs/items
├── quest_manager.ex           # Quest editing
├── cutscene_manager.ex        # Cutscene editing
├── template_manager.ex        # Template system
├── batch_operations.ex        # Bulk operations
├── validation_manager.ex      # Real-time validation
├── coordinate_utils.ex        # Coordinate transforms
├── zone_manager.ex            # Zone management
├── layout_manager.ex          # Layout coordination
├── layout/                    # 4 layout algorithms
├── analysis/                  # 3 analysis tools
└── llm/                       # 6 LLM features
```

**Extensible Design:**
- Layout algorithms are pluggable (force-directed, circular, grid, hierarchical)
- Analysis tools are modular (dependency graph, reachability, playability)
- LLM features are cleanly separated (client, context, preview, conversation, presets, bulk, consistency)

### ⚠️ Concerns

**Validator Dependency:**
```elixir
# lib/loka/world_builder/validation_manager.ex:8
alias Loka.Testing.Content.{QuestValidator, CutsceneValidator}
```

**Question:** Is depending on `Loka.Testing.Content` appropriate for production World Builder code?
- **Pro:** Reuses existing validation logic (DRY)
- **Con:** Coupling to testing layer; validators might not be designed for real-time use
- **Recommendation:** Consider moving validators to `Loka.Content.Validation` or creating a shared validation module

---

## 2. Critical Issues (P0 - Fix Before Prod)

### 🔴 CRITICAL: Memory Leaks in GenServers

**File:** `lib/loka/world_builder/llm/preview_manager.ex`
**Issue:** Unbounded state growth - previews never expire automatically

```elixir
# Current implementation stores ALL previews forever
def init(_opts) do
  {:ok, %{previews: %{}}}  # No TTL, no cleanup
end

def handle_call({:add_preview, preview}, _from, state) do
  new_previews = Map.put(state.previews, preview.id, preview)
  {:reply, :ok, %{state | previews: new_previews}}
end
```

**Impact:** If users create previews but never accept/reject them, state grows indefinitely. With 1000 previews × 10KB each = 10MB in GenServer state.

**Fix:**
1. Add automatic cleanup after N minutes
2. Add periodic sweep to remove old previews
3. Limit previews per user (e.g., max 50)

```elixir
# Recommended fix
@preview_ttl_minutes 30
@max_previews_per_user 50

def init(_opts) do
  # Schedule periodic cleanup
  schedule_cleanup()
  {:ok, %{previews: %{}}}
end

defp schedule_cleanup do
  Process.send_after(self(), :cleanup_old_previews, :timer.minutes(5))
end

def handle_info(:cleanup_old_previews, state) do
  cutoff = DateTime.add(DateTime.utc_now(), -@preview_ttl_minutes, :minute)

  new_previews =
    state.previews
    |> Enum.reject(fn {_id, preview} ->
      DateTime.compare(preview.created_at, cutoff) == :lt
    end)
    |> Map.new()

  schedule_cleanup()
  {:noreply, %{state | previews: new_previews}}
end
```

**Same Issue:** `lib/loka/world_builder/llm/bulk_generator.ex` - completed generations never cleaned up

---

### 🔴 CRITICAL: Runtime Error in ValidationManager

**File:** `lib/loka/world_builder/validation_manager.ex:17`
**Issue:** Compiler warning indicates validators return tuples, but code accesses `.errors` as if it's a struct

```elixir
def validate_all do
  {quest_results, _} = QuestValidator.validate()  # Returns tuple
  {cutscene_results, _} = CutsceneValidator.validate()

  %{
    quests: quest_results,
    cutscenes: cutscene_results,
    # BUG: quest_results is NOT a struct with .errors field
    total_errors: length(quest_results.errors) + length(cutscene_results.errors),
    total_warnings: length(quest_results.warnings) + length(cutscene_results.warnings)
  }
end
```

**Compiler Warning:**
```
warning: expected a map or struct when accessing .errors in expression:
    quest_results.errors
```

**Fix:** Inspect validator return format and access correctly:
```elixir
def validate_all do
  {quest_results, _} = QuestValidator.validate()
  {cutscene_results, _} = CutsceneValidator.validate()

  # Check actual return format - might be {:ok, %{errors: [...], warnings: [...]}}
  quest_errors = extract_errors(quest_results)
  cutscene_errors = extract_errors(cutscene_results)

  %{
    quests: quest_results,
    cutscenes: cutscene_results,
    total_errors: length(quest_errors) + length(cutscene_errors),
    total_warnings: length(extract_warnings(quest_results)) + length(extract_warnings(cutscene_results))
  }
end
```

---

### 🔴 CRITICAL: Missing Test Coverage

**Finding:** Zero tests exist for World Builder modules

```bash
$ find test -name "*world_builder*" -o -name "*room_manager*"
# (no results)
```

**Impact:** No safety net for refactoring, regression detection, or validation of core functionality

**Required Tests:**
1. `test/loka/world_builder/room_manager_test.exs`
   - create_room/1
   - update_room/2
   - delete_room/1
   - add_exit/3
   - remove_exit/2

2. `test/loka/world_builder/llm/preview_manager_test.exs`
   - add_preview/3
   - accept_preview/1
   - reject_preview/1
   - preview cleanup after TTL

3. `test/loka/world_builder/validation_manager_test.exs`
   - validate_room/1 detects missing name
   - validate_room/1 detects invalid exits
   - validate_all/0 returns correct format

4. Integration tests for LLM features

**Effort:** 2-3 days for core coverage

---

## 3. High Priority Issues (P1 - Fix Soon)

### 🟠 System Naming Confusion

**Files:**
- `lib/loka_web/live/admin_live/world_builder_live.ex` (1262 lines, NEW)
- `lib/loka_web/live/admin_live/world_designer_tab.ex` (used in AdminLive)
- `lib/loka_web/live/admin_live/world_designer/` (4 component files)

**Issue:** Two different systems with confusing names:
1. **WorldBuilderLive** - New Unity-style 3D editor (not integrated)
2. **WorldDesignerTab** - Older system (currently active in AdminLive)

**Current Router:**
```elixir
# lib/loka_web/live/admin_live.ex:290
<.live_component module={WorldDesignerTab} id="world-designer-tab" />
```

**WorldBuilderLive** is never mounted!

**Questions:**
1. Is WorldBuilderLive meant to replace WorldDesignerTab?
2. Should they coexist (different use cases)?
3. Was migration incomplete?

**Recommendation:**
- **Option A:** Complete migration to WorldBuilderLive, deprecate WorldDesignerTab
- **Option B:** Rename clearly: `WorldBuilderLive` → `UnityStyleEditor`, `WorldDesignerTab` → `SimpleWorldEditor`
- **Option C:** Delete unused code if one system is abandoned

**Effort:** 1 day to clarify + 2-3 days to complete migration or cleanup

---

### 🟠 Unnecessary Dependency: HTTPoison

**File:** `mix.exs:131`
```elixir
{:httpoison, "~> 2.2"},
```

**Used By:** `lib/loka/world_builder/llm/claude_client.ex`

**Issue:** Loka already has `Req` (modern HTTP client) at line 123:
```elixir
{:req, "~> 0.5"},
```

**Why It Matters:**
- Extra dependency increases compile time
- HTTPoison uses Hackney (older, heavier)
- Req is more modern and Elixir-idiomatic

**Fix:** Rewrite ClaudeClient to use Req instead:
```elixir
# Before (HTTPoison)
case HTTPoison.post("#{@api_base}/messages", body, headers, stream_to: self(), async: :once) do
  {:ok, %HTTPoison.AsyncResponse{id: id}} -> {:ok, id}
end

# After (Req)
case Req.post(url: "#{@api_base}/messages", json: request_body, headers: headers, into: :self) do
  {:ok, %Req.Response{}} -> :ok
end
```

**Effort:** 2-4 hours

---

### 🟠 Large LiveView Module

**File:** `lib/loka_web/live/admin_live/world_builder_live.ex` (1262 lines)

**Issue:** Single-file LiveView is approaching maintainability limits

**Recommendation:** Extract components:
1. `world_builder_live/hierarchy_panel.ex` - left panel
2. `world_builder_live/inspector_panel.ex` - right panel
3. `world_builder_live/toolbar.ex` - top toolbar
4. `world_builder_live/console_panel.ex` - bottom console

**Benefit:** Easier testing, clearer boundaries, smaller files

**Effort:** 4-6 hours

---

## 4. Medium Priority Issues (P2 - Nice to Have)

### 🟡 Incomplete TODO Implementations

**File:** `lib/loka/world_builder/llm/style_presets.ex:101`
```elixir
def save_custom_preset(user_id, name, guidelines) do
  # TODO: Implement persistence via Ecto
  {:ok, %{...}}  # Currently returns fake data
end
```

**File:** `lib/loka/world_builder/llm/preview_manager.ex:114`
```elixir
defp commit_preview(%{type: :npc, data: npc_data}) do
  # TODO: Implement NPC creation via EntityManager
  Logger.info("NPC creation not yet implemented: #{inspect(npc_data)}")
  {:ok, :npc_placeholder}
end
```

**File:** `lib/loka/world_builder/llm/consistency_checker.ex:61`
```elixir
defp check_npc_consistency(_npc_data, warnings, _opts) do
  # TODO: Implement NPC consistency checks
  warnings
end
```

**Impact:** Features appear to work but silently fail or return fake data

**Recommendation:** Either:
1. Implement these features
2. Remove from UI to avoid user confusion
3. Show clear "Not Yet Implemented" messages in UI

**Effort:** 1-2 days per feature

---

### 🟡 Missing Error Boundaries in React

**Files:** `assets/js/world_builder/*.jsx`

**Issue:** No error boundaries to catch React rendering errors

**Risk:** A single rendering error crashes entire 3D viewport

**Fix:** Add ErrorBoundary component:
```jsx
// assets/js/world_builder/ErrorBoundary.jsx
import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '2rem', color: 'red'}}>
          <h2>3D Viewport Error</h2>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ hasError: false })}>
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Effort:** 1-2 hours

---

## 5. Code Quality & Best Practices

**Health Score: 8/10**

### ✅ Strengths

1. **Consistent Error Handling:** All modules use `{:ok, result}` / `{:error, reason}` tuples
2. **Good Documentation:** All modules have @moduledoc and @doc annotations
3. **Type Guards:** Functions use `when` guards for input validation
4. **Logging:** Appropriate use of Logger for debugging
5. **Atom Keys:** Consistent use of `ensure_atom_keys/1` helpers
6. **Memoization in React:** Proper use of `useMemo` to avoid re-renders

### ⚠️ Areas for Improvement

1. **No Dialyzer specs:** Consider adding @spec annotations for type safety
2. **No TypeScript:** React components use JavaScript (consider TypeScript for better IDE support)
3. **Console warnings:** Compilation shows several warnings (unused aliases, undefined attributes)

---

## 6. Modularity & Extensibility

**Health Score: 9/10**

### ✅ Excellent Design Patterns

**1. Layout Algorithm Plugin System:**
```elixir
# lib/loka/world_builder/layout_manager.ex
def apply_layout(room_keys, algorithm, options) do
  case algorithm do
    :force_directed -> Layout.ForceDirected.layout(rooms, exits, options)
    :circular -> Layout.Circular.layout(rooms, options)
    :grid -> Layout.Grid.layout(rooms, options)
    :hierarchical -> Layout.Hierarchical.layout(rooms, exits, options)
  end
end
```

Adding new layouts requires:
1. Create `lib/loka/world_builder/layout/my_algorithm.ex`
2. Implement `layout/2` or `layout/3`
3. Add case clause to LayoutManager

**2. LLM Feature Separation:**
Each LLM capability is cleanly separated:
- ClaudeClient - API communication
- ContextBuilder - Prompt generation
- PreviewManager - Preview management
- ConversationManager - History tracking
- StylePresets - Style guidelines
- BulkGenerator - Batch generation
- ConsistencyChecker - Validation

Easy to:
- Swap Claude for OpenAI
- Add new style presets
- Extend consistency checks

**3. TypedObject Foundation:**
World Builder properly uses TypedObject as universal data layer:
```elixir
# All entities are TypedObjects
%TypedObject{
  type: :entity,
  subtype: :room,  # or :npc, :item
  key: "forest_clearing",
  name: "Forest Clearing",
  # ... dynamic attributes
}
```

Benefits:
- Consistent data model
- Easy persistence
- Unified validation
- Flexible attributes

---

## 7. Integration with Engine

**Health Score: 8/10**

### ✅ Proper Integration Points

**1. TypedObject Registry:**
```elixir
# Rooms are spawned as entities
Spawner.spawn(typed_object)  # Creates EntityServer, persists to DB

# Rooms can be retrieved via Registry
Registry.get(room_id)  # Returns live entity
Registry.list_by_type(:entity, :room)  # Lists all rooms
```

**2. Validation Integration:**
```elixir
# Reuses existing game validators
alias Loka.Testing.Content.{QuestValidator, CutsceneValidator}
```

**3. Content Module Integration:**
```elixir
# Uses Content.Quest for quest operations
alias Loka.Content.Quest
Quest.get(quest_key)
```

### ⚠️ Boundary Concerns

**EntityManager vs EntityServer Overlap:**

`lib/loka/world_builder/entity_manager.ex` provides CRUD for NPCs/items, but these are already managed by:
- `Loka.Engine.EntityServer` (GenServer per entity)
- `Loka.Engine.Spawner` (entity spawning)
- `Loka.Engine.TypedObject.Registry` (entity lookup)

**Question:** Does EntityManager add value or duplicate Engine functionality?

**Recommendation:** Consider if EntityManager should:
1. Be a thin wrapper around Engine APIs (just convenience)
2. Add World Builder-specific features (batch operations, validation)
3. Be removed if it's pure duplication

---

## 8. UX/UI Analysis

**Health Score: 7/10** (Backend-focused; frontend incomplete)

### ✅ Strengths

**1. Proper React Component Structure:**
```jsx
// Viewport.jsx - Clean component with proper hooks
export default function Viewport({ rooms, selectedRoom, onSelectRoom }) {
  const roomsByKey = useMemo(() => {...}, [rooms])  // Memoized lookup
  const exitConnections = useMemo(() => {...}, [rooms])  // Memoized exits

  return <Canvas>...</Canvas>
}
```

**2. Phoenix Hook Lifecycle:**
```js
QuestEditor: {
  mounted() {
    this.root = createRoot(this.el)
    this.root.render(React.createElement(QuestEditor, props))
  },
  destroyed() {
    if (this.root) {
      this.root.unmount()  // Proper cleanup!
    }
  }
}
```

**3. LiveView Real-time Updates:**
World Builder is architected for real-time collaboration (multiple admins editing simultaneously)

### ⚠️ Gaps

**1. Loading States:**
No loading indicators for:
- Room creation
- Bulk generation
- LLM API calls

**2. Error States:**
No error UI for:
- Failed room creation
- Invalid exits
- LLM API errors

**3. Empty States:**
No guidance when:
- No rooms exist yet
- No templates available
- No quests created

**4. Undo/Redo:**
Mentioned in acceptance criteria but not implemented

**5. Keyboard Shortcuts:**
Unity-style editor should have shortcuts (G for grab, R for rotate, etc.)

---

## 9. Security Considerations

**Health Score: 7/10**

### ✅ Strengths

1. **Admin-only access:** World Builder is behind admin auth (assumed from context)
2. **Server-side validation:** All operations validated on backend
3. **No SQL injection:** Uses Ecto queries safely

### ⚠️ Concerns

**1. API Key Exposure:**
```elixir
# lib/loka/world_builder/llm/claude_client.ex
defp get_api_key do
  System.get_env("ANTHROPIC_API_KEY") ||
    Application.get_env(:loka, :anthropic_api_key) ||
    raise "ANTHROPIC_API_KEY not configured"
end
```

**Secure:** API key is server-side only ✓
**Missing:** Rate limiting per admin user
**Missing:** Cost tracking and budget limits

**2. LLM Injection:**
No sanitization of user prompts before sending to Claude API. Could be abused for:
- Prompt injection attacks
- Excessive token usage
- Generating inappropriate content

**Recommendation:**
```elixir
defp sanitize_prompt(user_input) do
  user_input
  |> String.trim()
  |> String.slice(0..2000)  # Max length
  |> filter_injection_patterns()
end
```

**3. Preview Bomb:**
Malicious admin could create thousands of previews to exhaust memory (see memory leak issue above)

---

## 10. Performance Considerations

**Health Score: 8/10**

### ✅ Strengths

1. **React Memoization:** Proper use of `useMemo` prevents unnecessary re-renders
2. **LiveView Assigns:** Only changed data sent over WebSocket
3. **ETS Lookups:** TypedObject.Registry uses ETS (fast)

### ⚠️ Potential Bottlenecks

**1. N+1 Queries in RoomManager:**
```elixir
# lib/loka/world_builder/room_manager.ex:19
def list_rooms do
  Registry.list_by_type(:entity, :room)
  |> Enum.map(&enrich_room_for_frontend/1)  # Could trigger N queries for exits
end
```

**2. Large World Rendering:**
What happens with 1000+ rooms in 3D viewport?
- React Three Fiber performance limits?
- Should implement level-of-detail (LOD)
- Should implement frustum culling

**3. LLM API Latency:**
Streaming is implemented, but:
- No timeout handling
- No retry logic
- No fallback if API is down

---

## 11. Deployment Readiness

**Health Score: 6/10**

### 🔴 Blockers for Production

1. **Memory leaks** - Would crash after days/weeks
2. **Missing tests** - No confidence in stability
3. **Runtime errors** - ValidationManager crash on first use
4. **Incomplete features** - TODOs return fake data

### 🟡 Missing Production Features

1. **Hot code upgrade:** Would World Builder state survive deployment?
2. **Multi-node:** GenServers use `name: __MODULE__` (global singleton) - works on single node but not distributed
3. **Monitoring:** No telemetry events for:
   - LLM API latency
   - Room creation rate
   - Preview acceptance rate
4. **Audit logging:** No record of who changed what

---

## 12. Documentation Quality

**Health Score: 8/10**

### ✅ Strengths

1. Every module has clear @moduledoc
2. Public functions have @doc strings
3. Code comments explain complex logic
4. Master plan exists: `docs/architecture/world-builder-master-plan.md`

### ⚠️ Gaps

1. No API documentation for LiveView events
2. No guide for adding new layout algorithms
3. No guide for extending LLM features
4. No troubleshooting guide

---

## Summary of Recommended Actions

### Immediate (P0) - Fix Before Any Production Use

1. **Add cleanup to GenServers** (PreviewManager, BulkGenerator)
   - Files: `preview_manager.ex:40`, `bulk_generator.ex:40`
   - Effort: 2-3 hours
   - Risk: High (memory leaks)

2. **Fix ValidationManager runtime error**
   - File: `validation_manager.ex:17`
   - Effort: 1 hour
   - Risk: High (crash on first validation)

3. **Create core test suite**
   - Files: `test/loka/world_builder/*.exs`
   - Effort: 2-3 days
   - Risk: High (no safety net)

4. **Resolve WorldBuilderLive vs WorldDesignerTab**
   - Files: `world_builder_live.ex`, `world_designer_tab.ex`
   - Effort: 4-6 hours + migration time
   - Risk: Medium (user confusion, wasted effort)

### Short-term (P1) - Fix Within 1-2 Weeks

5. **Replace HTTPoison with Req**
   - File: `claude_client.ex`
   - Effort: 2-4 hours
   - Benefit: Reduce dependencies, modernize

6. **Extract LiveView components**
   - File: `world_builder_live.ex`
   - Effort: 4-6 hours
   - Benefit: Maintainability

7. **Implement TODOs or remove features**
   - Files: `style_presets.ex`, `preview_manager.ex`, `consistency_checker.ex`
   - Effort: 1-2 days per feature
   - Risk: Medium (confusing UX)

### Medium-term (P2) - Nice to Have

8. **Add React error boundaries**
   - Files: All `.jsx` files
   - Effort: 1-2 hours
   - Benefit: Better error handling

9. **Add loading/error/empty states**
   - File: `world_builder_live.ex`
   - Effort: 4-6 hours
   - Benefit: Better UX

10. **Add admin audit logging**
    - New file: `world_builder/audit_log.ex`
    - Effort: 1 day
    - Benefit: Security, debugging

---

## Conclusion

The World Builder system demonstrates **solid architectural foundations** with excellent layer separation, clean module organization, and innovative LLM integration. The core design is extensible and well-structured.

However, **3 critical issues must be fixed before production use:**
1. GenServer memory leaks
2. Missing test coverage
3. Runtime error in validation

With these fixes and the recommended short-term improvements, the World Builder will be production-ready and maintainable.

The system shows strong potential to be a powerful tool for game content creation, especially with the LLM-assisted features that differentiate it from traditional world editors.

**Recommended next steps:**
1. Fix P0 issues (1-3 days)
2. Complete migration or cleanup of WorldBuilderLive/WorldDesignerTab (1-2 days)
3. Create comprehensive test suite (2-3 days)
4. Add production monitoring and logging (1-2 days)

**Total estimated effort for production readiness: 1-2 weeks**
