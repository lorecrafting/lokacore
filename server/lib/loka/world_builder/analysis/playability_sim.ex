defmodule Loka.WorldBuilder.Analysis.PlayabilitySim do
  @moduledoc """
  Simulates virtual player attempting quests.

  Detects blockers: missing items, unreachable objectives, broken logic.
  """

  alias Loka.WorldBuilder.Analysis.Reachability

  def simulate_quest(quest, rooms) do
    start_room = quest.start_room || quest[:start_room]
    objectives = quest.objectives || []

    blockers = []

    # Check if start room is reachable
    blockers =
      if start_room do
        reachable_rooms =
          Reachability.find_reachable(List.first(rooms).key, rooms) |> MapSet.new()

        if !MapSet.member?(reachable_rooms, start_room),
          do: ["Quest start room '#{start_room}' is unreachable" | blockers],
          else: blockers
      else
        ["Quest missing start_room" | blockers]
      end

    # Check objectives for reachability
    blockers =
      Enum.reduce(objectives, blockers, fn obj, acc ->
        cond do
          obj.type == "kill" && is_nil(obj.target) ->
            ["Objective missing kill target" | acc]

          obj.type == "collect" && is_nil(obj.item) ->
            ["Objective missing item to collect" | acc]

          obj.type == "reach" && is_nil(obj.location) ->
            ["Objective missing location" | acc]

          true ->
            acc
        end
      end)

    result =
      if length(blockers) == 0,
        do: :playable,
        else: :blocked

    %{quest: quest.key, result: result, blockers: blockers}
  end

  def simulate_all_quests(quests, rooms) do
    quests
    |> Enum.map(&simulate_quest(&1, rooms))
    |> Enum.filter(&(&1.result == :blocked))
  end
end
