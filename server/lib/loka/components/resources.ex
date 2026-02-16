defmodule Loka.Components.Resources do
  @moduledoc "Typed access to the `resources` component (gold, xp, mana)."

  @component_key "resources"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def gold(entity), do: get_in(entity.components, [@component_key, "gold"]) || 0
  def xp(entity), do: get_in(entity.components, [@component_key, "xp"]) || 0
  def mana(entity), do: get_in(entity.components, [@component_key, "mana"]) || 0
end
