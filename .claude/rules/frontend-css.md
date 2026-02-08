---
paths: ["assets/css/**"]
---

# CSS & Design Token Guide

Auto-loads when working in `assets/css/`.

## Two Independent Themes

| Theme | Scope | Prefix | Style |
|-------|-------|--------|-------|
| World Builder | `/admin/world-builder` | `--wb-*` | Dark (223+ variables) |
| Admin Auth | `/players/log-in` | `--admin-*` | Light |

## Design Token Pipeline

1. **Define** in `variables.css` as `--wb-*` CSS custom properties
2. **Export** to Tailwind in `app.css` `@theme` block (e.g., `--color-wb-panel: var(--wb-panel)`)
3. **Use** in HEEx templates as Tailwind classes: `bg-wb-panel`, `text-wb-text-muted`, `border-wb-border`
4. **Use** in `app.css` custom CSS as: `var(--wb-panel)`, `var(--wb-text-muted)`

```
+---------------------+    +----------------------+    +-----------------+
|    variables.css    |--->|  tailwind-config.css |--->|   HEEx / CSS    |
|  --wb-panel: #1a1a  |    |  @theme {             |    |  bg-wb-panel    |
|  --wb-text: #e5e5   |    |    --color-wb-panel   |    |  var(--wb-panel)|
+---------------------+    +----------------------+    +-----------------+
     Define tokens          Export to Tailwind          Use in templates
```

## Color Rules

- **NEVER hardcode hex colors.** Always use `--wb-*` variables or `wb-*` Tailwind classes.
- **Transparency:** ALWAYS use `color-mix(in srgb, var(--wb-color) N%, transparent)`. NEVER use `rgba()` with CSS variables (it doesn't work). **Exception:** Shadow definitions in `variables.css` use `rgba()` because `box-shadow` requires actual color values.
- **Adding new colors:** First check if an existing variable fits. If not, add to `variables.css` with `--wb-` prefix AND a corresponding `--color-wb-*` entry in the `app.css` `@theme` block.
- **No @apply with daisyUI** - use daisyUI classes directly in templates.

## CSS Variable Categories

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

## Token Scales

**Font sizes:** `--wb-font-size-xs` (0.7rem) / `-sm` (0.78rem) / `-md` (0.8rem) / `-base` (0.85rem) / `-lg` (0.95rem) / `-xl` (1.05rem). Tailwind: `text-wb-xs` through `text-wb-xl`.

**Spacing:** `--wb-space-xs` (4px) / `-sm` (8px) / `-md` (12px) / `-lg` (16px) / `-xl` (24px) / `-2xl` (32px) / `-3xl` (40px). In HEEx, use Tailwind classes. In `app.css` custom CSS, use `var(--wb-space-*)`. Never introduce oddball pixel values (5px, 6px, 10px) -- snap to the nearest token.

| Pixels | CSS Variable | Tailwind Class |
|--------|--------------|----------------|
| 4px | `var(--wb-space-xs)` | `p-1`, `gap-1`, `m-1` |
| 8px | `var(--wb-space-sm)` | `p-2`, `gap-2`, `m-2` |
| 12px | `var(--wb-space-md)` | `p-3`, `gap-3`, `m-3` |
| 16px | `var(--wb-space-lg)` | `p-4`, `gap-4`, `m-4` |
| 24px | `var(--wb-space-xl)` | `p-6`, `gap-6`, `m-6` |
| 32px | `var(--wb-space-2xl)` | `p-8`, `gap-8`, `m-8` |
| 40px | `var(--wb-space-3xl)` | `p-10`, `gap-10`, `m-10` |

```css
/* BAD - raw pixel values */
padding: 8px;
gap: 4px;

/* GOOD - design tokens */
padding: var(--wb-space-sm);
gap: var(--wb-space-xs);
```

**Border radius:** `--wb-radius-sm` (3px) / `-md` (5px) / `-lg` (8px). Tailwind: `rounded-wb-sm/md/lg`.

**Fonts:** `--wb-font` (system sans-serif) / `--wb-font-mono` (SF Mono stack). Tailwind: `font-wb`, `font-wb-mono`.

**Z-index hierarchy:** `--wb-z-toolbar` (10) / `-panel` (20) / `-dropdown` (50) / `-modal` (100) / `-overlay` (1000).

**Shadows:** `--wb-shadow-sm/md/lg`. Tailwind: `shadow-wb-sm/md/lg`.

**Transitions:** `--wb-transition-fast` (0.15s ease) / `-normal` (0.2s ease).

## CSS File Organization

CSS is split into domain-specific modules (each file <400 lines):

| File | Purpose |
|------|---------|
| `app.css` | Entry point with @import statements + daisyUI theme config |
| `tailwind-config.css` | @theme block, custom variants, LiveView loading states |
| `world-builder/layout.css` | Grid, panels, resize handles, collapsed states |
| `world-builder/terminal.css` | Terminal/console styles, connection indicators |
| `world-builder/chat.css` | Chat panel, messages, streaming, welcome state |
| `world-builder/quest-editor.css` | Quest editor forms, sections, validation |
| `world-builder/cutscene-editor.css` | Cutscene timeline, keyframes, preview |
| `world-builder/dialogue-editor.css` | Dialogue tree, node editor, mock state |
| `world-builder/template-picker.css` | Template picker modal, config forms |
| `world-builder/modals.css` | Modal overlay, animations, settings, audit log |
| `world-builder/tools.css` | Tool execution UI, tool blocks, progress indicators |

**File size limit:** Keep individual CSS files under 400 lines. When exceeded, extract logical sections to new files and update imports in `app.css`.

## Placement Rules

- **Admin dashboard:** Inline Tailwind + daisyUI only. No custom CSS classes.
- **World Builder:** Custom CSS in `world-builder/*.css` for complex UI (pseudo-elements, gradients, scrollbars). Simple leaf components use inline Tailwind.
- **CSS that MUST stay in CSS files:** pseudo-elements, animations/keyframes, scrollbar styles, JS-applied classes, CSS var grid layout, media queries.
- Don't duplicate CSS definitions. Search existing files first with `grep -r "selector-name" assets/css/`.
- **Never use duplicate `class` attributes** on the same element. In HEEx, only the last `class=` is applied.

## Custom CSS vs Tailwind Decision

| Use Case | Where | Why |
|----------|-------|-----|
| Layout, spacing, colors | **Tailwind in HEEx** | Fast iteration, co-located with markup |
| Pseudo-elements (`::before`, `::after`) | **CSS file** | Tailwind can't set `content` |
| Animations/keyframes | **CSS file** | `@keyframes` not expressible in Tailwind |
| Scrollbar styling | **CSS file** | Vendor prefixes |
| CSS Grid with custom properties | **CSS file** | `--grid-columns` pattern |

**Rule of thumb:** If it can be a single Tailwind class, use Tailwind. If it needs `::`, `@keyframes`, or `var(--custom)`, use CSS.

## CSS Class Naming Convention

| Prefix | Scope | Examples |
|--------|-------|----------|
| `world-builder-*` | Top-level WB containers | `world-builder-container`, `world-builder-panel` |
| `panel-*` | Panel system | `panel-resize-handle`, `panel-collapsed` |
| `chat-*` | Chat panel | `chat-message`, `chat-input-form` |
| `quest-*` | Quest editor | `quest-node`, `quest-section` |
| `cutscene-*` | Cutscene editor | `cutscene-timeline-*` |
| `terminal-*` | MUD terminal | `terminal-line`, `term-connection-dot` |
| `tool-*` | Tool execution UI | `tool-use`, `tool-header` |
| `modal-*` | Modal dialogs | `modal-overlay`, `modal-content` |

## Quick Color Reference

| Use Case | CSS Variable | Tailwind Class |
|----------|--------------|----------------|
| Panel background | `var(--wb-panel)` | `bg-wb-panel` |
| Input background | `var(--wb-input)` | `bg-wb-input` |
| Main text | `var(--wb-text)` | `text-wb-text` |
| Bright text | `var(--wb-text-bright)` | `text-wb-text-bright` |
| Muted text | `var(--wb-text-muted)` | `text-wb-text-muted` |
| Default border | `var(--wb-border)` | `border-wb-border` |
| Accent | `var(--wb-accent)` | `text-wb-accent` / `bg-wb-accent` |
| Success | `var(--wb-success)` | `text-wb-success` |
| Error | `var(--wb-error)` | `text-wb-error` |

## Adding New CSS - Decision Tree

```
Is it for World Builder?
    |
    +-- YES -> Does the target domain file exist?
    |           +-- YES -> Add to world-builder/{domain}.css
    |           +-- NO  -> Create new file, add @import to app.css
    |
    +-- NO  -> Is it for admin pages?
                +-- YES -> Use inline Tailwind in templates only
                +-- NO  -> Add to appropriate css/ file

Before adding ANY CSS:
1. grep -r "selector-name" assets/css/  # Check if it exists
2. Check if existing file >350 lines    # Split if needed
3. Verify using design tokens only      # No hex, no raw px
```
