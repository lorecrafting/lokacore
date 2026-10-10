defmodule Loka.Content.Exposure do
  @moduledoc """
  Toolbox row W25: a `wearing` leaf or a `clock_hour` reaction needs kernel_api 1.46. Twin of
  kernel/ts/src/content/cartridge_exposure.ts.
  """
  import Loka.Content.Source, only: [diag: 3]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if (used?(defs) or used?(settings)) and api < [1, 46],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp used?(%{"op" => "wearing"}), do: true
  defp used?(%{"event" => "clock_hour"}), do: true
  defp used?(v) when is_map(v), do: Enum.any?(Map.values(v), &used?/1)
  defp used?(v) when is_list(v), do: Enum.any?(v, &used?/1)
  defp used?(v) when is_tuple(v), do: used?(Tuple.to_list(v))
  defp used?(_), do: false
end
