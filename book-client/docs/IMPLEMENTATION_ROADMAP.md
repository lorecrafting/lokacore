# Rust/Bevy 3D Book Client - Complete Implementation Roadmap

**Status:** Phase 0 & Phase 1 Core Complete
**Current Focus:** Porting Mobile UI Features to 3D Book
**Target:** Full-featured playable game in 3D book format

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  REACT NATIVE APP - Existing Mobile Client (2D Reference)   │
├─────────────────────────────────────────────────────────────┤
│  ✅ Phoenix WebSocket (game state, authentication)           │
│  ✅ Audio (expo-av)                                          │
│  ✅ All game UI: RoomView, Inventory, Quests, Combat, etc.  │
│                                                              │
│              │ uniffi-bindgen-react-native (FFI)             │
│              ▼                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  RUST/BEVY 3D BOOK - New 3D Renderer                 │   │
│  │  ✅ 3D book with page turning                         │   │
│  │  ✅ Text rendering with effects                       │   │
│  │  ⬜ Port ALL mobile UI features to book pages        │   │
│  │  ⬜ Multi-page book (turn pages, not overlays)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:** Server → RN WebSocket → uniffi → Rust/Bevy → 3D Book
**User Input:** Tap Book → Rust/Bevy → uniffi → RN → Server

### **Key Architectural Decision: Pages, Not Modals**

**Important:** There are NO floating modals or overlays. The mobile app's "modals" become **pages you turn to** in the book.

- ✅ **Menu modal** = Turn to menu page
- ✅ **Shop modal** = Turn to shop page
- ✅ **Entity context** = Turn to entity page
- ✅ **Combat overlay** = Turn to combat page

This is simpler and more aligned with the book metaphor. We reuse the existing page curl system from Phase 0/1.

---

## Mobile App UI Features to Port

### Current Mobile App Structure

The React Native app has these UI components (all need 3D book equivalents):

| Component | Purpose | 3D Book Equivalent |
|-----------|---------|-------------------|
| **RoomView** | Main room display, entities, event log | Game page (page 1) |
| **BottomBar** | Navigation (exits), chat, health, menu button | Always visible on current page |
| **MenuPanel** | 6-tab panel: Character, Inventory, Quests, Crafting, Socials, Settings | Menu page (turn to page 2) |
| **EntityContextModal** | Interact with entities, dialogue choices | Entity page (turn to page N) |
| **CombatOverlay** | Combat UI with enemy health, abilities | Combat page (turn to page N) |
| **ShopModal** | Buy/sell interface | Shop page (turn to page N) |
| **ContainerModal** | Chest/container contents | Container page (turn to page N) |
| **BardoOverlay** | Death/resurrection | Bardo page (turn to page N) |

### Key Mobile UI Patterns

**Text Linking:**
- Underlined keywords (entities, exits, items)
- Tap keyword → open entity context or navigate
- NO hover effects (mobile doesn't have hover)
- Example: "You see **Elder Ming** standing by the fountain."

**Visual Aesthetics:**
- Sepia/parchment backgrounds
- Serif fonts (Georgia, Crimson Text)
- Subtle environmental effects (candle flicker in darkness)
- Time-of-day color shifts (dawn/day/dusk/night)

---

## Phase Breakdown

### ✅ **Phase 0: Spike (COMPLETE)**
- ✅ Page mesh with curl animation
- ✅ Text-to-texture rendering
- ✅ GPU shader effects (fire, ice)
- ✅ Test app with monastery world

### 🟡 **Phase 1: Core Interaction (90% COMPLETE)**

#### Completed:
- ✅ P1.1: UV lookup (ray-mesh intersection)
- ✅ P1.2: Link region tracking
- ✅ P1.3: Hit testing (UV → link action)
- ✅ P1.6: End-to-end navigation

#### Remaining:
- ⬜ **P1.4**: Underlined links (visual indicator)
  - Match mobile app: underline keyword only, not whole line
  - No hover state (mobile pattern)
  - Example: "You see **<u>Elder Ming</u>** standing here."

- ⬜ **P1.5**: Text scrolling
  - Long room descriptions + event log scroll within page
  - Swipe up/down to scroll
  - Auto-scroll to bottom when new events arrive

---

### ⬜ **Phase 2: Multi-Page Book System (NEW - Critical Foundation)**

**Goal:** Enable multiple pages/overlays in the book (main page + menu page + modals)

#### P2.1 - Page System Architecture (1 week)
- [ ] Multi-page book struct (each "modal" is just another page)
- [ ] Page stack management (navigate forward/back between pages)
- [ ] Page curl transitions (turn to new page)
- [ ] Page types: Game, Menu, EntityInteraction, Shop, Container, Combat

#### P2.2 - Main Game Page Layout (1 week)
- [ ] Room title at top (large, centered)
- [ ] Room description (scrollable prose)
- [ ] Section headers: "Characters:", "Items:", "Exits:", "Events:"
- [ ] Entity listings with underlined names
- [ ] Event log at bottom (auto-scrolling)
- [ ] Match mobile RoomView layout exactly

#### P2.3 - Bottom Bar (1 week)
- [ ] Footer area always visible (like book footer)
- [ ] Health bar (visual bar, not just text)
- [ ] Resource bars (qi, stamina, etc.)
- [ ] Quick navigation buttons (exits as directional buttons)
- [ ] Chat button (opens input modal)
- [ ] Menu button (opens menu page)
- [ ] Calendar/time display

---

### ⬜ **Phase 3: Menu System (2-3 weeks)**

**Goal:** Port MenuPanel tabs to multi-page book experience

#### P3.1 - Menu Page Structure (4 days)
- [ ] Dedicated menu book page (overlays main page)
- [ ] Tab bar across top: Character | Inventory | Quests | Craft | Spark | Social | Settings
- [ ] Tab switching (turn pages left/right or fade)
- [ ] Back button returns to main game page

#### P3.2 - Character Tab (2 days)
- [ ] Player name + level
- [ ] XP progress bar
- [ ] Health/Resource display
- [ ] Attributes (STR, DEX, CON, INT, WIS, CHA)
- [ ] Gold/currency

#### P3.3 - Inventory Tab (4 days)
- [ ] Scrollable item list
- [ ] Item icons (or text descriptions)
- [ ] Tap item → context menu (Use, Equip, Drop)
- [ ] Equipped items section (separate area)
- [ ] Weight/capacity indicator

#### P3.4 - Quest Tab (3 days)
- [ ] Active quests list
- [ ] Quest objectives with checkboxes
- [ ] Quest descriptions
- [ ] Completed quests section (collapsible)
- [ ] Quest rewards preview

#### P3.5 - Crafting Tab (3 days)
- [ ] Available recipes list
- [ ] Recipe requirements (ingredients, tools)
- [ ] "Craft" button (disabled if missing materials)
- [ ] Success/failure feedback

#### P3.6 - Spark Tab (2 days)
- [ ] Spark companion UI
- [ ] Ask Spark question input
- [ ] Spark responses (conversational)
- [ ] Spark updates notification badge

#### P3.7 - Social Tab (2 days)
- [ ] Emotes list (moods: happy, sad, etc.)
- [ ] Poses list (standing, sitting, etc.)
- [ ] Set mood/pose buttons
- [ ] Current mood/pose display

#### P3.8 - Settings Tab (2 days)
- [ ] Design variant picker (bottom bar styles)
- [ ] Logout button
- [ ] Version info

---

### ⬜ **Phase 4: Entity Interaction (1-2 weeks)**

**Goal:** Port EntityContextModal to 3D overlay page

#### P4.1 - Entity Context Overlay (3 days)
- [ ] Overlay page appears on top of main page
- [ ] Entity name + description
- [ ] Available actions (Talk, Trade, Attack, etc.)
- [ ] Close button (dismisses overlay)

#### P4.2 - Dialogue System (4 days)
- [ ] NPC dialogue text display
- [ ] Dialogue choices (multiple choice buttons)
- [ ] Dialogue history (scrollable conversation)
- [ ] Continue/End dialogue buttons
- [ ] Inline dialogue (stays in entity context)

#### P4.3 - Action Feedback (2 days)
- [ ] Action results shown in event log
- [ ] Success/failure animations
- [ ] Return to main page after action

---

### ⬜ **Phase 5: Special Modals (1-2 weeks)**

**Goal:** Port ShopModal, ContainerModal, CombatOverlay

#### P5.1 - Shop Interface (3 days)
- [ ] Shop overlay page
- [ ] Two columns: Shop inventory | Your inventory
- [ ] Item prices
- [ ] Buy/Sell buttons
- [ ] Gold balance display
- [ ] Transaction feedback

#### P5.2 - Container Interface (2 days)
- [ ] Container overlay page
- [ ] Container contents list
- [ ] Take item button
- [ ] Weight/capacity indicator
- [ ] Close container

#### P5.3 - Combat Overlay (5 days)
- [ ] Combat page (replaces main during combat)
- [ ] Enemy name + health bar
- [ ] Your health bar
- [ ] Combat log (actions, damage, etc.)
- [ ] Ability buttons (if applicable)
- [ ] Flee button
- [ ] Victory/defeat transitions

---

### ⬜ **Phase 6: Visual Effects & Polish (2-3 weeks)**

**Goal:** Port mobile environmental effects to 3D

#### P6.1 - Time-of-Day Effects (3 days)
- [ ] Dawn: warm orange tint, fade in
- [ ] Day: bright, high contrast
- [ ] Dusk: warm red/purple tint
- [ ] Night: cool blue, reduced visibility, candle flicker
- [ ] Phase transitions (smooth color/opacity changes)

#### P6.2 - Weather Effects (3 days)
- [ ] Rain: water droplets on page, blur effect
- [ ] Snow: falling particles, cold tint
- [ ] Fog: reduced visibility, hazy text
- [ ] Storm: screen shake, dramatic effects

#### P6.3 - Text Effects from Server (4 days)
- [ ] Fire text (server sends fire effect tag)
- [ ] Ice text (frosty blue glow)
- [ ] Damage numbers (red, floating)
- [ ] Healing numbers (green, floating)
- [ ] Magic/glow effects

#### P6.4 - Visual Polish (4 days)
- [ ] Bloom post-processing
- [ ] Parchment texture (not flat color)
- [ ] Page edge glow/shadow
- [ ] Subtle page curl in breeze
- [ ] Candle flicker in darkness
- [ ] Screen shake on hits

---

### ⬜ **Phase 7: React Native Bridge (2-3 weeks)**

**Goal:** Connect Rust renderer to existing RN app

#### P7.1 - uniffi Setup (3 days)
- [ ] uniffi UDL interface definition
- [ ] Generate Swift bindings
- [ ] Test basic RN → Rust calls

#### P7.2 - Surface Rendering (4 days)
- [ ] Native view component in RN
- [ ] Pass CAMetalLayer to Rust
- [ ] Rust renders into RN view
- [ ] Handle view lifecycle

#### P7.3 - Event Flow (3 days)
- [ ] RN → Rust: room updates, text, effects
- [ ] Rust → RN: tap events (link actions, menu, etc.)
- [ ] Callback mechanism for async events

#### P7.4 - State Synchronization (4 days)
- [ ] Game state → Rust render commands
- [ ] Inventory updates
- [ ] Quest updates
- [ ] Health/resource updates

---

### ⬜ **Phase 8: Game Integration (2-3 weeks)**

**Goal:** Full game playable in 3D book via RN bridge

#### P8.1 - Server Message Handling (4 days)
- [ ] Parse GameChannel messages
- [ ] Convert to Rust render commands
- [ ] Update all UI components (room, inventory, etc.)

#### P8.2 - User Input Handling (3 days)
- [ ] Tap link → send action to server
- [ ] Navigate → send move command
- [ ] Chat → send say/shout
- [ ] Menu actions → send to server

#### P8.3 - Combat Integration (3 days)
- [ ] Combat events update combat page
- [ ] Ability usage → server actions
- [ ] Combat victory/defeat handling

#### P8.4 - Quest Flow (2 days)
- [ ] Quest acceptance
- [ ] Objective tracking
- [ ] Quest completion
- [ ] Reward display

---

### ⬜ **Phase 9: Mobile Build & Polish (2 weeks)**

**Goal:** Production-ready iOS build

#### P9.1 - iOS Build Pipeline (3 days)
- [ ] Xcode integration
- [ ] Universal binary (simulator + device)
- [ ] Release build optimization

#### P9.2 - Performance Optimization (4 days)
- [ ] 60fps on iPhone 12+
- [ ] Memory profiling
- [ ] Texture optimization
- [ ] GPU profiling

#### P9.3 - Edge Cases (3 days)
- [ ] App backgrounding/foregrounding
- [ ] Network disconnection
- [ ] Error recovery
- [ ] Onboarding/tutorial

#### P9.4 - Android (Optional, deferred)
- [ ] Android NDK build
- [ ] Vulkan backend
- [ ] Device testing

---

## Implementation Priority

### Critical Path (Must Have for MVP):
1. **Phase 2** - Multi-page system (foundation for everything)
2. **Phase 3.1-3.3** - Menu with Character, Inventory, Quest tabs
3. **Phase 4** - Entity interaction + dialogue
4. **Phase 7** - RN bridge
5. **Phase 8** - Game integration

### High Value (Should Have):
6. **Phase 5** - Shop, Container, Combat
7. **Phase 6.1** - Time-of-day effects
8. **Phase 3.4-3.8** - Remaining menu tabs

### Nice to Have (Can Defer):
9. **Phase 6.2-6.4** - Advanced visual polish
10. **Phase 9.4** - Android build

---

## Task Breakdown Format

Each phase task follows this structure:

```
## P[Phase].[Task] - [Name] ([Duration])

### Goal
[What this accomplishes]

### Acceptance Criteria
- [ ] Specific deliverable 1
- [ ] Specific deliverable 2
- [ ] Test case passes

### Technical Notes
[Implementation hints, gotchas, references]

### Dependencies
- Requires: [Previous tasks]
- Blocks: [Future tasks]
```

---

## Current Status

**Completed:**
- ✅ Phase 0: Spike (book rendering proof of concept)
- ✅ Phase 1: 90% (core tap-to-interact, needs underline + scrolling)

**Next Up:**
- ⬜ **P1.4**: Finish underlined links
- ⬜ **P1.5**: Finish text scrolling
- ⬜ **Phase 2**: Multi-page book system (CRITICAL FOUNDATION)

**Estimated Timeline:**
- Phases 1-3: 6-8 weeks
- Phases 4-5: 3-4 weeks
- Phases 6-8: 6-8 weeks
- Phase 9: 2 weeks
- **Total MVP: 17-22 weeks (~4-5 months)**

---

## Design Philosophy

**Port mobile UI 1:1, then enhance with 3D magic:**

1. **Start with mobile parity** - All mobile features must work in 3D book
2. **Respect mobile UX patterns** - No hover states, underline-only links
3. **Enhance with 3D** - Page turning, depth, particles, shaders
4. **Maintain readability** - Text always legible, even with effects
5. **Performance first** - 60fps on target devices (iPhone 12+)

**Visual Style:**
- Magical book aesthetic (parchment, ink, ambient effects)
- Time-of-day environmental changes
- Subtle particle effects (dust, embers, snowflakes)
- Screen-space effects for dramatic moments

---

## Mobile App as Reference

**Key files to reference during implementation:**

```
mobile/
├── app/game.tsx                 # Main game screen structure
├── src/components/
│   ├── RoomView.tsx            # Main room display layout
│   ├── BottomBar.tsx           # Health bar, nav, chat
│   ├── MenuPanel.tsx           # 6-tab menu system
│   ├── EntityContext.tsx       # Entity interaction + dialogue
│   ├── CombatOverlay.tsx       # Combat UI
│   ├── ShopModal.tsx           # Shop interface
│   ├── ContainerModal.tsx      # Container interface
│   ├── InventoryPanel.tsx      # Inventory tab
│   ├── QuestPanel.tsx          # Quest tab
│   ├── CraftingPanel.tsx       # Crafting tab
│   ├── SocialPanel.tsx         # Social/emotes tab
│   └── StatsPanel.tsx          # Character tab (stats)
├── src/hooks/
│   ├── usePhoenix.ts           # WebSocket game state
│   └── useAuth.ts              # Authentication
└── src/theme.ts                # Colors, fonts, spacing
```

**Testing Strategy:**
- Reference mobile app for expected behavior
- Screenshot comparison (mobile 2D vs book 3D)
- Feature parity checklist (can do everything mobile can)

---

## Success Metrics

**MVP is "done" when:**
- [ ] All mobile UI features work in 3D book
- [ ] Can play through tutorial quest using book client
- [ ] 60fps on iPhone 12
- [ ] Passes feature parity test (checklist vs mobile app)
- [ ] Internal team prefers book client over mobile app

