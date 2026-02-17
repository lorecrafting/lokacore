defmodule Loka.Testing.Bot.Assertions do
  @moduledoc """
  Assertion system for bot testing.

  Provides a way to define expectations about game state and validate them
  during or after a bot test run. This enables automated testing of quests,
  storylines, and game mechanics.

  ## Usage

  Assertions can be used in strategies to verify expected outcomes:

      defmodule MyTestStrategy do
        @behaviour Loka.Testing.Bot.Strategy
        alias Loka.Testing.Bot.Assertions

        @impl true
        def init(opts) do
          {:ok, %{
            assertions: [
              {:quest_completed, "quest_find_leaf"},
              {:has_item, "leaf"},
              {:visited_room, "forest_clearing"},
              {:flag_set, "met_hermit"}
            ],
            results: Assertions.new()
          }}
        end

        @impl true
        def decide(context, state) do
          # Run assertions after each tick
          results = Assertions.check_all(state.assertions, context.game_state, context)

          if Assertions.all_passed?(results) do
            {:idle, %{state | results: results, phase: :complete}}
          else
            # Continue with test logic...
            {action, state}
          end
        end
      end

  ## Assertion Types

  | Type | Args | Description |
  |------|------|-------------|
  | `:quest_completed` | quest_id | Quest is in completed list |
  | `:quest_active` | quest_id | Quest is currently active |
  | `:has_item` | item_key | Item is in inventory |
  | `:has_items` | {item_key, count} | Has N items matching key |
  | `:flag_set` | flag_name | Player flag is set |
  | `:flag_not_set` | flag_name | Player flag is not set |
  | `:visited_room` | room_key | Room has been visited |
  | `:in_room` | room_key | Currently in room |
  | `:level_at_least` | level | Player level >= value |
  | `:stat_at_least` | {stat, value} | Stat >= value |
  | `:health_above` | percentage | Health above threshold |
  | `:combat_victory` | enemy_key | Won combat against enemy |
  | `:custom` | {module, function, args} | Custom assertion function |

  ## Result Structure

  Results track the status of each assertion:

      %{
        passed: [{:quest_completed, "quest_find_leaf"}, ...],
        failed: [{:has_item, "rare_gem"}, ...],
        pending: [{:combat_victory, "boss"}, ...],
        errors: [{:quest_completed, "unknown_quest", :quest_not_found}, ...]
      }
  """

  alias Loka.Utils.MapHelpers

  @type assertion_type ::
          :quest_completed
          | :quest_active
          | :has_item
          | :has_items
          | :flag_set
          | :flag_not_set
          | :visited_room
          | :in_room
          | :level_at_least
          | :stat_at_least
          | :health_above
          | :combat_victory
          | :custom

  @type assertion :: {assertion_type(), term()}
  @type check_result :: :passed | :failed | :pending | {:error, term()}

  @type results :: %{
          passed: [assertion()],
          failed: [assertion()],
          pending: [assertion()],
          errors: [{assertion_type(), term(), term()}]
        }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Creates a new empty results structure.
  """
  @spec new() :: results()
  def new do
    %{
      passed: [],
      failed: [],
      pending: [],
      errors: []
    }
  end

  @doc """
  Checks a single assertion against the current game state.

  Returns `:passed`, `:failed`, `:pending`, or `{:error, reason}`.
  """
  @spec check(assertion(), map(), map()) :: check_result()
  def check(assertion, game_state, context \\ %{})

  def check({:quest_completed, quest_id}, game_state, _context) do
    quests = game_state.quests || %{}
    completed = Map.get(quests, "completed", []) ++ Map.get(quests, :completed, [])

    if quest_id in completed, do: :passed, else: :pending
  end

  def check({:quest_active, quest_id}, game_state, _context) do
    quests = game_state.quests || %{}
    active = Map.get(quests, "active", []) ++ Map.get(quests, :active, [])

    if quest_id in active, do: :passed, else: :pending
  end

  def check({:has_item, item_key}, game_state, _context) do
    inventory = game_state.inventory || []
    has_it = Enum.any?(inventory, &item_matches?(&1, item_key))

    if has_it, do: :passed, else: :pending
  end

  def check({:has_items, {item_key, required_count}}, game_state, _context) do
    inventory = game_state.inventory || []
    count = Enum.count(inventory, &item_matches?(&1, item_key))

    cond do
      count >= required_count -> :passed
      count > 0 -> :pending
      true -> :pending
    end
  end

  def check({:flag_set, flag_name}, game_state, _context) do
    flags = game_state.flags || %{}
    flag_value = Map.get(flags, flag_name) || Map.get(flags, to_string(flag_name))

    if flag_value, do: :passed, else: :pending
  end

  def check({:flag_not_set, flag_name}, game_state, _context) do
    flags = game_state.flags || %{}
    flag_value = Map.get(flags, flag_name) || Map.get(flags, to_string(flag_name))

    if flag_value, do: :failed, else: :passed
  end

  def check({:visited_room, room_key}, _game_state, context) do
    visited = Map.get(context, :visited_rooms, [])

    if room_key in visited, do: :passed, else: :pending
  end

  def check({:in_room, room_key}, _game_state, context) do
    room = Map.get(context, :room)
    current_key = room && (room.key || room.id)

    if current_key == room_key, do: :passed, else: :pending
  end

  def check({:level_at_least, required_level}, game_state, _context) do
    stats = game_state.stats || %{}
    level = MapHelpers.get_flexible(stats, :level, 1)

    if level >= required_level, do: :passed, else: :pending
  end

  def check({:stat_at_least, {stat_name, required_value}}, game_state, _context) do
    stats = game_state.stats || %{}
    value = MapHelpers.get_flexible(stats, stat_name, 0)

    if value >= required_value, do: :passed, else: :pending
  end

  def check({:health_above, percentage}, game_state, _context) do
    health = game_state.health || %{}
    current = MapHelpers.get_flexible(health, :current, 100)
    max = MapHelpers.get_flexible(health, :max, 100)

    health_pct = if max > 0, do: current / max * 100, else: 100

    if health_pct > percentage, do: :passed, else: :pending
  end

  def check({:combat_victory, enemy_key}, _game_state, context) do
    victories = Map.get(context, :combat_victories, [])

    if enemy_key in victories, do: :passed, else: :pending
  end

  def check({:custom, {module, function, args}}, game_state, context) do
    try do
      apply(module, function, [game_state, context | args])
    rescue
      e -> {:error, {:custom_assertion_error, e}}
    end
  end

  def check({type, _arg}, _game_state, _context) do
    {:error, {:unknown_assertion_type, type}}
  end

  @doc """
  Checks all assertions and returns updated results.

  Previously passed/failed assertions are preserved.
  Pending assertions are re-checked.
  """
  @spec check_all([assertion()], map(), map()) :: results()
  def check_all(assertions, game_state, context \\ %{}) do
    Enum.reduce(assertions, new(), fn assertion, acc ->
      result = check(assertion, game_state, context)
      record_result(acc, assertion, result)
    end)
  end

  @doc """
  Updates results by re-checking pending assertions.

  Preserves passed/failed results and only re-evaluates pending ones.
  """
  @spec recheck_pending(results(), map(), map()) :: results()
  def recheck_pending(results, game_state, context \\ %{}) do
    rechecked =
      Enum.reduce(results.pending, new(), fn assertion, acc ->
        result = check(assertion, game_state, context)
        record_result(acc, assertion, result)
      end)

    %{
      passed: results.passed ++ rechecked.passed,
      failed: results.failed ++ rechecked.failed,
      pending: rechecked.pending,
      errors: results.errors ++ rechecked.errors
    }
  end

  @doc """
  Returns true if all assertions have passed.
  """
  @spec all_passed?(results()) :: boolean()
  def all_passed?(results) do
    Enum.empty?(results.pending) && Enum.empty?(results.failed) && Enum.empty?(results.errors)
  end

  @doc """
  Returns true if any assertions have failed.
  """
  @spec any_failed?(results()) :: boolean()
  def any_failed?(results) do
    Enum.any?(results.failed) || Enum.any?(results.errors)
  end

  @doc """
  Returns true if there are still pending assertions.
  """
  @spec has_pending?(results()) :: boolean()
  def has_pending?(results) do
    Enum.any?(results.pending)
  end

  @doc """
  Returns a summary of the results as a map.
  """
  @spec summary(results()) :: map()
  def summary(results) do
    %{
      passed: length(results.passed),
      failed: length(results.failed),
      pending: length(results.pending),
      errors: length(results.errors),
      total: length(results.passed) + length(results.failed) + length(results.pending),
      success: all_passed?(results)
    }
  end

  @doc """
  Formats results as a human-readable string.
  """
  @spec format_results(results()) :: String.t()
  def format_results(results) do
    lines = []

    lines =
      if Enum.any?(results.passed) do
        passed_lines =
          Enum.map(results.passed, fn {type, arg} -> "  ✓ #{type}: #{inspect(arg)}" end)

        lines ++ ["Passed (#{length(results.passed)}):"] ++ passed_lines
      else
        lines
      end

    lines =
      if Enum.any?(results.failed) do
        failed_lines =
          Enum.map(results.failed, fn {type, arg} -> "  ✗ #{type}: #{inspect(arg)}" end)

        lines ++ ["Failed (#{length(results.failed)}):"] ++ failed_lines
      else
        lines
      end

    lines =
      if Enum.any?(results.pending) do
        pending_lines =
          Enum.map(results.pending, fn {type, arg} -> "  ○ #{type}: #{inspect(arg)}" end)

        lines ++ ["Pending (#{length(results.pending)}):"] ++ pending_lines
      else
        lines
      end

    lines =
      if Enum.any?(results.errors) do
        error_lines =
          Enum.map(results.errors, fn {type, arg, error} ->
            "  ⚠ #{type}: #{inspect(arg)} - #{inspect(error)}"
          end)

        lines ++ ["Errors (#{length(results.errors)}):"] ++ error_lines
      else
        lines
      end

    Enum.join(lines, "\n")
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp record_result(results, assertion, :passed) do
    %{results | passed: [assertion | results.passed]}
  end

  defp record_result(results, assertion, :failed) do
    %{results | failed: [assertion | results.failed]}
  end

  defp record_result(results, assertion, :pending) do
    %{results | pending: [assertion | results.pending]}
  end

  defp record_result(results, {type, arg}, {:error, reason}) do
    %{results | errors: [{type, arg, reason} | results.errors]}
  end

  defp item_matches?(item_id, item_key) when is_binary(item_id) and is_binary(item_key) do
    # Match if item_id contains the item_key (prototype key is part of entity id)
    String.contains?(item_id, item_key)
  end

  defp item_matches?(_, _), do: false
end
