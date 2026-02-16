defmodule Loka.Behaviors.RoomAmbient do
  @moduledoc """
  Behavior that emits atmospheric messages to room occupants.

  Replaces the deleted `Loka.Framework.World.RoomAmbient.Scheduler` module.
  Attached directly to room entities that have ambient messages configured.

  ## Configuration (in components.emotes.ambient)

  Reads from `entity.components["emotes"]["ambient"]` — a list of strings.
  Each tick has a chance to emit one at random.

  ## Behavior Config (in behavior_config.room_ambient)

  - `emit_chance` - Chance per tick to emit (0.0-1.0, default: 0.10)
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event}
  alias Loka.Behaviors.Runner

  @default_emit_chance 0.10

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)
    emit_chance = config[:emit_chance] || @default_emit_chance

    ambient_messages = get_in(entity.components, ["emotes", "ambient"]) || []

    if ambient_messages != [] && :rand.uniform() < emit_chance do
      emit_ambient(entity, Enum.random(ambient_messages))
    end

    {:ok, entity}
  end

  @impl true
  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private

  defp emit_ambient(entity, text) do
    EventBus.emit(
      Event.new(:room_message, %{
        payload: %{
          room_id: entity.id,
          text: text,
          source_id: entity.id
        }
      })
    )
  end
end
