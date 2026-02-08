# Frontend Pre-Submit Checklist

Quick verification before committing frontend changes.

## Required

- [ ] `npm run check` passes (lint + format + tests)
- [ ] No new ESLint errors (warnings OK temporarily)

## CSS Changes

- [ ] Uses `--wb-*` design tokens only (no hex colors)
- [ ] Uses `var(--wb-space-*)` for spacing (no raw px values)
- [ ] File stays under 400 lines
- [ ] Added to `app.css` imports if new file

## JS Hook Changes

- [ ] Uses `HookHelper` for listeners/observers/timers
- [ ] Calls `this.helper.destroy()` in `destroyed()`
- [ ] Has try/catch in `mounted()`
- [ ] Null checks for DOM queries
- [ ] Console logs prefixed with `[HookName]`
- [ ] Registered in `hooks/index.js` if new hook

## Storage Keys

- [ ] Imported from `storageKeys.js` (no hardcoded keys)

## HEEx Templates

- [ ] Uses `:if` directive (not `<%= if %>`)
- [ ] Single `class={[...]}` attribute (no duplicates)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `rgba(var(--wb-color), 0.5)` | `color-mix(in srgb, var(--wb-color) 50%, transparent)` |
| `document.querySelector(...)` globally | `this.el.querySelector(...)` |
| Listeners in `updated()` | Move to `mounted()` with HookHelper |
| Multiple `class=` on element | Merge into single `class={[...]}` |
| Raw pixel values in CSS | Use `var(--wb-space-*)` tokens |

## Quick Commands

```bash
npm run check      # Full validation
npm run lint:fix   # Auto-fix lint issues
npm run format     # Auto-fix formatting
```
