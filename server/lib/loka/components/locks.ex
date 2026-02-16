defmodule Loka.Components.Locks do
  @moduledoc "Typed access to the `locks` component (access control rules)."

  @component_key "locks"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key
end
