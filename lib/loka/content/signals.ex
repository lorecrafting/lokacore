defmodule Loka.Content.Signals do
  @moduledoc """
  Signals: in a reaction's `apply`, `{"op": "signal", "signal": "<name>"}` lowers to a
  `fact.adjust` by 1 of the generated player fact `signal_<name>`, and the trigger `{"event":
  "signal", "signal": "<name>"}` to `fact_changed` on it (docs/system/cartridge.md, Source
  shortcuts). It returns faults; Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  # ponytail: max 2^53-2, so a send into a full counter clamps and stays silent (fact.ts:254); at
  # 2^53-1 int.ts add overflows before the clamp (loka-kgd.195).
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
    named =
      for {_, {:reaction, _, _}, %{"apply" => steps}} <- files,
          is_list(steps),
          %{"op" => "signal", "signal" => name} <- steps,
          uniq: true,
          do: name

    # A name is lowered only when it and its generated fact are both Keys.
    sent = Enum.filter(named, &(key?(&1) and key?(fact(&1))))
    {files, unheard} = files |> Enum.map(&rule(&1, {sent, named})) |> Enum.unzip()
    {files, taken} = facts(files, Enum.sort(sent))
    {files, List.flatten(unheard) ++ taken}
  end

  defp rule({rel, {:reaction, _, _} = id, %{"apply" => apply} = value}, {sent, _} = names)
       when is_list(apply),
       do: listen({rel, id, %{value | "apply" => Enum.map(apply, &sending(&1, sent))}}, names)

  defp rule(file, names), do: listen(file, names)

  defp listen(
         {rel, {:reaction, _, steps} = id,
          %{"on" => %{"event" => "signal", "signal" => name} = on} = value},
         {sent, named}
       )
       when is_binary(name) and not is_map_key(on, "fact") do
    cond do
      name in sent ->
        on =
          on
          |> Map.delete("signal")
          |> Map.merge(%{"event" => "fact_changed", "fact" => fact(name)})

        {{rel, id, %{value | "on" => on}}, []}

      # Its sending step is refused at apply[i].op; the listener adds nothing of its own.
      name in named ->
        {{rel, id, :invalid}, []}

      true ->
        at = {rel, steps ++ ["on", "signal"]}
        {{rel, id, :invalid}, [{"UNRESOLVED_REFERENCE", at, %{"target" => name}}]}
    end
  end

  defp listen(file, _), do: {file, []}

  # A bad name or an authored fact or amount stays a signal step, so the schema refuses it there.
  # Other members stay too, so the schema still refuses them at the author's step.
  defp sending(%{"op" => "signal", "signal" => name} = step, sent)
       when not is_map_key(step, "fact") and not is_map_key(step, "amount") do
    if name in sent,
      do:
        step
        |> Map.delete("signal")
        |> Map.merge(%{"op" => "fact.adjust", "fact" => fact(name), "amount" => 1}),
      else: step
  end

  defp sending(step, _), do: step

  # No signal, no generated facts.json. An undecodable or malformed one takes nothing; its own
  # diagnostic stands.
  defp facts(files, []), do: {files, []}

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

  defp key?(name), do: Contracts.validate("Key", name) == :ok
  defp fact(name), do: "signal_" <> name
  defp meaning(name), do: "Signal #{name} (compiler-generated)."
end
