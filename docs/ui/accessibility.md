# Accessibility Guide

This document covers accessibility features, current compliance status, and implementation guidelines for Loka's game client.

## Current Status

### WCAG 2.1 Compliance

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | Partial | Most interactive elements have aria-labels |
| 1.3.1 Info and Relationships | A | Partial | Semantic HTML used, some complex relationships need improvement |
| 1.4.1 Use of Color | A | Pass | Grayscale design doesn't rely on color alone |
| 1.4.3 Contrast | AA | Pass | High contrast (black on cream background) |
| 2.1.1 Keyboard | A | Partial | Basic tab navigation works, arrow keys not implemented |
| 2.4.1 Bypass Blocks | A | Pass | Skip link implemented |
| 2.4.3 Focus Order | A | Pass | Logical tab order |
| 2.4.7 Focus Visible | AA | Pass | Clear focus indicators on all interactive elements |
| 4.1.2 Name, Role, Value | A | Partial | Most components labeled, some gaps |

### Screen Reader Support

| Feature | NVDA | VoiceOver | JAWS |
|---------|------|-----------|------|
| Room descriptions | Works | Works | Works |
| Navigation compass | Works | Works | Works |
| Combat actions | Works | Works | Works |
| Dialogue choices | Works | Works | Works |
| Inventory management | Partial | Partial | Partial |
| Quest log | Works | Works | Works |

## Implemented Features

### ARIA Attributes

All interactive components include appropriate ARIA attributes:

```html
<!-- Navigation compass -->
<div role="group" aria-label="Navigation compass">
  <button aria-label="Go North">North</button>
  <button aria-label="East - not available" aria-disabled="true">East</button>
</div>

<!-- Combat log with live updates -->
<div class="ebook-combat-log" role="log" aria-live="assertive" aria-label="Combat log">
  <!-- Combat messages announced to screen readers -->
</div>

<!-- Dialogue with menu semantics -->
<ul class="ebook-menu" role="menu" aria-label="Dialogue options">
  <li role="menuitem">
    <button aria-label="Say: Ask about the monastery">Ask about the monastery</button>
  </li>
</ul>

<!-- Emote tabs -->
<div role="tablist" aria-label="Emote categories">
  <button role="tab" aria-selected="true">Gestures</button>
</div>
```

### Focus Management

Focus indicators are visible for all interactive elements:

```css
/* Standard focus indicator */
.ebook-link:focus-visible {
  outline: 2px solid #000000;
  outline-offset: 2px;
}

/* High contrast mode - enhanced focus */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline: 3px solid currentColor !important;
    outline-offset: 2px !important;
  }
}
```

### Skip Link

A skip link allows keyboard users to bypass repetitive navigation:

```css
.skip-link:focus {
  position: fixed;
  top: 0;
  /* Becomes visible when focused */
}
```

### Live Regions

Dynamic content is announced via ARIA live regions:

| Component | Live Region | Politeness |
|-----------|-------------|------------|
| Combat log | `role="log"` | `aria-live="assertive"` |
| Dialogue | `role="log"` | `aria-live="polite"` |
| Event log | Implicit | Updates read when idle |

## Implementation Guidelines

### Adding New Components

1. **Use semantic HTML first**
   ```elixir
   # Prefer semantic elements
   ~H"""
   <nav aria-label="Main navigation">
   <button type="button">
   <ul role="menu">
   """
   ```

2. **Add descriptive aria-labels**
   ```elixir
   ~H"""
   <button
     phx-click="action"
     aria-label={"Perform #{@action_name}"}
   >
     {@action_name}
   </button>
   """
   ```

3. **Handle disabled states**
   ```elixir
   ~H"""
   <button
     disabled={not @can_use}
     aria-disabled={not @can_use}
     aria-label={"#{@name}#{if not @can_use, do: " (unavailable)", else: ""}"}
   >
   """
   ```

4. **Provide context for dynamic content**
   ```elixir
   ~H"""
   <div role="log" aria-live="polite" aria-label="Game events">
     <%= for event <- @events do %>
       <p>{event.text}</p>
     <% end %>
   </div>
   """
   ```

### Testing Accessibility

1. **Keyboard-only navigation**
   - Tab through all interactive elements
   - Verify focus order is logical
   - Ensure all actions are keyboard-accessible

2. **Screen reader testing**
   ```bash
   # macOS VoiceOver
   Cmd + F5 to toggle

   # Windows NVDA
   Free download from nvaccess.org
   ```

3. **Automated testing**
   ```bash
   # Run axe-core via browser devtools
   # Check Lighthouse accessibility score
   ```

4. **Manual checklist**
   - [ ] All images have alt text (or aria-hidden if decorative)
   - [ ] All form inputs have labels
   - [ ] Color is not the only indicator
   - [ ] Focus is visible on all interactive elements
   - [ ] Dynamic content uses live regions

## Planned Improvements

### P3 Priority (In Progress)

1. **Accessibility Settings Panel** (lokacore-vpcm)
   - Font size adjustment
   - Reduced motion toggle
   - High contrast mode toggle
   - Screen reader announcement verbosity

2. **Combat Pace Options** (lokacore-buuj)
   - Adjustable combat speed
   - Auto-combat for users with motor impairments
   - Pause-and-review mode

### Future Enhancements

1. **Full Keyboard Navigation**
   - Arrow key navigation in menus
   - Keyboard shortcuts for common actions
   - Focus trap in modals/panels

2. **Enhanced Screen Reader Support**
   - More detailed room descriptions
   - Combat state summaries
   - Inventory item descriptions

3. **Motor Accessibility**
   - Click-and-hold alternatives
   - Switch device support
   - Voice control integration

## Component Reference

### Navigation Components

| Component | File | ARIA Role | Notes |
|-----------|------|-----------|-------|
| Bottom bar | `navigation_components.ex:24` | `nav` | Contains all navigation controls |
| Compass | `navigation_components.ex:62` | `group` | Direction buttons in group |
| Chat panel | `navigation_components.ex:269` | N/A | Form with labeled inputs |
| Cutscene | `navigation_components.ex:338` | N/A | Buttons with aria-labels |

### Combat Components

| Component | File | ARIA Role | Notes |
|-----------|------|-----------|-------|
| Combat log | `combat_components.ex:32` | `log` | Live region for updates |
| Action menu | `combat_components.ex:61` | `menu` | Menu items for actions |
| Ability list | `combat_components.ex:99` | N/A | Buttons with disabled states |

### Dialogue Components

| Component | File | ARIA Role | Notes |
|-----------|------|-----------|-------|
| Dialogue log | `dialogue_components.ex:28` | `log` | Polite live region |
| Choice menu | `dialogue_components.ex:38` | `menu` | Menu items for choices |

### Emote Components

| Component | File | ARIA Role | Notes |
|-----------|------|-----------|-------|
| Category tabs | `emote_components.ex:91` | `tablist` | Tab navigation |
| Emote list | `emote_components.ex:148` | N/A | List with labeled buttons |
| Target selection | `emote_components.ex:190` | N/A | List with labeled buttons |

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Phoenix LiveView Accessibility](https://hexdocs.pm/phoenix_live_view/accessibility.html)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
