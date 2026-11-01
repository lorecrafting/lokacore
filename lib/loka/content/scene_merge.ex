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
      value = if is_map(value), do: Map.delete(value, :written_then), else: value

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
        not replaceable?(path, scene, key),
        path in fields(other),
        do: {json, path, key}
  end

  @doc "The refusals a merge would otherwise hide, as `{rel, path, data}`: a sidecar over a scene's words, two scenes on one key, a written order."
  @spec refused([entry()]) :: [{term(), [String.t()], map()}]
  def refused(files) do
    words =
      for {json, path, key} <- overlap(files) do
        {json, path, %{"why" => "scene_overlap", "key" => key, "written" => Enum.join(path, ".")}}
      end

    keys =
      for {rel, key} <- same_key(files),
          do: {rel, [], %{"why" => "scene_key_taken", "key" => key}}

    words ++ keys ++ order_refused(files)
  end

  @doc "A file other than a scene writing `choice_order`, the compiler's own mark; an area bundle shows its dialogues only once split."
  @spec order_refused([entry()]) :: [{term(), [String.t()], map()}]
  def order_refused(files) do
    for {rel, {:dialogue, _, trail}, %{"choice_order" => _}} <- files,
        not (is_binary(rel) and String.ends_with?(rel, ".scene")),
        do: {rel, trail ++ ["choice_order"], %{"why" => "choice_order_written"}}
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

  # Lowering's own way back, the one `then` a JSON may replace: no `then:` line, and not the link
  # to the choice's nested set (dropping that would silently cut the set off).
  defp replaceable?(["choices", c, "then"], scene, key),
    do: c not in scene.written_then and scene["choices"][c]["then"] != "#{key}_#{c}"

  # `choice_order` has its own refusal (order_written/1).
  defp replaceable?(["choice_order"], _, _), do: true
  defp replaceable?(_, _, _), do: false

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
