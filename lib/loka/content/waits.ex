defmodule Loka.Content.Waits do
  @moduledoc """
  A reaction's source-only `{"op": "wait", "seconds": N}` step: the list is split at its waits,
  and each stretch after one becomes a sibling rule `<rule>_wait_<n>` with the same `on` and `when`
  and a larger `after` (docs/system/cartridge.md, Source shortcuts; FD1 in mechanics.md). It
  returns faults; Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Content.Areas

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  # The fired job keeps its actor, not the subject RS-4's quest steps read (NPC no-op, trigger holder).
  @event_bound ~w(barrier.set event.emit item.move npc.move population.suppress quest.activate quest.resolve quest.fail replenish.run)
  # The schema's `after` maximum.
  @max 2_147_483_647

  @doc "Whether a step reads the event that caused its rule, so it cannot run on a delayed rule."
  @spec event_bound?(map()) :: boolean()
  def event_bound?(s) do
    s["op"] in @event_bound or
      (s["op"] == "status.apply" and (Map.has_key?(s, "co_present") or Map.has_key?(s, "tag")))
  end

  @doc "Every reaction with a wait replaced by its rules; any other `wait` step is refused."
  @spec lower([entry()]) :: {[entry()], [fault()]}
  def lower(files) do
    timed = timed(files)
    {files, refused} = files |> Enum.map(&file(&1, timed)) |> Enum.unzip()
    {files, repeats} = Areas.unique(List.flatten(files))
    {files, List.flatten(refused) ++ repeats}
  end

  # `{key, duration, outcomes}` of each scripted action that advances time.
  defp timed(files) do
    for {_, {:action, key, _}, %{"duration" => d} = a} <- files,
        is_integer(d),
        d > 0,
        not is_map_key(a, "command"),
        do: {key, d, a["outcomes"]}
  end

  # A text catalog's keys are the author's words, not steps.
  defp file({"text.json", _, _} = file, _), do: {[file], []}

  defp file({rel, {:reaction, _, _} = id, %{"steps" => steps} = rule} = file, timed)
       when is_list(steps) do
    if Enum.any?(steps, &wait?/1) and lowerable?(rule),
      do: lowered(rel, id, rule, timed),
      else: {[file], []}
  end

  defp file({rel, kind, value} = file, _) do
    case misplaced(value, []) do
      [] -> {[file], []}
      paths -> {[{rel, kind, :invalid}], Enum.map(paths, &fault(rel, at(kind) ++ &1, "outside"))}
    end
  end

  defp lowered(rel, {:reaction, _, at} = id, rule, timed) do
    case faults(rule["steps"], rule, rel, at) ++ inside_action(rule["on"], timed, rel, at) do
      [] -> {rules(rel, id, rule, lead(rule["on"], timed)), []}
      faults -> {[{rel, id, :invalid}], faults}
    end
  end

  # A step that is no object or a bad `after` is the schema's to report, not ours to overwrite.
  defp lowerable?(%{"steps" => steps} = rule) do
    Enum.all?(steps, &is_map/1) and
      (not Map.has_key?(rule, "after") or (is_integer(rule["after"]) and rule["after"] >= 1))
  end

  defp at({_, _, steps}), do: steps
  defp at(_), do: []

  defp misplaced(%{"op" => "wait"}, path), do: [Enum.reverse(path)]

  defp misplaced(%{} = v, path),
    do: Enum.flat_map(v, fn {k, x} -> misplaced(x, [k | path]) end)

  defp misplaced(v, path) when is_list(v) do
    v |> Enum.with_index() |> Enum.flat_map(fn {x, i} -> misplaced(x, [i | path]) end)
  end

  defp misplaced(_, _), do: []

  # Every refusal names the authored step: the copies below renumber theirs.
  # ponytail: a later stage's fault in a later stretch names the sibling's index; carry a step map
  # on the entry if authors stumble on it.
  defp faults(steps, rule, rel, at) do
    at = at ++ ["steps"]
    indexed = Enum.with_index(steps)

    Enum.flat_map(indexed, &malformed(&1, steps, rel, at)) ++
      too_long(indexed, rule, rel, at) ++
      after_first(indexed, rel, at) ++
      Enum.map(subjects(rule["when"], ["when"]), &fault(rel, Enum.drop(at, -1) ++ &1, "subject"))
  end

  defp malformed({s, i}, steps, rel, at) do
    next = Enum.at(steps, i + 1)

    cond do
      not wait?(s) -> []
      not seconds?(s) -> [fault(rel, at ++ [i, "seconds"], "seconds")]
      next == nil or wait?(next) -> [fault(rel, at ++ [i], "empty")]
      true -> []
    end
  end

  defp after_first(indexed, rel, at) do
    for {s, i} <- Enum.drop_while(indexed, fn {s, _} -> not wait?(s) end), event_bound?(s) do
      fault(rel, at ++ [i, "op"], "event")
    end
  end

  defp too_long(indexed, rule, rel, at) do
    waits = for {s, _} = w <- indexed, wait?(s), seconds?(s), do: w

    waits
    |> Enum.scan(after_of(rule), fn {s, _}, total -> total + s["seconds"] end)
    |> Enum.zip(waits)
    |> Enum.find(fn {total, _} -> total > @max end)
    |> case do
      nil -> []
      {_, {_, i}} -> [fault(rel, at ++ [i, "seconds"], "seconds")]
    end
  end

  # The action's events carry its start, and a job due inside its advance lands 1 s after it (FD1),
  # in job id order: without its duration every wait shorter than the action lands in one second.
  defp lead(%{"event" => "action_completed", "action" => action}, timed) do
    Enum.find_value(timed, 0, fn {key, d, _} -> if key == action, do: d end)
  end

  defp lead(_, _), do: 0

  # Which action, and so how long, is known only for action_completed naming it.
  defp inside_action(%{"event" => "action_completed"} = on, [_ | _], rel, at)
       when not is_map_key(on, "action"),
       do: [fault(rel, at ++ ["on"], "inside_action")]

  defp inside_action(%{"event" => "custom_event", "custom" => custom}, timed, rel, at) do
    if Enum.any?(timed, fn {_, _, outcomes} -> emits?(outcomes, custom) end),
      do: [fault(rel, at ++ ["on"], "inside_action")],
      else: []
  end

  defp inside_action(_, _, _, _), do: []

  defp emits?(%{} = outcomes, custom) do
    Enum.any?(outcomes, fn
      {_, %{"steps" => steps}} when is_list(steps) ->
        Enum.any?(steps, &match?(%{"event" => ^custom}, &1))

      _ ->
        false
    end)
  end

  defp emits?(_, _), do: false

  # At fire the event's subject is gone and `subject` would read the actor's body instead.
  defp subjects(%{"subject" => "subject"}, path), do: [path ++ ["subject"]]

  defp subjects(%{} = v, path),
    do: Enum.flat_map(v, fn {k, x} -> subjects(x, path ++ [k]) end)

  defp subjects(v, path) when is_list(v) do
    v |> Enum.with_index() |> Enum.flat_map(fn {x, i} -> subjects(x, path ++ [i]) end)
  end

  defp subjects(_, _), do: []

  defp rules(rel, {:reaction, key, at}, rule, lead) do
    # The list narrates as a whole, so a stretch with no line of its own is not a silent write.
    told = Enum.any?(rule["steps"], &(&1["op"] == "narrate"))
    shared = if told, do: Map.put(rule, "silent", true), else: rule

    rule["steps"]
    |> stretches(after_of(rule))
    |> Enum.with_index()
    |> Enum.map(fn {{total, steps}, n} ->
      value = %{shared | "steps" => steps}
      value = if total > 0, do: Map.put(value, "after", total + lead), else: value
      {rel, {:reaction, if(n == 0, do: key, else: "#{key}_wait_#{n}"), at}, value}
    end)
  end

  # `{after, steps}` per stretch, in list order; a leading wait leaves no stretch before it.
  defp stretches(steps, total) do
    steps
    |> Enum.reduce([{total, []}], fn
      %{"op" => "wait", "seconds" => n}, [{t, _} | _] = acc -> [{t + n, []} | acc]
      s, [{t, ss} | acc] -> [{t, ss ++ [s]} | acc]
    end)
    |> Enum.reverse()
    |> Enum.reject(fn {_, ss} -> ss == [] end)
  end

  defp after_of(rule) do
    Map.get(rule, "after", 0)
  end

  defp wait?(s), do: match?(%{"op" => "wait"}, s)

  defp seconds?(%{"seconds" => n} = s),
    do: is_integer(n) and n >= 1 and map_size(s) == 2

  defp seconds?(_), do: false

  defp fault(rel, path, why) do
    {"SCHEMA_VIOLATION", {rel, path}, %{"error" => "invalid_value", "why" => "wait_" <> why}}
  end

  @doc "The source schema of a reaction: its list takes a wait, which `lower/1` removes before the contract reads it."
  def schema(s) do
    wait = %{
      "type" => "object",
      "description" =>
        "Run the steps after it this many logical seconds later, as a sibling delayed rule with the same `on` and `when`; `when` is read again when they run.",
      "required" => ["op", "seconds"],
      "additionalProperties" => false,
      "properties" => %{
        "op" => %{"const" => "wait"},
        "seconds" => %{
          "type" => "integer",
          "minimum" => 1,
          "maximum" => @max,
          "description" => "Logical seconds, added to the rule's `after` and the waits before it."
        }
      }
    }

    update_in(s, ["properties", "steps"], fn steps ->
      steps
      |> Map.update!("items", &%{"anyOf" => [&1, wait]})
      |> Map.put("description", "The steps in order; a `wait` splits them in time.")
    end)
  end
end
