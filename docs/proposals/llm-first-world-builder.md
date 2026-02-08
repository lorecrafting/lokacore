# Proposal: LLM-First World Builder

**Status:** Draft
**Date:** 2026-02-04
**Author:** Raymond + Claude

---

## 1. Vision

The World Builder becomes an **LLM-first authoring environment** where the chat panel is the primary interface for creating game content. Visual panels (hierarchy, viewport, inspector) become a **live preview and refinement layer** rather than the primary authoring surface.

**Current model:** Two parallel paths (manual forms + LLM chat) that both produce YAML content.
**Proposed model:** LLM is the primary authoring path. Visual panels are reactive viewers with inline editing for tweaks.

The manual creation path remains fully functional. Critically, the system supports a **spectrum of LLM involvement** — from fully AI-generated content to fully handcrafted content where the LLM only handles structural plumbing. The MUD community values handcrafted content; this architecture respects that while making the mechanical work painless.

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

### 4.6 Handcraft-First Workflow (Assist Mode)

Many MUD builders want to write every word themselves. LLM-generated prose feels off, and community credibility depends on the content being genuinely human-crafted. The World Builder must support this as a **first-class workflow**, not an afterthought you get by ignoring the chat panel.

#### Philosophy: LLM as Toolbelt, Not Author

In Assist mode, the LLM is a structural engineer and librarian. It handles the tedious mechanical work — YAML plumbing, exit wiring, validation, reference lookups, spatial layout — so the builder can focus entirely on the creative work: writing descriptions, crafting dialogue, designing encounters.

The LLM **never writes prose** in this mode. Not descriptions, not dialogue, not emotes, not quest journal entries. It generates skeletons with clearly marked placeholders that the human fills in.

#### What the LLM Does in Assist Mode

| Task | Example |
|------|---------|
| **Scaffold structure** | "Create 5 rooms in an L-shape for a cave system" → generates keys, exits, coordinates, zone assignment. All descriptions are `[TODO]` placeholders. |
| **Wire connections** | "Connect the blacksmith to the market square" → creates bidirectional exits, handles YAML formatting |
| **Validate content** | "Check this zone for problems" → runs validators, reports orphan rooms, broken references, missing fields |
| **Reference lookup** | "What fields does a merchant NPC need?" → shows schema, examples from existing content |
| **Format conversion** | "Turn these notes into quest YAML" → structures your prose into proper YAML format without rewriting it |
| **Spatial layout** | "Arrange these rooms on the map" → assigns coordinates, avoids overlaps |
| **Bulk operations** | "Add a spawns section to all 12 rooms in this zone" → mechanical edits across files |
| **Analysis** | "Which NPCs in this zone don't have dialogue?" → audits without generating |

#### What the LLM Never Does in Assist Mode

- Write room descriptions or atmospheric text
- Author dialogue lines or NPC speech
- Generate quest narrative or journal entries
- Create emotes, ambient messages, or flavor text
- Rewrite or "improve" human-written prose (unless explicitly switched to Design mode)

#### Placeholder System

When the LLM scaffolds content in Assist mode, creative fields use clear markers:

```yaml
key: cave_entrance
type: room
data:
  name: "[NAME: cave entrance room]"
  description: "[DESCRIBE: first room of cave system, connects to forest]"
  zone: whispering_caverns
  exits:
    north:
      target: cave_tunnel_1
  spawns: []
  ambient_messages:
    - "[AMBIENT: cave atmosphere, sound/smell/sight]"
    - "[AMBIENT: environmental detail]"
```

Placeholders follow the format `[VERB: context hint]` so the builder knows what to write and has spatial/structural context without the LLM putting words in their mouth.

The World Builder UI highlights `[TODO]` and `[DESCRIBE]` placeholders visually — unfilled fields glow or show a badge count — so builders can see at a glance what still needs their attention.

#### Assist Mode Quick Actions

When Assist mode is active, quick actions change to reflect the non-generative workflow:

**No selection:**
- "Scaffold a new area" (empty rooms with placeholders)
- "Check world for issues" (validation)
- "Show unfilled placeholders" (audit)
- "Import my notes as YAML" (formatting)

**Room selected:**
- "Add exits to nearby rooms" (wiring)
- "Show this room's connections" (analysis)
- "Add placeholder fields" (scaffold spawns, ambient, etc.)
- "Validate this room" (check for issues)

**NPC selected:**
- "Create empty dialogue tree" (scaffold nodes, no prose)
- "Wire to quest" (mechanical connection)
- "Show required fields" (what's missing)
- "Add behavior scaffold" (script skeleton)

#### Switching Between Modes

Builders can work in Assist mode by default and temporarily switch to Design mode when they want the LLM to draft something — for instance, generating a first pass at ambient messages that they'll heavily rewrite. The switch is always intentional.

The mode toggle is explicit (button or keyboard shortcut), not auto-detected. Assist mode builders shouldn't be surprised by the LLM suddenly generating prose.

#### Future Consideration: Content Provenance

If community demand materializes for verifiable tracking of human vs. AI authorship, a lightweight per-entity tag (e.g., `_created_with: assist` in the YAML) would cover most use cases without the complexity of per-field tracking. Per-field provenance is tempting but problematic: it's easily gamed (copy-paste from chat), adds a metadata tax to every future feature, and tries to solve a social problem (trust) with technology. The real proof of handcrafted content is in how it reads, not in metadata. Assist mode's existence and workflow is the statement — not a report.

### 4.7 Batch Undo for LLM Operations

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
| **Design** | Conversational, preview-first, suggests options | Building new content from scratch (LLM generates) |
| **Assist** | Structural only, never writes prose, placeholders for creative fields | Handcrafted content with LLM doing mechanical work |
| **Edit** | Direct, executes immediately on selected entity | Quick tweaks to existing content |
| **Review** | Read-only analysis, suggestions only | Auditing content quality |
| **Script** | Code-focused, shows sandbox output | Writing Elixir behaviors |

Mode is toggled explicitly via button or keyboard shortcut. **Assist mode** is the recommended default for builders who want full creative control — it can be set as the project default in settings.

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

Claude updates plan, then creates the content.
All 4 rooms, 3 NPCs, quest, dialogues created.
Map refreshes. Builder reviews in viewport and inspector.
Validation auto-runs, Claude reports any issues.
```

### 7.2 Refining Existing Content

```
User selects "novice_pema" in hierarchy.

User: "Her dialogue feels flat. Make her more nervous and add
       fidgeting emotes."

Claude reads current NPC data via context awareness (knows
novice_pema is selected without being told).

Claude updates the NPC:
  ~ dialogue.greeting.text: "Hello, traveler" →
    "Oh! You startled me. I... yes, hello."
  + emote.idle_fidget: "fidgets with the hem of her robe"
  + emote.nervous_glance: "glances toward the monastery gates"

Inspector updates with new data. Builder reviews the changes.
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

Claude creates all entities. Validation auto-runs.
Builder reviews in inspector, tweaks Quest 2's reward.
```

### 7.4 Handcrafted Zone (Assist Mode)

```
Builder has Assist mode active (project default).

Builder: "I need a 6-room cave system. L-shaped layout,
         zone name whispering_caverns, entrance from the
         forest_path room."

Claude: "I'll scaffold 6 rooms in an L-shape:

  [entrance] ── [tunnel_1] ── [tunnel_2]
                                  |
               [pool] ── [fork] ── [dead_end]

  All rooms have placeholder descriptions and names.
  Entrance is connected to forest_path via south exit.
  Want me to generate this scaffold?"

Builder: "Move the pool to branch off tunnel_1 instead."

Claude adjusts layout, creates the 6 rooms.
All rooms have [DESCRIBE: ...] placeholders instead of
AI-generated prose (because Assist mode is active).
Map refreshes showing the new layout.

Builder opens cave_entrance in the Inspector.
Types the description by hand:

  "Water drips from somewhere above, each drop
   echoing off stone worn smooth by centuries of
   passage. The air tastes of mineral and old earth.
   Ahead, the tunnel narrows into darkness."

Builder: "Which rooms still need descriptions?"

Claude: "4 of 6 rooms have unfilled placeholders:
  - tunnel_1: [DESCRIBE], [NAME]
  - tunnel_2: [DESCRIBE], [NAME]
  - fork: [DESCRIBE], [NAME], [AMBIENT x2]
  - dead_end: [DESCRIBE], [NAME]

  pool and entrance are complete."

Builder works through each room, writing every word.
The LLM never wrote a single line of prose.
Content is verifiably handcrafted.
```

### 7.5 Script Authoring

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

> **Note (Feb 2026 review):** Phases reprioritized after gap analysis. Preview system deferred — the current flow (Claude proposes plan → builder approves → tools execute → review in inspector) is sufficient. YAML files are cheap to create/delete. The highest-value improvements are context awareness, system prompt upgrades, and validation feedback.

### Phase 1: Context Awareness + System Prompt

**Goal:** Chat knows what you're looking at. Modes shape LLM behavior.

**Changes:**

1. **Context injection into chat**
   - `Chat.build_context/1` reads `selected_room`, `selected_entity`, `editing_mode` from socket assigns
   - Context injected as system message prefix on each API request
   - Enables "add an NPC here" / "improve this room's description" without naming targets

2. **System prompt overhaul**
   - Add Assist mode instructions (never write prose, scaffold with placeholders)
   - Add context awareness rules (how to interpret selection context)
   - Add validation awareness (check your own output)
   - Keep existing Design/Build workflow and narrative voice rules

3. **Chat mode toggle (Design / Assist)**
   - New `chat_mode` assign (`:design` or `:assist`)
   - Toggle button in chat panel header
   - Mode appended to system prompt, changes LLM behavior
   - Assist mode: placeholder generation, no prose, structural work only

**Estimated scope:** ~200-300 lines of Elixir, ~20 lines JS/CSS

### Phase 2: Validation Feedback + Contextual Quick Actions

**Goal:** LLM catches its own mistakes. Quick actions adapt to selection.

**Changes:**

1. **Auto-validation after tool execution**
   - After room/NPC/quest creation tools, run `ValidationManager.validate_all/0`
   - Inject validation warnings/errors as system message so Claude self-corrects
   - New tools: `wb_validate_world`, `wb_validate_zone`

2. **Analysis tools**
   - `wb_search_content` — full-text search across all YAML content
   - `wb_analyze_connectivity` — find orphan rooms, dead ends, unreachable areas

3. **Contextual quick actions**
   - Quick action buttons change based on `selected_room` / `selected_entity`
   - No selection → "Design a new area", "Create a quest", "Audit the world"
   - Room selected → "Describe this room", "Add NPCs here", "Add exits"
   - NPC selected → "Write dialogue", "Create a quest for this NPC"

**Estimated scope:** ~400-500 lines of Elixir, ~50 lines JS/CSS

### Phase 3: Polish + Assist Mode Refinement

**Goal:** Assist mode fully realized. UI polish.

**Changes:**

1. **Placeholder system for Assist mode**
   - Tools check `chat_mode` and use `[TODO]` / `[DESCRIBE]` placeholders when `:assist`
   - Inspector highlights unfilled placeholder fields visually
   - "Show unfilled placeholders" quick action

2. **Chat mode expansion (Edit / Review)**
   - Edit mode: direct, minimal conversation, executes on selected entity
   - Review mode: read-only analysis, suggestions only, no modifications

3. **Layout mode toggle (optional)**
   - Design mode (chat-primary) and Review mode (visual-primary)
   - If builder demand justifies it

**Estimated scope:** ~300-500 lines Elixir, ~100 lines JS/CSS

### Deferred / Revisit Later

| Feature | Why Deferred |
|---------|-------------|
| **Preview buffer system** | Current flow (plan → approve → execute → review in inspector) is sufficient. YAML files are cheap to create/delete. PreviewManager exists if needed later. |
| **Batch undo** | Less urgent without preview system. Per-operation undo covers most cases. |
| **Rich message types** (diff cards, map snippets) | Functional without them. Chat already renders tool results. |
| **Layout mode switching** | Builders can manually resize panels today. |
| **Batch generation wrapper tools** | Claude already chains individual tool calls effectively. |
| **Refinement tools** | Premature — let usage patterns reveal what's needed. |
| **Chat history/branching** | Over-engineered for current stage. |
| **Collaborative review** | Single-builder use case for now. |

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
├── Context awareness rules (how to use selection context)
│
├── MODE: Design
│   ├── Conversational, exploratory
│   ├── Propose plans before generating
│   ├── Ask clarifying questions
│   └── Generate complete entity sets
│
├── MODE: Assist
│   ├── NEVER write prose (descriptions, dialogue, emotes, journal text)
│   ├── Scaffold structure with [TODO] placeholders
│   ├── Wire connections, assign coordinates, format YAML
│   ├── Validate, analyze, and reference lookup only
│   └── When asked to "write" or "describe", remind builder to switch to Design mode
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

### Proposed Flow (Context-Aware)

```
User Input → Chat (with selection context) → AnthropicClient → Tool Call
  → ToolExecutor (immediate write, same as today)
  → YAML file written → LiveView refreshes
  → Auto-validation runs
  → Validation results injected as system message
  → Claude self-corrects if issues found
  → Builder reviews in Inspector / Viewport
```

### Key Interface

```elixir
# Context builder — reads LiveView assigns, formats for system prompt
defmodule Loka.WorldBuilder.ContextBuilder do
  def build(socket) :: map()
  def format_for_system_prompt(context) :: String.t()
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
- System prompt structure (modes, context awareness, validation feedback)
- Chat module gains context injection
- Quick action buttons become contextual
- New `chat_mode` assign for Design/Assist toggle
- New validation tools for Claude
- New analysis tools (search, connectivity)

### Backward Compatibility
- All manual editing paths still work
- Users who prefer form-based editing are unaffected
- Tools execute the same way — context and modes are additive

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| LLM latency makes workflow feel slow | Streaming already implemented; keep tool calls fast |
| Context window limits for large worlds | Selective context (only selected room/entity, not entire world) |
| Users confused by Design vs Assist mode | Default to Design, clear toggle with label, mode indicator in chat |
| Generated content quality varies | Validation feedback loop, style guide in prompt, review in inspector |
| Cost of LLM calls increases | Cache common queries, use smaller models for analysis tools |
| Assist mode placeholders feel clunky | Clear `[VERB: hint]` format, visual highlighting in inspector |
| Context injection sends stale data | Re-read assigns on each message send, not cached |

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

1. **Multi-model support for different tasks?** Use a smaller/faster model for analysis tools and the full model for generation? The multi-provider support already exists.

3. **Should the LLM have access to the terminal?** Could it play-test its own quest by issuing commands in the MUD terminal and checking outcomes?

4. **Version control integration:** Should each LLM generation create a git commit automatically, making the generation history browsable via git log?

5. **Template library:** Should there be a curated set of generation templates (village template, dungeon template, quest chain template) that the LLM uses as starting points?

6. **Collaboration:** If multiple builders are working simultaneously, how do previews and commits interact?

7. **Content provenance (deferred):** If demand arises for tracking human vs. AI authorship, what's the minimum viable approach? A per-entity `_created_with: assist` tag in YAML is likely sufficient. Per-field tracking adds significant complexity for marginal value.
