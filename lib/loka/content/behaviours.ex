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
    {files, faults} = files |> Enum.map(&hold(&1, Map.new(named))) |> Enum.unzip()
    {List.flatten(files), List.flatten(refused) ++ List.flatten(faults)}
  end

  # name => [{rel, steps, rule, value}]; a refused or undecodable behaviour stays known, with no
  # rules, so its holders add no second cause.
  defp rules({rel, {_, name, steps}, %{} = value}) do
    extra =
      for m <- Map.keys(value), m != "reactions", do: {"UNKNOWN_FIELD", {rel, steps ++ [m]}, %{}}

    case value["reactions"] do
      %{} = rs -> {{name, for({r, v} <- rs, do: {rel, steps ++ ["reactions", r], r, v})}, extra}
      _ -> {{name, []}, [invalid_type(rel, steps ++ ["reactions"]) | extra]}
    end
  end

  defp rules({_, {_, name, _}, :invalid}), do: {{name, []}, []}
  defp rules({rel, {_, name, steps}, _}), do: {{name, []}, [invalid_type(rel, steps)]}

  defp hold({rel, {kind, holder, steps} = id, %{"behaviours" => names} = value}, named)
       when kind in [:npc, :item] do
    held = {rel, id, Map.delete(value, "behaviours")}

    if is_list(names) and Enum.all?(names, &(Contracts.validate("Key", &1) == :ok)) do
      # A name listed twice counts once, at its first index.
      names = names |> Enum.with_index() |> Enum.uniq_by(&elem(&1, 0))

      {[held | for({n, _} <- names, c <- Map.get(named, n, []), do: copy(c, holder))],
       for {n, i} <- names, not is_map_key(named, n) do
         at = {rel, steps ++ ["behaviours", i]}
         {"UNRESOLVED_REFERENCE", at, %{"target" => "behaviours/" <> n}}
       end}
    else
      {[held], [invalid_type(rel, steps ++ ["behaviours"])]}
    end
  end

  defp hold(file, _), do: {[file], []}

  # A copy keeps the behaviour rule's location, so each diagnostic reports once there.
  defp copy({rel, steps, rule, value}, holder),
    do: {rel, {:reaction, "#{rule}_#{holder}", steps}, fill(value, holder)}

  defp fill(%{"param" => "holder"} = marker, holder) when map_size(marker) == 1, do: holder
  defp fill(%{} = map, holder), do: Map.new(map, fn {k, v} -> {k, fill(v, holder)} end)
  defp fill(list, holder) when is_list(list), do: Enum.map(list, &fill(&1, holder))
  defp fill(value, _), do: value

  defp invalid_type(rel, steps),
    do: {"SCHEMA_VIOLATION", {rel, steps}, %{"error" => "invalid_type"}}
end
