defmodule Loka.Content.Requires do
  @moduledoc """
  A manifest's requires and supported_profiles (05 §3, §4): the kernel_api range, the pinned
  content_schema and rule_ir, and each required capability against the capability registry.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2]

  @supported_pin 1

  @doc "Diagnostics for a schema-valid manifest's requires and supported_profiles."
  @spec check(String.t(), map(), [map()]) :: [map()]
  def check(rel, %{"requires" => req} = m, registry) do
    offline? = "offline_private" in m["supported_profiles"]

    range(rel, req["kernel_api"]) ++
      elapsed(rel, m) ++
      pins(rel, req) ++
      Enum.flat_map(req["capabilities"], &capability(rel, &1, offline?, registry))
  end

  @doc "Minimum API for optional authored features."
  @spec features(map() | nil, list()) :: [map()]
  def features(nil, _), do: []

  def features(m, all) do
    minimum = minimum_feature_api(m, all)

    if version(m["requires"]["kernel_api"]["at_least"]) < minimum,
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp minimum_feature_api(m, all) do
    cond do
      is_map_key(m["requires"]["capabilities"], "skills") ->
        [1, 18]

      Enum.any?(all, fn {_, _, d} -> debt_feature?(d) end) ->
        [1, 14]

      is_map_key(m["requires"]["capabilities"], "escort") ->
        [1, 11]

      Enum.any?(all, fn {_, _, d} -> transfer_feature?(d) end) ->
        [1, 10]

      Enum.any?(all, fn {_, _, d} -> variant_feature?(d) end) ->
        [1, 9]

      true ->
        []
    end
  end

  defp variant_feature?(d),
    do: is_map_key(d, "riddle") or get_in(d, ["journal", "active_variants"]) != nil

  defp debt_feature?(d) do
    is_map_key(d, "deadline") or is_map_key(d, "resource_starts") or
      Enum.any?(Map.values(Map.get(d, "choices", %{})), fn choice ->
        is_map_key(choice, "payment") or is_map_key(choice, "availability") or
          (is_map_key(choice, "receive") and is_map_key(choice, "accept"))
      end)
  end

  defp transfer_feature?(d) do
    is_map_key(d, "give_allowed") or
      (not is_map_key(d, "quest") and
         Enum.any?(Map.get(d, "choices", %{}), fn {_, o} -> is_map_key(o, "receive") end))
  end

  defp elapsed(rel, %{"time_policy" => _} = m) do
    range =
      if version(m["requires"]["kernel_api"]["at_least"]) < [1, 1],
        do: [diag("KERNEL_API_RANGE_INVALID", at(rel, ["requires", "kernel_api", "at_least"]))],
        else: []

    owner =
      if is_map_key(m["requires"]["capabilities"], "schedule"),
        do: [],
        else: [
          diag("UNDECLARED_CAPABILITY", at(rel, ["time_policy"]), %{"capability" => "schedule"}, [
            "schedule@1"
          ])
        ]

    range ++ owner
  end

  defp elapsed(_, _), do: []

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
