defmodule Loka.Content.Variety do
  @moduledoc """
  variety@1 (toolbox row W7): cartridge.json alternates is owned by variety@1, names only text
  catalog keys, and it or a visited_count leaf needs kernel_api 1.45. Twin of
  kernel/ts/src/content/cartridge_variety.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 2]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _, _), do: []

  def check(m, defs, {_, settings}, {v2, registry}) do
    alternates = settings["alternates"]
    text = if is_tuple(v2), do: elem(v2, 1), else: :unknown

    owner(m, alternates, registry) ++
      keys(alternates || %{}, text) ++
      floor(m, alternates != nil or leaf?(defs) or leaf?(settings))
  end

  defp owner(_, nil, _), do: []

  defp owner(m, _, registry),
    do:
      owned(
        at("cartridge.json", ["alternates"]),
        "alternates",
        {m["requires"]["capabilities"], owners(registry, ["definitions"])}
      )

  defp keys(_, :unknown), do: []

  defp keys(alternates, text) do
    for {key, more} <- alternates,
        {k, steps} <- [{key, [key]} | Enum.with_index(more, &{&1, [key, &2]})],
        not is_map_key(text, k),
        do:
          diag("UNRESOLVED_REFERENCE", at("cartridge.json", ["alternates" | steps]), %{
            "target" => k
          })
  end

  defp leaf?(%{"op" => "visited_count"}), do: true
  defp leaf?(v) when is_map(v), do: Enum.any?(Map.values(v), &leaf?/1)
  defp leaf?(v) when is_list(v), do: Enum.any?(v, &leaf?/1)
  defp leaf?(v) when is_tuple(v), do: leaf?(Tuple.to_list(v))
  defp leaf?(_), do: false

  defp floor(_, false), do: []

  defp floor(m, true) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if api < [1, 45],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end
end
