# Loka Frontend Assets

Quick reference for frontend development. For comprehensive documentation, see `.claude/rules/frontend.md`.

## Directory Structure

```
assets/
├── css/
│   ├── app.css              # Entry point (imports + daisyUI config)
│   ├── variables.css        # Design tokens (--wb-*)
│   ├── tailwind-config.css  # @theme exports, variants
│   ├── admin-auth.css       # Login page styles
│   └── world-builder/       # Domain-specific styles
├── js/
│   ├── app.js               # Entry point
│   ├── hooks/               # LiveView hooks (one per file)
│   └── world_builder/       # Utilities (HookHelper, KeyboardManager, etc.)
├── vendor/                  # Third-party (heroicons, daisyUI, topbar)
├── .prettierrc              # Prettier config
├── .nvmrc                   # Node version (18)
├── jsconfig.json            # Editor intellisense
└── vitest.config.js         # Test config
```

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Hooks | `snake_case.js` | `world_builder.js`, `panel_resize.js` |
| Utilities | `PascalCase.js` | `HookHelper.js`, `Canvas2DViewport.js` |
| Tests | `*.test.js` | `HookHelper.test.js` |
| CSS | `kebab-case.css` | `chat-panel.css`, `quest-editor.css` |

## Quick Commands

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run lint          # ESLint
npm run format        # Prettier
npm run check         # lint + format + test
```

Build is handled by `mix assets.build` (esbuild + Tailwind).

## Key Conventions

- **Hooks**: Use `HookHelper` for automatic listener cleanup
- **CSS**: Use `--wb-*` design tokens only (no hex colors)
- **Storage**: Import keys from `storageKeys.js`
- **Keyboard**: Use `KeyboardManager` singleton

## Adding New Code

| Type | Location | Registration |
|------|----------|--------------|
| Hook | `js/hooks/{name}.js` | Add to `hooks/index.js` |
| CSS | `css/world-builder/{domain}.css` | Add import in `app.css` |
| Utility | `js/world_builder/{Name}.js` | Import where needed |

## Testing

- Framework: Vitest
- Location: `js/world_builder/__tests__/`
- Pattern: Mock browser globals with `vi.stubGlobal()`

## Design Tokens

| Use | CSS Variable | Tailwind |
|-----|--------------|----------|
| Panel bg | `var(--wb-panel)` | `bg-wb-panel` |
| Text | `var(--wb-text)` | `text-wb-text` |
| Border | `var(--wb-border)` | `border-wb-border` |
| Accent | `var(--wb-accent)` | `text-wb-accent` |

See `variables.css` for full token list.
