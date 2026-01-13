defmodule Loka.Engine.Commands.LookCommand do
  @moduledoc """
  Command for examining the current room or a specific target.

  ## Usage

      # Look at the room
      {:ok, parsed} = LookCommand.parse("", context)
      {:ok, events} = LookCommand.execute(parsed, context)

      # Look at a specific entity
      {:ok, parsed} = LookCommand.parse("goblin", context)
      {:ok, events} = LookCommand.execute(parsed, context)
  """

  use Loka.Engine.Command

  @impl true
  def key, do: "look"

  @impl true
  def aliases, do: ["l", "examine", "ex"]

  @impl true
  def help do
    "Look at your surroundings or examine a specific target."
  end

  @impl true
  def parse(args, context) do
    target = String.trim(args)
    room = Map.get(context, :location)

    {:ok, %{target: target, room: room}}
  end

  @impl true
  def execute(%{target: "", room: nil}, _context) do
    event = %{
      type: :look,
      text: "You are nowhere. There is nothing to see.",
      timestamp: DateTime.utc_now()
    }

    {:ok, [event]}
  end

  def execute(%{target: "", room: room}, _context) do
    description = build_room_description(room)

    event = %{
      type: :look,
      data: %{room: room},
      text: description,
      timestamp: DateTime.utc_now()
    }

    {:ok, [event]}
  end

  def execute(%{target: target, room: room}, _context) do
    # Find entity by name in room
    entity = find_entity_by_name(room, target)

    case entity do
      nil ->
        event = %{
          type: :look,
          text: "You don't see '#{target}' here.",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}

      entity ->
        description = entity.description || entity.extra_desc || "You see nothing remarkable."

        event = %{
          type: :look,
          data: %{entity: entity},
          text: "You examine the #{entity.name}.\n\n#{description}",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp build_room_description(room) do
    title = room.title || "Unknown Location"
    desc = room.description || ""

    # Build base parts
    parts = [title, "", desc]

    # Add NPCs
    npcs = room.npcs || []

    parts =
      if Enum.empty?(npcs) do
        parts
      else
        npc_text = npcs |> Enum.map(& &1.name) |> Enum.join(", ")
        parts ++ ["", "You see: #{npc_text}"]
      end

    # Add items
    items = room.items || []

    parts =
      if Enum.empty?(items) do
        parts
      else
        item_text = items |> Enum.map(& &1.name) |> Enum.join(", ")
        parts ++ ["", "Items here: #{item_text}"]
      end

    # Add exits
    exits = room.exits || []

    parts =
      if Enum.empty?(exits) do
        parts
      else
        exit_text = exits |> Enum.map(& &1.direction) |> Enum.join(", ")
        parts ++ ["", "Exits: #{exit_text}"]
      end

    Enum.join(parts, "\n")
  end

  defp find_entity_by_name(nil, _name), do: nil

  defp find_entity_by_name(room, name) do
    name_lower = String.downcase(name)
    npcs = room.npcs || []
    items = room.items || []

    Enum.find(npcs ++ items, fn entity ->
      entity_name = entity.name || ""
      String.downcase(entity_name) |> String.contains?(name_lower)
    end)
  end
end
