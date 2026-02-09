<!--
  Last Updated: 2026-02-08
  Version: 3.0
-->

# Frontend Development Context

This context auto-loads when working in `assets/`. Detailed guidance is in specialized rules files:

| File | Scope | Contents |
|------|-------|----------|
| `frontend-hooks.md` | `assets/js/hooks/` | HookHelper, lifecycle, event contract |
| `frontend-css.md` | `assets/css/` | Design tokens, color rules, CSS organization |

> **Quick Reference:** `server/assets/PATTERNS.md` | **Checklist:** `server/assets/CHECKLIST.md` | **Events:** `server/assets/js/events.json`

## File Organization

| Category | Location |
|----------|----------|
| CSS entry | `assets/css/app.css` |
| CSS tokens | `assets/css/variables.css` (design tokens) |
| JS hooks | `assets/js/hooks/*.js` (re-exported in `index.js`) |
| JS utility | `assets/js/hooks/HookHelper.js` (lifecycle management) |
| Entry point | `assets/js/app.js` |
| Tests | `assets/js/hooks/__tests__/*.test.js` |
| Vendor libs | `assets/vendor/` (heroicons, daisyui, topbar) |

## Build System

- **esbuild:** ES2022 modules, code splitting, `@/` alias maps to `assets/js/`
- **Tailwind v4:** Config in `app.css` (no `tailwind.config.js`), daisyUI via vendor
- **Vendor:** Third-party libs in `assets/vendor/`, NOT npm. Exception: CodeMirror uses npm.
- **Prettier:** JS formatting checked by pre-commit (warn, not block)

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|----------------|-----|
| `rgba()` with CSS variables | Variables can't be interpolated | `color-mix(in srgb, var(--color) N%, transparent)` |
| Adding listeners in `updated()` | Duplicates on each patch | Use HookHelper in `mounted()` only |
| `document.querySelector` globally | Wrong elements with multiple instances | Scope to `this.el.querySelector()` |
| Hook without try/catch | Errors crash silently | Wrap `mounted()` in try/catch |
| `<%= if %>` in HEEx | ERB syntax | Use `:if` directive |
| Multiple `class=` attributes | Only last applies in HEEx | Merge into `class={[...]}` |
| Raw pixel values in CSS | Inconsistent spacing | Use `var(--wb-space-*)` tokens |
| Hex colors in CSS | Breaks theming | Use `var(--wb-*)` tokens |
