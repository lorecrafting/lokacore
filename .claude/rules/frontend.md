---
paths: ["assets/**"]
---

# Frontend Development Context

This context auto-loads when working in `assets/`.

## File Organization

| Category | Location |
|----------|----------|
| CSS entry | `assets/css/app.css` (imports + daisyUI theme config) |
| CSS tokens | `assets/css/variables.css` (WB design tokens) |
| CSS config | `assets/css/tailwind-config.css` (@theme block, variants) |
| CSS WB | `assets/css/world-builder/*.css` (domain-specific styles) |
| Auth CSS | `assets/css/admin-auth.css` |
| JS hooks | `assets/js/hooks/*.js` (one per hook, re-exported in `index.js`) |
| JS utilities | `assets/js/world_builder/*.js` (HookHelper, KeyboardManager, constants) |
| Entry point | `assets/js/app.js` |
| Tests | `assets/js/world_builder/__tests__/*.test.js` |
| Vendor libs | `assets/vendor/` (heroicons, daisyui, topbar - versions in `versions.json`) |

## Hook Architecture

### HookHelper (Required)

Every hook MUST use HookHelper for automatic listener/observer/timer cleanup. This prevents memory leaks when LiveView patches destroy or re-mount hook elements.

**API:**
- `on(target, event, handler, options)` - addEventListener with auto-removal
- `observe(observer, el)` - ResizeObserver/MutationObserver with auto-disconnect
- `interval(fn, ms)` - setInterval with auto-clear, returns interval ID
- `destroy()` - removes all tracked listeners, disconnects observers, clears intervals

```javascript
import { HookHelper } from '@/world_builder/HookHelper.js'

const MyHook = {
  mounted() {
    this.helper = new HookHelper(this)
    this.helper.on(window, 'resize', this.onResize.bind(this))
    this.helper.observe(new ResizeObserver(this.onSize.bind(this)), this.el)
    this.helper.interval(() => this.poll(), 5000)
  },
  updated() { /* refresh DOM refs only, HookHelper listeners persist */ },
  destroyed() { this.helper.destroy() }
}
```

**Exception:** `panel_resize` keeps handle-level listeners manual because `updated()` re-attaches them to new DOM handles after LiveView patches.

### Hook File Conventions

- **File naming:** `assets/js/hooks/{snake_case}.js` (e.g., `mud_terminal.js`, `panel_resize.js`)
- **Class naming:** CamelCase matching `phx-hook="HookName"` (e.g., `MudTerminal`, `PanelResize`)
- **Utility classes:** `assets/js/world_builder/{CamelCase}.js` (e.g., `HookHelper.js`, `KeyboardManager.js`)
- **Registration:** Every hook must be imported and added to the `Hooks` object in `assets/js/hooks/index.js`
- **Never** add hooks inline in `app.js`

### Hook Lifecycle

| Phase | Purpose |
|-------|---------|
| `mounted()` | Create HookHelper, bind event listeners, initialize state on `this.*` |
| `updated()` | Refresh DOM refs that may have changed after LiveView patch. Do NOT re-add listeners (HookHelper handles this) |
| `destroyed()` | Call `this.helper.destroy()`. Clean up any non-HookHelper resources (channels, etc.) |

### Hook Rules

- **Console logging:** Use `[HookName]` prefix (e.g., `console.log('[MudTerminal] connected')`). No bare `console.log()`.
- **Hook state:** Store on `this.*` (e.g., `this.channel`, `this.resizeObserver`).
- **DOM scoping:** Scope queries to the hook's container, not `document`. Use `this.el.closest('.container') || this.el.parentElement` then `.querySelector()`.
- **Continuous interactions** (drag/resize/scroll): Apply CSS locally via `requestAnimationFrame`, sync to server on mouseup/blur only. Never `pushEvent` in mousemove handlers. See `.claude/skills/liveview-local-interaction-pattern.md`.

### Current Hooks (9 total)

`ScrollBottom`, `WorldBuilder`, `PanelResize`, `ChatTextarea`, `MultiAPIKeyConfig`, `CodeMirrorEditor`, `MudTerminal`, `ConsoleOutput`, `QuestFlowGraph`

## CSS Token System

### Two Independent Themes

| Theme | Scope | Prefix | Style |
|-------|-------|--------|-------|
| World Builder | `/admin/world-builder` | `--wb-*` | Dark (223+ variables) |
| Admin Auth | `/players/log-in` | `--admin-*` | Light |

### Design Token Pipeline

1. **Define** in `variables.css` as `--wb-*` CSS custom properties
2. **Export** to Tailwind in `app.css` `@theme` block (e.g., `--color-wb-panel: var(--wb-panel)`)
3. **Use** in HEEx templates as Tailwind classes: `bg-wb-panel`, `text-wb-text-muted`, `border-wb-border`
4. **Use** in `app.css` custom CSS as: `var(--wb-panel)`, `var(--wb-text-muted)`

### Color Rules

- **NEVER hardcode hex colors.** Always use `--wb-*` variables or `wb-*` Tailwind classes.
- **Transparency:** ALWAYS use `color-mix(in srgb, var(--wb-color) N%, transparent)`. NEVER use `rgba()` with CSS variables (it doesn't work).
- **Adding new colors:** First check if an existing variable fits. If not, add to `variables.css` with `--wb-` prefix AND a corresponding `--color-wb-*` entry in the `app.css` `@theme` block.
- **No @apply with daisyUI** - use daisyUI classes directly in templates.

### CSS Variable Categories

| Prefix | Purpose |
|--------|---------|
| `--wb-bg/surface/panel` | Backgrounds (darkest to lightest) |
| `--wb-border*` | Borders (dark/normal/light) |
| `--wb-text-*` | Text (bright/normal/muted/dim/faint) |
| `--wb-accent-*` | Interactive/accent colors |
| `--wb-success/error/warning/info` | Status colors |
| `--wb-danger-*` / `--wb-success-*` | State surfaces with bg/border/text |
| `--wb-term-*` | Terminal panel |
| `--wb-chat-*` | Chat panel |
| `--wb-quest-*` | Quest flow graph nodes/edges |
| `--wb-log-*` | Console log levels |
| `--wb-indigo*` | Streaming/generation UI |
| `--wb-tool-*` | Tool execution UI |
| `--wb-viewport-*` | Canvas viewport (room/exit/grid colors) |

### Token Scales

**Font sizes:** `--wb-font-size-xs` (0.7rem) / `-sm` (0.78rem) / `-md` (0.8rem) / `-base` (0.85rem) / `-lg` (0.95rem) / `-xl` (1.05rem). Tailwind: `text-wb-xs` through `text-wb-xl`.

**Spacing:** `--wb-space-xs` (4px) / `-sm` (8px) / `-md` (12px) / `-lg` (16px). In HEEx, use Tailwind classes (`p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px). In `app.css` custom CSS, use `var(--wb-space-*)`. Never introduce oddball pixel values (5px, 6px, 10px) -- snap to the nearest token.

**Border radius:** `--wb-radius-sm` (3px) / `-md` (5px) / `-lg` (8px). Tailwind: `rounded-wb-sm/md/lg`.

**Fonts:** `--wb-font` (system sans-serif) / `--wb-font-mono` (SF Mono stack). Tailwind: `font-wb`, `font-wb-mono`.

**Z-index hierarchy:** `--wb-z-toolbar` (10) / `-panel` (20) / `-dropdown` (50) / `-modal` (100) / `-overlay` (1000).

**Shadows:** `--wb-shadow-sm/md/lg`. Tailwind: `shadow-wb-sm/md/lg`.

**Transitions:** `--wb-transition-fast` (0.15s ease) / `-normal` (0.2s ease).

### CSS File Organization

CSS is split into domain-specific modules for LLM digestibility (each file <300 lines ideal):

| File | Purpose |
|------|---------|
| `app.css` | Entry point with @import statements + daisyUI theme config |
| `tailwind-config.css` | @theme block, custom variants, LiveView loading states |
| `world-builder/layout.css` | Grid, panels, resize handles, collapsed states |
| `world-builder/terminal.css` | Terminal/console styles, connection indicators |
| `world-builder/chat.css` | Chat panel, messages, streaming, welcome state |
| `world-builder/editors.css` | Quest/cutscene/dialogue/script editor styles |
| `world-builder/modals.css` | Modal overlay, animations, settings, audit log |
| `world-builder/tools.css` | Tool execution UI, tool blocks, progress indicators |

### CSS Placement Rules

- **Admin dashboard:** Inline Tailwind + daisyUI only. No custom CSS classes.
- **World Builder:** Custom CSS in `world-builder/*.css` files for complex UI (pseudo-elements, gradients, scrollbars). Simple leaf components use inline Tailwind.
- **New CSS:** Add to the appropriate domain file. If >300 lines, consider splitting further.
- **CSS that MUST stay in CSS files:** pseudo-elements, animations/keyframes, scrollbar styles, JS-applied classes, CSS var grid layout, media queries.
- Don't duplicate CSS definitions. Search existing files first with `grep -r "selector-name" assets/css/`.
- **Never use duplicate `class` attributes** on the same element. In HEEx, only the last `class=` is applied -- others are silently dropped. Merge into a single `class={[...]}` list.

## LiveView Component Pattern

### Function Components

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

### Rules

- **HEEx `:if` directives only.** NEVER use ERB `<%= if %>` syntax.
- **No inline computation in `render/1`.** Cache results in assigns, update via helpers when source data changes.
- **Shared components** in `admin_live/components.ex` (badges, stat_cards, etc.).
- **`attr` declarations** on all function components for documentation and validation.
- **Conditional CSS classes:** Use `class={[...]}` list with boolean conditions: `@collapsed && "panel-collapsed"`.

### Event Handler Extraction

Large LiveView modules extract event handlers into `*_event_handler.ex` modules to reduce file size:

```
world_builder/
  git_event_handler.ex         # Git commit modal events
  script_template_event_handler.ex  # Template picker events
  cutscene_event_handler.ex    # Cutscene editor events
```

Each event handler module defines `handle_event/3` clauses and imports `Phoenix.Component` and `Phoenix.LiveView` as needed. The parent LiveView delegates to them.

## Panel System

### Grid Layout

The World Builder uses CSS Grid with `--grid-columns` custom property controlling column widths:

`hierarchy | h_resize | viewport | i_resize | inspector | t_resize | terminal | c_resize | chat`

Grid column indices: hierarchy=0, inspector=4, terminal=6, chat=8.

### Panel Configuration

Each panel has a `PANEL_CONFIG` entry in `panel_resize.js` defining `min`, `max`, `defaultSize`, and grid position. Panel sizes are stored in localStorage (`world-builder-panel-sizes`) and restored on mount.

### Collapsed State

Panel collapse is tracked in both:
- **localStorage** (`world_builder_collapsed_panels`) for persistence across sessions
- **LiveView assigns** for server-side rendering of collapsed/expanded content

Toggle via `phx-click="toggle_panel"` with `phx-value-panel="panelname"`.

## Build System

### esbuild

- **Target:** ES2022 modules with code splitting (`--splitting --format=esm`)
- **Entry point:** `assets/js/app.js`
- **Output:** `priv/static/assets/js/` with chunk hashing
- **Import alias:** `@/` maps to `assets/js/` (configured via `--alias:@=.` in `config/config.exs`)

### Tailwind v4

- Config in `app.css` (no `tailwind.config.js`)
- Sources: `@source "../css"`, `@source "../js"`, `@source "../../lib/loka_web"`
- Plugins: heroicons (`../vendor/heroicons`), daisyUI (`../vendor/daisyui`)
- daisyUI themes: dark (default, prefers-dark) and light

### Vendor Libraries

Third-party libraries go in `assets/vendor/`, NOT npm. Currently: heroicons, daisyui, daisyui-theme, topbar. CodeMirror is the exception -- it uses npm (`@codemirror/*` packages).

### Testing

- **Framework:** Vitest with Node environment (`assets/vitest.config.js`)
- **Location:** `assets/js/world_builder/__tests__/*.test.js`
- **Run:** `cd server/assets && npm test` (or `npm run test:watch`)
- **Mock pattern:** Mock `document`/`sessionStorage` for Node environment (see existing tests)
- **Browser globals:** Use `vi.stubGlobal('navigator', { platform: 'MacIntel' })` -- NOT `global.navigator = ...` (read-only in Node). Call `vi.unstubAllGlobals()` in `afterEach`.
- **Canvas2DViewport tests:** Mock canvas (`getContext`, `getBoundingClientRect`), stub `getComputedStyle`, `ResizeObserver`, `document.createElement`.
- **Floating point:** Use `toBeCloseTo(0)` not `toBe(0)` for computed coordinates -- `-(0) * 60` produces `-0`.

### Formatting

- **Prettier:** JS formatting checked by pre-commit (warn, not block). Run `cd server && npx prettier --write assets/js/` to fix.

## Storage Keys

**localStorage:**
- `world_builder_collapsed_panels` (world_builder.js)
- `world-builder-panel-sizes` (panel_resize.js)
- `{provider}_api_key_encoded` (multi_api_key_config.js)

**sessionStorage:**
- `world_builder_undo_stack` (UndoManager.js)

## Import Aliases

- `@/` maps to `assets/js/` (configured in esbuild via `--alias:@=.` in `server/config/config.exs`)
- Example: `import { HookHelper } from '@/world_builder/HookHelper.js'`

## JS Utilities

**HookHelper** (`HookHelper.js`): Auto-manages listener/observer/timer lifecycle. See Hook Architecture section above.

**KeyboardManager** (`KeyboardManager.js`): Centralized keyboard shortcuts. `mod` = Cmd/Ctrl. `skipInputs: true` skips input/textarea. First-match-wins. All keyboard commands should go through KeyboardManager, not inline `keydown` handlers (Canvas2D Shift key is an exception since it's interaction state, not a command).
```javascript
import { keyboardManager } from '@/world_builder/KeyboardManager.js'
keyboardManager.register('wb-save', 'mod+s', () => save(), { skipInputs: true })
// In destroyed(): keyboardManager.unregisterAll('wb-')
```

**Canvas2DViewport** (`Canvas2DViewport.js`): Reads colors from CSS variables at construction time with hardcoded fallbacks. Uses `this.exitColors`, `this.roomColors`, `this.viewportColors` instance properties. Never use hardcoded hex colors for themed elements.

## Hook <> LiveView Event Contract

| Hook | pushEvent (JS -> Server) | handleEvent (Server -> JS) |
|------|------------------------|--------------------------|
| **WorldBuilder** | `select_room`, `batch_select`, `validate_all`, `delete_room`, `batch_delete`, `duplicate_room`, `duplicate_entity`, `batch_clone`, `toggle_panel`, `create_room`, `show_commit_modal`, `toggle_zone_colors`, `toggle_npc_paths`, `show_keyboard_help`, `undo_state_changed` | `select_room`, `select_entity`, `set_z_level`, `init_world_builder`, `zone_colors_changed`, `npc_paths_changed`, `rooms_updated`, `room_created`, `room_updated`, `room_deleted`, `panel_collapsed`, `record_operation`, `begin_composite`, `end_composite`, `trigger_undo`, `trigger_redo` |
| **PanelResize** | `restore_panel_sizes`, `resize_panel` | -- |
| **MudTerminal** | _(Phoenix Channel, not LiveView)_ | -- |
| **ChatTextarea** | `send_message` | -- |
| **CodeMirrorEditor** | `script_source_changed` | -- |
| **MultiAPIKeyConfig** | `api_key_status`, `api_key_validated` | -- |
| **QuestFlowGraph** | -- | -- |
| **ConsoleOutput** | -- | `download_text` |
| **ScrollBottom** | -- | -- |

## CSS File Map

Styles are now split into domain-specific files. Here's where to find/add styles:

| File | What to add here |
|------|------------------|
| `tailwind-config.css` | @theme tokens, custom variants, LiveView loading states, a11y (skip-link) |
| `world-builder/layout.css` | Grid layout, panel structure, resize handles, collapsed states, scrollbars |
| `world-builder/terminal.css` | Terminal lines, connection dots, console overlay |
| `world-builder/chat.css` | Chat messages, welcome state, quick actions, input area, streaming UI |
| `world-builder/editors.css` | Quest/cutscene/dialogue/script editors, timeline, template picker |
| `world-builder/modals.css` | Modal overlay, settings, audit log, git commit, document viewer |
| `world-builder/tools.css` | Tool execution indicator, tool blocks, queue indicator |

## Adding a New World Builder Panel

1. Create `lib/loka_web/live/admin_live/world_builder/my_panel.ex` -- use `Phoenix.Component`, follow `terminal_panel.ex` as reference
2. Define component function with `collapsed` attr and conditional visibility
3. Add panel to the grid in `world_builder_live.ex` render function
4. Add a `PANEL_CONFIG` entry in `assets/js/hooks/panel_resize.js` with `min`, `max`, `default`, and `gridColumnIndex`
5. Add `handle_event("toggle_panel", ...)` clause or reuse existing toggle logic
6. If JS interactivity is needed: create a hook in `assets/js/hooks/`, register in `hooks/index.js`
7. Add any new CSS variables to `variables.css` with `--wb-` prefix, and corresponding `@theme` token in `app.css`

## Hook Decision Guide

When to create a new JS hook vs using built-in LiveView features:

| Scenario | Use Hook? | Alternative / Pattern |
|----------|-----------|----------------------|
| Auto-scroll to bottom | Yes | `ScrollBottom` pattern |
| Auto-resize textarea | Yes | `ChatTextarea` pattern |
| Complex canvas rendering | Yes | `Canvas2D*` pattern |
| Third-party library (CodeMirror, etc.) | Yes | `CodeMirrorEditor` pattern |
| Phoenix Channel connection | Yes | `MudTerminal` pattern |
| Panel resize drag | Yes | `PanelResize` pattern |
| Simple click handler | No | `phx-click` |
| Form submission | No | `phx-submit` |
| State sync with server | No | `pushEvent` / `handleEvent` |
| Loading states | No | `phx-disable-with`, loading classes |
| Keyboard shortcuts (simple) | No | `phx-key` |
| Keyboard shortcuts (complex) | Yes | `KeyboardManager` singleton |

## CSS Class Naming Convention

| Prefix | Scope | Examples |
|--------|-------|----------|
| `world-builder-*` | Top-level WB containers | `world-builder-container`, `world-builder-panel` |
| `panel-*` | Panel system | `panel-resize-handle`, `panel-collapsed`, `panel-content` |
| `chat-*` | Chat panel | `chat-message`, `chat-input-form`, `chat-welcome` |
| `quest-*` | Quest editor | `quest-node`, `quest-section`, `quest-input` |
| `cutscene-*` | Cutscene editor | `cutscene-timeline-*`, `cutscene-editor-lv` |
| `terminal-*` | MUD terminal | `terminal-line`, `term-connection-dot` |
| `tool-*` | Tool execution UI | `tool-use`, `tool-header`, `tool-result` |
| `modal-*` | Modal dialogs | `modal-overlay`, `modal-content`, `modal-fullscreen` |
| `validation-*` | Validation display | `validation-error`, `validation-warning` |

## Quick Color Reference

Most commonly used design tokens:

| Use Case | CSS Variable | Tailwind Class |
|----------|--------------|----------------|
| Panel background | `var(--wb-panel)` | `bg-wb-panel` |
| Darker panel background | `var(--wb-panel-alt)` | `bg-wb-panel-alt` |
| Input background | `var(--wb-input)` | `bg-wb-input` |
| Main text | `var(--wb-text)` | `text-wb-text` |
| Bright text (headings) | `var(--wb-text-bright)` | `text-wb-text-bright` |
| Muted text (labels) | `var(--wb-text-muted)` | `text-wb-text-muted` |
| Dim text (secondary) | `var(--wb-text-dim)` | `text-wb-text-dim` |
| Faint text (hints) | `var(--wb-text-faint)` | `text-wb-text-faint` |
| Default border | `var(--wb-border)` | `border-wb-border` |
| Light border | `var(--wb-border-light)` | `border-wb-border-light` |
| Accent/interactive | `var(--wb-accent)` | `text-wb-accent` / `bg-wb-accent` |
| Success state | `var(--wb-success)` | `text-wb-success` |
| Error state | `var(--wb-error)` | `text-wb-error` |
| Warning state | `var(--wb-warning)` | `text-wb-warning` |
| Info state | `var(--wb-info)` | `text-wb-info` |

## JS Utilities Quick Reference

| Utility | Import | Purpose |
|---------|--------|---------|
| `HookHelper` | `@/world_builder/HookHelper.js` | Auto-cleanup for listeners/observers/timers |
| `KeyboardManager` | `@/world_builder/KeyboardManager.js` | Centralized keyboard shortcuts |
| `UndoManager` | `@/world_builder/UndoManager.js` | Undo/redo stack with persistence |
| `Canvas2DViewport` | `@/world_builder/Canvas2DViewport.js` | 2D canvas viewport orchestrator |
| `Canvas2DRenderer` | `@/world_builder/Canvas2DRenderer.js` | Canvas drawing operations |
| `Canvas2DInteraction` | `@/world_builder/Canvas2DInteraction.js` | Mouse/keyboard interaction |
| `constants` | `@/world_builder/constants.js` | Shared fallback values for canvas/testing |

## Error Handling in Hooks

All hooks should wrap `mounted()` in a try-catch for defensive error handling:

```javascript
mounted() {
  try {
    this.helper = new HookHelper(this)
    // ... rest of initialization
  } catch (err) {
    console.error('[HookName] Failed to initialize:', err)
  }
}
```

Add null checks for DOM queries:
```javascript
this.inputEl = this.el.querySelector('.input')
if (!this.inputEl) {
  console.warn('[HookName] Required element .input not found')
  return
}
```

## Related Skills

- `.claude/skills/liveview-local-interaction-pattern.md` - Drag/resize without server roundtrips
- `.claude/skills/liveview-modal-event-pattern.md` - Modal event delegation patterns
