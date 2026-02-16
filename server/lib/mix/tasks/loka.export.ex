defmodule Mix.Tasks.Loka.Export do
  @moduledoc """
  Exports entities from the database to YAML files.

  Closes the content loop: YAML → DB (seeder) → modify (builder) → YAML (export) → git.

  ## Usage

      # Export all prototypes
      mix loka.export

      # Export specific types
      mix loka.export --type room,npc

      # Export entities modified since a date
      mix loka.export --modified-since 2026-02-10

      # Dry run — show what would be written without writing files
      mix loka.export --dry-run

      # Export to a custom output directory
      mix loka.export --output priv/world/export

  ## Options

    * `--type` - Comma-separated entity types to export (default: all prototype types)
    * `--modified-since` - Only export entities updated after this date (YYYY-MM-DD)
    * `--dry-run` - Show planned exports without writing files
    * `--output` - Custom output directory (default: `priv/world/`)
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  alias Loka.Engine.Entities
  alias Loka.Engine.Constants.WorldPaths

  @exportable_types ~w(room npc item quest dialogue zone storyline cutscene skill recipe resource status script gathering_node social)

  @type_to_dir %{
    "room" => "prototypes/rooms",
    "npc" => "prototypes/npcs",
    "item" => "prototypes/items",
    "quest" => "quests",
    "dialogue" => "dialogues",
    "zone" => "zones",
    "storyline" => "storylines",
    "cutscene" => "cutscenes",
    "skill" => "skills",
    "recipe" => "recipes",
    "resource" => "resources",
    "status" => "statuses",
    "script" => "scripts",
    "gathering_node" => "nodes",
    "social" => ""
  }

  @shortdoc "Exports entities from DB to YAML files"

  @impl Mix.Task
  def run(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        strict: [
          type: :string,
          modified_since: :string,
          dry_run: :boolean,
          output: :string
        ],
        aliases: [t: :type, n: :dry_run, o: :output]
      )

    Mix.Task.run("app.start")

    types = parse_types(opts[:type])
    modified_since = parse_date(opts[:modified_since])
    dry_run = opts[:dry_run] || false
    output_dir = opts[:output] || WorldPaths.world_dir()

    entities = fetch_entities(types, modified_since)

    if Enum.empty?(entities) do
      Mix.shell().info("No entities found matching criteria.")
    else
      Mix.shell().info("Found #{length(entities)} entities to export.")

      Enum.each(entities, fn entity ->
        yaml = entity_to_yaml(entity)
        dir = type_output_dir(output_dir, to_string(entity.type))
        path = Path.join(dir, "#{entity.key}.yml")

        if dry_run do
          Mix.shell().info("  [dry-run] #{path}")
        else
          File.mkdir_p!(dir)
          File.write!(path, yaml)
          Mix.shell().info("  wrote #{path}")
        end
      end)

      if dry_run do
        Mix.shell().info("\nDry run complete. No files written.")
      else
        Mix.shell().info("\nExported #{length(entities)} entities to #{output_dir}/")
      end
    end
  end

  # =============================================================================
  # Query
  # =============================================================================

  defp fetch_entities(types, modified_since) do
    types
    |> Enum.flat_map(fn type ->
      type_atom = String.to_atom(type)
      Entities.find_all(type: type_atom, is_prototype: true)
    end)
    |> maybe_filter_by_date(modified_since)
    |> Enum.sort_by(& &1.key)
  end

  defp maybe_filter_by_date(entities, nil), do: entities

  defp maybe_filter_by_date(entities, since) do
    Enum.filter(entities, fn entity ->
      case entity.metadata["updated_at"] do
        %DateTime{} = dt -> DateTime.compare(dt, since) in [:gt, :eq]
        _ -> true
      end
    end)
  end

  # =============================================================================
  # Entity → YAML Conversion
  # =============================================================================

  defp entity_to_yaml(entity) do
    fields = build_yaml_fields(entity)

    fields
    |> Enum.reject(fn {_k, v} -> is_nil(v) or v == [] or v == %{} end)
    |> Enum.map_join("\n", fn {key, value} -> format_yaml_field(key, value) end)
    |> Kernel.<>("\n")
  end

  defp build_yaml_fields(entity) do
    parent_key = entity.metadata["parent_key"]
    components = entity.components || %{}

    # Extract special component sections back to top-level YAML fields
    {emotes, components} = Map.pop(components, "emotes")
    {spawns, components} = Map.pop(components, "spawns")
    {exits, components} = Map.pop(components, "exits")
    {attributes, components} = Map.pop(components, "attributes")
    {data, components} = Map.pop(components, "data")

    base =
      [
        {"key", entity.key},
        {"type", to_string(entity.type)},
        {"parent", parent_key}
      ]

    descs =
      [
        {"short_desc", entity.short_desc},
        {"long_desc", entity.long_desc},
        {"extra_desc", entity.extra_desc},
        {"keywords", non_empty_list(entity.keywords)},
        {"primary_keyword", entity.primary_keyword},
        {"mood", entity.mood}
      ]

    tags_field = [{"tags", non_empty_list(entity.tags)}]

    exits_field = [{"exits", non_empty_map(exits)}]
    spawns_field = [{"spawns", non_empty_list(spawns)}]
    attributes_field = [{"attributes", non_empty_map(attributes)}]
    traits_field = [{"traits", non_empty_list(entity.traits)}]
    emotes_field = [{"emotes", non_empty_map(emotes)}]
    components_field = [{"components", non_empty_map(components)}]
    scripts_field = [{"scripts", non_empty_map(entity.scripts)}]

    # Content-type extra fields (objectives, rewards, etc.) stored in components["data"]
    data_fields =
      case data do
        m when is_map(m) and map_size(m) > 0 ->
          Enum.map(m, fn {k, v} -> {k, v} end)

        _ ->
          []
      end

    base ++
      descs ++
      tags_field ++
      exits_field ++
      spawns_field ++
      attributes_field ++
      traits_field ++
      emotes_field ++
      components_field ++
      scripts_field ++
      data_fields
  end

  defp non_empty_list(nil), do: nil
  defp non_empty_list([]), do: nil
  defp non_empty_list(list), do: list

  defp non_empty_map(nil), do: nil
  defp non_empty_map(map) when map_size(map) == 0, do: nil
  defp non_empty_map(map), do: map

  # =============================================================================
  # YAML Formatting
  # =============================================================================

  defp format_yaml_field(key, value) when is_binary(value) do
    if String.contains?(value, "\n") do
      indented = value |> String.trim_trailing("\n") |> indent_block()
      "#{key}: |\n#{indented}"
    else
      "#{key}: #{yaml_quote_string(value)}"
    end
  end

  defp format_yaml_field(key, value) when is_integer(value) or is_float(value) do
    "#{key}: #{value}"
  end

  defp format_yaml_field(key, true), do: "#{key}: true"
  defp format_yaml_field(key, false), do: "#{key}: false"

  defp format_yaml_field(key, value) when is_list(value) do
    if Enum.all?(value, &is_binary/1) and simple_list?(value) do
      # Simple string list — block style
      "#{key}:\n" <> Enum.map_join(value, "\n", fn v -> "  - #{yaml_quote_string(v)}" end)
    else
      # Complex list — block style
      "#{key}:\n" <> format_yaml_list(value, 2)
    end
  end

  defp format_yaml_field(key, value) when is_map(value) do
    "#{key}:\n" <> format_yaml_map(value, 2)
  end

  defp format_yaml_field(key, value) do
    "#{key}: #{inspect(value)}"
  end

  defp format_yaml_map(map, indent) when is_map(map) do
    map
    |> Enum.sort_by(fn {k, _v} -> k end)
    |> Enum.map_join("\n", fn {k, v} ->
      format_yaml_nested(k, v, indent)
    end)
  end

  defp format_yaml_nested(key, value, indent) when is_binary(value) do
    pad = String.duplicate(" ", indent)

    if String.contains?(value, "\n") do
      indented =
        value
        |> String.trim_trailing("\n")
        |> String.split("\n")
        |> Enum.map_join("\n", fn line -> "#{pad}  #{line}" end)

      "#{pad}#{key}: |\n#{indented}"
    else
      "#{pad}#{key}: #{yaml_quote_string(value)}"
    end
  end

  defp format_yaml_nested(key, value, indent) when is_integer(value) or is_float(value) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}: #{value}"
  end

  defp format_yaml_nested(key, true, indent) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}: true"
  end

  defp format_yaml_nested(key, false, indent) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}: false"
  end

  defp format_yaml_nested(key, nil, indent) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}: null"
  end

  defp format_yaml_nested(key, value, indent) when is_list(value) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}:\n" <> format_yaml_list(value, indent + 2)
  end

  defp format_yaml_nested(key, value, indent) when is_map(value) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}:\n" <> format_yaml_map(value, indent + 2)
  end

  defp format_yaml_nested(key, value, indent) do
    pad = String.duplicate(" ", indent)
    "#{pad}#{key}: #{inspect(value)}"
  end

  defp format_yaml_list(list, indent) do
    pad = String.duplicate(" ", indent)

    Enum.map_join(list, "\n", fn item ->
      case item do
        item when is_binary(item) ->
          "#{pad}- #{yaml_quote_string(item)}"

        item when is_integer(item) or is_float(item) ->
          "#{pad}- #{item}"

        item when is_map(item) ->
          # First key on same line as dash, rest indented
          sorted = Enum.sort_by(item, fn {k, _v} -> k end)

          case sorted do
            [{first_k, first_v} | rest] ->
              first_line =
                if is_map(first_v) or is_list(first_v) do
                  "#{pad}- #{first_k}:\n" <> format_nested_value(first_v, indent + 4)
                else
                  "#{pad}- #{first_k}: #{format_inline_value(first_v)}"
                end

              rest_lines =
                Enum.map_join(rest, "\n", fn {k, v} ->
                  format_yaml_nested(k, v, indent + 2)
                end)

              if rest_lines == "" do
                first_line
              else
                first_line <> "\n" <> rest_lines
              end

            [] ->
              "#{pad}- {}"
          end

        _ ->
          "#{pad}- #{inspect(item)}"
      end
    end)
  end

  defp format_nested_value(value, indent) when is_map(value), do: format_yaml_map(value, indent)
  defp format_nested_value(value, indent) when is_list(value), do: format_yaml_list(value, indent)

  defp format_inline_value(value) when is_binary(value), do: yaml_quote_string(value)
  defp format_inline_value(value) when is_integer(value) or is_float(value), do: "#{value}"
  defp format_inline_value(true), do: "true"
  defp format_inline_value(false), do: "false"
  defp format_inline_value(nil), do: "null"
  defp format_inline_value(value), do: inspect(value)

  defp indent_block(text) do
    text
    |> String.split("\n")
    |> Enum.map_join("\n", fn line -> "  #{line}" end)
  end

  defp yaml_quote_string(s) when is_binary(s) do
    # Quote if contains special chars, starts with special, or could be misinterpreted
    needs_quote =
      String.starts_with?(s, [" ", "\"", "'", "{", "[", "*", "&", "!", "%", "@", "`"]) or
        String.contains?(s, [":", "#", "\n"]) or
        s in ["true", "false", "null", "yes", "no", "on", "off", "~", ""] or
        Regex.match?(~r/^\d/, s)

    if needs_quote do
      "\"#{String.replace(s, "\"", "\\\"")}\""
    else
      s
    end
  end

  defp yaml_quote_string(s), do: to_string(s)

  defp simple_list?(list) do
    length(list) <= 10 and Enum.all?(list, fn s -> String.length(s) < 40 end)
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp parse_types(nil), do: @exportable_types

  defp parse_types(type_string) do
    type_string
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.filter(&(&1 in @exportable_types))
  end

  defp parse_date(nil), do: nil

  defp parse_date(date_string) do
    case Date.from_iso8601(date_string) do
      {:ok, date} ->
        DateTime.new!(date, ~T[00:00:00], "Etc/UTC")

      {:error, _} ->
        Mix.raise("Invalid date format: #{date_string}. Use YYYY-MM-DD.")
    end
  end

  defp type_output_dir(output_dir, type) do
    subdir = Map.get(@type_to_dir, type, type)

    if subdir == "" do
      output_dir
    else
      Path.join(output_dir, subdir)
    end
  end
end
