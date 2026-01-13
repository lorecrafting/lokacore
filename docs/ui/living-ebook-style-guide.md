# Living Ebook UI Style Guide

## Philosophy

Loka's interface is designed as a **living ebook** — a literary experience where the game world unfolds like reading a novel that responds to your presence. The aesthetic evokes classic literature: black text on cream paper, elegant serif typography, and interactive elements woven seamlessly into prose.

### Core Principles

1. **Literary, not technical** — The interface should feel like reading a book, not using software
2. **Prose over chrome** — Minimize UI widgets; let the narrative be the interface
3. **Touch-first** — All interactions are tap/click based; no keyboard input required
4. **Grayscale restraint** — Black, white, and gray only; color is reserved for meaning
5. **Underlines for interaction** — Interactive elements are underlined text, not buttons

---

## Visual Language

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--ebook-bg` | `#FAFAFA` | Page background (off-white, like aged paper) |
| `--ebook-text` | `#222222` | Primary text (near-black) |
| `--ebook-text-muted` | `#999999` | Secondary text, labels, hints |
| `--ebook-text-faint` | `#CCCCCC` | Disabled states |
| `--ebook-border` | `#E5E5E5` | Subtle dividers when needed |

**Rule**: Never use color for decoration. If you need to add color, ask: "Does this convey essential meaning that can't be expressed otherwise?"

### Typography

**Font**: Crimson Text (serif) with Georgia and Times New Roman as fallbacks.

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Page title | `1.75rem` | 700 | Centered, chapter-heading style |
| Body prose | `1.125rem` | 400 | Line-height 1.7 for readability |
| Menu items | `1rem` | 400 | Simple text list |
| Labels | `1rem` | 400 | Muted color |
| Small text | `0.875rem` | 400 | Hints, metadata |

**Line height**: 1.7 for prose, 1.3 for headings.

**Max width**: 42rem (optimal reading width).

### Spacing

Use generous whitespace. The page should breathe like a book page.

- Page padding: `1.5rem`
- Between sections: `1.5rem` to `2rem`
- Between paragraphs: `1rem`
- Between menu items: `0.5rem`

---

## Interactive Elements

### Links (Primary Interaction)

All interactive elements appear as **underlined text** within the prose.

```css
.ebook-link {
  color: var(--ebook-text);
  text-decoration: underline;
  cursor: pointer;
}
```

**Guidelines**:
- Links are part of the narrative, not separate UI elements
- On hover: text goes pure black (`#000000`)
- Never use colored links
- Never use buttons for in-game actions

### Menus

When presenting choices (actions, navigation, options), use a simple text list:

```
Inspect
Talk
Trade
Quest
Attack
Leave
```

**Guidelines**:
- One action per line
- No bullets, numbers, or icons
- Each item is tappable
- "Leave" or "Back" always returns to previous view

### Forms (Auth Pages Only)

Forms appear only on authentication pages. Keep them minimal:

```
Your email address
________________________________

Send magic link

New to this realm? Create an account
```

**Guidelines**:
- Labels above inputs, muted color
- Inputs have bottom border only (no box)
- Submit actions are underlined text, not buttons
- Keep form fields to absolute minimum

---

## Layout Patterns

### Page Container

Every page uses `.ebook-page`:

```html
<div class="ebook-page">
  <!-- Content -->
</div>
```

This provides:
- Max-width constraint (42rem)
- Centered layout
- Paper background
- Serif typography
- Appropriate padding

### Room View (Game)

```
┌─────────────────────────────────────────┐
│                                         │
│          [Room Title]                   │  ← Bold, centered
│                                         │
│   [Room description as flowing prose    │  ← First paragraph, no indent
│    that paints the scene...]            │
│                                         │
│   [Entities and items woven into        │  ← Underlined names
│    descriptive sentences...]            │
│                                         │
│   [Event stream - recent happenings]    │  ← Separated by subtle border
│                                         │
├─────────────────────────────────────────┤
│              [Bottom Bar]               │  ← Fixed, minimal
└─────────────────────────────────────────┘
```

### Context Panel (Entity Focus)

When focusing on an entity, the view transforms:

```
┌─────────────────────────────────────────┐
│                                         │
│          [Room Title]                   │  ← MUTED (gray)
│                                         │
│   [Entity description...]               │
│                                         │
│   Inspect                               │  ← Action menu
│   Talk                                  │
│   Trade                                 │
│   ...                                   │
│   Leave                                 │  ← Returns to room
│                                         │
└─────────────────────────────────────────┘
```

**Key**: The room title becomes muted to show context shift.

### Auth Pages

Centered, minimal, literary:

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│          Enter the World                │
│                                         │
│   Your email address                    │
│   ________________________________      │
│                                         │
│   Send magic link                       │
│                                         │
│   New to this realm? Create an account  │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## Component Reference

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.ebook-page` | Main page container |
| `.ebook-title` | Room/chapter headings |
| `.ebook-title--muted` | Muted heading (context shift) |
| `.ebook-prose` | Body text paragraphs |
| `.ebook-link` | Interactive underlined text |
| `.ebook-menu` | Action menu container |
| `.ebook-menu-item` | Individual menu action |
| `.ebook-input` | Form input (underline only) |
| `.ebook-label` | Form field label |
| `.ebook-submit` | Form submit (underlined text) |
| `.ebook-events` | Event stream container |
| `.ebook-event` | Individual event |
| `.ebook-bottombar` | Fixed bottom bar |
| `.ebook-compass` | Navigation compass |
| `.ebook-auth` | Auth page centered layout |
| `.ebook-auth-title` | Auth page heading |
| `.ebook-auth-form` | Auth form container |
| `.ebook-auth-footer` | Auth page footer links |

### Transitions

All transitions use `150ms ease` for subtle, book-like feel:

```css
--ebook-transition: 150ms ease;
```

Use for:
- Hover state changes
- View transitions (fade in)
- Popup visibility

---

## Writing Guidelines

The UI is text-heavy by design. Writing quality matters.

### Tone

- **Literary**: Write like a novel, not a manual
- **Second person**: "You see...", "You hear..."
- **Present tense**: Immediate, immersive
- **Evocative**: Paint pictures with words

### Examples

**Good**: "A druid in dark green robes hobbles over an altar preparing a ceremony."

**Bad**: "Druid (NPC) - Level 5 - Friendly"

**Good**: "Enter the World"

**Bad**: "Login"

**Good**: "New to this realm? Create an account"

**Bad**: "Don't have an account? Sign up here"

---

## Extending the System

### Adding New Views

1. Use `.ebook-page` as container
2. Start with a `.ebook-title`
3. Use `.ebook-prose` for descriptive text
4. Use `.ebook-link` for any interactive element
5. Use `.ebook-menu` for action choices

### Adding New Components

Before creating a new component, ask:
- Can this be expressed as prose with underlined links?
- Does this need to be a separate UI element?
- Does this maintain the literary aesthetic?

If you must create new CSS:
- Prefix with `.ebook-`
- Use only grayscale colors
- Use the serif font stack
- Keep it minimal

### Things to Avoid

- ❌ Buttons (use underlined text)
- ❌ Icons (use words)
- ❌ Colors (grayscale only)
- ❌ Borders/boxes (minimal chrome)
- ❌ Technical language (literary tone)
- ❌ Dense information displays (prose over data)

---

## File Locations

| File | Purpose |
|------|---------|
| `assets/css/app.css` | All `.ebook-*` styles |
| `lib/loka_web/channels/game_channel.ex` | Game client channel |
| `lib/loka_web/channels/room_helpers.ex` | Room loading helpers |
| `lib/loka_web/controllers/player_*_html/` | Auth page templates |
| `lib/loka_web/components/layouts/root.html.heex` | Google Fonts link |
| `mobile/src/components/` | Mobile UI components |

---

## Quick Reference

```
Colors:     #FAFAFA (bg) | #222222 (text) | #999999 (muted)
Font:       Crimson Text, Georgia, serif
Max-width:  42rem
Line-height: 1.7
Transition: 150ms ease

Interactive = underlined text
Menus = simple text list
Forms = underline inputs only (auth pages)
```
