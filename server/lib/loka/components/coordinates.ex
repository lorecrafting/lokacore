defmodule Loka.Components.Coordinates do
  @moduledoc "Typed access to the `coordinates` component (x, y, z)."

  @component_key "coordinates"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def x(entity), do: get_in(entity.components, [@component_key, "x"]) || 0
  def y(entity), do: get_in(entity.components, [@component_key, "y"]) || 0
  def z(entity), do: get_in(entity.components, [@component_key, "z"]) || 0
end
