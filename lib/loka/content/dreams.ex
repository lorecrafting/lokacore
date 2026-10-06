defmodule Loka.Content.Dreams do
  @moduledoc "Validates the consumed Rest-anchored presentation-only dream and its sole consequence."
  import Loka.Content.Source, only: [diag: 2, at: 2, ref: 3]
  alias Loka.Content.Refs

  def expand(r, m) do
    Enum.reduce(~w(room entitlement credit quest), r, fn field, value ->
      Map.update!(
        value,
        field,
        &ref(&1, if(field in ~w(entitlement credit), do: "fact", else: field), m)
      )
    end)
  end

  def check({rel, steps, s}, ctx) do
    path = steps ++ ["on", "rest"]
    r = s["on"]["rest"]

    references(rel, path, r, ctx) ++
      capabilities(ctx.m) ++
      binding(rel, path, r, ctx) ++
      graph(rel, steps, s, ctx.text) ++
      ending(rel, steps, s, ctx) ++ ownership(rel, steps, s, ctx)
  end

  defp references(rel, path, r, ctx) do
    for field <- ~w(room entitlement credit quest),
        kind = if(field in ~w(entitlement credit), do: "fact", else: field),
        d <- Refs.reference(rel, path, {field, kind}, r, ctx.m, ctx.defs),
        do: d
  end

  defp capabilities(m) do
    caps = m["requires"]["capabilities"]

    missing =
      for cap <- ~w(position scene quest dialogue reaction fact resource death service),
          caps[cap] != 1,
          do: bad("cartridge.requires.capabilities.#{cap}")

    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    missing ++
      if(api < [1, 24],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []
      )
  end

  defp binding(rel, path, r, ctx) do
    room = resolved(r["room"], "room", ctx)
    bed = get_in(room, ["details", r["detail"], "bed"])
    paid = boolean?(r["entitlement"], ctx)
    credit = boolean?(r["credit"], ctx)

    producer =
      Enum.any?(ctx.defs["service"], fn
        {_, {_, _, %{"benefit" => %{"kind" => "entitlement", "fact" => f}}}} ->
          f == r["entitlement"]

        _ ->
          false
      end)

    if bed && bed["entitlement"] == r["entitlement"] && paid && credit && producer &&
         r["entitlement"] != r["credit"], do: [], else: [bad(at(rel, path))]
  end

  defp graph(rel, steps, s, text) do
    want = ~w(narrate narrate narrate choice branch await_ack end)

    order =
      if Enum.map(s["steps"], & &1["type"]) == want,
        do: [],
        else: [bad(at(rel, steps ++ ["steps"]))]

    order ++
      texts(rel, steps, s, ~w(title description), text) ++
      Enum.flat_map(Enum.with_index(s["steps"]), fn {line, i} ->
        line(rel, steps ++ ["steps", i], line, text)
      end)
  end

  defp line(rel, path, %{"type" => "narrate"} = s, text), do: texts(rel, path, s, ["text"], text)

  defp line(rel, path, %{"type" => "choice"} = s, text) do
    keys = Enum.map(s["choices"], & &1["choice_id"])

    duplicates =
      if length(Enum.uniq(keys)) == 2, do: [], else: [bad(at(rel, path ++ ["choices"]))]

    duplicates ++
      texts(rel, path, s, ["prompt"], text) ++
      Enum.flat_map(Enum.with_index(s["choices"]), fn {option, i} ->
        texts(rel, path ++ ["choices", i], option, ~w(label text), text)
      end)
  end

  defp line(_, _, _, _), do: []

  defp ending(rel, steps, s, ctx) do
    r = s["on"]["rest"]
    e = s["on_end"]
    refs = Refs.reference(rel, steps ++ ["on_end"], "quest", e, ctx.m, ctx.defs)

    binding =
      if e["quest"] == r["quest"] && length(e["assign"]) == 1,
        do: [],
        else: [bad(at(rel, steps ++ ["on_end"]))]

    refs ++ binding ++ assignments(rel, steps, s, ctx) ++ objective(rel, steps, s, ctx)
  end

  defp assignments(rel, steps, s, ctx) do
    Enum.flat_map(Enum.with_index(s["on_end"]["assign"]), fn {a, i} ->
      path = steps ++ ["on_end", "assign", i]

      Refs.reference(rel, path, "fact", a, ctx.m, ctx.defs) ++
        assignment(rel, path, a, s["on"]["rest"], ctx)
    end)
  end

  defp assignment(rel, path, a, r, ctx) do
    if boolean?(a["fact"], ctx) && a["value"] == true &&
         a["fact"] not in [r["credit"], r["entitlement"]], do: [], else: [bad(at(rel, path))]
  end

  defp objective(rel, steps, s, ctx) do
    q = resolved(s["on"]["rest"]["quest"], "quest", ctx)
    memory = get_in(Enum.at(s["on_end"]["assign"], 0), ["fact"])

    expected = %{
      "evidence" => "current_state",
      "policy" => %{
        "policy_version" => 1,
        "root" => %{"op" => "fact_compare", "fact" => memory, "equals" => true}
      }
    }

    valid =
      q["objective"] == expected &&
        !Enum.any?(~w(offer repeatable deadline exchange patrol), &q[&1])

    if valid, do: [], else: [bad(at(rel, steps ++ ["on", "rest", "quest"]))]
  end

  defp ownership(rel, steps, s, ctx) do
    invalid = duplicate_owner?(s, ctx.defs) || stolen_quest?(s["on"]["rest"]["quest"], ctx.defs)
    if invalid, do: [bad(at(rel, steps ++ ["on", "rest"]))], else: []
  end

  defp duplicate_owner?(s, defs) do
    reserved = owned(s)

    Enum.any?(defs["scene"], fn
      {_, {_, _, %{"control" => "presentation_only"} = other}} when other != s ->
        Enum.any?(reserved, &(&1 in owned(other)))

      _ ->
        false
    end)
  end

  defp owned(s),
    do: [
      s["on"]["rest"]["credit"],
      s["on"]["rest"]["quest"] | Enum.map(s["on_end"]["assign"], & &1["fact"])
    ]

  defp stolen_quest?(quest, defs) do
    dialogue =
      Enum.any?(defs["dialogue"], fn
        {_, {_, _, d}} ->
          d["quest"] == quest || Enum.any?(d["choices"], fn {_, o} -> o["accept"] == quest end)

        _ ->
          false
      end)

    reaction =
      Enum.any?(defs["reaction"], fn
        {_, {_, _, r}} -> Enum.any?(r["apply"], &(&1["quest"] == quest))
        _ -> false
      end)

    dialogue || reaction
  end

  defp boolean?(r, ctx) do
    f = resolved(r, "fact", ctx)
    f["scopes"] == ["player"] && f["value_type"] == %{"type" => "bool", "default" => false}
  end

  defp resolved(r, kind, ctx) do
    case Refs.resolve(r, kind, ctx.m, ctx.defs) do
      {_, _, d} -> d
      _ -> %{}
    end
  end

  defp texts(_, _, _, _, :unknown), do: []

  defp texts(rel, steps, s, fields, text),
    do:
      for(
        field <- fields,
        !is_map_key(text, s[field]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps ++ [field]))
      )

  defp bad(path), do: diag("OUTCOME_MISMATCH", path)
end
