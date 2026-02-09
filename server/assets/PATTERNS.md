# Frontend Patterns Quick Reference

Quick-reference patterns for common frontend operations. For comprehensive documentation, see `.claude/rules/frontend.md`.

## Adding a New Design Token

1. Add to `css/variables.css` with `--wb-` prefix:
   ```css
   --wb-my-color: #hexvalue;
   ```

2. Add corresponding entry in `css/tailwind-config.css` `@theme` block:
   ```css
   --color-wb-my-color: var(--wb-my-color);
   ```

3. Use in templates: `bg-wb-my-color`, `text-wb-my-color`, `border-wb-my-color`
4. Use in CSS: `var(--wb-my-color)`

**Never hardcode hex colors in CSS or templates.**

## Adding a New LiveView Hook

1. Create `js/hooks/{snake_case}.js`:
   ```javascript
   import { HookHelper } from './HookHelper.js'

   const MyHook = {
     mounted() {
       try {
         this.helper = new HookHelper(this)
         // Add listeners via this.helper.on()
       } catch (err) {
         console.error('[MyHook] Failed to initialize:', err)
       }
     },
     updated() {
       // Refresh DOM refs only - listeners persist via HookHelper
     },
     destroyed() {
       this.helper.destroy()
     }
   }

   export default MyHook
   ```

2. Register in `js/hooks/index.js`:
   ```javascript
   import MyHook from './my_hook.js'
   const Hooks = { ..., MyHook }
   ```

3. Use in HEEx: `<div phx-hook="MyHook" id="unique-id">`

## Adding a New CSS File

1. Create `css/builder/{domain}.css`
2. Add file header comment explaining purpose and key selectors
3. Add import to `css/app.css`:
   ```css
   @import "./builder/{domain}.css";
   ```
4. Keep file under 400 lines

## Panel Resize Pattern (No Server Roundtrip)

For drag operations, apply CSS locally and sync on mouseup:

```javascript
// In mousemove - local only, no server
this.el.style.setProperty('--grid-columns', newValue)

// In mouseup - sync final state
this.pushEvent('resize_panel', { panel, size })
```

## Console Logging Pattern

Always prefix with hook/class name:

```javascript
console.log('[MyHook] Connected')
console.error('[MyHook] Failed:', error)
console.warn('[MyHook] Deprecated usage')
```

## CSS Transparency Pattern

Use `color-mix()` for transparency, never `rgba()` with CSS variables:

```css
/* CORRECT */
background: color-mix(in srgb, var(--wb-accent) 20%, transparent);

/* WRONG - doesn't work with CSS variables */
background: rgba(var(--wb-accent), 0.2);
```

**Exception:** Shadow definitions use `rgba()` because `box-shadow` needs actual colors.

## Error Handling in Hooks

Wrap mounted() in try-catch, add null checks for DOM:

```javascript
mounted() {
  try {
    this.helper = new HookHelper(this)
    this.inputEl = this.el.querySelector('.input')
    if (!this.inputEl) {
      console.warn('[MyHook] Required element .input not found')
      return
    }
    // ... rest of init
  } catch (err) {
    console.error('[MyHook] Failed to initialize:', err)
  }
}
```

## Common Mistakes to Avoid

| Mistake | Why Wrong | Correct |
|---------|-----------|---------|
| `rgba()` with CSS vars | Doesn't work | `color-mix()` |
| Listeners in `updated()` | Creates duplicates | HookHelper in `mounted()` |
| Global `document.querySelector` | Wrong element in multi-instance | `this.el.querySelector()` |
| Raw pixel values in CSS | Inconsistent | `var(--wb-space-*)` tokens |
| Multiple `class=` attrs in HEEx | Only last applies | Single `class={[...]}` |
