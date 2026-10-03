defmodule Loka.Content.Requires do
  @moduledoc """
  A manifest's requires and supported_profiles (05 §3, §4): the kernel_api range, the pinned
  content_schema and rule_ir, and each required capability against the capability registry.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]

  @supported_pin 1

  @doc "Diagnostics for a schema-valid manifest's requires and supported_profiles."
  @spec check(String.t(), map(), [map()]) :: [map()]
  def check(rel, %{"requires" => req} = m, registry) do
    offline? = "offline_private" in m["supported_profiles"]

    range(rel, req["kernel_api"]) ++
      pins(rel, req) ++
      Enum.flat_map(req["capabilities"], &capability(rel, &1, offline?, registry))
  end

  defp range(rel, %{"at_least" => low, "below" => high}) do
    if version(low) >= version(high),
      do: [diag("KERNEL_API_RANGE_INVALID", at(rel, ["requires", "kernel_api"]))],
      else: []
  end

  defp pins(rel, req) do
    for field <- ~w(content_schema rule_ir), req[field] != @supported_pin do
      data = %{"field" => field, "declared" => req[field], "supported" => @supported_pin}
      diag("PINNED_VERSION_UNSUPPORTED", at(rel, ["requires", field]), data)
    end
  end

  defp version(v), do: v |> String.split(".") |> Enum.map(&String.to_integer/1)

  defp capability(rel, {key, v}, offline?, registry) do
    path = at(rel, ["requires", "capabilities", key])

    case Enum.find(registry, &(&1["key"] == key and &1["version"] == v)) do
      nil -> [diag("UNKNOWN_CAPABILITY", path)]
      %{"portability" => "server_only"} when offline? -> [diag("SERVER_ONLY_CAPABILITY", path)]
      _ -> []
    end
  end
end
