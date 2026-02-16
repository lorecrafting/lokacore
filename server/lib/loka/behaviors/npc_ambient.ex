defmodule Loka.Behaviors.NpcAmbient do
  @moduledoc """
  Behavior that emits random idle emotes for NPCs.

  Replaces the deleted `Loka.Framework.World.NpcAmbient.Scheduler` module.
  Attached directly to NPC entities that have idle emotes configured.

  ## Configuration (in components.emotes.idle)

  Reads from `entity.components["emotes"]["idle"]` — a list of strings.
  Each tick has a chance to emit one at random.

  ## Behavior Config (in behavior_config.npc_ambient)

  - `emit_chance` - Chance per tick to emit (0.0-1.0, default: 0.15)
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event}
  alias Loka.Behaviors.Runner

  @default_emit_chance 0.15

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)
    emit_chance = config[:emit_chance] || @default_emit_chance

    idle_emotes = get_in(entity.components, ["emotes", "idle"]) || []

    if idle_emotes != [] && :rand.uniform() < emit_chance do
      emit_idle(entity, Enum.random(idle_emotes))
    end

    {:ok, entity}
  end

  @impl true
  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private

  defp emit_idle(entity, text) do
    if entity.location_id do
      EventBus.emit(
        Event.new(:room_message, %{
          payload: %{
            room_id: entity.location_id,
            text: text,
            source_id: entity.id
          }
        })
      )
    end
  end
end
