defmodule Loka.Components.Equipment do
  @moduledoc "Typed access to the `equipment` component (slot -> entity UUID map)."

  @component_key "equipment"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def slot(entity, slot_name), do: get_in(entity.components, [@component_key, slot_name])
end
