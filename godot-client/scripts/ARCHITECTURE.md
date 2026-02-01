# Book Page Component Architecture

This document describes the architecture of the book page UI system in the Godot client.
It is written for both **humans** and **LLMs** working on this codebase.

## Quick Reference

| File | Lines | Responsibility |
|------|-------|----------------|
| `book_page.gd` | ~1,200 | **Controller** - state, signals, coordination |
| `page_mesh_factory.gd` | ~300 | **Factory** - page mesh creation, bottom bar, compass |
| `page_content_renderer.gd` | ~235 | **Renderer** - BBCode generation for all page types |
| `menu_tab_renderer.gd` | ~350 | **Renderer** - menu tab content (inventory, quests, etc.) |
| `dialogue_controller.gd` | ~245 | **Controller** - dialogue state and mock dialogue |
| `shop_container_handler.gd` | ~185 | **Handler** - shop/container rendering and actions |

**Total**: ~2,500 lines across 6 focused files (down from 2,182 lines in one file)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      BookPage (Controller)                   │
│  - Page state (current_page, pending_page, menu_tab)        │
│  - Animation (curl, effects, page turns)                    │
│  - Input handling (clicks, drags, scrolling)                │
│  - Signal wiring and event routing                          │
│  - Compass/bottom bar state updates                         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ PageMeshFactory │  │ PageContent     │  │ ShopContainer   │
│                 │  │ Renderer        │  │ Handler         │
│ - Page mesh     │  │ - Room BBCode   │  │ - Shop BBCode   │
│ - Viewports     │  │ - Entity BBCode │  │ - Container     │
│ - Bottom bar    │  │ - Dialogue      │  │   BBCode        │
│ - Compass       │  │ - Menu header   │  │ - Buy/Take      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ MenuTabRenderer │
                     │ - Inventory     │
                     │ - Equipment     │
                     │ - Character     │
                     │ - Quests        │
                     │ - Map           │
                     │ - Social        │
                     │ - Settings      │
                     └─────────────────┘
```

---

## Component Details

### 1. BookPage (`book_page.gd`) - The Controller

**Role**: Orchestrates all components, manages state, handles input, routes events.

**State it owns**:
- `current_page: PageType` - Which page is displayed (ROOM, MENU, ENTITY, etc.)
- `current_menu_tab: MenuTab` - Which menu tab is active
- `current_entity: Variant` - Entity being viewed
- `dialogue_data/dialogue_history` - Dialogue state
- `events: Array` - Event feed messages
- `available_exits: Array` - For compass display

**Key methods**:
- `_ready()` - Initializes all components
- `_input()` - Routes input to appropriate handler
- `turn_page()` - Animates page curl
- `_on_label_meta_clicked()` - Routes BBCode link clicks
- `_render_*_to_page()` - Delegates to renderers, applies to page.label.text

**When to modify**:
- Adding new page types
- Changing page transition behavior
- Adding new input handling
- Modifying signal connections

### 2. PageMeshFactory (`page_mesh_factory.gd`) - The Factory

**Role**: Creates page mesh objects with viewports, shaders, and UI elements.

**Key classes**:
- `PageMesh` - Inner class holding mesh, viewports, label, shader

**Key methods**:
- `create_page_mesh(z_offset, meta_callback)` - Creates complete page
- `apply_page_textures(page, tree)` - Applies viewport textures to shader
- `_create_bottom_bar()` - Creates menu/compass/say buttons
- `_create_compass()` - Creates directional navigation

**Constants it owns**:
- `PAGE_WIDTH`, `PAGE_HEIGHT` - Mesh dimensions
- `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT` - Text resolution
- `BOTTOM_BAR_HEIGHT`, `BUTTON_SIZE` - UI dimensions

**When to modify**:
- Changing page appearance/size
- Modifying bottom bar layout
- Adding new UI elements to pages
- Changing shader setup

### 3. PageContentRenderer (`page_content_renderer.gd`) - The Renderer

**Role**: Pure rendering - converts data to BBCode strings. No side effects.

**Key methods**:
- `render_room(room, events) -> String` - Room with NPCs, items, events
- `render_entity(entity) -> Dict` - Returns `{text, actions}`
- `render_dialogue(data, history) -> String` - Dialogue with choices
- `render_menu(tab, menu_renderer) -> String` - Menu with tab bar

**Color constants**: All BBCode colors are defined here for consistency.

**When to modify**:
- Changing visual appearance of content
- Adding new BBCode formatting
- Modifying how entities/rooms/dialogue look

### 4. MenuTabRenderer (`menu_tab_renderer.gd`) - Menu Content

**Role**: Renders individual menu tab content.

**Key methods**:
- `get_inventory_content() -> String`
- `get_equipment_content() -> String`
- `get_character_content() -> String`
- `get_quests_content() -> String`
- `get_map_content() -> String`
- `get_social_content() -> String`
- `get_settings_content() -> String`

**Data sources**: Reads from `GameState` and `MockWorld`.

**When to modify**:
- Changing how inventory/equipment/etc displays
- Adding new fields to character stats
- Modifying map rendering algorithm

### 5. DialogueController (`dialogue_controller.gd`) - Dialogue State

**Role**: Manages dialogue state, history, and mock dialogue for offline testing.

**Key methods**:
- `start_dialogue(data, from_page)` - Start new dialogue
- `update_dialogue(data)` - Update with new node
- `add_player_choice(text, event)` - Track player selections
- `render() -> String` - Render current dialogue

**When to modify**:
- Changing dialogue history tracking
- Modifying mock dialogue content
- Adding dialogue features

### 6. ShopContainerHandler (`shop_container_handler.gd`) - Commerce

**Role**: Renders and handles shop/container interactions.

**Key methods**:
- `render_shop() -> String` - Shop with prices
- `render_container() -> String` - Container with items
- `handle_shop_click(action)` - Buy items
- `handle_container_click(action)` - Take items

**When to modify**:
- Changing shop/container appearance
- Adding new commerce features
- Modifying buy/take logic

---

## Data Flow

### Rendering Flow (Data → BBCode → Display)

```
1. GameState changes (room, entity, dialogue)
        │
2. Signal emitted (room_changed, dialogue_changed, etc.)
        │
3. BookPage receives signal, calls _render_*_to_page()
        │
4. Renderer creates BBCode string
        │
5. BookPage sets page.label.text = bbcode
        │
6. RichTextLabel displays formatted text
```

### Click Flow (User Action → Game Action)

```
1. User clicks/taps screen
        │
2. BookPage._input() detects click
        │
3. BookPage._handle_page_click() converts to viewport coords
        │
4. Click forwarded to text viewport
        │
5. RichTextLabel emits meta_clicked signal
        │
6. BookPage._on_label_meta_clicked() routes based on page type
        │
7. Appropriate handler called (shop, container, dialogue, entity)
        │
8. Handler sends action to GameState/PhoenixClient
```

---

## Extension Guidelines

### Adding a New Page Type

1. Add to `PageType` enum in `book_page.gd`
2. Add case to `_render_pending_content_to_page()`
3. Create render method (or add to PageContentRenderer)
4. Add click handling in `_on_label_meta_clicked()` if needed
5. Add case to `_on_game_state_page_changed()` if GameState triggers it

### Adding a New Menu Tab

1. Add to `MenuTab` enum in `book_page.gd`
2. Add tab entry in `PageContentRenderer.render_menu()` tabs array
3. Add `get_*_content()` method to `MenuTabRenderer`
4. Add match case in `PageContentRenderer.render_menu()`

### Changing Visual Appearance

1. Find the color constants in the relevant renderer
2. Modify BBCode generation in the render method
3. Test with `./check.sh` and visual inspection

### Adding New Entity Actions

1. Actions come from server in entity data
2. `PageContentRenderer.render_entity()` creates action links
3. `BookPage._execute_entity_action()` handles clicks
4. Add new cases there or in GameState

---

## Design Principles

### 1. Controller Pattern
BookPage is the controller - it owns state and coordinates components.
Components should not directly modify BookPage state.

### 2. Pure Rendering
Renderers take data in, return strings out. No side effects.
This makes them easy to test and reason about.

### 3. Single Responsibility
Each component does one thing well:
- Factory creates objects
- Renderers generate BBCode
- Handlers manage interactions
- Controller coordinates everything

### 4. Composition Over Inheritance
Components are composed via member variables, not inheritance.
This keeps the dependency graph flat and understandable.

### 5. Signal-Based Communication
State changes propagate via signals (from GameState).
This decouples the view from the data source.

---

## For LLMs: Common Tasks

### "Change how rooms look"
→ Modify `PageContentRenderer.render_room()`

### "Add a new menu tab"
→ Follow "Adding a New Menu Tab" above

### "Change bottom bar layout"
→ Modify `PageMeshFactory._create_bottom_bar()`

### "Add new dialogue features"
→ Modify `DialogueController` and/or `PageContentRenderer.render_dialogue()`

### "Fix a click not working"
→ Check `BookPage._on_label_meta_clicked()` routing

### "Add visual effects"
→ Modify `BookPage.start_text_effect()` and shader

### "Change page dimensions"
→ Modify constants in `PageMeshFactory`

---

## Testing

```bash
# Validate all scripts (catches syntax errors)
./check.sh

# Build for web
./build_web.sh --fast

# Run with console output
./check.sh --run
```

**Manual testing checklist**:
- [ ] Room navigation (compass clicks)
- [ ] Entity inspection (click NPC/item)
- [ ] Dialogue choices (click options)
- [ ] Menu tabs (all 7 work)
- [ ] Shop buying (if online)
- [ ] Container taking (if online)
- [ ] Page curl animation (Space key)

---

## File Locations

```
godot-client/scripts/
├── book_page.gd              # Main controller
├── page_mesh_factory.gd      # Page creation
├── page_content_renderer.gd  # BBCode generation
├── menu_tab_renderer.gd      # Menu tab content
├── dialogue_controller.gd    # Dialogue state
├── shop_container_handler.gd # Commerce handling
├── game_state.gd             # Global state (autoload)
├── mock_world.gd             # Test data (autoload)
├── phoenix_client.gd         # WebSocket client (autoload)
├── auth_client.gd            # Authentication (autoload)
└── ARCHITECTURE.md           # This file
```

---

## Version History

- **2026-01-31**: Initial extraction from monolithic book_page.gd (2,182 lines)
  - Created 5 focused components
  - Reduced book_page.gd to ~1,200 lines
  - Total code: ~2,500 lines (slight increase due to documentation/structure)
  - Benefit: Much easier to understand, modify, and extend
