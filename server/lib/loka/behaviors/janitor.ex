defmodule Loka.Behaviors.Janitor do
  @moduledoc """
  Makes an NPC pick up and dispose of trash and corpses.

  ## Configuration (in behavior_config.janitor)

  - `picks_up` - Tags to pick up (default: ["trash", "corpse", "junk", "debris"])
  - `dispose_after_seconds` - Seconds before disposal (default: 60)
  - `dispose_message` - Message when disposing
  - `pick_up_message` - Message when picking up
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event, Entities}
  alias Loka.Engine.EntityServer.Volatile
  alias Loka.Behaviors.Runner

  @default_tags ["trash", "corpse", "junk", "debris"]

  @impl true
  def on_init(entity) do
    Volatile.set(:held_items, %{})
    {:ok, entity}
  end

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)
    held_items = Volatile.get(:held_items, %{})

    # Dispose old items
    {held_items, disposed_any?} = dispose_old_items(entity, config, held_items)

    if disposed_any? do
      emit_message(entity, config[:dispose_message])
    end

    # Scan for new trash to pick up
    held_items = scan_and_pickup(entity, config, held_items)

    Volatile.set(:held_items, held_items)
    {:ok, entity}
  end

  @impl true
  def on_event(entity, :item_dropped, %{item: item}) when not is_nil(item) do
    config = Runner.get_config(entity, __MODULE__)

    if item.location_id == entity.location_id && is_trash?(config, item) do
      held_items = Volatile.get(:held_items, %{})

      EventBus.emit(
        Event.new(:pick_up_item, %{
          payload: %{picker_id: entity.id, item_id: item.id, reason: "janitor"}
        })
      )

      emit_message(entity, config[:pick_up_message])
      Volatile.set(:held_items, Map.put(held_items, item.id, DateTime.utc_now()))

      {:halt, entity}
    else
      {:ok, entity}
    end
  end

  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private helpers

  defp is_trash?(config, item) do
    trash_tags = config[:picks_up] || @default_tags
    Runner.has_any_tag?(item, trash_tags)
  end

  defp dispose_old_items(_entity, config, held_items) do
    dispose_after = config[:dispose_after_seconds] || 60
    now = DateTime.utc_now()

    {to_dispose, to_keep} =
      Enum.split_with(held_items, fn {_id, timestamp} ->
        DateTime.diff(now, timestamp, :second) >= dispose_after
      end)

    for {item_id, _} <- to_dispose do
      EventBus.emit(
        Event.new(:destroy_item, %{
          payload: %{item_id: item_id, reason: "janitor_disposal"}
        })
      )
    end

    {Map.new(to_keep), to_dispose != []}
  end

  defp scan_and_pickup(entity, config, held_items) do
    room_id = entity.location_id

    if room_id do
      Entities.list_by_type(:item)
      |> Enum.filter(&(&1.location_id == room_id && is_trash?(config, &1)))
      |> Enum.take(3)
      |> Enum.reduce(held_items, fn item, held ->
        if Map.has_key?(held, item.id) do
          held
        else
          EventBus.emit(
            Event.new(:pick_up_item, %{
              payload: %{picker_id: entity.id, item_id: item.id, reason: "janitor"}
            })
          )

          Map.put(held, item.id, DateTime.utc_now())
        end
      end)
    else
      held_items
    end
  end

  defp emit_message(_entity, nil), do: :ok

  defp emit_message(entity, message) do
    EventBus.emit(
      Event.new(:room_message, %{
        payload: %{room_id: entity.location_id, text: message, source_id: entity.id}
      })
    )
  end
end
