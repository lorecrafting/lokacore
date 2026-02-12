defmodule Loka.Behaviors.Guard do
  @moduledoc """
  Makes an NPC attack players with specified tags and optionally block directions.

  ## Configuration (in behavior_config.guard)

  - `attack_tags` - Tags that trigger attack
  - `block_directions` - Directions to block
  - `block_message` - Block message (default: "The guard blocks your way.")
  - `shout_on_attack` - Shout before attack
  - `wimpy_threshold` - HP% to flee at (0 = never flee)
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event}
  alias Loka.Behaviors.Runner

  @impl true
  def on_event(entity, :entity_entered, %{entity: entered}) when not is_nil(entered) do
    config = Runner.get_config(entity, __MODULE__)
    attack_tags = config[:attack_tags] || []

    if attack_tags != [] && Runner.has_any_tag?(entered, attack_tags) do
      emit_attack_events(entity, entered, config)
      {:halt, entity}
    else
      {:ok, entity}
    end
  end

  def on_event(entity, :before_move, %{direction: direction}) when not is_nil(direction) do
    config = Runner.get_config(entity, __MODULE__)
    block_directions = config[:block_directions] || []

    if to_string(direction) in Enum.map(block_directions, &to_string/1) do
      message = config[:block_message] || "The guard blocks your way."
      {:halt, entity, %{blocked: true, message: message}}
    else
      {:ok, entity}
    end
  end

  def on_event(entity, :damage_taken, _payload) do
    config = Runner.get_config(entity, __MODULE__)
    wimpy = config[:wimpy_threshold] || 0

    if wimpy > 0 && Runner.health_percent(entity) < wimpy do
      EventBus.emit(
        Event.new(:flee, %{
          payload: %{entity_id: entity.id, reason: "wimpy"}
        })
      )

      {:halt, entity}
    else
      {:ok, entity}
    end
  end

  def on_event(entity, _event, _payload), do: {:ok, entity}

  defp emit_attack_events(guard, target, config) do
    if shout = config[:shout_on_attack] do
      EventBus.emit(
        Event.new(:say, %{
          payload: %{
            speaker_id: guard.id,
            speaker_name: guard.short_desc,
            room_id: guard.location_id,
            text: shout
          }
        })
      )
    end

    EventBus.emit(
      Event.new(:initiate_combat, %{
        payload: %{attacker_id: guard.id, target_id: target.id, reason: "guard_attack"}
      })
    )
  end
end
