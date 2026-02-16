defmodule Loka.Components.Exit do
  @moduledoc "Typed access to the `exit` component (direction, destination)."

  @component_key "exit"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def direction(entity), do: get_in(entity.components, [@component_key, "direction"])
  def destination_id(entity), do: get_in(entity.components, [@component_key, "destination_id"])
  def destination_key(entity), do: get_in(entity.components, [@component_key, "destination_key"])
end
