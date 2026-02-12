defmodule Loka.Behaviors.Scavenger do
  @moduledoc """
  Makes an NPC pick up valuable items from the ground.

  ## Configuration (in behavior_config.scavenger)

  - `min_value` - Only pick up items worth this much (default: 0)
  - `prefer_types` - Priority item types to pick up
  - `pick_up_tags` - Pick up items with these tags
  - `ignore_tags` - Never pick up items with these tags
  - `carry_limit` - Max items to carry (default: 10)
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{Entity, EventBus, Event, Entities}
  alias Loka.Behaviors.Runner

  @impl true
  def on_event(entity, :item_dropped, %{item: item}) when not is_nil(item) do
    config = Runner.get_config(entity, __MODULE__)

    if item.location_id == entity.location_id && should_pick_up?(config, item, entity) do
      EventBus.emit(
        Event.new(:pick_up_item, %{
          payload: %{picker_id: entity.id, item_id: item.id, reason: "scavenger"}
        })
      )

      {:halt, entity}
    else
      {:ok, entity}
    end
  end

  def on_event(entity, _event, _payload), do: {:ok, entity}

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)

    case scan_for_items(entity, config) do
      [] ->
        :ok

      [item | _] ->
        EventBus.emit(
          Event.new(:pick_up_item, %{
            payload: %{picker_id: entity.id, item_id: item.id, reason: "scavenger"}
          })
        )
    end

    {:ok, entity}
  end

  # Private helpers

  defp should_pick_up?(config, item, picker) do
    not at_carry_limit?(config, picker) &&
      not has_ignored_tag?(config, item) &&
      meets_value_threshold?(config, item) &&
      (preferred_type?(config, item) || has_pick_up_tag?(config, item))
  end

  defp at_carry_limit?(config, entity) do
    limit = config[:carry_limit] || 10
    current_count = Entities.list_by_type(:item) |> Enum.count(&(&1.location_id == entity.id))
    current_count >= limit
  end

  defp has_ignored_tag?(config, item) do
    ignore_tags = config[:ignore_tags] || []
    ignore_tags != [] && Runner.has_any_tag?(item, ignore_tags)
  end

  defp meets_value_threshold?(config, item) do
    min_value = config[:min_value] || 0
    min_value == 0 || get_item_value(item) >= min_value
  end

  defp get_item_value(item) do
    economy = Entity.get_component(item, "economy") || %{}
    economy["value"] || 0
  end

  defp preferred_type?(config, item) do
    prefer_types = config[:prefer_types] || []
    prefer_types == [] || get_item_type(item) in prefer_types
  end

  defp has_pick_up_tag?(config, item) do
    pick_up_tags = config[:pick_up_tags] || []
    pick_up_tags != [] && Runner.has_any_tag?(item, pick_up_tags)
  end

  defp get_item_type(item) do
    item_component = Entity.get_component(item, "item") || %{}
    item_component["type"] || "misc"
  end

  defp scan_for_items(entity, config) do
    room_id = entity.location_id

    if room_id do
      Entities.list_by_type(:item)
      |> Enum.filter(&(&1.location_id == room_id && should_pick_up?(config, &1, entity)))
      |> Enum.sort_by(&(-get_item_value(&1)))
    else
      []
    end
  end
end
