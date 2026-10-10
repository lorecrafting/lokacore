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

    if (wearing?(defs) or wearing?(settings) or clock_hour?(defs["reaction"])) and api < [1, 46],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp clock_hour?(nil), do: false

  defp clock_hour?(reactions),
    do: Enum.any?(reactions, &match?({_, {_, _, %{"on" => %{"event" => "clock_hour"}}}}, &1))

  defp wearing?(%{"op" => "wearing"}), do: true
  defp wearing?(v) when is_map(v), do: Enum.any?(Map.values(v), &wearing?/1)
  defp wearing?(v) when is_list(v), do: Enum.any?(v, &wearing?/1)
  defp wearing?(v) when is_tuple(v), do: wearing?(Tuple.to_list(v))
  defp wearing?(_), do: false
end
