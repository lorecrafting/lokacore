# UX Audit

Review player experience and UI consistency across the game.

> **Timeout Budget**: 8 minutes

## Areas to Audit

### A. Game Flow
- New player onboarding (first 5 minutes)
- Quest progression clarity
- Navigation intuitiveness
- Combat feedback quality
- Death/respawn experience

### B. UI Consistency
- Component styling uniformity
- Interaction patterns (click, hover states)
- Loading states and feedback
- Error message clarity
- Empty states handling

### C. Information Architecture
- Room descriptions vs actual content
- NPC dialogue length and pacing
- Item descriptions usefulness
- Quest log clarity
- Context panel information density

### D. Style Guide Compliance
- Check against docs/ui/living-ebook-style-guide.md
- Defined color palette usage consistency
- Typography patterns match spec
- Component spacing uniformity

> **Note**: Technical accessibility (ARIA, WCAG) covered by dedicated `/audit-accessibility`. This section focuses on visual consistency.

### E. Feedback & Polish
- Action confirmation feedback
- Combat damage numbers
- Quest progress notifications
- Ambient messages timing
- Sound/visual cue consistency (future)

### F. Edge Cases
- Inventory full scenarios
- Currency insufficient states
- Quest prerequisite messaging
- Locked area feedback
- Offline/reconnect handling
- Browser back/forward button handling
- Multiple tab handling (same account)

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. UX issues prioritized by player impact (bead-ready format)
2. Screenshots or recordings if helpful
3. Specific component/file references
4. Note if docs/ui/living-ebook-style-guide.md needs pattern clarification
