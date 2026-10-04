defmodule Loka.Content.Resources do
  @moduledoc """
  `resources.json` and the engine's default pools (resource.schema.json ResourceSpec; 00 §4
  amendment, owner decision HP/MA/MV). The file is `{"resources": {key: fields}}`: a default
  pool's key (hp, ma, mv) overrides any of its fields, another key declares a whole
  ResourceSpec without `key`. Every loka-cartridge-v2 cartridge gets the three pools and
  resource@1 and schedule@1 (`requires/1`), with or without the file. `attributes.json`, the
  cartridge's attributes (attributes@1), loads here too (`attributes/1`), the same way.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2, schema: 4]
  alias Loka.Content.Refs
  alias Loka.Core.Contracts

  @rel "resources.json"
  @defaults %{
    "hp" => %{"minimum" => 0, "maximum" => 20, "start" => 20, "gain" => 5},
    "ma" => %{"minimum" => 0, "maximum" => 100, "start" => 100, "gain" => 4},
    "mv" => %{"minimum" => 0, "maximum" => 82, "start" => 82, "gain" => 18}
  }

  @doc """
  The resources, `key => {rel, steps, ResourceSpec} | :invalid`, and the diagnostics of the
  loaded `resources.json` (`[]` when absent; a file that failed to decode leaves the defaults):
  its schema, each spec's (UNKNOWN_FIELD for an authored key) and RESOURCE_SPEC_INVALID when
  minimum <= start <= maximum fails.
  """
  @spec load([{String.t(), term()}]) :: {map(), [map()]}
  def load([{rel, file}]) when file != :invalid do
    defs = Map.put(Contracts.defs(), "ResourcesFile", file_schema("resources"))

    case Contracts.validate("ResourcesFile", file, defs) do
      :ok -> specs(rel, file["resources"])
      {:error, es} -> {specs(rel, %{}) |> elem(0), schema(rel, [], file, es)}
    end
  end

  def load(_), do: specs(@rel, %{})

  @doc """
  The attributes of `attributes.json`, `{"attributes": {key: {start}}}` (cartridge.schema.json
  AttributeSpec without `key`): `key => {rel, steps, AttributeSpec} | :invalid` and the
  diagnostics (UNKNOWN_FIELD for an authored key); `:unknown` when the file is rejected.
  """
  @spec attributes([{String.t(), term()}]) :: {map() | :unknown, [map()]}
  def attributes([]), do: {%{}, []}
  def attributes([{_, :invalid}]), do: {:unknown, []}

  def attributes([{rel, file}]) do
    defs = Map.put(Contracts.defs(), "AttributesFile", file_schema("attributes"))

    case Contracts.validate("AttributesFile", file, defs) do
      :ok ->
        collect(
          rel,
          "attributes",
          for({k, f} <- file["attributes"], do: {k, attribute(rel, k, f)})
        )

      {:error, es} ->
        {:unknown, schema(rel, [], file, es)}
    end
  end

  defp attribute(rel, k, fields) do
    value = Map.put(fields, "key", k)

    case diags(rel, ["attributes", k], fields, value, "AttributeSpec") do
      [] -> {:ok, value}
      diags -> {:error, diags}
    end
  end

  defp file_schema(name) do
    entry = %{"type" => "object", "additionalProperties" => %{}}

    %{
      "type" => "object",
      "properties" => %{name => %{"type" => "object", "additionalProperties" => entry}},
      "required" => [name],
      "additionalProperties" => false
    }
  end

  @doc """
  Diagnostics of the condition band tables (resource.schema.json BandTable: each pool's `bands`
  and cartridge.json's `world.bands`) and of `world.movement.cost`, given a manifest and a v2
  source: cuts not strictly descending to a last 0, or a repeated key, is RESOURCE_SPEC_INVALID at
  the table; a band key without `band.<key>` in the catalog (unless it was rejected) or a cost
  naming no resource of this cartridge is UNRESOLVED_REFERENCE; an attribute without attributes@1
  in `m`'s requires is UNDECLARED_CAPABILITY.
  """
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, {term(), map()}, [map()]) ::
          [map()]
  def check(m, defs, {_, text}, {_, settings}, registry) when m != nil do
    world = Map.get(settings, "world", %{})

    Enum.flat_map(tables(defs, world), &table(&1, text)) ++
      cost(m, defs, world) ++
      owned(m, defs["attribute"], registry) ++ recovery(m, defs["resource"]) ++ npc_hp(m, defs)
  end

  def check(_, _, _, _, _), do: []

  defp npc_hp(m, defs) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    for {_, {rel, [], %{"hp" => hp}}} <- defs["npc"],
        d <-
          if(start_in_bounds?(hp),
            do: [],
            else: [diag("RESOURCE_SPEC_INVALID", at(rel, ["hp"]))]
          ) ++
            if(version >= [1, 4],
              do: [],
              else: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")]
            ),
        do: d
  end

  defp tables(defs, world) do
    pools = for {_, {rel, steps, %{"bands" => b}}} <- defs["resource"], do: {rel, steps, b}
    own = if world["bands"], do: [{"cartridge.json", ["world"], world["bands"]}], else: []
    own ++ pools
  end

  defp residual_bound?(%{"regen" => %{"every" => every, "by_position" => rates}}),
    do: every <= div(9_007_199_254_740_991, Enum.max(Map.values(rates)) + 1)

  defp residual_bound?(_), do: true

  defp recovery(m, resources) do
    for {_, {rel, steps, %{"regen" => _}}} <- resources,
        diagnostic <- recovery_requires(m, at(rel, steps ++ ["regen"])),
        do: diagnostic
  end

  defp recovery_requires(m, path) do
    position =
      if m["requires"]["capabilities"]["position"] == 1,
        do: [],
        else: [diag("UNDECLARED_CAPABILITY", path, %{"capability" => "position"}, ["position@1"])]

    elapsed =
      if get_in(m, ["time_policy", "profile"]) == "real_elapsed",
        do: [],
        else: [diag("INVALID_TIME_POLICY", path)]

    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    api =
      if version >= [1, 2],
        do: [],
        else: [
          diag(
            "KERNEL_API_RANGE_INVALID",
            at("cartridge.json", ["requires", "kernel_api", "at_least"])
          )
        ]

    position ++ elapsed ++ api
  end

  defp cost(m, defs, %{"movement" => %{"cost" => cost}}),
    do: Refs.reference("cartridge.json", ["world", "movement", "cost"], "resource", cost, m, defs)

  defp cost(_, _, _), do: []

  defp owned(m, attributes, registry) when is_map(attributes) do
    required = {m["requires"]["capabilities"], Refs.owners(registry, ["definitions"])}

    for {_, {rel, steps, _}} <- attributes,
        d <- Refs.owned(at(rel, steps), "attribute", required),
        do: d
  end

  defp owned(_, _, _), do: []

  defp table({rel, steps, bands}, text) do
    path = at(rel, steps ++ ["bands"])
    shape = if ordered?(bands), do: [], else: [diag("RESOURCE_SPEC_INVALID", path)]

    shape ++
      for {%{"key" => k}, i} <- Enum.with_index(bands),
          text != :unknown and not is_map_key(text, "band." <> k),
          do: diag("UNRESOLVED_REFERENCE", "#{path}[#{i}].key", %{"target" => "band." <> k})
  end

  # Cuts strictly descending to a last 0, keys unique.
  defp ordered?(bands) do
    {cuts, keys} = {Enum.map(bands, & &1["at_percent"]), Enum.map(bands, & &1["key"])}
    cuts == Enum.sort(Enum.uniq(cuts), :desc) and List.last(cuts) == 0 and Enum.uniq(keys) == keys
  end

  @doc """
  The manifest with resource@1 required, which the default pools need, and schedule@1, whose
  `wait` lets a body out of mv regenerate (review #49 A1: no dead end).
  """
  @spec requires(map()) :: map()
  def requires(m),
    do:
      update_in(
        m,
        ["requires", "capabilities"],
        &Map.merge(%{"resource" => 1, "schedule" => 1}, &1)
      )

  defp specs(rel, authored) do
    results =
      for k <- Enum.uniq(Map.keys(@defaults) ++ Map.keys(authored)),
          do: {k, spec(rel, k, Map.get(authored, k, %{}))}

    collect(rel, "resources", results)
  end

  # {key => {rel, steps, spec} | :invalid, diagnostics} of each key's {:ok, spec} | {:error, ds}.
  defp collect(rel, name, results) do
    {Map.new(results, fn
       {k, {:ok, s}} -> {k, {rel, [name, k], s}}
       {k, _} -> {k, :invalid}
     end), for({_, {:error, ds}} <- results, d <- ds, do: d)}
  end

  defp spec(rel, k, fields) do
    value = @defaults |> Map.get(k, %{}) |> Map.merge(fields) |> Map.put("key", k)

    ordered = start_in_bounds?(value)

    case diags(rel, ["resources", k], fields, value) do
      [] ->
        cond do
          not ordered ->
            {:error, [diag("RESOURCE_SPEC_INVALID", at(rel, ["resources", k]))]}

          not residual_bound?(value) ->
            {:error, [diag("RESOURCE_SPEC_INVALID", at(rel, ["resources", k, "regen"]))]}

          true ->
            {:ok, value}
        end

      diags ->
        {:error, diags}
    end
  end

  defp start_in_bounds?(value),
    do: value["minimum"] <= value["start"] and value["start"] <= value["maximum"]

  # An authored key is UNKNOWN_FIELD (the name is the key); the name must be a Key.
  defp diags(rel, steps, fields, value, contract \\ "ResourceSpec") do
    key = at(rel, steps ++ ["key"])
    authored = if is_map_key(fields, "key"), do: [diag("UNKNOWN_FIELD", key)], else: []
    spec = Enum.reject(validated(rel, steps, contract, value), &(&1["path"] == key))
    authored ++ validated(rel, steps, "Key", value["key"]) ++ spec
  end

  defp validated(rel, steps, contract, value) do
    case Contracts.validate(contract, value) do
      :ok -> []
      {:error, es} -> schema(rel, steps, value, es)
    end
  end
end
