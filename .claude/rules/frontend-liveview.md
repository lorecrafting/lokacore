---
paths: ["lib/loka_web/live/admin_live/world_builder/**"]
---

# LiveView & World Builder Component Guide

Auto-loads when working in World Builder LiveView components.

## Function Component Pattern

```elixir
defmodule LokaWeb.AdminLive.WorldBuilder.MyPanel do
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def my_panel(assigns) do
    ~H"""
    <div class={["world-builder-panel", @collapsed && "panel-collapsed", @class]}>
      ...
    </div>
    """
  end
end
```

## LiveView Rules

- **HEEx `:if` directives only.** NEVER use ERB `<%= if %>` syntax.
- **No inline computation in `render/1`.** Cache results in assigns, update via helpers when source data changes.
- **Shared components** in `admin_live/components.ex` (badges, stat_cards, etc.).
- **`attr` declarations** on all function components for documentation and validation.
- **Conditional CSS classes:** Use `class={[...]}` list with boolean conditions: `@collapsed && "panel-collapsed"`.
- **Never use duplicate `class` attributes** on the same element. In HEEx, only the last `class=` is applied -- merge into a single `class={[...]}` list.

## Event Handler Extraction

Large LiveView modules extract event handlers into `*_event_handler.ex` modules:

| Parent Component | Event Handler Module | Handles |
|-----------------|---------------------|---------|
| WorldBuilderLive | git_event_handler.ex | Git commit modal events |
| WorldBuilderLive | script_template_event_handler.ex | Template picker events |
| DialogueEditor | dialogue_event_handler.ex | Dialogue tree events |
| CutsceneEditor | cutscene_event_handler.ex | Cutscene timeline events |

## Panel System

### Grid Layout

The World Builder uses CSS Grid with `--grid-columns` custom property:

`hierarchy | h_resize | viewport | i_resize | inspector | t_resize | terminal | c_resize | chat`

Grid column indices: hierarchy=0, inspector=4, terminal=6, chat=8.

### Panel Configuration

Each panel has a `PANEL_CONFIG` entry in `panel_resize.js` defining `min`, `max`, `defaultSize`, and grid position. Panel sizes are stored in localStorage and restored on mount.

### Collapsed State

Panel collapse is tracked in both:
- **localStorage** (`world_builder_collapsed_panels`) for persistence
- **LiveView assigns** for server-side rendering

Toggle via `phx-click="toggle_panel"` with `phx-value-panel="panelname"`.

## Component Hierarchy

```
WorldBuilderLive (world_builder_live.ex)
|
+-- Toolbar (zone selector, view toggles, action buttons)
+-- HierarchyPanel (hierarchy_panel.ex) - Entity tree view
+-- ViewportPanel (viewport_panel.ex) -> WorldBuilder Hook -> Canvas2D
+-- InspectorPanel (inspector_panel.ex)
|   +-- RoomInspector, NPCInspector
|   +-- QuestEditor, DialogueEditor, CutsceneEditor
+-- TerminalPanel -> MudTerminal Hook -> Phoenix Channel
+-- ChatPanel (chat_panel.ex) -> ChatTextarea Hook
+-- Modals (GitCommit, Settings, AuditLog, TemplatePicker, DocumentViewer)
```

### Data Flow

```
LiveView assigns --pushEvent--> JS Hook --handleEvent--> LiveView
       |                            |
       |                            +-- Canvas renders room data
       |                            +-- Terminal shows game output
       |                            +-- Chat displays AI responses
       |
       +-- Server-side state (rooms, entities, selection)
```

## Adding a New Panel

1. Create `world_builder/my_panel.ex` -- use `Phoenix.Component`, follow `terminal_panel.ex`
2. Define component function with `collapsed` attr and conditional visibility
3. Add panel to the grid in `world_builder_live.ex` render function
4. Add `PANEL_CONFIG` entry in `panel_resize.js` with `min`, `max`, `default`, `gridColumnIndex`
5. Add `handle_event("toggle_panel", ...)` clause or reuse existing toggle logic
6. If JS interactivity needed: create hook in `assets/js/hooks/`, register in `hooks/index.js`
7. Add CSS variables to `variables.css` with `--wb-` prefix and `@theme` token in `tailwind-config.css`

### New Panel Checklist

- [ ] Panel CSS uses design tokens only (no hex colors, no raw pixel values)
- [ ] Panel has collapse/expand button with `phx-click="toggle_panel"`
- [ ] Panel has `aria-label` and `aria-expanded` attributes
- [ ] Hook (if any) uses HookHelper and calls `this.helper.destroy()` in `destroyed()`
- [ ] Hook has try/catch in `mounted()` and null checks for DOM queries
- [ ] New CSS file is under 400 lines
