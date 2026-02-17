defmodule LokaWeb.Channels.BuilderCommands.Inspection do
  @moduledoc """
  Builder inspection commands: info, list, find.
  """

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Content.{Dialogue, Zone, Script}
  alias Loka.WorldBuilder.{RoomManager, EntityManager}
  alias LokaWeb.Channels.BuilderCommands.{Helpers, Formatter}

  def execute(:info, %{target: target}, socket) do
    case Entities.find_one(key: target) do
      {:ok, obj} ->
        yaml_text = Helpers.format_entity(obj)
        {:ok, "Info for '#{target}':\n#{yaml_text}", socket}

      _ ->
        {:error, "Entity '#{target}' not found. Use the prototype key.", socket}
    end
  end

  def execute(:list, %{type: "drafts"} = params, socket) do
    list_by_status(:draft, params[:filter], socket)
  end

  def execute(:list, %{type: "published"} = params, socket) do
    list_by_status(:published, params[:filter], socket)
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
        quests = Entities.find_all(type: :quest, is_prototype: true)

        rows =
          Enum.map(quests, fn q ->
            status = if Entity.draft?(q), do: "DRAFT", else: ""
            name = get_data_field(q, "name") || q.short_desc || q.key
            ["{{cmd:quest info #{q.key}}}#{q.key}{{/cmd}}", status, name]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(quests), "quest"),
            Formatter.table(["Key", "Status", "Name"], rows)
          )

        {:ok, text, socket}

      t when t in ["dialogues", "dialogue"] ->
        dialogues = Dialogue.all()

        rows =
          Enum.map(dialogues, fn d ->
            status = if Entity.draft?(d), do: "DRAFT", else: ""
            entity_key = get_data_field(d, "entity_key") || ""
            nodes = get_data_field(d, "nodes") || %{}
            node_count = if is_map(nodes), do: map_size(nodes), else: length(nodes)

            [
              "{{cmd:dialogue info #{d.key}}}#{d.key}{{/cmd}}",
              status,
              entity_key,
              "#{node_count} nodes"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(dialogues), "dialogue"),
            Formatter.table(["Key", "Status", "NPC", "Nodes"], rows)
          )

        {:ok, text, socket}

      t when t in ["zones", "zone"] ->
        zones = Zone.all()

        rows =
          Enum.map(zones, fn z ->
            status = if Entity.draft?(z), do: "DRAFT", else: ""
            rooms = Zone.rooms(z)

            [
              "{{cmd:zone info #{z.key}}}#{z.key}{{/cmd}}",
              status,
              z.short_desc || z.key,
              "#{length(rooms)} rooms"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(zones), "zone"),
            Formatter.table(["Key", "Status", "Name", "Rooms"], rows)
          )

        {:ok, text, socket}

      t when t in ["cutscenes", "cutscene"] ->
        cutscenes = Entities.find_all(type: :cutscene, is_prototype: true)

        rows =
          Enum.map(cutscenes, fn c ->
            status = if Entity.draft?(c), do: "DRAFT", else: ""
            scenes = get_data_field(c, "scenes") || []

            [
              "{{cmd:cutscene info #{c.key}}}#{c.key}{{/cmd}}",
              status,
              c.short_desc || c.key,
              "#{length(scenes)} scenes"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(cutscenes), "cutscene"),
            Formatter.table(["Key", "Status", "Name", "Scenes"], rows)
          )

        {:ok, text, socket}

      t when t in ["storylines", "storyline"] ->
        storylines = Entities.find_all(type: :storyline, is_prototype: true)

        rows =
          Enum.map(storylines, fn s ->
            status = if Entity.draft?(s), do: "DRAFT", else: ""
            quests = get_data_field(s, "main_quests") || []
            side = get_data_field(s, "side_quests") || []

            [
              "{{cmd:storyline info #{s.key}}}#{s.key}{{/cmd}}",
              status,
              s.short_desc || s.key,
              "#{length(quests)} main, #{length(side)} side"
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(storylines), "storyline"),
            Formatter.table(["Key", "Status", "Name", "Quests"], rows)
          )

        {:ok, text, socket}

      t when t in ["scripts", "script"] ->
        scripts = Script.all()

        scripts =
          if filter = params[:filter] do
            Enum.filter(scripts, fn s ->
              hook = get_data_field(s, "hook") || ""
              hook == filter
            end)
          else
            scripts
          end

        rows =
          Enum.map(scripts, fn s ->
            status = if Entity.draft?(s), do: "DRAFT", else: ""
            hook = get_data_field(s, "hook") || ""

            [
              "{{cmd:script info #{s.key}}}#{s.key}{{/cmd}}",
              status,
              s.short_desc || s.key,
              hook
            ]
          end)

        text =
          Formatter.section(
            Formatter.count_label(length(scripts), "script"),
            Formatter.table(["Key", "Status", "Name", "Hook"], rows)
          )

        {:ok, text, socket}

      _ ->
        {:error,
         "Unknown type '#{type_str}'. Use: npcs, items, quests, dialogues, zones, cutscenes, storylines, scripts, drafts, published",
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
        name = e[:name] || e[:short_desc]

        Helpers.matches?(e.key, search_lower) ||
          Helpers.matches?(name, search_lower)
      end)
      |> Enum.map(fn e ->
        name = e[:name] || e[:short_desc] || e.key
        draft? = get_in(e, [:metadata, "draft"]) == true
        status = if draft?, do: "DRAFT", else: ""
        cmd = if type == "room", do: "goto #{e.key}", else: "info #{e.key}"
        [type, "{{cmd:#{cmd}}}#{e.key}{{/cmd}}", status, name]
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
          Formatter.table(["Type", "Key", "Status", "Name"], all)
        )

      {:ok, text, socket}
    end
  end

  # --- Preview command ---

  @preview_types ~w(quest dialogue script zone cutscene storyline room npc item)

  def execute(:preview, %{type: type, key: key}, socket) when type in @preview_types do
    case Entities.find_one(key: key) do
      {:ok, obj} ->
        text = format_preview(obj, key)
        {:ok, text, socket}

      {:error, :not_found} ->
        {:error, "Content '#{key}' not found. Check the key and ensure it has been loaded.",
         socket}
    end
  end

  def execute(:preview, %{type: type}, socket) do
    valid = Enum.join(@preview_types, ", ")
    {:error, "Unknown type '#{type}'. Valid types: #{valid}", socket}
  end

  defp format_preview(obj, key) do
    is_draft = Entity.draft?(obj)
    status = if is_draft, do: "DRAFT", else: "PUBLISHED"

    parent_key = (obj.metadata || %{})["parent_key"]

    # Build metadata section
    meta_lines = [
      "  Key:    #{key}",
      "  Type:   #{obj.type}",
      "  Status: #{status}",
      "  ID:     #{obj.id}"
    ]

    meta_lines =
      if obj.short_desc, do: meta_lines ++ ["  Name:   #{obj.short_desc}"], else: meta_lines

    meta_lines =
      if parent_key,
        do: meta_lines ++ ["  Parent: #{parent_key}"],
        else: meta_lines

    # Build content fields section
    data = obj.components["data"] || %{}
    content_lines = format_data_fields(data)

    # Assemble the output
    sections = [
      Formatter.section("Preview: #{key} [#{status}]", Enum.join(meta_lines, "\n")),
      "\n" <> Formatter.section("Content Fields", content_lines)
    ]

    # Add tags if present
    sections =
      if obj.tags != [] do
        sections ++ ["\n  Tags: #{Enum.join(obj.tags, ", ")}"]
      else
        sections
      end

    Enum.join(sections)
  end

  defp format_data_fields(data) when data == %{}, do: "  (no data fields)"

  defp format_data_fields(data) do
    data
    |> Enum.sort_by(fn {k, _v} -> k end)
    |> Enum.map(fn {key, value} -> format_field(key, value, 1) end)
    |> Enum.join("\n")
  end

  defp format_field(key, value, indent) when is_map(value) do
    prefix = String.duplicate("  ", indent)

    if value == %{} do
      "#{prefix}#{key}: {}"
    else
      nested =
        value
        |> Enum.sort_by(fn {k, _} -> k end)
        |> Enum.map(fn {k, v} -> format_field(k, v, indent + 1) end)
        |> Enum.join("\n")

      "#{prefix}#{key}:\n#{nested}"
    end
  end

  defp format_field(key, value, indent) when is_list(value) do
    prefix = String.duplicate("  ", indent)

    if value == [] do
      "#{prefix}#{key}: []"
    else
      items =
        value
        |> Enum.map(fn item ->
          if is_map(item) do
            nested =
              item
              |> Enum.sort_by(fn {k, _} -> k end)
              |> Enum.map(fn {k, v} -> format_field(k, v, indent + 2) end)
              |> Enum.join("\n")

            "#{prefix}  -\n#{nested}"
          else
            "#{prefix}  - #{inspect_value(item)}"
          end
        end)
        |> Enum.join("\n")

      "#{prefix}#{key}:\n#{items}"
    end
  end

  defp format_field(key, value, indent) do
    prefix = String.duplicate("  ", indent)
    display = inspect_value(value)

    # Truncate long string values for readability
    display =
      if is_binary(value) and String.length(value) > 120 do
        String.slice(value, 0, 117) <> "..."
      else
        display
      end

    "#{prefix}#{key}: #{display}"
  end

  defp inspect_value(value) when is_binary(value), do: value
  defp inspect_value(value), do: inspect(value)

  # --- Private helpers for draft/published filtering ---

  @publishable_entity_subtypes [:room, :npc, :item]
  @publishable_content_types [:quest, :dialogue, :script, :zone, :cutscene, :storyline]

  # Maps user-facing type name (singular + plural) to {entity_type, info_command_prefix}.
  @filterable_types (
                      entity_entries =
                        for subtype <- @publishable_entity_subtypes do
                          name = Atom.to_string(subtype)
                          spec = {subtype, "info"}
                          [{name, spec}, {name <> "s", spec}]
                        end
                        |> List.flatten()

                      content_entries =
                        for type <- @publishable_content_types do
                          name = Atom.to_string(type)
                          spec = {type, "#{name} info"}
                          [{name, spec}, {name <> "s", spec}]
                        end
                        |> List.flatten()

                      Map.new(entity_entries ++ content_entries)
                    )

  # All unique type specs used when listing all types at once.
  # Format: {entity_type, type_label, info_command_prefix}
  @all_type_specs (
                    entity_specs =
                      for subtype <- @publishable_entity_subtypes do
                        name = Atom.to_string(subtype)
                        {subtype, name, "info"}
                      end

                    content_specs =
                      for type <- @publishable_content_types do
                        name = Atom.to_string(type)
                        {type, name, "#{name} info"}
                      end

                    entity_specs ++ content_specs
                  )

  defp list_by_status(status, type_filter, socket) do
    filter_fn = status_filter_fn(status)
    status_label = if status == :draft, do: "Draft", else: "Published"

    case type_filter do
      nil ->
        # Show all content types
        rows =
          Enum.flat_map(@all_type_specs, fn {type, type_label, cmd_prefix} ->
            objects = Entities.find_all(type: type, is_prototype: true)
            filtered = Enum.filter(objects, filter_fn)

            Enum.map(filtered, fn obj ->
              [
                type_label,
                "{{cmd:#{cmd_prefix} #{obj.key}}}#{obj.key}{{/cmd}}",
                obj.short_desc || obj.key
              ]
            end)
          end)

        text =
          Formatter.section(
            "#{status_label} content (#{length(rows)})",
            if rows == [] do
              "No #{String.downcase(status_label)} content found."
            else
              Formatter.table(["Type", "Key", "Name"], rows)
            end
          )

        {:ok, text, socket}

      type_str ->
        case Map.get(@filterable_types, type_str) do
          {type, cmd_prefix} ->
            objects = Entities.find_all(type: type, is_prototype: true)
            filtered = Enum.filter(objects, filter_fn)

            rows =
              Enum.map(filtered, fn obj ->
                [
                  "{{cmd:#{cmd_prefix} #{obj.key}}}#{obj.key}{{/cmd}}",
                  obj.short_desc || obj.key
                ]
              end)

            type_label = normalize_type_label(type_str)

            text =
              Formatter.section(
                "#{status_label} #{type_label} (#{length(filtered)})",
                if rows == [] do
                  "No #{String.downcase(status_label)} #{type_label} found."
                else
                  Formatter.table(["Key", "Name"], rows)
                end
              )

            {:ok, text, socket}

          nil ->
            {:error,
             "Unknown type '#{type_str}'. Use: npcs, items, quests, dialogues, zones, cutscenes, storylines, scripts",
             socket}
        end
    end
  end

  defp status_filter_fn(:draft), do: &Entity.draft?/1
  defp status_filter_fn(:published), do: &(not Entity.draft?(&1))

  defp normalize_type_label(type_str) do
    case type_str do
      t when t in ["npc", "npcs"] -> "NPCs"
      t when t in ["item", "items"] -> "items"
      t when t in ["quest", "quests"] -> "quests"
      t when t in ["dialogue", "dialogues"] -> "dialogues"
      t when t in ["zone", "zones"] -> "zones"
      t when t in ["cutscene", "cutscenes"] -> "cutscenes"
      t when t in ["storyline", "storylines"] -> "storylines"
      t when t in ["script", "scripts"] -> "scripts"
      other -> other
    end
  end

  # Helper to access data fields stored in components["data"]
  defp get_data_field(%Entity{} = entity, field) do
    data = entity.components["data"] || %{}
    Map.get(data, field)
  end
end
