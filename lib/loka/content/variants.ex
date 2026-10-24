defmodule Loka.Content.Variants do
  @moduledoc """
  Toolbox row W6: an entity text variant (all but an item's older `room_line_variants`) or a
  `status_active` or `npc_present` leaf needs kernel_api 1.46; a `status_active` leaf reading
  `self` or `subject` (status reader 1, row G3) 1.53; a `resource_compare` with `subject` or
  `at_least_percent` (row 39) 1.87; a room's or detail's `asides` or a `skill_compare` leaf
  (row FD2) 1.91; world.identity (rows W15, FD9) 1.97; an `item_present` leaf (Homestead hs-6)
  1.102; an NPC's `asides` (row FD10) 1.107; an NPC's or item's name `words` (loka-6qi) 1.118.
  Twin of kernel/ts/src/content/cartridge_variants.ts.
  """
  import Loka.Content.Source, only: [diag: 3]
  alias Loka.Content.{Entities, RoomParts}

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    {used, floor} = need(defs, settings)

    if used and api < floor,
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  # The floor ladder, newest first: the first feature present sets the floor.
  defp need(defs, settings) do
    relative = relative?(defs) or relative?(settings)
    voices = voice?(defs) or aside?(defs)
    identity = is_map_key(settings["world"] || %{}, "identity")
    words = Enum.any?(Entities.all(defs), fn {_, _, e} -> is_map_key(e, "words") end)

    titled =
      Enum.any?(
        for {_, {_, [], r}} <- Map.get(defs, "room", %{}),
            {_, d} <- Map.get(r, "details", %{}),
            do: is_map_key(d, "title")
      )

    ladder = [
      {titled, [1, 120]},
      {words, [1, 118]},
      {remarks?(defs), [1, 107]},
      {furnish?([defs, settings]), [1, 102]},
      {identity, [1, 97]},
      {voices, [1, 91]},
      {relative, [1, 87]},
      {reader?(defs) or reader?(settings), [1, 53]}
    ]

    {Enum.any?([titled, words, identity, voices, relative]) or used?(defs, settings),
     Enum.find_value(ladder, [1, 46], fn {on, floor} -> on && floor end)}
  end

  defp used?(defs, settings),
    do: Enum.any?(Entities.all(defs), &variant?/1) or leaf?(defs) or leaf?(settings)

  defp variant?({kind, _, e}),
    do:
      Map.has_key?(e, "short_variants") or Map.has_key?(e, "description_variants") or
        (kind == "npc" and Map.has_key?(e, "room_line_variants"))

  defp leaf?(%{"op" => op}) when op in ["status_active", "npc_present", "item_present"], do: true
  defp leaf?(v) when is_map(v), do: Enum.any?(Map.values(v), &leaf?/1)
  defp leaf?(v) when is_list(v), do: Enum.any?(v, &leaf?/1)
  defp leaf?(v) when is_tuple(v), do: leaf?(Tuple.to_list(v))
  defp leaf?(_), do: false

  # Twin of TS asideParts (rooms, details and, row FD10, NPCs): never a key named so elsewhere.
  defp aside?(defs),
    do:
      remarks?(defs) or
        Enum.any?(
          for({_, {_, [], r}} <- Map.get(defs, "room", %{}), do: RoomParts.asides(r) != [])
        )

  defp remarks?(defs),
    do: Enum.any?(for {_, {_, [], n}} <- Map.get(defs, "npc", %{}), do: is_map_key(n, "asides"))

  defp furnish?(%{"op" => "item_present"}), do: true
  defp furnish?(v) when is_map(v), do: Enum.any?(Map.values(v), &furnish?/1)
  defp furnish?(v) when is_list(v), do: Enum.any?(v, &furnish?/1)
  defp furnish?(v) when is_tuple(v), do: furnish?(Tuple.to_list(v))
  defp furnish?(_), do: false

  defp voice?(%{"op" => "skill_compare"}), do: true
  defp voice?(v) when is_map(v), do: Enum.any?(Map.values(v), &voice?/1)
  defp voice?(v) when is_list(v), do: Enum.any?(v, &voice?/1)
  defp voice?(v) when is_tuple(v), do: voice?(Tuple.to_list(v))
  defp voice?(_), do: false

  defp reader?(%{"op" => "status_active", "subject" => s}) when s != "target", do: true
  defp reader?(v) when is_map(v), do: Enum.any?(Map.values(v), &reader?/1)
  defp reader?(v) when is_list(v), do: Enum.any?(v, &reader?/1)
  defp reader?(v) when is_tuple(v), do: reader?(Tuple.to_list(v))
  defp reader?(_), do: false

  defp relative?(%{"op" => "resource_compare"} = p)
       when is_map_key(p, "subject") or is_map_key(p, "at_least_percent"),
       do: true

  defp relative?(v) when is_map(v), do: Enum.any?(Map.values(v), &relative?/1)
  defp relative?(v) when is_list(v), do: Enum.any?(v, &relative?/1)
  defp relative?(v) when is_tuple(v), do: relative?(Tuple.to_list(v))
  defp relative?(_), do: false
end
