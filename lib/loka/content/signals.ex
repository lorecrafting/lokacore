defmodule Loka.Content.Signals do
  @moduledoc """
  Signals: in a reaction's `apply`, `{"op": "signal", "signal": "<name>"}` lowers to a
  `fact.adjust` by 1 of the generated player fact `signal_<name>`, and the trigger `{"event":
  "signal", "signal": "<name>"}` to `fact_changed` on it (docs/system/cartridge.md, Source
  shortcuts). It returns faults; Source builds the diagnostics, so this module never calls Source.
  """

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  # ponytail: max 2^53-2, so a send into a full counter clamps and stays silent (fact.ts:254); at
  # 2^53-1 int.ts add overflows before the clamp (loka-kgd.195). An event.emit step lifts the cap.
  @spec_of %{
    "version" => 1,
    "value_type" => %{
      "type" => "int",
      "minimum" => 0,
      "maximum" => 9_007_199_254_740_990,
      "default" => 0
    },
    "scopes" => ["player"]
  }

  @doc "Every sending step and listener lowered, and one generated fact per name sent."
  @spec lower([entry()]) :: {[entry()], [fault()]}
  def lower(files) do
    sent =
      for {_, {:reaction, _, _}, %{"apply" => steps}} <- files,
          is_list(steps),
          %{"op" => "signal", "signal" => name} when is_binary(name) <- steps,
          uniq: true,
          do: name

    {files, unheard} = files |> Enum.map(&rule(&1, sent)) |> Enum.unzip()
    {files, taken} = facts(files, Enum.sort(sent))
    {files, List.flatten(unheard) ++ taken}
  end

  defp rule({rel, {:reaction, _, _} = id, %{"apply" => apply} = value}, sent) when is_list(apply),
    do: listen({rel, id, %{value | "apply" => Enum.map(apply, &sending/1)}}, sent)

  defp rule(file, sent), do: listen(file, sent)

  defp listen(
         {rel, {:reaction, _, steps} = id,
          %{"on" => %{"event" => "signal", "signal" => name} = on} = value},
         sent
       )
       when is_binary(name) do
    if name in sent do
      on =
        on
        |> Map.delete("signal")
        |> Map.merge(%{"event" => "fact_changed", "fact" => fact(name)})

      {{rel, id, %{value | "on" => on}}, []}
    else
      at = {rel, steps ++ ["on", "signal"]}
      {{rel, id, :invalid}, [{"UNRESOLVED_REFERENCE", at, %{"target" => name}}]}
    end
  end

  defp listen(file, _), do: {file, []}

  # Other members stay, so the schema still refuses them at the author's step.
  defp sending(%{"op" => "signal", "signal" => name} = step) when is_binary(name),
    do:
      step
      |> Map.delete("signal")
      |> Map.merge(%{"op" => "fact.adjust", "fact" => fact(name), "amount" => 1})

  defp sending(step), do: step

  # An undecodable or malformed facts.json takes nothing; its own diagnostic stands.
  defp facts(files, names) do
    case List.keyfind(files, "facts.json", 0, {"facts.json", :facts, %{"facts" => %{}}}) do
      {_, _, %{"facts" => %{} = authored} = file} ->
        {taken, new} = Enum.split_with(names, &Map.has_key?(authored, fact(&1)))
        generated = Map.new(new, &{fact(&1), Map.put(@spec_of, "meaning", meaning(&1))})
        file = %{file | "facts" => Map.merge(authored, generated)}

        {List.keystore(files, "facts.json", 0, {"facts.json", :facts, file}),
         for(n <- taken, do: {"FACT_NAME_COLLISION", {"facts.json", ["facts", fact(n)]}, %{}})}

      _ ->
        {files, []}
    end
  end

  defp fact(name), do: "signal_" <> name
  defp meaning(name), do: "Signal #{name} (compiler-generated)."
end
