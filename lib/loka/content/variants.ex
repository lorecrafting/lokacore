defmodule Loka.Content.Variants do
  @moduledoc """
  Toolbox row W6: an entity text variant (all but an item's older `room_line_variants`) or a
  `status_active` or `npc_present` leaf needs kernel_api 1.46. Twin of
  kernel/ts/src/content/cartridge_variants.ts.
  """
  import Loka.Content.Source, only: [diag: 3]
  alias Loka.Content.Entities

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if (Enum.any?(Entities.all(defs), &variant?/1) or leaf?(defs) or leaf?(settings)) and
         api < [1, 46],
       do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
       else: []
  end

  defp variant?({kind, _, e}),
    do:
      Map.has_key?(e, "short_variants") or Map.has_key?(e, "description_variants") or
        (kind == "npc" and Map.has_key?(e, "room_line_variants"))

  defp leaf?(%{"op" => op}) when op in ["status_active", "npc_present"], do: true
  defp leaf?(v) when is_map(v), do: Enum.any?(Map.values(v), &leaf?/1)
  defp leaf?(v) when is_list(v), do: Enum.any?(v, &leaf?/1)
  defp leaf?(v) when is_tuple(v), do: leaf?(Tuple.to_list(v))
  defp leaf?(_), do: false
end
