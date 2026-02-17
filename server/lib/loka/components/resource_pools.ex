defmodule Loka.Components.ResourcePools do
  @moduledoc """
  Typed access to the `resource_pools` component.

  Resource pools track current/max values for entity resources like health,
  mana, stamina, etc. Stored as:

      %{
        "health" => %{"current" => 100, "max" => 100},
        "mana" => %{"current" => 45, "max" => 80}
      }
  """

  alias Loka.Content.Resource, as: ContentResource
  alias Loka.Engine.FormulaEvaluator

  @component_key "resource_pools"

  alias Loka.Engine.Entity

  @spec get(Entity.t()) :: map()
  def get(entity), do: Map.get(entity.components, @component_key, %{})

  @spec has?(Entity.t()) :: boolean()
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  @spec put(Entity.t(), map()) :: Entity.t()
  def put(entity, pools) when is_map(pools),
    do: %{entity | components: Map.put(entity.components, @component_key, pools)}

  @spec component_key() :: String.t()
  def component_key, do: @component_key

  @doc """
  Initializes resource pools for an entity based on registered resource types
  and the entity's stats. Returns the pools map.
  """
  @spec init_pools(map()) :: map()
  def init_pools(stats \\ %{}) do
    ContentResource.all()
    |> Enum.map(fn resource ->
      max_value = calculate_max(resource, stats)

      current_value =
        if ContentResource.starts_full(resource) do
          max_value
        else
          ContentResource.min_value(resource)
        end

      {resource.key, %{"current" => current_value, "max" => max_value}}
    end)
    |> Map.new()
  end

  defp calculate_max(resource, stats) do
    formula = ContentResource.max_formula(resource)
    FormulaEvaluator.evaluate!(formula, stats, 100)
  end
end
