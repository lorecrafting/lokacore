# Human Oversight Guides

> **For humans guiding LLM work on Loka**

These guides help you oversee and guide Claude (or other LLMs) when working on Loka's quest, dialogue, and game content systems.

## Philosophy

The workflow is **LLM-first with human oversight**:
1. Claude does the implementation
2. You review, guide, and approve
3. Validators catch issues automatically
4. Bot tests verify playability

## Guides

| Guide | Purpose |
|-------|---------|
| [reviewing-changes.md](reviewing-changes.md) | What to look for when reviewing LLM output |
| [common-workflows.md](common-workflows.md) | How to ask Claude to do common tasks |
| [troubleshooting.md](troubleshooting.md) | When things go wrong |

## Quick Commands

### Validate Everything
```bash
mix loka.test.validate
```

### Run Bot Test
```bash
mix loka.test.storyline monastery_arc --run
```

### Check Specific Quest
```elixir
# In IEx
alias Loka.Testing.LLM.{DependencyGraph, ErrorFormatter}
DependencyGraph.quest_dependencies("quest_id")
ErrorFormatter.format_all_errors()
```

## What Claude Knows

Claude has access to:
- `docs/llm/` - Comprehensive reference docs
- `CLAUDE.md` - Project overview and patterns
- `Loka.Testing.LLM.*` - Query tools for dependencies and errors
- All validators and their output

## Your Role

1. **Set direction** - Tell Claude what feature/fix you want
2. **Review output** - Check the YAML/code changes make sense
3. **Run validation** - `mix loka.test.validate`
4. **Test playability** - `mix loka.test.storyline <id> --run`
5. **Approve or redirect** - If issues, tell Claude what to fix

## See Also

- `docs/llm/` - LLM reference documentation
- `CLAUDE.md` - Project development guide
