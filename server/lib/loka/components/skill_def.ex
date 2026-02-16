defmodule Loka.Components.SkillDef do
  @moduledoc "Typed access to the `skill_def` component (cooldown, cost, effects)."

  @component_key "skill_def"

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def cooldown(entity), do: get_in(entity.components, [@component_key, "cooldown"]) || 0
  def cost(entity), do: get_in(entity.components, [@component_key, "cost"]) || %{}
  def effects(entity), do: get_in(entity.components, [@component_key, "effects"]) || []
end
