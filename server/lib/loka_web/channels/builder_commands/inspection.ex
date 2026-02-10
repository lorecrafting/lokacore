defmodule LokaWeb.Channels.BuilderCommands.Inspection do
  @moduledoc """
  Builder inspection commands: info, list, find.
  """

  alias Loka.Engine.TypedObject
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
        quests = Loader.list_by_type(:quest)

        rows =
          Enum.map(quests, fn q ->
            status = if TypedObject.draft?(q), do: "DRAFT", else: ""
            ["{{cmd:quest info #{q.key}}}#{q.key}{{/cmd}}", status, q.data["name"] || q.key]
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
            status = if TypedObject.draft?(d), do: "DRAFT", else: ""
            entity_key = get_in(d.data, ["entity_key"]) || ""
            nodes = get_in(d.data, ["nodes"]) || %{}
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
            status = if TypedObject.draft?(z), do: "DRAFT", else: ""
            rooms = Zone.rooms(z)

            [
              "{{cmd:zone info #{z.key}}}#{z.key}{{/cmd}}",
              status,
              z.name || z.key,
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
        cutscenes = Loader.list_by_type(:cutscene)

        rows =
          Enum.map(cutscenes, fn c ->
            status = if TypedObject.draft?(c), do: "DRAFT", else: ""
            scenes = get_in(c.data, ["scenes"]) || []

            [
              "{{cmd:cutscene info #{c.key}}}#{c.key}{{/cmd}}",
              status,
              c.name || c.key,
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
        storylines = Loader.list_by_type(:storyline)

        rows =
          Enum.map(storylines, fn s ->
            status = if TypedObject.draft?(s), do: "DRAFT", else: ""
            quests = get_in(s.data, ["main_quests"]) || []
            side = get_in(s.data, ["side_quests"]) || []

            [
              "{{cmd:storyline info #{s.key}}}#{s.key}{{/cmd}}",
              status,
              s.name || s.key,
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
              hook = get_in(s.data, ["hook"]) || ""
              hook == filter
            end)
          else
            scripts
          end

        rows =
          Enum.map(scripts, fn s ->
            status = if TypedObject.draft?(s), do: "DRAFT", else: ""
            hook = get_in(s.data, ["hook"]) || ""
            ["{{cmd:script info #{s.key}}}#{s.key}{{/cmd}}", status, s.name || s.key, hook]
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
        Helpers.matches?(e.key, search_lower) || Helpers.matches?(e.name, search_lower)
      end)
      |> Enum.map(fn e ->
        status =
          case Loader.get(e.key) do
            {:ok, obj} -> if TypedObject.draft?(obj), do: "DRAFT", else: ""
            _ -> ""
          end

        cmd = if type == "room", do: "goto #{e.key}", else: "info #{e.key}"
        [type, "{{cmd:#{cmd}}}#{e.key}{{/cmd}}", status, e.name]
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

  # Derive directory mappings from TypedObject's single source of truth.
  @type_to_dir Map.new(TypedObject.publishable_content_types(), fn type ->
                 {Atom.to_string(type), TypedObject.content_dir(type)}
               end)

  @entity_to_subdir Map.new(TypedObject.publishable_entity_subtypes(), fn subtype ->
                      {Atom.to_string(subtype), TypedObject.entity_dir(subtype)}
                    end)

  @preview_types Map.keys(@type_to_dir) ++ Map.keys(@entity_to_subdir)

  def execute(:preview, %{type: type, key: key}, socket) when type in @preview_types do
    case Loader.get(key) do
      {:ok, obj} ->
        text = format_preview(obj, type, key)
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

  defp format_preview(obj, type, key) do
    world_dir = :code.priv_dir(:loka) |> Path.join("world")
    is_draft = TypedObject.draft?(obj)
    status = if is_draft, do: "DRAFT", else: "PUBLISHED"

    file_path = infer_file_path(type, key, is_draft, world_dir)

    file_display =
      if File.exists?(file_path) do
        Path.relative_to_cwd(file_path)
      else
        "(computed) #{Path.relative_to_cwd(file_path)}"
      end

    # Build metadata section
    meta_lines = [
      "  Key:    #{key}",
      "  Type:   #{obj.type}#{if obj.subtype, do: " (#{obj.subtype})", else: ""}",
      "  Status: #{status}",
      "  File:   #{file_display}"
    ]

    meta_lines =
      if obj.name, do: meta_lines ++ ["  Name:   #{obj.name}"], else: meta_lines

    meta_lines =
      if obj.parent_key,
        do: meta_lines ++ ["  Parent: #{obj.parent_key}"],
        else: meta_lines

    # Build content fields section
    data = obj.data || %{}
    content_lines = format_data_fields(data)

    # Check for published version if this is a draft
    comparison_note =
      if is_draft do
        published_path = infer_file_path(type, key, false, world_dir)

        if File.exists?(published_path) do
          "\n  Note: A published version also exists at #{Path.relative_to_cwd(published_path)}"
        else
          ""
        end
      else
        draft_path = infer_file_path(type, key, true, world_dir)

        if File.exists?(draft_path) do
          "\n  Note: A draft version also exists at #{Path.relative_to_cwd(draft_path)}"
        else
          ""
        end
      end

    # Assemble the output
    sections = [
      Formatter.section("Preview: #{key} [#{status}]", Enum.join(meta_lines, "\n")),
      comparison_note,
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

  defp infer_file_path(type, key, is_draft, world_dir) do
    subdir =
      case Map.get(@entity_to_subdir, type) do
        nil -> Map.get(@type_to_dir, type, type)
        entity_subdir -> entity_subdir
      end

    if is_draft do
      Path.join([world_dir, "drafts", subdir, "#{key}.yml"])
    else
      Path.join([world_dir, subdir, "#{key}.yml"])
    end
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

  # Derive filterable types from TypedObject's single source of truth.
  # Maps user-facing type name (singular + plural) to {loader_type, loader_subtype, info_command_prefix}.
  @filterable_types (
                      # Entity subtypes: command prefix is "info" (e.g., "info goblin")
                      entity_entries =
                        for subtype <- TypedObject.publishable_entity_subtypes() do
                          name = Atom.to_string(subtype)
                          spec = {:entity, subtype, "info"}
                          [{name, spec}, {name <> "s", spec}]
                        end
                        |> List.flatten()

                      # Content types: command prefix is "<type> info" (e.g., "quest info dragon_hunt")
                      content_entries =
                        for type <- TypedObject.publishable_content_types() do
                          name = Atom.to_string(type)
                          spec = {type, nil, "#{name} info"}
                          [{name, spec}, {name <> "s", spec}]
                        end
                        |> List.flatten()

                      Map.new(entity_entries ++ content_entries)
                    )

  # All unique type specs used when listing all types at once.
  # Format: {loader_type, loader_subtype, type_label, info_command_prefix}
  @all_type_specs (
                    entity_specs =
                      for subtype <- TypedObject.publishable_entity_subtypes() do
                        name = Atom.to_string(subtype)
                        {:entity, subtype, name, "info"}
                      end

                    content_specs =
                      for type <- TypedObject.publishable_content_types() do
                        name = Atom.to_string(type)
                        {type, nil, name, "#{name} info"}
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
          Enum.flat_map(@all_type_specs, fn {type, subtype, type_label, cmd_prefix} ->
            objects = Loader.list_by_type(type, subtype)
            filtered = Enum.filter(objects, filter_fn)

            Enum.map(filtered, fn obj ->
              [
                type_label,
                "{{cmd:#{cmd_prefix} #{obj.key}}}#{obj.key}{{/cmd}}",
                obj.name || obj.key
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
          {type, subtype, cmd_prefix} ->
            objects = Loader.list_by_type(type, subtype)
            filtered = Enum.filter(objects, filter_fn)

            rows =
              Enum.map(filtered, fn obj ->
                [
                  "{{cmd:#{cmd_prefix} #{obj.key}}}#{obj.key}{{/cmd}}",
                  obj.name || obj.key
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

  defp status_filter_fn(:draft), do: &TypedObject.draft?/1
  defp status_filter_fn(:published), do: &(not TypedObject.draft?(&1))

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
end
