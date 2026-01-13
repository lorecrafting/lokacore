defmodule Loka.Behaviors.Aggressive do
  @moduledoc """
  Makes an NPC attack players on sight with configurable conditions.

  This is the classic hostile mob behavior - attack any player that
  enters the room. Supports level range filtering, ignored tags,
  and attack delay.

  ## Supported Types
  - `:npc`

  ## Configuration

  | Option | Type | Required | Default | Description |
  |--------|------|----------|---------|-------------|
  | target_level_range | [min, max] | no | nil | Only attack players in level range |
  | ignore_tags | list | no | [] | Don't attack entities with these tags |
  | wimpy_threshold | integer | no | 0 | HP% to flee at |
  | attack_delay_ms | integer | no | 1000 | Milliseconds before attack |
  | attack_message | string | no | nil | Message when attacking |

  ## Example

      key: goblin_warrior
      behaviors:
        - Loka.Behaviors.Aggressive
      attributes:
        behavior_config:
          aggressive:
            target_level_range: [1, 10]
            ignore_tags:
              - sneaking
              - invisible
            wimpy_threshold: 30
            attack_delay_ms: 2000
            attack_message: "The goblin snarls and charges!"

  ## Events Handled

  - `:entity_entered` - Attack player if conditions met
  - `:damage_taken` - Check wimpy threshold and flee if needed
  """

  use Loka.Behaviors.Base

  require Logger

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def handle_event(entity, %Event{type: :entity_entered} = event, state) do
    config = get_config(entity, __MODULE__)

    # Get the entity that entered
    entered_entity = event.payload[:entity]

    if entered_entity && should_attack?(config, entered_entity) do
      events = build_attack_events(entity, entered_entity, config)

      Logger.debug("Aggressive NPC #{entity.id} attacking #{entered_entity.id}")
      {:handled, state, events}
    else
      {:ok, state}
    end
  end

  def handle_event(entity, %Event{type: :damage_taken}, state) do
    config = get_config(entity, __MODULE__)
    wimpy = config[:wimpy_threshold] || 0

    if wimpy > 0 && health_percent(entity) < wimpy do
      flee_event =
        Event.new(:flee, %{
          payload: %{
            entity_id: entity.id,
            reason: "wimpy"
          }
        })

      {:handled, state, [flee_event]}
    else
      {:ok, state}
    end
  end

  def handle_event(_entity, _event, state) do
    {:ok, state}
  end

  # Private helpers

  defp should_attack?(config, target) do
    # Only attack player characters
    target.type == :character &&
      not has_ignored_tag?(config, target) &&
      in_level_range?(config, target)
  end

  defp has_ignored_tag?(config, target) do
    ignore_tags = config[:ignore_tags] || []

    if ignore_tags == [] do
      false
    else
      has_any_tag?(target, ignore_tags)
    end
  end

  defp in_level_range?(config, target) do
    case config[:target_level_range] do
      [min, max] when is_integer(min) and is_integer(max) ->
        level = get_level(target)
        level >= min && level <= max

      _ ->
        # No level restriction
        true
    end
  end

  defp get_level(entity) do
    progression = Entity.get_component(entity, "progression") || %{}
    progression["level"] || progression[:level] || 1
  end

  defp build_attack_events(attacker, target, config) do
    events = []

    # Add attack message if configured
    events =
      if message = config[:attack_message] do
        msg_event =
          Event.new(:room_message, %{
            payload: %{
              room_id: attacker.location_id,
              text: message,
              source_id: attacker.id
            }
          })

        [msg_event | events]
      else
        events
      end

    # Add combat initiation event
    attack_event =
      Event.new(:initiate_combat, %{
        payload: %{
          attacker_id: attacker.id,
          target_id: target.id,
          reason: "aggressive"
        }
      })

    events ++ [attack_event]
  end
end
