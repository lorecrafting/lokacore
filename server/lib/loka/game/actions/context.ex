defmodule Loka.Game.Actions.Context do
  @moduledoc """
  Context struct for game actions.

  Contains all the state needed to execute a game action:
  - Player identification
  - Character entity (V2 unified entity)
  - Current room

  ## Building Context

  From ActionBridge (preferred):

      ctx = ActionBridge.build_context(socket)

  Manually:

      ctx = %Context{
        player_id: player.id,
        player_name: player.name,
        character: character_entity,
        room: room
      }
  """

  @type t :: %__MODULE__{
          player_id: String.t(),
          player_name: String.t(),
          character: map(),
          room: map(),
          combat: map() | nil,
          dialogue: map() | nil,
          container: map() | nil,
          bardo: map() | nil
        }

  defstruct [
    :player_id,
    :player_name,
    :character,
    :room,
    :combat,
    :dialogue,
    :container,
    :bardo
  ]

  @doc """
  Build context from a Phoenix Channel socket.
  """
  @spec from_socket(Phoenix.Socket.t()) :: t()
  def from_socket(socket) do
    %__MODULE__{
      player_id: socket.assigns.player.id,
      player_name: socket.assigns.player.name || socket.assigns.player.email,
      character: socket.assigns.character,
      room: socket.assigns.room,
      combat: socket.assigns[:combat],
      dialogue: socket.assigns[:dialogue],
      container: socket.assigns[:open_container],
      bardo: socket.assigns[:bardo]
    }
  end

  @doc """
  Build context from a LiveView socket.
  """
  @spec from_liveview(Phoenix.LiveView.Socket.t()) :: t()
  def from_liveview(socket) do
    player = socket.assigns.current_scope.player

    %__MODULE__{
      player_id: player.id,
      player_name: player.name || player.email,
      character: socket.assigns[:character],
      room: socket.assigns[:room],
      combat: socket.assigns[:combat],
      dialogue: socket.assigns[:dialogue],
      container: socket.assigns[:open_container],
      bardo: socket.assigns[:bardo]
    }
  end

  @doc """
  Update context with new state from a Result.
  """
  @spec apply_state(t(), map()) :: t()
  def apply_state(ctx, state_changes) do
    ctx
    |> maybe_update(:character, state_changes[:character])
    |> maybe_update(:room, state_changes[:room])
    |> maybe_update(:combat, state_changes[:combat])
    |> maybe_update(:dialogue, state_changes[:dialogue])
    |> maybe_update(:container, state_changes[:container])
    |> maybe_update(:bardo, state_changes[:bardo])
  end

  defp maybe_update(ctx, _key, nil), do: ctx
  defp maybe_update(ctx, key, value), do: Map.put(ctx, key, value)
end
