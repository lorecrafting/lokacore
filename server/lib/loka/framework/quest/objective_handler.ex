defmodule Loka.Framework.Quest.ObjectiveHandler do
  @moduledoc """
  Behaviour for quest objective handlers.

  Objective handlers define how different objective types match events,
  track progress, determine completion, and validate definitions.

  ## Implementing a Handler

  Create a module that implements this behaviour:

      defmodule MyGame.Quest.Handlers.EscortHandler do
        @behaviour Loka.Framework.Quest.ObjectiveHandler

        @impl true
        def type, do: :escort

        @impl true
        def matches?(objective_def, event) do
          event.type == :escort_progress &&
          objective_def.target_id == event.escort_id
        end

        @impl true
        def progress(objective_def, event, current_progress) do
          current_progress + event.distance_traveled
        end

        @impl true
        def is_complete?(objective_def, progress) do
          progress >= objective_def.target_distance
        end

        @impl true
        def validate(objective_def) do
          cond do
            is_nil(objective_def.target_id) ->
              {:error, "escort objective requires target_id (NPC to escort)"}
            is_nil(Map.get(objective_def, :target_distance)) ->
              {:error, "escort objective requires target_distance"}
            true ->
              :ok
          end
        end

        @impl true
        def description(objective_def, progress) do
          "Escort \#{objective_def.target_id} (\#{progress}/\#{objective_def.target_distance})"
        end
      end

  ## Registering a Handler

      Loka.Framework.Quest.ObjectiveRegistry.register(MyGame.Quest.Handlers.EscortHandler)

  ## Built-in Handlers

  The following handlers are registered automatically:

  - `:kill` - Defeat enemies (target_id, target_count)
  - `:get_item` - Obtain items (target_id)
  - `:go_to` - Visit locations (target_id)
  - `:talk` - Talk to NPCs (target_id, dialogue_topic)
  """

  # Objectives are now plain maps with atom keys (id, type, target_id, etc.)

  @doc """
  Returns the objective type this handler manages.

  This is an atom like `:kill`, `:go_to`, `:talk`, etc.
  """
  @callback type() :: atom()

  @doc """
  Checks if an event matches this objective.

  Called when a game event occurs to see if it should update this objective.

  ## Parameters

  - `objective_def` - The objective definition from the quest YAML
  - `event` - The game event (e.g., `%{type: :kill, target_id: "goblin", count: 1}`)

  ## Returns

  - `true` if this event should trigger progress on this objective
  - `false` otherwise
  """
  @callback matches?(objective_def :: map(), event :: map()) :: boolean()

  @doc """
  Calculates new progress after an event.

  Called after `matches?/2` returns true.

  ## Parameters

  - `objective_def` - The objective definition
  - `event` - The game event that matched
  - `current_progress` - Current progress value (integer)

  ## Returns

  The new progress value (integer).
  """
  @callback progress(
              objective_def :: map(),
              event :: map(),
              current_progress :: non_neg_integer()
            ) ::
              non_neg_integer()

  @doc """
  Checks if the objective is complete.

  ## Parameters

  - `objective_def` - The objective definition
  - `progress` - Current progress value

  ## Returns

  - `true` if the objective should be marked complete
  - `false` otherwise
  """
  @callback is_complete?(objective_def :: map(), progress :: non_neg_integer()) ::
              boolean()

  @doc """
  Validates an objective definition.

  Called when loading quest YAML files to catch configuration errors early.

  ## Parameters

  - `objective_def` - The objective definition to validate

  ## Returns

  - `:ok` if the definition is valid
  - `{:error, reason}` with a descriptive error message
  """
  @callback validate(objective_def :: map()) :: :ok | {:error, String.t()}

  @doc """
  Generates a human-readable description of the objective with current progress.

  Optional callback - defaults to using the objective's description field.

  ## Parameters

  - `objective_def` - The objective definition
  - `progress` - Current progress value

  ## Returns

  A string describing the objective and its progress.
  """
  @callback description(objective_def :: map(), progress :: non_neg_integer()) ::
              String.t()

  @optional_callbacks [description: 2]

  @doc """
  Default implementation of description/2.

  Returns the objective's description field with progress if target_count > 1.
  """
  def default_description(objective_def, progress) do
    target_count =
      Map.get(objective_def, :target_count) || Map.get(objective_def, "target_count") || 1

    description =
      Map.get(objective_def, :description) || Map.get(objective_def, "description") || ""

    if target_count > 1 do
      "#{description} (#{progress}/#{target_count})"
    else
      description
    end
  end
end
