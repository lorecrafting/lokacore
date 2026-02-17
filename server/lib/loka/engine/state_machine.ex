defmodule Loka.Engine.StateMachine do
  @moduledoc """
  Lightweight state machine for entity components.

  Used by: quests, combat, crafting, dialogue, NPC AI, player sessions, entity lifecycle.

  ## Defining a machine

      @quest_machine StateMachine.new(%{
        initial: "available",
        transitions: %{
          "available"            => ["accepted"],
          "accepted"            => ["in_progress", "abandoned"],
          "in_progress"         => ["objectives_complete", "abandoned", "failed"],
          "objectives_complete" => ["turned_in", "abandoned"],
          "abandoned"           => ["accepted"],
          "failed"              => ["accepted"],
        }
      })

  ## Transitioning

      {:ok, "in_progress"} = StateMachine.transition(@quest_machine, "accepted", "in_progress")
      {:error, {:invalid_transition, "accepted", "turned_in"}} =
        StateMachine.transition(@quest_machine, "accepted", "turned_in")

  ## With callbacks (optional)

      @quest_machine StateMachine.new(%{
        initial: "available",
        transitions: %{...},
        on_enter: %{
          "accepted" => :on_quest_accepted,
          "turned_in" => :on_quest_turned_in,
        },
        on_exit: %{
          "in_progress" => :on_leave_in_progress,
        }
      })

      # Callbacks return list of side-effect atoms for the caller to handle
      {:ok, "in_progress", callbacks} = StateMachine.transition_with_callbacks(machine, "accepted", "in_progress")
      # callbacks = [exit: :on_leave_accepted, enter: :on_quest_in_progress]
  """

  @type t :: %__MODULE__{
          initial: String.t(),
          transitions: %{String.t() => [String.t()]},
          on_enter: %{String.t() => atom()},
          on_exit: %{String.t() => atom()},
          states: MapSet.t(String.t())
        }

  defstruct [:initial, :transitions, :on_enter, :on_exit, :states]

  @doc "Create a new state machine definition."
  @spec new(map()) :: t()
  def new(opts) do
    transitions = opts.transitions

    all_states =
      transitions
      |> Enum.flat_map(fn {from, tos} -> [from | tos] end)
      |> MapSet.new()

    %__MODULE__{
      initial: opts[:initial] || List.first(Map.keys(transitions)),
      transitions: transitions,
      on_enter: opts[:on_enter] || %{},
      on_exit: opts[:on_exit] || %{},
      states: all_states
    }
  end

  @doc "Check if a transition is valid."
  @spec can_transition?(t(), String.t(), String.t()) :: boolean()
  def can_transition?(%__MODULE__{} = machine, from, to) do
    to in Map.get(machine.transitions, from, [])
  end

  @doc "Attempt a transition. Returns {:ok, new_state} or {:error, reason}."
  @spec transition(t(), String.t(), String.t()) ::
          {:ok, String.t()} | {:error, {:invalid_transition, String.t(), String.t()}}
  def transition(%__MODULE__{} = machine, current, target) do
    if can_transition?(machine, current, target) do
      {:ok, target}
    else
      {:error, {:invalid_transition, current, target}}
    end
  end

  @doc "Transition with callback atoms. Returns {:ok, new_state, callbacks} or {:error, reason}."
  @spec transition_with_callbacks(t(), String.t(), String.t()) ::
          {:ok, String.t(), [{:enter | :exit, atom()}]}
          | {:error, {:invalid_transition, String.t(), String.t()}}
  def transition_with_callbacks(%__MODULE__{} = machine, current, target) do
    case transition(machine, current, target) do
      {:ok, new_state} ->
        callbacks =
          []
          |> maybe_add(:exit, Map.get(machine.on_exit, current))
          |> maybe_add(:enter, Map.get(machine.on_enter, target))

        {:ok, new_state, callbacks}

      error ->
        error
    end
  end

  @doc "List all valid transitions from a state."
  @spec available_transitions(t(), String.t()) :: [String.t()]
  def available_transitions(%__MODULE__{} = machine, from) do
    Map.get(machine.transitions, from, [])
  end

  @doc "Check if a state is terminal (no outgoing transitions)."
  @spec terminal?(t(), String.t()) :: boolean()
  def terminal?(%__MODULE__{} = machine, state) do
    available_transitions(machine, state) == []
  end

  @doc "All defined states."
  @spec states(t()) :: MapSet.t(String.t())
  def states(%__MODULE__{} = machine), do: machine.states

  defp maybe_add(list, _type, nil), do: list
  defp maybe_add(list, type, callback), do: list ++ [{type, callback}]
end
