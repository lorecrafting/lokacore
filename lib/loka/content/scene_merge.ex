defmodule Loka.Content.SceneMerge do
  @moduledoc "A scene entry and the same-key JSON beside it: the merge, and what the merge would silently lose."

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}

  @doc "Each scene entry (rel `*.scene` or `*.cut`) with its same-key JSON file merged over it, as one entry."
  @spec merge([entry()]) :: [entry()]
  def merge(files) do
    {scenes, rest} =
      Enum.split_with(files, fn {rel, _, _} -> String.ends_with?(rel, [".scene", ".cut"]) end)

    Enum.reduce(scenes, rest, fn {rel, id, value}, acc ->
      case List.keytake(acc, id, 1) do
        {{_, _, json}, acc} -> acc ++ [{rel, id, deep(value, json)}]
        nil -> acc ++ [{rel, id, value}]
      end
    end)
  end

  @doc "What a same-key JSON file writes over a scene, as `{json rel, path, key}`: it would silently replace the scene's words."
  @spec overlap([entry()]) :: [{String.t(), [String.t()], String.t()}]
  def overlap(files) do
    for {rel, {:dialogue, key, _} = id, %{} = scene} <- files,
        String.ends_with?(rel, ".scene"),
        {json, ^id, %{} = other} <- files,
        json != rel,
        path <- fields(scene),
        not comes_back?(path, scene, key),
        path in fields(other),
        do: {json, path, key}
  end

  @doc "Dialogue keys two `.scene` entries make, as `{rel, key}` of the later one: a merge would silently join them."
  @spec same_key([entry()]) :: [{String.t(), String.t()}]
  def same_key(files) do
    scenes =
      for {rel, {:dialogue, _, _} = id, _} <- files,
          String.ends_with?(rel, ".scene"),
          do: {rel, id}

    for {rel, {:dialogue, key, _}} <- scenes -- Enum.uniq_by(scenes, &elem(&1, 1)), do: {rel, key}
  end

  # ponytail: a `then` to itself or a parent is what lowering writes, so a written one is not told
  # apart and a sidecar `then` wins over it; carry written-or-not on the form if that bites.
  defp comes_back?(["choices", c, "then"], scene, key),
    do: String.starts_with?(key, scene["choices"][c]["then"])

  defp comes_back?(_, _, _), do: false

  defp fields(d) do
    Enum.flat_map(d, fn
      {"roles", %{} = roles} -> for r <- Map.keys(roles), do: ["roles", r]
      {"choices", %{} = cs} -> for {c, %{} = o} <- cs, f <- Map.keys(o), do: ["choices", c, f]
      {field, _} -> [[field]]
    end)
  end

  # An `:invalid` JSON side (its own diagnostic already fails the build) is not merged.
  defp deep(%{} = scene, %{} = json), do: Map.merge(scene, json, fn _, a, b -> deep(a, b) end)
  defp deep(_, json), do: json
end
