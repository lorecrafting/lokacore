defmodule Loka.Content.Steps do
  @moduledoc """
  The one step vocabulary's context table (C3 D6, loka-ivjq.4). step.schema.json Step admits
  every registered op; which ops each context runs (a reaction's apply, a scripted action's
  steps, a dialogue choice's sequence, a service's benefits), which of their fields, and the
  event an op needs registered are this table. `check/5` refuses the rest.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [owned: 3, reference: 6]

  @r %{reaction: :any}
  @s %{service: :any}
  # op => {event the op needs registered | nil, %{context => fields it runs besides op | :any}}
  @ops %{
    "fact.assign" =>
      {"fact_changed", %{reaction: :any, action: ~w(fact value), choice: ~w(fact value)}},
    "fact.adjust" => {"fact_changed", %{reaction: :any, choice: ~w(amount fact)}},
    "fact.stamp" => {"fact_changed", @r},
    "event.emit" => {"custom_event", %{reaction: :any, action: :any}},
    "quest.activate" => {"quest_activated", @r},
    "quest.resolve" => {"quest_resolved", @r},
    "quest.fail" => {nil, @r},
    "barrier.set" => {"barrier_changed", @r},
    "npc.move" => {"entity_entered_room", @r},
    "population.suppress" => {nil, @r},
    "experience.grant" => {nil, @r},
    "narrate" => {nil, @r},
    "item.move" => {nil, @r},
    "population.spawn" => {nil, @r},
    "replenish.run" => {nil, @r},
    "status.apply" => {nil, %{reaction: :any, action: ~w(npc status)}},
    "status.cure" => {nil, %{reaction: :any, action: :any}},
    "damage" => {nil, %{action: :any}},
    "light.ignite" => {nil, %{action: :any}},
    "resource.adjust" => {nil, %{action: :any}},
    "build" => {nil, %{action: ~w(direction structure), service: :any}},
    "skill.acquire" => {nil, %{choice: :any}},
    "topic.grant" => {nil, %{choice: :any}},
    "entitlement" => {nil, @s},
    "meal" => {nil, @s},
    "drink" => {nil, @s},
    "repair" => {nil, @s},
    "claim" => {nil, @s},
    "cancel" => {nil, @s},
    "deposit" => {nil, @s},
    "withdraw" => {nil, @s},
    "mend" => {nil, @s},
    "raze" => {nil, @s}
  }
  # Fields a context requires besides op: a service build raises at its site (P review finding 3).
  @required %{{"build", :service} => ~w(site)}

  @doc "The registered ops (step.schema.json Step's branches)."
  def ops, do: Map.keys(@ops)

  @doc """
  `steps` (a list, or one step such as a service's benefit) at `path` of `rel` in `context`
  (:reaction, :action, :choice or :service): SCHEMA_VIOLATION invalid_value at an op or field
  the context does not run, missing_property at a field it requires, the owning event
  an op needs (`ctx.events`), and each step's references (`ctx.m`, `ctx.defs`).
  """
  def check(rel, path, step, context, ctx) when is_map(step),
    do: step(rel, path, step, context, ctx)

  def check(rel, path, steps, context, ctx) do
    for {s, i} <- Enum.with_index(steps), d <- step(rel, path ++ [i], s, context, ctx), do: d
  end

  defp step(rel, path, s, context, ctx) do
    {event, contexts} = Map.get(@ops, s["op"], {nil, %{}})

    case contexts[context] do
      nil ->
        [invalid(rel, path ++ ["op"])]

      fields ->
        missing(rel, path, s, context) ++
          unrun(rel, path, s, fields) ++ refs(rel, path, s, event, ctx)
    end
  end

  # The step's owning event and references.
  defp refs(rel, path, s, event, ctx) do
    if(event, do: owned(at(rel, path ++ ["op"]), event, ctx.events), else: []) ++
      for {f, kind} <- Map.get(Loka.Content.LeafRefs.steps(), s["op"], %{}),
          is_map_key(s, f),
          d <- reference(rel, path, {f, kind}, s, ctx.m, ctx.defs),
          do: d
  end

  defp missing(rel, path, s, context) do
    for f <- Map.get(@required, {s["op"], context}, []),
        not is_map_key(s, f),
        do: diag("SCHEMA_VIOLATION", at(rel, path ++ [f]), %{"error" => "missing_property"})
  end

  defp unrun(_, _, _, :any), do: []

  defp unrun(rel, path, s, fields),
    do: for(f <- Map.keys(s) -- ["op" | fields], do: invalid(rel, path ++ [f]))

  defp invalid(rel, path),
    do: diag("SCHEMA_VIOLATION", at(rel, path), %{"error" => "invalid_value"})
end
