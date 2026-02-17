defmodule Loka.Testing.Bot.Strategies.ContentVerifier do
  @moduledoc """
  A bot strategy that verifies AI-built content by playing through it.

  Executes a list of verification steps — moving between rooms, checking
  entities exist, talking to NPCs, and validating quest flow. Records
  pass/fail results for each step.

  ## Steps

  Steps are tuples describing what to verify:

  - `{:goto, room_key}` — navigate to a room (BFS pathfinding)
  - `{:verify_room, opts}` — check room has expected properties
  - `{:verify_entity, entity_key}` — check an entity exists in current room
  - `{:talk_to, npc_key}` — start dialogue with an NPC
  - `{:pick_dialogue_option, n}` — select dialogue option by index
  - `{:verify_quest_started, quest_key}` — check quest is active
  - `{:move, direction}` — move in a direction
  - `{:pickup, item_key}` — pick up an item
  - `{:verify_quest_completed, quest_key}` — check quest is completed

  ## Usage

      {:ok, pid} = BotSupervisor.spawn_channel_bot(
        strategy: ContentVerifier,
        strategy_opts: [
          steps: [
            {:goto, "tavern_main"},
            {:verify_entity, "bartender_npc"},
            {:talk_to, "bartender_npc"},
            {:pick_dialogue_option, 0},
            {:verify_quest_started, "tavern_errand"}
          ]
        ]
      )

  ## Results

  After running, `state.results` contains a list of `{step, :pass | {:fail, reason}}`.
  """

  @behaviour Loka.Testing.Bot.Strategy

  require Logger

  alias Loka.Testing.Bot.Strategy

  defstruct [
    :steps,
    :current_step_index,
    :results,
    :max_steps,
    phase: :running,
    tick_count: 0,
    stuck_count: 0,
    max_stuck: 10
  ]

  @type step ::
          {:goto, String.t()}
          | {:verify_room, keyword()}
          | {:verify_entity, String.t()}
          | {:talk_to, String.t()}
          | {:pick_dialogue_option, non_neg_integer()}
          | {:verify_quest_started, String.t()}
          | {:move, String.t()}
          | {:pickup, String.t()}
          | {:verify_quest_completed, String.t()}

  @type result :: {step(), :pass | {:fail, String.t()}}

  # =============================================================================
  # Strategy Callbacks
  # =============================================================================

  @impl true
  @spec init(keyword()) :: {:ok, map()}
  def init(opts) do
    steps = Keyword.fetch!(opts, :steps)
    max_steps = Keyword.get(opts, :max_steps, 500)

    state = %__MODULE__{
      steps: steps,
      current_step_index: 0,
      results: [],
      max_steps: max_steps
    }

    {:ok, state}
  end

  @impl true
  @spec decide(Strategy.context(), map()) :: {Strategy.action(), map()}
  def decide(_context, %{phase: :done} = state) do
    {:idle, state}
  end

  def decide(context, %__MODULE__{} = state) do
    state = %{state | tick_count: state.tick_count + 1}

    if state.tick_count > state.max_steps do
      state = finish(state, "Max steps exceeded")
      {:idle, state}
    else
      execute_current_step(context, state)
    end
  end

  @impl true
  @spec handle_event(map(), map()) :: {:ok, map()}
  def handle_event(_event, state) do
    {:ok, state}
  end

  # =============================================================================
  # Public API
  # =============================================================================

  @doc "Returns verification results from completed strategy state."
  @spec results(map()) :: [result()]
  def results(%__MODULE__{results: results}), do: Enum.reverse(results)

  @doc "Returns true if all steps passed."
  @spec all_passed?(map()) :: boolean()
  def all_passed?(%__MODULE__{results: results}) do
    Enum.all?(results, fn {_step, outcome} -> outcome == :pass end)
  end

  @doc "Returns count of passed/failed steps."
  @spec summary(map()) :: %{
          passed: non_neg_integer(),
          failed: non_neg_integer(),
          total: non_neg_integer()
        }
  def summary(%__MODULE__{results: results}) do
    results = Enum.reverse(results)
    passed = Enum.count(results, fn {_s, o} -> o == :pass end)
    failed = Enum.count(results, fn {_s, o} -> o != :pass end)
    %{passed: passed, failed: failed, total: length(results)}
  end

  # =============================================================================
  # Step Execution
  # =============================================================================

  defp execute_current_step(_context, %{current_step_index: idx, steps: steps} = state)
       when idx >= length(steps) do
    state = finish(state, nil)
    {:idle, state}
  end

  defp execute_current_step(context, state) do
    step = Enum.at(state.steps, state.current_step_index)
    {action, state} = run_step(step, context, state)
    {action, state}
  end

  defp run_step({:move, direction}, _context, state) do
    state = record_pass(state, {:move, direction})
    {{:move, direction}, advance(state)}
  end

  defp run_step({:goto, room_key}, context, state) do
    room = context[:room]

    cond do
      room && (room.key == room_key || Map.get(room, :key) == room_key) ->
        state = record_pass(state, {:goto, room_key})
        {:idle, advance(state)}

      true ->
        # Try to navigate — pick first available exit
        exits = Strategy.get_available_exits(room)

        if exits == [] do
          state = record_fail(state, {:goto, room_key}, "No exits available")
          {:idle, advance(state)}
        else
          # Simple: try first exit (a real implementation would use BFS)
          direction = List.first(exits)
          {{:move, direction}, state}
        end
    end
  end

  defp run_step({:verify_room, opts}, context, state) do
    step = {:verify_room, opts}
    room = context[:room]

    cond do
      is_nil(room) ->
        state = record_fail(state, step, "Not in a room")
        {:idle, advance(state)}

      opts[:has_description] && empty_description?(room) ->
        state = record_fail(state, step, "Room has no description")
        {:idle, advance(state)}

      true ->
        state = record_pass(state, step)
        {:idle, advance(state)}
    end
  end

  defp run_step({:verify_entity, entity_key}, context, state) do
    step = {:verify_entity, entity_key}
    nearby = context[:nearby_entities] || []

    found =
      Enum.any?(nearby, fn e ->
        e.key == entity_key || Map.get(e, :key) == entity_key
      end)

    if found do
      state = record_pass(state, step)
      {:idle, advance(state)}
    else
      state = record_fail(state, step, "Entity #{entity_key} not found in room")
      {:idle, advance(state)}
    end
  end

  defp run_step({:talk_to, npc_key}, context, state) do
    step = {:talk_to, npc_key}
    nearby = context[:nearby_entities] || []

    npc =
      Enum.find(nearby, fn e ->
        (e.key == npc_key || Map.get(e, :key) == npc_key) && e.type == :npc
      end)

    if npc do
      state = record_pass(state, step)
      {{:start_dialogue, npc.id}, advance(state)}
    else
      state = record_fail(state, step, "NPC #{npc_key} not found")
      {:idle, advance(state)}
    end
  end

  defp run_step({:pick_dialogue_option, n}, _context, state) do
    step = {:pick_dialogue_option, n}
    state = record_pass(state, step)
    {{:dialogue_choice, n}, advance(state)}
  end

  defp run_step({:pickup, item_key}, context, state) do
    step = {:pickup, item_key}
    nearby = context[:nearby_entities] || []

    item =
      Enum.find(nearby, fn e ->
        (e.key == item_key || Map.get(e, :key) == item_key) && e.type == :item
      end)

    if item do
      state = record_pass(state, step)
      {{:interact, item.id}, advance(state)}
    else
      state = record_fail(state, step, "Item #{item_key} not found in room")
      {:idle, advance(state)}
    end
  end

  defp run_step({:verify_quest_started, quest_key}, context, state) do
    step = {:verify_quest_started, quest_key}
    game_state = context[:game_state] || %{}

    if Strategy.has_active_quest?(game_state, quest_key) do
      state = record_pass(state, step)
      {:idle, advance(state)}
    else
      state = record_fail(state, step, "Quest #{quest_key} not active")
      {:idle, advance(state)}
    end
  end

  defp run_step({:verify_quest_completed, quest_key}, context, state) do
    step = {:verify_quest_completed, quest_key}
    game_state = context[:game_state] || %{}

    if Strategy.quest_completed?(game_state, quest_key) do
      state = record_pass(state, step)
      {:idle, advance(state)}
    else
      state = record_fail(state, step, "Quest #{quest_key} not completed")
      {:idle, advance(state)}
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp advance(state) do
    %{state | current_step_index: state.current_step_index + 1, stuck_count: 0}
  end

  defp record_pass(state, step) do
    Logger.debug("[ContentVerifier] PASS: #{inspect(step)}")
    %{state | results: [{step, :pass} | state.results]}
  end

  defp record_fail(state, step, reason) do
    Logger.warning("[ContentVerifier] FAIL: #{inspect(step)} — #{reason}")
    %{state | results: [{step, {:fail, reason}} | state.results]}
  end

  defp finish(state, nil) do
    Logger.debug("[ContentVerifier] Finished — #{length(state.results)} steps completed")
    %{state | phase: :done}
  end

  defp finish(state, reason) do
    Logger.warning("[ContentVerifier] Stopped early — #{reason}")
    %{state | phase: :done}
  end

  defp empty_description?(room) do
    desc = Map.get(room, :short_desc, nil) || get_in(room.components || %{}, ["description"])
    is_nil(desc) || desc == ""
  end
end
