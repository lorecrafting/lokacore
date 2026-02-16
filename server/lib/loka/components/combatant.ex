defmodule Loka.Components.Combatant do
  @moduledoc "Typed access to the `combatant` component (health, attack, defense)."

  alias Loka.Engine.StateMachine

  @component_key "combatant"

  @machine StateMachine.new(%{
             initial: "idle",
             transitions: %{
               "idle" => ["engaged"],
               "engaged" => ["defending", "fleeing", "dead", "idle"],
               "defending" => ["engaged", "fleeing", "dead", "idle"],
               "fleeing" => ["idle", "dead"],
               "dead" => ["respawning"],
               "respawning" => ["idle"]
             }
           })

  def machine, do: @machine

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def health(entity), do: get_in(entity.components, [@component_key, "health"]) || 0
  def max_health(entity), do: get_in(entity.components, [@component_key, "max_health"]) || 0
  def attack(entity), do: get_in(entity.components, [@component_key, "attack"]) || 0
  def defense(entity), do: get_in(entity.components, [@component_key, "defense"]) || 0
  def level(entity), do: get_in(entity.components, [@component_key, "level"]) || 1

  def set_health(entity, val) do
    comp = get(entity) || %{}
    put(entity, Map.put(comp, "health", val))
  end

  def alive?(entity), do: health(entity) > 0

  def heal(entity, amount) do
    set_health(entity, min(health(entity) + amount, max_health(entity)))
  end

  def damage(entity, amount) do
    set_health(entity, max(health(entity) - amount, 0))
  end
end
