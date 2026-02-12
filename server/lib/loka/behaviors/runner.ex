defmodule Loka.Behaviors.Runner do
  @moduledoc """
  Helper functions for V2 behaviors.

  Provides config access, state management, and common utilities
  used across behavior modules.

  ## V2 Changes

  In V1, Runner orchestrated event dispatch through behaviors.
  In V2, `EntityServer.dispatch_event/3` handles dispatch.
  Runner is now a helper/utility module only.
  """

  alias Loka.Engine.Entity

  # =============================================================================
  # Config Access
  # =============================================================================

  @doc """
  Gets the behavior config from an entity's components.

  Looks up `entity.components["behavior_config"]["behavior_name"]`.
  """
  @spec get_config(Entity.t(), module()) :: map()
  def get_config(entity, behavior_module) do
    config_key = behavior_key(behavior_module)
    behavior_config = (entity.components || %{})["behavior_config"] || %{}

    config = behavior_config[config_key] || %{}
    normalize_config(config)
  end

  @doc """
  Gets a specific value from behavior config.
  """
  @spec get_config(Entity.t(), module(), atom(), term()) :: term()
  def get_config(entity, behavior_module, key, default \\ nil) do
    config = get_config(entity, behavior_module)
    Map.get(config, key, default)
  end

  @doc """
  Extracts the behavior key from a module name.

  ## Examples

      iex> Runner.behavior_key(Loka.Behaviors.Guard)
      "guard"
  """
  @spec behavior_key(module()) :: String.t()
  def behavior_key(module) do
    module |> Module.split() |> List.last() |> Macro.underscore()
  end

  # =============================================================================
  # State Helpers
  # =============================================================================

  @doc """
  Gets the persisted behavior state from entity components.
  """
  @spec get_behavior_state(Entity.t(), module()) :: map()
  def get_behavior_state(entity, behavior_module) do
    key = "behavior_state:#{behavior_key(behavior_module)}"
    (entity.components || %{})[key] || %{}
  end

  @doc """
  Saves behavior state to entity components.
  """
  @spec save_behavior_state(Entity.t(), module(), map()) :: Entity.t()
  def save_behavior_state(entity, behavior_module, state) do
    key = "behavior_state:#{behavior_key(behavior_module)}"
    %{entity | components: Map.put(entity.components || %{}, key, state)}
  end

  # =============================================================================
  # Common Utilities
  # =============================================================================

  @doc "Checks if an entity has any of the specified tags."
  @spec has_any_tag?(Entity.t(), [String.t()]) :: boolean()
  def has_any_tag?(%Entity{tags: tags}, check_tags) when is_list(tags) and is_list(check_tags) do
    Enum.any?(check_tags, &(&1 in tags))
  end

  def has_any_tag?(_, _), do: false

  @doc "Gets the health percentage of an entity (0-100)."
  @spec health_percent(Entity.t()) :: number()
  def health_percent(entity) do
    combatant = Entity.get_component(entity, "combatant") || %{}
    health = combatant["health"] || %{}
    current = health["current"] || 0
    max = health["max"] || 1
    if max > 0, do: current / max * 100, else: 0
  end

  # Private

  defp normalize_config(config) when is_map(config) do
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
end
