defmodule Loka.Components.QuestDef do
  @moduledoc "Typed access to the `quest` component (objectives, rewards, giver)."

  @component_key "quest"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def objectives(entity), do: get_in(entity.components, [@component_key, "objectives"]) || []
  def rewards(entity), do: get_in(entity.components, [@component_key, "rewards"]) || %{}
  def giver(entity), do: get_in(entity.components, [@component_key, "giver"])
end
