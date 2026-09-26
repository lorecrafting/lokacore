defmodule Loka.Content.Refs do
  @moduledoc """
  Capability ownership and reference resolution shared by the compiler's checks (05 §4, §6;
  06 §21): who owns a command, policy op, definition kind or event (capability_registry.json),
  UNDECLARED_CAPABILITY, and UNRESOLVED_REFERENCE and FACT_TYPE_MISMATCH for a reference field.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2]
  alias Loka.Core.Contracts

  @doc """
  Each name in the registry `fields` (commands, policies, definitions, events) to its owner's
  `{key, "key@version"}`.
  """
  @spec owners([map()], [String.t()]) :: map()
  def owners(registry, fields \\ ["commands", "policies"]) do
    for c <- registry,
        name <- Enum.flat_map(fields, &Map.get(c, &1, [])),
        into: %{},
        do: {name, {c["key"], "#{c["key"]}@#{c["version"]}"}}
  end

  @doc "The registered command types (command.schema.json CommandPayload)."
  @spec commands() :: [String.t()]
  def commands,
    do:
      for(b <- Contracts.defs()["CommandPayload"]["oneOf"], do: b["properties"]["type"]["const"])

  @doc "UNDECLARED_CAPABILITY at `path` unless `name`'s owner is in `required`."
  @spec owned(String.t(), String.t(), {map(), map()}) :: [map()]
  def owned(path, name, {required, owners}) do
    {key, pin} = owners[name]

    if is_map_key(required, key),
      do: [],
      else: [diag("UNDECLARED_CAPABILITY", path, %{"capability" => key}, [pin])]
  end

  @doc """
  Diagnostics for node `n`'s reference `field` (at `steps` of `rel`), which names a definition
  of `kind` (the field's name unless given as `{field, kind}`): UNRESOLVED_REFERENCE, or for a
  fact FACT_TYPE_MISMATCH when the node's `equals` (a fact_compare) or `value` (a fact.assign) is
  not of its type.
  """
  @spec reference(String.t(), list(), String.t() | {String.t(), String.t()}, map(), map(), map()) ::
          [map()]
  def reference(rel, steps, field, n, m, defs) when is_binary(field),
    do: reference(rel, steps, {field, field}, n, m, defs)

  def reference(rel, steps, {field, kind}, n, m, defs) do
    ref = n[field]

    case resolve(ref, kind, m, defs) do
      :unresolved ->
        s = "#{ref["cartridge_id"]}@#{ref["cartridge_version"]}:#{ref["kind"]}/#{ref["key"]}"
        [diag("UNRESOLVED_REFERENCE", at(rel, steps ++ [field]), %{"target" => s})]

      {_, _, %{"value_type" => t}} ->
        v = if is_map_key(n, "value"), do: "value", else: "equals"

        if typed?(n[v], t),
          do: [],
          else: [diag("FACT_TYPE_MISMATCH", at(rel, steps ++ [v]))]

      _ ->
        []
    end
  end

  @doc """
  The definition `ref` names if it names this cartridge's (`m`) definition of `kind`:
  `{rel, steps, value}`, `:invalid` or `:unknown` (a rejected namespace, whose real error is
  already reported), else `:unresolved`.
  """
  @spec resolve(term(), String.t(), map(), map()) :: term()
  def resolve(
        %{"cartridge_id" => id, "cartridge_version" => v, "kind" => k, "key" => key},
        k,
        %{"id" => id, "version" => v},
        defs
      ) do
    case defs[k] do
      %{^key => target} -> target
      :unknown -> :unknown
      _ -> :unresolved
    end
  end

  def resolve(_, _, _, _), do: :unresolved

  defp typed?(v, %{"type" => "bool"}), do: is_boolean(v)
  defp typed?(v, %{"type" => "enum", "values" => vs}), do: v in vs

  defp typed?(v, %{"type" => "int"} = t),
    do: is_integer(v) and v >= Map.get(t, "minimum", v) and v <= Map.get(t, "maximum", v)
end
