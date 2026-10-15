defmodule Loka.Content.Voices do
  @moduledoc """
  Toolbox row FD2: a room's or detail's asides and the skill_compare leaf need kernel_api 1.91,
  and each aside's text has a catalog entry. Twin of kernel/ts/src/content/cartridge_voices.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  alias Loka.Content.RoomParts

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  @spec check(map() | nil, map(), tuple() | nil) :: [map()]
  def check(nil, _, _), do: []

  def check(m, defs, v2) do
    asides =
      for {_, {rel, [], r}} <- defs["room"],
          {steps, a} <- RoomParts.asides(r),
          do: {rel, steps, a}

    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    texts(asides, v2) ++
      if (asides != [] or leaf?(defs)) and api < [1, 91],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []
  end

  defp texts(_, nil), do: []

  defp texts(asides, {_, text}),
    do:
      for(
        {rel, steps, %{"text" => t}} <- asides,
        not is_map_key(text, t),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["text"]), %{"target" => t})
      )

  defp leaf?(%{"op" => "skill_compare"}), do: true
  defp leaf?(v) when is_map(v), do: Enum.any?(Map.values(v), &leaf?/1)
  defp leaf?(v) when is_list(v), do: Enum.any?(v, &leaf?/1)
  defp leaf?(v) when is_tuple(v), do: leaf?(Tuple.to_list(v))
  defp leaf?(_), do: false
end
