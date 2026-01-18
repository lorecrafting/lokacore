# UI Polish & Chaos Testing

Comprehensive UI testing skill for web and mobile applications.

## Usage

```
/ui-polish-chaos-test [URL or app identifier]
```

## Prompt

You are performing comprehensive UI polish and chaos testing on the specified interface. Your goal is to make the UI EXTREMELY polished, solid, and well put together.

### Phase 1: Visual Inspection
1. Take a screenshot and analyze the overall visual design
2. Check for:
   - Text overlapping or clipping
   - Alignment issues
   - Inconsistent spacing/margins
   - Color contrast problems
   - Font consistency
   - Icon alignment
   - Responsive layout issues
3. Fix any visual issues found before proceeding

### Phase 2: Comprehensive Interactive Testing
Click on EVERYTHING that is clickable:
- Buttons (all of them)
- Links
- Tabs
- Dropdown menus
- Form inputs
- Checkboxes/radio buttons
- Expandable sections
- Context menus
- Modal triggers
- Navigation items
- Cards/list items
- Icons that might be interactive

For EACH interaction:
1. Take a screenshot before the action
2. Perform the action
3. Take a screenshot after
4. Verify correct state change occurred
5. Check for visual polish in the new state
6. If anything can be done better, fix it
7. Clean up: If you created something, delete it. If you edited something, restore it.

### Phase 3: State Verification
After each click, verify:
- Loading states appear and disappear correctly
- Success/error messages display properly
- Form validation works
- Data persists correctly
- Navigation works as expected
- Undo/redo functionality (if applicable)
- Empty states look polished
- Error states are user-friendly

### Phase 4: Chaos Engineering
Try to break things:
- Rapid clicking
- Double-clicking single-click elements
- Clicking during loading states
- Submitting empty forms
- Submitting with invalid data
- Very long text inputs
- Special characters in inputs
- Pressing escape during modals
- Using keyboard shortcuts
- Resizing window during operations
- Clicking outside modals
- Navigating away during operations
- Network slowdown simulation (if possible)

### Phase 5: Edge Cases
Test edge cases:
- First-time user experience (empty states)
- Maximum data (many items)
- Very long names/text
- Unicode characters
- RTL text (if applicable)
- Deep nesting
- Concurrent operations

### Phase 6: Polish Loop
Continuously loop through:
1. Look at the current state
2. Identify anything that could be more polished
3. Fix it
4. Verify the fix looks good
5. Move to next area
6. Repeat until everything is EXTREMELY polished

### Guidelines
- Be thorough - check every clickable element
- Be destructive - try to break things
- Be constructive - fix what you find
- Be clean - restore state after testing
- Be persistent - keep looping until perfect
- Document significant issues found
- Prioritize user-facing polish

### Reporting
After testing, provide:
1. Issues found and fixed
2. Issues found that require code changes
3. Areas that passed all tests
4. Recommendations for further improvement
