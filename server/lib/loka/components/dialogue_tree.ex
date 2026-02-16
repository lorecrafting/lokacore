defmodule Loka.Components.DialogueTree do
  @moduledoc "Typed access to the `dialogue_tree` component (nodes, options)."

  alias Loka.Engine.StateMachine

  @component_key "dialogue_tree"

  @dialogue_machine StateMachine.new(%{
                      initial: "idle",
                      transitions: %{
                        "idle" => ["active"],
                        "active" => ["awaiting_choice", "ended"],
                        "awaiting_choice" => ["active", "ended"],
                        "ended" => ["idle"]
                      }
                    })

  def dialogue_machine, do: @dialogue_machine

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def nodes(entity), do: get_in(entity.components, [@component_key, "nodes"]) || %{}
  def options(entity), do: get_in(entity.components, [@component_key, "options"]) || []
end
