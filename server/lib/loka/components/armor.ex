defmodule Loka.Components.Armor do
  @moduledoc "Typed access to the `armor` component (defense, type)."

  @component_key "armor"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def defense(entity), do: get_in(entity.components, [@component_key, "defense"]) || 0
  def armor_type(entity), do: get_in(entity.components, [@component_key, "type"])
end
