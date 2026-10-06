# size: allow 320, action-started scenes validate source and end exports beside modal rules
defmodule Loka.Content.Scenes do
  @moduledoc """
  scene@1's modal ordered subset, trigger/text references and compiler-added facts
  (mechanics.md scene@1; cartridge.md Compiler). Twin of cartridge_scenes.ts.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [owners: 2, owned: 3, reference: 6, resolve: 4]

  @doc "Adds the byte-exact scene facts; content cannot author them."
  @spec facts(map() | :unknown, map() | nil, map()) :: {map() | :unknown, [map()]}
  def facts(facts, m, defs) when is_map(facts) and m != nil do
    if is_map_key(m["requires"]["capabilities"], "scene") do
      {facts, ds} = Enum.reduce(defs["scene"], {facts, []}, &fact/2)

      Enum.reduce(defs["story_point"], {facts, ds}, &point_marker/2)
    else
      {facts, []}
    end
  end

  def facts(facts, _, _), do: {facts, []}

  defp point_marker({key, {_, _, %{"outcomes" => outcomes}}}, acc) do
    if Enum.any?(outcomes, fn {_, t} -> is_map_key(t, "scene") end),
      do: marker(key, outcomes, acc),
      else: acc
  end

  defp point_marker(_, acc), do: acc

  defp fact({key, scene}, {facts, ds}) do
    name = "scene_" <> key
    authored = for {rel, steps, _} <- [facts[name]], do: diag("RESERVED_FACT", at(rel, steps))

    value =
      case scene do
        {_, _, s} ->
          {"cartridge.json", [], spec(key, count(s))}

        :invalid ->
          :invalid
      end

    {Map.put(facts, name, value), ds ++ authored}
  end

  defp count(%{"control" => "presentation_only", "steps" => steps}), do: length(steps) - 2
  defp count(s), do: Enum.count(s["steps"], &(&1["type"] == "narrate"))

  defp spec(key, n),
    do: %{
      "key" => "scene_" <> key,
      "version" => 1,
      "value_type" => %{"type" => "int", "minimum" => -1, "maximum" => n, "default" => 0},
      "scopes" => ["player"],
      "meaning" =>
        "Scene #{key}'s line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it."
    }

  defp marker(key, outcomes, {facts, ds}) do
    name = "story_point_" <> key
    authored = for {rel, steps, _} <- [facts[name]], do: diag("RESERVED_FACT", at(rel, steps))

    value = %{
      "key" => name,
      "version" => 1,
      "value_type" => %{
        "type" => "enum",
        "values" => ["unreached" | Enum.sort(Map.keys(outcomes))],
        "default" => "unreached"
      },
      "scopes" => ["player"],
      "meaning" => "Story point #{key}'s reached outcome (scene@1): only scene@1 writes it."
    }

    {Map.put(facts, name, {"cartridge.json", [], value}), ds ++ authored}
  end

  @doc "Adds fact@1 for scene@1, after authored requirements have been validated."
  @spec requires(map()) :: map()
  def requires(m) do
    if is_map_key(m["requires"]["capabilities"], "scene"),
      do: update_in(m, ["requires", "capabilities"], &Map.put(&1, "fact", 1)),
      else: m
  end

  @doc "Schema-valid scene definitions have ordered steps and one resolved, unique trigger."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    scenes = for {_, {rel, steps, s}} <- defs["scene"], do: {rel, steps, s}
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    ctx = %{m: m, defs: defs, text: text, required: required}
    Enum.flat_map(scenes, &scene(&1, ctx)) ++ duplicates(scenes)
  end

  defp scene({_, _, %{"control" => "presentation_only"}} = s, ctx),
    do: Loka.Content.Dreams.check(s, ctx)

  defp scene({rel, steps, s}, ctx) do
    owned(at(rel, steps), "scene", ctx.required) ++
      api(s, ctx.m) ++
      order(rel, steps, s) ++
      refs(rel, steps, s, ctx.m, ctx.defs) ++ texts(rel, steps, s, ctx.text)
  end

  defp api(s, m) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    needed =
      if is_map_key(s["on"], "action") or is_map_key(s, "on_end"), do: [1, 15], else: [1, 12]

    if (is_map_key(s["on"], "quest") or needed == [1, 15]) and version < needed,
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp order(rel, steps, s) do
    count = s["steps"] |> Enum.take_while(&(&1["type"] == "narrate")) |> length()
    want = List.duplicate("narrate", max(1, count)) ++ ~w(await_ack end)

    i =
      Enum.find_index(Enum.with_index(want), fn {t, i} ->
        get_in(Enum.at(s["steps"], i), ["type"]) != t
      end)

    if i != nil or length(s["steps"]) != length(want),
      do: [
        diag("SCHEMA_VIOLATION", at(rel, steps ++ ["steps", i || length(want), "type"]), %{
          "error" => "not_in_enum"
        })
      ],
      else: []
  end

  defp refs(rel, steps, s, m, defs) do
    kind = trigger_kind(s["on"])

    shape =
      if valid_source?(s["on"], kind),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at(rel, steps ++ ["on"]))]

    shape ++
      if(shape == [], do: start_ref(rel, steps, s["on"], kind, m, defs), else: []) ++
      outcome(rel, steps, s, kind, m, defs) ++ end_refs(rel, steps, s, m, defs)
  end

  defp trigger_kind(on) do
    cond do
      is_map_key(on, "action") -> "action"
      is_map_key(on, "quest") -> "quest"
      true -> "story_point"
    end
  end

  defp valid_source?(on, kind) do
    Enum.count(~w(action quest story_point), &is_map_key(on, &1)) == 1 and
      is_map_key(on, "outcome") and
      (kind != "action" or
         (is_map_key(on, "room") and is_map_key(on, "detail") and on["outcome"] == "success"))
  end

  defp start_ref(rel, steps, on, "action", m, defs) do
    action = resolve(on["action"], "recipe", m, defs)
    room = resolve(on["room"], "room", m, defs)

    unresolved = fn field ->
      diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["on", field]), %{"target" => on[field]})
    end

    if(action == :unresolved, do: [unresolved.("action")], else: []) ++
      if(room == :unresolved, do: [unresolved.("room")], else: []) ++
      start_match(rel, steps, on, action, room)
  end

  defp start_ref(rel, steps, on, kind, m, defs),
    do: reference(rel, steps ++ ["on"], kind, on, m, defs)

  defp start_match(rel, steps, on, {_, _, recipe}, {_, _, room}) do
    target = recipe["target"]

    if target["room"] == on["room"] and target["detail"] == on["detail"] and
         is_map_key(Map.get(room, "details", %{}), on["detail"]),
       do: [],
       else: [diag("OUTCOME_MISMATCH", at(rel, steps ++ ["on"]))]
  end

  defp start_match(_, _, _, _, _), do: []

  defp end_refs(_, _, %{"on_end" => nil}, _, _), do: []
  defp end_refs(_, _, s, _, _) when not is_map_key(s, "on_end"), do: []

  defp end_refs(rel, steps, s, m, defs) do
    ended = s["on_end"]
    assigns = ended["assign"]
    names = Enum.map(assigns, & &1["fact"])

    duplicate =
      if length(Enum.uniq(names)) == length(names),
        do: [],
        else: [diag("DUPLICATE_DEFINITION", at(rel, steps ++ ["on_end", "assign"]))]

    duplicate ++ end_assigns(rel, steps, assigns, m, defs) ++ end_point(rel, steps, s, m, defs)
  end

  defp end_assigns(rel, steps, assigns, m, defs) do
    Enum.flat_map(Enum.with_index(assigns), fn {a, i} ->
      path = steps ++ ["on_end", "assign", i]
      reference(rel, path, "fact", a, m, defs) ++ end_scope(rel, path, a, m, defs)
    end)
  end

  defp end_scope(rel, path, a, m, defs) do
    case resolve(a["fact"], "fact", m, defs) do
      {_, _, f} ->
        if f["scopes"] != ["player"] or String.starts_with?(f["key"], "scene_") or
             String.starts_with?(f["key"], "story_point_"),
           do: [diag("RESERVED_FACT", at(rel, path ++ ["fact"]))],
           else: []

      _ ->
        []
    end
  end

  defp end_point(rel, steps, s, m, defs) do
    ended = s["on_end"]
    path = steps ++ ["on_end"]

    case resolve(ended["story_point"], "story_point", m, defs) do
      :unresolved ->
        [
          diag("UNRESOLVED_REFERENCE", at(rel, path ++ ["story_point"]), %{
            "target" => ended["story_point"]
          })
        ]

      {_, _, p} ->
        if get_in(p, ["outcomes", ended["outcome"]]) == %{"scene" => rel_ref(m, s["key"])},
          do: [],
          else: [diag("OUTCOME_MISMATCH", at(rel, path ++ ["outcome"]))]

      _ ->
        []
    end
  end

  defp rel_ref(m, key),
    do: %{
      "cartridge_id" => m["id"],
      "cartridge_version" => m["version"],
      "kind" => "scene",
      "key" => key
    }

  defp outcome(rel, steps, s, "story_point", m, defs) do
    case resolve(s["on"]["story_point"], "story_point", m, defs) do
      {_, _, p} ->
        if is_map_key(p["outcomes"], s["on"]["outcome"]),
          do: [],
          else: [
            diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["on", "outcome"]), %{
              "target" => s["on"]["outcome"]
            })
          ]

      _ ->
        []
    end
  end

  defp outcome(_, _, _, _, _, _), do: []

  defp texts(_, _, _, :unknown), do: []

  defp texts(rel, steps, s, text),
    do:
      for(
        {line, i} <- Enum.with_index(s["steps"]),
        line["type"] == "narrate",
        not is_map_key(text, line["text"]),
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["steps", i, "text"]), %{
            "target" => line["text"]
          })
      )

  defp duplicates(scenes) do
    scenes
    |> Enum.group_by(fn {_, _, s} -> s["on"] end)
    |> Enum.flat_map(fn {_, sites} -> colliding(sites) end)
  end

  defp colliding([_]), do: []

  defp colliding(sites),
    do:
      Enum.map(sites, fn {rel, steps, _} ->
        diag("DUPLICATE_DEFINITION", at(rel, steps ++ ["on"]))
      end)
end
