# size: allow 370, the scene-file and cutscene entries, the behaviours pass, the source schema dirs and the source-only choice story_point join the existing source-shortcut pipeline; diag/4 checks its code
defmodule Loka.Content.Source do
  @moduledoc """
  Reads a cartridge source directory, lowers its source shortcuts (load/1) and builds diagnostics
  in the `Diagnostic.path` grammar (protocol/cartridge.schema.json); steps are names and indexes.
  """
  alias Loka.Content.{Areas, Behaviours, CutFiles, Extends, Prose, SceneFiles, SourceFiles, Zones}
  alias Loka.Content.Waits
  alias Loka.Core.Canonical

  @type steps :: [String.t() | non_neg_integer()]
  @typedoc "A source file, or a definition inside an area bundle: `{bundle rel, [dir, key]}`."
  @type location :: String.t() | {String.t(), steps()}
  @type file ::
          :manifest
          | :area
          | :facts
          | :text
          | :resources
          | :attributes
          | :layout
          | {:action
             | :room
             | :item
             | :npc
             | :barrier
             | :quest
             | :reaction
             | :dialogue
             | :scene
             | :skill
             | :topic
             | :liquid
             | :population
             | :replenish
             | :service
             | :transport
             | :bleed
             | :behaviour
             | :status
             | :structure, String.t(), steps()}

  @doc """
  Each recognised `.json` file under `dir` (dot files too) as `{rel, kind, value}` (`:invalid` if
  undecodable; bundled: `{bundle rel, {kind, key, [dir, key]}, value}`; a `.scene` file as its
  dialogue, SceneFiles; a `.cut` file as its scene, CutFiles), with its diagnostics.
  """
  @spec load(Path.t()) :: {[{String.t(), file(), term()}], [map()]}
  def load(dir) do
    {files, diags} = read(dir)
    replaced = steps_over_cut(files)
    files = SceneFiles.merge(files)
    untriggered = untriggered(files)
    {files, opened} = Areas.split(files, dirs())
    {files, repeats} = Areas.unique(files)
    {files, faults} = Extends.flatten(files)
    {files, located} = shortcuts(files, opened ++ repeats)
    {files, diags ++ replaced ++ untriggered ++ located ++ Enum.map(faults, &extends_diag/1)}
  end

  defp shortcuts(files, faults) do
    {files, clashes} = Prose.lower(files)
    {files, held} = Behaviours.expand(files)
    {files, zoned} = Zones.expand(files)
    {files, waited} = Waits.lower(files)
    {files, Enum.map(faults ++ clashes ++ held ++ zoned ++ waited, &bundle_diag/1)}
  end

  defp read(dir) do
    {files, diags} = dir |> SourceFiles.paths() |> Enum.map(&entry(&1, dir)) |> Enum.unzip()

    {Enum.reject(files, &is_nil/1), List.flatten(diags)}
  end

  defp bundle_diag({code, location, data}), do: diag(code, at(location, []), data)

  defp extends_diag({code, location, data, from}) do
    data = if from, do: Map.put(data, "from", at(from, [])), else: data
    diag(code, at(location, []), data)
  end

  defp entry(rel, dir), do: entry(rel, classify(rel), dir)

  defp entry(rel, :unknown, _), do: {nil, [diag("UNKNOWN_FIELD", at(rel, []))]}

  # A scene's errors name its file and line (docs/system/cartridge.md, Source shortcuts).
  defp entry(rel, {:scene_file, id}, dir) do
    text = File.read!(Path.join(dir, rel))

    {value, bad} =
      if elem(id, 0) == :scene, do: CutFiles.parse(text), else: SceneFiles.parse(text)

    diags =
      for {n, text, why} <- bad do
        speaker = if value["npc"], do: %{"npc" => value["npc"]}, else: %{}
        data = Map.merge(speaker, %{"line" => n, "text" => text, "why" => why})
        bad = diag("SCHEMA_VIOLATION", at(rel, []), data)
        if why == "cut_scene_line", do: Map.put(bad, "severity", "warning"), else: bad
      end

    {{rel, id, value}, diags}
  end

  defp entry(rel, kind, dir) do
    case JSON.decode(File.read!(Path.join(dir, rel)), [], object_finish: &finish/2) do
      {value, [], ""} -> checked(rel, kind, value)
      _ -> {{rel, kind, :invalid}, [diag("INVALID_JSON", at(rel, []))]}
    end
  end

  defp checked(rel, kind, value) do
    case duplicates(value, []) do
      [] -> {{rel, kind, value}, []}
      dups -> {{rel, kind, :invalid}, Enum.map(dups, &diag("DUPLICATE_KEY", at(rel, &1)))}
    end
  end

  # Elixir's JSON keeps the first of repeated keys; a repeat is marked here and reported
  # by duplicates/2 with its path. JSON values are never tuples, so the mark is unambiguous.
  defp finish(pairs, old) do
    pairs = Enum.reverse(pairs)
    keys = Enum.map(pairs, &elem(&1, 0))

    case for {k, n} <- Enum.frequencies(keys), n > 1, do: k do
      [] -> {Map.new(pairs), old}
      repeated -> {{:duplicate_keys, repeated, Map.new(pairs)}, old}
    end
  end

  defp duplicates({:duplicate_keys, keys, map}, path),
    do: Enum.map(keys, &(path ++ [&1])) ++ duplicates(map, path)

  defp duplicates(map, path) when is_map(map),
    do: Enum.flat_map(map, fn {k, v} -> duplicates(v, path ++ [k]) end)

  defp duplicates(list, path) when is_list(list),
    do: list |> Enum.with_index() |> Enum.flat_map(fn {v, i} -> duplicates(v, path ++ [i]) end)

  defp duplicates(_, _), do: []

  defp classify("cartridge.json"), do: :manifest
  defp classify("facts.json"), do: :facts
  defp classify("text.json"), do: :text
  defp classify("resources.json"), do: :resources
  defp classify("attributes.json"), do: :attributes
  defp classify("layout.json"), do: :layout

  @dirs %{
    "actions" => :action,
    "rooms" => :room,
    "items" => :item,
    "npcs" => :npc,
    "barriers" => :barrier,
    "quests" => :quest,
    "reactions" => :reaction,
    "dialogues" => :dialogue,
    "scenes" => :scene,
    "skills" => :skill,
    "topics" => :topic,
    "liquids" => :liquid,
    "populations" => :population,
    "replenish" => :replenish,
    "services" => :service,
    "transports" => :transport,
    "bleeds" => :bleed,
    "statuses" => :status,
    "structures" => :structure,
    "behaviours" => :behaviour,
    "emotes" => :emote
  }

  defp classify(rel) do
    case {Path.split(rel), Path.extname(rel)} do
      {[dir, file], ".scene"} when dir in ~w(scenes dialogues) ->
        {:scene_file, {:dialogue, Path.rootname(file), []}}

      {["scenes", file], ".cut"} ->
        {:scene_file, {:scene, Path.rootname(file), []}}

      {["areas", _], ".json"} ->
        :area

      {[dir, file], ".json"} when is_map_key(@dirs, dir) ->
        {@dirs[dir], Path.rootname(file), []}

      _ ->
        :unknown
    end
  end

  @doc false
  def dirs, do: @dirs

  @doc """
  The `kind` definitions as `{key, location, value}`; a bundled one is located at `{rel, steps}`.
  `actions/` holds both `:action` (with `command`) and `:scripted_action` (without it); an unreadable
  file stays an action, so it adds no scripted action.
  """
  @spec of_kind([{String.t(), file(), term()}], atom()) :: [{String.t(), location(), term()}]
  def of_kind(files, :scripted_action), do: Enum.reject(dir(files, :action), &command?/1)
  def of_kind(files, :action), do: Enum.filter(dir(files, :action), &command?/1)
  def of_kind(files, kind), do: dir(files, kind)

  defp dir(files, kind), do: for({rel, {^kind, k, s}, v} <- files, do: {k, location(rel, s), v})
  defp command?({_, _, v}), do: not is_map(v) or is_map_key(v, "command")

  defp location(rel, []), do: rel
  defp location(rel, steps), do: {rel, steps}

  # A merge would let `steps` in the JSON replace every word of the `.cut` beside it, silently.
  defp steps_over_cut(files) do
    for {rel, {:scene, key, _} = id, _} <- files,
        String.ends_with?(rel, ".cut"),
        {json, ^id, %{"steps" => _}} <- files,
        json != rel do
      diag("SCHEMA_VIOLATION", at(json, ["steps"]), %{"why" => "cut_steps", "key" => key})
    end
  end

  # A `.cut` with no `on` would never start, and the schema cannot say so plainly.
  defp untriggered(files) do
    for {rel, {:scene, key, _}, value} <- files,
        String.ends_with?(rel, ".cut"),
        # A bad file name has its own error, and its `.json` could not help.
        key =~ ~r/^[a-z][a-z0-9_.]*$/,
        is_map(value) and not is_map_key(value, "on") do
      data = %{"why" => "cut_no_trigger", "key" => key, "line" => 1}
      diag("SCHEMA_VIOLATION", at(rel, []), data)
    end
  end

  @doc "A diagnostic (Diagnostic in protocol/cartridge.schema.json); raises on a code outside DiagnosticCode."
  @spec diag(String.t(), String.t(), map(), [String.t()]) :: map()
  def diag(code, path, data \\ %{}, suggested \\ []) do
    code in Loka.Core.Contracts.defs()["DiagnosticCode"]["enum"] or
      raise ArgumentError, "#{inspect(code)} is not a DiagnosticCode"

    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  @doc "A short reference `key` as the DefinitionRef of `m`'s `kind` definition; else unchanged."
  @spec ref(term(), String.t(), map()) :: term()
  def ref(key, kind, m) when is_binary(key),
    do: %{
      "cartridge_id" => m["id"],
      "cartridge_version" => m["version"],
      "kind" => kind,
      "key" => key
    }

  def ref(r, _, _), do: r

  @doc "A diagnostic path: the source for `rel`, then `steps`."
  @spec at(location(), steps()) :: String.t()
  def at({rel, prefix}, steps), do: at(rel, prefix ++ steps)

  def at(rel, steps) do
    stem = String.replace_suffix(rel, ".json", "")
    plain? = stem != rel and Enum.all?(String.split(stem, "/"), &name?/1)
    source = if plain?, do: stem, else: literal(rel)
    Enum.reduce(steps, source, &(&2 <> step(&1)))
  end

  defp step(i) when is_integer(i), do: "[#{i}]"
  defp step(name), do: if(name?(name), do: "." <> name, else: "[" <> literal(name) <> "]")

  defp name?(s), do: s =~ ~r/\A[a-z0-9_]+\z/

  # ponytail: a non-UTF-8 file name (possible on Linux builder hosts) fails this match and
  # crashes; render the raw name as a quoted literal or reject it with a diagnostic if needed.
  defp literal(s) do
    {:ok, text} = Canonical.encode(s)
    text
  end

  @doc """
  Diagnostics for `Loka.Core.Contracts.detailed/3` errors on `value`, which sits at `steps`
  of `rel`: unknown_property is UNKNOWN_FIELD with the valid names, any other code
  SCHEMA_VIOLATION (invalid_type with the expected type and an object's fields, not_in_enum with
  the allowed values).
  """
  @spec schema(location(), steps(), term(), [map()]) :: [map()]
  def schema(rel, steps, value, errors) do
    for %{path: pointer, code: code} = e <- errors do
      path = at(rel, steps ++ pointer_steps(value, pointer))

      case e do
        %{allowed: allowed} -> diag("UNKNOWN_FIELD", path, %{"valid" => Enum.join(allowed, ", ")})
        _ -> diag("SCHEMA_VIOLATION", path, Map.put(e[:hint] || %{}, "error", "#{code}"))
      end
    end
  end

  # A JSON pointer segment is an array index exactly where the value there is a list.
  defp pointer_steps(value, pointer) do
    pointer
    |> String.split("/")
    |> tl()
    |> Enum.map_reduce(value, fn seg, v ->
      seg = seg |> String.replace("~1", "/") |> String.replace("~0", "~")

      if is_list(v),
        do: {String.to_integer(seg), Enum.at(v, String.to_integer(seg))},
        else: {seg, is_map(v) && v[seg]}
    end)
    |> elem(0)
  end

  # Source only (Dialogues.points/2 derives CompiledCartridge.story_points and strips it).
  @choice_point %{
    "description" =>
      "<story point>/<outcome>: the story point outcome this choice reaches; one choice per outcome.",
    "type" => "string",
    "pattern" => "^[a-z][a-z0-9_]{0,63}/[a-z][a-z0-9_]{0,63}$"
  }

  # In source a DefinitionRef may also be short: the Key of this cartridge's definition.
  def contracts do
    defs = Loka.Core.Contracts.defs()

    defs
    |> Map.update!("DefinitionRef", &%{"anyOf" => [%{"$ref" => "Key"}, &1]})
    |> put_in(["DialogueChoice", "properties", "story_point"], @choice_point)
    |> schedule(defs)
    |> Map.update!(
      "LiquidRow",
      &put_in(&1, ["properties", "kind", "anyOf"], [
        %{"type" => "null"},
        %{"$ref" => "Key"},
        defs["DefinitionRef"]
      ])
    )
  end

  # Toolbox row W10: a daily_schedule hour may be [case, ..., room key], or (row W26) one walking
  # case {room, walks: true, goal?}; schedule_cases is compiler output only (Loka.Content.Schedules).
  # A malformed map hour reports the errors of the closer of the two (Loka.Core.Contracts anyOf).
  defp schedule(contracts, defs) do
    one = defs["ScheduleCases"]["items"]

    hour = [
      %{"$ref" => "Key"},
      %{
        one
        | "properties" => Map.delete(one["properties"], "when"),
          "required" => ~w(room walks)
      },
      defs["DefinitionRef"],
      %{
        "type" => "array",
        "items" => %{"anyOf" => [%{"$ref" => "Key"}, one]},
        "minItems" => 2,
        "maxItems" => 9
      }
    ]

    contracts
    |> put_in(["NpcDefinition", "properties", "daily_schedule", "additionalProperties"], %{
      "anyOf" => hour
    })
    |> update_in(["NpcDefinition", "properties"], &Map.delete(&1, "schedule_cases"))
  end
end
