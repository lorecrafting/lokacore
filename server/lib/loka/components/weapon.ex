defmodule Loka.Components.Weapon do
  @moduledoc "Typed access to the `weapon` component (damage, type, speed)."

  @component_key "weapon"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def damage(entity), do: get_in(entity.components, [@component_key, "damage"]) || 0
  def weapon_type(entity), do: get_in(entity.components, [@component_key, "type"])
  def speed(entity), do: get_in(entity.components, [@component_key, "speed"]) || 1.0
end
