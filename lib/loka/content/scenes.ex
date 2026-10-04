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
      Enum.reduce(defs["scene"], {facts, []}, &fact/2)
    else
      {facts, []}
    end
  end

  def facts(facts, _, _), do: {facts, []}

  defp fact({key, scene}, {facts, ds}) do
    name = "scene_" <> key
    authored = for {rel, steps, _} <- [facts[name]], do: diag("RESERVED_FACT", at(rel, steps))

    value =
      case scene do
        {_, _, s} ->
          {"cartridge.json", [], spec(key, Enum.count(s["steps"], &(&1["type"] == "narrate")))}

        :invalid ->
          :invalid
      end

    {Map.put(facts, name, value), ds ++ authored}
  end

  defp spec(key, n),
    do: %{
      "key" => "scene_" <> key,
      "version" => 1,
      "value_type" => %{"type" => "int", "minimum" => -1, "maximum" => n, "default" => 0},
      "scopes" => ["player"],
      "meaning" =>
        "Scene #{key}'s line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it."
    }

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

  defp scene({rel, steps, s}, ctx) do
    owned(at(rel, steps), "scene", ctx.required) ++
      order(rel, steps, s) ++
      refs(rel, steps, s, ctx.m, ctx.defs) ++ texts(rel, steps, s, ctx.text)
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
    reference(rel, steps ++ ["on"], "story_point", s["on"], m, defs) ++
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
