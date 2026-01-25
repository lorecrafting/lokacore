# Task Breakdown - Ready for Implementation

This document contains actionable tasks ready to be loaded into Claude Code's task system.

## **Architecture Note: Pages, Not Modals**

All mobile app "modals" become **pages you turn to** in the book:
- Menu → Turn page to menu
- Shop → Turn page to shop
- Entity interaction → Turn page to entity page
- Combat → Turn page to combat page

**Navigation Pattern:**
```
Game Page → [Menu button] → Turn page → Menu Page
Menu Page → [Back button] → Turn page back → Game Page
```

This reuses the existing curl animation system from Phase 0/1. Much simpler than overlay management!

---

## Phase 1: Finish Core Interaction (1 week remaining)

### P1.4 - Underlined Link Visual Indicators (2 days)

**Goal:** Match mobile app link styling - underline keywords only

**Tasks:**
- [ ] Add underline rendering to text spans marked as links
- [ ] Calculate underline position based on glyph bounds
- [ ] Render underline as thin line (1-2px) below text baseline
- [ ] Test: "You see Elder Ming" → only "Elder Ming" is underlined
- [ ] Verify underlines work on curved page surface

**Technical Notes:**
- Mobile pattern: `<u>Elder Ming</u>` (keyword only, not whole sentence)
- No hover effects (mobile doesn't have hover)
- Underline should be same color as text (or slightly darker)

**Reference:** `mobile/src/components/RoomView.tsx` line 65 (HighlightedTextInline)

---

### P1.5 - Text Scrolling (3 days)

**Goal:** Long content scrolls within page bounds

**Tasks:**
- [ ] Implement scroll offset tracking (pixels from top)
- [ ] Add touch/drag gesture handler for scrolling
- [ ] Auto-scroll to bottom when new events arrive
- [ ] Render only visible portion of text (performance)
- [ ] Add scroll indicator on right edge (subtle)
- [ ] Test: 100+ line event log scrolls smoothly

**Technical Notes:**
- Scroll should feel like flipping through pages of text
- Momentum scrolling (inertia after release)
- Bounds checking (can't scroll beyond content)

**Reference:** `mobile/src/components/RoomView.tsx` line 148 (auto-scroll)

---

## Phase 2: Multi-Page Book System (2 weeks)

### P2.1 - Page System Architecture (1 week)

#### Task 2.1.1: Multi-Page Book Struct (2 days)

**Goal:** Support multiple pages in the book (each "modal" is just another page you turn to)

**Tasks:**
- [ ] Create `BookState` resource with page list + current index
- [ ] `PageType` enum: Game, Menu, EntityInteraction, Shop, Container, Combat, Bardo
- [ ] `PageData` struct: content, page_type
- [ ] Page navigation: turn_to_page(), go_back()
- [ ] Page history stack (for back button)
- [ ] Test: Open menu → turn page, close → turn back

**Acceptance Criteria:**
- [ ] Can navigate between different page types
- [ ] Back navigation returns to previous page
- [ ] Page history tracks navigation path

**Technical Design:**
```rust
#[derive(Resource)]
struct BookState {
    pages: Vec<PageData>,           // All pages in the book
    current_page_index: usize,      // Which page is visible
    page_history: Vec<usize>,       // For back navigation
}

enum PageType {
    Game,              // Main game page (room view)
    Menu,              // Menu with tabs
    EntityInteraction, // Interacting with NPC/item
    Shop,              // Shop interface
    Container,         // Chest/container
    Combat,            // Combat UI
    Bardo,             // Death/resurrection
}

struct PageData {
    page_type: PageType,
    content: PageContent,
}

impl BookState {
    fn turn_to_page(&mut self, page_type: PageType) {
        self.page_history.push(self.current_page_index);
        let page_index = self.find_or_create_page(page_type);
        self.current_page_index = page_index;
        // Triggers curl animation
    }

    fn go_back(&mut self) {
        if let Some(prev) = self.page_history.pop() {
            self.current_page_index = prev;
            // Triggers reverse curl
        }
    }
}
```

---

#### Task 2.1.2: Page Curl Transitions (3 days)

**Goal:** Turn pages like a real book (reuse existing curl system)

**Tasks:**
- [ ] Integrate page navigation with existing curl animation
- [ ] Forward curl: current page curls, reveals next page
- [ ] Backward curl: reverse animation, return to previous
- [ ] Block input during curl animation
- [ ] Test: Open menu → page curls forward, close → curls back

**Acceptance Criteria:**
- [ ] Curl smoothly reveals next page content
- [ ] Back navigation feels like turning page backward
- [ ] Can't navigate mid-curl

**Technical Design:**
```rust
// Reuse existing PageCurlState from Phase 0/1
enum PageTurnDirection {
    Forward,   // Curl current page to reveal next
    Backward,  // Uncurl to reveal previous
}

// When user requests page change:
// 1. Set NavigationState.pending_page = new_page_type
// 2. Start curl animation (curl_state.start_turn(forward))
// 3. During curl, NextPage shows new content
// 4. On curl complete, swap CurrentPage content
// 5. Update BookState.current_page_index

// This is exactly what we already do for room navigation!
// Just extend it for different page types.
```

---

### P2.2 - Main Game Page Layout (1 week)

#### Task 2.2.1: Section-Based Layout (3 days)

**Goal:** Structured room view matching mobile app

**Tasks:**
- [ ] `PageSection` enum: Title, Description, Characters, Items, Exits, Events
- [ ] Layout engine: calculate Y position for each section
- [ ] Section headers with decorative dividers
- [ ] Automatic spacing between sections
- [ ] Test: Room with all sections renders correctly

**Acceptance Criteria:**
- [ ] Sections appear in correct order
- [ ] Spacing matches mobile app proportions
- [ ] All section types supported

**Mobile Reference:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Room Title - Large, Centered]

[Room Description - Prose, wrapped]

Characters:
  Elder Ming is standing by the fountain.
  Novice Pema is meditating.

Items:
  A fallen cherry blossom rests nearby.

Exits:
  > North to Temple
  > South to Garden

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Event Log - Auto-scroll]
> You arrive from the south.
> Elder Ming nods in greeting.
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Layout Code:**
```rust
enum PageSection {
    Title,
    Description,
    Characters,
    Items,
    Exits,
    Events,
}

fn layout_room_page(room: &Room, events: &[Event]) -> Vec<RenderSection> {
    let mut sections = vec![];
    let mut y = margin_top;

    // Title
    sections.push(RenderSection {
        section_type: PageSection::Title,
        y_offset: y,
        content: room.name.clone(),
    });
    y += title_height + section_spacing;

    // Description
    sections.push(RenderSection {
        section_type: PageSection::Description,
        y_offset: y,
        content: room.description.clone(),
    });
    y += calculate_wrapped_height(&room.description) + section_spacing;

    // ... more sections
}
```

---

#### Task 2.2.2: Event Log Integration (2 days)

**Goal:** Auto-scrolling event log at bottom of page

**Tasks:**
- [ ] Event log section at fixed bottom position
- [ ] Last N events visible (max 10)
- [ ] Auto-scroll to bottom when new event arrives
- [ ] Separator line between main content and events
- [ ] Test: Send 20 events, only last 10 visible

**Acceptance Criteria:**
- [ ] Events scroll independently of main content
- [ ] New events animate in (fade + slide)
- [ ] Old events disappear when exceeded

---

### P2.3 - Bottom Bar (1 week)

#### Task 2.3.1: Health & Resource Bars (2 days)

**Goal:** Visual health/resource display at bottom

**Tasks:**
- [ ] Health bar: red filled bar with current/max text
- [ ] Resource bars (qi, stamina, mana): colored bars
- [ ] Bar animations (smooth fill transitions)
- [ ] Low health warning (red pulse when < 25%)
- [ ] Test: Damage → health bar animates down

**Acceptance Criteria:**
- [ ] Bars update in real-time
- [ ] Fill percentage correct
- [ ] Colors match mobile theme

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  ❤ HP  ████████░░  80/100              │
│  ⚡ Qi  ██████████  50/50               │
│  🏃 Sta █████████░  90/100              │
└─────────────────────────────────────────┘
```

---

#### Task 2.3.2: Navigation & Menu Buttons (3 days)

**Goal:** Quick access to exits and menu

**Tasks:**
- [ ] Exit buttons: N/S/E/W/U/D directional layout
- [ ] Only show available exits (gray out blocked)
- [ ] Menu button (opens menu overlay)
- [ ] Chat button (opens text input modal)
- [ ] Calendar/time display (day/phase icon)
- [ ] Test: Tap exit → navigate, tap menu → overlay opens

**Acceptance Criteria:**
- [ ] Buttons respond to taps
- [ ] Disabled exits are non-interactive
- [ ] Icons/labels clear

**Button Layout:**
```
┌─────────────────────────────────────────┐
│       [N]                    [Menu]     │
│   [W]   [E]  [Chat]  [📅 Day 3, Dawn]  │
│       [S]                               │
└─────────────────────────────────────────┘
```

---

## Phase 3: Menu System (2-3 weeks)

### P3.1 - Menu Page Structure (4 days)

#### Task 3.1.1: Tab Bar System (2 days)

**Goal:** Tabbed navigation for menu page

**Tasks:**
- [ ] `MenuTab` enum: Character, Inventory, Quest, Craft, Spark, Social, Settings
- [ ] Tab bar across top of menu page
- [ ] Active tab highlight
- [ ] Tab switching (render different content, no animation needed)
- [ ] Test: Switch between all tabs

**Acceptance Criteria:**
- [ ] 7 tabs visible
- [ ] Active tab visually distinct
- [ ] Tap tab → content changes instantly (or quick fade)

**Note:** Tabs DON'T turn pages - they just swap content on the same menu page.

**Visual:**
```
┌─────────────────────────────────────────┐
│ [Char] [Inv] [Quest] [Craft] [Spark]   │
│ [Social] [Settings]              [×]    │
├─────────────────────────────────────────┤
│                                         │
│         [TAB CONTENT HERE]              │
│                                         │
└─────────────────────────────────────────┘
```

---

#### Task 3.1.2: Back Button & Menu Navigation (2 days)

**Goal:** Navigate to/from menu page

**Tasks:**
- [ ] Menu button on game page → turn to menu page
- [ ] [×] close button (top-right of menu page)
- [ ] Back button → turn back to game page
- [ ] Page curl animation for navigation
- [ ] Test: Open menu (curl) → close (curl back) → back to game

**Note:** NO overlay dimming - the game page is literally behind the menu page (invisible while menu showing).

---

### P3.2 - Character Tab (2 days)

**Goal:** Player stats and vitals

**Tasks:**
- [ ] Player name + level display
- [ ] XP progress bar
- [ ] Health/Qi/Stamina current/max values
- [ ] Attributes grid: STR, DEX, CON, INT, WIS, CHA
- [ ] Gold/currency display
- [ ] Test: Update stats → UI reflects changes

**Mobile Reference:** `mobile/src/components/MenuPanel.tsx` line 79

---

### P3.3 - Inventory Tab (4 days)

**Goal:** Item management

**Tasks:**
- [ ] Scrollable item list (name, quantity)
- [ ] Tap item → context menu (Use, Equip, Drop)
- [ ] Equipped items section (slots: weapon, armor, accessory)
- [ ] Weight/capacity bar
- [ ] Item icons (or text-based descriptions)
- [ ] Test: Equip item → moves to equipped section

**Mobile Reference:** `mobile/src/components/InventoryPanel.tsx`

---

### P3.4 - Quest Tab (3 days)

**Goal:** Quest tracking

**Tasks:**
- [ ] Active quests list (expandable)
- [ ] Quest title + brief description
- [ ] Objectives list with checkboxes (✓/☐)
- [ ] Progress indicators (3/5 wolves slain)
- [ ] Completed quests section (collapsible)
- [ ] Test: Complete objective → checkbox fills

**Mobile Reference:** `mobile/src/components/QuestPanel.tsx`

---

### P3.5 - Crafting Tab (3 days)

**Goal:** Crafting interface

**Tasks:**
- [ ] Recipe list (scrollable)
- [ ] Recipe details: ingredients needed, tools required
- [ ] "Craft" button (disabled if missing materials)
- [ ] Material availability indicator (red/green)
- [ ] Success/failure animation
- [ ] Test: Craft item → consumes materials, creates item

**Mobile Reference:** `mobile/src/components/CraftingPanel.tsx`

---

### P3.6 - Spark Tab (2 days)

**Goal:** Spark companion interface

**Tasks:**
- [ ] Spark question text input
- [ ] "Ask Spark" button
- [ ] Spark response display (conversational)
- [ ] Spark updates list (notifications)
- [ ] Dismiss updates button
- [ ] Test: Ask question → receive response

---

### P3.7 - Social Tab (2 days)

**Goal:** Emotes and poses

**Tasks:**
- [ ] Mood list: happy, sad, angry, calm, etc.
- [ ] Pose list: standing, sitting, kneeling, etc.
- [ ] Set mood/pose buttons
- [ ] Current mood/pose display (highlighted)
- [ ] Test: Set mood → server receives update

**Mobile Reference:** `mobile/src/components/SocialPanel.tsx`

---

### P3.8 - Settings Tab (2 days)

**Goal:** App settings

**Tasks:**
- [ ] Design variant picker (bottom bar styles)
- [ ] Logout button
- [ ] Version info display
- [ ] Sound toggle (future)
- [ ] Test: Logout → return to login screen

---

## Phase 4: Entity Interaction (1-2 weeks)

### P4.1 - Entity Interaction Page (3 days)

**Goal:** Interact with entities (NPCs, items, players)

**Tasks:**
- [ ] Turn to entity page when entity tapped
- [ ] Entity name (large, at top)
- [ ] Entity description (short_desc)
- [ ] Available actions list (buttons): Talk, Trade, Attack, Examine
- [ ] Close button (turns back to game page)
- [ ] Test: Tap NPC → page curls to entity page

**Mobile Reference:** `mobile/src/components/EntityContext.tsx`

**Navigation:**
```
Game Page → Tap "Elder Ming" → Turn page → Entity Page (Elder Ming)
Entity Page → [×] button → Turn back → Game Page
```

---

### P4.2 - Dialogue System (4 days)

**Goal:** NPC conversations with choices

**Tasks:**
- [ ] Dialogue text display (NPC speech)
- [ ] Dialogue choices (multiple buttons)
- [ ] Choice selection → send to server → next dialogue
- [ ] Dialogue history (scrollable conversation log)
- [ ] End dialogue button
- [ ] Test: Talk to NPC → choose option → conversation continues

**Acceptance Criteria:**
- [ ] Choices numbered (1, 2, 3...)
- [ ] Previous dialogue visible above choices
- [ ] Can scroll through conversation history

---

### P4.3 - Action Feedback (2 days)

**Goal:** Visual feedback for actions

**Tasks:**
- [ ] Action result displayed in event log
- [ ] Success animation (green flash)
- [ ] Failure animation (red shake)
- [ ] Return to main page after action (auto-close overlay)
- [ ] Test: Attack entity → damage appears in log, overlay closes

---

## Phase 5: Special Modals (1-2 weeks)

### P5.1 - Shop Interface (3 days)

**Goal:** Buy/sell items

**Tasks:**
- [ ] Turn to shop page when shop opened
- [ ] Two columns: Shop inventory | Your inventory
- [ ] Item prices (gold)
- [ ] Buy button (next to shop items)
- [ ] Sell button (next to your items)
- [ ] Gold balance display (updates on transaction)
- [ ] Close button (turns back to game page)
- [ ] Test: Enter shop → page curls to shop page

**Mobile Reference:** `mobile/src/components/ShopModal.tsx`

**Navigation:**
```
Game Page → Talk to Merchant → Select "Trade" → Turn page → Shop Page
Shop Page → [Done] button → Turn back → Game Page
```

---

### P5.2 - Container Interface (2 days)

**Goal:** Loot chests/containers

**Tasks:**
- [ ] Turn to container page when container opened
- [ ] Container name + description
- [ ] Contents list (scrollable)
- [ ] Take item button
- [ ] Take all button (optional)
- [ ] Close container button (turns back to game)
- [ ] Test: Open chest → page curls to container page

**Mobile Reference:** `mobile/src/components/ContainerModal.tsx`

**Navigation:**
```
Game Page → Tap chest → Turn page → Container Page
Container Page → [Close] button → Turn back → Game Page
```

---

### P5.3 - Combat Page (5 days)

**Goal:** Combat UI

**Tasks:**
- [ ] Turn to combat page when combat starts
- [ ] Enemy name + health bar (at top)
- [ ] Your health bar (at bottom)
- [ ] Combat log (scrolling events)
- [ ] Ability buttons (if applicable)
- [ ] Flee button (turns back to game page)
- [ ] Victory screen (loot, XP) → then turn back to game
- [ ] Defeat screen → turn to bardo page
- [ ] Test: Enter combat → curl to combat page

**Mobile Reference:** `mobile/src/components/CombatOverlay.tsx`

**Navigation:**
```
Game Page → Enter combat → Turn page → Combat Page
Combat Page → Victory → Turn back → Game Page
Combat Page → Defeat → Turn page → Bardo Page
```

**Combat Layout:**
```
┌─────────────────────────────────────────┐
│  🐺 Dire Wolf                           │
│  HP: ████████░░  80/100                 │
├─────────────────────────────────────────┤
│  > You strike the dire wolf for 15 dmg │
│  > The dire wolf bites you for 8 dmg   │
│  > You dodge the attack!                │
├─────────────────────────────────────────┤
│  ❤ Your HP: ██████░░░░  60/100         │
│  [Attack] [Defend] [Ability] [Flee]    │
└─────────────────────────────────────────┘
```

---

## Implementation Order

**Critical path (do first):**
1. P1.4-P1.5 (finish Phase 1)
2. P2.1 (multi-page foundation)
3. P2.2-P2.3 (main page + bottom bar)
4. P3.1-P3.3 (menu with Character, Inventory, Quest)
5. P4.1-P4.2 (entity interaction + dialogue)
6. P7 (RN bridge - separate plan)
7. P8 (game integration - separate plan)

**High value (do second):**
8. P5.1-P5.3 (shop, container, combat)
9. P3.4-P3.8 (remaining menu tabs)
10. P6 (visual effects - separate plan)

---

## Task Loading Pattern

To load these tasks into Claude Code's task system:

```typescript
// Example task creation
createTask({
  subject: "P2.1.1: Multi-Page Book Struct",
  description: "Create BookState resource with page stack supporting multiple pages...",
  activeForm: "Creating multi-page book structure",
  metadata: {
    phase: "2",
    estimate_days: 2,
    dependencies: ["P1.4", "P1.5"],
    reference: "book-client/docs/TASK_BREAKDOWN.md#task-211",
  }
});
```

---

## Next Steps

1. **Review this plan** - Confirm scope and priorities
2. **Load Phase 1 remaining tasks** - Start with P1.4 and P1.5
3. **Begin Phase 2** - Multi-page system is critical foundation
4. **Iterate** - Complete one task at a time, test, commit, repeat
