defmodule Loka.Core.ComposePopulation do
  @moduledoc "The bounded plan, slot and birth-resource transitions."
  alias Loka.Core.Canonical

  def base(%{"kind" => "population_plan", "plan" => plan}, state),
    do: Map.get(state, "population_plans", %{})[key(plan)]

  def base(%{"kind" => "population_slot"} = target, state),
    do: Map.get(state, "population_slots", %{})[key(target)]

  def transition(%{"op" => "population.control"} = op, row, _) do
    value = op["value"]

    check(
      row == op["expected"] and
        (row == nil or
           (value["next_wander_due"] >= row["next_wander_due"] and
              ((value["job_id"] != row["job_id"] and
                  value["suppression"] == row["suppression"]) or
                 (value["next_wander_due"] == row["next_wander_due"] and
                    suppression_change?(row["suppression"], value["suppression"]))))),
      value
    )
  end

  def transition(%{"op" => "population.slot"} = op, row, _) do
    value = op["value"]
    check(row == op["expected"] and slot?(row, value), value)
  end

  # ponytail: one birth-only resource write shares its provenance and time checks. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  def initialize(op, row, {state, horizon, overlay}) do
    created = overlay[key(%{"kind" => "entity", "entity_id" => op["entity_id"]})]
    {group, _, identity} = created || {nil, nil, nil}
    origin = if identity, do: identity["origin"], else: %{}
    spec = Map.get(state, "population_specs", %{})[key(origin["by"])]

    check(
      row == nil and group == op["writer_group"] and
        origin["kind"] == "spawned" and origin["role"] == "hound" and
        origin["member_id"] == op["entity_id"] and
        op["resource"] == Map.merge(origin["by"], %{"kind" => "resource", "key" => "hp"}) and
        op["at"] >= state["clock"] and op["at"] <= horizon and
        spec != nil and op["value"] == spec["hp"]["start"],
      %{"value" => op["value"], "at" => op["at"]}
    )
  end

  defp check(true, value), do: {:ok, value}
  defp check(false, _), do: {:error, "precondition_failed"}

  defp key(value) do
    {:ok, text} = Canonical.encode(value)
    text
  end

  defp slot?(nil, %{"generation" => 0, "member_id" => nil, "replacement_due" => nil} = next),
    do: next["last_flight_at"] == nil

  defp slot?(nil, %{"generation" => 1, "member_id" => member, "replacement_due" => nil} = next),
    do: member != nil and next["last_flight_at"] == nil

  defp slot?(
         %{"generation" => 0},
         %{
           "generation" => 1,
           "member_id" => member,
           "replacement_due" => nil
         } = next
       ),
       do: member != nil and next["last_flight_at"] == nil

  defp slot?(
         %{"generation" => gen, "member_id" => member, "replacement_due" => nil} = prior,
         %{"generation" => gen, "member_id" => member, "replacement_due" => due} = next
       )
       when not is_nil(due),
       do: member != nil and next["last_flight_at"] == prior["last_flight_at"]

  defp slot?(
         %{"generation" => gen, "member_id" => member, "replacement_due" => nil} = prior,
         %{"generation" => gen, "member_id" => member, "replacement_due" => nil} = next
       ),
       do:
         member != nil and is_integer(next["last_flight_at"]) and
           next["last_flight_at"] != prior["last_flight_at"]

  defp slot?(
         %{"generation" => gen, "member_id" => member, "replacement_due" => due},
         %{"generation" => next_gen, "member_id" => next_member, "replacement_due" => nil} = next
       ),
       do:
         due != nil and next_gen == gen + 1 and next_member != nil and next_member != member and
           next["last_flight_at"] == nil

  defp slot?(_, _), do: false

  defp suppression_change?(_, nil), do: false

  defp suppression_change?(nil, after_row),
    do:
      after_row["generation"] == 1 and after_row["ends_at"] != nil and
        after_row["job_id"] != nil

  defp suppression_change?(%{"ends_at" => nil} = before, after_row),
    do:
      after_row["generation"] == before["generation"] + 1 and
        after_row["ends_at"] != nil and after_row["job_id"] != nil

  defp suppression_change?(before, after_row),
    do:
      after_row["generation"] == before["generation"] and
        after_row["cause_event_id"] == before["cause_event_id"] and
        after_row["ends_at"] == nil and after_row["job_id"] == nil
end
