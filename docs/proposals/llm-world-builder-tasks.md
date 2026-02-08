# LLM World Builder — Implementation Tasks

**Source:** `docs/proposals/llm-first-world-builder.md`
**Date:** 2026-02-08
**Model strategy:** Sonnet for implementation, Opus for evaluation/review

Each task is self-contained with full context so it survives context clearing.
Tasks are ordered by dependency — complete them in sequence within each phase.

---

## Phase 1: Context Awareness + System Prompt

### Task 1.1: Add Context Builder Module

**File to create:** `server/lib/loka/world_builder/context_builder.ex`

**What this does:** Creates a new module that reads the current LiveView state (which room is selected, which entity is selected, what editor is open) and formats it into a string that gets prepended to the system prompt sent to the Anthropic API.

**Why:** Currently the chat panel doesn't know what the builder is looking at. If a room is selected on the viewport, the builder has to type "add an NPC to monastery_gate" instead of just "add an NPC here." This module bridges that gap.

**Implementation details:**

```elixir
defmodule Loka.WorldBuilder.ContextBuilder do
  @moduledoc """
  Builds context from LiveView assigns for injection into the World Builder
  chat system prompt. Reads selected room, entity, and editing mode so the
  LLM knows what the builder is currently looking at.
  """

  alias Loka.WorldBuilder.RoomManager

  @doc """
  Build a context map from the current socket assigns.
  Returns a map with optional keys: :selected_room, :selected_entity, :editing_mode, :chat_mode
  """
  def build(assigns) do
    %{}
    |> maybe_add_room_context(assigns)
    |> maybe_add_entity_context(assigns)
    |> maybe_add_editing_context(assigns)
    |> maybe_add_mode_context(assigns)
  end

  @doc """
  Format the context map into a string suitable for prepending to the system prompt.
  Returns empty string if no context available.
  """
  def format_for_system_prompt(context) when context == %{}, do: ""
  def format_for_system_prompt(context) do
    # Build sections for each context piece
    # Include room name, key, zone, description, exits if a room is selected
    # Include entity type and key if an entity is selected
    # Include current editor mode (map/script/dialogue/quest/cutscene)
    # Include chat mode (design/assist)
    # Format as a markdown section: "## Current Selection Context\n..."
  end
end
```

**Key assigns to read from socket (defined in `world_builder_live.ex`):**
- `assigns.selected_room` — string room key or nil (line 98)
- `assigns.selected_entity` — `%{type: atom, key: string}` or nil (line 109)
- `assigns.editing_mode` — atom `:map | :script | :dialogue | :quest | :cutscene` (line 121)
- `assigns.chat_mode` — atom `:design | :assist` (NEW — added in Task 1.2)

**When `selected_room` is set**, use `RoomManager.get_room(room_key)` to fetch full room data (name, description, zone, exits, spawns, coordinates). Include this in the context string.

**When `selected_entity` is set**, include the type and key. For NPCs/items, optionally fetch basic info via the existing entity modules.

**Format example:**
```
## Current Selection Context

You are looking at room "monastery_gate" (Monastery Gate) in zone "whispering_monastery".
Description: "Heavy wooden doors stand open beneath a stone arch..."
Exits: north → monastery_courtyard, south → mountain_path
Spawns: novice_pema (NPC)

Current editing mode: map (viewport)
Chat mode: design
```

**Testing:** Create `test/loka/world_builder/context_builder_test.exs`. Test with:
- No selection (empty context)
- Room selected (full room context)
- Entity selected (entity context)
- Different editing modes
- Different chat modes

**Acceptance criteria:**
- `ContextBuilder.build(assigns)` returns a context map
- `ContextBuilder.format_for_system_prompt(context)` returns a formatted string
- Empty assigns produce empty string (no noise in prompt)
- Module follows Loka conventions (see `.claude/skills/loka-conventions.md`)

---

### Task 1.2: Wire Context into Chat Module

**File to modify:** `server/lib/loka/world_builder/chat.ex`

**What this does:** Modifies the `Chat.send_message/2` and `Chat.continue_with_tool_results/2` functions to inject the selection context into the system prompt before each API call.

**Why:** The ContextBuilder module from Task 1.1 builds context, but nothing uses it yet. This task wires it into the actual chat flow so the Anthropic API receives the context.

**Current flow (chat.ex lines 32-64):**
1. `send_message/2` receives socket and message string
2. Calls `get_system_prompt(project_key)` which returns base prompt + project context
3. Calls `AnthropicClient.stream_to_liveview/4` with the system prompt

**Required changes:**

1. **Change `send_message/2` signature** to accept the full socket (it already does — `socket` is the first arg). The function needs access to `socket.assigns` to read selection state.

2. **Modify `get_system_prompt/1` to `get_system_prompt/2`** — add a second parameter for socket assigns:
```elixir
# BEFORE (line 448):
defp get_system_prompt(project_key) do
  base_prompt = load_system_prompt()
  project_context = ...
  base_prompt <> project_context
end

# AFTER:
defp get_system_prompt(project_key, assigns) do
  base_prompt = load_system_prompt()
  project_context = ...
  selection_context = ContextBuilder.build(assigns) |> ContextBuilder.format_for_system_prompt()
  base_prompt <> project_context <> selection_context
end
```

3. **Update both call sites** that invoke `get_system_prompt`:
   - `send_message/2` at line 48: `system = get_system_prompt(project_key, socket.assigns)`
   - `continue_with_tool_results/2` at line 372: `system = get_system_prompt(project_key, socket.assigns)`

4. **Add `chat_mode` assign** — initialize in `init_assigns/1` (line 14):
```elixir
def init_assigns(socket) do
  Phoenix.Component.assign(socket,
    chat_messages: [],
    chat_streaming: false,
    chat_current_response: "",
    chat_error: nil,
    pending_tool_results: [],
    chat_queued_messages: [],
    chat_current_tool: nil,
    chat_tool_step: 0,
    chat_total_steps: 0,
    chat_mode: :design  # NEW
  )
end
```

5. **Add alias** at top of module (line 9):
```elixir
alias Loka.WorldBuilder.{AnthropicClient, ContextBuilder, Projects, ToolExecutor}
```

**Testing:** Existing chat tests should still pass. Add test that verifies context is included in system prompt when assigns have a selected room.

**Acceptance criteria:**
- Context from selected room/entity appears in system prompt sent to API
- No context noise when nothing is selected
- `chat_mode` assign initialized to `:design`
- Both `send_message` and `continue_with_tool_results` use context

---

### Task 1.3: Add Chat Mode Toggle to UI

**File to modify:** `server/lib/loka_web/live/admin_live/world_builder/chat_panel.ex`

**What this does:** Adds a Design/Assist toggle button to the chat panel header so builders can switch between modes.

**Why:** Assist mode (where the LLM never writes prose, only scaffolds structure) needs a UI toggle. The mode is stored in `chat_mode` assign (added in Task 1.2).

**Current chat panel header (chat_panel.ex around lines 50-80):** Has project dropdown, clear chat button, audit log button, and settings. The mode toggle should go near the project dropdown.

**Implementation:**

1. **Add toggle button** in the chat panel header area. Use a simple two-option toggle:
```heex
<button
  phx-click="toggle_chat_mode"
  class={[
    "wb-btn wb-btn--sm",
    @chat_mode == :assist && "wb-btn--active"
  ]}
>
  <%= if @chat_mode == :design, do: "Design", else: "Assist" %>
</button>
```

2. **Add event handler** in `world_builder_live.ex`:
```elixir
def handle_event("toggle_chat_mode", _params, socket) do
  new_mode = if socket.assigns.chat_mode == :design, do: :assist, else: :design
  {:noreply, assign(socket, :chat_mode, new_mode)}
end
```

3. **Pass `chat_mode` to chat_panel component** — add to the assigns passed in `world_builder_live.ex` render function where chat_panel is rendered.

**Design notes:**
- Use existing `--wb-*` CSS design tokens (never raw hex colors)
- Keep it minimal — a small button or pill toggle
- Active state should be visually distinct (e.g., highlighted background)

**Acceptance criteria:**
- Toggle button visible in chat panel header
- Clicking switches between Design and Assist modes
- Mode label updates on toggle
- `chat_mode` assign updates correctly

---

### Task 1.4: Update System Prompt with Modes and Context Rules

**File to modify:** `server/priv/world_builder/system_prompt.md`

**What this does:** Rewrites the system prompt to include instructions for context awareness, Assist mode behavior, and validation awareness.

**Why:** The system prompt is the cheapest, highest-leverage change. It controls how the LLM behaves. Adding mode-specific instructions and context awareness rules transforms the chat experience without touching Elixir code.

**Current prompt structure (121 lines):**
- Role definition
- Design-first workflow
- Projects section
- Narrative voice rules
- Formatting rules
- MUD content formats
- Anti-patterns
- When helping design / when building
- Tool usage
- Response style

**Required additions (append after existing content, keeping everything that's there):**

```markdown
## Context Awareness

When the builder has a room or entity selected, you'll see a "Current Selection Context"
section in your instructions. Use this to resolve references like "here", "this room",
"this NPC", etc.

- If a room is selected and the builder says "add an NPC here", create the NPC in that room
- If an entity is selected and the builder says "improve this", modify that entity
- If editing a script/dialogue/quest, scope your help to that content
- NEVER ask "which room?" or "which NPC?" when the selection context tells you

If no selection context is present, ask the builder to specify targets by name.

## Chat Modes

### Design Mode (default)
You are a creative collaborator. Generate full content including prose, descriptions,
dialogue, emotes, and narrative text. Follow the narrative voice guidelines above.
Propose plans before executing. Ask clarifying questions.

### Assist Mode
You are a structural engineer and librarian. You handle mechanical work ONLY.

**In Assist mode, you MUST:**
- Scaffold rooms, NPCs, items, quests with `[TODO]` placeholder text for all creative fields
- Use format: `[VERB: context hint]` — e.g., `[DESCRIBE: cave entrance, connects to forest]`
- Wire exits, assign coordinates, format YAML
- Run validation, analysis, and reference lookups
- Answer questions about schemas, required fields, existing content

**In Assist mode, you MUST NOT:**
- Write room descriptions or atmospheric text
- Author dialogue lines or NPC speech
- Generate quest narrative or journal entries
- Create emotes, ambient messages, or flavor text
- Rewrite or "improve" human-written prose

If the builder asks you to write prose in Assist mode, respond:
"I'm in Assist mode — I handle structure, not prose. Switch to Design mode
if you'd like me to write creative content, or I can scaffold placeholders for you to fill in."

## After Creating Content

After creating rooms, NPCs, quests, or other content, briefly summarize what you created
and note anything the builder should review. If you notice potential issues (missing exits,
orphan rooms, incomplete quests), mention them proactively.
```

**What to keep:** All existing content stays. The narrative voice, formatting rules, MUD content formats, anti-patterns, design workflow, and tool usage sections are all still correct.

**Acceptance criteria:**
- System prompt includes context awareness rules
- System prompt includes Design and Assist mode instructions
- System prompt includes post-creation review instructions
- Existing narrative/formatting/anti-pattern rules preserved
- Total prompt is concise (not bloated — aim for ~200 lines max)

---

## Phase 2: Validation Feedback + Contextual Quick Actions

### Task 2.1: Add Validation Feedback After Tool Execution

**File to modify:** `server/lib/loka/world_builder/chat.ex`

**What this does:** After any content-creating tool executes (create_room, create_npc, create_quest, etc.), automatically runs `ValidationManager.validate_all/0` and injects any warnings/errors as a system message that Claude sees on the next API call.

**Why:** Currently Claude creates content and doesn't know if it has issues. The builder has to manually run validation (Ctrl+S) and then tell Claude about problems. Auto-validation after creation lets Claude self-correct.

**Implementation:**

1. **In `handle_tool_use/4`** (chat.ex line 81), after the tool executes successfully, check if it was a content-mutating tool:
```elixir
@content_tools ~w(wb_create_room wb_update_room wb_create_npc wb_create_item
                   wb_create_quest wb_update_quest wb_create_dialogue
                   wb_create_exit wb_remove_exit wb_batch_create_rooms)

# After tool execution succeeds, if it was a content tool:
if tool_name in @content_tools and result.success do
  validation = run_post_tool_validation()
  if validation != "" do
    # Store validation message to inject on next API call
    socket = Phoenix.Component.assign(socket, :pending_validation, validation)
  end
end
```

2. **New helper `run_post_tool_validation/0`:**
```elixir
defp run_post_tool_validation do
  case Loka.WorldBuilder.ValidationManager.validate_all() do
    %{errors: errors, warnings: warnings} when errors != [] or warnings != [] ->
      format_validation_feedback(errors, warnings)
    _ ->
      ""
  end
end

defp format_validation_feedback(errors, warnings) do
  parts = []
  parts = if errors != [], do: parts ++ ["Errors: " <> Enum.join(Enum.map(errors, & &1.message), "; ")], else: parts
  parts = if warnings != [], do: parts ++ ["Warnings: " <> Enum.join(Enum.map(warnings, & &1.message), "; ")], else: parts
  "[Validation after your last action] " <> Enum.join(parts, " | ")
end
```

3. **Inject validation into next API call.** In `continue_with_tool_results/2` (line 340), before formatting messages for the API, prepend the validation feedback as a system message if `pending_validation` is set. Then clear the assign.

**Important:** Check the actual return format of `ValidationManager.validate_all/0` before implementing. Read `server/lib/loka/world_builder/validation_manager.ex` to see the exact return structure. The format above is an approximation.

**Add new assign** to `init_assigns/1`: `pending_validation: nil`

**Testing:** Test that after a `wb_create_room` call, validation runs and results are stored. Test that empty validation produces no noise.

**Acceptance criteria:**
- Content-creating tools trigger auto-validation
- Validation results injected into the next Claude API call
- Non-content tools (list_rooms, get_room_info, etc.) do NOT trigger validation
- Empty validation results produce no noise
- Validation assign is cleared after injection

---

### Task 2.2: Add `wb_validate_world` and `wb_search_content` Tools

**File to modify:** `server/lib/loka/world_builder/tool_executor.ex`
**Also modify:** `server/lib/loka/world_builder/anthropic_client.ex` (tool definitions)

**What this does:** Adds two new tools that Claude can call proactively:
1. `wb_validate_world` — runs full world validation and returns results
2. `wb_search_content` — full-text search across all YAML content files

**Why:** Claude currently can't ask "are there any issues?" or "find all rooms mentioning 'tavern'." These are the two highest-value analysis tools.

**Implementation for `wb_validate_world`:**

In `tool_executor.ex`, add a new clause:
```elixir
def execute("wb_validate_world", _input, _opts) do
  results = ValidationManager.validate_all()
  {:ok, format_validation_results(results)}
end
```

Tool definition in `anthropic_client.ex`:
```elixir
%{
  name: "wb_validate_world",
  description: "Run full world validation. Returns all errors and warnings for rooms, quests, cutscenes, and content references.",
  input_schema: %{type: "object", properties: %{}, required: []}
}
```

**Implementation for `wb_search_content`:**

```elixir
def execute("wb_search_content", input, _opts) do
  query = input["query"]
  type_filter = input["type"]  # optional: "room", "npc", "item", "quest", "dialogue"

  # Search through all YAML files in priv/world/
  # Use TypedObject.Registry or load YAML files directly
  # Return matching entity keys with snippets of matching text
  results = search_yaml_content(query, type_filter)
  {:ok, results}
end
```

Tool definition:
```elixir
%{
  name: "wb_search_content",
  description: "Search across all YAML game content (rooms, NPCs, items, quests, dialogues) by text. Returns matching entity keys with context snippets.",
  input_schema: %{
    type: "object",
    properties: %{
      "query" => %{type: "string", description: "Text to search for"},
      "type" => %{type: "string", description: "Optional filter: room, npc, item, quest, dialogue", enum: ["room", "npc", "item", "quest", "dialogue"]}
    },
    required: ["query"]
  }
}
```

**For search implementation:** The simplest approach is to iterate through all loaded TypedObjects from the registry (via `Loka.Engine.TypedObject.Registry`), convert their data to string, and check for substring match. The registry already has all content loaded in ETS. Limit results to 20 to avoid blowing up the context window.

**Acceptance criteria:**
- `wb_validate_world` returns formatted validation results
- `wb_search_content` searches across YAML content and returns matches with snippets
- Both tools registered in AnthropicClient tool definitions
- Search results limited to 20 entries
- Search is case-insensitive

---

### Task 2.3: Contextual Quick Actions

**File to modify:** `server/lib/loka_web/live/admin_live/world_builder/chat_panel.ex`

**What this does:** Changes the 4 quick action buttons shown when the chat is empty to be context-aware. Different buttons appear based on whether a room, entity, or nothing is selected.

**Why:** Currently the same 4 buttons always show ("Build rooms", "Design an NPC", "Write a quest", "Brainstorm") regardless of context. If a room is selected, buttons like "Add NPCs here" or "Describe this room" would be more useful.

**Current implementation (chat_panel.ex lines ~128-196):** Quick actions are rendered when `@chat_messages == []`. Each has a title, description, icon, and a `phx-click="quick_chat"` with a `phx-value-message`.

**Required changes:**

1. **Pass `selected_room`, `selected_entity`, and `chat_mode` as assigns** to the chat_panel component (they may already be passed — check `world_builder_live.ex` render function).

2. **Replace the static quick actions** with a function that returns contextual actions:

```elixir
defp quick_actions(assigns) do
  cond do
    assigns[:selected_room] ->
      room_key = assigns.selected_room
      [
        %{title: "Describe this room", message: "Write a vivid description for this room", icon: "pencil"},
        %{title: "Add NPCs here", message: "Create interesting NPCs for this room", icon: "user-plus"},
        %{title: "Add exits", message: "Connect this room to nearby rooms", icon: "arrow-right-left"},
        %{title: "Validate this room", message: "Check this room for any issues", icon: "check-circle"}
      ]

    assigns[:selected_entity] ->
      entity = assigns.selected_entity
      [
        %{title: "Write dialogue", message: "Create a dialogue tree for this #{entity.type}", icon: "message-square"},
        %{title: "Add behaviors", message: "Add behavior scripts and emotes to this #{entity.type}", icon: "code"},
        %{title: "Create a quest", message: "Design a quest involving this #{entity.type}", icon: "scroll"},
        %{title: "Flesh out details", message: "Add more detail and depth to this #{entity.type}", icon: "sparkles"}
      ]

    true ->
      # Default (no selection) — keep similar to current but updated
      [
        %{title: "Design a new area", message: "I want to create a new area with rooms, NPCs, and quests", icon: "map"},
        %{title: "Create a quest", message: "Help me design a quest with objectives and rewards", icon: "scroll"},
        %{title: "Audit the world", message: "Check the world for issues, broken references, or missing content", icon: "search"},
        %{title: "Brainstorm", message: "Let's explore world design ideas and concepts", icon: "lightbulb"}
      ]
  end
end
```

3. **In Assist mode**, adjust the messages to be structural (e.g., "Scaffold this room with placeholder fields" instead of "Write a vivid description").

**Acceptance criteria:**
- Quick actions change when a room is selected
- Quick actions change when an entity is selected
- Default actions show when nothing is selected
- Clicking a quick action sends the appropriate message
- Actions adapt to Assist mode if active

---

## Evaluation Checkpoints

After each phase, switch to Opus 4.6 for evaluation:

### Phase 1 Evaluation Checklist
1. Select a room on the viewport, open chat, type "what room am I looking at?" — Claude should know
2. Select an NPC in hierarchy, type "add a quest for this NPC" — Claude should reference the NPC by name
3. Toggle to Assist mode, ask "create 3 rooms" — Claude should use [TODO] placeholders, no prose
4. Toggle back to Design mode, ask "create 3 rooms" — Claude should write full descriptions
5. Run `mix test` — all existing tests pass
6. Run `mix compile --warnings-as-errors` — no new warnings

### Phase 2 Evaluation Checklist
1. Ask Claude to "create a room" with a broken exit reference — validation should warn Claude
2. Use `wb_validate_world` tool — Claude reports all issues
3. Use `wb_search_content` with a keyword — Claude finds matching content
4. Select a room, verify quick actions change to room-specific options
5. Select an NPC, verify quick actions change to NPC-specific options
6. Clear selection, verify default quick actions appear
7. Run `mix test` — all tests pass
