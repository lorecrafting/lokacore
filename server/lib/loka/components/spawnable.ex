defmodule Loka.Components.Spawnable do
  @moduledoc "Typed access to the `spawnable` component (respawn_time, max_instances)."

  @component_key "spawnable"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def respawn_time(entity), do: get_in(entity.components, [@component_key, "respawn_time"]) || 0
  def max_instances(entity), do: get_in(entity.components, [@component_key, "max_instances"]) || 1
end
