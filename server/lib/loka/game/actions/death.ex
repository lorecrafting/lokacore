defmodule Loka.Game.Actions.Death do
  @moduledoc """
  Ghost death and resurrection actions.

  Replaces the old Bardo system with a UO-style ghost respawn:
  - Player dies at their corpse location (no teleport)
  - Becomes a ghost — can only move and chat (ghostly whispers)
  - Walks to a resurrection shrine or healer NPC to resurrect
  - On resurrect: HP restored to 50%, ghost flag cleared

  ## Actions

  - `:die` - Player dies and becomes a ghost at current location
  - `:resurrect` - Ghost is restored to life (at shrine or by healer)
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Engine.Entity

  @doc """
  Player dies and becomes a ghost at their current location.

  Sets ghost flag on player component, zeroes HP, emits death events.
  Player stays in the current room (no teleport).
  """
  @spec die(Context.t(), String.t()) :: {:ok, Result.t()}
  def die(ctx, enemy_name) do
    character = ctx.character

    # Set ghost flag
    player = Entity.get_component(character, "player") || %{}
    flags = player["flags"] || %{}
    new_flags = Map.put(flags, "ghost", true)
    new_player = Map.put(player, "flags", new_flags)
    character = Entity.add_component(character, "player", new_player)

    # Set HP to 0
    resources = Entity.get_component(character, "resources") || %{}
    health = resources["health"] || %{}
    new_health = Map.put(health, "current", 0)
    new_resources = Map.put(resources, "health", new_health)
    character = Entity.add_component(character, "resources", new_resources)

    events = [
      {:event, "You have been defeated by the #{enemy_name}..."},
      {:event, "Your spirit lingers at the site of your death. You are a ghost."},
      {:event, "Find a resurrection shrine or healer to return to life."},
      {:ghost_enter, %{killer: enemy_name}},
      {:resources_update, %{resources: %{health: new_health}}}
    ]

    result =
      Result.new(
        state: %{combat: nil, character: character},
        events: events
      )

    {:ok, result}
  end

  @doc """
  Resurrect a ghost, restoring them to life.

  HP is restored to 50% of max. Ghost flag is cleared.
  Player stays at their current location (the shrine/healer room).

  `method` is `:shrine` or `:healer` (for messaging purposes).
  """
  @spec resurrect(Context.t(), atom()) :: {:ok, Result.t()} | {:error, String.t()}
  def resurrect(ctx, method) do
    character = ctx.character

    if not ghost?(character) do
      {:error, "You are not a ghost."}
    else
      # Clear ghost flag
      player = Entity.get_component(character, "player") || %{}
      flags = player["flags"] || %{}
      new_flags = Map.delete(flags, "ghost")
      new_player = Map.put(player, "flags", new_flags)
      character = Entity.add_component(character, "player", new_player)

      # Restore HP to 50% of max
      resources = Entity.get_component(character, "resources") || %{}
      health = resources["health"] || %{}
      max_hp = health["max"] || 100
      restored_hp = div(max_hp, 2)
      new_health = %{"current" => restored_hp, "max" => max_hp}
      new_resources = Map.put(resources, "health", new_health)
      character = Entity.add_component(character, "resources", new_resources)

      message =
        case method do
          :shrine -> "The shrine's light washes over you. You feel life return to your body."
          :healer -> "The healer's hands glow with warmth. You feel life return to your body."
          _ -> "You feel life return to your body."
        end

      events = [
        {:event, message},
        {:ghost_exit, %{}},
        {:resources_update, %{resources: %{health: new_health}}}
      ]

      result =
        Result.new(
          state: %{character: character},
          events: events
        )

      {:ok, result}
    end
  end

  @doc """
  Check if a character is currently a ghost.
  """
  @spec ghost?(map()) :: boolean()
  def ghost?(character) do
    player = Entity.get_component(character, "player") || %{}
    flags = player["flags"] || %{}
    flags["ghost"] == true
  end
end
