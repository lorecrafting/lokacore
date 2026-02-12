defmodule Loka.Behaviors.Scavenger do
  @moduledoc """
  Makes an NPC pick up valuable items from the ground.

  Scavengers automatically collect items that meet their criteria,
  prioritizing certain types and respecting carry limits. Classic
  DikuMUD behavior for creatures like crows, goblins, or thieves.

  ## Supported Types
  - `:npc`

  ## Configuration

  | Option | Type | Required | Default | Description |
  |--------|------|----------|---------|-------------|
  | min_value | integer | no | 0 | Only pick up items worth this much |
  | prefer_types | list | no | [] | Priority item types to pick up |
  | pick_up_tags | list | no | [] | Pick up items with these tags |
  | ignore_tags | list | no | [] | Never pick up items with these tags |
  | carry_limit | integer | no | 10 | Max items to carry |

  ## Example

      key: greedy_goblin
      behaviors:
        - Loka.Behaviors.Scavenger
      attributes:
        behavior_config:
          scavenger:
            min_value: 10
            prefer_types:
              - weapon
              - armor
              - gold
            ignore_tags:
              - quest_item
              - no_pick
            carry_limit: 5

  ## Events Handled

  - `:item_dropped` - Check if item should be picked up
  - `:tick` - Scan room for items to pick up
  """

  use Loka.Behaviors.Base

  require Logger

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def handle_event(entity, %Event{type: :item_dropped} = event, state) do
    config = get_config(entity, __MODULE__)
    item = event.payload[:item]

    # Check if item was dropped in our room
    if item && item.location_id == entity.location_id && should_pick_up?(config, item, entity) do
      pickup_event =
        Event.new(:pick_up_item, %{
          payload: %{
            picker_id: entity.id,
            item_id: item.id,
            reason: "scavenger"
          }
        })

      Logger.debug("Scavenger #{entity.id} picking up #{item.id}")
      {:handled, state, [pickup_event]}
    else
      {:ok, state}
    end
  end

  def handle_event(entity, %Event{type: :tick}, state) do
    config = get_config(entity, __MODULE__)

    # Scan room for items to pick up
    case scan_for_items(entity, config) do
      [] ->
        {:ok, state}

      items ->
        # Pick up the first suitable item
        item = hd(items)

        pickup_event =
          Event.new(:pick_up_item, %{
            payload: %{
              picker_id: entity.id,
              item_id: item.id,
              reason: "scavenger"
            }
          })

        {:ok, state, [pickup_event]}
    end
  end

  def handle_event(_entity, _event, state) do
    {:ok, state}
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
    current_count = count_carried_items(entity)
    current_count >= limit
  end

  defp count_carried_items(entity) do
    # Count items carried by this entity (contents derived from DB)
    Entities.list_entities(type: :item, location_id: entity.id) |> length()
  end

  defp has_ignored_tag?(config, item) do
    ignore_tags = config[:ignore_tags] || []

    if ignore_tags == [] do
      false
    else
      has_any_tag?(item, ignore_tags)
    end
  end

  defp meets_value_threshold?(config, item) do
    min_value = config[:min_value] || 0

    if min_value == 0 do
      true
    else
      value = get_item_value(item)
      value >= min_value
    end
  end

  defp get_item_value(item) do
    economy = Entity.get_component(item, "economy") || %{}
    economy["value"] || economy[:value] || 0
  end

  defp preferred_type?(config, item) do
    prefer_types = config[:prefer_types] || []

    if prefer_types == [] do
      true
    else
      item_type = get_item_type(item)
      item_type in prefer_types
    end
  end

  defp has_pick_up_tag?(config, item) do
    pick_up_tags = config[:pick_up_tags] || []

    if pick_up_tags == [] do
      false
    else
      has_any_tag?(item, pick_up_tags)
    end
  end

  defp get_item_type(item) do
    # Get item subtype from components
    item_component = Entity.get_component(item, "item") || %{}
    item_component["type"] || item_component[:type] || "misc"
  end

  defp scan_for_items(entity, config) do
    # Get items in the room
    room_id = entity.location_id

    if room_id do
      Entities.list_entities(type: :item, location_id: room_id)
      |> Enum.filter(&should_pick_up?(config, &1, entity))
      |> Enum.sort_by(&(-get_item_value(&1)))
    else
      []
    end
  end
end
