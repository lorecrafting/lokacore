# Update Development Log

Generate devlog entries for all days since the last documented entry.

## Instructions

1. **Find the last documented date** in `docs/devlog/DEVELOPMENT_LOG.md`
   - Look for the most recent "### Month Day, Year" heading
   - Note the date

2. **Get git commits since that date**:
   ```bash
   cd /Users/raymondluong/dev/lokacore && git log --reverse --format="%h|%ad|%s" --date=short --since="LAST_DATE"
   ```

3. **Group commits by date** and generate entries for each day

4. **For each new day, create three versions**:

   ### A. Technical Log Entry (DEVELOPMENT_LOG.md)
   Format:
   ```markdown
   ### Month Day, Year (Day N) - [Theme]
   **Commits**: X | **Focus**: [Main focus area]

   [Bullet points of what was done, grouped by theme]

   - **Feature Name**: Description
   - **Fix**: What was fixed
   - **Refactor**: What was refactored
   ```

   ### B. Public Narrative Entry (PUBLIC_DEVLOG.md)
   - Write in first person, storytelling style
   - Include challenges faced and lessons learned
   - Make it engaging for non-technical readers
   - Add to the "Week N" section or create new week section

   ### C. Social Media Snippets (BLOG_POSTS.md)
   - Twitter version (280 chars)
   - Long form version (3-4 paragraphs)
   - Add as new "Post N" section

5. **Update statistics** in DEVELOPMENT_LOG.md:
   - Total commits count
   - Development days count
   - Most active day (if changed)

## Writing Guidelines

### For Technical Log:
- Be comprehensive but concise
- Group related commits
- Note architectural decisions
- Include commit counts

### For Public Narrative:
- Start with a hook ("Today I discovered..." or "The problem was...")
- Include the struggle, not just the solution
- End with a lesson or reflection
- Keep it human and relatable

### For Social Media:
- Twitter: One key insight or achievement
- Long form: Story arc (problem → attempt → solution → lesson)

## Example Day Entry

### Technical (DEVELOPMENT_LOG.md):
```markdown
### January 10, 2026 (Day 26) - Bot Testing Improvements
**Commits**: 8 | **Focus**: ChannelBot reliability

- **Bot Navigation**: Fixed pathfinding edge cases in circular room layouts
- **Quest Tracking**: Bot now properly tracks multi-objective quests
- **Dialogue Trees**: Improved handling of conditional dialogue branches
- **CI Integration**: Bot tests now run on every PR
```

### Public (PUBLIC_DEVLOG.md):
```markdown
## Day 26: The Bot That Couldn't Turn Left

ChannelBot had a problem: it kept getting stuck in the meditation garden.

The garden has a circular path. North leads to East leads to South leads to West leads to... North. The bot's pathfinding algorithm found the "shortest" path and walked in circles forever.

The fix was embarrassingly simple: track visited rooms and never revisit within a single navigation attempt.

Lesson: The simplest bugs are the ones that make you feel dumbest.
```

### Social (BLOG_POSTS.md):
```markdown
## Post 11: Bot Navigation Fix

**Twitter:**
My test bot kept walking in circles in a room with circular exits. Pathfinding found the "shortest" path and looped forever. Fix: track visited rooms. Sometimes the dumbest bugs teach the best lessons.

**Long:**
[3-4 paragraph version of the public narrative]
```

## When to Run

Run this command:
- At the end of each development day
- When catching up after multiple days
- Before publishing devlog updates to social media

## Output Files

- `docs/devlog/DEVELOPMENT_LOG.md` - Technical reference
- `docs/devlog/PUBLIC_DEVLOG.md` - Narrative devlog
- `docs/devlog/BLOG_POSTS.md` - Social media content
