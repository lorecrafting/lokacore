defmodule LokaWeb.Channels.BuilderCommands.Inspection do
  @moduledoc """
  Builder inspection commands: info, list, find.
  """

  alias Loka.Engine.TypedObject.Loader
  alias Loka.WorldBuilder.{RoomManager, EntityManager}
  alias LokaWeb.Channels.BuilderCommands.{Helpers, Formatter}

  def execute(:info, %{target: target}, socket) do
    case Loader.get(target) do
      {:ok, obj} ->
        yaml_text = Helpers.format_typed_object(obj)
        {:ok, "Info for '#{target}':\n#{yaml_text}", socket}

      _ ->
        {:error, "Entity '#{target}' not found. Use the prototype key.", socket}
    end
  end

  def execute(:list, %{type: type_str}, socket) do
    case type_str do
      t when t in ["npcs", "npc"] ->
        entities = EntityManager.list_entities(:npc)
        Helpers.format_entity_list("NPCs", entities, socket)

      t when t in ["items", "item"] ->
        entities = EntityManager.list_entities(:item)
        Helpers.format_entity_list("Items", entities, socket)

      t when t in ["quests", "quest"] ->
        quests = Loader.list_by_type(:quest)

        rows =
          Enum.map(quests, fn q ->
            [q.key, q.data["name"] || q.key]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(quests), "quest"),
            Formatter.table(["Key", "Name"], rows)
          )

        {:ok, text, socket}

      _ ->
        {:error, "Unknown type '#{type_str}'. Use: npcs, items, quests", socket}
    end
  end

  def execute(:find, %{search: search}, socket) do
    search_lower = String.downcase(search)

    rooms = RoomManager.list_rooms()
    npcs = EntityManager.list_entities(:npc)
    items = EntityManager.list_entities(:item)

    find_matches = fn list, type ->
      list
      |> Enum.filter(fn e ->
        Helpers.matches?(e.key, search_lower) || Helpers.matches?(e.name, search_lower)
      end)
      |> Enum.map(fn e -> [type, e.key, e.name] end)
    end

    all =
      find_matches.(rooms, "room") ++
        find_matches.(npcs, "npc") ++
        find_matches.(items, "item")

    if all == [] do
      {:ok, "No matches for '#{search}'.", socket}
    else
      text =
        Formatter.section(
          "Search: '#{search}' (#{length(all)})",
          Formatter.table(["Type", "Key", "Name"], all)
        )

      {:ok, text, socket}
    end
  end
end
