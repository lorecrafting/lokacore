# World Builder Action Items (Bead-Ready Format)

Generated from comprehensive audit on 2026-01-08

## P0 - Critical (Fix Before Production)

### 1. Add Cleanup to PreviewManager GenServer

**Priority:** P0
**Effort:** 2-3 hours
**Risk:** High - Memory leak

**Files:**
- `lib/loka/world_builder/llm/preview_manager.ex`

**Current Issue:**
```elixir
# Line 38-40
def init(_opts) do
  {:ok, %{previews: %{}}}  # No TTL, no cleanup
end
```

Previews are never automatically cleaned up. If users create previews but abandon them, state grows indefinitely.

**Proposed Fix:**
```elixir
@preview_ttl_minutes 30
@max_previews_per_user 50

def init(_opts) do
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
      DateTime.compare(preview.created_at, cutoff) == :lt ||
      count_user_previews(state.previews, preview.user_id) > @max_previews_per_user
    end)
    |> Map.new()

  schedule_cleanup()
  {:noreply, %{state | previews: new_previews}}
end

defp count_user_previews(previews, user_id) do
  Enum.count(previews, fn {_, p} -> p.user_id == user_id end)
end
```

**Validation:**
```bash
# Start World Builder
# Create 100 previews without accepting/rejecting
# Wait 35 minutes
# Verify previews are cleaned up
:sys.get_state(Loka.WorldBuilder.LLM.PreviewManager)
```

---

### 2. Add Cleanup to BulkGenerator GenServer

**Priority:** P0
**Effort:** 2-3 hours
**Risk:** High - Memory leak

**Files:**
- `lib/loka/world_builder/llm/bulk_generator.ex`

**Current Issue:**
Same as PreviewManager - completed generations never cleaned up.

**Proposed Fix:**
Similar cleanup mechanism with TTL for completed/cancelled generations.

---

### 3. Fix ValidationManager Runtime Error

**Priority:** P0
**Effort:** 1 hour
**Risk:** High - Crash on first validation

**Files:**
- `lib/loka/world_builder/validation_manager.ex:11-18`

**Current Issue:**
```elixir
def validate_all do
  {quest_results, _} = QuestValidator.validate()  # Returns tuple
  {cutscene_results, _} = CutsceneValidator.validate()

  %{
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

**Investigation Needed:**
1. Check what QuestValidator.validate() actually returns
2. Check QuestValidator source: `lib/loka/testing/content/quest_validator.ex`

**Proposed Fix:**
```elixir
def validate_all do
  # Step 1: Check validator return format
  quest_validation = QuestValidator.validate()
  cutscene_validation = CutsceneValidator.validate()

  # Step 2: Extract errors/warnings correctly based on actual format
  # If format is {:ok, %{errors: [...], warnings: [...]}, metadata}:
  quest_errors = extract_errors(quest_validation)
  quest_warnings = extract_warnings(quest_validation)

  cutscene_errors = extract_errors(cutscene_validation)
  cutscene_warnings = extract_warnings(cutscene_validation)

  %{
    quests: elem(quest_validation, 1),  # Results map
    cutscenes: elem(cutscene_validation, 1),
    total_errors: length(quest_errors) + length(cutscene_errors),
    total_warnings: length(quest_warnings) + length(cutscene_warnings)
  }
end

defp extract_errors({_status, results, _metadata}), do: Map.get(results, :errors, [])
defp extract_errors({_status, results}), do: Map.get(results, :errors, [])
defp extract_errors(_), do: []

defp extract_warnings({_status, results, _metadata}), do: Map.get(results, :warnings, [])
defp extract_warnings({_status, results}), do: Map.get(results, :warnings, [])
defp extract_warnings(_), do: []
```

**Validation:**
```bash
# In IEx
Loka.WorldBuilder.ValidationManager.validate_all()
# Should not crash, should return proper counts
```

---

### 4. Create World Builder Test Suite

**Priority:** P0
**Effort:** 2-3 days
**Risk:** High - No safety net for changes

**Files to Create:**
1. `test/loka/world_builder/room_manager_test.exs`
2. `test/loka/world_builder/entity_manager_test.exs`
3. `test/loka/world_builder/validation_manager_test.exs`
4. `test/loka/world_builder/llm/preview_manager_test.exs`
5. `test/loka/world_builder/llm/conversation_manager_test.exs`
6. `test/loka/world_builder/llm/bulk_generator_test.exs`

**Test Coverage Required:**

**RoomManager:**
```elixir
defmodule Loka.WorldBuilder.RoomManagerTest do
  use Loka.DataCase
  alias Loka.WorldBuilder.RoomManager

  describe "create_room/1" do
    test "creates room with valid attributes"
    test "returns error for missing key"
    test "assigns default coordinates if not provided"
    test "spawns entity and registers in Registry"
  end

  describe "update_room/2" do
    test "updates existing room"
    test "returns error for non-existent room"
    test "validates attributes"
  end

  describe "add_exit/3" do
    test "adds exit between two rooms"
    test "returns error for non-existent destination"
  end

  # ... more tests
end
```

**ValidationManager:**
```elixir
defmodule Loka.WorldBuilder.ValidationManagerTest do
  use Loka.DataCase
  alias Loka.WorldBuilder.ValidationManager

  describe "validate_room/1" do
    test "returns :valid for valid room"
    test "returns :warning for room missing name"
    test "returns :error for invalid exit"
    test "checks exit targets exist"
  end

  describe "validate_all/0" do
    test "aggregates quest and cutscene validation"
    test "returns correct error counts"
    test "returns correct warning counts"
    test "handles validators returning empty results"
  end
end
```

**PreviewManager:**
```elixir
defmodule Loka.WorldBuilder.LLM.PreviewManagerTest do
  use Loka.DataCase
  alias Loka.WorldBuilder.LLM.PreviewManager

  describe "preview lifecycle" do
    test "add_preview creates new preview"
    test "get_previews returns user previews only"
    test "accept_preview commits to database"
    test "reject_preview removes preview"
    test "old previews cleaned up after TTL"
  end

  describe "preview limits" do
    test "enforces max previews per user"
    test "oldest previews removed when limit exceeded"
  end
end
```

**Validation:**
```bash
mix test test/loka/world_builder/
```

---

### 5. Resolve WorldBuilderLive vs WorldDesignerTab Confusion

**Priority:** P0 (if WorldBuilderLive is meant to be used)
**Priority:** P2 (if it's experimental)
**Effort:** 1 day clarification + 2-3 days migration
**Risk:** Medium - Wasted effort, user confusion

**Files:**
- `lib/loka_web/live/admin_live/world_builder_live.ex` (1262 lines, NOT mounted)
- `lib/loka_web/live/admin_live/world_designer_tab.ex` (mounted in AdminLive)
- `lib/loka_web/live/admin_live/world_designer/*.ex` (4 component files)

**Investigation Questions:**
1. Is WorldBuilderLive meant to replace WorldDesignerTab?
2. Are they for different use cases (simple vs Unity-style)?
3. Was the migration incomplete?
4. Should WorldDesignerTab be deprecated?

**Options:**

**Option A: Complete Migration**
1. Replace WorldDesignerTab with WorldBuilderLive in AdminLive
2. Update routes to use WorldBuilderLive
3. Delete old world_designer/ components
4. Test thoroughly

**Option B: Clarify Names & Coexist**
1. Rename WorldBuilderLive → UnityStyleWorldEditor
2. Rename WorldDesignerTab → SimpleWorldEditor
3. Provide both in UI with clear labels
4. Document when to use each

**Option C: Delete Unused Code**
1. If WorldBuilderLive is experimental, move to feature branch
2. Delete if abandoned
3. Focus on one system

**Recommended:** Clarify with team/user, then execute appropriate option.

---

## P1 - High Priority (Fix Within 1-2 Weeks)

### 6. Replace HTTPoison with Req

**Priority:** P1
**Effort:** 2-4 hours
**Benefit:** Reduce dependencies, modernize HTTP client

**Files:**
- `lib/loka/world_builder/llm/claude_client.ex`
- `mix.exs:131` (remove {:httpoison, "~> 2.2"})

**Current:**
```elixir
case HTTPoison.post("#{@api_base}/messages", body, headers, stream_to: self(), async: :once) do
  {:ok, %HTTPoison.AsyncResponse{id: id}} -> {:ok, id}
end
```

**Proposed:**
```elixir
def stream_chat(messages, system_prompt, tools \\ [], opts \\ []) do
  body = %{
    model: @model,
    max_tokens: opts[:max_tokens] || @max_tokens,
    system: system_prompt,
    messages: messages,
    tools: tools,
    stream: true
  }

  headers = [
    {"x-api-key", get_api_key()},
    {"anthropic-version", "2023-06-01"}
  ]

  # Use Req for streaming
  case Req.post(
    url: "#{@api_base}/messages",
    json: body,
    headers: headers,
    into: fn {:data, data}, {req, resp} ->
      # Send chunks to caller
      send(opts[:caller], {:http_chunk, data})
      {:cont, {req, resp}}
    end
  ) do
    {:ok, _response} -> :ok
    {:error, reason} -> {:error, reason}
  end
end
```

**Validation:**
```bash
mix deps.get
mix compile
# Test Claude API integration
```

---

### 7. Extract WorldBuilderLive Components

**Priority:** P1
**Effort:** 4-6 hours
**Benefit:** Maintainability, testability

**Current:** `lib/loka_web/live/admin_live/world_builder_live.ex` (1262 lines)

**Extract to:**
1. `lib/loka_web/live/admin_live/world_builder/hierarchy_panel.ex`
2. `lib/loka_web/live/admin_live/world_builder/inspector_panel.ex`
3. `lib/loka_web/live/admin_live/world_builder/viewport_container.ex`
4. `lib/loka_web/live/admin_live/world_builder/console_panel.ex`
5. `lib/loka_web/live/admin_live/world_builder/toolbar.ex`

**Benefits:**
- Easier to test individual panels
- Clearer code organization
- Faster file navigation
- Parallel development

---

### 8. Implement or Remove TODOs

**Priority:** P1
**Effort:** 1-2 days per feature
**Risk:** Medium - Features appear to work but fail

**TODO 1: Custom Style Presets**
- File: `lib/loka/world_builder/llm/style_presets.ex:101`
- Current: Returns fake data
- Options:
  - Implement Ecto schema for custom presets
  - Remove feature from UI
  - Show "Coming Soon" message

**TODO 2: NPC Creation**
- File: `lib/loka/world_builder/llm/preview_manager.ex:114`
- Current: Logs and returns placeholder
- Options:
  - Complete EntityManager NPC support
  - Disable NPC generation in LLM
  - Show "NPCs not yet supported" in UI

**TODO 3: NPC Consistency Checks**
- File: `lib/loka/world_builder/llm/consistency_checker.ex:61`
- Current: Returns empty warnings
- Options:
  - Implement NPC consistency checking
  - Remove from feature list

---

## P2 - Medium Priority (Nice to Have)

### 9. Add React Error Boundaries

**Priority:** P2
**Effort:** 1-2 hours
**Benefit:** Better error recovery

**Files:**
- `assets/js/world_builder/ErrorBoundary.jsx` (create)
- `assets/js/world_builder/App.jsx` (wrap with ErrorBoundary)

---

### 10. Add Loading/Error/Empty States

**Priority:** P2
**Effort:** 4-6 hours
**Benefit:** Better UX

**Files:**
- `lib/loka_web/live/admin_live/world_builder_live.ex`

**Missing States:**
1. Loading: Room creation, bulk generation, LLM calls
2. Error: Failed operations, API errors, validation failures
3. Empty: No rooms, no templates, no quests

---

### 11. Add Admin Audit Logging

**Priority:** P2
**Effort:** 1 day
**Benefit:** Security, debugging, compliance

**Files:**
- `lib/loka/world_builder/audit_log.ex` (create)
- Integration with GameLog or separate audit system

**Log:**
- Who created/updated/deleted rooms
- Who ran bulk operations
- Who used LLM features
- Timestamp, IP address, changes made

---

## Quick Wins (< 2 hours each)

### Fix Compiler Warnings

**Files:**
- Remove unused aliases:
  - `validation_manager.ex` (unused CutsceneValidator alias if not used)
  - `quest_manager.ex:51` (unused Registry alias)
  - `template_manager.ex:18` (unused TypedObject alias)
  - `batch_operations.ex:15` (unused TypedObject alias)
  - `context_builder.ex:8` (unused ZoneManager alias)
  - `bulk_generator.ex:11` (unused ClaudeClient, ContextBuilder aliases)

### Add @spec Type Annotations

Add Dialyzer specs to public functions for better type safety and documentation.

### Fix HTML Attribute Warnings

- File: `world_builder_live.ex:243`
- Change `name="id"` to `name="_id"` to avoid LiveView conflicts

---

## Summary

**Critical Path to Production (1-2 weeks):**
1. Fix GenServer memory leaks (4-6 hours)
2. Fix ValidationManager crash (1 hour)
3. Create test suite (2-3 days)
4. Resolve WorldBuilderLive confusion (1-2 days)
5. Replace HTTPoison with Req (2-4 hours)

**Total: ~5-8 days of focused work**

After these fixes, the World Builder will be production-ready with solid foundations for future enhancements.
