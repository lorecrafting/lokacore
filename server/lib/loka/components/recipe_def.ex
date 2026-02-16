defmodule Loka.Components.RecipeDef do
  @moduledoc "Typed access to the `recipe` component (ingredients, output)."

  alias Loka.Engine.StateMachine

  @component_key "recipe"

  @crafting_machine StateMachine.new(%{
                      initial: "idle",
                      transitions: %{
                        "idle" => ["gathering", "crafting"],
                        "gathering" => ["crafting", "idle"],
                        "crafting" => ["complete", "failed"],
                        "complete" => ["idle"],
                        "failed" => ["idle"]
                      }
                    })

  def crafting_machine, do: @crafting_machine

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def ingredients(entity), do: get_in(entity.components, [@component_key, "ingredients"]) || []
  def output(entity), do: get_in(entity.components, [@component_key, "output"])
end
