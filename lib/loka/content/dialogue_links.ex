defmodule Loka.Content.DialogueLinks do
  @moduledoc "A dialogue choice's policy and narration variants as roots, and its then and then_failed checks."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [resolve: 4]

  @doc "A dialogue's own, choice and narration variant conditions, as `{rel, steps, root}`."
  @spec conditions({String.t(), map()}) :: [{String.t(), list(), map()}]
  def conditions({rel, d}) do
    choices =
      for {c, o} <- d["choices"],
          {path, root} <- [{["policy"], o["policy"]} | variants(o)],
          root,
          do: {rel, ["choices", c | path], root}

    [{rel, ["policy"], d["policy"]} | choices]
  end

  defp variants(o) do
    for {v, i} <- Enum.with_index(Map.get(o, "narration_variants", [])),
        do: {["narration_variants", i, "when"], v["when"]}
  end

  @doc "A choice's narration variant words, as `{steps, key}`."
  @spec variant_texts(list(), map()) :: [{list(), String.t()}]
  def variant_texts(steps, o) do
    for {v, i} <- Enum.with_index(Map.get(o, "narration_variants", [])),
        do: {steps ++ ["narration_variants", i, "description"], v["description"]}
  end

  # A choice's then and then_failed: a dialogue, or `end`. A patrol leg or a quest's or riddle's
  # end closes the conversation, a keyword dialogue is reached by its word, and then_failed needs
  # a check that can fail. A target whose speaker stands elsewhere is allowed (a warning): its
  # options read not_present until the actor is there.
  @spec choice(String.t(), list(), map(), map(), map()) :: [map()]
  def choice(rel, steps, o, d, ctx) do
    orphan =
      if is_map_key(o, "then_failed") and not is_map_key(o, "check"),
        do: [diag("OUTCOME_MISMATCH", at(rel, steps ++ ["then_failed"]))],
        else: []

    orphan ++
      for(
        field <- ~w(then then_failed),
        is_map_key(o, field),
        e <- link(rel, steps ++ [field], o[field], o, d, ctx),
        do: e
      )
  end

  defp link(rel, path, target, o, d, ctx) do
    found = Enum.find(for({_, {_, [], t}} <- ctx.defs["dialogue"], do: t), &(&1["key"] == target))

    case {target, found} do
      {"end", nil} ->
        []

      {"end", _} ->
        [diag("OUTCOME_MISMATCH", at(rel, path))]

      {_, nil} ->
        [diag("UNRESOLVED_REFERENCE", at(rel, path), %{"target" => target})]

      {_, t} ->
        if is_map_key(t, "keyword") or Enum.any?([o["patrol"], d["quest"], d["riddle"]]),
          do: [diag("OUTCOME_MISMATCH", at(rel, path))],
          else: elsewhere(rel, path, t, d, ctx)
    end
  end

  defp elsewhere(rel, path, t, d, ctx) do
    with {_, _, from} <- resolve(d["npc"], "npc", ctx.m, ctx.defs),
         {_, _, to} <- resolve(t["npc"], "npc", ctx.m, ctx.defs),
         true <- from["room"] != to["room"] do
      [diag("OUTCOME_MISMATCH", at(rel, path)) |> Map.put("severity", "warning")]
    else
      _ -> []
    end
  end
end
