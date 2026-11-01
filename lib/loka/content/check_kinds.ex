defmodule Loka.Content.CheckKinds do
  @moduledoc """
  The one check vocabulary (step.schema.json Check; C3 D8, loka-ivjq.4): which kinds and fields a
  context runs (`context/4`: a dialogue choice runs only opposed and needs failure; a scripted
  action refuses failure and rating), check key uniqueness across both (`shared_checks/1`), and
  each context's references.

  Toolbox row 14: a dialogue choice's opposed check (step.schema.json Check). A checked choice needs
  check@1 (its check_passed); its key is no scripted action's or other choice's check's
  (DUPLICATE_DEFINITION); its skill, attribute and failure text resolve; it names exactly one of
  rating and npc (SCHEMA_VIOLATION invalid_value), its npc as a scripted action check's (row G3); and it
  carries only label, narration, steps, availability and check, in a dialogue with no quest and
  no riddle, with no skill.acquire step (OUTCOME_MISMATCH at the check).
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [owned: 3, reference: 6, resolve: 4]

  @plain ~w(label narration narration_variants asked_when steps availability check policy then then_failed)

  @doc "The diagnostics of choice `o` (at `steps` of dialogue `d` in `rel`)."
  def choice(rel, steps, %{"check" => c} = o, d, ctx) do
    at = steps ++ ["check"]
    side = if is_map_key(c, "skill"), do: "skill", else: "attribute"

    # A kind the choice does not run has only context/4's diagnostic.
    owned(at(rel, at), "check_passed", ctx.events) ++
      context(rel, at, c, :choice) ++
      failure_text(rel, at, c["failure"], ctx.text) ++
      if(c["kind"] == "opposed",
        do: reference(rel, at, side, c, ctx.m, ctx.defs) ++ rated(rel, at, c, ctx),
        else: []
      ) ++
      plain(rel, at, o, d) ++
      if(c["key"] in shared_checks(ctx.defs),
        do: [diag("DUPLICATE_DEFINITION", at(rel, at))],
        else: []
      )
  end

  def choice(_, _, _, _, _), do: []

  @doc """
  A check's kind and fields outside what `context` (:choice or :action) runs: SCHEMA_VIOLATION
  invalid_value at the kind or the field, or at the missing failure of a choice.
  """
  def context(rel, path, c, :choice) do
    if c["kind"] == "opposed",
      do: if(is_map_key(c, "failure"), do: [], else: [invalid(rel, path ++ ["failure"])]),
      else: [invalid(rel, path ++ ["kind"])]
  end

  def context(rel, path, c, :action),
    do: for(f <- ~w(failure rating), is_map_key(c, f), do: invalid(rel, path ++ [f]))

  defp invalid(rel, path),
    do: diag("SCHEMA_VIOLATION", at(rel, path), %{"error" => "invalid_value"})

  # An inline check's key is its check definition's key: no two checks (a scripted action's or a dialogue
  # choice's, row 14) may share one.
  @doc "The check keys (each scripted action's and each dialogue choice's, row 14) more than one check has."
  def shared_checks(defs) do
    choices =
      for {_, {_, [], d}} <- defs["dialogue"] || %{},
          {_, %{"check" => %{"key" => k}}} <- d["choices"],
          do: k

    checks =
      for(
        {_, {_, [], r}} <- defs["scripted_action"],
        is_map_key(r, "check"),
        do: r["check"]["key"]
      ) ++ choices

    for {k, n} <- Enum.frequencies(checks), n > 1, into: MapSet.new(), do: k
  end

  # Toolbox row G3: an opposed check naming an NPC needs no rating; the NPC is an instance of this
  # cartridge that declares the check's attribute.
  defp opposed(rel, %{"check" => %{"npc" => _} = c}, m, defs),
    do: reference(rel, ["check"], "attribute", c, m, defs) ++ rater(rel, ["check"], c, m, defs)

  # Toolbox rows 5 and G5: an opposed check names a skill or attribute of this cartridge and its
  # target detail declares a rating.
  defp opposed(rel, %{"check" => c, "target" => t}, m, defs) do
    side = if is_map_key(c, "skill"), do: "skill", else: "attribute"

    reference(rel, ["check"], side, c, m, defs) ++
      if rated?(t, m, defs),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at(rel, ["check"]), %{"error" => "invalid_value"})]
  end

  @doc "Row G3: an opposed check's npc (at `steps`) is an NPC instance declaring its attribute."
  def rater(rel, steps, %{"npc" => n} = c, m, defs) do
    case resolve(n, "npc", m, defs) do
      {_, _, npc} ->
        if npc["spawn_template"] ||
             !Enum.any?(npc["attributes"] || [], &(&1["attribute"] == c["attribute"])),
           do: [
             diag("SCHEMA_VIOLATION", at(rel, steps ++ ["npc"]), %{"error" => "invalid_value"})
           ],
           else: []

      _ ->
        reference(rel, steps, "npc", c, m, defs)
    end
  end

  # An unresolved room or detail is the target's own diagnostic; a use or spell target
  # (rows G4, 29a) has no detail and so no rating.
  defp rated?(%{"kind" => kind}, _, _) when kind in ~w(use spell), do: false

  defp rated?(t, m, defs) do
    case resolve(t["room"], "room", m, defs) do
      {_, _, room} ->
        detail = (room["details"] || %{})[t["detail"]]
        detail == nil or is_map_key(detail, "rating")

      _ ->
        true
    end
  end

  @doc "A scripted action check's attribute or opposed side resolves (rows 5, G3, G5)."
  def attributes(rel, %{"check" => %{"kind" => "attribute_threshold"} = c}, m, defs),
    do: reference(rel, ["check"], "attribute", c, m, defs)

  def attributes(rel, %{"check" => %{"kind" => "opposed"}} = r, m, defs),
    do: opposed(rel, r, m, defs)

  def attributes(_, _, _, _), do: []

  defp failure_text(_, _, _, :unknown), do: []
  # A missing failure is context/4's diagnostic.
  defp failure_text(_, _, nil, _), do: []

  defp failure_text(rel, at, key, text) do
    if is_map_key(text, key),
      do: [],
      else: [diag("UNRESOLVED_REFERENCE", at(rel, at ++ ["failure"]), %{"target" => key})]
  end

  defp rated(rel, at, c, ctx) do
    case {is_map_key(c, "rating"), is_map_key(c, "npc")} do
      {false, true} -> rater(rel, at, c, ctx.m, ctx.defs)
      {true, false} -> []
      _ -> [diag("SCHEMA_VIOLATION", at(rel, at), %{"error" => "invalid_value"})]
    end
  end

  defp plain(rel, at, o, d) do
    sound =
      d["quest"] == nil and d["riddle"] == nil and Enum.all?(Map.keys(o), &(&1 in @plain)) and
        not Enum.any?(Map.get(o, "steps", []), &(&1["op"] == "skill.acquire"))

    if sound, do: [], else: [diag("OUTCOME_MISMATCH", at(rel, at))]
  end
end
