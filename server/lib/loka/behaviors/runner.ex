defmodule Loka.Behaviors.Runner do
  @moduledoc """
  Processes events through an entity's behavior chain.

  The Runner executes behaviors in order, managing state and
  handling the different return types from behaviors.

  ## Return Value Semantics

  - `{:ok, state}` - Continue to next behavior
  - `{:ok, state, events}` - Continue, collect events
  - `{:handled, state}` - Stop processing, event was handled
  - `{:handled, state, events}` - Stop processing, emit events
  - `{:halt, reason}` - Block the action (for before_* events)

  ## Usage

      # Process an event through entity's behaviors
      case Runner.process_event(entity, event) do
        {:ok, events} ->
          # All behaviors passed, emit collected events
          Enum.each(events, &EventBus.emit/1)

        {:handled, events} ->
          # A behavior handled it, emit its events
          Enum.each(events, &EventBus.emit/1)

        {:halt, reason} ->
          # Action was blocked
          send_to_player(player, reason)
      end

  ## State Management

  Behavior states are stored in entity attributes under the key
  `behavior_state:{ModuleName}`. The Runner loads and saves these
  automatically.
  """

  alias Loka.Engine.{Entity, Event}
  alias Loka.Behaviors.Base

  require Logger

  @type process_result ::
          {:ok, [Event.t()]}
          | {:handled, [Event.t()]}
          | {:halt, String.t()}

  @doc """
  Processes an event through all behaviors attached to an entity.

  Returns collected events or a halt reason.
  """
  @spec process_event(Entity.t(), Event.t()) :: process_result()
  def process_event(%Entity{behaviors: behaviors} = entity, %Event{} = event) do
    behaviors = behaviors || []

    # Filter to behaviors that use the new Base pattern
    base_behaviors = Enum.filter(behaviors, &uses_base?/1)

    if base_behaviors == [] do
      {:ok, []}
    else
      do_process(entity, event, base_behaviors, [])
    end
  end

  @doc """
  Initializes behavior states for an entity.

  Called when an entity is first loaded or behaviors are changed.
  """
  @spec init_behaviors(Entity.t()) :: Entity.t()
  def init_behaviors(%Entity{behaviors: behaviors} = entity) do
    behaviors = behaviors || []

    Enum.reduce(behaviors, entity, fn behavior, ent ->
      if uses_base?(behavior) && function_exported?(behavior, :init, 2) do
        config = Base.get_config(ent, behavior)

        case behavior.init(ent, config) do
          {:ok, state} ->
            save_behavior_state(ent, behavior, state)

          _ ->
            ent
        end
      else
        ent
      end
    end)
  end

  @doc """
  Gets the current state for a behavior on an entity.
  """
  @spec get_behavior_state(Entity.t(), module()) :: map()
  def get_behavior_state(entity, behavior_module) do
    key = behavior_state_key(behavior_module)
    attrs = entity.attributes || %{}

    cond do
      is_map(attrs[key]) ->
        attrs[key]

      is_map(attrs[key_as_atom(key)]) ->
        attrs[key_as_atom(key)]

      true ->
        %{}
    end
  end

  # Safely convert key to atom if it already exists (behavior keys are derived from
  # module names which are always existing atoms). Using to_existing_atom avoids
  # the DOS.StringToAtom security warning from Sobelow.
  defp key_as_atom(key) do
    String.to_existing_atom(key)
  rescue
    ArgumentError -> nil
  end

  @doc """
  Saves behavior state to entity attributes.
  """
  @spec save_behavior_state(Entity.t(), module(), map()) :: Entity.t()
  def save_behavior_state(entity, behavior_module, state) do
    key = behavior_state_key(behavior_module)
    attrs = entity.attributes || %{}
    updated_attrs = Map.put(attrs, key, state)
    %{entity | attributes: updated_attrs}
  end

  # Private implementation

  defp do_process(_entity, _event, [], collected_events) do
    {:ok, collected_events}
  end

  defp do_process(entity, event, [behavior | rest], collected_events) do
    state = get_behavior_state(entity, behavior)

    case behavior.handle_event(entity, event, state) do
      {:ok, new_state} ->
        entity = save_behavior_state(entity, behavior, new_state)
        do_process(entity, event, rest, collected_events)

      {:ok, new_state, events} when is_list(events) ->
        entity = save_behavior_state(entity, behavior, new_state)
        do_process(entity, event, rest, collected_events ++ events)

      {:handled, new_state} ->
        _entity = save_behavior_state(entity, behavior, new_state)
        {:handled, collected_events}

      {:handled, new_state, events} when is_list(events) ->
        _entity = save_behavior_state(entity, behavior, new_state)
        {:handled, collected_events ++ events}

      {:halt, reason} when is_binary(reason) ->
        {:halt, reason}

      other ->
        Logger.warning("Behavior #{inspect(behavior)} returned unexpected: #{inspect(other)}")
        do_process(entity, event, rest, collected_events)
    end
  end

  defp uses_base?(module) when is_atom(module) do
    # Check if the module uses Loka.Behaviors.Base
    try do
      behaviors = module.__info__(:attributes)[:behaviour] || []
      Loka.Behaviors.Base in behaviors
    rescue
      _ -> false
    end
  end

  defp uses_base?(_), do: false

  defp behavior_state_key(module) do
    "behavior_state:#{Base.behavior_key(module)}"
  end
end
