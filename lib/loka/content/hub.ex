defmodule Loka.Content.Hub do
  @moduledoc """
  dialogue@1 hub: a dialogue with no
  quest, no riddle and several choices, a choice with `then`, or a `then` naming it can run again
  after an answer, so an answer receiving an item,
  granting a topic, assigning a fact the save proves by one receipt or starting an escort could
  repeat; it needs the once-only accept or a patrol ending (OUTCOME_MISMATCH at the field). A
  hand_over cannot repeat: the NPC keeps the item. Nor can a choice whose own policy negates a fact
  its own steps set.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]

  @doc """
  The one-write fact keys (by key): topic facts, perception discoveries and bounded riddles'
  answer assignments. Save recovery no longer proves them by receipt (loka-vduxr.10).
  """
  @spec proven(map()) :: MapSet.t()
  def proven(defs) do
    topics = for {_, {_, [], t}} <- Map.get(defs, "topic", %{}), do: t["fact"]

    seen =
      for {_, {_, [], n}} <- Map.get(defs, "npc", %{}),
          do: get_in(n, ["perception", "discovered"])

    answers =
      for {_, {_, [], %{"riddle" => %{"wrong_limit" => _, "choice_id" => id}} = d}} <-
            Map.get(defs, "dialogue", %{}),
          %{"op" => "fact.assign", "fact" => f} <- get_in(d, ["choices", id, "steps"]) || [],
          do: f

    (topics ++ seen ++ answers) |> MapSet.new(&key/1) |> MapSet.delete(nil)
  end

  @doc "The dialogue keys some choice names in `then` or `then_failed`."
  @spec targets(map()) :: MapSet.t()
  def targets(defs) do
    for {_, {_, [], d}} <- Map.get(defs, "dialogue", %{}),
        {_, o} <- d["choices"],
        key <- [o["then"], o["then_failed"]],
        key != nil,
        into: MapSet.new(),
        do: key
  end

  @spec choice(String.t(), list(), map(), map(), map()) :: [map()]
  def choice(rel, steps, o, d, %{proven: proven, targets: targets}) do
    sitting(rel, steps, o, d, targets) ++ gifts(rel, steps, o, d, proven, targets)
  end

  # mechanics/dialogue/behavior.ts `hub`: only a plain answer of a dialogue that reopens comes back.
  defp sitting(rel, steps, %{"sitting" => true} = o, d, targets) do
    ends =
      Enum.any?([
        o["then"],
        self_gated?(o),
        o["check"],
        o["patrol"],
        d["quest"],
        d["riddle"]
      ]) or
        map_size(d["choices"]) == 1 or MapSet.member?(targets, d["key"])

    if ends,
      do: [
        diag("OUTCOME_MISMATCH", at(rel, steps ++ ["sitting"]), %{"why" => "sitting_no_return"})
      ],
      else: []
  end

  defp sitting(_, _, _, _, _), do: []

  defp gifts(rel, steps, o, d, proven, targets) do
    if repeats?(d, targets) and
         not Enum.any?([d["quest"], d["riddle"], o["accept"], o["patrol"]]) and not self_gated?(o),
       do:
         for(
           f <- repeatable(o, proven),
           do: diag("OUTCOME_MISMATCH", at(rel, steps ++ f), %{"why" => "gift_repeats"})
         ),
       else: []
  end

  defp repeats?(%{"choices" => choices} = d, targets) do
    map_size(choices) > 1 or MapSet.member?(targets, d["key"]) or
      Enum.any?(choices, fn {_, c} -> is_map_key(c, "then") or is_map_key(c, "then_failed") end)
  end

  # behavior.ts `hub` reopens after a plain answer without reading the dialogue's policy, so an answer
  # that fails it leaves only refused choices and Leave. A `then` (`then: end`), `check` or `patrol` ends it.
  @doc "Each `{rel, choice key, dialogue}` whose plain answer fails its own hub's policy (HUB_SHUT)."
  @spec shut([{String.t(), map()}], map()) :: [{String.t(), String.t(), map()}]
  def shut(sorted, next) do
    linked = next |> Map.values() |> List.flatten()

    for {rel, d} <- sorted,
        reopens?(d, linked),
        {k, c} <- Enum.sort(d["choices"]),
        shuts?(d, c),
        do: {rel, k, d}
  end

  defp shuts?(d, c),
    do:
      !c["then"] && !c["check"] && !c["patrol"] &&
        self_gates(%{"policy" => d["policy"], "steps" => c["steps"] || []}) != []

  defp reopens?(d, linked),
    do:
      d["policy"] && !d["quest"] && !d["riddle"] && map_size(d["choices"]) > 1 &&
        d["key"] not in linked

  # The lowered `once`: the policy's condition (alone or under `all`) on a fact its steps last set
  # to a value the condition rules out: `not` around `equals v`, or `equals w` with w other than v.
  @doc "Whether a choice's own steps hide it for good (the lowered `once`)."
  @spec self_gated?(map()) :: boolean()
  def self_gated?(o), do: self_gates(o) != []

  @doc "Each `{fact key, value}` a choice's policy refuses once its own steps have set it."
  @spec self_gates(map()) :: [{String.t(), term()}]
  def self_gates(%{"policy" => policy, "steps" => steps}) do
    conditions = if policy["op"] == "all", do: policy["items"], else: [policy]

    for {closes?, %{"fact" => f, "equals" => w} = leaf} <- Enum.map(conditions, &gate/1),
        # A leaf reading another holder (subject, npc, with) never sees the step's write.
        Map.take(leaf, ~w(subject npc with)) == %{},
        %{"op" => "fact.assign", "value" => v} <- last_write(steps, key(f)),
        closes?.(v, w),
        do: {key(f), v}
  end

  def self_gates(_), do: []

  @doc "Whether a step of any choice of the dialogue writes the gate's fact to another value."
  @spec reopens?(map(), {String.t(), term()}) :: boolean()
  def reopens?(dialogue, {f, v}) do
    Enum.any?(
      for(c <- Map.values(dialogue["choices"]), s <- c["steps"] || [], writes?(s, f), do: s),
      &(not match?(%{"op" => "fact.assign", "value" => ^v}, &1))
    )
  end

  defp gate(%{"op" => "not", "item" => %{"op" => "fact_compare"} = leaf}), do: {&==/2, leaf}
  defp gate(%{"op" => "fact_compare"} = leaf), do: {&!=/2, leaf}
  defp gate(_), do: nil

  defp last_write(steps, f), do: steps |> Enum.filter(&writes?(&1, f)) |> Enum.take(-1)

  defp writes?(step, f), do: match?("fact." <> _, step["op"]) and key(step["fact"]) == f

  defp repeatable(o, proven) do
    receive = if is_map_key(o, "receive"), do: [["receive"]], else: []
    escort = if match?(%{"escort" => %{"transition" => "start"}}, o), do: [["escort"]], else: []

    steps =
      for {s, i} <- Enum.with_index(Map.get(o, "steps", [])),
          once?(s, proven),
          do: ["steps", i, "op"]

    receive ++ escort ++ steps
  end

  defp once?(%{"op" => "topic.grant"}, _), do: true
  defp once?(%{"op" => "fact.assign", "fact" => f}, proven), do: MapSet.member?(proven, key(f))
  defp once?(_, _), do: false

  # A fact ref (short `key`, qualified `cartridge@version:fact/key` or a ref map) by its key.
  defp key(%{"key" => key}), do: key
  defp key(ref) when is_binary(ref), do: ref |> String.split("/") |> List.last()
  defp key(_), do: nil
end
