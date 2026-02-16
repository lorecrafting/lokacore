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

  @doc "Gets the status of a specific active quest."
  def status(entity, quest_id) do
    get_in(entity.components, [@component_key, "active", quest_id, "status"])
  end

  @doc "Validates and updates a quest's status via StateMachine transition."
  def transition_quest(entity, quest_id, to_state) do
    case get_in(entity.components, [@component_key, "active", quest_id]) do
      nil ->
        {:error, :quest_not_active}

      quest_data ->
        current = quest_data["status"] || "accepted"

        case StateMachine.transition(@machine, current, to_state) do
          {:ok, new_status} ->
            updated = Map.put(quest_data, "status", new_status)

            new_components =
              put_in(entity.components, [@component_key, "active", quest_id], updated)

            {:ok, %{entity | components: new_components}}

          {:error, _} = error ->
            error
        end
    end
  end
end
