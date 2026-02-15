defmodule Loka.Game.Actions.Bardo do
  @moduledoc """
  Bardo (death realm) game actions.

  Handles player death, the transitional bardo state, and reincarnation.

  ## Actions

  - `:enter_bardo` - Player enters the death realm after being killed
  - `:reincarnate` - Player respawns at their bind point

  ## Bardo State

  The bardo state is tracked in socket assigns and includes:
  - `active` - Whether player is in bardo
  - `enemy_name` - Name of what killed them
  - `started_at` - When they entered bardo
  - `can_reincarnate` - Whether the wait period is over
  - `bind_point` - Room key where they'll respawn
  - `message_index` - Current bardo message index
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Engine.Entity
  alias Loka.Framework.World.{RoomLoader, Atmosphere}
  alias Loka.Engine.Entities
  alias LokaWeb.Channels.GameChannel.Serializers

  @bardo_duration_ms 30_000
  @default_bind_point "monastery_gate"

  @bardo_messages [
    "Darkness enfolds you like a heavy blanket.",
    "You feel yourself falling... or is it floating?",
    "Shapes flicker at the edge of perception.",
    "Voices whisper in languages you almost understand.",
    "Memories surface unbidden, then fade like morning mist.",
    "A distant bell tolls somewhere in the grey.",
    "The wheel turns. Another chance awaits.",
    "When you are ready, step back into the light."
  ]

  @doc """
  Enter the bardo realm after death.

  Returns state changes and events for entering the death realm.
  """
  @spec enter_bardo(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def enter_bardo(ctx, enemy_name) do
    character = ctx.character
    old_room = ctx.room
    bind_point = get_bind_point(character)

    case Entities.get_entity_by_key("bardo_realm") do
      nil ->
        # Fallback if bardo room doesn't exist
        result =
          Result.new(
            state: %{combat: nil},
            events: [{:event, "You have been defeated..."}]
          )

        {:ok, result}

      bardo_room_entity ->
        {:ok, room} = RoomLoader.load_room_for_display(bardo_room_entity.id)

        bardo_state = %{
          active: true,
          enemy_name: enemy_name,
          started_at: DateTime.utc_now(),
          duration_ms: @bardo_duration_ms,
          can_reincarnate: false,
          bind_point: bind_point,
          message_index: 0
        }

        events = [
          {:event, "You have been defeated by the #{enemy_name}..."},
          {:event, "Your vision fades to grey..."},
          {:bardo_enter, %{bind_point: bind_point}},
          {:room_changed,
           %{
             room: Serializers.serialize_room(room),
             atmosphere: Atmosphere.describe_for_room(room)
           }},
          {:bardo_unsubscribe_room, old_room.id},
          {:bardo_subscribe_room, room.id},
          {:schedule_timer, :bardo_timer_complete, @bardo_duration_ms},
          {:schedule_timer, :bardo_next_message, 1_000}
        ]

        result =
          Result.new(
            state: %{
              combat: nil,
              bardo: bardo_state,
              room: room
            },
            events: events
          )

        {:ok, result}
    end
  end

  @doc """
  Reincarnate from the bardo realm.

  Returns state changes and events for respawning at the bind point.
  """
  @spec reincarnate(Context.t(), map() | nil) :: {:ok, Result.t()} | {:error, String.t()}
  def reincarnate(_ctx, nil), do: {:error, "You are not in the bardo."}

  def reincarnate(_ctx, %{can_reincarnate: false}),
    do: {:error, "You must wait before reincarnating."}

  def reincarnate(ctx, bardo) do
    character = ctx.character
    old_room = ctx.room

    case Entities.get_entity_by_key(bardo.bind_point) do
      nil ->
        {:error, "Something went wrong... you remain in the grey."}

      bind_point_room ->
        # Restore HP to max
        resources = Entity.get_component(character, "resources") || %{}
        health = resources["health"] || %{}
        max_hp = health["max"] || 100
        new_health = %{"current" => max_hp, "max" => max_hp}

        new_resources = Map.put(resources, "health", new_health)
        character_with_health = Entity.add_component(character, "resources", new_resources)

        # Update location to bind point
        new_character = %{character_with_health | location_id: bind_point_room.id}

        {:ok, room} = RoomLoader.load_room_for_display(bind_point_room.id)

        events = [
          {:event, "You open your eyes. The world slowly comes back into focus."},
          {:bardo_exit, %{}},
          {:room_changed,
           %{
             room: Serializers.serialize_room(room),
             atmosphere: Atmosphere.describe_for_room(room)
           }},
          {:resources_update, %{resources: %{health: new_health}}},
          {:bardo_unsubscribe_room, old_room.id},
          {:bardo_subscribe_room, room.id}
        ]

        result =
          Result.new(
            state: %{
              bardo: nil,
              character: new_character,
              room: room
            },
            events: events
          )

        {:ok, result}
    end
  end

  @doc """
  Get the next bardo message and updated state.

  Called by the timer handler in GameChannel.
  """
  @spec next_message(map()) :: {:ok, String.t(), map()} | :done
  def next_message(bardo) when bardo.message_index < length(@bardo_messages) do
    message = Enum.at(@bardo_messages, bardo.message_index)
    new_bardo = %{bardo | message_index: bardo.message_index + 1}
    has_more = new_bardo.message_index < length(@bardo_messages)
    {:ok, message, new_bardo, has_more}
  end

  def next_message(_bardo), do: :done

  @doc """
  Mark bardo as ready for reincarnation.
  """
  @spec mark_can_reincarnate(map()) :: map()
  def mark_can_reincarnate(bardo) do
    %{bardo | can_reincarnate: true}
  end

  @doc """
  Get the bardo message interval in milliseconds.
  """
  @spec message_interval_ms() :: integer()
  def message_interval_ms, do: 4_000

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_bind_point(character) do
    player = Entity.get_component(character, "player") || %{}
    flags = player["flags"] || %{}
    Map.get(flags, "bind_point") || @default_bind_point
  end
end
