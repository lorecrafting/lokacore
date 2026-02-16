defmodule Loka.Components.Stats do
  @moduledoc "Typed access to the `stats` component (str, dex, sta, level)."

  @component_key "stats"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def str(entity), do: get_in(entity.components, [@component_key, "str"]) || 0
  def dex(entity), do: get_in(entity.components, [@component_key, "dex"]) || 0
  def sta(entity), do: get_in(entity.components, [@component_key, "sta"]) || 0
  def level(entity), do: get_in(entity.components, [@component_key, "level"]) || 1
end
