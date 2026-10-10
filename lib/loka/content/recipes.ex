defmodule Loka.Content.Recipes do
  @moduledoc """
  Action recipes and rooms' action contributions (action.schema.json ActionRecipe,
  ActionContribution; 06 §19-§20; 05 §28). A recipe's policy tree is checked with every other
  (`Loka.Content.Checks`); this module checks the rest, given a valid manifest.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6, resolve: 4]
  alias Loka.Content.RecipeTips

  # A step uses its op through the event it produces, a check through check@1's events.
  @step_event %{"fact.assign" => "fact_changed", "event.emit" => "custom_event"}

  @doc "Each schema-valid recipe's policy root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, r} <- all(defs), do: {rel, ["policy", "root"], r["policy"]["root"]})

  defp all(defs), do: for({_, {rel, [], r}} <- defs["recipe"], do: {rel, r})

  @doc """
  For a v2 source with a valid manifest (else none): each recipe's owner (action_recipe), its
  check's (check@1, by its events) and each step's of any outcome (by its event; a
  resource.adjust has none, like a cost: resource@1 comes with the default pools) is required;
  its costs, threshold check and resource.adjust steps name resources of this cartridge; it
  has a failure outcome exactly when it has a check (OUTCOME_MISMATCH); its target names a room
  of this cartridge and a detail of that room, each fact.assign a fact with a value of its type,
  each narration participant but the actor an npc or item of this cartridge, as its role says,
  its check's key is no other recipe's check's (DUPLICATE_DEFINITION),
  and its label and narrations have catalog entries (unless `text` is `:unknown`); no recipe's
  key is an action's or a
  registered command's (DUPLICATE_DEFINITION: one key is one ActionSet identity); and each key of a room's action
  contribution names a registered command, an action, a recipe or a quest (its offer).
  """
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    actions = for {_, {_, [], a}} <- defs["action"], into: MapSet.new(), do: a["key"]

    ctx = %{
      m: m,
      defs: defs,
      text: text,
      registry: registry,
      actions: actions,
      shared: shared(defs)
    }

    Enum.flat_map(all(defs), &recipe(&1, ctx)) ++ contributions(defs, actions)
  end

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

  defp reserved?(key, m),
    do: key in commands() and (key not in ~w(where knock) or api(m) >= [1, 37])

  defp duplicate(rel, r, ctx) do
    taken = r["key"] in ctx.actions or reserved?(r["key"], ctx.m)
    if taken, do: [diag("DUPLICATE_DEFINITION", at(rel, []))], else: []
  end

  defp recipe({rel, r}, ctx) do
    Enum.concat([
      owners(rel, r, ctx),
      refs(rel, r, ctx),
      texts(rel, r, ctx),
      duplicate(rel, r, ctx),
      mismatch(rel, r),
      duration(rel, r, ctx),
      RecipeTips.check(rel, r, ctx, api(ctx.m) < [1, 46]),
      shared(rel, r, ctx.shared)
    ])
  end

  defp duration(rel, r, %{m: m}) do
    if m["time_policy"] != nil and r["duration"] != nil,
      do: [diag("INVALID_TIME_POLICY", at(rel, ["duration"]))],
      else: []
  end

  # An inline check's key is its check definition's key: no two checks (a recipe's or a dialogue
  # choice's, row 14) may share one.
  defp shared(defs) do
    checks = for({_, r} <- all(defs), is_map_key(r, "check"), do: r["check"]["key"])
    Loka.Content.ChoiceChecks.duplicates(checks, defs)
  end

  defp shared(rel, %{"check" => %{"key" => k}}, shared) do
    if k in shared, do: [diag("DUPLICATE_DEFINITION", at(rel, ["check"]))], else: []
  end

  defp shared(_, _, _), do: []

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

  # An unresolved room or detail is the target's own diagnostic.
  defp rated?(t, m, defs) do
    case resolve(t["room"], "room", m, defs) do
      {_, _, room} ->
        detail = (room["details"] || %{})[t["detail"]]
        detail == nil or is_map_key(detail, "rating")

      _ ->
        true
    end
  end

  defp mismatch(rel, r) do
    if is_map_key(r, "check") == is_map_key(r["outcomes"], "failure"),
      do: [],
      else: [diag("OUTCOME_MISMATCH", at(rel, ["outcomes"]))]
  end

  # Each step of each outcome, with its path.
  defp steps(r) do
    for {name, o} <- r["outcomes"],
        {s, i} <- Enum.with_index(o["sequence"]),
        do: {s, ["outcomes", name, "sequence", i]}
  end

  defp owners(rel, r, %{m: m, registry: registry}) do
    caps = m["requires"]["capabilities"]
    events = {caps, owners(registry, ["events"])}

    check =
      if is_map_key(r, "check"), do: owned(at(rel, ["check"]), "check_passed", events), else: []

    owned(at(rel, []), "recipe", {caps, owners(registry, ["definitions"])}) ++
      check ++
      for {s, steps} <- steps(r),
          event = @step_event[s["op"]],
          event != nil,
          d <- owned(at(rel, steps ++ ["op"]), event, events),
          do: d
  end

  defp refs(rel, r, %{m: m, defs: defs}) do
    facts =
      for {%{"op" => "fact.assign"} = s, steps} <- steps(r),
          d <- reference(rel, steps, "fact", s, m, defs),
          do: d

    target(rel, r["target"], m, defs) ++
      facts ++
      attributes(rel, r, m, defs) ++ resources(rel, r, m, defs) ++ participants(rel, r, m, defs)
  end

  # Each narration participant but the actor names this cartridge's npc or item its role says.
  defp participants(rel, r, m, defs) do
    for {name, o} <- r["outcomes"],
        {n, %{"role" => k} = p} <- Map.get(o["narration"], "participants", %{}),
        k != "actor",
        d <- reference(rel, ["outcomes", name, "narration", "participants", n], k, p, m, defs),
        do: d
  end

  defp attributes(rel, %{"check" => %{"kind" => "attribute_threshold"} = c}, m, defs),
    do: reference(rel, ["check"], "attribute", c, m, defs)

  defp attributes(rel, %{"check" => %{"kind" => "opposed"}} = r, m, defs),
    do: opposed(rel, r, m, defs)

  defp attributes(_, _, _, _), do: []

  defp resources(rel, r, m, defs),
    do: for({n, steps} <- resourced(r), d <- reference(rel, steps, "resource", n, m, defs), do: d)

  # Each part of a recipe naming a resource: its costs, a threshold check and resource.adjust
  # steps, with its path.
  defp resourced(r) do
    costs = for {c, i} <- Enum.with_index(Map.get(r, "costs", [])), do: {c, ["costs", i]}
    check = for %{"kind" => "threshold"} = c <- [r["check"]], do: {c, ["check"]}
    costs ++ check ++ for({%{"op" => "resource.adjust"} = s, steps} <- steps(r), do: {s, steps})
  end

  # The room resolves (reference/6), then the detail is one of its details.
  defp target(rel, t, m, defs) do
    case resolve(t["room"], "room", m, defs) do
      {_, _, room} ->
        if is_map_key(Map.get(room, "details", %{}), t["detail"]),
          do: [],
          else: [unresolved(rel, ["target", "detail"], t["detail"])]

      _ ->
        reference(rel, ["target"], {"room", "room"}, t, m, defs)
    end
  end

  defp texts(_, _, %{text: :unknown}), do: []

  defp texts(rel, r, %{text: text}) do
    for {steps, key} <- [
          {["label"], r["label"]}
          | for(
              {name, o} <- r["outcomes"],
              {k, v} <- Map.take(o["narration"], ~w(actor observers)),
              do: {["outcomes", name, "narration", k], v}
            )
        ],
        not is_map_key(text, key),
        do: unresolved(rel, steps, key)
  end

  defp contributions(defs, actions) do
    known = known(defs, actions)

    for {_, {rel, [], room}} <- defs["room"],
        {c, i} <- Enum.with_index(Map.get(room, "actions", [])),
        {key, j} <- Enum.with_index(c["actions"]),
        key not in known,
        do: unresolved(rel, ["actions", i, "actions", j], key)
  end

  # The registered commands and this cartridge's action, recipe, quest and dialogue keys.
  defp known(defs, actions) do
    others = for kind <- ~w(quest dialogue), {_, {_, [], d}} <- defs[kind], do: d["key"]

    MapSet.new(commands() ++ others ++ for({_, r} <- all(defs), do: r["key"]))
    |> MapSet.union(actions)
  end

  defp unresolved(rel, steps, target),
    do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => target})
end
