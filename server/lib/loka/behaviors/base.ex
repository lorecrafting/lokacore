defmodule Loka.Behaviors.Base do
  @moduledoc """
  Base module for creating NPC behaviors.

  Provides a consistent interface for behaviors that can be assigned to
  NPCs via YAML configuration. Use `use Loka.Behaviors.Base` in your
  behavior module to get default implementations and helper functions.

  ## Usage

      defmodule Loka.Behaviors.Guard do
        use Loka.Behaviors.Base

        @impl true
        def supported_types, do: [:npc]

        @impl true
        def handle_event(entity, %Event{type: :entity_entered} = event, state) do
          # Check for criminals and attack
          {:ok, state}
        end
      end

  ## Behavior Configuration

  Behaviors read their configuration from the entity's `behavior_config`
  attribute. For example, a Guard behavior would read from:

      entity.components["behavior_config"]["guard"]

  This allows YAML-based configuration:

      key: town_guard
      behaviors:
        - Loka.Behaviors.Guard
      attributes:
        behavior_config:
          guard:
            attack_tags: [criminal]
            shout_on_attack: "Stop, criminal!"

  ## Return Values

  - `{:ok, state}` - Continue processing other behaviors
  - `{:ok, state, events}` - Continue, also emit these events
  - `{:handled, state}` - Stop processing, event was handled
  - `{:handled, state, events}` - Stop processing, emit events
  - `{:halt, reason}` - Block the action (for `:before_*` events)
  """

  alias Loka.Engine.Entity

  @type state :: map()
  @type result ::
          {:ok, state()}
          | {:ok, state(), [Loka.Engine.Event.t()]}
          | {:handled, state()}
          | {:handled, state(), [Loka.Engine.Event.t()]}
          | {:halt, String.t()}

  @doc """
  Returns the entity types this behavior supports.
  """
  @callback supported_types() :: [Entity.entity_type()]

  @doc """
  Initializes the behavior state when first attached to an entity.
  Called when the entity is loaded or the behavior is first added.
  """
  @callback init(entity :: Entity.t(), config :: map()) :: {:ok, state()}

  @doc """
  Handles an event for the entity.
  """
  @callback handle_event(entity :: Entity.t(), event :: Loka.Engine.Event.t(), state()) ::
              result()

  @doc """
  Called when the behavior is being removed or entity is being saved.
  """
  @callback terminate(entity :: Entity.t(), state()) :: :ok

  @optional_callbacks [init: 2, terminate: 2]

  defmacro __using__(_opts) do
    quote do
      @behaviour Loka.Behaviors.Base

      import Loka.Behaviors.Base,
        only: [
          get_config: 2,
          get_config: 3,
          get_config: 4,
          has_tag?: 2,
          has_any_tag?: 2,
          health_percent: 1,
          location: 1
        ]

      alias Loka.Engine.{Entity, Event, EventBus, Entities}

      # Default implementations
      @impl Loka.Behaviors.Base
      def init(_entity, _config), do: {:ok, %{}}

      @impl Loka.Behaviors.Base
      def terminate(_entity, _state), do: :ok

      defoverridable init: 2, terminate: 2
    end
  end

  @doc """
  Gets the behavior config from an entity.

  The config key is derived from the module name. For example,
  `Loka.Behaviors.Guard` would look for config at `behavior_config.guard`.

  ## Examples

      config = get_config(entity, Loka.Behaviors.Guard)
      # Returns the map from entity.components["behavior_config"]["guard"]
  """
  @spec get_config(Entity.t(), module()) :: map()
  def get_config(entity, behavior_module) do
    config_key = behavior_key(behavior_module)
    behavior_config = get_behavior_config(entity)

    # Try string key first, then existing atom key (safe - won't exhaust atom table)
    config =
      cond do
        is_map(behavior_config[config_key]) ->
          behavior_config[config_key]

        is_map(safe_atom_lookup(behavior_config, config_key)) ->
          safe_atom_lookup(behavior_config, config_key)

        true ->
          %{}
      end

    normalize_config(config)
  end

  @doc """
  Gets a specific value from behavior config with a default.
  """
  @spec get_config(Entity.t(), module(), atom()) :: term()
  def get_config(entity, behavior_module, key, default \\ nil) do
    config = get_config(entity, behavior_module)
    Map.get(config, key, default)
  end

  @doc """
  Extracts the behavior key from a module name.

  ## Examples

      iex> Loka.Behaviors.Base.behavior_key(Loka.Behaviors.Guard)
      "guard"

      iex> Loka.Behaviors.Base.behavior_key(Loka.Behaviors.TownCrier)
      "town_crier"
  """
  @spec behavior_key(module()) :: String.t()
  def behavior_key(module) do
    module
    |> Module.split()
    |> List.last()
    |> Macro.underscore()
  end

  @doc """
  Checks if an entity has a specific tag.
  """
  @spec has_tag?(Entity.t(), String.t()) :: boolean()
  def has_tag?(%Entity{tags: tags}, tag) when is_list(tags) do
    tag in tags
  end

  def has_tag?(_, _), do: false

  @doc """
  Checks if an entity has any of the specified tags.
  """
  @spec has_any_tag?(Entity.t(), [String.t()]) :: boolean()
  def has_any_tag?(%Entity{tags: tags}, check_tags) when is_list(tags) and is_list(check_tags) do
    Enum.any?(check_tags, &(&1 in tags))
  end

  def has_any_tag?(_, _), do: false

  @doc """
  Gets the health percentage of an entity (0-100).
  """
  @spec health_percent(Entity.t()) :: number()
  def health_percent(entity) do
    combatant = Entity.get_component(entity, "combatant") || %{}
    health = combatant["health"] || %{}
    current = health["current"] || 0
    max = health["max"] || 1

    if max > 0, do: current / max * 100, else: 0
  end

  @doc """
  Gets the entity's current location ID.
  """
  @spec location(Entity.t()) :: String.t() | nil
  def location(%Entity{location_id: loc}), do: loc

  # Private helpers

  defp get_behavior_config(entity) do
    components = entity.components || %{}

    cond do
      is_map(components["behavior_config"]) -> components["behavior_config"]
      is_map(components[:behavior_config]) -> components[:behavior_config]
      true -> %{}
    end
  end

  defp normalize_config(config) when is_map(config) do
    # Convert string keys to atoms for easier access
    Map.new(config, fn
      {k, v} when is_binary(k) ->
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {atom_key, v}

      {k, v} ->
        {k, v}
    end)
  end

  defp normalize_config(_), do: %{}

  # Safe atom lookup - uses String.to_existing_atom to avoid atom exhaustion
  defp safe_atom_lookup(map, string_key) when is_binary(string_key) do
    atom_key = String.to_existing_atom(string_key)
    Map.get(map, atom_key)
  rescue
    ArgumentError -> nil
  end
end
