defmodule Loka.Content.Explain do
  @moduledoc """
  Diagnostics in plain words: one line each, `severity: file:line what to do`
  (docs/system/cartridge.md, Author preview). Tool text keyed by diagnostic code; `data` fills it,
  and the source files give the line (a JSON path index, a scene's own lines). Read only after a
  compile, so the compile itself never pays for it.
  """

  alias Loka.Content.SourceLines

  # code => {what is wrong, what to do}. {name} is a `data` key, or `field` (the path's last step).
  @catalog %{
    "INVALID_JSON" =>
      {"This file is not valid JSON.",
       "Close the bracket or quote at this point, or remove the stray comma."},
    "DUPLICATE_KEY" => {"`{field}` appears twice in one object.", "Keep one of them."},
    "UNKNOWN_FIELD" => {"`{field}` is not a field here.", "Remove it or fix its name."},
    "SCHEMA_VIOLATION" =>
      {"`{field}` is not valid here.",
       "Check it against the kind's reference in docs/system/cartridge.md."},
    "MISSING_MANIFEST" =>
      {"There is no cartridge.json.",
       "Run `bin/loka new cartridge <name>`, or point the tool at the cartridge's folder."},
    "DUPLICATE_DEFINITION" =>
      {"This name or key is already taken.",
       "Rename it. If no other file uses it, it is a built-in word such as a command (look, talk)."},
    "FACT_NAME_COLLISION" =>
      {"Fact `{field}` maps to the same key as another fact.", "Rename one of them."},
    "FACT_DEFAULT_INVALID" =>
      {"Fact `{field}` has a default its type does not allow.",
       "Change the default or the fact's type."},
    "UNRESOLVED_REFERENCE" =>
      {"Nothing is called `{target}`.",
       "Add it to text.json (or under this file's roles), or change the name."},
    "UNREACHABLE_DETAIL" =>
      {"No room text ever mentions the detail `{field}`.",
       "Link to it from the description or another detail, or remove it."},
    "CONTAINMENT_CYCLE" =>
      {"These things contain each other.", "Change one location so the chain ends in a room."},
    "CAPACITY_EXCEEDED" =>
      {"This container holds {held} but has room for {capacity}.",
       "Raise its capacity or start it with less."},
    "TOUCH_LINK_MISSING" =>
      {"This line has no link to `{target}`, so a phone player cannot tap it.",
       "Add a marker for it in the text."},
    "UNKNOWN_COMMAND" =>
      {"`{field}` names a command this cartridge may not use.",
       "Use a command from the action reference in docs/system/cartridge.md."},
    "FACT_TYPE_MISMATCH" =>
      {"This value does not fit the fact's type.",
       "Change the value, or the fact's type in facts.json."},
    "UNKNOWN_CAPABILITY" =>
      {"This capability does not exist.",
       "Fix its name under requires.capabilities in cartridge.json."},
    "SERVER_ONLY_CAPABILITY" =>
      {"This capability works only on a server, and this cartridge runs offline.",
       "Remove it from requires.capabilities in cartridge.json."},
    "KERNEL_API_RANGE_INVALID" =>
      {"The kernel_api range is not a valid range.",
       "Set requires.kernel_api to the range the other cartridges use."},
    "PINNED_VERSION_UNSUPPORTED" =>
      {"This capability version is not one the engine has.",
       "Change the number under requires.capabilities in cartridge.json."},
    "UNDECLARED_CAPABILITY" =>
      {"This needs a capability the cartridge does not lock{capability_named}.",
       "Add it under requires.capabilities in cartridge.json."},
    "NESTING_TOO_DEEP" => {"This is nested deeper than {maximum} levels.", "Flatten it."},
    "ARTIFACT_TOO_LARGE" =>
      {"The compiled cartridge is over the size limit.", "Split or remove content."},
    "UNKNOWN_FORMAT" =>
      {"This artifact's format is not one this engine reads.",
       "Recompile it with `mix loka.compile`."},
    "CONTENT_HASH_MISMATCH" =>
      {"The artifact's content does not match its hash.",
       "Recompile it with `mix loka.compile`; do not edit artifacts by hand."},
    "ARTIFACT_DEFINITION_KEY_MISMATCH" =>
      {"A definition's key differs from its map key in the artifact.",
       "Recompile it with `mix loka.compile`; do not edit artifacts by hand."},
    "LOCK_MANIFEST_MISMATCH" =>
      {"The artifact's lock does not match its manifest.",
       "Recompile it with `mix loka.compile`; do not edit artifacts by hand."},
    "CAPABILITY_NOT_INSTALLED" =>
      {"This engine does not have a capability the cartridge locks.",
       "Update the engine or lock another version in cartridge.json."},
    "KERNEL_API_UNSUPPORTED" =>
      {"This engine's kernel_api is outside the cartridge's range.",
       "Update requires.kernel_api in cartridge.json."},
    "FACT_SCOPE_UNSUPPORTED" =>
      {"This fact's scope cannot be used here.",
       "Use a fact with another scope, or change this fact's scope in facts.json."},
    "CLIENT_FEATURE_UNSUPPORTED" =>
      {"This app does not support a feature the cartridge requires.",
       "Remove it from requires.client_features in cartridge.json."},
    "EMPTY_TIME_WINDOW" => {"This time window can never be open.", "Widen its hours or days."},
    "OUTCOME_MISMATCH" =>
      {"This outcome does not fit the choice or story point it belongs to.",
       "Keep one effect on the choice and name an outcome its story point declares."},
    "RESOURCE_SPEC_INVALID" =>
      {"A resource must have minimum <= start <= maximum.", "Fix these numbers."},
    "BARRIER_MISMATCH" =>
      {"The two sides of this barrier disagree.",
       "Name the same barrier on both, and check its rooms and direction."},
    "BARRIER_UNREACHABLE_KEY" =>
      {"The key to this barrier is out of reach without passing it.",
       "Place the key on the near side."},
    "RESERVED_FACT" => {"The engine owns the fact name `{field}`.", "Rename your fact."},
    "INVALID_TIME_POLICY" =>
      {"This needs a time policy the cartridge does not have, or does not fit it.",
       "Fix time_policy in cartridge.json, or remove this."},
    "VISITS_UNRECORDED" =>
      {"A visits check can never pass, because nothing records visits.",
       "Add `knowledge` under requires.capabilities in cartridge.json."},
    "HOSTILE_QUEST_SPEAKER" =>
      {"This quest speaker can turn hostile, which refuses the talk.",
       "Choose another speaker or keep the standing up."},
    "SITE_EXIT_CONFLICT" =>
      {"This site names direction `{field}`, where the room has no exit.",
       "Name a direction the room has an exit in."}
  }

  @errors %{
    "invalid_type" => "`{field}` must be {expected}.",
    "missing_property" => "`{field}` is required here and is missing.",
    "not_in_enum" => "`{field}` is not one of the allowed values.",
    "too_few_items" => "`{field}` needs at least one entry."
  }

  @scene_lines %{
    "wrong_speaker" =>
      {"Line `{text}`: only `{npc}:` may speak here (`npc: {npc}`).",
       "Change the speaker to `{npc}`, or move this into its own scene."},
    "repeated_choice" =>
      {"Line `{text}` repeats a choice or has no words to key it by.", "Reword the choice."},
    "gives_outside_choice" =>
      {"Line `{text}`: `gives:` belongs under a choice.", "Move it under a `- ` line."},
    "misplaced_header" =>
      {"Line `{text}`: `npc:` comes first, then `when:`, before any speech.",
       "Move it to the top of the file."},
    "no_npc" =>
      {"Line `{text}` comes before the speaker is named.", "Start the file with `npc: <key>`."},
    "not_a_line" =>
      {"Line `{text}` is not scene format.",
       "Use `npc:`, `when:`, `<npc>: words`, `- choice` or `gives:` (docs/guides/writing-the-game.md)."}
  }

  @doc "Each diagnostic as its one line, against the source tree at `dir`."
  @spec lines([map()], Path.t()) :: [String.t()]
  def lines(diags, dir) do
    index = SourceLines.index(dir)
    Enum.map(diags, &"#{&1["severity"]}: #{place(&1, index)} #{words(&1)}")
  end

  defp words(%{"code" => code, "data" => data} = d) do
    {what, fix} = entry(code, d)
    vars = vars(d)
    "#{fill(what, vars)} #{fill(fix, vars)}#{extra(code, data, vars["field"])}"
  end

  defp entry("SCHEMA_VIOLATION", %{"path" => "layout"}),
    do:
      {"layout.json must place every room once, each at its own spot, and it does not.",
       "Run `bin/loka new layout layout <cartridge dir>` again, then place the new rooms."}

  defp entry("SCHEMA_VIOLATION", %{"data" => %{"why" => why}}), do: @scene_lines[why]

  defp entry("OUTCOME_MISMATCH", %{"data" => %{"holder" => _}}),
    do:
      {"`gives: {item}` hands over nothing until `{holder}` holds `{item}`: the choice stays hidden.",
       "Set the item's location to `{\"in\": \"npc\", \"npc\": \"{holder}\"}`, or move it there in play."}

  defp entry("UNDECLARED_CAPABILITY", %{"path" => path, "data" => %{"capability" => _}} = d) do
    if String.ends_with?(path, ".receive"),
      do:
        {"`gives:` needs the `item_acquired` event, which `{capability}` owns, and the cartridge does not lock it.",
         "Add `\"{capability}\": 1` under requires.capabilities in cartridge.json; the NPC must hold the item too."},
      else: Map.fetch!(@catalog, d["code"])
  end

  defp entry("UNRESOLVED_REFERENCE", %{"data" => %{"target" => t}}) do
    case target(t) do
      %{"kind" => "fact"} ->
        {"Nothing defines the fact `{target}`.", "Add it to facts.json or fix the spelling."}

      %{"kind" => _} ->
        {"Nothing defines the {kind} `{target}`.", "Create it or fix the spelling."}

      _ ->
        @catalog["UNRESOLVED_REFERENCE"]
    end
  end

  defp entry("SCHEMA_VIOLATION", %{"data" => %{"error" => error}}) do
    {what, fix} = @catalog["SCHEMA_VIOLATION"]
    {Map.get(@errors, error, what), fix}
  end

  defp entry(code, _), do: Map.fetch!(@catalog, code)

  defp vars(%{"path" => path, "data" => data}) do
    data
    |> Map.put("field", field(path))
    |> Map.update("expected", "the right type", &article/1)
    |> Map.put(
      "capability_named",
      if(data["capability"], do: " (`#{data["capability"]}`)", else: "")
    )
    |> Map.merge(target(data["target"]))
  end

  defp field(path),
    do: List.last(Regex.run(~r/(?:\["|\.|\[|^)([^.\[\]"]+)"?\]?$/, path) || ["", ""])

  defp article(type),
    do: if(type =~ ~r/^(object|array|integer)/, do: "an #{type}", else: "a #{type}")

  # A long-form reference reads as its kind and key; a bare target is a text key or role name.
  defp target(nil), do: %{}

  defp target(t) do
    case Regex.run(~r{^[^:]+:(\w+)/(.+)$}, t) do
      [_, kind, key] -> %{"target" => key, "kind" => kind}
      nil -> %{"target" => t}
    end
  end

  defp fill(template, vars) do
    Regex.replace(~r/\{(\w+)\}/, template, fn _, k -> to_string(Map.get(vars, k, "?")) end)
  end

  # What the sentence does not carry: a field's valid names.
  defp extra("UNKNOWN_FIELD", %{"valid" => valid}, field) do
    near =
      valid |> String.split(", ") |> Enum.max_by(&String.jaro_distance(field, &1), fn -> "" end)

    guess = if String.jaro_distance(field, near) > 0.8, do: " Did you mean `#{near}`?", else: ""
    "#{guess} Valid here: #{valid}."
  end

  defp extra(_, _, _), do: ""

  defp place(%{"path" => path, "data" => data}, index) do
    case index[prefix(path, index)] do
      nil -> if path == "", do: "the cartridge:", else: "#{path}:"
      {file, line, column} -> "#{file}:#{line}:#{column}"
      {file, line} -> "#{file}:#{data["line"] || line}"
    end
  end

  # The longest indexed path this path starts with, on a step boundary (a missing field has no line).
  defp prefix(path, index) do
    index
    |> Map.keys()
    |> Enum.filter(fn k ->
      path == k or String.starts_with?(path, k <> ".") or String.starts_with?(path, k <> "[")
    end)
    |> Enum.max_by(&byte_size/1, fn -> nil end)
  end
end
