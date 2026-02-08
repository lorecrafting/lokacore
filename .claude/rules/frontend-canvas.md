---
paths: ["assets/js/world_builder/**"]
---

# Canvas & JS Utilities Guide

Auto-loads when working in `assets/js/world_builder/`.

## Canvas2D System Architecture

```
+-----------------------------------------------------------------------+
|                         Canvas2DViewport                               |
|  Orchestrator: manages canvas, coordinates renderer + interaction      |
|  - Reads CSS vars for colors at construction time                      |
|  - Handles room/entity data from LiveView                              |
+-----------------------------------+-----------------------------------+
                                    | delegates to
                    +---------------+---------------+
                    v                               v
        +---------------------+           +---------------------+
        |  Canvas2DRenderer   |           | Canvas2DInteraction |
        |  Drawing operations |           |  Mouse/keyboard     |
        |  - drawRoom()       |           |  - Pan/zoom         |
        |  - drawExit()       |           |  - Selection        |
        |  - drawGrid()       |           |  - Drag operations  |
        +---------------------+           +---------------------+
```

**Canvas2DViewport** reads colors from CSS variables at construction time with hardcoded fallbacks. Uses `this.exitColors`, `this.roomColors`, `this.viewportColors` instance properties. Never use hardcoded hex colors for themed elements.

## JS Utilities Quick Reference

| Utility | Import | Purpose |
|---------|--------|---------|
| `HookHelper` | `@/world_builder/HookHelper.js` | Auto-cleanup for listeners/observers/timers |
| `KeyboardManager` | `@/world_builder/KeyboardManager.js` | Centralized keyboard shortcuts |
| `UndoManager` | `@/world_builder/UndoManager.js` | Undo/redo stack with persistence |
| `STORAGE_KEYS` | `@/world_builder/storageKeys.js` | Centralized localStorage/sessionStorage keys |
| `Canvas2DViewport` | `@/world_builder/Canvas2DViewport.js` | 2D canvas viewport orchestrator |
| `Canvas2DRenderer` | `@/world_builder/Canvas2DRenderer.js` | Canvas drawing operations |
| `Canvas2DInteraction` | `@/world_builder/Canvas2DInteraction.js` | Mouse/keyboard interaction |
| `constants` | `@/world_builder/constants.js` | Shared fallback values for canvas/testing |

## KeyboardManager

Centralized keyboard shortcuts. `mod` = Cmd/Ctrl. `skipInputs: true` skips input/textarea. First-match-wins. All keyboard commands should go through KeyboardManager, not inline `keydown` handlers (Canvas2D Shift key is an exception since it's interaction state, not a command).

```javascript
import { keyboardManager } from '@/world_builder/KeyboardManager.js'
keyboardManager.register('wb-save', 'mod+s', () => save(), { skipInputs: true })
// In destroyed(): keyboardManager.unregisterAll('wb-')
```

## Storage Keys

All storage keys are defined in `assets/js/world_builder/storageKeys.js` for single source of truth:

```javascript
import { STORAGE_KEYS } from '@/world_builder/storageKeys.js'
localStorage.getItem(STORAGE_KEYS.PANEL_SIZES)
```

**localStorage:**
- `STORAGE_KEYS.PANEL_SIZES` = `'world_builder_panel_sizes'`
- `STORAGE_KEYS.COLLAPSED_PANELS` = `'world_builder_collapsed_panels'`
- `{provider}${STORAGE_KEYS.API_KEY_SUFFIX}` = `'{provider}_api_key_encoded'`

**sessionStorage:**
- `STORAGE_KEYS.UNDO_STACK` = `'world_builder_undo_stack'`

All storage keys use snake_case.

## Import Aliases

- `@/` maps to `assets/js/` (configured in esbuild via `--alias:@=.` in `server/config/config.exs`)
- Example: `import { HookHelper } from '@/world_builder/HookHelper.js'`

## Testing

- **Framework:** Vitest with Node environment (`assets/vitest.config.js`)
- **Location:** `assets/js/world_builder/__tests__/*.test.js`
- **Run:** `cd server/assets && npm test` (or `npm run test:watch`)
- **Mock pattern:** Mock `document`/`sessionStorage` for Node environment
- **Browser globals:** Use `vi.stubGlobal('navigator', { platform: 'MacIntel' })` -- NOT `global.navigator = ...` (read-only in Node). Call `vi.unstubAllGlobals()` in `afterEach`.
- **Canvas2DViewport tests:** Mock canvas (`getContext`, `getBoundingClientRect`), stub `getComputedStyle`, `ResizeObserver`, `document.createElement`.
- **Floating point:** Use `toBeCloseTo(0)` not `toBe(0)` for computed coordinates -- `-(0) * 60` produces `-0`.
- **Property setters:** When mocking setters with `Object.defineProperty`, wrap arrow functions in braces to avoid `no-setter-return` errors:
  ```javascript
  // WRONG - implicit return triggers ESLint error
  Object.defineProperty(ctx, 'fillStyle', { set: (v) => styles.push(v) })

  // CORRECT - no return value
  Object.defineProperty(ctx, 'fillStyle', { set: (v) => { styles.push(v) } })
  ```

## ESLint Accepted Warnings

The following ESLint warnings are accepted by design and should NOT be "fixed":

- **`max-params` in Canvas2D functions:** `drawExitArrow`, `drawEntityIndicators`, `drawVerticalExitIndicators`, `roundRect`, `calculateControlPoints`, `findBestCurveDirection` all have 5-7 parameters. This is intentional - canvas rendering functions need (ctx, state, room, x, y, halfSize) or similar. Refactoring to options objects would hurt readability for these hot-path functions.
