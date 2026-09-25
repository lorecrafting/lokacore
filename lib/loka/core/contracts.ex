defmodule Loka.Core.Contracts do
  @moduledoc """
  Validates JSON values against the contracts in `protocol/*.schema.json` (spec 04 §12,
  14 §R3), read at compile time and checked against the closed schema subset
  (`Loka.Core.Contracts.Schema`). `kernel/ts/src/validate.ts` is the TypeScript twin: same
  paths, same codes (`protocol/error_registry.json`).

  Values must come from `Loka.Core.Canonical.decode/1` (the frozen numeric profile). The
  profile, not the validator, rejects floats, exponents, duplicate keys and invalid Unicode;
  an ordinary JSON decoder loses or changes that information before validation sees it. Its
  nesting limit of 128 also bounds recursion through a recursive `$ref`.
  """
  alias Loka.Core.Canonical
  alias Loka.Core.Contracts.Schema

  @safe 9_007_199_254_740_991
  @dir Path.expand("../../../protocol", __DIR__)
  # The directory's mtime changes when a schema file is added or removed.
  @external_resource @dir
  @paths Path.wildcard(Path.join(@dir, "*.schema.json"))

  # Compile-time reads only (lint/rules/elixir-kernel-pure.yml).
  Module.register_attribute(__MODULE__, :docs, accumulate: true)

  for path <- @paths do
    @external_resource path
    @source File.read!(path)
    @docs {Path.basename(path), @source}
  end

  @defs @docs
        |> Map.new(fn {name, text} ->
          {:ok, doc} = Canonical.decode(text)
          {name, doc}
        end)
        |> Schema.flatten!()

  @type error :: %{path: String.t(), code: atom()}

  @doc "Every contract by name, `$ref` values rewritten to contract names."
  @spec defs() :: %{String.t() => map()}
  def defs, do: @defs

  @doc """
  `:ok`, or every error sorted by path then code. A path is a JSON pointer (RFC 6901) into
  `value`; for a missing or unknown property it names the property. `defs` defaults to the
  `protocol/` contracts; any map from `Loka.Core.Contracts.Schema.flatten!/1` works.
  """
  @spec validate(String.t(), Canonical.value(), %{String.t() => map()}) ::
          :ok | {:error, [error()]}
  def validate(contract, value, defs \\ @defs) do
    case Map.fetch(defs, contract) do
      {:ok, schema} -> schema |> errors(value, "", defs) |> result()
      :error -> result([%{path: "", code: :unknown_contract}])
    end
  end

  defp result([]), do: :ok
  defp result(errors), do: {:error, Enum.sort_by(errors, &{&1.path, &1.code})}

  defp errors(%{"type" => t} = s, v, path, defs) do
    if type?(t, v), do: keywords(s, v, path, defs), else: [%{path: path, code: :invalid_type}]
  end

  defp errors(%{"oneOf" => _}, v, path, _) when not is_map(v),
    do: [%{path: path, code: :invalid_type}]

  defp errors(s, v, path, defs), do: keywords(s, v, path, defs)

  defp keywords(s, v, path, defs),
    do: Enum.flat_map(s, fn {k, arg} -> keyword(k, arg, v, path, defs) end)

  # Each clause sees a value that `errors/4` already type-checked.
  defp keyword("$ref", name, v, path, defs), do: errors(defs[name], v, path, defs)
  defp keyword("enum", e, v, path, _), do: check(Enum.any?(e, &(&1 === v)), path, :not_in_enum)
  defp keyword("const", c, v, path, _), do: check(c === v, path, :const_mismatch)
  defp keyword("minimum", n, v, path, _), do: check(v >= n, path, :below_minimum)
  defp keyword("maximum", n, v, path, _), do: check(v <= n, path, :above_maximum)
  defp keyword("minLength", n, v, path, _), do: check(code_points(v) >= n, path, :too_short)
  defp keyword("maxLength", n, v, path, _), do: check(code_points(v) <= n, path, :too_long)
  defp keyword("minItems", n, v, path, _), do: check(length(v) >= n, path, :too_few_items)
  defp keyword("maxItems", n, v, path, _), do: check(length(v) <= n, path, :too_many_items)

  defp keyword("maxProperties", n, v, path, _),
    do: check(map_size(v) <= n, path, :too_many_properties)

  # ponytail: recompiles the pattern on every call; precompile per contract if it shows up in profiles.
  defp keyword("pattern", p, v, path, _) do
    matched = :re.run(v, p, [:unicode, :dollar_endonly, capture: :none]) == :match
    check(matched, path, :pattern_mismatch)
  end

  # A map's keys and values (the subset's map form of an object).
  defp keyword("propertyNames", %{"pattern" => p}, v, path, defs),
    do: Enum.flat_map(v, fn {k, _} -> keyword("pattern", p, k, child(path, k), defs) end)

  defp keyword("additionalProperties", sub, v, path, defs) when is_map(sub),
    do: Enum.flat_map(v, fn {k, x} -> errors(sub, x, child(path, k), defs) end)

  # The subset gives each anyOf branch a different scalar JSON type, so the type selects it.
  defp keyword("anyOf", bs, v, path, defs) do
    case Enum.find(bs, &type?(json_type(&1, defs), v)) do
      nil -> [%{path: path, code: :invalid_type}]
      b -> errors(b, v, path, defs)
    end
  end

  defp keyword("items", sub, v, path, defs) do
    v |> Enum.with_index() |> Enum.flat_map(fn {x, i} -> errors(sub, x, "#{path}/#{i}", defs) end)
  end

  # declared properties imply additionalProperties false (the subset): undeclared keys are errors.
  defp keyword("properties", ps, v, path, defs) do
    Enum.flat_map(v, fn {k, x} ->
      case ps do
        %{^k => sub} -> errors(sub, x, child(path, k), defs)
        _ -> [%{path: child(path, k), code: :unknown_property}]
      end
    end)
  end

  defp keyword("required", r, v, path, _) do
    for k <- r, not is_map_key(v, k), do: %{path: child(path, k), code: :missing_property}
  end

  defp keyword("oneOf", [first | _] = branches, v, path, defs) do
    [d] = for {k, %{"const" => _}} <- first["properties"], do: k

    cond do
      not is_map_key(v, d) ->
        [%{path: child(path, d), code: :missing_property}]

      b = Enum.find(branches, &(&1["properties"][d]["const"] === v[d])) ->
        errors(b, v, path, defs)

      true ->
        [%{path: child(path, d), code: :unknown_variant}]
    end
  end

  defp keyword(_, _, _, _, _), do: []

  defp check(true, _, _), do: []
  defp check(false, path, code), do: [%{path: path, code: code}]

  defp type?("object", v), do: is_map(v)
  defp type?("array", v), do: is_list(v)
  defp type?("string", v), do: is_binary(v) and String.valid?(v)
  defp type?("integer", v), do: is_integer(v) and v in -@safe..@safe
  defp type?("boolean", v), do: is_boolean(v)
  defp type?("null", v), do: v == nil

  defp json_type(%{"$ref" => name}, defs), do: json_type(defs[name], defs)
  defp json_type(%{"type" => t}, _), do: t

  defp code_points(s), do: s |> String.to_charlist() |> length()

  defp child(path, key),
    do: path <> "/" <> (key |> String.replace("~", "~0") |> String.replace("/", "~1"))
end
