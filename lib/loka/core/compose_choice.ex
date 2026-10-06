defmodule Loka.Core.ComposeChoice do
  @moduledoc "Actor-bound bounded continuation attempts."
  def attempt(op, row) when is_map(row) do
    a = row["attempts"]

    if bound?(op, row) and count?(a, op["prior_count"]),
      do: {:ok, Map.put(row, "attempts", Map.put(a, "count", a["count"] + 1))},
      else: {:error, "precondition_failed"}
  end

  def attempt(_, _), do: {:error, "precondition_failed"}

  defp bound?(op, row) do
    Map.take(row, ~w(actor_id source quest_instance_id opened_revision status)) == %{
      "actor_id" => op["actor_id"],
      "source" => op["source"],
      "quest_instance_id" => op["quest_instance_id"],
      "opened_revision" => op["expected_revision"],
      "status" => "pending"
    }
  end

  defp count?(a, prior) when is_map(a),
    do:
      is_integer(a["count"]) and valid_limit?(a["limit"]) and a["count"] >= 0 and
        a["count"] < a["limit"] and a["count"] == prior

  defp count?(_, _), do: false
  defp valid_limit?(limit), do: is_integer(limit) and limit > 0 and limit <= 9_007_199_254_740_991

  def transition(%{"op" => "choice.open"} = op, row, _) do
    opened = Map.take(op, ~w(actor_id source beat roles choice_ids quest_instance_id attempts))
    a = op["attempts"]

    valid =
      a == nil or
        (a["count"] == 0 and valid_limit?(a["limit"]) and op["quest_instance_id"] != nil)

    check(row == nil and valid, Map.put(opened, "status", "pending"))
  end

  def transition(%{"op" => "choice.attempt"} = op, row, initial) do
    if get_in(initial || %{}, ["attempts", "count"]) == op["prior_count"],
      do: attempt(op, row),
      else: {:error, "precondition_failed"}
  end

  def transition(%{"op" => "choice.resolve"} = op, row, _) do
    check(
      row["status"] == "pending" and op["choice_id"] in row["choice_ids"] and
        row["opened_revision"] == op["expected_revision"],
      Map.merge(row || %{}, %{"status" => "resolved", "choice_id" => op["choice_id"]})
    )
  end

  def transition(%{"op" => "choice.close"}, row, _),
    do: check(row["status"] == "pending", Map.put(row || %{}, "status", "closed"))

  def pending_at_limit(overlay) do
    found =
      Enum.find(overlay, fn {_, {_, target, value}} ->
        target["kind"] == "choice" and value["status"] == "pending" and
          is_map(value["attempts"]) and value["attempts"]["count"] >= value["attempts"]["limit"]
      end)

    if found, do: elem(elem(found, 1), 1)
  end

  defp check(true, value), do: {:ok, value}
  defp check(false, _), do: {:error, "precondition_failed"}
end
