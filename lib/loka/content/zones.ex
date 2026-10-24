defmodule Loka.Content.Zones do
  @moduledoc """
  Zones: a room's source-only `zones` lists the zones it belongs to, and a reaction with `"zone"`
  and no `on.room` stands for one copy `<rule>_<room>` per member room, in room-key order
  (docs/system/cartridge.md, Source shortcuts). `expand/1` strips `zones` from every room. It
  returns faults; Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  @doc "Every zone rule replaced by its copies; copy keys are checked for repeats afterwards."
  @spec expand([entry()]) :: {[entry()], [fault()]}
  def expand(files) do
    rooms = for {rel, {:room, room, steps}, %{"zones" => zs}} <- files, do: {rel, room, steps, zs}
    members = for {_, room, _, zs} <- rooms, keys?(zs), zone <- zs, do: {zone, room}

    # A room with malformed `zones` joins no zone.
    bad =
      for {rel, _, steps, zs} <- rooms,
          not keys?(zs),
          do: {"SCHEMA_VIOLATION", {rel, steps ++ ["zones"]}, invalid("type")}

    zones = members |> Enum.sort() |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
    {files, refused} = files |> Enum.map(&rule(&1, zones)) |> Enum.unzip()
    {List.flatten(files), bad ++ List.flatten(refused)}
  end

  defp keys?(zones),
    do: is_list(zones) and Enum.all?(zones, &(Contracts.validate("Key", &1) == :ok))

  defp rule({rel, {:room, _, _} = id, %{} = value}, _),
    do: {[{rel, id, Map.delete(value, "zones")}], []}

  defp rule(
         {rel, {:reaction, key, steps} = id, %{"zone" => zone, "on" => %{} = on} = value},
         zones
       )
       when is_binary(zone) do
    cond do
      Map.has_key?(on, "room") ->
        {[{rel, id, :invalid}],
         [{"SCHEMA_VIOLATION", {rel, steps ++ ["zone"]}, invalid("value")}]}

      not Map.has_key?(zones, zone) ->
        {[{rel, id, :invalid}],
         [{"UNRESOLVED_REFERENCE", {rel, steps ++ ["zone"]}, %{"target" => zone}}]}

      true ->
        copy = &%{Map.delete(value, "zone") | "on" => Map.put(on, "room", &1)}
        {for(r <- zones[zone], do: {rel, {:reaction, "#{key}_#{r}", steps}, copy.(r)}), []}
    end
  end

  defp rule(file, _), do: {[file], []}

  defp invalid(what), do: %{"error" => "invalid_" <> what}
end
