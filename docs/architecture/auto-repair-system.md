# Auto-Repair and Hardening System

## Overview

An AI-driven system that detects bugs in e2e tests, fixes them, and **hardens the codebase** to prevent similar issues in the future.

## Philosophy

**Every bug is an opportunity to improve the entire system.**

When a bug is found:
1. ✅ Fix the immediate issue
2. 🛡️ Add safeguards to prevent recurrence
3. 📊 Improve observability
4. 🧪 Add tests
5. 📝 Update documentation

## Architecture

### Layer 1: Diagnostic Collection (Built into Tests)

Test runners collect detailed diagnostics when failures occur:

```elixir
defmodule Loka.Testing.DiagnosticCollector do
  @moduledoc """
  Collects diagnostic information during test failures.
  Used by auto-repair agent to understand and fix issues.
  """

  def report_issue(diagnostic) do
    %Diagnostic{
      type: :quest_not_activating,
      severity: :blocker,

      # What went wrong
      expected: "Quest 'intro_welcome' in active_quests",
      actual: "active_quests=[]",

      # Context
      quest_data: %{id: "intro_welcome", giver: "system"},
      player_state: %{active_quests: []},

      # Breadcrumbs
      trace: ["bot_spawned", "talked_to_npc", "tried_to_complete_quest"],

      # Suggestions (AI can override these)
      suspected_files: [
        "lib/loka/framework/quest/listeners.ex",
        "lib/loka/framework/quest/quest.ex"
      ],

      suggested_fix: """
      System quests (giver: "system") should auto-grant on player spawn.
      Check Quest.Listeners.on_player_spawned/1 hook.
      """,

      # Hardening opportunities
      hardening_suggestions: [
        %{
          type: :validation,
          description: "Add startup validation that all storyline quests can activate",
          file: "lib/loka/content/validator.ex"
        },
        %{
          type: :test,
          description: "Add unit test for system quest auto-grant behavior",
          file: "test/loka/framework/quest/listeners_test.exs"
        },
        %{
          type: :typespec,
          description: "Add @type for Quest.giver field to document valid values",
          file: "lib/loka/framework/quest/definitions.ex"
        }
      ]
    }
  end
end
```

### Layer 2: Auto-Repair Agent

Specialized agent that:
- Analyzes diagnostic reports
- Explores code to understand root cause
- Implements fixes
- **Adds hardening measures**
- Verifies with tests

**Agent Type:** `test-repair`

**Capabilities:**
- Read test output and diagnostic reports
- Search codebase for related code
- Understand Elixir/Phoenix patterns
- Write fixes and tests
- Run tests to verify
- Create structured reports

**Workflow:**

```
1. ANALYZE
   ├─ Read diagnostic report
   ├─ Explore suspected files
   ├─ Identify root cause
   └─ Assess impact

2. FIX
   ├─ Implement immediate fix
   └─ Verify fix compiles

3. HARDEN
   ├─ Add validation (startup checks)
   ├─ Add unit tests (prevent regression)
   ├─ Add typespecs (document behavior)
   ├─ Add guards/assertions (runtime safety)
   └─ Update documentation

4. VERIFY
   ├─ Run unit tests
   ├─ Run e2e test again
   └─ Ensure no regressions

5. REPORT
   ├─ Summarize changes
   ├─ Explain hardening measures
   └─ Suggest further improvements
```

### Layer 3: Hardening Strategies

When a bug is found, the agent considers multiple hardening approaches:

#### 1. **Validation (Fail-Fast)**
Catch issues at startup/compile time instead of runtime.

**Example:**
```elixir
# Add to lib/loka/content/validator.ex
def validate_storyline_quests(storyline) do
  Enum.reduce(storyline.quests, [], fn quest_id, errors ->
    case can_quest_activate?(quest_id) do
      {:ok, _} -> errors
      {:error, reason} ->
        [{:error, "Quest #{quest_id} cannot activate: #{reason}"} | errors]
    end
  end)
end

defp can_quest_activate?(quest_id) do
  quest = Quest.get_quest_definition(quest_id)

  cond do
    quest.giver == "system" -> {:ok, :auto_granted}
    quest.giver -> check_npc_exists(quest.giver)
    true -> {:error, :no_activation_method}
  end
end
```

#### 2. **Unit Tests (Regression Prevention)**
Ensure the bug never comes back.

**Example:**
```elixir
# Add to test/loka/framework/quest/listeners_test.exs
test "system quests are auto-granted on player spawn" do
  player = create_test_player()

  # Quest with giver: "system" should auto-activate
  assert Quest.active?(player.id, "intro_welcome")
  assert length(Quest.get_active_quests(player.id)) > 0
end
```

#### 3. **Typespecs (Documentation + Dialyzer)**
Document valid values and catch type errors.

**Example:**
```elixir
# In lib/loka/framework/quest/definitions.ex
defmodule Quest do
  @type giver :: String.t() | :system | nil

  @type t :: %__MODULE__{
    id: String.t(),
    giver: giver(),
    ...
  }
end
```

#### 4. **Guards & Assertions (Runtime Safety)**
Add defensive checks where failures could cascade.

**Example:**
```elixir
def complete_quest(player_id, quest_id) when is_binary(quest_id) do
  assert Quest.active?(player_id, quest_id),
    "Cannot complete inactive quest #{quest_id}"
  ...
end
```

#### 5. **Observability (Better Debugging)**
Add logging/metrics to detect issues faster.

**Example:**
```elixir
def grant_system_quests(player_id) do
  system_quests = get_system_quests()
  Logger.info("Granting #{length(system_quests)} system quests to player #{player_id}")

  Enum.each(system_quests, fn quest ->
    case Quest.grant(player_id, quest.id) do
      {:ok, _} -> Logger.debug("Granted quest #{quest.id}")
      {:error, reason} -> Logger.error("Failed to grant #{quest.id}: #{reason}")
    end
  end)
end
```

#### 6. **Better Error Messages**
Help developers diagnose issues faster.

**Example:**
```elixir
# Before
{:error, :quest_not_active}

# After
{:error, {:quest_not_active, %{
  quest_id: "intro_welcome",
  active_quests: [],
  hint: "System quests (giver: 'system') should auto-grant. Check Quest.Listeners."
}}}
```

## Hardening Decision Tree

```
Bug Found
│
├─ Is it a configuration issue?
│  └─ Add validation at startup
│
├─ Is it a content issue?
│  ├─ Add content validator rule
│  └─ Fix YAML/data
│
├─ Is it a code bug?
│  ├─ Fix code
│  ├─ Add unit test
│  ├─ Add typespec if missing
│  └─ Add guards if needed
│
├─ Is it a missing feature?
│  ├─ Implement feature
│  ├─ Add tests
│  └─ Update documentation
│
└─ Is it ambiguous behavior?
   ├─ Add assertion to enforce expected behavior
   └─ Document the decision
```

## Integration with CI

```yaml
# .github/workflows/server-ci.yml
jobs:
  test:
    - name: Run e2e storyline test
      run: mix loka.test.storyline monastery_arc --run --diagnostic-output
      continue-on-error: true

    - name: Upload diagnostics
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: test-diagnostics
        path: diagnostics.json

    # Could trigger auto-repair agent here if desired
    # (but probably better as manual review step)
```

## Auto-Repair Agent Prompts

### System Prompt for test-repair Agent

```
You are the test-repair agent. Your job is to:

1. Analyze test failures and diagnostic reports
2. Fix the immediate issue
3. HARDEN the system to prevent similar issues

Hardening strategies (apply 2-3 per bug):
- Add validation (fail-fast at startup)
- Add unit tests (prevent regression)
- Add typespecs (document + catch errors)
- Add guards/assertions (runtime safety)
- Improve error messages (better debugging)
- Add observability (logging/metrics)

For each bug:
1. Fix the immediate issue
2. Choose appropriate hardening measures
3. Implement both
4. Verify with tests
5. Explain your reasoning

Be thorough but pragmatic. Focus on high-impact hardening.
```

## Example: Hardening System Quests

**Bug:** System quests not auto-granted on player spawn

**Fix:**
```elixir
# lib/loka/framework/quest/listeners.ex
def on_player_spawned(player) do
  grant_system_quests(player.id)
end

defp grant_system_quests(player_id) do
  Quest.get_all_quest_definitions()
  |> Enum.filter(& &1.giver == "system")
  |> Enum.each(&Quest.grant(player_id, &1.id))
end
```

**Hardening Measures:**

1. **Validation** (startup check):
```elixir
# lib/loka/content/validator.ex
def validate_quest_activation_paths do
  storyline_quests = Storyline.all_quests()

  Enum.flat_map(storyline_quests, fn quest_id ->
    quest = Quest.get_quest_definition(quest_id)

    case quest.giver do
      "system" -> []
      nil -> [{:error, "Quest #{quest_id} has no activation method"}]
      giver -> validate_giver_exists(giver)
    end
  end)
end
```

2. **Unit Test** (regression prevention):
```elixir
# test/loka/framework/quest/listeners_test.exs
describe "on_player_spawned/1" do
  test "grants all system quests" do
    player = create_test_player()

    Quest.Listeners.on_player_spawned(player)

    active = Quest.get_active_quests(player.id)
    system_quests = Quest.get_system_quests()

    assert length(active) >= length(system_quests)

    for sq <- system_quests do
      assert Quest.active?(player.id, sq.id),
        "System quest #{sq.id} was not granted"
    end
  end
end
```

3. **Typespec** (documentation):
```elixir
# lib/loka/framework/quest/definitions.ex
defmodule Quest do
  @type giver ::
    String.t() |  # NPC key
    :system       # Auto-granted on spawn

  @doc """
  The giver field determines how a quest is activated:
  - `"npc_key"` - Player must talk to this NPC
  - `:system` or `"system"` - Auto-granted when player spawns
  """
  defstruct giver: nil
end
```

4. **Observability** (debugging):
```elixir
def grant_system_quests(player_id) do
  system_quests = Quest.get_system_quests()

  Logger.info("[Quest] Granting #{length(system_quests)} system quests",
    player_id: player_id)

  results = Enum.map(system_quests, fn quest ->
    case Quest.grant(player_id, quest.id) do
      {:ok, _} = res ->
        Logger.debug("[Quest] Granted system quest",
          quest_id: quest.id, player_id: player_id)
        res
      {:error, reason} = res ->
        Logger.error("[Quest] Failed to grant system quest",
          quest_id: quest.id, player_id: player_id, reason: reason)
        res
    end
  end)

  {:ok, results}
end
```

## Benefits

1. **Fewer regressions** - Tests prevent reintroduction
2. **Faster debugging** - Better errors and logging
3. **Safer refactoring** - Typespecs and tests give confidence
4. **Self-documenting** - Specs and assertions explain behavior
5. **Fail-fast** - Validation catches issues early
6. **Learning system** - Each bug makes the engine stronger

## Implementation Plan

1. ✅ Fix immediate bug (system quests)
2. 🔨 Build diagnostic collector in test runner
3. 🤖 Create test-repair agent
4. 🛡️ Implement hardening strategies
5. 📈 Track hardening coverage over time
6. 🔄 Iterate and improve

## Metrics to Track

- **Bug recurrence rate** - Are fixed bugs staying fixed?
- **Hardening coverage** - % of bugs that got hardening measures
- **Test coverage** - % of code covered by tests
- **Validation coverage** - % of content validated at startup
- **MTTR** - Mean time to repair (with agent vs without)

## Future Enhancements

- **Predictive hardening** - AI identifies weak areas before bugs occur
- **Cross-cutting analysis** - "5 quests have this same issue"
- **Architecture suggestions** - "Consider refactoring quest activation"
- **Performance hardening** - Add benchmarks when fixing perf bugs
- **Security hardening** - Add security checks when fixing vulnerabilities
