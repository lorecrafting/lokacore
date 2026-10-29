defmodule Loka.Content.ChoiceChecks do
  @moduledoc """
  Toolbox row 14: a dialogue choice's opposed check (dialogue.schema.json DialogueCheck). A checked choice needs
  check@1 (its check_passed); its key is no recipe's or other choice's check's
  (DUPLICATE_DEFINITION); its skill, attribute and failure text resolve; it names exactly one of
  rating and npc (SCHEMA_VIOLATION invalid_value), its npc as a recipe check's (row G3); and it
  carries only label, narration, sequence, availability and check, in a dialogue with no quest and
  no riddle, with no skill.acquire step (OUTCOME_MISMATCH at the check).
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [owned: 3, reference: 6]

  @plain ~w(label narration sequence availability check)

  @doc "The diagnostics of choice `o` (at `steps` of dialogue `d` in `rel`)."
  def choice(rel, steps, %{"check" => c} = o, d, ctx) do
    at = steps ++ ["check"]
    side = if is_map_key(c, "skill"), do: "skill", else: "attribute"

    owned(at(rel, at), "check_passed", ctx.events) ++
      reference(rel, at, side, c, ctx.m, ctx.defs) ++
      failure_text(rel, at, c["failure"], ctx.text) ++
      rated(rel, at, c, ctx) ++
      plain(rel, at, o, d) ++
      if(c["key"] in Loka.Content.Recipes.shared_checks(ctx.defs),
        do: [diag("DUPLICATE_DEFINITION", at(rel, at))],
        else: []
      )
  end

  def choice(_, _, _, _, _), do: []

  defp failure_text(_, _, _, :unknown), do: []

  defp failure_text(rel, at, key, text) do
    if is_map_key(text, key),
      do: [],
      else: [diag("UNRESOLVED_REFERENCE", at(rel, at ++ ["failure"]), %{"target" => key})]
  end

  defp rated(rel, at, c, ctx) do
    case {is_map_key(c, "rating"), is_map_key(c, "npc")} do
      {false, true} -> Loka.Content.Recipes.rater(rel, at, c, ctx.m, ctx.defs)
      {true, false} -> []
      _ -> [diag("SCHEMA_VIOLATION", at(rel, at), %{"error" => "invalid_value"})]
    end
  end

  defp plain(rel, at, o, d) do
    sound =
      d["quest"] == nil and d["riddle"] == nil and Enum.all?(Map.keys(o), &(&1 in @plain)) and
        not Enum.any?(Map.get(o, "sequence", []), &(&1["op"] == "skill.acquire"))

    if sound, do: [], else: [diag("OUTCOME_MISMATCH", at(rel, at))]
  end
end
