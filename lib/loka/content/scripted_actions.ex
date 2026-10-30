defmodule Loka.Content.ScriptedActions do
  @moduledoc """
  Scripted actions and rooms' action contributions (action.schema.json ScriptedAction,
  ActionContribution; 06 §19-§20; 05 §28). A scripted action's policy tree is checked with every other
  (`Loka.Content.Resolve`); this module checks the rest, given a valid manifest.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6, resolve: 4]
  alias Loka.Content.{ActionTips, CheckKinds, Steps}

  @doc "Each schema-valid scripted action's policy root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, r} <- all(defs), do: {rel, ["policy"], r["policy"]})

  defp all(defs), do: for({_, {rel, [], r}} <- defs["scripted_action"], do: {rel, r})

  @doc """
  For a v2 source with a valid manifest (else none): each scripted action's owner (scripted_action), its
  check's (check@1, by its events) is required; each outcome's steps are `Loka.Content.Steps`
  :action steps (ops, fields, owning events and references) and its check runs neither failure
  nor rating (`CheckKinds.context/4`);
  its costs, threshold check and resource.adjust steps name resources of this cartridge; it
  has a failure outcome exactly when it has a check (OUTCOME_MISMATCH); its target names a room
  of this cartridge and a detail of that room (a use target's tool liquid a liquid of it; row G4), each
  status.cure only on a use scripted action (SCHEMA_VIOLATION) (a spell's word and
  row 29b effect steps: `Loka.Content.Spells`),
  each narration participant but the actor an npc or item of this cartridge, as its role says,
  its check's key is no other scripted action's check's (DUPLICATE_DEFINITION),
  and its name and narrations have catalog entries (unless `text` is `:unknown`); no scripted action's
  key is an action's or a
  registered command's (DUPLICATE_DEFINITION: one key is one ActionSet identity); and each key of a room's action
  contribution names a registered command, an action, a scripted action or a quest (its offer).
  """
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    actions = for {_, {_, [], a}} <- defs["action"], into: MapSet.new(), do: a["key"]

    caps = m["requires"]["capabilities"]

    ctx = %{
      m: m,
      defs: defs,
      text: text,
      registry: registry,
      events: {caps, owners(registry, ["events"])},
      actions: actions,
      shared: CheckKinds.shared_checks(defs)
    }

    Enum.flat_map(all(defs), &scripted(&1, ctx)) ++
      contributions(defs, actions) ++
      uses(defs) ++
      ActionTips.reasons(all(defs), ctx) ++
      Loka.Content.Replenish.craft(m, defs, text)
  end

  # Toolbox row G4: a status.cure step sits on a use scripted action (a detail holds no status).
  defp uses(defs) do
    for {rel, r} <- all(defs),
        r["target"]["kind"] != "use",
        {%{"op" => "status.cure"}, steps} <- steps(r),
        do: diag("SCHEMA_VIOLATION", at(rel, steps ++ ["op"]), %{"error" => "invalid_value"})
  end

  defp duplicate(rel, r, ctx) do
    taken = r["key"] in ctx.actions or r["key"] in commands()
    if taken, do: [diag("DUPLICATE_DEFINITION", at(rel, []))], else: []
  end

  defp scripted({rel, r}, ctx) do
    Enum.concat([
      owners(rel, r, ctx),
      refs(rel, r, ctx),
      texts(rel, r, ctx),
      duplicate(rel, r, ctx),
      mismatch(rel, r),
      duration(rel, r, ctx),
      ActionTips.check(rel, r, ctx),
      shared(rel, r, ctx.shared)
    ])
  end

  defp duration(rel, r, %{m: m}) do
    if m["time_policy"] != nil and r["duration"] != nil,
      do: [diag("INVALID_TIME_POLICY", at(rel, ["duration"]))],
      else: []
  end

  defp shared(rel, %{"check" => %{"key" => k}}, shared) do
    if k in shared, do: [diag("DUPLICATE_DEFINITION", at(rel, ["check"]))], else: []
  end

  defp shared(_, _, _), do: []

  defp mismatch(rel, r) do
    if is_map_key(r, "check") == is_map_key(r["outcomes"], "failure"),
      do: [],
      else: [diag("OUTCOME_MISMATCH", at(rel, ["outcomes"]))]
  end

  # Each step of each outcome, with its path.
  defp steps(r) do
    for {name, o} <- r["outcomes"],
        {s, i} <- Enum.with_index(o["steps"]),
        do: {s, ["outcomes", name, "steps", i]}
  end

  defp owners(rel, r, %{registry: registry, events: {caps, _} = events} = ctx) do
    check =
      if is_map_key(r, "check"),
        do:
          owned(at(rel, ["check"]), "check_passed", events) ++
            CheckKinds.context(rel, ["check"], r["check"], :action),
        else: []

    owned(at(rel, []), "scripted_action", {caps, owners(registry, ["definitions"])}) ++
      check ++
      for {name, o} <- r["outcomes"],
          d <- Steps.check(rel, ["outcomes", name, "steps"], o["steps"], :action, ctx),
          do: d
  end

  defp refs(rel, r, %{m: m, defs: defs}) do
    target(rel, r["target"], m, defs) ++
      CheckKinds.attributes(rel, r, m, defs) ++
      resources(rel, r, m, defs) ++ participants(rel, r, m, defs)
  end

  # Each narration participant but the actor names this cartridge's npc or item its role says.
  defp participants(rel, r, m, defs) do
    for {name, o} <- r["outcomes"],
        {n, %{"role" => k} = p} <- Map.get(o["narration"], "participants", %{}),
        k != "actor",
        d <- reference(rel, ["outcomes", name, "narration", "participants", n], k, p, m, defs),
        do: d
  end

  defp resources(rel, r, m, defs),
    do: for({n, steps} <- resourced(r), d <- reference(rel, steps, "resource", n, m, defs), do: d)

  # Each part of a scripted action naming a resource: its costs, a threshold check and resource.adjust
  # steps, with its path.
  defp resourced(r) do
    costs = for {c, i} <- Enum.with_index(Map.get(r, "costs", [])), do: {c, ["costs", i]}
    check = for %{"kind" => "threshold"} = c <- [r["check"]], do: {c, ["check"]}
    costs ++ check ++ for({%{"op" => "resource.adjust"} = s, steps} <- steps(r), do: {s, steps})
  end

  # Toolbox row G4: a use target's tool liquid names a liquid of this cartridge.
  defp target(rel, %{"kind" => "use", "tool" => tool}, m, defs),
    do:
      if(is_map_key(tool, "liquid"),
        do: reference(rel, ["target", "tool"], "liquid", tool, m, defs),
        else: []
      )

  # Toolbox row 29a: a spell names no definition.
  defp target(_, %{"kind" => "spell"}, _, _), do: []

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
          {["name"], r["name"]}
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

  # Commands and this cartridge's action, scripted action (a spell is cast by word), quest, dialogue keys.
  defp known(defs, actions) do
    others = for kind <- ~w(quest dialogue), {_, {_, [], d}} <- defs[kind], do: d["key"]
    scripted_actions = for {_, r} <- all(defs), r["target"]["kind"] != "spell", do: r["key"]
    MapSet.union(MapSet.new(commands() ++ others ++ scripted_actions), actions)
  end

  defp unresolved(rel, steps, target),
    do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => target})
end
