defmodule Loka.Content.ChoiceOrder do
  @moduledoc """
  A scene's choices show as written. The runtime shows a dialogue's choices sorted by key
  (dialogue/selection.ts, choiceIds), so where the written order is not sorted the cartridge's keys
  take a number. Only the artifact sees it: errors, sidecars, nested dialogues and `once` facts keep
  the key made of the words. Runs after every check.
  """

  @doc "Definitions with each `choice_order` applied to its dialogue's choice keys and dropped."
  @spec lower(map()) :: map()
  def lower(defs) do
    names =
      for {k, {_, _, %{"choice_order" => order, "choices" => cs}}} <- defs["dialogue"],
          into: %{},
          do: {k, names(order, Map.keys(cs))}

    %{
      defs
      | "dialogue" => Map.new(defs["dialogue"], &dialogue(&1, names)),
        "story_point" => Map.new(defs["story_point"], &point(&1, names))
    }
  end

  # A choice a sidecar added follows the written ones.
  defp names(order, keys) do
    written = Enum.filter(order, &(&1 in keys))

    (written ++ Enum.sort(keys -- written))
    |> Enum.with_index(1)
    |> Map.new(fn {c, i} ->
      # A key stays within its 64 characters; the number alone keeps it unique.
      {c, "c#{String.pad_leading("#{i}", 3, "0")}_#{String.slice(c, 0, 59)}"}
    end)
  end

  defp dialogue({k, {rel, steps, %{"choice_order" => _} = d}}, names) do
    to = names[k]
    d = d |> Map.delete("choice_order") |> Map.update!("choices", &rekey(&1, to))

    d =
      case d do
        %{"riddle" => %{"choice_id" => c}} -> put_in(d, ["riddle", "choice_id"], to[c])
        _ -> d
      end

    {k, {rel, steps, d}}
  end

  defp dialogue(entry, _), do: entry

  defp rekey(choices, to), do: Map.new(choices, fn {c, o} -> {to[c], o} end)

  defp point({p, {rel, steps, v}}, names) do
    outcomes =
      Map.new(v["outcomes"], fn
        {o, %{"dialogue" => %{"key" => k}, "choice" => c} = t} when is_map_key(names, k) ->
          {o, %{t | "choice" => names[k][c]}}

        other ->
          other
      end)

    {p, {rel, steps, %{v | "outcomes" => outcomes}}}
  end
end
