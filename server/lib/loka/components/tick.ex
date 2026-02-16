defmodule Loka.Components.Tick do
  @moduledoc "Typed access to the `tick` component (interval — single source of truth)."

  @component_key "tick"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def interval(entity), do: get_in(entity.components, [@component_key, "interval"]) || 5000
end
