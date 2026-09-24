defmodule Loka.Core.Contracts.Schema do
  @moduledoc """
  The closed JSON Schema 2020-12 subset of `protocol/*.schema.json` (spec 04 §12, 14 §R3).

  `flatten!/1` checks every schema and merges all `$defs` into one map keyed by contract
  name, rewriting each `$ref` to the target name. Anything outside the subset raises, so
  compilation and generation fail closed.

  The subset: annotations `$schema`, `$id`, `title`, `description`, `examples` (`$defs` only
  at document level); a schema has one `type` or else exactly one of `$ref`, `enum`,
  `const`, `oneOf`. Per type: object `properties`, `required`, `additionalProperties`
  (always `false`); array `items` (required), `minItems`, `maxItems`; string `pattern`,
  `minLength`, `maxLength`; integer `minimum`, `maximum`; string, integer and boolean
  `enum`, `const`. `enum` and `const` values are scalars. `oneOf` branches are inline
  objects, each with exactly one `const` property, the same required property in every
  branch with distinct values (the discriminator).
  """

  @annotations ~w($schema $id title description examples)
  @by_type %{
    "object" => ~w(type properties required additionalProperties),
    "array" => ~w(type items minItems maxItems),
    "string" => ~w(type enum const pattern minLength maxLength),
    "integer" => ~w(type enum const minimum maximum),
    "boolean" => ~w(type enum const),
    "null" => ~w(type)
  }
  @untyped ~w($ref enum const oneOf)
  @counts ~w(minItems maxItems minLength maxLength)

  @doc "Checks decoded schema documents (file name => document) and returns the flat contracts."
  @spec flatten!(%{String.t() => term()}) :: %{String.t() => map()}
  def flatten!(docs) do
    defs = for {file, %{"$defs" => ds}} <- docs, {name, s} <- ds, do: {file, name, s}

    case problems(docs, defs) do
      [] -> Map.new(defs, fn {_, name, s} -> {name, rewrite(s)} end)
      ps -> raise ArgumentError, "protocol/ outside the schema subset:\n" <> Enum.join(ps, "\n")
    end
  end

  defp problems(docs, defs) do
    names = MapSet.new(defs, fn {file, name, _} -> {file, name} end)

    Enum.flat_map(docs, fn {file, doc} -> document(file, doc) end) ++
      duplicates(defs) ++
      Enum.flat_map(defs, fn {file, name, s} ->
        check(s, "#{file}#/$defs/#{name}", {file, names})
      end)
  end

  defp document(file, %{"$defs" => ds} = doc) when is_map(ds) and map_size(ds) > 0,
    do:
      for(k <- Map.keys(doc) -- ["$defs" | @annotations], do: "#{file}: unsupported keyword #{k}")

  defp document(file, _), do: ["#{file}: not a document with $defs"]

  defp duplicates(defs) do
    for {name, n} <- Enum.frequencies_by(defs, &elem(&1, 1)),
        n > 1,
        do: "#{name}: defined #{n} times"
  end

  defp check(s, at, ctx) when is_map(s) do
    case allowed(s) do
      {:ok, keys} ->
        unknown =
          for k <- Map.keys(s) -- (keys ++ @annotations), do: "#{at}: unsupported keyword #{k}"

        unknown ++ Enum.flat_map(s, fn {k, arg} -> keyword(k, arg, s, "#{at}/#{k}", ctx) end)

      :error ->
        ["#{at}: needs one supported type, or exactly one of $ref, enum, const, oneOf"]
    end
  end

  defp check(_, at, _), do: ["#{at}: not a schema object"]

  defp allowed(%{"type" => t}), do: Map.fetch(@by_type, t)

  defp allowed(s) do
    case Enum.filter(@untyped, &Map.has_key?(s, &1)) do
      [k] -> {:ok, [k]}
      _ -> :error
    end
  end

  defp keyword("properties", ps, s, at, ctx) when is_map(ps) do
    required = Map.get(s, "required", [])

    missing =
      for k <- required, not is_map_key(ps, k), do: "#{at}: required #{inspect(k)} not declared"

    missing ++ Enum.flat_map(ps, fn {k, sub} -> check(sub, "#{at}/#{k}", ctx) end)
  end

  defp keyword("required", r, _, at, _), do: ok(is_list(r) and Enum.all?(r, &is_binary/1), at)
  defp keyword("additionalProperties", a, _, at, _), do: ok(a === false, at)
  defp keyword("items", sub, _, at, ctx), do: check(sub, at, ctx)
  defp keyword("oneOf", bs, _, at, ctx) when is_list(bs), do: one_of(bs, at, ctx)

  defp keyword("enum", e, _, at, _),
    do: ok(is_list(e) and e != [] and Enum.all?(e, &scalar?/1), at)

  defp keyword("const", c, _, at, _), do: ok(scalar?(c), at)

  defp keyword("pattern", p, _, at, _),
    do: ok(is_binary(p) and match?({:ok, _}, :re.compile(p, [:unicode, :dollar_endonly])), at)

  defp keyword("$ref", ref, _, at, ctx), do: ok(resolves?(ref, ctx), at)

  defp keyword("type", "object", s, at, _),
    do: ok(is_map_key(s, "properties") and is_map_key(s, "additionalProperties"), at)

  defp keyword("type", "array", s, at, _), do: ok(is_map_key(s, "items"), at)
  defp keyword(k, n, _, at, _) when k in @counts, do: ok(is_integer(n) and n >= 0, at)
  defp keyword(k, n, _, at, _) when k in ~w(minimum maximum), do: ok(is_integer(n), at)
  defp keyword(k, _, _, at, _) when k in ~w(properties oneOf), do: ["#{at}: invalid"]
  defp keyword(_, _, _, _, _), do: []

  defp ok(true, _), do: []
  defp ok(false, at), do: ["#{at}: invalid"]

  defp scalar?(v), do: is_binary(v) or is_integer(v) or is_boolean(v) or is_nil(v)

  defp resolves?(ref, {file, names}) when is_binary(ref) do
    case String.split(ref, "#/$defs/") do
      ["", name] -> MapSet.member?(names, {file, name})
      [other, name] -> MapSet.member?(names, {other, name})
      _ -> false
    end
  end

  defp resolves?(_, _), do: false

  defp one_of(bs, at, ctx) do
    tags = Enum.map(bs, &tag/1)

    discriminator =
      case Enum.uniq_by(tags, &elem(&1, 0)) do
        [{d, _}] when d != nil ->
          if tags == Enum.uniq(tags), do: [], else: ["#{at}: repeated tag"]

        _ ->
          ["#{at}: every branch needs the same one required const property"]
      end

    discriminator ++
      Enum.flat_map(Enum.with_index(bs), fn {b, i} -> check(b, "#{at}/#{i}", ctx) end)
  end

  # {discriminator, value} of an object branch with exactly one const property, else {nil, nil}.
  defp tag(%{"type" => "object", "properties" => ps, "required" => r})
       when is_map(ps) and is_list(r) do
    case for {k, %{"const" => v}} <- ps, do: {k, v} do
      [{k, v}] -> if k in r, do: {k, v}, else: {nil, nil}
      _ -> {nil, nil}
    end
  end

  defp tag(_), do: {nil, nil}

  defp rewrite(%{"$ref" => ref} = s), do: %{s | "$ref" => ref |> String.split("/") |> List.last()}
  defp rewrite(s) when is_map(s), do: Map.new(s, fn {k, v} -> {k, rewrite(v, k)} end)
  defp rewrite(s), do: s

  # Only schema positions are rewritten; `examples`, `enum` and `const` hold values.
  defp rewrite(ps, "properties"), do: Map.new(ps, fn {k, v} -> {k, rewrite(v)} end)
  defp rewrite(bs, "oneOf"), do: Enum.map(bs, &rewrite/1)
  defp rewrite(sub, "items"), do: rewrite(sub)
  defp rewrite(v, _), do: v
end
