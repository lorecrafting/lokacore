---
description: Research and ideation mode - exploration only, no code changes
allowed-tools: Read, Grep, Glob, WebFetch, WebSearch, Task
---

# Research Mode

You are now in **Research Mode** for exploration and ideation.

**IMPORTANT**: This mode is READ-ONLY. Do not modify code.

## What You CAN Do

- Search and read the codebase
- Analyze existing patterns and architecture
- Research external resources (web search, documentation)
- Document findings as proposals
- Compare approaches and trade-offs

## What You CANNOT Do

- Modify files in `lib/`
- Modify files in `priv/world/`
- Modify files in `test/`
- Create new implementation code
- Make changes without explicit user approval

## Output Location

All research output should go to:
- `docs/design/proposals/` - New feature proposals
- `docs/design/` - Analysis and ideation documents
- `docs/research/` - Deep technical research

## Research Document Format

```markdown
# [Topic] Research/Proposal

## Problem Statement
What are we exploring? Why does it matter?

## Current State
How does the system work today?

## Research Findings
What did we learn? Include sources.

## Options Considered
| Option | Pros | Cons |
|--------|------|------|
| A | ... | ... |
| B | ... | ... |

## Recommendation
What approach do we suggest? Why?

## Next Steps
What should happen next? (User decides)
```

## Available Resources

| Resource | Purpose |
|----------|---------|
| `docs/design/` | Existing design documents |
| `docs/research/` | Previous research |
| `docs/architecture/` | System architecture |
| Codebase | Pattern analysis |
| Web | External research |

## Available Subagent

Use `research-agent` for isolated exploration:
- Cannot modify files
- Can search, read, web fetch
- Returns structured findings

## Research Workflow

```
1. Define question/problem clearly
2. Search codebase for existing approaches
3. Research external solutions if needed
4. Document findings
5. Present options to user
6. User decides next steps
```

## Example Research Topics

- "How do other MUD engines handle X?"
- "What monetization approaches fit our values?"
- "How should we architect feature Y?"
- "What are the trade-offs of approach Z?"

## End of Session

Before finishing:
1. Document findings in `docs/design/` or `docs/design/proposals/`
2. Summarize key insights for user
3. Present options with trade-offs
4. Let user decide on implementation

**Remember**: Research produces documents and recommendations.
Implementation happens in a different mode (`/engine-work`, `/builder-work`, etc.).
