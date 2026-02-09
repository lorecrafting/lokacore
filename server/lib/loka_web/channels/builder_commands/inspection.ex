defmodule LokaWeb.Channels.BuilderCommands.Inspection do
  @moduledoc """
  Builder inspection commands: info, list, find.
  """

  alias Loka.Engine.TypedObject.Loader
  alias Loka.Content.{Dialogue, Zone, Script}
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

  def execute(:list, %{type: type_str} = params, socket) do
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
            ["{{cmd:quest info #{q.key}}}#{q.key}{{/cmd}}", q.data["name"] || q.key]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(quests), "quest"),
            Formatter.table(["Key", "Name"], rows)
          )

        {:ok, text, socket}

      t when t in ["dialogues", "dialogue"] ->
        dialogues = Dialogue.all()

        rows =
          Enum.map(dialogues, fn d ->
            entity_key = get_in(d.data, ["entity_key"]) || ""
            nodes = get_in(d.data, ["nodes"]) || %{}
            node_count = if is_map(nodes), do: map_size(nodes), else: length(nodes)
            ["{{cmd:dialogue info #{d.key}}}#{d.key}{{/cmd}}", entity_key, "#{node_count} nodes"]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(dialogues), "dialogue"),
            Formatter.table(["Key", "NPC", "Nodes"], rows)
          )

        {:ok, text, socket}

      t when t in ["zones", "zone"] ->
        zones = Zone.all()

        rows =
          Enum.map(zones, fn z ->
            rooms = Zone.rooms(z)

            [
              "{{cmd:zone info #{z.key}}}#{z.key}{{/cmd}}",
              z.name || z.key,
              "#{length(rooms)} rooms"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(zones), "zone"),
            Formatter.table(["Key", "Name", "Rooms"], rows)
          )

        {:ok, text, socket}

      t when t in ["cutscenes", "cutscene"] ->
        cutscenes = Loader.list_by_type(:cutscene)

        rows =
          Enum.map(cutscenes, fn c ->
            scenes = get_in(c.data, ["scenes"]) || []

            [
              "{{cmd:cutscene info #{c.key}}}#{c.key}{{/cmd}}",
              c.name || c.key,
              "#{length(scenes)} scenes"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(cutscenes), "cutscene"),
            Formatter.table(["Key", "Name", "Scenes"], rows)
          )

        {:ok, text, socket}

      t when t in ["storylines", "storyline"] ->
        storylines = Loader.list_by_type(:storyline)

        rows =
          Enum.map(storylines, fn s ->
            quests = get_in(s.data, ["main_quests"]) || []
            side = get_in(s.data, ["side_quests"]) || []

            [
              "{{cmd:storyline info #{s.key}}}#{s.key}{{/cmd}}",
              s.name || s.key,
              "#{length(quests)} main, #{length(side)} side"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(storylines), "storyline"),
            Formatter.table(["Key", "Name", "Quests"], rows)
          )

        {:ok, text, socket}

      t when t in ["scripts", "script"] ->
        scripts = Script.all()

        scripts =
          if filter = params[:filter] do
            Enum.filter(scripts, fn s ->
              hook = get_in(s.data, ["hook"]) || ""
              hook == filter
            end)
          else
            scripts
          end

        rows =
          Enum.map(scripts, fn s ->
            hook = get_in(s.data, ["hook"]) || ""
            ["{{cmd:script info #{s.key}}}#{s.key}{{/cmd}}", s.name || s.key, hook]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(scripts), "script"),
            Formatter.table(["Key", "Name", "Hook"], rows)
          )

        {:ok, text, socket}

      _ ->
        {:error,
         "Unknown type '#{type_str}'. Use: npcs, items, quests, dialogues, zones, cutscenes, storylines, scripts",
         socket}
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
      |> Enum.map(fn e ->
        cmd = if type == "room", do: "goto #{e.key}", else: "info #{e.key}"
        [type, "{{cmd:#{cmd}}}#{e.key}{{/cmd}}", e.name]
      end)
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
