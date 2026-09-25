defmodule Loka.Content.Source do
  @moduledoc """
  Reads a cartridge source directory and builds diagnostics in the path grammar of
  `Diagnostic.path` (protocol/cartridge.schema.json).

  A step list holds member names (strings) and array indexes (integers).
  """
  alias Loka.Core.Canonical

  @type steps :: [String.t() | non_neg_integer()]
  @type file :: :manifest | :facts | {:policy, String.t()} | {:action, String.t()}

  @doc """
  Every `.json` regular file under `dir` (dot files included) as `{relative path, kind,
  decoded value}`, plus the INVALID_JSON, DUPLICATE_KEY and UNKNOWN_FIELD diagnostics.
  Files that fail to decode or sit in an unrecognised place are left out.
  """
  @spec load(Path.t()) :: {[{String.t(), file(), term()}], [map()]}
  def load(dir) do
    entries =
      dir
      |> Path.join("**/*.json")
      |> Path.wildcard(match_dot: true)
      |> Enum.filter(&File.regular?/1)
      |> Enum.map(&Path.relative_to(&1, dir))
      |> Enum.map(&entry(&1, classify(&1), dir))

    {for({:ok, file} <- entries, do: file), for({:error, ds} <- entries, d <- ds, do: d)}
  end

  defp entry(rel, :unknown, _), do: {:error, [diag("UNKNOWN_FIELD", at(rel, []))]}

  defp entry(rel, kind, dir) do
    case JSON.decode(File.read!(Path.join(dir, rel)), [], object_finish: &finish/2) do
      {value, [], ""} -> checked(rel, kind, value)
      _ -> {:error, [diag("INVALID_JSON", at(rel, []))]}
    end
  end

  defp checked(rel, kind, value) do
    case duplicates(value, []) do
      [] -> {:ok, {rel, kind, value}}
      dups -> {:error, Enum.map(dups, &diag("DUPLICATE_KEY", at(rel, &1)))}
    end
  end

  # Elixir's JSON keeps the first of repeated keys; a repeat is marked here and reported
  # by duplicates/2 with its path. JSON values are never tuples, so the mark is unambiguous.
  defp finish(pairs, old) do
    pairs = Enum.reverse(pairs)
    keys = Enum.map(pairs, &elem(&1, 0))

    case for {k, n} <- Enum.frequencies(keys), n > 1, do: k do
      [] -> {Map.new(pairs), old}
      repeated -> {{:duplicate_keys, repeated, Map.new(pairs)}, old}
    end
  end

  defp duplicates({:duplicate_keys, keys, map}, path),
    do: Enum.map(keys, &(path ++ [&1])) ++ duplicates(map, path)

  defp duplicates(map, path) when is_map(map),
    do: Enum.flat_map(map, fn {k, v} -> duplicates(v, path ++ [k]) end)

  defp duplicates(list, path) when is_list(list),
    do: list |> Enum.with_index() |> Enum.flat_map(fn {v, i} -> duplicates(v, path ++ [i]) end)

  defp duplicates(_, _), do: []

  defp classify("cartridge.json"), do: :manifest
  defp classify("facts.json"), do: :facts

  defp classify(rel) do
    case Path.split(rel) do
      ["policies", file] -> {:policy, Path.rootname(file)}
      ["actions", file] -> {:action, Path.rootname(file)}
      _ -> :unknown
    end
  end

  @doc "A diagnostic (Diagnostic in protocol/cartridge.schema.json)."
  @spec diag(String.t(), String.t(), map(), [String.t()]) :: map()
  def diag(code, path, data \\ %{}, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  @doc "A diagnostic path: the source for `rel`, then `steps`."
  @spec at(String.t(), steps()) :: String.t()
  def at(rel, steps) do
    stem = String.replace_suffix(rel, ".json", "")
    plain? = stem != rel and Enum.all?(String.split(stem, "/"), &name?/1)
    source = if plain?, do: stem, else: literal(rel)
    Enum.reduce(steps, source, &(&2 <> step(&1)))
  end

  defp step(i) when is_integer(i), do: "[#{i}]"
  defp step(name), do: if(name?(name), do: "." <> name, else: "[" <> literal(name) <> "]")

  defp name?(s), do: s =~ ~r/\A[a-z0-9_]+\z/

  defp literal(s) do
    {:ok, text} = Canonical.encode(s)
    text
  end

  @doc """
  Diagnostics for `Loka.Core.Contracts.validate/2` errors on `value`, which sits at `steps`
  of `rel`: unknown_property is UNKNOWN_FIELD, any other code SCHEMA_VIOLATION.
  """
  @spec schema(String.t(), steps(), term(), [map()]) :: [map()]
  def schema(rel, steps, value, errors) do
    for %{path: pointer, code: code} <- errors do
      path = at(rel, steps ++ pointer_steps(value, pointer))

      if code == :unknown_property,
        do: diag("UNKNOWN_FIELD", path),
        else: diag("SCHEMA_VIOLATION", path, %{"error" => Atom.to_string(code)})
    end
  end

  # A JSON pointer segment is an array index exactly where the value there is a list.
  defp pointer_steps(value, pointer) do
    pointer
    |> String.split("/")
    |> tl()
    |> Enum.map_reduce(value, fn seg, v ->
      seg = seg |> String.replace("~1", "/") |> String.replace("~0", "~")

      if is_list(v),
        do: {String.to_integer(seg), Enum.at(v, String.to_integer(seg))},
        else: {seg, is_map(v) && v[seg]}
    end)
    |> elem(0)
  end
end
