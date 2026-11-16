defmodule Loka.Content.ReactionOnce do
  @moduledoc """
  A reaction's source-only `once` and `cooldown`: lowered to engine facts and a policy guard beside
  the authored `when`, as `DialogueOnce` lowers a choice's `once`.

  `once: true` becomes the bool fact `<rule>_done` (default false), a step setting it true and a
  `not fact_compare` guard; `cooldown: N` becomes the int fact `<rule>_at` (default 0), a stamp step
  and a `time_since {at_least: N}` guard. Both fields leave the rule, so nothing in the protocol, the
  kernels or the reviewer changes.

  The guard sits in the rule's `when` beside the authored policy, not only in its steps: an `after`
  rule's `when` is read again when its job runs (protocol/reaction.schema.json ReactionRule), so a
  rule delivered twice before its job runs still fires once.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2, ref: 3]

  @key_max 64

  @doc "Reserves each lowered fact (an @engine_facts module); a fact already declared is refused."
  @spec facts(term(), map() | nil, map()) :: {term(), [map()]}
  def facts(facts, m, defs) when is_map(facts) and m != nil,
    do: Enum.reduce(reserved(defs), {facts, []}, &reserve/2)

  def facts(facts, _, _), do: {facts, []}

  @doc "Each reaction with `once`/`cooldown` lowered and both source fields gone."
  @spec lower(map(), map()) :: map()
  def lower(defs, m) when is_map(defs) do
    rules = Map.new(defs["reaction"] || %{}, fn {k, v} -> {k, lowered(k, v, m)} end)
    Map.put(defs, "reaction", rules)
  end

  def lower(defs, _), do: defs

  @doc """
  The facts the authored `once`/`cooldown` fields become, `{name, {rel, field}}`, read from the
  reaction defs before the lowering drops the field.
  """
  @spec reserved(map()) :: %{String.t() => {String.t(), [String.t()]}}
  def reserved(defs) when is_map(defs) do
    for {key, {rel, _, %{} = rule}} <- defs["reaction"] || %{},
        field <- ["once", "cooldown"],
        Map.has_key?(rule, field),
        into: %{},
        do: {name(key, field), {rel, field}}
  end

  def reserved(_), do: %{}

  @doc """
  The lowered fact names another writer may not declare or write (Position.check, which scans every
  write site and so already refuses an author's step that writes one).
  """
  @spec names(map()) :: [String.t()]
  def names(defs), do: reserved(defs) |> Map.keys()

  defp lowered(k, {rel, steps, %{} = rule} = v, m) do
    if Map.has_key?(rule, "once") or Map.has_key?(rule, "cooldown"),
      do: {rel, steps, rule |> Map.drop(["once", "cooldown"]) |> add(k, rule, m)},
      else: v
  end

  defp lowered(_, v, _), do: v

  defp add(rule, k, before, m), do: rule |> put_steps(k, before, m) |> put_when(k, before)

  # The lowered step goes last: an `after` rule runs its job later, so a stamp must follow the
  # effect it records.
  defp put_steps(rule, k, before, m) do
    stamp = %{"op" => "fact.stamp", "fact" => ref(name(k, "cooldown"), "fact", m)}
    done = %{"op" => "fact.assign", "fact" => ref(name(k, "once"), "fact", m), "value" => true}

    steps =
      if(before["cooldown"], do: [stamp], else: []) ++
        if(before["once"] == true, do: [done], else: [])

    if steps == [], do: rule, else: Map.update(rule, "steps", steps, &(&1 ++ steps))
  end

  defp put_when(rule, k, before) do
    leaves =
      if(before["once"] == true, do: [done_guard(name(k, "once"))], else: []) ++
        if(before["cooldown"], do: [rested(name(k, "cooldown"), before["cooldown"])], else: [])

    if leaves == [], do: rule, else: Map.put(rule, "when", join(rule["when"], leaves))
  end

  # Beside the authored `when` under `all`; an authored `all` gains the leaves rather than nesting.
  defp join(nil, [one]), do: one
  defp join(nil, leaves), do: %{"op" => "all", "items" => leaves}

  defp join(%{"op" => "all", "items" => items}, leaves),
    do: %{"op" => "all", "items" => items ++ leaves}

  defp join(other, leaves), do: %{"op" => "all", "items" => [other | leaves]}

  defp done_guard(fact) do
    %{"op" => "not", "item" => %{"op" => "fact_compare", "fact" => fact, "equals" => true}}
  end

  defp rested(fact, n), do: %{"op" => "time_since", "fact" => fact, "at_least" => n}

  defp reserve({fact, {rel, field}}, {acc, ds}) do
    site = at(rel, [field])

    taken =
      if is_map_key(acc, fact),
        do: [diag("RESERVED_FACT", site, %{"field" => fact, "key" => fact})],
        else: []

    long =
      if byte_size(fact) > @key_max,
        do: [diag("SCHEMA_VIOLATION", site, %{"why" => "reaction_key_long", "key" => fact})],
        else: []

    {Map.put(acc, fact, {"cartridge.json", [], spec(fact, field)}), ds ++ taken ++ long}
  end

  defp name(k, "once"), do: "#{k}_done"
  defp name(k, "cooldown"), do: "#{k}_at"

  defp spec(name, "once") do
    %{
      "key" => name,
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "Whether this reaction has already fired once (once)."
    }
  end

  # `time_since` reads an unbounded clock: an int with no maximum (Delayed.clock), so the stamp
  # is a logical time, not a bounded counter.
  defp spec(name, "cooldown") do
    %{
      "key" => name,
      "version" => 1,
      "value_type" => %{"type" => "int", "default" => 0, "minimum" => 0},
      "scopes" => ["player"],
      "meaning" => "The logical time this reaction last fired (cooldown)."
    }
  end
end
