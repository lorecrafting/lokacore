defmodule Loka.Content.Resources do
  @moduledoc """
  `resources.json` and the engine's default pools (resource.schema.json ResourceSpec; 00 §4
  amendment, owner decision HP/MA/MV). The file is `{"resources": {key: fields}}`: a default
  pool's key (hp, ma, mv) overrides any of its fields, another key declares a whole
  ResourceSpec without `key`. Every loka-cartridge-v2 cartridge gets the three pools and
  resource@1 and schedule@1 (`requires/1`), with or without the file.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2, schema: 4]
  alias Loka.Core.Contracts

  @rel "resources.json"
  @defaults %{
    "hp" => %{"minimum" => 0, "maximum" => 20, "start" => 20, "gain" => 5},
    "ma" => %{"minimum" => 0, "maximum" => 100, "start" => 100, "gain" => 4},
    "mv" => %{"minimum" => 0, "maximum" => 82, "start" => 82, "gain" => 18}
  }
  @file_schema %{
    "type" => "object",
    "properties" => %{
      "resources" => %{
        "type" => "object",
        "additionalProperties" => %{"type" => "object", "additionalProperties" => %{}}
      }
    },
    "required" => ["resources"],
    "additionalProperties" => false
  }

  @doc """
  The resources, `key => {rel, steps, ResourceSpec} | :invalid`, and the diagnostics of the
  loaded `resources.json` (`[]` when absent; a file that failed to decode leaves the defaults):
  its schema, each spec's (UNKNOWN_FIELD for an authored key) and RESOURCE_SPEC_INVALID when
  minimum <= start <= maximum fails.
  """
  @spec load([{String.t(), term()}]) :: {map(), [map()]}
  def load([{rel, file}]) when file != :invalid do
    defs = Map.put(Contracts.defs(), "ResourcesFile", @file_schema)

    case Contracts.validate("ResourcesFile", file, defs) do
      :ok -> specs(rel, file["resources"])
      {:error, es} -> {specs(rel, %{}) |> elem(0), schema(rel, [], file, es)}
    end
  end

  def load(_), do: specs(@rel, %{})

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

    {Map.new(results, fn
       {k, {:ok, s}} -> {k, {rel, ["resources", k], s}}
       {k, _} -> {k, :invalid}
     end), for({_, {:error, ds}} <- results, d <- ds, do: d)}
  end

  defp spec(rel, k, fields) do
    value = @defaults |> Map.get(k, %{}) |> Map.merge(fields) |> Map.put("key", k)

    ordered = value["minimum"] <= value["start"] and value["start"] <= value["maximum"]

    case diags(rel, ["resources", k], fields, value) do
      [] when ordered -> {:ok, value}
      [] -> {:error, [diag("RESOURCE_SPEC_INVALID", at(rel, ["resources", k]))]}
      diags -> {:error, diags}
    end
  end

  # An authored key is UNKNOWN_FIELD (the name is the key); the name must be a Key.
  defp diags(rel, steps, fields, value) do
    key = at(rel, steps ++ ["key"])
    authored = if is_map_key(fields, "key"), do: [diag("UNKNOWN_FIELD", key)], else: []
    spec = Enum.reject(validated(rel, steps, "ResourceSpec", value), &(&1["path"] == key))
    authored ++ validated(rel, steps, "Key", value["key"]) ++ spec
  end

  defp validated(rel, steps, contract, value) do
    case Contracts.validate(contract, value) do
      :ok -> []
      {:error, es} -> schema(rel, steps, value, es)
    end
  end
end
