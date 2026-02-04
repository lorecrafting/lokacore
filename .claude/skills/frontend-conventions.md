# Frontend Conventions

**Trigger**: Working with CSS, JS hooks, or LiveView templates in `assets/` or `lib/loka_web/`.

## File Organization

### CSS
- `assets/css/variables.css` - World Builder design tokens (CSS custom properties)
- `assets/css/ebook-auth.css` - Auth page styles (login, register, character create)
- `assets/css/app.css` - Tailwind config, admin dashboard, World Builder styles

### JS Hooks
- `assets/js/hooks/` - One file per hook, named in snake_case
- `assets/js/hooks/index.js` - Re-exports all hooks
- `assets/js/app.js` - Entry point (imports hooks from `hooks/index.js`)

### Adding a new hook
1. Create `assets/js/hooks/my_hook.js` with `export default MyHook`
2. Import and add to `assets/js/hooks/index.js`
3. Never add hooks directly to `app.js`

## CSS Rules

### World Builder colors
Use CSS variables from `variables.css`, not hardcoded hex values:
```css
/* GOOD */
color: var(--wb-text-muted);
background: var(--wb-panel);

/* BAD */
color: #909090;
background: #1e1e1e;
```

### Tailwind classes for World Builder
Use the `@theme` extended classes when possible:
```html
<!-- GOOD -->
<div class="bg-wb-panel text-wb-text-muted border-wb-border">

<!-- BAD -->
<div style="background: #1e1e1e; color: #909090;">
```

### No @apply with daisyUI
daisyUI component classes cannot be used with `@apply`. Use them directly in templates:
```css
/* BAD */
.my-button { @apply btn btn-primary; }

/* GOOD - use directly in template */
<button class="btn btn-primary">
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Hook files | snake_case.js | `world_builder.js` |
| Hook names | PascalCase | `WorldBuilder` |
| CSS variables | --wb-{category}-{name} | `--wb-text-muted` |
| CSS classes (WB) | world-builder-{element} | `world-builder-panel` |
| CSS classes (admin) | admin-{element} | `admin-sidebar` |
| CSS classes (auth) | ebook-{element} | `ebook-input` |
