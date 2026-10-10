defmodule Loka.Core.ComposeQuest do
  @moduledoc "Quest instance rows (quest@1): retire, activate and transition preconditions."
  @legal %{
    "active" => ~w(objectives_complete failed abandoned),
    "objectives_complete" => ~w(resolved failed abandoned),
    "failed" => ["active"],
    "abandoned" => ["active"]
  }

  def retire(%{"quest" => q, "scope" => s}, row),
    do:
      check(
        row != nil and row["state"] == "resolved" and row["quest"] == q and row["scope"] == s,
        nil
      )

  @doc "`quests` is the instance section with this command's earlier changes merged in."
  def activate(%{"quest" => q, "scope" => s} = op, row, quests) do
    open? = fn {_, r} ->
      r["quest"] == q and r["scope"] == s and r["state"] in ~w(active objectives_complete)
    end

    next =
      Map.merge(
        %{"quest" => q, "scope" => s, "state" => "active"},
        Map.take(op, ["bindings", "started_at"])
      )

    check(row == nil and not Enum.any?(quests, open?), next)
  end

  def transition(%{"from" => from, "to" => to} = op, row) do
    outcome = op["outcome"]
    outcome_ok = if to == "resolved", do: outcome != nil, else: to == "failed" or outcome == nil

    next =
      if outcome,
        do: Map.put(row || %{}, "outcome", outcome),
        else: Map.delete(row || %{}, "outcome")

    # Toolbox row W23: the stage's start time, replaced or removed by each transition.
    next = Map.merge(Map.delete(next, "started_at"), Map.take(op, ["started_at"]))

    check(
      row["state"] == from and to in Map.get(@legal, from, []) and outcome_ok,
      Map.put(next, "state", to)
    )
  end

  defp check(true, value), do: {:ok, value}
  defp check(false, _), do: {:error, "precondition_failed"}
end
