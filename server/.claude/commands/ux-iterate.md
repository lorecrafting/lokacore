# UX Iteration Session

Start an interactive UX improvement session with visual feedback.

> **Mode**: Interactive with screenshots

## Session Flow

### 1. Capture Current State
Take a screenshot of the game client at the specified URL (default: localhost:4000/game).

### 2. Analyze Against Style Guide
Compare the screenshot against docs/ui/living-ebook-style-guide.md:
- Color palette compliance (grayscale only)
- Typography (Crimson Text, sizes, weights)
- Interaction patterns (underlines, not buttons)
- Spacing and breathing room
- Literary tone vs technical language

### 3. Identify Top Issues
List the 3 most impactful UX issues, prioritized by:
1. Breaks immersion (literary aesthetic violated)
2. Confuses player (unclear what to do)
3. Inconsistent with established patterns

### 4. Generate Fixes
For each issue, provide:
- Exact file path and line number
- Current code
- Proposed change
- Why it improves UX

### 5. Iterate
After applying a fix:
- Take new screenshot
- Verify the change
- Move to next issue or refine

## Quick Commands

During the session, you can say:
- "screenshot" - Capture current state
- "analyze [element]" - Focus on specific UI element
- "fix [issue]" - Apply the suggested fix
- "compare" - Show before/after
- "style check" - Audit against style guide
- "next" - Move to next issue

## Files to Reference

- Style guide: docs/ui/living-ebook-style-guide.md
- Game client: lib/loka_web/live/game_live.ex
- Components: lib/loka_web/live/game_live/components/
- CSS: assets/css/app.css
