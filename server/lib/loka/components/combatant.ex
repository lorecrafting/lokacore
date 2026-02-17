defmodule Loka.Components.Combatant do
  @moduledoc "Typed access to the `combatant` component (health, attack, defense)."

  alias Loka.Engine.{Entity, StateMachine}

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

  @spec machine() :: StateMachine.t()
  def machine, do: @machine

  @spec get(Entity.t()) :: map() | nil
  def get(entity), do: Map.get(entity.components, @component_key)

  @spec has?(Entity.t()) :: boolean()
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  @spec put(Entity.t(), map()) :: Entity.t()
  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  @spec component_key() :: String.t()
  def component_key, do: @component_key

  @spec health(Entity.t()) :: number()
  def health(entity), do: get_in(entity.components, [@component_key, "health"]) || 0

  @spec max_health(Entity.t()) :: number()
  def max_health(entity), do: get_in(entity.components, [@component_key, "max_health"]) || 0

  @spec attack(Entity.t()) :: number()
  def attack(entity), do: get_in(entity.components, [@component_key, "attack"]) || 0

  @spec defense(Entity.t()) :: number()
  def defense(entity), do: get_in(entity.components, [@component_key, "defense"]) || 0

  @spec level(Entity.t()) :: pos_integer()
  def level(entity), do: get_in(entity.components, [@component_key, "level"]) || 1

  @spec set_health(Entity.t(), number()) :: Entity.t()
  def set_health(entity, val) do
    comp = get(entity) || %{}
    put(entity, Map.put(comp, "health", val))
  end

  @spec alive?(Entity.t()) :: boolean()
  def alive?(entity), do: health(entity) > 0

  @spec heal(Entity.t(), number()) :: Entity.t()
  def heal(entity, amount) do
    set_health(entity, min(health(entity) + amount, max_health(entity)))
  end

  @spec damage(Entity.t(), number()) :: Entity.t()
  def damage(entity, amount) do
    set_health(entity, max(health(entity) - amount, 0))
  end
end
