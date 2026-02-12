defmodule Loka.Behaviors.Aggressive do
  @moduledoc """
  Makes an NPC attack players on sight with configurable conditions.

  ## Configuration (in behavior_config.aggressive)

  - `target_level_range` - [min, max] level range to attack
  - `ignore_tags` - Don't attack entities with these tags
  - `wimpy_threshold` - HP% to flee at (0 = never flee)
  - `attack_message` - Message when attacking
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event}
  alias Loka.Behaviors.Runner

  @impl true
  def on_event(entity, :entity_entered, %{entity: entered}) when not is_nil(entered) do
    config = Runner.get_config(entity, __MODULE__)

    if should_attack?(config, entered) do
      emit_attack_events(entity, entered, config)
      {:halt, entity}
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

  defp should_attack?(config, target) do
    target.type == :character &&
      not has_ignored_tag?(config, target) &&
      in_level_range?(config, target)
  end

  defp has_ignored_tag?(config, target) do
    ignore_tags = config[:ignore_tags] || []
    ignore_tags != [] && Runner.has_any_tag?(target, ignore_tags)
  end

  defp in_level_range?(config, target) do
    case config[:target_level_range] do
      [min, max] when is_integer(min) and is_integer(max) ->
        level = get_in(target.components, ["progression", "level"]) || 1
        level >= min && level <= max

      _ ->
        true
    end
  end

  defp emit_attack_events(attacker, target, config) do
    if message = config[:attack_message] do
      EventBus.emit(
        Event.new(:room_message, %{
          payload: %{room_id: attacker.location_id, text: message, source_id: attacker.id}
        })
      )
    end

    EventBus.emit(
      Event.new(:initiate_combat, %{
        payload: %{attacker_id: attacker.id, target_id: target.id, reason: "aggressive"}
      })
    )
  end
end
