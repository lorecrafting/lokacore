# Troubleshooting

When things go wrong with LLM-assisted game content work.

---

## Bot Gets Stuck

### Symptom
```
mix test test/integration/storyline_channel_test.exs
# Test stuck at quest X, action: :idle for 20+ ticks
```

### Diagnosis
Ask Claude:
```
"The storyline bot is stuck on monastery_arc. Run diagnostics and find the problem."
```

Or run yourself:
```elixir
alias Loka.WorldBuilder.Analysis.DependencyGraph
{:ok, graph} = DependencyGraph.build()
DependencyGraph.dependencies_for(graph, "quest:stuck_quest_id")
DependencyGraph.find_broken_references(graph)
```

### Common Causes
1. **NPC not in expected room** - Check spawn location
2. **Dialogue has no path to accept/complete action** - Check dialogue tree
3. **Objective target doesn't exist** - Check target_id references
4. **Room not connected** - Check exit connectivity

### Fix
Tell Claude the specific issue:
```
"The bot is stuck because merchant_dorje has no accept_quest action for side_trade_goods. Fix the dialogue."
```

---

## Validation Errors

### Symptom
```bash
mix loka.test.validate
# DIAL003: Dialogue references quest 'X' which doesn't exist
```

### Diagnosis
Look at the error code in `docs/builder-reference/README.md` or ask Claude:
```
"Explain error DIAL003 and fix it"
```

### Common Errors

| Code | Issue | Fix |
|------|-------|-----|
| DIAL001 | Broken next reference | Add missing node or fix next field |
| DIAL002 | Invalid action format | Change to list format |
| DIAL003 | Missing quest reference | Create quest or fix reference |
| QUEST001 | Missing objective target | Create entity or fix target_id |
| QUEST003 | Missing quest giver NPC | Create NPC or fix giver field |
| QUEST004 | Giver has no accept dialogue | Add accept_quest action |

---

## Quest Won't Accept

### Symptom
Player can talk to NPC but can't accept quest.

### Diagnosis
Check NPC dialogue for accept_quest action:
```elixir
TypedObject.Loader.get("npc_key")
# Look at components.dialogue_tree for accept_quest action
```

### Common Causes
1. No dialogue choice with `accept_quest` action
2. Action has wrong format (string instead of list)
3. Quest ID in action doesn't match quest file
4. Choice hidden by `show_if` condition

### Fix
```
"Add accept_quest action for quest_id to npc_key's dialogue"
```

---

## Quest Won't Complete

### Symptom
Player completed all objectives but can't turn in quest.

### Diagnosis
Check turn-in NPC dialogue:
```elixir
DependencyGraph.quest_dependencies("quest_id")
# Check if turn_in_npc has complete_quest action
```

### Common Causes
1. `turn_in_npc` not specified (or NPC doesn't exist)
2. No `complete_quest` action in dialogue
3. Action hidden by wrong `show_if` condition
4. Objectives not actually complete (check quest state)

### Fix
```
"Add complete_quest action for quest_id to turn_in_npc's dialogue, showing only when quest_complete"
```

---

## Talk Objective Doesn't Complete

### Symptom
Player talks to NPC but "talk to X" objective stays incomplete.

### Diagnosis
Check if objective has `dialogue_topic`:
```yaml
- type: talk
  target_id: elder_monk
  dialogue_topic: wisdom  # Must reach THIS specific node
```

### Common Causes
1. `dialogue_topic` specified but node doesn't exist
2. Dialogue path doesn't lead to the topic node
3. Topic node is behind a condition player doesn't meet

### Fix
Either:
```
"Add dialogue node 'wisdom' to elder_monk's dialogue tree"
```
Or:
```
"Remove dialogue_topic from the objective so any dialogue completes it"
```

---

## Circular Dependency

### Symptom
```
QUEST006: Circular prerequisites: quest_a → quest_b → quest_a
```

### Diagnosis
Quest A requires Quest B, but Quest B requires Quest A.

### Fix
Remove one `requires_quest` to break the cycle:
```
"Remove requires_quest from quest_a to break the circular dependency"
```

---

## Orphaned Content Warnings

### Symptom
```
DIAL101: Dialogue node 'secret' is unreachable
QUEST101: Quest 'old_quest' is not in any storyline
```

### Diagnosis
Content exists but isn't connected.

### Fix Options
1. Connect it: Add path to orphaned dialogue node, add quest to storyline
2. Delete it: If no longer needed, remove the content
3. Ignore it: Warnings don't block functionality

```
"Add a path to the 'secret' dialogue node from the main tree"
```

---

## LLM Made Wrong Changes

### Symptom
Claude modified the wrong file or made incorrect changes.

### Recovery
1. **Git reset** if not committed:
   ```bash
   git checkout -- priv/world/quests/wrong_file.yml
   ```

2. **Be more specific** in request:
   ```
   "Undo the changes to merchant_dorje and instead modify herbalist_chen"
   ```

3. **Request confirmation first**:
   ```
   "Before making changes, show me what you plan to modify"
   ```

---

## Compilation Errors

### Symptom
```
mix compile
# ** (CompileError) ...
```

### Diagnosis
Usually YAML syntax error in prototype files.

### Common Causes
1. Invalid YAML syntax (wrong indentation)
2. Unquoted special characters
3. Missing required fields

### Fix
Check YAML syntax:
```bash
# Find recently modified files
git status

# Validate YAML syntax
cat priv/world/prototypes/npcs/broken_npc.yml | ruby -ryaml -e 'YAML.load(STDIN.read)'
```

---

## When to Escalate

Ask for help if:

1. **Same error persists** after multiple fix attempts
2. **Validation passes but game behavior is wrong**
3. **Changes break unrelated content**
4. **Error messages are unclear**

Provide context:
```
"I've tried fixing DIAL003 three times but it keeps coming back.
Here's what I asked Claude to do: [...]
Here's the current state: [...]
What am I missing?"
```

---

## Prevention

### Before Major Changes
```
"Before modifying the monastery area, run validation and show me the current state"
```

### After Changes
```
"Run validation and storyline test to confirm everything works"
```

### Regular Checks
```bash
# Run this regularly during content work
mix loka.test.validate
mix test test/integration/storyline_channel_test.exs
```
