defmodule Loka.Content.Recipes do
  @moduledoc """
  Action recipes and rooms' action contributions (action.schema.json ActionRecipe,
  ActionContribution; 06 §19-§20; 05 §28). A recipe's policy tree is checked with every other
  (`Loka.Content.Checks`); this module checks the rest, given a valid manifest.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6, resolve: 4]

  # A step uses its op through the event it produces.
  @step_event %{"fact.assign" => "fact_changed", "event.emit" => "custom_event"}
  @success ["outcomes", "success"]

  @doc "Each schema-valid recipe's policy root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, r} <- all(defs), do: {rel, ["policy", "root"], r["policy"]["root"]})

  defp all(defs), do: for({_, {rel, [], r}} <- defs["recipe"], do: {rel, r})

  @doc """
  For a v2 source with a valid manifest (else none): each recipe's owner (action_recipe) and
  each step's (by its event) is required; its target names a room of this cartridge and a detail
  of that room, each fact.assign a fact with a value of its type, and its label and narration
  have catalog entries (unless `text` is `:unknown`); no recipe shares an action's key
  (DUPLICATE_DEFINITION: one key is one ActionSet identity); and each key of a room's action
  contribution names a registered command, an action or a recipe.
  """
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    actions = for {_, {_, [], a}} <- defs["action"], into: MapSet.new(), do: a["key"]
    ctx = %{m: m, defs: defs, text: text, registry: registry, actions: actions}
    Enum.flat_map(all(defs), &recipe(&1, ctx)) ++ contributions(defs, actions)
  end

  defp recipe({rel, r}, ctx) do
    duplicate =
      if r["key"] in ctx.actions, do: [diag("DUPLICATE_DEFINITION", at(rel, []))], else: []

    owners(rel, r, ctx) ++ refs(rel, r, ctx) ++ texts(rel, r, ctx.text) ++ duplicate
  end

  defp steps(r), do: Enum.with_index(r["outcomes"]["success"]["sequence"])
  defp step(i), do: @success ++ ["sequence", i]

  defp owners(rel, r, %{m: m, registry: registry}) do
    caps = m["requires"]["capabilities"]
    events = {caps, owners(registry, ["events"])}

    owned(at(rel, []), "recipe", {caps, owners(registry, ["definitions"])}) ++
      Enum.flat_map(steps(r), fn {s, i} ->
        owned(at(rel, step(i) ++ ["op"]), @step_event[s["op"]], events)
      end)
  end

  defp refs(rel, r, %{m: m, defs: defs}) do
    target(rel, r["target"], m, defs) ++
      for {%{"op" => "fact.assign"} = s, i} <- steps(r),
          d <- reference(rel, step(i), "fact", s, m, defs),
          do: d
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

  defp texts(_, _, :unknown), do: []

  defp texts(rel, r, text) do
    narration = r["outcomes"]["success"]["narration"]

    for {steps, key} <- [
          {["label"], r["label"]}
          | for({k, v} <- narration, do: {@success ++ ["narration", k], v})
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

  # The registered commands and this cartridge's action and recipe keys.
  defp known(defs, actions),
    do: MapSet.new(commands() ++ for({_, r} <- all(defs), do: r["key"])) |> MapSet.union(actions)

  defp unresolved(rel, steps, target),
    do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => target})
end
