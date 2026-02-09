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
│   ├── builder.css          # Builder layout styles
│   └── builder/             # Domain-specific styles
│       └── terminal.css     # MUD terminal styles
├── js/
│   ├── app.js               # Entry point
│   └── hooks/               # LiveView hooks + HookHelper utility
│       ├── index.js         # Hook registration
│       ├── HookHelper.js    # Automatic listener cleanup
│       ├── scroll_bottom.js
│       ├── chat_textarea.js
│       ├── multi_api_key_config.js
│       ├── mud_terminal.js
│       ├── console_output.js
│       ├── terminalMarkup.js  # Terminal markup parser
│       └── __tests__/       # Vitest tests
├── vendor/                  # Third-party (heroicons, daisyUI, topbar)
├── .prettierrc              # Prettier config
├── .nvmrc                   # Node version (18)
├── jsconfig.json            # Editor intellisense
└── vitest.config.js         # Test config
```

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Hooks | `snake_case.js` | `mud_terminal.js`, `scroll_bottom.js` |
| Utilities | `PascalCase.js` | `HookHelper.js`, `terminalMarkup.js` |
| Tests | `*.test.js` | `mud_terminal_parseMarkup.test.js` |
| CSS | `kebab-case.css` | `terminal.css`, `builder.css` |

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

## Adding New Code

| Type | Location | Registration |
|------|----------|--------------|
| Hook | `js/hooks/{name}.js` | Add to `hooks/index.js` |
| CSS | `css/builder/{domain}.css` | Add import in `app.css` |

## Testing

- Framework: Vitest
- Location: `js/hooks/__tests__/`
- Pattern: Mock browser globals with `vi.stubGlobal()`

## Design Tokens

| Use | CSS Variable | Tailwind |
|-----|--------------|----------|
| Panel bg | `var(--wb-panel)` | `bg-wb-panel` |
| Text | `var(--wb-text)` | `text-wb-text` |
| Border | `var(--wb-border)` | `border-wb-border` |
| Accent | `var(--wb-accent)` | `text-wb-accent` |

See `variables.css` for full token list.

## Build Pipeline

```
mix phx.server
    │
    ├── esbuild: js/app.js → priv/static/assets/js/
    │   ├── Target: ES2022 modules
    │   ├── Code splitting enabled (--splitting --format=esm)
    │   ├── Import alias: @/ → assets/js/
    │   └── Output: chunks with hash-based names
    │
    └── tailwind: css/app.css → priv/static/assets/css/
        ├── Scans: css/, js/, lib/loka_web/ for classes
        └── Plugins: heroicons, daisyUI
```

## Test Coverage

Run `npm run test:coverage` to generate coverage report.

| Metric | Target | Current |
|--------|--------|---------|
| Lines | 70% | Check with coverage report |
| Functions | 65% | Check with coverage report |
| Branches | 55% | Check with coverage report |

### Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### Test Location

Tests are in `js/hooks/__tests__/`:
- `mud_terminal_parseMarkup.test.js` - Terminal markup parsing

## Validation

Run full validation before committing:

```bash
npm run validate  # lint + format check + tests
```

This is equivalent to `npm run check`.
