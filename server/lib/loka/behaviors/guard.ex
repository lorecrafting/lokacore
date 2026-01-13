defmodule Loka.Behaviors.Guard do
  @moduledoc """
  Makes an NPC attack players with specified tags and optionally block directions.

  Guards are a core NPC archetype in MUDs. They:
  - Attack players with certain tags (criminal, hostile, etc.)
  - Optionally block movement in certain directions
  - Can shout warnings before attacking
  - Will flee when health drops below a threshold

  ## Supported Types
  - `:npc`

  ## Configuration

  | Option | Type | Required | Default | Description |
  |--------|------|----------|---------|-------------|
  | attack_tags | list | no | [] | Tags that trigger attack |
  | block_directions | list | no | [] | Directions to block |
  | block_message | string | no | "The guard blocks your way." | Block message |
  | shout_on_attack | string | no | nil | Shout before attack |
  | wimpy_threshold | integer | no | 0 | HP% to flee at |

  ## Example

      key: town_guard
      behaviors:
        - Loka.Behaviors.Guard
      attributes:
        behavior_config:
          guard:
            attack_tags:
              - criminal
              - murderer
            block_directions:
              - north
            block_message: "The guard bars your passage."
            shout_on_attack: "Guards! We have a criminal!"
            wimpy_threshold: 20

  ## Events Handled

  - `:entity_entered` - Check if entering entity has attack tags
  - `:before_move` - Block movement if direction is restricted
  - `:damage_taken` - Check wimpy threshold and flee if needed
  """

  use Loka.Behaviors.Base

  require Logger

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def handle_event(entity, %Event{type: :entity_entered} = event, state) do
    config = get_config(entity, __MODULE__)
    attack_tags = config[:attack_tags] || []

    # Get the entity that entered
    entered_entity = event.payload[:entity]

    if entered_entity && attack_tags != [] && has_any_tag?(entered_entity, attack_tags) do
      # Shout warning if configured
      events =
        if shout = config[:shout_on_attack] do
          [
            Event.new(:say, %{
              payload: %{
                speaker_id: entity.id,
                speaker_name: entity.short_desc,
                room_id: entity.location_id,
                text: shout
              }
            })
          ]
        else
          []
        end

      # Queue attack event
      attack_event =
        Event.new(:initiate_combat, %{
          payload: %{
            attacker_id: entity.id,
            target_id: entered_entity.id,
            reason: "guard_attack"
          }
        })

      Logger.debug(
        "Guard #{entity.id} attacking #{entered_entity.id} (tags: #{inspect(entered_entity.tags)})"
      )

      {:handled, state, events ++ [attack_event]}
    else
      {:ok, state}
    end
  end

  def handle_event(entity, %Event{type: :before_move} = event, state) do
    config = get_config(entity, __MODULE__)
    block_directions = config[:block_directions] || []

    direction = event.payload[:direction]

    if direction && to_string(direction) in Enum.map(block_directions, &to_string/1) do
      message = config[:block_message] || "The guard blocks your way."
      {:halt, message}
    else
      {:ok, state}
    end
  end

  def handle_event(entity, %Event{type: :damage_taken}, state) do
    config = get_config(entity, __MODULE__)
    wimpy = config[:wimpy_threshold] || 0

    if wimpy > 0 && health_percent(entity) < wimpy do
      # Trigger flee
      flee_event =
        Event.new(:flee, %{
          payload: %{
            entity_id: entity.id,
            reason: "wimpy"
          }
        })

      Logger.debug("Guard #{entity.id} fleeing at #{health_percent(entity)}% health")
      {:handled, state, [flee_event]}
    else
      {:ok, state}
    end
  end

  def handle_event(_entity, _event, state) do
    {:ok, state}
  end
end
