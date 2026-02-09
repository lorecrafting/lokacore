# Phoenix LiveView Hooks

All hooks follow the **HookHelper pattern** for automatic lifecycle management of event listeners, observers, and timers.

## Quick Start

```javascript
import { HookHelper } from './HookHelper.js'

const MyHook = {
  mounted() {
    this.helper = new HookHelper(this)
    // Add listeners - auto-removed on destroy
    this.helper.on(window, 'resize', this.onResize.bind(this))
    this.helper.observe(new ResizeObserver(cb), this.el)
    this.helper.interval(() => this.poll(), 5000)
  },

  updated() {
    // Refresh DOM refs that may have been replaced by LiveView patches
    // Do NOT re-add listeners (HookHelper persists them)
    this.inputEl = this.el.querySelector('.input')
  },

  destroyed() {
    // Single cleanup call handles everything
    this.helper.destroy()
  }
}

export default MyHook
```

## Adding a New Hook

1. **Create file**: `assets/js/hooks/{snake_case}.js`
2. **Register**: Add to `assets/js/hooks/index.js`
3. **Use in template**: `<div phx-hook="MyHook">`

## Hook Conventions

| Rule | Example |
|------|---------|
| Console logging | `console.log('[MyHook] message')` with hook name prefix |
| DOM scoping | `this.el.querySelector()` not `document.querySelector()` |
| State storage | `this.someState` on the hook instance |
| Event to server | `this.pushEvent('event_name', {data})` |
| Event from server | `this.handleEvent('event_name', callback)` |

## Existing Hooks

| Hook | Purpose |
|------|---------|
| `ScrollBottom` | Auto-scroll container to bottom on updates |
| `ChatTextarea` | Auto-expanding textarea for chat input |
| `MultiAPIKeyConfig` | API key management UI with validation |
| `MudTerminal` | Phoenix Channel connection for game terminal |
| `ConsoleOutput` | Console log output display with download |

## HookHelper API

```javascript
// Add event listener (auto-removed on destroy)
this.helper.on(target, 'event', handler, options)

// Observe element with ResizeObserver/MutationObserver (auto-disconnected)
this.helper.observe(observer, element)

// Create interval (auto-cleared on destroy)
const id = this.helper.interval(fn, ms)

// Clean up everything
this.helper.destroy()
```

## Related Documentation

- Full frontend conventions: `.claude/rules/frontend.md`
- HookHelper source: `assets/js/hooks/HookHelper.js`
- Hook tests: `assets/js/hooks/__tests__/`
