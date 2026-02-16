defmodule Loka.Components.ZoneConfig do
  @moduledoc "Typed access to the `zone` component (level_range, theme)."

  @component_key "zone"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def level_range(entity), do: get_in(entity.components, [@component_key, "level_range"])
  def theme(entity), do: get_in(entity.components, [@component_key, "theme"])
end
