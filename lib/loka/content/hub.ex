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
  import Loka.Content.Source, only: [diag: 2, at: 2]

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
    if repeats?(d, targets) and
         not Enum.any?([d["quest"], d["riddle"], o["accept"], o["patrol"]]) and not self_gated?(o),
       do: for(f <- repeatable(o, proven), do: diag("OUTCOME_MISMATCH", at(rel, steps ++ f))),
       else: []
  end

  defp repeats?(%{"choices" => choices} = d, targets) do
    map_size(choices) > 1 or MapSet.member?(targets, d["key"]) or
      Enum.any?(choices, fn {_, c} -> is_map_key(c, "then") or is_map_key(c, "then_failed") end)
  end

  # The lowered `once`: the policy's condition (alone or under `all`) that a fact its steps set
  # does not yet hold that value.
  defp self_gated?(%{"policy" => policy, "steps" => steps}) do
    conditions = if policy["op"] == "all", do: policy["items"], else: [policy]

    Enum.any?(conditions, fn
      %{"op" => "not", "item" => %{"op" => "fact_compare", "fact" => f, "equals" => v} = leaf} ->
        # A leaf reading another holder (subject, npc, with) never sees the step's write.
        Map.take(leaf, ~w(subject npc with)) == %{} and
          Enum.any?(
            steps,
            &(match?(%{"op" => "fact.assign", "value" => ^v}, &1) and key(&1["fact"]) == key(f))
          )

      _ ->
        false
    end)
  end

  defp self_gated?(_), do: false

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
