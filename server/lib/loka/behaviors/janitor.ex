defmodule Loka.Behaviors.Janitor do
  @moduledoc """
  Makes an NPC pick up and dispose of trash and corpses.

  Janitors keep areas clean by collecting and destroying debris.
  Classic DikuMUD behavior for cleaning up after combat and
  preventing item accumulation.

  ## Supported Types
  - `:npc`

  ## Configuration

  | Option | Type | Required | Default | Description |
  |--------|------|----------|---------|-------------|
  | picks_up | list | no | ["trash", "corpse", "junk"] | Tags to pick up |
  | dispose_after_seconds | integer | no | 60 | Seconds before disposal |
  | dispose_message | string | no | nil | Message when disposing |
  | pick_up_message | string | no | nil | Message when picking up |

  ## Example

      key: town_sweeper
      behaviors:
        - Loka.Behaviors.Janitor
      attributes:
        behavior_config:
          janitor:
            picks_up:
              - trash
              - corpse
              - debris
              - junk
            dispose_after_seconds: 30
            dispose_message: "The sweeper disposes of some garbage."
            pick_up_message: "The sweeper collects some debris."

  ## Events Handled

  - `:tick` - Scan room and inventory, pick up trash, dispose old items
  - `:item_dropped` - Check if dropped item is trash to pick up

  ## State

  Tracks picked up items with timestamps:
  - `held_items` - Map of item_id => pickup_timestamp
  """

  use Loka.Behaviors.Base

  require Logger

  @default_tags ["trash", "corpse", "junk", "debris"]

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def init(_entity, _config) do
    {:ok, %{held_items: %{}}}
  end

  @impl true
  def handle_event(entity, %Event{type: :tick}, state) do
    config = get_config(entity, __MODULE__)

    # First, dispose of old items
    {events, new_held} = dispose_old_items(entity, config, state.held_items)

    # Then, scan for new trash to pick up
    {pickup_events, updated_held} = scan_and_pickup(entity, config, new_held)

    new_state = %{state | held_items: updated_held}
    {:ok, new_state, events ++ pickup_events}
  end

  def handle_event(entity, %Event{type: :item_dropped} = event, state) do
    config = get_config(entity, __MODULE__)
    item = event.payload[:item]

    # Check if item was dropped in our room and is trash
    if item && item.location_id == entity.location_id && is_trash?(config, item) do
      pickup_event =
        Event.new(:pick_up_item, %{
          payload: %{
            picker_id: entity.id,
            item_id: item.id,
            reason: "janitor"
          }
        })

      # Track the item
      new_held = Map.put(state.held_items, item.id, DateTime.utc_now())

      events = maybe_pick_up_message(entity, config, [pickup_event])

      Logger.debug("Janitor #{entity.id} picking up trash #{item.id}")
      {:handled, %{state | held_items: new_held}, events}
    else
      {:ok, state}
    end
  end

  def handle_event(_entity, _event, state) do
    {:ok, state}
  end

  # Private helpers

  defp is_trash?(config, item) do
    trash_tags = config[:picks_up] || @default_tags
    has_any_tag?(item, trash_tags)
  end

  defp dispose_old_items(entity, config, held_items) do
    dispose_after = config[:dispose_after_seconds] || 60
    now = DateTime.utc_now()

    {to_dispose, to_keep} =
      Enum.split_with(held_items, fn {_id, timestamp} ->
        DateTime.diff(now, timestamp, :second) >= dispose_after
      end)

    # Generate dispose events
    events =
      Enum.flat_map(to_dispose, fn {item_id, _timestamp} ->
        dispose_event =
          Event.new(:destroy_item, %{
            payload: %{
              item_id: item_id,
              reason: "janitor_disposal"
            }
          })

        Logger.debug("Janitor #{entity.id} disposing of #{item_id}")
        [dispose_event]
      end)

    # Add dispose message if any items disposed
    events =
      if events != [] do
        maybe_dispose_message(entity, config, events)
      else
        events
      end

    {events, Map.new(to_keep)}
  end

  defp scan_and_pickup(entity, config, held_items) do
    room_id = entity.location_id

    if room_id do
      trash_items =
        Entities.list_entities(type: :item, location_id: room_id)
        |> Enum.filter(&is_trash?(config, &1))
        |> Enum.take(3)

      # Pick up trash
      Enum.reduce(trash_items, {[], held_items}, fn item, {events, held} ->
        if Map.has_key?(held, item.id) do
          # Already tracking this item
          {events, held}
        else
          pickup_event =
            Event.new(:pick_up_item, %{
              payload: %{
                picker_id: entity.id,
                item_id: item.id,
                reason: "janitor"
              }
            })

          new_held = Map.put(held, item.id, DateTime.utc_now())
          {[pickup_event | events], new_held}
        end
      end)
    else
      {[], held_items}
    end
  end

  defp maybe_pick_up_message(entity, config, events) do
    if message = config[:pick_up_message] do
      msg_event =
        Event.new(:room_message, %{
          payload: %{
            room_id: entity.location_id,
            text: message,
            source_id: entity.id
          }
        })

      [msg_event | events]
    else
      events
    end
  end

  defp maybe_dispose_message(entity, config, events) do
    if message = config[:dispose_message] do
      msg_event =
        Event.new(:room_message, %{
          payload: %{
            room_id: entity.location_id,
            text: message,
            source_id: entity.id
          }
        })

      [msg_event | events]
    else
      events
    end
  end
end
