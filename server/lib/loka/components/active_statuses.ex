defmodule Loka.Components.ActiveStatuses do
  @moduledoc "Typed access to the `active_statuses` component (list of active status effect maps)."

  @component_key "active_statuses"

  def get(entity), do: Map.get(entity.components, @component_key, [])
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, statuses) when is_list(statuses),
    do: %{entity | components: Map.put(entity.components, @component_key, statuses)}

  def component_key, do: @component_key
end
