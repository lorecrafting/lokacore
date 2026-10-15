defmodule Loka.Core.ComposeJob do
  @moduledoc "Job times inside one advance (twin of kernel/ts/src/foundation/compose_job.ts)."

  # Each op's scheduling time: the due time of the last job.complete before it, else `at`
  # (the target; a partial compose: the clock).
  def times(state, ops, at) do
    due = Map.new(Map.get(state, "jobs", %{}), fn {id, j} -> {id, j["due_time"]} end)

    Enum.scan(ops, {at, due}, fn op, {at, due} ->
      due =
        if op["op"] == "job.schedule",
          do: Map.put_new(due, op["job_id"], op["due_time"]),
          else: due

      {if(op["op"] == "job.complete", do: Map.get(due, op["job_id"], at), else: at), due}
    end)
    |> Enum.map(&elem(&1, 0))
  end

  # Only job.schedule writes a pending row: one due by the target must have run in this advance.
  def unrun(overlay, horizon) do
    Enum.find_value(overlay, fn {_, {_, target, value}} ->
      if target["kind"] == "job" and value["status"] == "pending" and
           value["due_time"] <= horizon,
         do: target
    end)
  end
end
