defmodule Loka.Content.Hub do
  @moduledoc """
  dialogue@1 hub (twin of kernel/ts/src/content/cartridge_dialogues.ts `once`): a dialogue with no
  quest, no riddle and several choices reopens after an answer, so an answer receiving an item,
  granting a topic or starting an escort could repeat; it needs the once-only accept or a patrol
  ending (OUTCOME_MISMATCH at the field). A hand_over cannot repeat: the NPC keeps the item.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2]

  @spec choice(String.t(), list(), map(), map()) :: [map()]
  def choice(rel, steps, o, %{"choices" => choices} = d) when map_size(choices) > 1 do
    if Enum.any?([d["quest"], d["riddle"], o["accept"], o["patrol"]]),
      do: [],
      else: for(f <- repeatable(o), do: diag("OUTCOME_MISMATCH", at(rel, steps ++ f)))
  end

  def choice(_, _, _, _), do: []

  defp repeatable(o) do
    receive = if is_map_key(o, "receive"), do: [["receive"]], else: []
    escort = if match?(%{"escort" => %{"transition" => "start"}}, o), do: [["escort"]], else: []

    topics =
      for {%{"op" => "topic.grant"}, i} <- Enum.with_index(Map.get(o, "sequence", [])),
          do: ["sequence", i, "op"]

    receive ++ escort ++ topics
  end
end
