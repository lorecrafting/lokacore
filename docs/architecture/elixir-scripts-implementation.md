# Elixir Scripts Implementation Plan

## Overview

This document details the implementation plan for replacing Lua scripting with sandboxed Elixir scripts. The goal is a comprehensive scripting API that allows builders to create rich game content while maintaining security.

**Related Documents:**
- [Elixir Scripts Design](./elixir-scripts-design.md) - API surface and design decisions
- [Scripting Deep Dive](../research/scripting-systems-deep-dive.md) - Research on MUD scripting systems

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BUILDER LAYER                                 │
│  priv/world/prototypes/*.yaml    +    scripts table (DB)            │
│  (Entity definitions)                 (Elixir scripts)              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRAMEWORK LAYER                                 │
│  lib/loka/framework/scripting/                                       │
│  ├── script_api.ex           # Full API implementation              │
│  ├── script_bindings.ex      # Binding builder                      │
│  ├── script_context.ex       # Context preparation                  │
│  └── script_actions.ex       # Action queue processing              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ENGINE LAYER                                  │
│  lib/loka/engine/                                                    │
│  ├── script/                                                         │
│  │   ├── sandbox.ex          # Code.eval_string with restrictions   │
│  │   ├── validator.ex        # Static analysis before save          │
│  │   ├── executor.ex         # Task-based execution with timeout    │
│  │   └── result.ex           # Result type definitions              │
│  ├── schema/script_schema.ex # Database schema                      │
│  └── scripts.ex              # CRUD operations                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
server/lib/loka/
├── engine/
│   ├── script/
│   │   ├── sandbox.ex           # Core sandbox - Code.eval_string
│   │   ├── validator.ex         # Static analysis (forbidden patterns)
│   │   ├── executor.ex          # Task wrapper with timeout
│   │   ├── result.ex            # Result types and validation
│   │   └── action_queue.ex      # Queued action processing
│   ├── schema/
│   │   └── script_schema.ex     # Ecto schema for scripts table
│   └── scripts.ex               # Context module for CRUD
│
├── framework/
│   └── scripting/
│       ├── script_api.ex        # Main API module (delegates to others)
│       ├── bindings/
│       │   ├── context.ex       # entity, player, context, room
│       │   ├── queries.ex       # quest_*, has_*, get_*, find_*
│       │   ├── actions.ex       # say, message, set_flag, give_item
│       │   ├── world.ex         # spawn_*, destroy_*, room manipulation
│       │   ├── combat.ex        # damage, heal, effects, combat
│       │   ├── npc.ex           # npc_*, behavior control
│       │   ├── scheduling.ex    # after, schedule_at, recurring
│       │   └── utilities.ex     # chance?, roll, pick, string helpers
│       ├── script_context.ex    # Prepares context for execution
│       └── hook_integration.ex  # Connects scripts to hook system
│
└── web/live/admin_live/
    └── scripts_tab.ex           # Enhanced admin UI (already exists)

server/priv/repo/migrations/
└── YYYYMMDDHHMMSS_enhance_scripts_table.exs

server/test/loka/
├── engine/script/
│   ├── sandbox_test.exs
│   ├── validator_test.exs
│   └── executor_test.exs
└── framework/scripting/
    ├── bindings_test.exs
    └── integration_test.exs
```

---

## Phase 1: Core Engine (Week 1-2)

### 1.1 Script Schema Enhancement

**File:** `lib/loka/engine/schema/script_schema.ex`

```elixir
defmodule Loka.Engine.Schema.ScriptSchema do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "scripts" do
    field :key, :string              # Unique identifier
    field :name, :string             # Display name
    field :description, :string      # What this script does
    field :hook, :string             # Which event: "on_look", "on_enter", etc.
    field :source, :string           # Elixir source code
    field :language, :string, default: "elixir"  # "lua" for legacy, "elixir" for new
    field :enabled, :boolean, default: true
    field :status, :string, default: "approved"  # pending, approved, rejected
    field :created_by, :string
    field :approved_by, :string
    field :approved_at, :utc_datetime
    field :last_error, :string       # Last execution error
    field :execution_count, :integer, default: 0
    field :avg_execution_ms, :float, default: 0.0

    timestamps()
  end

  def changeset(script, attrs) do
    script
    |> cast(attrs, [:key, :name, :description, :hook, :source, :language,
                    :enabled, :status, :created_by, :approved_by, :approved_at,
                    :last_error, :execution_count, :avg_execution_ms])
    |> validate_required([:key, :hook, :source])
    |> unique_constraint(:key)
    |> validate_inclusion(:hook, valid_hooks())
    |> validate_inclusion(:language, ["lua", "elixir"])
    |> validate_source()
  end

  defp valid_hooks do
    ~w(on_look on_enter on_leave on_say on_give on_attack on_death
       on_tick on_time on_use before_enter before_leave before_attack)
  end

  defp validate_source(changeset) do
    case get_change(changeset, :source) do
      nil -> changeset
      source ->
        language = get_field(changeset, :language, "elixir")
        validate_source_for_language(changeset, source, language)
    end
  end

  defp validate_source_for_language(changeset, source, "elixir") do
    case Loka.Engine.Script.Validator.validate(source) do
      :ok -> changeset
      {:error, reason} -> add_error(changeset, :source, reason)
    end
  end

  defp validate_source_for_language(changeset, _source, "lua") do
    # Legacy Lua validation
    changeset
  end
end
```

### 1.2 Sandbox Implementation

**File:** `lib/loka/engine/script/sandbox.ex`

```elixir
defmodule Loka.Engine.Script.Sandbox do
  @moduledoc """
  Executes Elixir scripts in a sandboxed environment.

  Scripts are evaluated with Code.eval_string/3 using restricted bindings.
  All dangerous functions are excluded - scripts can only use what we
  explicitly provide in the bindings.

  ## Security Model

  1. **Static Analysis** - Validator.validate/1 blocks dangerous patterns before save
  2. **Restricted Bindings** - Only approved functions available at runtime
  3. **Timeout Protection** - Task.async with configurable timeout
  4. **Result Validation** - Output size limits prevent memory exhaustion
  5. **Action Queuing** - Mutations queued, not executed during script

  ## Example

      source = ~S'''
      cond do
        quest_active?("main_quest") -> {:append, "Quest active!"}
        true -> :default
      end
      '''

      {:ok, result} = Sandbox.execute(source, entity, context)
  """

  require Logger

  alias Loka.Engine.Script.{Validator, ActionQueue}

  @default_timeout 5_000
  @max_result_size 10_000

  @type execute_result ::
    {:ok, term()} |
    {:error, :timeout | :result_too_large | {:validation, String.t()} | {:exception, String.t()}}

  @doc """
  Execute an Elixir script with sandboxed bindings.

  ## Options

  - `:timeout` - Execution timeout in ms (default: #{@default_timeout})
  - `:bindings` - Additional bindings to merge (for testing)
  """
  @spec execute(String.t(), map(), map(), keyword()) :: execute_result()
  def execute(source, entity, context, opts \\ []) do
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    extra_bindings = Keyword.get(opts, :bindings, [])

    # Validate before execution (belt + suspenders with DB validation)
    with :ok <- Validator.validate(source) do
      do_execute(source, entity, context, timeout, extra_bindings)
    else
      {:error, reason} -> {:error, {:validation, reason}}
    end
  end

  defp do_execute(source, entity, context, timeout, extra_bindings) do
    # Initialize action queue for this execution
    ActionQueue.init()

    bindings = build_bindings(entity, context, extra_bindings)
    start_time = System.monotonic_time(:millisecond)

    task = Task.async(fn ->
      try do
        # Use a clean __ENV__ to prevent access to caller's context
        {result, _bindings} = Code.eval_string(source, bindings, make_env())
        {:ok, result}
      rescue
        e ->
          {:error, {:exception, Exception.message(e)}}
      catch
        :throw, value -> {:ok, value}  # Allow throw for early return
      end
    end)

    result = case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
      {:ok, {:ok, result}} -> validate_result(result)
      {:ok, {:error, reason}} -> {:error, reason}
      nil ->
        Logger.warning("[Sandbox] Script timed out after #{timeout}ms")
        {:error, :timeout}
    end

    # Collect queued actions
    actions = ActionQueue.collect()
    duration = System.monotonic_time(:millisecond) - start_time

    emit_telemetry(entity, context, result, actions, duration)

    case result do
      {:ok, value} -> {:ok, value, actions}
      error -> error
    end
  end

  # Build the restricted bindings available to scripts
  defp build_bindings(entity, context, extra_bindings) do
    # Get bindings from Framework layer
    framework_bindings = Loka.Framework.Scripting.ScriptAPI.bindings(entity, context)

    Keyword.merge(framework_bindings, extra_bindings)
  end

  # Create a clean environment for eval
  defp make_env do
    %Macro.Env{
      module: nil,
      file: "script",
      line: 1,
      function: nil,
      context: nil,
      aliases: [],
      requires: [],
      functions: [],
      macros: []
    }
  end

  defp validate_result(result) do
    size = estimate_size(result)
    if size > @max_result_size do
      Logger.warning("[Sandbox] Result size #{size} exceeds limit #{@max_result_size}")
      {:error, :result_too_large}
    else
      {:ok, result}
    end
  end

  defp estimate_size(value) when is_binary(value), do: byte_size(value)
  defp estimate_size(value) when is_number(value), do: 8
  defp estimate_size(value) when is_boolean(value), do: 1
  defp estimate_size(value) when is_nil(value), do: 0
  defp estimate_size(value) when is_atom(value), do: byte_size(Atom.to_string(value))
  defp estimate_size(value) when is_list(value) do
    Enum.reduce(value, 0, fn item, acc -> acc + estimate_size(item) end)
  end
  defp estimate_size(value) when is_tuple(value) do
    value |> Tuple.to_list() |> estimate_size()
  end
  defp estimate_size(value) when is_map(value) do
    Enum.reduce(value, 0, fn {k, v}, acc -> acc + estimate_size(k) + estimate_size(v) end)
  end
  defp estimate_size(_), do: 100

  defp emit_telemetry(entity, context, result, actions, duration) do
    :telemetry.execute(
      [:loka, :script, :execute],
      %{duration: duration, action_count: length(actions)},
      %{
        entity_id: entity[:id],
        hook: context[:trigger],
        success: match?({:ok, _}, result),
        language: "elixir"
      }
    )
  end
end
```

### 1.3 Validator Implementation

**File:** `lib/loka/engine/script/validator.ex`

```elixir
defmodule Loka.Engine.Script.Validator do
  @moduledoc """
  Static analysis for Elixir scripts before saving to database.

  Validates scripts don't contain dangerous patterns that could escape
  the sandbox. This is defense-in-depth - the sandbox also restricts
  available bindings at runtime.

  ## Blocked Patterns

  - System/OS access: System.*, :os.*, File.*, Path.*
  - Process manipulation: spawn, send, receive, Process.*
  - Code loading: Code.*, import, require, use, alias
  - Metaprogramming: quote, unquote, defmodule, def, defmacro
  - Kernel escapes: apply/3, __ENV__, __MODULE__
  - Pipe operator: |> (can chain to dangerous functions)
  """

  @max_length 10_000

  @forbidden_patterns [
    # System and OS access
    ~r/\bSystem\./,
    ~r/\bFile\./,
    ~r/\bPath\./,
    ~r/\bIO\./,
    ~r/:os\./,
    ~r/:file\./,
    ~r/:inet\./,
    ~r/:gen_tcp\./,
    ~r/:gen_udp\./,
    ~r/:ssl\./,
    ~r/:httpc\./,

    # Code loading and execution
    ~r/\bCode\./,
    ~r/\bMacro\./,
    ~r/\bKernel\.apply/,
    ~r/\bFunction\./,
    ~r/\b:erlang\.apply/,

    # Process manipulation
    ~r/\bProcess\./,
    ~r/\bAgent\./,
    ~r/\bGenServer\./,
    ~r/\bTask\./,
    ~r/\bSupervisor\./,
    ~r/\bRegistry\./,
    ~r/\bNode\./,
    ~r/\bApplication\./,
    ~r/\bETS\./,
    ~r/:ets\./,
    ~r/\bspawn\b/,
    ~r/\bsend\b(?!\?)/,  # send but not send?
    ~r/\breceive\b/,
    ~r/\bself\(\)/,

    # Module definition and metaprogramming
    ~r/\bdefmodule\b/,
    ~r/\bdefmacro\b/,
    ~r/\bdef\s+\w+/,
    ~r/\bdefp\s+\w+/,
    ~r/\bquote\b/,
    ~r/\bunquote\b/,
    ~r/\bimport\s/,
    ~r/\brequire\s/,
    ~r/\buse\s/,
    ~r/\balias\s/,

    # Magic variables
    ~r/__ENV__/,
    ~r/__MODULE__/,
    ~r/__DIR__/,
    ~r/__CALLER__/,
    ~r/__STACKTRACE__/,

    # Pipe operator (can chain to dangerous functions)
    ~r/\|>/,

    # Erlang module calls (escape hatch)
    ~r/:\w+\.\w+\(/,

    # Struct access to unknown modules
    ~r/%[A-Z]\w*\{/,
  ]

  @allowed_stdlib [
    # Safe Enum functions
    "Enum.map", "Enum.filter", "Enum.reduce", "Enum.find",
    "Enum.any?", "Enum.all?", "Enum.count", "Enum.take",
    "Enum.drop", "Enum.sort", "Enum.reverse", "Enum.join",
    "Enum.member?", "Enum.empty?", "Enum.at", "Enum.with_index",

    # Safe String functions
    "String.contains?", "String.downcase", "String.upcase",
    "String.trim", "String.split", "String.replace",
    "String.starts_with?", "String.ends_with?", "String.length",

    # Safe Map functions
    "Map.get", "Map.put", "Map.delete", "Map.keys", "Map.values",
    "Map.has_key?", "Map.merge",

    # Safe List functions
    "List.first", "List.last",

    # Safe Kernel functions (via bindings, not direct call)
    "to_string", "inspect", "is_nil", "is_binary", "is_number",
    "is_boolean", "is_list", "is_map", "is_atom",
  ]

  @doc """
  Validate script source for dangerous patterns.

  Returns :ok if valid, {:error, reason} if invalid.
  """
  @spec validate(String.t()) :: :ok | {:error, String.t()}
  def validate(source) when is_binary(source) do
    with :ok <- validate_length(source),
         :ok <- validate_patterns(source),
         :ok <- validate_syntax(source),
         :ok <- validate_ast(source) do
      :ok
    end
  end

  defp validate_length(source) when byte_size(source) > @max_length do
    {:error, "Script too long (max #{@max_length} characters, got #{byte_size(source)})"}
  end
  defp validate_length(_), do: :ok

  defp validate_patterns(source) do
    case Enum.find(@forbidden_patterns, &Regex.match?(&1, source)) do
      nil -> :ok
      pattern -> {:error, "Forbidden pattern detected: #{inspect(pattern.source)}"}
    end
  end

  defp validate_syntax(source) do
    case Code.string_to_quoted(source) do
      {:ok, _ast} -> :ok
      {:error, {location, message, token}} ->
        line = Keyword.get(location, :line, 1)
        {:error, "Syntax error on line #{line}: #{message} #{inspect(token)}"}
    end
  end

  # AST-level validation for things regex can't catch
  defp validate_ast(source) do
    case Code.string_to_quoted(source) do
      {:ok, ast} ->
        case check_ast(ast) do
          :ok -> :ok
          {:error, _} = error -> error
        end
      {:error, _} -> :ok  # Already caught in validate_syntax
    end
  end

  defp check_ast(ast) do
    {_, result} = Macro.prewalk(ast, :ok, fn
      # Block direct module calls except allowed ones
      {{:., _, [{:__aliases__, _, module_parts}, func]}, _, _} = node, :ok ->
        module_name = Enum.join(module_parts, ".")
        full_name = "#{module_name}.#{func}"
        if full_name in @allowed_stdlib do
          {node, :ok}
        else
          {node, {:error, "Direct module call not allowed: #{full_name}"}}
        end

      # Block anonymous function creation (can capture env)
      {:fn, _, _} = node, :ok ->
        {node, {:error, "Anonymous functions (fn) not allowed"}}

      # Block & capture syntax
      {:&, _, _} = node, :ok ->
        {node, {:error, "Function capture (&) not allowed"}}

      node, acc -> {node, acc}
    end)

    result
  end
end
```

### 1.4 Action Queue

**File:** `lib/loka/engine/script/action_queue.ex`

```elixir
defmodule Loka.Engine.Script.ActionQueue do
  @moduledoc """
  Queues actions from script execution for later processing.

  Scripts don't execute actions directly - they queue them. After script
  completes successfully, the queue is processed. This maintains
  transactional safety and allows validation before execution.

  ## Rate Limits

  - Max 10 spawn actions per script
  - Max 5 announce actions per script
  - Max 1000 damage/heal per action
  - Max 3 scheduled actions per entity
  """

  @max_spawns 10
  @max_announces 5
  @max_damage 1000
  @max_schedules 3

  @type action :: {atom(), map()}

  @doc "Initialize the action queue for current process"
  def init do
    Process.put(:script_actions, [])
    Process.put(:script_action_counts, %{spawns: 0, announces: 0, schedules: 0})
  end

  @doc "Queue an action for later execution"
  @spec queue(atom(), map()) :: :ok | {:error, :rate_limited}
  def queue(action_type, params) do
    with :ok <- check_rate_limit(action_type),
         :ok <- validate_params(action_type, params) do
      actions = Process.get(:script_actions, [])
      Process.put(:script_actions, [{action_type, params} | actions])
      increment_count(action_type)
      :ok
    end
  end

  @doc "Collect all queued actions and clear the queue"
  @spec collect() :: [action()]
  def collect do
    actions = Process.get(:script_actions, [])
    Process.delete(:script_actions)
    Process.delete(:script_action_counts)
    Enum.reverse(actions)
  end

  defp check_rate_limit(action_type) do
    counts = Process.get(:script_action_counts, %{})

    case action_type do
      type when type in [:spawn_item, :spawn_npc] ->
        if Map.get(counts, :spawns, 0) >= @max_spawns do
          {:error, :rate_limited}
        else
          :ok
        end

      type when type in [:announce_room, :announce_adjacent, :broadcast] ->
        if Map.get(counts, :announces, 0) >= @max_announces do
          {:error, :rate_limited}
        else
          :ok
        end

      type when type in [:schedule, :schedule_at, :recurring] ->
        if Map.get(counts, :schedules, 0) >= @max_schedules do
          {:error, :rate_limited}
        else
          :ok
        end

      _ -> :ok
    end
  end

  defp validate_params(:damage, %{amount: amount}) when amount > @max_damage do
    {:error, :damage_too_high}
  end
  defp validate_params(:heal, %{amount: amount}) when amount > @max_damage do
    {:error, :heal_too_high}
  end
  defp validate_params(_, _), do: :ok

  defp increment_count(action_type) do
    counts = Process.get(:script_action_counts, %{})

    key = case action_type do
      type when type in [:spawn_item, :spawn_npc] -> :spawns
      type when type in [:announce_room, :announce_adjacent, :broadcast] -> :announces
      type when type in [:schedule, :schedule_at, :recurring] -> :schedules
      _ -> nil
    end

    if key do
      Process.put(:script_action_counts, Map.update(counts, key, 1, &(&1 + 1)))
    end
  end
end
```

---

## Phase 2: Framework Bindings (Week 3-4)

### 2.1 Main API Module

**File:** `lib/loka/framework/scripting/script_api.ex`

```elixir
defmodule Loka.Framework.Scripting.ScriptAPI do
  @moduledoc """
  Main entry point for script API bindings.

  Aggregates all binding modules and provides the complete set of
  functions available to builder scripts.
  """

  alias Loka.Framework.Scripting.Bindings.{
    Context,
    Queries,
    Actions,
    World,
    Combat,
    NPC,
    Scheduling,
    Utilities
  }

  @doc """
  Build complete bindings for script execution.
  """
  def bindings(entity, context) do
    []
    |> Keyword.merge(Context.bindings(entity, context))
    |> Keyword.merge(Queries.bindings(entity, context))
    |> Keyword.merge(Actions.bindings(entity, context))
    |> Keyword.merge(World.bindings(entity, context))
    |> Keyword.merge(Combat.bindings(entity, context))
    |> Keyword.merge(NPC.bindings(entity, context))
    |> Keyword.merge(Scheduling.bindings(entity, context))
    |> Keyword.merge(Utilities.bindings())
  end
end
```

### 2.2 Context Bindings

**File:** `lib/loka/framework/scripting/bindings/context.ex`

```elixir
defmodule Loka.Framework.Scripting.Bindings.Context do
  @moduledoc """
  Context variable bindings: entity, player, context, room.
  """

  alias Loka.Engine.Registry

  def bindings(entity, context) do
    [
      entity: build_entity_map(entity),
      player: build_player_map(context[:player], context[:game_state]),
      context: build_context_map(context),
      room: fn -> build_room_map(entity, context) end,
      room: fn room_id -> build_room_map_by_id(room_id) end,
    ]
  end

  defp build_entity_map(entity) do
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      short_desc: entity.short_desc,
      long_desc: entity.long_desc,
      extra_desc: entity.extra_desc,
      mood: entity.mood,
      location: entity.location_id
    }
  end

  defp build_player_map(nil, _), do: nil
  defp build_player_map(player, game_state) do
    %{
      id: player.id,
      name: player.short_desc || player.name,
      level: get_level(game_state)
    }
  end

  defp build_context_map(context) do
    %{
      trigger: context[:trigger],
      message: context[:message],
      target: context[:target],
      time: get_game_time()
    }
  end

  defp build_room_map(entity, context) do
    room_id = context[:room_id] || entity.location_id
    build_room_map_by_id(room_id)
  end

  defp build_room_map_by_id(room_id) do
    case Registry.get(room_id) do
      nil -> nil
      room ->
        %{
          id: room.id,
          key: room.key,
          name: room.short_desc,
          exits: get_exits(room),
          attributes: room.attributes || %{}
        }
    end
  end

  defp get_level(nil), do: 1
  defp get_level(%{stats: %{level: level}}), do: level
  defp get_level(_), do: 1

  defp get_game_time do
    # Integration with time system
    %{hour: 12, day: 1, season: :summer}
  end

  defp get_exits(room) do
    (room.exits || [])
    |> Enum.map(fn exit -> {exit.direction, exit.destination_id} end)
    |> Map.new()
  end
end
```

### 2.3 Query Bindings

**File:** `lib/loka/framework/scripting/bindings/queries.ex`

```elixir
defmodule Loka.Framework.Scripting.Bindings.Queries do
  @moduledoc """
  Query function bindings: quest_*, has_*, get_*, find_*, etc.
  """

  alias Loka.Framework.Quest.StateHelper
  alias Loka.Engine.Registry

  def bindings(_entity, context) do
    player = context[:player]
    game_state = context[:game_state]
    room_id = context[:room_id]

    [
      # Quest queries
      quest_active?: fn quest_id -> quest_active?(game_state, quest_id) end,
      quest_complete?: fn quest_id -> quest_complete?(game_state, quest_id) end,
      quest_objective_done?: fn quest_id, obj_id -> quest_objective_done?(game_state, quest_id, obj_id) end,
      quest_stage: fn quest_id -> quest_stage(game_state, quest_id) end,

      # Player state queries
      has_item?: fn item_key -> has_item?(game_state, item_key) end,
      has_item?: fn item_key, count -> has_item?(game_state, item_key, count) end,
      has_flag?: fn flag -> has_flag?(game_state, flag) end,
      get_flag: fn flag, default -> get_flag(game_state, flag, default) end,
      get_stat: fn stat -> get_stat(game_state, stat) end,
      get_skill: fn skill -> get_skill(game_state, skill) end,
      get_currency: fn type -> get_currency(game_state, type) end,

      # Entity queries
      entities_in_room: fn -> entities_in_room(room_id) end,
      entities_in_room: fn opts -> entities_in_room(room_id, opts) end,
      entity_present?: fn key -> entity_present?(room_id, key) end,
      player_in_room?: fn player_id -> player_in_room?(room_id, player_id) end,
      get_entity: fn id -> get_entity(id) end,
      find_entities: fn opts -> find_entities(room_id, opts) end,

      # World state queries
      time_of_day: fn -> time_of_day() end,
      current_hour: fn -> current_hour() end,
      current_weather: fn -> current_weather() end,
      is_outdoor?: fn -> is_outdoor?(room_id) end,

      # Room queries
      get_room_attr: fn key -> get_room_attr(room_id, key) end,
      get_room_attr: fn key, default -> get_room_attr(room_id, key, default) end,
      is_indoor?: fn -> is_indoor?(room_id) end,
      is_dark?: fn -> is_dark?(room_id) end,
      danger_level: fn -> danger_level(room_id) end,
    ]
  end

  # Implementation functions...
  defp quest_active?(nil, _), do: false
  defp quest_active?(game_state, quest_id) do
    StateHelper.active?(game_state.quests, quest_id)
  end

  defp quest_complete?(nil, _), do: false
  defp quest_complete?(game_state, quest_id) do
    StateHelper.complete?(game_state.quests, quest_id)
  end

  defp quest_objective_done?(nil, _, _), do: false
  defp quest_objective_done?(game_state, quest_id, obj_id) do
    StateHelper.objective_complete?(game_state.quests, quest_id, obj_id)
  end

  defp quest_stage(nil, _), do: 0
  defp quest_stage(game_state, quest_id) do
    StateHelper.get_stage(game_state.quests, quest_id)
  end

  defp has_item?(nil, _), do: false
  defp has_item?(game_state, item_key) do
    Enum.any?(game_state.inventory || [], fn item ->
      item.key == item_key || item[:key] == item_key
    end)
  end

  defp has_item?(nil, _, _), do: false
  defp has_item?(game_state, item_key, count) do
    matching = Enum.count(game_state.inventory || [], fn item ->
      item.key == item_key || item[:key] == item_key
    end)
    matching >= count
  end

  defp has_flag?(nil, _), do: false
  defp has_flag?(game_state, flag) do
    Map.get(game_state.flags || %{}, flag, false)
  end

  defp get_flag(nil, _, default), do: default
  defp get_flag(game_state, flag, default) do
    Map.get(game_state.flags || %{}, flag, default)
  end

  defp get_stat(nil, _), do: 0
  defp get_stat(game_state, stat) do
    Map.get(game_state.stats || %{}, stat, 0)
  end

  defp get_skill(nil, _), do: 0
  defp get_skill(game_state, skill) do
    Map.get(game_state.skills || %{}, skill, 0)
  end

  defp get_currency(nil, _), do: 0
  defp get_currency(game_state, type) do
    Map.get(game_state.currency || %{}, type, 0)
  end

  defp entities_in_room(nil), do: []
  defp entities_in_room(room_id) do
    Registry.entities_in_room(room_id)
    |> Enum.map(&safe_entity_map/1)
  end

  defp entities_in_room(room_id, opts) do
    entities_in_room(room_id)
    |> filter_entities(opts)
  end

  defp filter_entities(entities, opts) do
    entities
    |> maybe_filter_type(opts[:type])
    |> maybe_filter_key(opts[:key])
    |> maybe_filter_tag(opts[:tag])
  end

  defp maybe_filter_type(entities, nil), do: entities
  defp maybe_filter_type(entities, type) do
    Enum.filter(entities, &(&1.type == type))
  end

  defp maybe_filter_key(entities, nil), do: entities
  defp maybe_filter_key(entities, key) do
    Enum.filter(entities, &String.contains?(&1.key, key))
  end

  defp maybe_filter_tag(entities, nil), do: entities
  defp maybe_filter_tag(entities, tag) do
    Enum.filter(entities, &(tag in (&1.tags || [])))
  end

  defp entity_present?(room_id, key) do
    entities_in_room(room_id)
    |> Enum.any?(&(&1.key == key))
  end

  defp player_in_room?(room_id, player_id) do
    entities_in_room(room_id)
    |> Enum.any?(&(&1.id == player_id && &1.type == :player))
  end

  defp get_entity(id) when is_binary(id) do
    case Registry.get(id) do
      nil -> nil
      entity -> safe_entity_map(entity)
    end
  end
  defp get_entity([key: key]) do
    case Registry.get_by_key(key) do
      nil -> nil
      entity -> safe_entity_map(entity)
    end
  end

  defp find_entities(room_id, opts) do
    entities_in_room(room_id, opts)
  end

  defp safe_entity_map(entity) do
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      short_desc: entity.short_desc,
      location: entity.location_id,
      tags: entity.tags || []
    }
  end

  defp time_of_day do
    hour = current_hour()
    cond do
      hour >= 5 and hour < 7 -> :dawn
      hour >= 7 and hour < 12 -> :morning
      hour >= 12 and hour < 14 -> :noon
      hour >= 14 and hour < 18 -> :afternoon
      hour >= 18 and hour < 20 -> :evening
      true -> :night
    end
  end

  defp current_hour do
    # TODO: Integrate with game time system
    DateTime.utc_now().hour
  end

  defp current_weather do
    # TODO: Integrate with weather system
    :clear
  end

  defp is_outdoor?(room_id) do
    case Registry.get(room_id) do
      nil -> false
      room -> Map.get(room.attributes || %{}, :outdoor, false)
    end
  end

  defp is_indoor?(room_id), do: not is_outdoor?(room_id)

  defp is_dark?(room_id) do
    case Registry.get(room_id) do
      nil -> false
      room -> Map.get(room.attributes || %{}, :lighting, :bright) in [:dark, :pitch_black]
    end
  end

  defp danger_level(room_id) do
    case Registry.get(room_id) do
      nil -> 0
      room -> Map.get(room.attributes || %{}, :danger_level, 0)
    end
  end

  defp get_room_attr(room_id, key) do
    get_room_attr(room_id, key, nil)
  end

  defp get_room_attr(room_id, key, default) do
    case Registry.get(room_id) do
      nil -> default
      room -> Map.get(room.attributes || %{}, key, default)
    end
  end
end
```

*(Continue with Actions, World, Combat, NPC, Scheduling, Utilities bindings...)*

---

## Phase 3: Hook Integration (Week 5-6)

### 3.1 Hook Integration Module

**File:** `lib/loka/framework/scripting/hook_integration.ex`

```elixir
defmodule Loka.Framework.Scripting.HookIntegration do
  @moduledoc """
  Connects builder scripts to the engine hooks system.

  Registers hook handlers that look up and execute entity scripts.
  Scripts are found by:
  1. Entity's scripts map (from YAML prototype)
  2. Convention: "{entity_key}_{hook}" in scripts table
  """

  alias Loka.Engine.{Hooks, Scripts}
  alias Loka.Engine.Script.Sandbox
  alias Loka.Framework.Scripting.ActionProcessor

  @script_hooks [
    :on_look,
    :on_enter,
    :on_leave,
    :on_say,
    :on_give,
    :on_attack,
    :on_death,
    :on_tick,
    :on_time,
    :on_use,
    :before_enter,
    :before_leave,
    :before_attack
  ]

  @doc """
  Register script handlers for all script hooks.
  Called during application startup.
  """
  def register_hooks do
    for hook <- @script_hooks do
      engine_hook = script_hook_to_engine_hook(hook)
      Hooks.register(engine_hook, __MODULE__, :handle_hook, priority: 50)
    end
  end

  @doc """
  Handle a hook by looking up and executing entity scripts.
  """
  def handle_hook(entity, context) do
    hook = context[:trigger] || infer_hook(context)

    case find_script(entity, hook) do
      nil ->
        :ok

      script ->
        execute_script(script, entity, context)
    end
  end

  defp find_script(entity, hook) do
    hook_string = Atom.to_string(hook)

    # First, check entity's scripts map
    script_key = get_in(entity.scripts || %{}, [hook_string])

    if script_key do
      Scripts.get_by_key(script_key)
    else
      # Fall back to convention: {entity_key}_{hook}
      Scripts.get_by_key("#{entity.key}_#{hook_string}")
    end
  end

  defp execute_script(script, entity, context) do
    # Only execute enabled, approved scripts
    unless script.enabled and script.status == "approved" do
      :ok
    else
      case Sandbox.execute(script.source, entity, context) do
        {:ok, result, actions} ->
          # Process queued actions
          ActionProcessor.process(actions, entity, context)

          # Update script stats
          Scripts.record_execution(script.id, :success)

          # Return result for hook processing
          result

        {:error, reason} ->
          Scripts.record_execution(script.id, :error, inspect(reason))
          :ok
      end
    end
  end

  defp script_hook_to_engine_hook(:on_look), do: :at_before_look
  defp script_hook_to_engine_hook(:on_enter), do: :at_enter_room
  defp script_hook_to_engine_hook(:on_leave), do: :at_leave_room
  defp script_hook_to_engine_hook(:on_say), do: :at_after_say
  defp script_hook_to_engine_hook(:on_attack), do: :at_after_attack
  defp script_hook_to_engine_hook(:on_death), do: :at_death
  defp script_hook_to_engine_hook(:before_enter), do: :at_before_move
  defp script_hook_to_engine_hook(:before_attack), do: :at_before_attack
  defp script_hook_to_engine_hook(other), do: other

  defp infer_hook(%{trigger: trigger}), do: trigger
  defp infer_hook(_), do: :unknown
end
```

---

## Testing Strategy

### Unit Tests

```elixir
# test/loka/engine/script/sandbox_test.exs
defmodule Loka.Engine.Script.SandboxTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Script.Sandbox

  describe "execute/4" do
    test "executes simple expressions" do
      entity = %{id: "test", key: "test", type: :npc}
      context = %{}

      assert {:ok, 42, []} = Sandbox.execute("21 + 21", entity, context)
    end

    test "provides entity bindings" do
      entity = %{id: "npc-1", key: "guard", type: :npc, short_desc: "A guard"}
      context = %{}

      assert {:ok, "guard", []} = Sandbox.execute("entity.key", entity, context)
    end

    test "blocks dangerous patterns" do
      entity = %{id: "test", key: "test", type: :npc}
      context = %{}

      assert {:error, {:validation, _}} =
        Sandbox.execute("System.cmd(\"rm\", [\"-rf\", \"/\"])", entity, context)
    end

    test "times out long-running scripts" do
      entity = %{id: "test", key: "test", type: :npc}
      context = %{}

      # This would run forever without timeout
      script = """
      loop = fn f -> f.(f) end
      loop.(loop)
      """

      assert {:error, :timeout} =
        Sandbox.execute(script, entity, context, timeout: 100)
    end

    test "queues actions for later processing" do
      entity = %{id: "npc-1", key: "guard", type: :npc}
      context = %{player: %{id: "player-1"}}

      script = """
      say("Hello!")
      message("Welcome")
      :ok
      """

      assert {:ok, :ok, actions} = Sandbox.execute(script, entity, context)
      assert length(actions) == 2
    end
  end
end
```

### Integration Tests

```elixir
# test/loka/framework/scripting/integration_test.exs
defmodule Loka.Framework.Scripting.IntegrationTest do
  use Loka.DataCase

  alias Loka.Engine.Scripts
  alias Loka.Framework.Scripting.HookIntegration

  describe "end-to-end script execution" do
    test "executes on_look script and modifies description" do
      # Create a script
      {:ok, script} = Scripts.create(%{
        key: "test_npc_on_look",
        hook: "on_look",
        source: ~S'{:append, "The NPC waves at you."}'
      })

      # Create an entity with matching key
      entity = spawn_test_entity(key: "test_npc")
      context = %{trigger: :on_look, player: spawn_test_player()}

      # Execute through hook system
      result = HookIntegration.handle_hook(entity, context)

      assert result == {:append, "The NPC waves at you."}
    end

    test "script can check quest state" do
      player = spawn_test_player()
      game_state = %{quests: %{active: %{"main_quest" => %{}}}}

      script = ~S'''
      if quest_active?("main_quest") do
        {:append, "You're on the quest!"}
      else
        :default
      end
      '''

      entity = spawn_test_entity()
      context = %{player: player, game_state: game_state}

      {:ok, result, _} = Sandbox.execute(script, entity, context)
      assert result == {:append, "You're on the quest!"}
    end
  end
end
```

---

## Migration Plan

### Database Migration

```elixir
# priv/repo/migrations/YYYYMMDDHHMMSS_enhance_scripts_table.exs
defmodule Loka.Repo.Migrations.EnhanceScriptsTable do
  use Ecto.Migration

  def change do
    alter table(:scripts) do
      add :language, :string, default: "lua"
      add :status, :string, default: "approved"
      add :last_error, :text
      add :execution_count, :integer, default: 0
      add :avg_execution_ms, :float, default: 0.0
    end

    # Index for quick lookups
    create index(:scripts, [:key])
    create index(:scripts, [:hook])
    create index(:scripts, [:enabled, :status])
  end
end
```

### Lua to Elixir Migration

```elixir
defmodule Loka.Scripts.Migrator do
  @moduledoc """
  Migrate Lua scripts to Elixir syntax.
  """

  @lua_to_elixir_patterns [
    # Function calls
    {~r/game\.quest\.is_active\(([^)]+)\)/, "quest_active?(\\1)"},
    {~r/game\.quest\.is_complete\(([^)]+)\)/, "quest_complete?(\\1)"},
    {~r/game\.player\.has_item\(([^)]+)\)/, "has_item?(\\1)"},
    {~r/game\.player\.has_flag\(([^)]+)\)/, "has_flag?(\\1)"},
    {~r/game\.message\(([^,]+),\s*([^)]+)\)/, "message(\\2)"},

    # Control flow
    {~r/\bif\s+(.+)\s+then/, "if \\1 do"},
    {~r/\belseif\s+(.+)\s+then/, "else if \\1 do"},  # Note: needs manual fix
    {~r/\bend\b/, "end"},
    {~r/\belse\b/, "else"},

    # Operators
    {~r/\band\b/, "and"},
    {~r/\bor\b/, "or"},
    {~r/\bnot\b/, "not"},
    {~r/~=/, "!="},
    {~r/\.\./, "<>"},

    # Comments
    {~r/--(.*)$/, "# \\1"},
  ]

  def migrate(lua_source) do
    Enum.reduce(@lua_to_elixir_patterns, lua_source, fn {pattern, replacement}, source ->
      Regex.replace(pattern, source, replacement)
    end)
  end

  def migrate_all_scripts do
    Scripts.list_lua_scripts()
    |> Enum.each(fn script ->
      elixir_source = migrate(script.source)

      case Validator.validate(elixir_source) do
        :ok ->
          Scripts.update(script, %{
            source: elixir_source,
            language: "elixir"
          })

        {:error, reason} ->
          Logger.warning("Failed to migrate script #{script.key}: #{reason}")
      end
    end)
  end
end
```

---

## Implementation Priority

### Week 1-2: Core Engine
- [ ] Script schema enhancement
- [ ] Sandbox implementation
- [ ] Validator implementation
- [ ] Action queue
- [ ] Unit tests for engine layer

### Week 3-4: Framework Bindings
- [ ] Context bindings
- [ ] Query bindings (quest, player, entity)
- [ ] Action bindings (say, message, set_flag)
- [ ] World bindings (spawn, room manipulation)
- [ ] Integration tests

### Week 5-6: NPC & Combat
- [ ] NPC control bindings
- [ ] Combat bindings
- [ ] Status effect bindings
- [ ] Hook integration
- [ ] End-to-end tests

### Week 7-8: Advanced Features
- [ ] Scheduling bindings (after, recurring)
- [ ] World state bindings (flags, persistence)
- [ ] Custom events
- [ ] Admin UI enhancements

### Week 9-10: Polish & Migration
- [ ] Lua to Elixir migrator
- [ ] Documentation
- [ ] Performance optimization
- [ ] Production deployment

---

## Agent Strategy

### Recommended Approach: Documentation-Driven Boundaries

Rather than specialized agents, use **clear CLAUDE.md documentation** that guides any agent to the right layer:

```markdown
# Scripting System Development Guide

## Where to Make Changes

| Task | Layer | Directory | Key Files |
|------|-------|-----------|-----------|
| Sandbox security | Engine | lib/loka/engine/script/ | sandbox.ex, validator.ex |
| API bindings | Framework | lib/loka/framework/scripting/bindings/ | *.ex |
| Script content | Builder | priv/world/, scripts table | YAML, DB |
| Admin UI | Web | lib/loka_web/live/admin_live/ | scripts_tab.ex |

## Layer Rules

1. **Engine** - Generic, reusable, no game concepts
2. **Framework** - Game-specific, uses engine APIs
3. **Builder** - Content only, no code changes
```

### Model Selection Guide

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| **Architecture & Design** | Opus 4.5 | Complex decisions, cross-layer reasoning |
| **Implementation** | Sonnet | Best balance of capability and cost |
| **Parallel Tasks** | Sonnet subagents | Multiple modules simultaneously |
| **Simple Fixes** | Haiku | Quick, focused changes |
| **Tests & Docs** | Sonnet/Haiku | Straightforward generation |

### When to Use Subagents

Use **sonnet subagents** for parallelizable implementation tasks:
- Writing multiple binding modules simultaneously (bindings/queries.ex, bindings/actions.ex, etc.)
- Running tests while implementing new features
- Documentation and example generation
- Migrating existing Lua scripts to Elixir

Use **opus** for:
- Architectural decisions and API design
- Cross-layer changes (engine + framework)
- Complex debugging across subsystems
- Security review of sandbox implementation

Use **haiku** for:
- Simple typo/bug fixes
- Adding single functions
- Updating documentation