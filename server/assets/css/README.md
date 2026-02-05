# CSS Architecture

## File Structure

| File | Purpose |
|------|---------|
| `app.css` | Entry point - imports all CSS modules, configures Tailwind plugins |
| `variables.css` | Design tokens (`--wb-*` for World Builder, `--admin-*` for auth) |
| `tailwind-config.css` | `@theme` block exporting tokens to Tailwind, custom variants |
| `admin-auth.css` | Login/auth pages (light theme, serif typography) |
| `world-builder/*.css` | Domain-specific World Builder styles (dark theme) |

### World Builder CSS Modules

| File | What goes here |
|------|----------------|
| `layout.css` | Grid layout, panel structure, resize handles, collapsed states |
| `terminal.css` | Terminal lines, connection indicator, console overlay |
| `chat.css` | Chat messages, welcome state, quick actions, streaming UI |
| `editors.css` | Quest/cutscene/dialogue/script editor styles |
| `modals.css` | Modal overlay, settings, audit log, git commit |
| `tools.css` | Tool execution indicator, tool blocks, queue display |

## Two Independent Themes

| Theme | Scope | Prefix | Style |
|-------|-------|--------|-------|
| World Builder | `/admin/world-builder` | `--wb-*` | Dark, 220+ tokens |
| Admin Auth | `/players/log-in` | `--admin-*` | Light, serif |

## Adding a New Color

1. **Define** in `variables.css`:
   ```css
   :root {
     --wb-mycolor: #123456;
   }
   ```

2. **Export** in `tailwind-config.css` `@theme` block:
   ```css
   @theme {
     --color-wb-mycolor: var(--wb-mycolor);
   }
   ```

3. **Use** in templates:
   ```html
   <div class="bg-wb-mycolor text-wb-mycolor border-wb-mycolor">
   ```

4. **Use** in CSS files:
   ```css
   .my-class {
     background: var(--wb-mycolor);
   }
   ```

## Transparency with CSS Variables

CSS variables don't work inside `rgba()`. Use `color-mix()` instead:

```css
/* WRONG - doesn't work */
background: rgba(var(--wb-accent), 0.5);

/* RIGHT - use color-mix */
background: color-mix(in srgb, var(--wb-accent) 50%, transparent);
```

## CSS Variable Categories

| Prefix | Purpose |
|--------|---------|
| `--wb-bg/surface/panel` | Backgrounds (darkest to lightest) |
| `--wb-border*` | Borders (dark/normal/light) |
| `--wb-text-*` | Text (bright/normal/muted/dim/faint) |
| `--wb-accent-*` | Interactive/accent colors |
| `--wb-success/error/warning/info` | Status colors |
| `--wb-shadow-*` | Box shadows (sm/md/lg/accent/overlay) |
| `--wb-term-*` | Terminal panel |
| `--wb-chat-*` | Chat panel |
| `--wb-quest-*` | Quest flow graph |
| `--wb-tool-*` | Tool execution UI |

## Font Size Scale

Use t-shirt sizes: `xs` < `sm` < `base` (normal) < `lg` < `xl`

| Token | Size | Tailwind |
|-------|------|----------|
| `--wb-font-size-xs` | 0.7rem | `text-wb-xs` |
| `--wb-font-size-sm` | 0.78rem | `text-wb-sm` |
| `--wb-font-size-base` | 0.85rem | `text-wb-base` |
| `--wb-font-size-lg` | 0.95rem | `text-wb-lg` |
| `--wb-font-size-xl` | 1.05rem | `text-wb-xl` |

## daisyUI Restriction

**Never use `@apply` with daisyUI component classes.** They only work directly in HTML:

```css
/* WRONG */
.my-button { @apply btn btn-primary; }

/* RIGHT - use in template */
<button class="btn btn-primary">
```

`@apply` works only with Tailwind utilities: `flex`, `p-4`, `text-sm`, `bg-base-200`, etc.

## Related Documentation

- Full frontend conventions: `.claude/rules/frontend.md`
- Design tokens source: `assets/css/variables.css`
- Tailwind config: `assets/css/tailwind-config.css`
- Constants fallbacks: `assets/js/world_builder/constants.js`
