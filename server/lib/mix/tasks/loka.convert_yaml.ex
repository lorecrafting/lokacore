defmodule Mix.Tasks.Loka.ConvertYaml do
  @moduledoc """
  One-time YAML conversion from V1 to V2 format.

  Phase 0 (backward-compatible): Only transforms that don't break V1 loaders.
  - Scripts: 23 function renames applied within data.source/code strings
  - Flags removed V1 bindings for manual review

  Structural changes (quest fields→components, script data→scripts block,
  parent→parent_key, spawns→components.room, status type rename) are deferred
  to later phases alongside corresponding code changes.

  ## Usage

      mix loka.convert_yaml           # Convert all files
      mix loka.convert_yaml --dry-run # Show planned changes without writing
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @shortdoc "Convert V1 YAML to V2 format (one-time migration)"

  # V1 → V2 script function renames (23 entries).
  # Applied as regex replacements on script source code strings only.
  @script_renames [
    # Simple function renames (same args)
    {~r/\bdamage\(/, "apply_damage("},
    {~r/\bapply_effect\(/, "apply_status("},
    {~r/\bremove_effect\(/, "remove_status("},
    {~r/\bget_behavior_state\(/, "get_state("},
    {~r/\bset_behavior_state\(/, "set_state("},
    {~r/\bsend_to\(/, "emit("},
    {~r/\bcount\(/, "length("},
    {~r/\bpick\((?!_random)/, "pick_random("},
    # Arg-reordering renames
    {~r/\bhas_item\?\(([^)]+)\)/, "has_item?(event().speaker, \\1)"},
    {~r/\bquest_active\?\(([^)]+)\)/, "quest_active?(event().speaker, \\1)"},
    {~r/\bquest_complete\?\(([^)]+)\)/, "quest_complete?(event().speaker, \\1)"},
    {~r/\bget_stat\(([^)]+)\)/, "get_component(self(), \"stats\", \\1)"},
    {~r/\bgive_item\(([^)]+)\)/, "spawn_entity(\\1, location: event().speaker)"},
    {~r/\bremove_item\(([^)]+)\)/, "despawn(find_by_keyword(\\1, :item))"},
    {~r/\bstart_quest\(([^)]+)\)/, "grant_quest(event().speaker, \\1)"},
    {~r/\bspawn_at\(([^,]+),\s*([^)]+)\)/, "spawn_entity(\\1, location: \\2)"},
    {~r/\bspawn_npc\(([^)]+)\)/, "spawn_entity(\\1, location: self().location_id)"},
    {~r/\bspawn_item\(([^)]+)\)/, "spawn_entity(\\1, location: self().location_id)"},
    {~r/\bannounce_room\(([^)]+)\)/, "broadcast(get_location(self()), \\1)"},
    # after(timeout, "event") → set_timer("event", timeout, "event")
    {~r/\bafter\(([^,]+),\s*"([^"]+)"\)/, ~S[set_timer("\2", \1, "\2")]},
    # Variable/expression renames (last to avoid conflicts)
    {~r/\broom\(\)/, "get_location(self())"},
    {~r/\bplayer\(\)/, "event().speaker"},
    {~r/(?<![_\w])entity(?=\.)/, "self()"}
  ]

  # V1 bindings removed in V2 — flag for manual review
  @removed_bindings ~w(context config quest_objective_done? get_skill get_attribute
    entity_present? find_entities_by_tag current_weather is_outdoor? is_dark?
    create_room default allow)

  @impl Mix.Task
  def run(args) do
    dry_run = "--dry-run" in args
    files = collect_yaml_files()
    results = Enum.map(files, &process_file(&1, dry_run))
    print_summary(results, dry_run)
  end

  defp collect_yaml_files do
    Path.wildcard("priv/world/**/*.yml") |> Enum.sort()
  end

  defp process_file(path, dry_run) do
    raw = File.read!(path)

    case YamlElixir.read_from_string(raw) do
      {:ok, data} when is_map(data) ->
        is_script = String.contains?(path, "/scripts/")
        {new_content, changes, warnings} = transform_file(raw, data, is_script)

        if not dry_run and changes != [] do
          File.write!(path, new_content)
        end

        %{path: path, changes: changes, warnings: warnings}

      _ ->
        %{path: path, changes: [], warnings: ["PARSE ERROR or non-map YAML"]}
    end
  end

  # Only script files get code transforms; all other files are unchanged in Phase 0.
  defp transform_file(raw, data, true = _is_script) do
    script_data = data["data"] || %{}
    source = script_data["source"] || script_data["code"]

    if source && is_binary(source) && byte_size(source) > 0 do
      # Apply 23 script renames
      {transformed, rename_changes} = transform_script_code(source)

      # Check for removed bindings
      warnings = check_removed_bindings(transformed)

      # Check for unconverted after() calls (lambda args)
      warnings =
        if Regex.match?(~r/\bafter\(/, transformed) do
          ["MANUAL: after() with non-string event arg — convert to set_timer/3" | warnings]
        else
          warnings
        end

      if rename_changes != [] do
        # Replace the source code in the raw YAML text, preserving file structure.
        # Find the `source: |` or `code: |` block and replace its indented content.
        source_key = if script_data["source"], do: "source", else: "code"
        new_content = replace_block_scalar(raw, source_key, transformed)
        {new_content, Enum.reverse(rename_changes), warnings}
      else
        {raw, [], warnings}
      end
    else
      {raw, [], []}
    end
  end

  defp transform_file(raw, _data, false = _is_script), do: {raw, [], []}

  # Replace a YAML block scalar (key: |) with new content, preserving indentation.
  defp replace_block_scalar(yaml, key, new_content) do
    # Match: `key: |` followed by indented or blank lines.
    # The body pattern handles blank lines within the code block.
    pattern = ~r/(#{Regex.escape(key)}:\s*\|[ \t]*\n)((?:(?:[ \t]+[^\n]*|[ \t]*)\n)*)/

    case Regex.run(pattern, yaml, return: :index) do
      [{_full_start, _full_len}, {header_start, header_len}, {body_start, body_len}] ->
        header = binary_part(yaml, header_start, header_len)
        old_body = binary_part(yaml, body_start, body_len)

        # Detect the indent of the first content line
        indent =
          case Regex.run(~r/^([ \t]+)\S/, old_body) do
            [_, spaces] -> spaces
            _ -> "    "
          end

        # Re-indent the new content
        new_body =
          new_content
          |> String.trim_trailing("\n")
          |> String.split("\n")
          |> Enum.map_join("\n", fn line ->
            if String.trim(line) == "" do
              ""
            else
              indent <> line
            end
          end)

        new_body = new_body <> "\n"

        before = binary_part(yaml, 0, header_start)

        after_body =
          binary_part(yaml, body_start + body_len, byte_size(yaml) - body_start - body_len)

        before <> header <> new_body <> after_body

      _ ->
        yaml
    end
  end

  defp transform_script_code(code) do
    Enum.reduce(@script_renames, {code, []}, fn {regex, replacement}, {code_acc, changes_acc} ->
      if Regex.match?(regex, code_acc) do
        new_code = Regex.replace(regex, code_acc, replacement)
        rename_desc = "#{readable_pattern(regex)} → #{String.slice(replacement, 0, 40)}"
        {new_code, [rename_desc | changes_acc]}
      else
        {code_acc, changes_acc}
      end
    end)
  end

  defp readable_pattern(regex) do
    regex.source
    |> String.replace(~r/\\\(.*/, "(…)")
    |> String.replace(~r/^\(\?\<\![^)]+\)/, "")
    |> String.replace(~r/\(\?\=[^)]+\)/, "")
    |> String.replace("\\b", "")
    |> String.replace("\\(", "(")
    |> String.replace("\\)", ")")
    |> String.replace("\\?", "?")
  end

  defp check_removed_bindings(code) do
    @removed_bindings
    |> Enum.filter(fn binding ->
      Regex.match?(~r/\b#{Regex.escape(binding)}\b/, code)
    end)
    |> Enum.map(&"MANUAL: removed V1 binding '#{&1}' — needs manual conversion")
  end

  defp print_summary(results, dry_run) do
    changed = Enum.filter(results, &(&1.changes != []))
    warned = Enum.filter(results, &(&1.warnings != []))
    skipped = Enum.filter(results, &(&1.changes == [] and &1.warnings == []))

    mode = if dry_run, do: "[DRY RUN] ", else: ""

    Mix.shell().info("\n#{mode}╔════════════════════════════════════════════╗")
    Mix.shell().info("#{mode}║     V1 → V2 YAML Conversion Summary      ║")
    Mix.shell().info("#{mode}╚════════════════════════════════════════════╝\n")

    if changed != [] do
      Mix.shell().info("#{mode}✅ Converted (#{length(changed)} files):")

      for result <- changed do
        path = String.replace(result.path, ~r|^priv/world/|, "")
        Mix.shell().info("  #{path}")

        for change <- result.changes do
          Mix.shell().info("    → #{change}")
        end
      end

      Mix.shell().info("")
    end

    if warned != [] do
      Mix.shell().info("#{mode}⚠️  Needs manual review (#{length(warned)} files):")

      for result <- warned do
        path = String.replace(result.path, ~r|^priv/world/|, "")
        Mix.shell().info("  #{path}")

        for warning <- result.warnings do
          Mix.shell().info("    ⚠ #{warning}")
        end
      end

      Mix.shell().info("")
    end

    Mix.shell().info("#{mode}────────────────────────────────────────────")

    Mix.shell().info(
      "#{mode}Total: #{length(results)} files | " <>
        "#{length(changed)} converted | " <>
        "#{length(warned)} need review | " <>
        "#{length(skipped)} unchanged"
    )
  end
end
