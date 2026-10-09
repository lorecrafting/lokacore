defmodule Loka.Content.Derived do
  @moduledoc "Checks toolbox row 2 derived-stat tables (world.derived); twin of cartridge_derived.ts."
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 4, ref: 3]
  alias Loka.Content.Refs

  # hp_max needs the hp pool, which every compiled cartridge has (Resources @defaults).
  @needs %{"hit_chance" => "combat", "damage" => "combat", "carry_grams" => "carry"}

  def settings(%{"world" => %{"derived" => d}} = settings, m),
    do: put_in(settings, ["world", "derived"], Map.new(d, fn {k, s} -> {k, expand(s, m)} end))

  def settings(settings, _), do: settings

  defp expand(stat, m),
    do:
      Map.update!(
        stat,
        "terms",
        &Enum.map(&1, fn t -> Map.update!(t, "attribute", fn a -> ref(a, "attribute", m) end) end)
      )

  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    case get_in(settings, ["world", "derived"]) do
      nil -> []
      table -> gate(m, table) ++ Enum.flat_map(table, &stat(&1, m, defs, settings["world"]))
    end
  end

  defp gate(m, table) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    api =
      if version < if(table["hp_max"], do: [1, 40], else: [1, 39]),
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    cap =
      if m["requires"]["capabilities"]["attributes"] == 1,
        do: [],
        else: [
          diag(
            "UNDECLARED_CAPABILITY",
            "cartridge.world.derived",
            %{"capability" => "attributes"},
            [
              "attributes@1"
            ]
          )
        ]

    api ++ cap
  end

  defp stat({key, stat}, m, defs, world) do
    path = ["world", "derived", key]

    needs =
      if @needs[key] == nil or is_map_key(world, @needs[key]),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at("cartridge.json", path))]

    needs ++
      for {term, i} <- Enum.with_index(stat["terms"]),
          d <- Refs.reference("cartridge.json", path ++ ["terms", i], "attribute", term, m, defs),
          do: d
  end
end
