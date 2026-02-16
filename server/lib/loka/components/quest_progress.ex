defmodule Loka.Components.QuestProgress do
  @moduledoc "Typed access to the `quest_progress` component (active, completed, failed)."

  @component_key "quest_progress"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def active(entity), do: get_in(entity.components, [@component_key, "active"]) || %{}
  def completed(entity), do: get_in(entity.components, [@component_key, "completed"]) || []
  def failed(entity), do: get_in(entity.components, [@component_key, "failed"]) || []
end
