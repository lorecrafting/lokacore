defmodule Loka.Content.Behaviours do
  @moduledoc """
  Behaviours: `behaviours/<name>.json` holds `{"reactions": {"<rule>": rule}}`, and an NPC or item
  listing `"behaviours": ["<name>"]` gets one copy `<rule>_<holder>` of each rule, with every
  `{"param": "holder"}` replaced by its key (docs/system/cartridge.md, Source shortcuts).
  `expand/1` removes every behaviour and strips `behaviours` from every NPC and item. It returns
  faults; Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  @doc "Every behaviour replaced by its copies on its holders; Zones.expand refuses a repeated key."
  @spec expand([entry()]) :: {[entry()], [fault()]}
  def expand(files) do
    {defs, files} = Enum.split_with(files, &match?({_, {:behaviour, _, _}, _}, &1))
    {named, refused} = defs |> Enum.map(&rules/1) |> Enum.unzip()
    named = Map.new(named)
    {files, faults} = files |> Enum.map(&hold(&1, named)) |> Enum.unzip()
    {List.flatten(files), List.flatten(refused) ++ List.flatten(faults)}
  end

  # name => [{rel, steps, rule, value}]; a refused or undecodable behaviour stays known, with no
  # rules, so its holders add no second cause.
  defp rules({rel, {_, name, steps}, %{} = value}) do
    extra =
      for m <- Map.keys(value), m != "reactions", do: {"UNKNOWN_FIELD", {rel, steps ++ [m]}, %{}}

    {rs, bad} = reactions({rel, steps ++ ["reactions"]}, value["reactions"])
    {{name, rs}, bad ++ extra}
  end

  defp rules({_, {_, name, _}, :invalid}), do: {{name, []}, []}
  defp rules({rel, {_, name, steps}, _}), do: {{name, []}, [invalid_type({rel, steps})]}

  defp reactions({rel, steps}, %{} = rs),
    do: {for({r, v} <- rs, do: {rel, steps ++ [r], r, v}), []}

  defp reactions(at, _), do: {[], [invalid_type(at)]}

  defp hold({rel, {kind, holder, steps} = id, %{"behaviours" => names} = value}, named)
       when kind in [:npc, :item] do
    {copies, faults} = copies(names, named, holder, {rel, steps ++ ["behaviours"]})
    {[{rel, id, Map.delete(value, "behaviours")} | copies], faults}
  end

  defp hold(file, _), do: {[file], []}

  defp copies(names, named, holder, at) do
    if keys?(names) do
      # A name listed twice counts once, at its first index.
      names = names |> Enum.with_index() |> Enum.uniq_by(&elem(&1, 0))
      {known, unknown} = Enum.split_with(names, fn {n, _} -> is_map_key(named, n) end)

      {for({n, _} <- known, c <- named[n], do: copy(c, holder)),
       Enum.map(unknown, &unresolved(at, &1))}
    else
      {[], [invalid_type(at)]}
    end
  end

  defp keys?(names),
    do: is_list(names) and Enum.all?(names, &(Contracts.validate("Key", &1) == :ok))

  defp unresolved({rel, steps}, {name, i}),
    do: {"UNRESOLVED_REFERENCE", {rel, steps ++ [i]}, %{"target" => "behaviours/" <> name}}

  # A copy keeps the behaviour rule's location, so each diagnostic reports once there.
  defp copy({rel, steps, rule, value}, holder),
    do: {rel, {:reaction, "#{rule}_#{holder}", steps}, fill(value, holder)}

  defp fill(%{"param" => "holder"} = marker, holder) when map_size(marker) == 1, do: holder
  defp fill(%{} = map, holder), do: Map.new(map, fn {k, v} -> {k, fill(v, holder)} end)
  defp fill(list, holder) when is_list(list), do: Enum.map(list, &fill(&1, holder))
  defp fill(value, _), do: value

  defp invalid_type(at), do: {"SCHEMA_VIOLATION", at, %{"error" => "invalid_type"}}
end
