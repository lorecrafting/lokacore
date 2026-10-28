defmodule Loka.Content.Prose do
  @moduledoc """
  Inline prose: inside a definition, `{"prose": "<words>"}` stands for a text key. `lower/1`
  writes the generated key `<kind>.<key>.<path>` in its place and adds the words to the one
  `text.json` catalog (docs/system/cartridge.md, Source shortcuts). It returns faults; Source
  builds the diagnostics, so this module never calls Source (a call either way is an xref cycle).
  """

  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  @doc "Every marker replaced by its key; a key already in the catalog is DUPLICATE_KEY there."
  @spec lower([entry()]) :: {[entry()], [fault()]}
  def lower(files) do
    {files, lines} = Enum.map_reduce(files, [], &definition/2)

    case List.keyfind(files, "text.json", 0) do
      _ when lines == [] -> {files, []}
      nil -> catalog(files, %{}, lines)
      {_, _, %{} = text} -> catalog(files, text, lines)
      # An undecodable catalog takes nothing; its INVALID_JSON or DUPLICATE_KEY fails the build.
      _ -> {files, []}
    end
  end

  defp catalog(files, text, lines) do
    {text, faults} = lines |> Enum.reverse() |> Enum.reduce({text, []}, &add/2)
    {List.keystore(files, "text.json", 0, {"text.json", :text, text}), Enum.reverse(faults)}
  end

  # A line the catalog refuses is reported at the marker too; its words are still added, so the
  # marker resolves and the catalog reports at text["<key>"].
  defp add({key, words, at}, {text, faults}) do
    if Map.has_key?(text, key),
      do: {text, [{"DUPLICATE_KEY", at, %{"target" => key}} | faults]},
      else: {Map.put(text, key, words), Enum.reverse(refused(key, words, at)) ++ faults}
  end

  defp refused(key, words, at) do
    case Contracts.validate("TextCatalog", %{key => words}) do
      :ok ->
        []

      {:error, errors} ->
        for code <- Enum.uniq(Enum.map(errors, & &1.code)),
            do: {"SCHEMA_VIOLATION", at, %{"error" => Atom.to_string(code)}}
    end
  end

  # Root files are not lowered: only definitions carry a `{kind, key, steps}` id.
  defp definition({rel, {kind, key, steps} = id, %{} = value}, lines) do
    {value, lines} = walk(value, [], {rel, steps, "#{kind}.#{key}"}, lines)
    {{rel, id, value}, lines}
  end

  defp definition(file, lines), do: {file, lines}

  defp walk(%{"prose" => words} = marker, path, {rel, steps, prefix}, lines)
       when map_size(marker) == 1 and is_binary(words) and words != "" do
    key = Enum.join([prefix | Enum.map(path, &step/1)], ".")
    {key, [{key, words, {rel, steps ++ path}} | lines]}
  end

  defp walk(%{} = map, path, ctx, lines) do
    {pairs, lines} =
      Enum.map_reduce(map, lines, fn {k, v}, acc ->
        {v, acc} = walk(v, path ++ [k], ctx, acc)
        {{k, v}, acc}
      end)

    {Map.new(pairs), lines}
  end

  defp walk(list, path, ctx, lines) when is_list(list) do
    list
    |> Enum.with_index()
    |> Enum.map_reduce(lines, fn {v, i}, acc -> walk(v, path ++ [i], ctx, acc) end)
  end

  defp walk(other, _, _, lines), do: {other, lines}

  # The house convention names an NPC's or item's room line `<kind>.<key>.room`.
  defp step("room_line"), do: "room"
  defp step(step), do: to_string(step)
end
