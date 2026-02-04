# Proposal: LLM-First World Builder

**Status:** Draft
**Date:** 2026-02-04
**Author:** Raymond + Claude

---

## 1. Vision

The World Builder becomes an **LLM-first authoring environment** where the chat panel is the primary interface for creating game content. Visual panels (hierarchy, viewport, inspector) become a **live preview and refinement layer** rather than the primary authoring surface.

**Current model:** Two parallel paths (manual forms + LLM chat) that both produce YAML content.
**Proposed model:** LLM is the primary authoring path. Visual panels are reactive viewers with inline editing for tweaks.

The manual creation path remains fully functional but is deprioritized in the UX flow. Power users can still hand-craft every dialogue node, but the default experience assumes you're talking to the AI.

---

## 2. Why Now

1. **Content authoring is inherently descriptive.** "Create a tavern with a grumpy barkeep and a quest about missing ale" is faster than clicking through forms. The LLM can scaffold rooms, NPCs, dialogues, and wire up quest objectives in one pass.

2. **The visual UI is more valuable as a viewer.** Hierarchy shows the world tree. Viewport shows spatial layout. Inspector lets you tweak a field the LLM got wrong. You're not building from scratch in forms; you're reviewing and refining.

3. **Multi-entity orchestration is the killer feature.** A single village description generates 5+ rooms, 3+ NPCs, dialogue trees, a quest, item prototypes, and wires them together. Manually, that's 30 minutes of clicking. With an LLM, it's one sentence and a review step.

4. **The architecture already supports it.** 30+ MCP tools, streaming Anthropic client, tool result continuation, auto-refresh on room creation. The foundation is built; this proposal is about making it the center of gravity.

---

## 3. Current State

### What Exists

| Component | Status | Role |
|-----------|--------|------|
| ChatPanel | Working | Right-bottom panel, streaming LLM with 30+ tools |
| HierarchyPanel | Working | Left panel, tabbed entity browser with search/filter |
| ViewportContainer | Working | Center panel, Canvas2D map + inline editors |
| InspectorPanel | Working | Right-top panel, room/entity property editor |
| TerminalPanel | Working | Right-middle panel, MUD terminal for playtesting |
| ToolExecutor | Working | 30+ tools for room/NPC/item/quest/dialogue CRUD |
| AnthropicClient | Working | Streaming with multi-provider support |
| Validation | Working | 12-part validator, runs on Ctrl+S and pre-push |
| Projects/Docs | Working | Design documents per project |
| Quick Actions | Working | "Build rooms", "Design NPC", "Create quest" buttons |

### What's Missing

| Gap | Impact |
|-----|--------|
| No preview before commit | LLM creates content directly; no review step |
| No diff visualization | Can't see what changed before accepting |
| Chat is positionally minor | Small panel in bottom-right, not the focal point |
| No context awareness | Chat doesn't know what you're looking at |
| No inline editing from chat | Can't say "change room 3's description" while looking at it |
| No generation modes | Same interface for "build a village" and "fix this typo" |
| No validation feedback loop | LLM doesn't auto-check its own output |
| No undo for LLM operations | Tool executions aren't undoable as a batch |

---

## 4. Proposed Architecture

### 4.1 Layout: Chat as Center of Gravity

The chat panel moves from a small right-bottom panel to a **primary panel** that can expand to dominate the view. Two layout modes:

#### Design Mode (Chat-Primary)

```
+------------------+-----------------------------+
|                  |                             |
|   Hierarchy      |       Chat Panel            |
|   (collapsed     |   (primary, large)          |
|    or narrow)    |                             |
|                  |   +---------------------+   |
|                  |   | Preview Card        |   |
|                  |   | (inline in chat)    |   |
|                  |   +---------------------+   |
|                  |                             |
|                  |   [input area]              |
+------------------+-----------------------------+
|        Viewport / Inspector (contextual)       |
+------------------------------------------------+
```

- Chat takes center stage (60-70% of width).
- Hierarchy stays as a narrow sidebar for navigation.
- Viewport and Inspector appear contextually below or beside chat:
  - Discussing rooms? Viewport shows the map.
  - Discussing an NPC? Inspector shows the entity.
  - Writing a quest? Flow graph appears.
- Terminal remains accessible via toggle.

#### Review Mode (Visual-Primary)

```
+----------+---------------------------+---------+
|          |                           |         |
| Hierarchy|       Viewport            |Inspector|
|          |     (map / editor)        |         |
|          |                           |         |
+----------+---------------------------+---------+
|              Chat (narrow bar)                 |
+------------------------------------------------+
```

- Current layout essentially, for when you're reviewing/tweaking.
- Chat collapses to a narrow bar at the bottom with quick input.
- Full visual editing surface.
- Switch between modes with a toggle or keyboard shortcut.

The transition between modes should be fluid. Clicking a room in the viewport could auto-switch to review mode. Typing a message could auto-expand chat.

### 4.2 The Generation Protocol

This is the core behavioral change. Instead of tools executing immediately, LLM operations go through a **propose-review-commit** cycle.

#### Current Flow (Immediate Execution)

```
User: "Create a tavern"
  → Claude calls wb_create_room("Tavern", ...)
  → Room created in RoomManager immediately
  → Map refreshes
  → Done (no review)
```

#### Proposed Flow (Preview-First)

```
User: "Create a tavern with a barkeep and a quest about missing ale"

Step 1: PLAN
  Claude responds with a structured plan:
  "I'll create:
   - 1 room: The Rusty Tankard (tavern)
   - 1 NPC: Grimjaw the Barkeep
   - 1 quest: The Missing Ale (side quest, 3 objectives)
   - 1 dialogue tree for Grimjaw
   - 2 items: Empty Ale Barrel, Grimjaw's Special Brew"

Step 2: PREVIEW
  Claude calls a new tool: wb_preview_changes(changes)
  UI renders preview cards inline in chat:
  +------------------------------------------+
  | PREVIEW: 6 changes                       |
  |                                          |
  | + Room: The Rusty Tankard     [view]     |
  | + NPC: Grimjaw the Barkeep   [view]     |
  | + Quest: The Missing Ale     [view]     |
  | + Dialogue: grimjaw          [view]     |
  | + Item: Empty Ale Barrel     [view]     |
  | + Item: Grimjaw's Special    [view]     |
  |                                          |
  | [Apply All]  [Edit First]  [Cancel]      |
  +------------------------------------------+

  Clicking [view] expands to show the full YAML.
  The viewport shows a ghost preview of the new room.

Step 3: REFINE (optional)
  User: "Make the barkeep friendlier and add a cellar room"
  Claude updates the preview (not the live world).

Step 4: COMMIT
  User clicks [Apply All] or says "looks good"
  All changes execute as a single batch operation.
  Undo reverts the entire batch.
```

#### Implementation

**New Socket Assigns:**

```elixir
# Pending changes buffer
:pending_changes     # list of %{type, action, data, preview_yaml}
:preview_mode        # :none | :previewing | :applied
:preview_ghost_rooms # rooms to render as ghosts on viewport
```

**New Tools:**

```elixir
# Preview tool (does NOT execute, just buffers)
wb_preview_changes(%{
  changes: [
    %{type: "room", action: "create", data: %{...}},
    %{type: "npc", action: "create", data: %{...}},
    %{type: "quest", action: "create", data: %{...}}
  ]
})

# Commit tool (executes all buffered changes)
wb_commit_changes()

# Discard tool
wb_discard_changes()
```

**Preview Rendering:**
- Rooms appear as dashed-outline "ghost" rectangles on the viewport.
- NPCs/items appear in the hierarchy with a "pending" badge.
- Inspector can show preview data (read-only until committed).
- Chat renders preview cards with expand/collapse for each entity.

### 4.3 Context-Aware Chat

The chat should always know what the user is looking at. This eliminates the need to specify targets by name.

**Selection Context:**
- Selected room(s) in viewport → chat knows the room key, name, zone
- Selected entity in hierarchy → chat knows the entity details
- Active editor (script/dialogue/quest) → chat knows what's being edited
- Current Z-level → chat scopes room creation to that level

**How It Works:**

```elixir
# In Chat.build_system_context/1
defp build_context(socket) do
  context = %{}

  context = if socket.assigns.selected_room do
    room = socket.assigns.selected_room
    Map.put(context, :selected_room, %{
      key: room.key,
      name: room.name,
      zone: room.zone,
      description: room.description,
      exits: room.exits,
      spawns: room.spawns
    })
  else
    context
  end

  context = if socket.assigns.selected_entity do
    Map.put(context, :selected_entity, %{
      key: socket.assigns.selected_entity.key,
      type: socket.assigns.selected_entity.type,
      name: socket.assigns.selected_entity.name
    })
  else
    context
  end

  # Active editor context
  context = case socket.assigns.editing_mode do
    :script -> Map.put(context, :editing_script, socket.assigns.editing_script)
    :dialogue -> Map.put(context, :editing_dialogue, socket.assigns.editing_dialogue_tree)
    :quest -> Map.put(context, :editing_quest, socket.assigns.quest_data)
    _ -> context
  end

  context
end
```

**Injected as a system message prefix on each user message:**
```
[Context: You are looking at room "monastery_gate" in zone "monastery".
 Selected NPC: "novice_pema". Current Z-level: 0.]
```

**User Experience:**
```
User selects a room on the viewport.
User types: "Add a merchant NPC here who sells potions"
→ Claude knows "here" = the selected room
→ Creates NPC with location = selected room
→ Preview shows NPC in that room's spawn list
```

```
User is editing a dialogue tree in the editor.
User types: "Add a branch where the player can ask about the missing shipment"
→ Claude knows the active dialogue tree
→ Adds a new node with appropriate connections
→ Dialogue editor updates to show the new branch
```

### 4.4 Inspector as Override Layer

The inspector's role shifts from "primary editor" to "quick-fix tool."

**Current:** Inspector is how you edit room properties (name, description, position, exits).
**Proposed:** Inspector shows the current state and allows inline overrides. Changes in the inspector are small, targeted edits that don't need to go through the LLM.

Key behaviors:
- Editing a field in the inspector writes directly (no preview cycle needed for single-field changes).
- Inspector shows a "Source: LLM" or "Source: Manual" indicator per field, so you know what was AI-generated vs. hand-edited.
- After manual edits, the chat context updates so the LLM knows about your changes.

### 4.5 Validation Feedback Loop

After any generation (preview or committed), automatically run validation and feed results back to the LLM.

```
User: "Create a quest where the player finds 3 herbs in the forest"

Claude generates quest + items + room references.

System auto-validates:
  ⚠ Warning: Room "forest_clearing" does not exist
  ⚠ Warning: Item "moonpetal_herb" has no prototype

Claude sees validation results and self-corrects:
  "I notice the forest rooms don't exist yet. Should I also
   create the forest area, or do you want to place the herbs
   in existing rooms?"
```

**Implementation:**

```elixir
# After tool execution or preview generation
defp validate_and_feedback(socket, changes) do
  results = ValidationManager.validate_changes(changes)

  if results.errors != [] or results.warnings != [] do
    # Inject validation results as a system message
    validation_msg = format_validation(results)
    Chat.inject_system_message(socket, validation_msg)
  else
    socket
  end
end
```

**New Tool:**
```elixir
# Claude can request validation proactively
wb_validate_preview()  # Validates buffered preview changes
wb_validate_world()    # Full world validation
```

### 4.6 Batch Undo for LLM Operations

All changes from a single LLM interaction should be undoable as one operation.

```elixir
# When committing preview changes
defp commit_changes(socket, changes) do
  # Start undo group
  undo_id = UndoManager.begin_group("AI: Create tavern area")

  Enum.each(changes, fn change ->
    execute_change(change)
    UndoManager.record(undo_id, change)
  end)

  UndoManager.end_group(undo_id)

  # Ctrl+Z now reverts all 6 entities at once
  socket
end
```

---

## 5. New Tool Capabilities

### 5.1 Analysis Tools (Read-Only)

Give the LLM the ability to understand the world, not just modify it.

| Tool | Purpose |
|------|---------|
| `wb_analyze_connectivity` | Find orphan rooms, dead ends, unreachable areas |
| `wb_analyze_quest_completability` | Check if a quest can be completed given current world state |
| `wb_analyze_zone_balance` | Level distribution, mob density, loot tables |
| `wb_analyze_narrative_consistency` | Cross-reference NPC dialogue, quest text, room descriptions |
| `wb_search_content` | Full-text search across all YAML content |
| `wb_get_entity_relationships` | Graph of how entities reference each other |

### 5.2 Batch Generation Tools

| Tool | Purpose |
|------|---------|
| `wb_generate_zone` | Create an entire zone: rooms + exits + NPCs + spawns |
| `wb_generate_quest_chain` | Multi-quest storyline with prerequisites |
| `wb_generate_npc_full` | NPC + dialogue + behaviors + emotes in one call |
| `wb_populate_room` | Add ambient messages, spawns, descriptions to existing room |

### 5.3 Refinement Tools

| Tool | Purpose |
|------|---------|
| `wb_rewrite_descriptions` | Regenerate descriptions for a set of entities (style consistency) |
| `wb_add_ambient_detail` | Add ambient messages, emotes, sensory details to a zone |
| `wb_connect_rooms_auto` | Auto-generate exits based on spatial position |
| `wb_suggest_improvements` | Analyze content and suggest enhancements |

### 5.4 Preview Tools

| Tool | Purpose |
|------|---------|
| `wb_preview_changes` | Buffer changes without executing |
| `wb_modify_preview` | Update buffered changes |
| `wb_commit_changes` | Execute all buffered changes |
| `wb_discard_changes` | Clear the buffer |
| `wb_validate_preview` | Run validation on buffered changes |

---

## 6. Chat UI Enhancements

### 6.1 Rich Message Types

The chat should render more than just text. New message types:

**Preview Cards:** Inline expandable cards showing proposed entities.
```
+----------------------------------------------+
| 🏠 Room: The Rusty Tankard                   |
|                                               |
| A dimly lit tavern with low ceilings and      |
| the smell of stale ale. Rough wooden tables   |
| crowd the floor...                            |
|                                               |
| Zone: village | Exits: north→market_square    |
| [Expand YAML] [Edit] [Remove from preview]    |
+----------------------------------------------+
```

**Diff Cards:** Show what changed when modifying existing content.
```
+----------------------------------------------+
| ✏️ Modified: novice_pema                      |
|                                               |
|  mood: anxious → determined                   |
|  + emote: "clenches her fists quietly"        |
|  ~ description: [3 lines changed]             |
|                                               |
| [View Full Diff] [Accept] [Reject]            |
+----------------------------------------------+
```

**Validation Cards:** Inline validation results.
```
+----------------------------------------------+
| ⚠️ 2 warnings found                          |
|                                               |
| • Room "forest_clearing" referenced but       |
|   does not exist (in quest objective 2)       |
| • NPC "herb_merchant" has no dialogue tree    |
|                                               |
| [Auto-Fix] [Ignore] [Details]                 |
+----------------------------------------------+
```

**Map Snippet:** Small inline map showing affected area.
```
+----------------------------------------------+
| 🗺️ Created Area                               |
|                                               |
|   [gate] ── [courtyard] ── [hall]             |
|                  |                            |
|              [garden]                         |
|                                               |
| 4 rooms, 4 exits, zone: monastery             |
+----------------------------------------------+
```

### 6.2 Quick Actions Redesign

Replace the current button row with contextual actions:

**No selection:**
- "Design a new area" (zone + rooms + NPCs)
- "Create a quest" (quest + objectives + rewards)
- "Write a storyline" (multi-quest arc)
- "Populate the world" (add detail to existing content)

**Room selected:**
- "Describe this room" (generate/improve description)
- "Add NPCs here" (create NPCs for this room)
- "Connect to nearby rooms" (auto-generate exits)
- "Add ambience" (ambient messages, sensory details)

**NPC selected:**
- "Write dialogue" (generate dialogue tree)
- "Add behaviors" (scripts, emotes, schedules)
- "Create a quest for this NPC"
- "Flesh out backstory"

**Quest selected:**
- "Add objectives"
- "Write journal entries"
- "Connect to storyline"
- "Balance rewards"

### 6.3 Chat Modes

Different interaction styles for different workflows:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Design** | Conversational, preview-first, suggests options | Building new content from scratch |
| **Edit** | Direct, executes immediately on selected entity | Quick tweaks to existing content |
| **Review** | Read-only analysis, suggestions only | Auditing content quality |
| **Script** | Code-focused, shows sandbox output | Writing Elixir behaviors |

Mode is auto-detected from the message or manually toggled.

---

## 7. Workflow Examples

### 7.1 Building a Village from Scratch

```
User: "I want to create a small mountain village with 5-6 buildings,
       a few NPCs, and a simple quest about helping a farmer."

Claude: "I'll design a mountain village for you. Here's my plan:

AREA: Mountain Village (zone: mountain_village)
├── Village Square (hub, connects to all buildings)
├── Farmer's Cottage (quest giver location)
├── General Store (merchant)
├── Village Inn (rest point, save)
├── Blacksmith (services)
└── Village Well (atmospheric, quest objective)

NPCs:
├── Farmer Dorje (quest giver, worried about crop blight)
├── Shopkeeper Yangchen (general goods merchant)
├── Innkeeper Rinchen (rest, rumors)
└── Smith Karma (repairs, upgrades)

Quest: Blight on the Harvest
├── Talk to Farmer Dorje (accept)
├── Investigate the well (discover contamination)
├── Find the source in the nearby cave
└── Return to Dorje (complete, reward)

Want me to generate this? I can adjust anything first."

User: "Looks great, but make it 4 buildings - skip the blacksmith.
       And the quest should involve a missing goat instead."

Claude updates plan, generates preview.
Preview cards appear inline.
Viewport shows ghost rooms in spatial layout.
User reviews, clicks [Apply All].
All 4 rooms, 3 NPCs, quest, dialogues created as one batch.
```

### 7.2 Refining Existing Content

```
User selects "novice_pema" in hierarchy.

User: "Her dialogue feels flat. Make her more nervous and add
       fidgeting emotes."

Claude reads current NPC data via context awareness.
Shows diff card:
  ~ dialogue.greeting.text: "Hello, traveler" →
    "Oh! You startled me. I... yes, hello."
  + emote.idle_fidget: "fidgets with the hem of her robe"
  + emote.nervous_glance: "glances toward the monastery gates"

User: "Perfect, apply it."
Changes committed. Inspector updates. Viewport unchanged (NPC edit).
```

### 7.3 Quest Chain Design

```
User: "I need a 3-part storyline for Act 2 where the player
       uncovers a conspiracy in the monastery."

Claude: "I'll design a 3-quest chain. Let me check what exists first..."
  → Calls wb_list_rooms(), wb_list_npcs(), wb_get_zone_info("monastery")
  → Reads existing quest prerequisites

Claude proposes:
  Quest 1: "Whispers in the Halls" (talk to 3 NPCs, gather clues)
  Quest 2: "The Hidden Chamber" (find secret room, confront evidence)
  Quest 3: "Judgment Day" (choose faction, climactic confrontation)

  Includes: 1 new room (hidden chamber), 2 new NPCs (conspirators),
  dialogue branches for 3 existing NPCs, 3 quest YAMLs,
  1 cutscene for Act 2 climax.

Preview renders all entities.
User can click into any preview card to view/edit YAML.
User tweaks Quest 2's reward, then applies all.
```

### 7.4 Script Authoring

```
User: "I need a behavior script where an NPC wanders between
       outdoor rooms in the monastery zone during daytime."

Claude: "I'll create a day_wander behavior script. Here's what it does:

```yaml
key: monastery_day_wander
type: script
data:
  hook: behavior
  source: |
    if time_of_day() in [:dawn, :day] and is_outdoor?() do
      rooms = find_entities_by_tag("monastery")
      |> Enum.filter(&is_outdoor?/1)
      target = pick(rooms)
      move_entity(entity, target)
    end
    continue()
  config_schema:
    interval: {type: integer, default: 300}
```

This will make the NPC roam outdoor monastery rooms during
the day and stay put at night. Want me to apply it?"
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Preview System + Context Awareness)

**Goal:** LLM generates previews, user reviews before committing.

**Changes:**

1. **Preview buffer system**
   - New assigns: `pending_changes`, `preview_mode`, `preview_ghost_rooms`
   - New tools: `wb_preview_changes`, `wb_commit_changes`, `wb_discard_changes`
   - ToolExecutor routes to preview buffer instead of immediate execution
   - System prompt updated to use preview-first flow

2. **Context injection**
   - `Chat.build_context/1` reads selected room, entity, editor state
   - Context injected as system message prefix on each request
   - Selected room/entity auto-included in tool calls

3. **Preview rendering in chat**
   - Preview cards component for chat messages
   - Expand/collapse per-entity YAML view
   - [Apply All] / [Cancel] buttons
   - Ghost room rendering on Canvas2DViewport

4. **Batch undo**
   - Server-side undo groups wrapping preview commits
   - Single Ctrl+Z reverts entire LLM generation

**Estimated scope:** ~800-1200 lines of Elixir, ~200 lines JS

### Phase 2: UI Layout + Rich Messages

**Goal:** Chat becomes the primary panel. Rich message types.

**Changes:**

1. **Layout modes**
   - Design mode (chat-primary) and Review mode (visual-primary)
   - Toggle keybinding (e.g., `Ctrl+Shift+L`)
   - Panel sizes adjust automatically per mode
   - Contextual panel visibility (viewport appears when rooms discussed)

2. **Rich message components**
   - Preview cards with inline YAML
   - Diff cards for modifications
   - Validation cards with auto-fix buttons
   - Mini map snippets (ASCII or small canvas)

3. **Contextual quick actions**
   - Quick action buttons change based on selection
   - No selection → high-level creation actions
   - Room selected → room-specific actions
   - NPC selected → NPC-specific actions

4. **Chat modes**
   - Design / Edit / Review / Script mode indicators
   - Auto-detection from message content
   - Mode affects system prompt and tool availability

**Estimated scope:** ~600-800 lines Elixir (components), ~300 lines JS/CSS

### Phase 3: Advanced Tools + Validation Loop

**Goal:** LLM can analyze, validate, and self-correct.

**Changes:**

1. **Analysis tools**
   - `wb_analyze_connectivity`, `wb_analyze_quest_completability`
   - `wb_search_content`, `wb_get_entity_relationships`
   - `wb_analyze_zone_balance`

2. **Batch generation tools**
   - `wb_generate_zone`, `wb_generate_quest_chain`
   - `wb_generate_npc_full`, `wb_populate_room`

3. **Auto-validation feedback**
   - Run validators after preview generation
   - Inject validation results into chat as system message
   - LLM self-corrects before user reviews
   - [Auto-Fix] button on validation cards

4. **Refinement tools**
   - `wb_rewrite_descriptions`, `wb_add_ambient_detail`
   - `wb_suggest_improvements`
   - Style consistency checks across a zone

**Estimated scope:** ~1000-1500 lines Elixir (tools + validation)

### Phase 4: Polish + Workflows

**Goal:** Streamlined end-to-end workflows.

**Changes:**

1. **Workflow templates**
   - "New Zone" workflow: guided multi-step generation
   - "New Storyline" workflow: act structure → quests → content
   - "Content Audit" workflow: analyze + suggest + fix
   - Workflows are just pre-written system prompts + tool sequences

2. **History and branching**
   - Chat history persisted per project
   - "Continue where we left off" across sessions
   - Branch conversations for exploring alternatives

3. **Collaborative review**
   - Share preview links (read-only view of proposed changes)
   - Comments on preview cards
   - Approval flow for team environments

4. **Metrics and feedback**
   - Track what gets accepted vs. rejected vs. modified
   - Use rejection patterns to improve system prompts
   - Content quality scoring

**Estimated scope:** ~500-800 lines Elixir

---

## 9. System Prompt Evolution

The system prompt becomes the most important piece of the architecture. It defines how the LLM behaves in each mode.

### Current Prompt
Loaded from `priv/world_builder/system_prompt.md`. General-purpose assistant with tool access.

### Proposed Prompt Structure

```
BASE PROMPT
├── Role definition (World Builder AI, not generic assistant)
├── Content standards (Loka narrative voice, MUD conventions)
├── Preview protocol (always preview, never execute directly)
├── Context awareness rules (how to use selection context)
│
├── MODE: Design
│   ├── Conversational, exploratory
│   ├── Propose plans before generating
│   ├── Ask clarifying questions
│   └── Generate complete entity sets
│
├── MODE: Edit
│   ├── Direct, minimal conversation
│   ├── Execute on selected entity
│   ├── Show diffs, not full YAML
│   └── Skip preview for single-field changes
│
├── MODE: Review
│   ├── Analysis only, no modifications
│   ├── Use analysis tools
│   ├── Report findings with severity
│   └── Suggest improvements (don't apply)
│
└── MODE: Script
    ├── Elixir-focused, show code
    ├── Validate against sandbox restrictions
    ├── Test with dry-run bindings
    └── Explain script behavior
```

### Content Style Injection

The system prompt should include the narrative rules from `.claude/rules/narrative.md`:
- No hyphens for pauses (use `...` or em dash)
- Show don't tell
- Sensory grounding
- Subtext in dialogue
- Action beats

This ensures all LLM-generated content matches the game's voice.

---

## 10. Data Flow Architecture

### Current Flow

```
User Input → Chat → AnthropicClient → Tool Call → ToolExecutor
  → RoomManager/EntityManager (immediate write)
  → YAML file written
  → LiveView refreshes
```

### Proposed Flow

```
User Input → Chat (with context) → AnthropicClient → Tool Call
  → ToolExecutor (preview mode)
  → Preview Buffer (socket assigns)
  → Preview Cards rendered in chat
  → Ghost rendering on viewport
  → User reviews

  [Apply]  → Batch executor → Managers → YAML → Refresh → Undo group
  [Edit]   → Modify buffer → Re-render previews
  [Cancel] → Clear buffer
```

### Key Interfaces

```elixir
# Preview buffer
defmodule Loka.WorldBuilder.PreviewBuffer do
  @type change :: %{
    id: String.t(),
    type: :room | :npc | :item | :quest | :dialogue | :script | :zone,
    action: :create | :update | :delete,
    data: map(),
    yaml_preview: String.t(),
    validation: %{errors: list(), warnings: list()}
  }

  def add(socket, change)
  def remove(socket, change_id)
  def update(socket, change_id, new_data)
  def commit_all(socket)
  def discard_all(socket)
  def validate_all(socket)
end
```

```elixir
# Context builder
defmodule Loka.WorldBuilder.ContextBuilder do
  def build(socket) :: map()
  def format_for_system_prompt(context) :: String.t()
  def selection_summary(socket) :: String.t()
end
```

---

## 11. Migration Strategy

This is **not** a rewrite. It's a progressive enhancement.

### What Stays the Same
- All existing tools continue to work
- All panel components remain
- YAML as the content layer
- TypedObject/Content module system
- Validation system
- Canvas2DViewport rendering
- Terminal panel
- Keyboard shortcuts

### What Changes
- Chat panel position and sizing
- Tool execution routing (preview buffer layer)
- System prompt structure
- Quick action buttons (contextual)
- New message rendering components
- New socket assigns for preview state

### Backward Compatibility
- Direct execution mode remains available (Edit mode skips preview for small changes)
- All manual editing paths still work
- Users who prefer form-based editing are unaffected
- Preview system is additive, not a replacement

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| LLM latency makes workflow feel slow | Streaming previews, show plan immediately, generate in background |
| Preview buffer gets stale if world changes | Validate against current state at commit time, warn on conflicts |
| Context window limits for large worlds | Selective context (only nearby rooms, relevant entities), summarize |
| Users confused by two modes | Default to Design mode, auto-switch based on action |
| Generated content quality varies | Validation feedback loop, style guide in prompt, human review step |
| Cost of LLM calls increases | Cache common queries, batch tool results, use smaller models for analysis |
| Undo complexity with batch operations | Group undo is well-understood pattern, test thoroughly |

---

## 13. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to create a 5-room area with NPCs | ~30 min (manual) | ~5 min (LLM + review) |
| Content validation pass rate on first try | ~70% (manual) | ~90% (LLM + auto-validate) |
| Entities created per session | ~5-10 | ~20-50 |
| Percentage of content created via chat | ~20% | ~80% |
| User edits after LLM generation | N/A | <3 per entity (tweaks, not rewrites) |

---

## 14. Open Questions

1. **Should preview buffer persist across sessions?** If the user closes the tab with pending previews, should they be there when they come back?

2. **Multi-model support for different tasks?** Use a smaller/faster model for analysis tools and the full model for generation? The multi-provider support already exists.

3. **Should the LLM have access to the terminal?** Could it play-test its own quest by issuing commands in the MUD terminal and checking outcomes?

4. **Version control integration:** Should each LLM generation create a git commit automatically, making the generation history browsable via git log?

5. **Template library:** Should there be a curated set of generation templates (village template, dungeon template, quest chain template) that the LLM uses as starting points?

6. **Collaboration:** If multiple builders are working simultaneously, how do previews and commits interact?
