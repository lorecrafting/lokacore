defmodule Loka.Components.QuestProgress do
  @moduledoc "Typed access to the `quest_progress` component (active, completed, failed)."

  alias Loka.Engine.StateMachine

  @component_key "quest_progress"

  @machine StateMachine.new(%{
             initial: "available",
             transitions: %{
               "available" => ["accepted"],
               "accepted" => ["in_progress", "abandoned"],
               "in_progress" => ["objectives_complete", "abandoned", "failed"],
               "objectives_complete" => ["turned_in", "abandoned"],
               "abandoned" => ["accepted"],
               "failed" => ["accepted"]
             },
             on_enter: %{
               "accepted" => :start_objective_timers,
               "turned_in" => :apply_rewards,
               "failed" => :cleanup_quest_items
             }
           })

  def machine, do: @machine

  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  def component_key, do: @component_key

  def active(entity), do: get_in(entity.components, [@component_key, "active"]) || %{}
  def completed(entity), do: get_in(entity.components, [@component_key, "completed"]) || []
  def failed(entity), do: get_in(entity.components, [@component_key, "failed"]) || []
end
