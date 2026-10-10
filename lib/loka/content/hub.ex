defmodule Loka.Content.Hub do
  @moduledoc """
  dialogue@1 hub (twin of kernel/ts/src/content/cartridge_dialogues.ts `once`): a dialogue with no
  quest, no riddle and several choices reopens after an answer, so an answer receiving an item,
  granting a topic, assigning a fact the save proves by one receipt or starting an escort could
  repeat; it needs the once-only accept or a patrol ending (OUTCOME_MISMATCH at the field). A
  hand_over cannot repeat: the NPC keeps the item.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2]

  @doc """
  The fact keys mobile/authority/local-story/topics-save.ts proves by exactly one receipt (by
  key): topic facts, perception discoveries and bounded riddles' answer assignments.
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
          %{"op" => "fact.assign", "fact" => f} <- get_in(d, ["choices", id, "sequence"]) || [],
          do: f

    (topics ++ seen ++ answers) |> MapSet.new(&key/1) |> MapSet.delete(nil)
  end

  @spec choice(String.t(), list(), map(), map(), MapSet.t()) :: [map()]
  def choice(rel, steps, o, %{"choices" => choices} = d, proven) when map_size(choices) > 1 do
    if Enum.any?([d["quest"], d["riddle"], o["accept"], o["patrol"]]),
      do: [],
      else: for(f <- repeatable(o, proven), do: diag("OUTCOME_MISMATCH", at(rel, steps ++ f)))
  end

  def choice(_, _, _, _, _), do: []

  defp repeatable(o, proven) do
    receive = if is_map_key(o, "receive"), do: [["receive"]], else: []
    escort = if match?(%{"escort" => %{"transition" => "start"}}, o), do: [["escort"]], else: []

    steps =
      for {s, i} <- Enum.with_index(Map.get(o, "sequence", [])),
          once?(s, proven),
          do: ["sequence", i, "op"]

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
