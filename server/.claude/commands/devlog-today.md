# Devlog Today

Quick command to generate today's devlog entry from git commits.

## Instructions

1. **Get today's commits**:
   ```bash
   cd /Users/raymondluong/dev/lokacore && git log --format="%h|%s" --since="midnight" --reverse
   ```

2. **If no commits today**, check yesterday:
   ```bash
   cd /Users/raymondluong/dev/lokacore && git log --format="%h|%s" --since="yesterday" --until="midnight" --reverse
   ```

3. **Generate a quick summary** with:
   - Main theme/focus
   - Key accomplishments (3-5 bullets)
   - Any notable challenges or decisions
   - A one-liner for Twitter

4. **Append to devlog files** (or show user for review)

## Output Format

```
📅 DEVLOG: [DATE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 FOCUS: [Main theme]

✅ DONE:
• [Accomplishment 1]
• [Accomplishment 2]
• [Accomplishment 3]

💡 LESSON: [Key insight or decision]

🐦 TWEET: [280 char version]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Example

```
📅 DEVLOG: January 10, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 FOCUS: Bot testing infrastructure

✅ DONE:
• Fixed circular room pathfinding bug
• Added quest objective tracking to bot
• Integrated bot tests into CI pipeline
• Added 5 new test scenarios

💡 LESSON: Always track visited nodes in graph traversal

🐦 TWEET: Fixed a bug where my test bot walked in circles forever. Turns out "find shortest path" doesn't work when the path is a loop. Added visited tracking. The dumbest bugs teach the best lessons.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## When to Use

Run at end of day to capture what was done while it's fresh.
