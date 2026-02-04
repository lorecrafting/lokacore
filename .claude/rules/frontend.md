---
paths: ["assets/**"]
---

# Frontend Development Context

This context auto-loads when working in `assets/`.

## File Organization

| Category | Location |
|----------|----------|
| CSS variables | `assets/css/variables.css` (WB design tokens) |
| Auth CSS | `assets/css/ebook-auth.css` |
| Main CSS | `assets/css/app.css` (Tailwind + WB custom CSS) |
| JS hooks | `assets/js/hooks/*.js` (one per hook, re-exported in `index.js`) |
| JS utilities | `assets/js/world_builder/*.js` (HookHelper, KeyboardManager) |
| Entry point | `assets/js/app.js` |

## CSS Rules

- **Admin dashboard**: Inline Tailwind + daisyUI only. No custom CSS classes.
- **World Builder**: Custom CSS in `app.css` for complex UI (pseudo-elements, gradients, scrollbars). Simple leaf components use inline Tailwind.
- **Colors**: Use `@theme` classes in templates (`bg-wb-panel`, `text-wb-text-muted`). Use `var(--wb-*)` in `app.css`. **NEVER hardcode hex colors.**
- **Design tokens**: `var(--wb-radius-sm/md/lg)`, `var(--wb-font-size-xs/sm/base/lg)`, `var(--wb-font/font-mono)`
- **Z-index hierarchy**: toolbar=10, panel=20, dropdown=50, modal=100, overlay=1000
- **No @apply with daisyUI** - use classes directly in templates.
- Don't duplicate CSS definitions. Search for existing selectors first.
- **Never use duplicate `class` attributes** on the same element. In HEEx, only the last `class=` is applied - others are silently dropped. Merge into a single `class={[...]}` list.

### CSS Variable Prefixes (variables.css)

`--wb-bg/surface/panel` (backgrounds), `--wb-border` (borders), `--wb-text-*` (text), `--wb-accent-*` (interactive), `--wb-success/error/warning/info` (status), `--wb-danger-*`/`--wb-success-*` (state surfaces), `--wb-quest-*` (flow graph), `--wb-log-*` (console), `--wb-chat-*` (chat), `--wb-indigo*` (streaming), `--wb-term-*` (terminal).

When adding a new color, first check if an existing variable fits. If not, add to `variables.css` and a corresponding `@theme` token in `app.css`.

## JS Hook Rules

- **New hooks**: Create `assets/js/hooks/my_hook.js`, add to `index.js`. Never add hooks inline in `app.js`.
- **Cleanup**: Always implement `destroyed()` to clean up listeners, timers, observers. Store bound handlers as `this.*`.
- **Console logging**: Use `[HookName]` prefix (e.g., `console.log('[MudTerminal] connected')`). No bare `console.log()`.
- **Event listeners**: Add in `mounted()`, remove in `destroyed()`. Use event delegation for dynamic DOM.
- **Hook state**: Store on `this.*` (e.g., `this.channel`, `this.resizeObserver`).
- **Continuous interactions** (drag/resize/scroll): Apply CSS locally via `requestAnimationFrame`, sync to server on mouseup/blur only. Never `pushEvent` in mousemove handlers. See `.claude/skills/liveview-local-interaction-pattern.md`.

## JS Utilities

**HookHelper** (`HookHelper.js`): Auto-manages listener/observer/timer lifecycle. Use in hooks to prevent memory leaks.
```javascript
import { HookHelper } from '../world_builder/HookHelper.js'
this.helper = new HookHelper(this)
this.helper.on(window, 'resize', handler)  // Auto-removes in destroy()
this.helper.observe(resizeObserver, el)     // Auto-disconnects
this.helper.interval(fn, 5000)              // Auto-clears
// In destroyed(): this.helper.destroy()
```

**KeyboardManager** (`KeyboardManager.js`): Centralized keyboard shortcuts. `mod` = Cmd/Ctrl. `skipInputs: true` skips input/textarea. First-match-wins.
```javascript
import { keyboardManager } from '../world_builder/KeyboardManager.js'
keyboardManager.register('wb-save', 'mod+s', () => save(), { skipInputs: true })
// In destroyed(): keyboardManager.unregisterAll('wb-')
```

## Related Skills

- `.claude/skills/liveview-local-interaction-pattern.md` - Drag/resize without server roundtrips
- `.claude/skills/liveview-modal-event-pattern.md` - Modal event delegation patterns
