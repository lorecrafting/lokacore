defmodule Loka.Content.Lint do
  @moduledoc """
  Author-time lints for a story cartridge's source (pass-1 analysis rows 1, 3, 3b, 5 and 6;
  docs/CHECKS.md). Each finding is one line naming the file and key. The loader never runs
  these: a sampler may break them on purpose.
  """

  alias Loka.Content.Source

  @writes ~w(status.apply fact.assign fact.adjust)
  @always %{"op" => "all", "items" => []}

  @doc "The findings for the source directory `dir`."
  @spec run(Path.t()) :: [String.t()]
  def run(dir) do
    {files, _} = Source.load(dir)
    findings(Map.new(for {rel, _, value} <- files, is_map(value), do: {rel, value}))
  end

  @doc "The findings for decoded source files, keyed by their path relative to the cartridge."
  @spec findings(%{String.t() => map()}) :: [String.t()]
  def findings(files) do
    text = Map.get(files, "text.json", %{})

    files
    |> Enum.sort()
    |> Enum.flat_map(fn {rel, v} -> file(Path.split(rel), rel, v) end)
    |> Kernel.++(talk(files, text))
  end

  defp file(["recipes", _], rel, %{"policy" => %{"root" => root}} = r)
       when root != @always and not is_map_key(r, "reason"),
       do: ["#{rel}: policy refuses with no reason"]

  defp file(["reactions", _], rel, %{"apply" => steps} = r) do
    ops = Enum.map(steps, & &1["op"])

    if Enum.any?(ops, &(&1 in @writes)) and "narrate" not in ops and r["silent"] != true,
      do: ["#{rel}: writes state with no narrate step and no \"silent\": true"],
      else: []
  end

  defp file(["npcs", _], rel, %{"disposition" => %{"hostile" => _} = d, "attack" => _})
       when not is_map_key(d, "engage") and not is_map_key(d, "arrest"),
       do: ["#{rel}: hostile with an attack but no disposition.engage line"]

  defp file(["rooms", _], rel, room) do
    titles =
      for {key, %{"readable" => r}} <- Enum.sort(room["details"] || %{}),
          !is_map_key(r, "title"),
          do: "#{rel}: readable details.#{key} has no title"

    titles ++ shadowed(rel, room["variants"] || [])
  end

  defp file(["resources.json"], rel, %{"resources" => rs}),
    do: for({key, %{"bands" => b}} <- Enum.sort(rs), top(b), do: "#{rel}: #{key} bands #{top(b)}")

  defp file(["cartridge.json"], rel, %{"world" => %{"bands" => b}}),
    do: if(top(b), do: ["#{rel}: world.bands #{top(b)}"], else: [])

  defp file(_, _, _), do: []

  # The kernel draws the first band whose cut the percentage reaches, so a lone normal cut at 100
  # shows any value below the maximum in the next band's colour (pass-1 UK).
  defp top([_ | _] = bands) do
    if Enum.any?(bands, &(&1["tone"] == "normal" and &1["at_percent"] < 100)),
      do: nil,
      else: "have no normal band below 100%"
  end

  defp top(_), do: nil

  # First match wins, so an earlier variant whose guard terms (an all-guard's items, else the
  # guard itself) are a subset of a later one's always wins over it. ponytail: terms compare by
  # equality, so equivalent but differently written guards pass; a guard evaluator is the upgrade.
  defp shadowed(rel, variants) do
    indexed = Enum.with_index(variants)

    for {a, i} <- indexed,
        {b, j} <- indexed,
        i < j,
        Enum.all?(conds(a), &(&1 in conds(b))),
        do: "#{rel}: variants[#{j}] is shadowed by variants[#{i}]"
  end

  defp conds(%{"when" => %{"root" => %{"op" => "all", "items" => items}}}), do: items
  defp conds(%{"when" => %{"root" => root}}), do: [root]
  defp conds(_), do: []

  # A dialogue without its own label is offered as the kernel's default action.talk (UH).
  defp talk(files, text) do
    bare? =
      Enum.any?(files, fn {rel, d} ->
        String.starts_with?(rel, "dialogues/") and !is_map_key(d, "label")
      end)

    if bare? and text["action.talk"] in [nil, ""],
      do: ["text.json: action.talk has no text, yet a dialogue has no label of its own"],
      else: []
  end
end
