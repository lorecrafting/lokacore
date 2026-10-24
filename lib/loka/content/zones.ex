defmodule Loka.Content.Zones do
  @moduledoc """
  Zones: a room's source-only `zones` lists the zones it belongs to, and a reaction with `"zone"`
  and no `on.room` stands for one copy `<rule>_<room>` per member room, in room-key order
  (docs/system/cartridge.md, Source shortcuts). `expand/1` strips `zones` from every room. It
  returns faults; Source builds the diagnostics, so this module never calls Source.
  """

  alias Loka.Content.Bundles
  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t() | non_neg_integer()]}, map()}

  @doc "Every zone rule replaced by its copies; a copy that repeats a definition key is refused."
  @spec expand([entry()]) :: {[entry()], [fault()]}
  def expand(files) do
    # A room with malformed `zones` joins no zone.
    {good, bad} = files |> rooms() |> Enum.split_with(&keys?(elem(&1, 3)))
    zones = members(good)
    {files, refused} = files |> Enum.map(&rule(&1, zones)) |> Enum.unzip()
    {files, repeats} = Bundles.unique(List.flatten(files))
    {files, Enum.map(bad, &malformed/1) ++ List.flatten(refused) ++ repeats}
  end

  defp rooms(files),
    do: for({rel, {:room, room, steps}, %{"zones" => zs}} <- files, do: {rel, room, steps, zs})

  defp malformed({rel, _, steps, _}),
    do: {"SCHEMA_VIOLATION", {rel, steps ++ ["zones"]}, invalid("type")}

  # Zone => member rooms in room-key order.
  defp members(rooms) do
    pairs = for {_, room, _, zs} <- rooms, zone <- zs, do: {zone, room}
    pairs |> Enum.sort() |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  defp keys?(zones),
    do: is_list(zones) and Enum.all?(zones, &(Contracts.validate("Key", &1) == :ok))

  defp rule({rel, {:room, _, _} = id, %{} = value}, _),
    do: {[{rel, id, Map.delete(value, "zones")}], []}

  defp rule({rel, {:reaction, _, steps} = id, %{"zone" => zone, "on" => %{} = on} = v}, zones)
       when is_binary(zone) do
    cond do
      Map.has_key?(on, "room") ->
        {[{rel, id, :invalid}],
         [{"SCHEMA_VIOLATION", {rel, steps ++ ["zone"]}, invalid("value")}]}

      not Map.has_key?(zones, zone) ->
        target = %{"target" => zone}
        {[{rel, id, :invalid}], [{"UNRESOLVED_REFERENCE", {rel, steps ++ ["zone"]}, target}]}

      true ->
        {copies(rel, id, Map.delete(v, "zone"), zones[zone]), []}
    end
  end

  defp rule(file, _), do: {[file], []}

  defp copies(rel, {:reaction, key, steps}, value, rooms) do
    for r <- rooms, do: {rel, {:reaction, "#{key}_#{r}", steps}, put_in(value, ["on", "room"], r)}
  end

  defp invalid(what), do: %{"error" => "invalid_" <> what}
end
