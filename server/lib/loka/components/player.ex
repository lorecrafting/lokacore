defmodule Loka.Components.Player do
  @moduledoc "Typed access to the `player` component (settings, character_name)."

  @component_key "player"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def character_name(entity), do: get_in(entity.components, [@component_key, "character_name"])
  def settings(entity), do: get_in(entity.components, [@component_key, "settings"]) || %{}
end
