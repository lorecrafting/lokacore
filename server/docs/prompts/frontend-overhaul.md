# Frontend Overhaul - Comprehensive Prompt

## Context

We've completed a thorough audit of the frontend stack (CSS, JS, templates, dependencies). This prompt contains all findings and the execution plan. Work through each phase in order.

## Current State (Problems)

### 1. Monolithic CSS: 8,133 lines in one `app.css`
- Two design systems in one file: "ebook" game client (lines ~160-2500) and World Builder admin (lines ~2600-8100)
- World Builder section has 292 raw `background:` and 504 raw `color:` declarations with hardcoded hex values
- No CSS variables for World Builder (ebook section uses them well)
- Repeated component patterns not abstracted (quest editor, cutscene editor, script editor, dialogue editor, chat panel all define nearly identical section headers, form rows, validation panels, buttons)
- DaisyUI installed (248 KB vendor) but barely used - we define our own `.btn-primary`, `.btn-secondary` etc.
- Tailwind installed but almost never used in World Builder templates

### 2. Dead Ebook CSS (~2,200 lines)
- The ebook game client was replaced by the Godot client
- Only 3 files still use ebook classes: `player_session_html/new.html.heex` (login), `player_registration_html/new.html.heex` (registration), `character_creation_live.ex` (character create)
- These only use auth/form ebook classes (~200 lines worth)
- The rest (room scroll, combat, status bar, compass, events, dialogue, bardo, settings) is dead code
- Google Font "Crimson Text" is loaded only for ebook theme

### 3. Monolithic JS: 2,423 lines in one `app.js`
- 18 hooks defined, only 9 actually used
- 9 orphaned hooks (~750 lines): ScrollBottom, RoomScroll, EbookEvents, DialogueScroll, CompassRose, LargeCompass, Autofocus, BardoTimer, WorldMap, APIKeyConfig
- Active hooks: WorldBuilder, PanelResize, ChatTextarea, MultiAPIKeyConfig, CodeMirrorEditor, MudTerminal, ConsoleOutput, QuestFlowGraph
- CodeMirror bundled for ALL pages (adds ~300-400 KB gzipped) but only used on World Builder

### 4. Template Issues
- 250 inline `style=` attributes across World Builder templates
- Monolithic render functions: cutscene_editor.ex (520 LOC render), inspector_panel.ex (700 LOC render)
- Hardcoded hex colors scattered in templates
- 3 unused component files: `projects_panel.ex`, `create_entity_modal.ex`, `console_panel.ex`

### 5. No Convention Enforcement
- No pre-commit checks for inline styles, raw hex colors, or file size limits
- No frontend conventions section in CLAUDE.md
- No skill file for frontend patterns

---

## Execution Plan

### Phase 1: Delete Dead Code (do this first, it's safe and high-impact)

#### 1a. Delete orphaned JS hooks from `assets/js/app.js`
Delete these hooks and their registration in the Hooks object:
- `ScrollBottom` (lines ~36-46)
- `RoomScroll` (lines ~50-132)
- `EbookEvents` (lines ~136-146)
- `DialogueScroll` (lines ~148-158)
- `CompassRose` (lines ~161-193)
- `LargeCompass` (lines ~196-228)
- `Autofocus` (lines ~231-235)
- `BardoTimer` (lines ~238-257)
- `WorldMap` (lines ~260-392)
- `APIKeyConfig` (lines ~998-1109) - superseded by MultiAPIKeyConfig

Also update the comment at line ~33 ("Custom hooks for ebook-style game client") since those hooks are being removed.

Verify none of these hooks are referenced in any .ex or .heex file before deleting:
```bash
grep -rn "ScrollBottom\|RoomScroll\|EbookEvents\|DialogueScroll\|CompassRose\|LargeCompass\|Autofocus\|BardoTimer\|WorldMap\|APIKeyConfig" lib/loka_web/ --include="*.ex" --include="*.heex"
```

#### 1b. Delete dead ebook CSS from `assets/css/app.css`
Keep ONLY the ebook classes that are actually used by the 3 auth pages. Check each class:
```bash
grep -rn "ebook-" lib/loka_web/ --include="*.ex" --include="*.heex"
```

Classes confirmed in use (from login/register/character-create):
- `ebook-page`, `ebook-auth`, `ebook-auth--wide`, `ebook-auth-title`, `ebook-auth-form`, `ebook-auth-footer`
- `ebook-form-group`, `ebook-label`, `ebook-label-hint`, `ebook-input`, `ebook-submit`, `ebook-submit--center`
- `ebook-link`, `ebook-prose`, `ebook-prose--small`
- `ebook-flash`, `ebook-flash--error`, `ebook-dev-notice`
- `ebook-char-form`, `ebook-radio-group`, `ebook-radio-option`, `ebook-radio-label`
- `ebook-background-options`, `ebook-background-option`, `ebook-background-option--selected`, `ebook-background-radio`, `ebook-background-name`, `ebook-background-desc`, `ebook-background-bonus`
- `ebook-trait-options`, `ebook-trait-option`, `ebook-trait-option--selected`, `ebook-trait-option--disabled`, `ebook-trait-checkbox`, `ebook-trait-name`, `ebook-trait-desc`
- `ebook-field-error`
- CSS variables: `--ebook-bg`, `--ebook-text`, `--ebook-text-muted`, `--ebook-text-faint`, `--ebook-border`, `--ebook-font`, `--ebook-max-width`, `--ebook-padding`, `--ebook-transition`

Delete ALL other ebook classes. This includes everything related to:
- Room display: `ebook-title`, `ebook-atmosphere`, `ebook-room-scroll`, `ebook-room-scroll-content`, `ebook-room-collapsed-header`, `ebook-room-sticky`, etc.
- Events: `ebook-events`, `ebook-event`, `ebook-event--quest`, `ebook-event--error`, `ebook-event--combat`, `ebook-event--system`, etc.
- Status bar: `ebook-statusbar`, `ebook-statusbar-vitals`, `ebook-statusbar-directions`, `ebook-statusbar-minimap`, etc.
- Combat: `ebook-combat-vitals`, `ebook-combat-actionbar`, `ebook-combat-actions-row`, etc.
- Dialogue: `ebook-dialogue-log`, `ebook-dialogue-line`, `ebook-chat-overlay`, `ebook-chat-input`, etc.
- Menu/navigation: `ebook-menu`, `ebook-menu-item`, `ebook-objectives`, `ebook-objective`, etc.
- Settings: `ebook-settings-*`, `ebook-toggle`, `ebook-select`, etc.
- Bardo: All `.bardo-*` classes
- Connection overlay: `connection-overlay` and related (check if used first)
- Broadcast messages: `broadcast-*` classes (check if used first)
- Compass/direction styles
- Room transitions and scroll animations
- Text modifiers: `ebook-prose--indent`, font style modifiers, margin modifiers, section headers, etc.
- Responsive/media queries that only apply to ebook game client
- `@keyframes` that are only used by deleted classes
- `cmd-link` and `url-link` classes (check if used first)
- Accessibility overrides that only apply to ebook game client

Also delete the `prefers-reduced-motion` section IF it only targets ebook classes.

IMPORTANT: Before deleting, grep each class/section to confirm it's not used. Some classes like `connection-overlay` or `broadcast-*` might be used elsewhere.

#### 1c. Delete unused LiveView components
Verify these are truly unused, then delete:
```bash
grep -rn "projects_panel\|ProjectsPanel" lib/loka_web/ --include="*.ex" --include="*.heex"
grep -rn "create_entity_modal\|CreateEntityModal" lib/loka_web/ --include="*.ex" --include="*.heex"
grep -rn "console_panel\|ConsolePanel" lib/loka_web/ --include="*.ex" --include="*.heex"
```

Files to potentially delete:
- `lib/loka_web/live/admin_live/world_builder/projects_panel.ex`
- `lib/loka_web/live/admin_live/world_builder/create_entity_modal.ex`
- `lib/loka_web/live/admin_live/world_builder/console_panel.ex`

#### 1d. Remove Google Font if no longer needed
Check if Crimson Text is still needed after ebook cleanup:
```bash
grep -rn "Crimson Text\|ebook-font" lib/loka_web/ assets/ --include="*.ex" --include="*.heex" --include="*.html" --include="*.css" --include="*.js"
```

If it's only used by remaining auth pages, decide: keep it (they look nice with serif) or remove and restyle auth pages with system fonts later.

### Phase 2: Create `variables.css` and Extend Tailwind Config

#### 2a. Create `assets/css/variables.css`
Extract all World Builder colors into CSS variables. Audit the actual hex values used:

```css
/* assets/css/variables.css - World Builder Design Variables */

:root {
  /* === World Builder Theme === */

  /* Backgrounds - darkest to lightest */
  --wb-bg: #0d0d0d;              /* App background */
  --wb-surface: #1a1a22;          /* Panels like chat, terminal */
  --wb-panel: #1e1e24;            /* Primary panel background */
  --wb-panel-alt: #252530;        /* Alternate panel background */
  --wb-panel-header: #222238;     /* Section headers */
  --wb-input: #2a2a3e;            /* Input/form backgrounds */
  --wb-hover: #2d2d38;            /* Hover state backgrounds */

  /* Toolbar */
  --wb-toolbar: #222228;          /* Toolbar background */
  --wb-toolbar-border: #151518;   /* Toolbar bottom border */

  /* Borders */
  --wb-border: #333340;           /* Primary border color */
  --wb-border-light: #3d3d4d;     /* Lighter border (hover states) */
  --wb-border-dark: #2a2a3e;      /* Darker border (sections) */

  /* Text */
  --wb-text: #c9c9c9;             /* Primary text */
  --wb-text-bright: #e0e0e0;      /* Bright/emphasized text */
  --wb-text-muted: #909098;       /* Muted/secondary text */
  --wb-text-dim: #707080;         /* Dim/tertiary text */
  --wb-text-faint: #606060;       /* Faintest text */

  /* Accent / Interactive */
  --wb-accent: #4a9eff;           /* Primary accent (links, active states) */
  --wb-accent-hover: #3a8eef;     /* Accent hover */
  --wb-accent-gradient-from: #1a56a0;  /* Active button gradient start */
  --wb-accent-gradient-to: #0e7ad8;    /* Active button gradient end */

  /* Status colors */
  --wb-success: #4ade80;
  --wb-error: #f87171;
  --wb-warning: #fbbf24;
  --wb-info: #60a5fa;

  /* Resize handle */
  --wb-resize: #131318;
  --wb-resize-active: linear-gradient(180deg, #4a6cf7, #6366f1);

  /* Typography */
  --wb-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --wb-font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
  --wb-font-size-xs: 0.7rem;
  --wb-font-size-sm: 0.78rem;
  --wb-font-size-base: 0.85rem;
  --wb-font-size-lg: 0.95rem;

  /* Spacing (used for consistent panel padding) */
  --wb-space-xs: 4px;
  --wb-space-sm: 8px;
  --wb-space-md: 12px;
  --wb-space-lg: 16px;

  /* Border radius */
  --wb-radius-sm: 3px;
  --wb-radius-md: 5px;
  --wb-radius-lg: 8px;
}
```

NOTE: The exact hex values above are approximations from the audit. When implementing, grep the actual CSS to find the precise values used and normalize similar-but-slightly-different values (e.g., `#252530` vs `#252525` vs `#2a2a2a` should become one variable).

#### 2b. Extend Tailwind config to use these variables

Check the current Tailwind setup. With Tailwind v4, configuration is done via CSS, not a JS config file. Add theme extensions in `app.css` or a dedicated config:

```css
/* In app.css, after the @import "tailwindcss" line */
@theme {
  --color-wb-bg: var(--wb-bg);
  --color-wb-surface: var(--wb-surface);
  --color-wb-panel: var(--wb-panel);
  --color-wb-panel-alt: var(--wb-panel-alt);
  --color-wb-panel-header: var(--wb-panel-header);
  --color-wb-input: var(--wb-input);
  --color-wb-hover: var(--wb-hover);
  --color-wb-toolbar: var(--wb-toolbar);
  --color-wb-border: var(--wb-border);
  --color-wb-border-light: var(--wb-border-light);
  --color-wb-text: var(--wb-text);
  --color-wb-text-bright: var(--wb-text-bright);
  --color-wb-text-muted: var(--wb-text-muted);
  --color-wb-text-dim: var(--wb-text-dim);
  --color-wb-accent: var(--wb-accent);
  --color-wb-accent-hover: var(--wb-accent-hover);
  --color-wb-success: var(--wb-success);
  --color-wb-error: var(--wb-error);
  --color-wb-warning: var(--wb-warning);
  --color-wb-info: var(--wb-info);
}
```

This enables classes like `bg-wb-panel`, `text-wb-text-muted`, `border-wb-border` in templates.

IMPORTANT: Check the exact Tailwind v4 syntax for theme extensions. The `@theme` directive is the v4 way. Verify by checking their docs or the existing app.css setup.

#### 2c. Import variables.css in app.css
Add `@import "./variables.css";` near the top of app.css, before other styles.

### Phase 3: Split CSS into Separate Files

#### 3a. Create the new file structure:
```
assets/css/
  app.css           → Tailwind imports, @theme extensions, LiveView variants, base styles (~100 lines)
  variables.css     → CSS variables for both themes (~60 lines)
  ebook-auth.css    → Auth page styles (login, register, character create) (~200 lines)
  components.css    → Shared @apply component classes for World Builder (~50-80 lines)
```

#### 3b. Move auth ebook styles to `ebook-auth.css`
Move all remaining ebook classes (auth forms, labels, inputs, etc.) into this file.
Include the `:root` CSS variables that ebook needs.

#### 3c. Create `components.css` with @apply classes
For the most commonly repeated World Builder patterns, create component classes using Tailwind @apply:

```css
/* components.css - Shared World Builder component classes */

/* Only create @apply classes for patterns used 10+ times */
.wb-panel-header {
  @apply flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold uppercase tracking-wide;
  color: var(--wb-text-muted);
  background: var(--wb-panel-header);
}

.wb-btn {
  @apply flex items-center justify-center gap-1.5 min-w-8 h-8 px-2.5 border border-transparent cursor-pointer text-xs font-medium transition-all;
  color: var(--wb-text-muted);
  background: transparent;
  border-radius: var(--wb-radius-md);
}

.wb-btn:hover {
  color: var(--wb-text-bright);
  background: var(--wb-hover);
  border-color: var(--wb-border-light);
}

.wb-btn-active {
  @apply text-white;
  background: linear-gradient(135deg, var(--wb-accent-gradient-from), var(--wb-accent-gradient-to));
  border-color: var(--wb-accent);
}

.wb-input {
  @apply w-full text-sm;
  padding: var(--wb-space-xs) var(--wb-space-sm);
  background: var(--wb-input);
  border: 1px solid var(--wb-border);
  border-radius: var(--wb-radius-sm);
  color: var(--wb-text);
}

.wb-input:focus {
  outline: none;
  border-color: var(--wb-accent);
}

.wb-section {
  border: 1px solid var(--wb-border-dark);
  border-radius: var(--wb-radius-lg);
  overflow: hidden;
  margin-bottom: var(--wb-space-md);
}
```

Keep this file SMALL (under 100 lines). Only abstract patterns used 10+ times.

#### 3d. Slim down app.css
After moving ebook-auth and creating variables.css and components.css, app.css should contain:
1. Tailwind imports and plugins (existing, ~90 lines)
2. `@import "./variables.css";`
3. `@import "./ebook-auth.css";`
4. `@import "./components.css";`
5. `@theme` extensions for Tailwind
6. LiveView variants and base styles (~30 lines)
7. World Builder CSS (the remaining custom CSS that hasn't been migrated to Tailwind yet)

The World Builder CSS stays in app.css for now but will shrink over time as panels are migrated to Tailwind-in-templates (Phase 6).

### Phase 4: Split JS Hooks into Separate Files

#### 4a. Create hooks directory structure:
```
assets/js/
  app.js              → Imports, LiveSocket setup, hook registration (~100 lines)
  hooks/
    index.js           → Exports all hooks as single object
    world_builder.js   → WorldBuilder hook
    panel_resize.js    → PanelResize hook
    chat_textarea.js   → ChatTextarea hook
    multi_api_key.js   → MultiAPIKeyConfig hook
    codemirror.js      → CodeMirrorEditor hook
    mud_terminal.js    → MudTerminal hook
    console_output.js  → ConsoleOutput hook
    quest_flow.js      → QuestFlowGraph hook
```

#### 4b. Each hook file exports a single hook object:
```js
// hooks/panel_resize.js
const PanelResize = {
  mounted() { ... },
  destroyed() { ... }
}
export default PanelResize
```

#### 4c. Index file collects them:
```js
// hooks/index.js
import WorldBuilder from './world_builder'
import PanelResize from './panel_resize'
import ChatTextarea from './chat_textarea'
import MultiAPIKeyConfig from './multi_api_key'
import CodeMirrorEditor from './codemirror'
import MudTerminal from './mud_terminal'
import ConsoleOutput from './console_output'
import QuestFlowGraph from './quest_flow'

export default {
  WorldBuilder,
  PanelResize,
  ChatTextarea,
  MultiAPIKeyConfig,
  CodeMirrorEditor,
  MudTerminal,
  ConsoleOutput,
  QuestFlowGraph
}
```

#### 4d. App.js imports hooks:
```js
import Hooks from './hooks'
// ... existing LiveSocket setup using Hooks
```

Also move the Canvas2DViewport and UndoManager utility classes into their own files under `assets/js/lib/` or keep them alongside world_builder.js if they're tightly coupled.

### Phase 5: Add Convention Enforcement

#### 5a. Add to pre-commit hook (`.git/hooks/pre-commit`)

Add these checks after existing checks:

```bash
# === Frontend Convention Checks ===

# Check for inline styles in LiveView templates
INLINE_STYLES=$(grep -rn 'style="' lib/loka_web/live/ --include="*.ex" --include="*.heex" 2>/dev/null || true)
if [ -n "$INLINE_STYLES" ]; then
  echo ""
  echo "WARNING: Inline style= attributes found in templates."
  echo "Use Tailwind classes or CSS variables instead."
  echo "$INLINE_STYLES" | head -5
  echo "..."
  # Start as warning, change to error (exit 1) once existing violations are fixed
fi

# Check for arbitrary Tailwind color values (raw hex in class attributes)
ARB_COLORS=$(grep -rn '\[#[0-9a-fA-F]' lib/loka_web/live/ --include="*.ex" --include="*.heex" 2>/dev/null || true)
if [ -n "$ARB_COLORS" ]; then
  echo ""
  echo "WARNING: Arbitrary hex color values found in Tailwind classes."
  echo "Use design variables (bg-wb-panel, text-wb-text-muted, etc.)"
  echo "$ARB_COLORS" | head -5
fi

# Check for oversized LiveView files
for f in $(find lib/loka_web/live/admin_live -name "*.ex" 2>/dev/null); do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 1000 ]; then
    echo ""
    echo "WARNING: $f is $lines lines. Consider extracting components (target: <500 lines)."
  fi
done
```

NOTE: Start these as warnings. Once existing violations are cleaned up, change to errors (exit 1).

#### 5b. Create frontend skill: `.claude/skills/frontend-conventions.md`

```markdown
# Frontend Conventions Skill

## Trigger
Use when working on CSS, HEEx templates, JS hooks, or any World Builder UI code.

## CSS Rules (MANDATORY)
1. NEVER add `style=` attributes in HEEx templates. Use Tailwind classes or CSS variables.
2. NEVER use raw hex colors anywhere. Use design variables from `variables.css`:
   - Backgrounds: `bg-wb-panel`, `bg-wb-surface`, `bg-wb-bg`, etc.
   - Text: `text-wb-text`, `text-wb-text-muted`, `text-wb-text-dim`, etc.
   - Borders: `border-wb-border`, `border-wb-border-light`, etc.
   - Status: `text-wb-success`, `text-wb-error`, `text-wb-warning`, etc.
3. NEVER add new custom CSS classes to app.css. Use Tailwind utilities in templates.
   - Exception: If a pattern is used 10+ times, add an @apply class to `components.css`.
4. Use Tailwind's grid/flex utilities for layout, not manual CSS.
5. All design values (colors, spacing, radii, fonts) come from `variables.css`.

## Template Rules
1. Render functions must be under 200 lines. Extract helper components.
2. Use Tailwind classes for spacing: `p-2`, `gap-1.5`, `mb-3` etc.
3. Use semantic variable-based classes for colors: `bg-wb-panel`, not `bg-[#1e1e24]`.
4. Interactive elements need hover/focus states.

## JS Hook Rules
1. Each hook lives in its own file under `assets/js/hooks/`.
2. New hooks must be added to `assets/js/hooks/index.js`.
3. Hooks should be under 200 lines. Extract utilities to `assets/js/lib/`.

## File Structure
```
assets/css/
  app.css           - Tailwind imports, theme, base styles only
  variables.css     - All CSS custom properties (colors, spacing, fonts)
  ebook-auth.css    - Auth page styles (login, register, character create)
  components.css    - Shared @apply component classes (<100 lines)

assets/js/
  app.js            - Imports, LiveSocket, hook registration only
  hooks/            - One file per hook
  lib/              - Shared JS utilities (Canvas2DViewport, UndoManager, etc.)
```

## Design Variables Reference
See `assets/css/variables.css` for the full list. Key categories:
- `--wb-bg`, `--wb-surface`, `--wb-panel`, `--wb-panel-alt` (backgrounds)
- `--wb-text`, `--wb-text-bright`, `--wb-text-muted`, `--wb-text-dim` (text)
- `--wb-border`, `--wb-border-light`, `--wb-border-dark` (borders)
- `--wb-accent`, `--wb-accent-hover` (interactive)
- `--wb-success`, `--wb-error`, `--wb-warning`, `--wb-info` (status)
```

#### 5c. Add frontend section to CLAUDE.md

Add a `## Frontend Conventions` section to CLAUDE.md with the key rules from the skill above (abbreviated version). This ensures every session sees the rules.

### Phase 6: Migrate World Builder CSS to Tailwind (Ongoing)

This phase happens gradually - each time you touch a World Builder component, convert it from custom CSS to Tailwind-in-template. Don't do this all at once.

#### Migration pattern for each panel/component:
1. Read the component .ex file
2. Identify all custom CSS classes it uses (e.g., `.world-builder-toolbar`, `.toolbar-btn`)
3. Look up those classes in app.css
4. Replace `class="toolbar-btn"` with equivalent Tailwind classes using design variables
5. Delete the now-unused CSS from app.css
6. Replace any `style=` attributes with Tailwind classes
7. Test the component visually

#### Priority order for migration (most-touched → least-touched):
1. `toolbar.ex` - touched frequently, simple layout
2. `hierarchy_panel.ex` - frequently modified
3. `inspector_panel.ex` - large but commonly edited
4. `chat_panel.ex` - active development
5. `terminal_panel.ex` - new component
6. Modal components (various)
7. Editor components (quest, dialogue, cutscene, script)
8. Viewport components

#### Example migration:
```elixir
# BEFORE (custom CSS class)
<button class="toolbar-btn active">Save</button>
# With app.css: .toolbar-btn { display: flex; align-items: center; ... }

# AFTER (Tailwind with design variables)
<button class="wb-btn wb-btn-active">Save</button>
# Or fully inline if not using component class:
<button class="flex items-center justify-center gap-1.5 min-w-8 h-8 px-2.5 bg-wb-panel text-wb-text-muted hover:bg-wb-hover hover:text-wb-text-bright rounded-[5px] text-xs font-medium transition-all">Save</button>
```

### Phase 7: Remove DaisyUI (After Phase 6 is substantially complete)

Once World Builder CSS is migrated to Tailwind utilities:
1. Audit remaining DaisyUI class usage: `grep -rn "btn-\|card-\|badge-\|menu-\|alert-\|toast-" lib/loka_web/ --include="*.ex" --include="*.heex"`
2. Replace DaisyUI classes with Tailwind equivalents
3. Remove `@plugin "../vendor/daisyui"` and `@plugin "../vendor/daisyui-theme"` from app.css
4. Delete `assets/vendor/daisyui.js` and `assets/vendor/daisyui-theme.js`
5. Simplify the theme configuration (keep only what's needed for Tailwind dark mode)

---

## Verification After Each Phase

After each phase, run:
```bash
cd server
mix compile --warnings-as-errors
mix test
mix phx.server  # Verify visually: login page, World Builder
```

Check the World Builder at http://localhost:4000/admin/world-builder - all panels, modals, editors should look identical.

## Expected Results

| Metric | Before | After Phase 1-5 | After Phase 6-7 |
|--------|--------|-----------------|-----------------|
| app.css lines | 8,133 | ~3,500 | ~300 |
| app.js lines | 2,423 | ~100 (+ hook files) | ~100 |
| CSS files | 1 | 4 (focused) | 4 (minimal) |
| JS hook files | 1 | 9 (focused) | 9 |
| Inline style= | 250 | 250 (unchanged) | 0 |
| Dead code lines | ~3,350 | 0 | 0 |
| Raw hex in templates | many | many | 0 |
| Convention enforcement | none | pre-commit + skill | pre-commit + skill |
