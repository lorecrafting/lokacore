defmodule LokaWeb.Channels.GameChannel.Character do
  @moduledoc """
  Character entity creation helpers for GameChannel.

  Handles finding existing character entities or auto-creating new ones for
  players who connect for the first time.
  """

  require Logger
  import Ecto.Query

  alias Loka.Engine.{Entity, Entities}

  @doc """
  Find an existing character entity for the player or auto-create one.
  """
  @spec find_or_create(map()) :: {:ok, Entity.t()} | {:error, term()}
  def find_or_create(player) do
    case Entities.find_one(account_id: player.id) do
      {:ok, character} ->
        {:ok, character}

      {:error, :not_found} ->
        auto_create(player)
    end
  end

  @doc """
  Sanitize a character name to letters only, max 20 chars. Defaults to "Traveler".
  """
  @spec sanitize_name(String.t()) :: String.t()
  def sanitize_name(name) do
    name
    |> String.replace(~r/[^A-Za-z]/, "")
    |> String.slice(0, 20)
    |> case do
      "" -> "Traveler"
      sanitized -> sanitized
    end
  end

  # Auto-create a character entity for a new player
  defp auto_create(player) do
    base_name =
      player.name || (player.email && player.email |> String.split("@") |> hd()) || "Traveler"

    character_name = sanitize_name(base_name)
    name = find_available_name(character_name, 0)

    starting_room_id = Loka.Framework.World.Room.get_starting_room_id()

    entity =
      Entity.new(
        type: :character,
        key: "player_#{String.downcase(name)}",
        short_desc: name,
        account_id: player.id,
        location_id: starting_room_id,
        components: %{
          "player" => %{
            "settings" => %{},
            "gender" => "they/them",
            "background" => "pilgrim"
          },
          "combatant" => %{"health" => 100, "max_health" => 100},
          "stats" => %{},
          "quest_progress" => %{},
          "resources" => %{"health" => %{"current" => 100, "max" => 100}},
          "skills" => %{},
          "equipment" => %{},
          "inventory" => [],
          "flags" => %{}
        },
        tags: ["playable"],
        keywords: [String.downcase(name)]
      )

    case Entities.save(entity) do
      {:ok, saved} ->
        Entities.add_tag(saved.id, "playable")
        Logger.info("[GameChannel] Auto-created character '#{name}' for player #{player.id}")
        {:ok, %{saved | tags: ["playable"]}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Find an available character name by appending numbers if taken
  defp find_available_name(base_name, attempt) when attempt > 99 do
    base_name <> Integer.to_string(:rand.uniform(9999))
  end

  defp find_available_name(base_name, attempt) do
    name = if attempt == 0, do: base_name, else: "#{base_name}#{attempt}"
    key = "player_#{String.downcase(name)}"

    exists? =
      Loka.Repo.exists?(
        from e in Loka.Engine.Schema.EntitySchema,
          where: e.key == ^key and e.type == :character
      )

    if exists? do
      find_available_name(base_name, attempt + 1)
    else
      name
    end
  end
end
