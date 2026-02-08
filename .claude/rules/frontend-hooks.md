---
paths: ["assets/js/hooks/**"]
---

# JS Hook Development Guide

Auto-loads when working in `assets/js/hooks/`.

## HookHelper (Required)

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

## Hook File Conventions

- **File naming:** `assets/js/hooks/{snake_case}.js` (e.g., `mud_terminal.js`, `panel_resize.js`)
- **Class naming:** CamelCase matching `phx-hook="HookName"` (e.g., `MudTerminal`, `PanelResize`)
- **Utility classes:** `assets/js/world_builder/{CamelCase}.js` (e.g., `HookHelper.js`, `KeyboardManager.js`)
- **Registration:** Every hook must be imported and added to the `Hooks` object in `assets/js/hooks/index.js`
- **Never** add hooks inline in `app.js`

## Hook Lifecycle

| Phase | Purpose |
|-------|---------|
| `mounted()` | Create HookHelper, bind event listeners, initialize state on `this.*` |
| `updated()` | Refresh DOM refs that may have changed after LiveView patch. Do NOT re-add listeners (HookHelper handles this) |
| `destroyed()` | Call `this.helper.destroy()`. Clean up any non-HookHelper resources (channels, etc.) |

```
    mounted()                    updated()                  destroyed()
        |                            |                           |
        v                            v                           v
+-------------------+      +-------------------+      +-------------------+
| new HookHelper()  |      | Refresh DOM refs  |      | helper.destroy()  |
| Bind listeners    |      | (listeners persist|      | Remove listeners  |
| Initialize state  |      |  across patches)  |      | Disconnect obs    |
| Setup observers   |      |                   |      | Clear intervals   |
+-------------------+      +-------------------+      +-------------------+
```

## Hook Rules

- **Console logging:** Use `[HookName]` prefix (e.g., `console.log('[MudTerminal] connected')`). No bare `console.log()`.
- **Hook state:** Store on `this.*` (e.g., `this.channel`, `this.resizeObserver`).
- **DOM scoping:** Scope queries to the hook's container, not `document`. Use `this.el.closest('.container') || this.el.parentElement` then `.querySelector()`.
- **Continuous interactions** (drag/resize/scroll): Apply CSS locally via `requestAnimationFrame`, sync to server on mouseup/blur only. Never `pushEvent` in mousemove handlers. See `.claude/skills/liveview-local-interaction-pattern.md`.

## Error Handling

All hooks should wrap `mounted()` in a try-catch:

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

## Current Hooks (9 total)

`ScrollBottom`, `WorldBuilder`, `PanelResize`, `ChatTextarea`, `MultiAPIKeyConfig`, `CodeMirrorEditor`, `MudTerminal`, `ConsoleOutput`, `QuestFlowGraph`

## Hook Decision Guide

| Scenario | Use Hook? | Pattern |
|----------|-----------|---------|
| Auto-scroll to bottom | Yes | `ScrollBottom` |
| Auto-resize textarea | Yes | `ChatTextarea` |
| Complex canvas rendering | Yes | `Canvas2D*` |
| Third-party library (CodeMirror) | Yes | `CodeMirrorEditor` |
| Phoenix Channel connection | Yes | `MudTerminal` |
| Panel resize drag | Yes | `PanelResize` |
| Simple click handler | No | `phx-click` |
| Form submission | No | `phx-submit` |
| Loading states | No | `phx-disable-with` |
| Keyboard shortcuts (complex) | Yes | `KeyboardManager` singleton |

## Hook <> LiveView Event Contract

| Hook | pushEvent (JS -> Server) | handleEvent (Server -> JS) |
|------|------------------------|--------------------------|
| **WorldBuilder** | `select_room`, `batch_select`, `validate_all`, `delete_room`, `batch_delete`, `duplicate_room`, `duplicate_entity`, `batch_clone`, `toggle_panel`, `create_room`, `show_commit_modal`, `toggle_zone_colors`, `toggle_npc_paths`, `show_keyboard_help`, `undo_state_changed` | `select_room`, `select_entity`, `set_z_level`, `init_world_builder`, `zone_colors_changed`, `npc_paths_changed`, `rooms_updated`, `room_created`, `room_updated`, `room_deleted`, `panel_collapsed`, `record_operation`, `begin_composite`, `end_composite`, `trigger_undo`, `trigger_redo` |
| **PanelResize** | `restore_panel_sizes`, `resize_panel` | -- |
| **MudTerminal** | _(Phoenix Channel)_ | -- |
| **ChatTextarea** | `send_message` | -- |
| **CodeMirrorEditor** | `script_source_changed` | -- |
| **MultiAPIKeyConfig** | `api_key_status`, `api_key_validated` | -- |
| **QuestFlowGraph** | -- | -- |
| **ConsoleOutput** | -- | `download_text` |
| **ScrollBottom** | -- | -- |
