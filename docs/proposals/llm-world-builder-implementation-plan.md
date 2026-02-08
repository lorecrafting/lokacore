# LLM World Builder — Implementation Plan

**Status:** IN PROGRESS
**Date:** 2026-02-08

This file is the source of truth for the implementation. If context resets, read this file to resume.

---

## Overview

Enhance the World Builder chat panel with:
1. **Context awareness** — chat knows what room/entity is selected
2. **Chat modes** — Design (full generation) vs Assist (structural only, no prose)
3. **System prompt upgrade** — mode-specific behavior, context rules
4. **Validation feedback** — auto-validate after tool execution, feed results to Claude
5. **Analysis tools** — `wb_validate_world`, `wb_search_content`
6. **Contextual quick actions** — buttons change based on selection

## Task Status

| # | Task | Status | Files |
|---|------|--------|-------|
| 1.1 | ContextBuilder module | DONE | `lib/loka/world_builder/context_builder.ex` (NEW) |
| 1.2 | Wire context into Chat | DONE | `lib/loka/world_builder/chat.ex` |
| 1.3 | Chat mode toggle UI | DONE | `lib/loka_web/live/admin_live/world_builder/chat_panel.ex`, `world_builder_live.ex` |
| 1.4 | System prompt update | DONE | `priv/world_builder/system_prompt.md` |
| 2.1 | Validation feedback | DONE | `lib/loka/world_builder/chat.ex` |
| 2.2 | New analysis tools | DONE | `lib/loka/world_builder/tool_executor.ex`, `mcp/tools.ex` |
| 2.3 | Contextual quick actions | DONE | `lib/loka_web/live/admin_live/world_builder/chat_panel.ex` |

**All tasks complete. Code reviewed and fixed.** `mix compile --warnings-as-errors` passes. `mix test` — 4,145 tests, 0 failures.

### Review fixes applied:
- **Bug: `pending_validation` never initialized** — added to mount assigns
- **Bug: validation ran per-tool (expensive)** — moved to once per batch in `continue_with_tool_results`
- **Bug: `truncate` used `byte_size` but `String.slice` uses graphemes** — fixed to use `String.length`
- **Bug: `build_snippet` used `:binary.match` (byte positions)** — replaced with grapheme-safe `String.split`
- **Bug: quest/cutscene validators return tuples, not strings** — added `format_validation_msg` to handle both
- **Performance: `inspect(obj.data)` in search** — removed, search key/name/description/zone only

---

## Task 1.1: ContextBuilder Module

**Create:** `server/lib/loka/world_builder/context_builder.ex`

**Purpose:** Read LiveView assigns (selected room, entity, editing mode, chat mode) and format into a string for the system prompt.

**Key assigns in world_builder_live.ex:**
- `selected_room` — string room key or nil (line 98)
- `selected_entity` — `%{type: atom, key: string}` or nil (line 109)
- `editing_mode` — `:map | :script | :dialogue | :quest | :cutscene` (line 121)
- `chat_mode` — `:design | :assist` (NEW, added in Task 1.2)

**To get room details:** Use `Loka.WorldBuilder.RoomManager.get_room(room_key)` — returns a map with string keys: `"name"`, `"description"`, `"zone"`, `"exits"`, `"spawns"`, `"x"`, `"y"`, `"z"`

**Functions:**
- `build(assigns)` → `%{selected_room: ..., selected_entity: ..., ...}` or `%{}`
- `format_for_system_prompt(context)` → string or `""`

**Output format example:**
```
## Current Selection Context

You are looking at room "monastery_gate" (Monastery Gate) in zone "whispering_monastery".
Description: "Heavy wooden doors stand open..."
Exits: north → monastery_courtyard, south → mountain_path
Current editing mode: map
Chat mode: design
```

---

## Task 1.2: Wire Context into Chat

**Modify:** `server/lib/loka/world_builder/chat.ex`

**Changes:**
1. Add `alias Loka.WorldBuilder.ContextBuilder` (line 9)
2. Add `chat_mode: :design` to `init_assigns/1` (line 14-26)
3. Change `get_system_prompt/1` to `get_system_prompt/2` accepting assigns:
   - Line 448: `defp get_system_prompt(project_key, assigns \\ %{}) do`
   - After `project_context`, add: `selection_context = ContextBuilder.build(assigns) |> ContextBuilder.format_for_system_prompt()`
   - Return: `base_prompt <> project_context <> selection_context`
4. Update call in `send_message/2` (line 48): `system = get_system_prompt(project_key, socket.assigns)`
5. Update call in `continue_with_tool_results/2` (line 372): `system = get_system_prompt(project_key, socket.assigns)`

---

## Task 1.3: Chat Mode Toggle UI

**Modify:** `server/lib/loka_web/live/admin_live/world_builder/chat_panel.ex`
**Modify:** `server/lib/loka_web/live/admin_live/world_builder_live.ex`

**Changes in world_builder_live.ex:**
1. Add `chat_mode` to the assigns passed to chat_panel component (find where chat_panel is rendered, around line 317-329)
2. Add event handler:
```elixir
def handle_event("toggle_chat_mode", _params, socket) do
  new_mode = if socket.assigns.chat_mode == :design, do: :assist, else: :design
  {:noreply, assign(socket, :chat_mode, new_mode)}
end
```

**Changes in chat_panel.ex:**
1. Add a toggle button in the header area (near project dropdown)
2. Use existing button styles with `--wb-*` tokens
3. Show current mode label ("Design" or "Assist")

---

## Task 1.4: System Prompt Update

**Modify:** `server/priv/world_builder/system_prompt.md`

**Append after existing content** (keep everything already there):

```markdown
## Context Awareness

When the builder has a room or entity selected, you'll see a "Current Selection Context"
section. Use this to resolve "here", "this room", "this NPC", etc.

- If a room is selected and builder says "add an NPC here", create in that room
- If an entity is selected and builder says "improve this", modify that entity
- NEVER ask "which room?" when selection context tells you

## Chat Modes

### Design Mode (default)
Creative collaborator. Generate full content with prose, descriptions, dialogue.
Propose plans before executing. Ask clarifying questions.

### Assist Mode
Structural engineer only. Handle mechanical work ONLY.

**MUST:** Scaffold with [TODO] placeholders, wire exits, format YAML, validate, reference lookup
**MUST NOT:** Write descriptions, dialogue, emotes, narrative, or any prose

Placeholder format: `[VERB: context hint]` e.g. `[DESCRIBE: cave entrance, connects to forest]`

If asked to write prose in Assist mode, say: "I'm in Assist mode — switch to Design mode for creative content."

## After Creating Content

Summarize what you created. Note anything to review. Mention potential issues proactively.
```

---

## Task 2.1: Validation Feedback

**Modify:** `server/lib/loka/world_builder/chat.ex`

**Changes:**
1. Add `pending_validation: nil` to `init_assigns/1`
2. Define content-mutating tools list:
```elixir
@content_tools ~w(wb_create_room wb_update_room wb_delete_room wb_create_npc wb_create_item
                   wb_create_quest wb_update_quest wb_create_dialogue
                   wb_create_exit wb_remove_exit wb_batch_create_rooms)
```
3. In `handle_tool_use/4`, after successful execution of content tools, run validation:
```elixir
# After the existing try/rescue block and result assignment
socket = if tool_name in @content_tools and result.success do
  run_and_store_validation(socket)
else
  socket
end
```
4. In `continue_with_tool_results/2`, inject validation into system prompt if pending
5. Clear `pending_validation` after injection

**IMPORTANT:** Read `validation_manager.ex` to check the actual return type of `validate_all/0` before implementing the formatter.

---

## Task 2.2: Analysis Tools

**Modify:** `server/lib/loka/world_builder/tool_executor.ex`
**Modify:** `server/lib/loka/world_builder/anthropic_client.ex` (find the tool definitions list)

**Add two tools:**

1. **`wb_validate_world`** — calls `ValidationManager.validate_all()`, formats results
2. **`wb_search_content`** — searches YAML content via TypedObject.Registry

**For search:** Use `Loka.Engine.TypedObject.Registry.all()` or similar to get all loaded objects, then string-match against query. Limit to 20 results. Check what API the Registry exposes.

---

## Task 2.3: Contextual Quick Actions

**Modify:** `server/lib/loka_web/live/admin_live/world_builder/chat_panel.ex`

**Replace static quick actions** (lines ~128-196) with a function that checks:
- `@selected_room` set → room-specific actions
- `@selected_entity` set → entity-specific actions
- Neither → default actions (current-ish)
- Adjust for `@chat_mode` (:assist uses structural language)

---

## Conventions Reminder

- YAML keys are strings: `data["key"]` not `data.key`
- HEEx: `:if` directives only, never `<%= if %>`
- CSS: `--wb-*` tokens only, never raw hex
- `try/rescue` around `ToolExecutor.execute` in LiveView handlers
- Keep function clauses grouped (no private helpers between `handle_event` clauses)
- No inline computation in `render/1` — cache in assigns

## Verification

After all tasks: `mix compile --warnings-as-errors && mix test`
