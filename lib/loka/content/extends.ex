defmodule Loka.Content.Extends do
  @moduledoc """
  Flattens `extends` and `abstract` in the source definition files before any stage reads
  them: a child merges over its parent of the same kind, and an abstract definition is removed
  once its children resolve (docs/system/cartridge.md, Source shortcuts).
  """

  alias Loka.Content.Source

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal at `<at>.extends`; Source builds the diagnostic, `from` is a location too."
  @type fault ::
          {code :: String.t(), at :: Source.location(), data :: map(),
           from :: Source.location() | nil}

  @doc "The files with every `extends` resolved and every abstract definition removed."
  @spec flatten([entry()]) :: {[entry()], [fault()]}
  def flatten(files) do
    index =
      for {rel, {kind, key, steps}, value} <- files,
          into: %{},
          do: {{kind, key}, {{rel, steps}, value}}

    {memo, faults} =
      Enum.reduce(Map.keys(index), {%{}, []}, &elem(resolve(&1, [], {index, files}, &2), 1))

    {Enum.flat_map(files, &output(&1, memo)), faults}
  end

  defp output({rel, {kind, key, _} = id, _}, memo) do
    case memo[{kind, key}] do
      {:ok, %{"abstract" => true}} -> []
      {:ok, value} -> [{rel, id, value}]
      :invalid -> [{rel, id, :invalid}]
    end
  end

  defp output(root, _), do: [root]

  defp resolve(id, stack, ctx, {memo, _} = acc) do
    cond do
      Map.has_key?(memo, id) -> {memo[id], acc}
      id in stack -> cycle(id, stack, ctx, acc)
      true -> remember(id, own(id, stack, ctx, acc))
    end
  end

  defp remember(id, {result, {memo, faults}}), do: {result, {Map.put(memo, id, result), faults}}

  # ponytail: data.from names the parent only on these refusals; a schema error in an inherited
  # field reports at the child without it (provenance would need a table through Source.load/1).
  defp own(id, stack, {index, _} = ctx, acc), do: own(index[id], id, stack, ctx, acc)

  defp own({_, %{"extends" => parent} = value}, {kind, _} = id, stack, {index, _} = ctx, acc)
       when is_map_key(index, {kind, parent}),
       do: inherit(value, resolve({kind, parent}, [id | stack], ctx, acc))

  defp own({at, %{"extends" => parent}}, _, _, {_, files}, acc) when is_binary(parent) do
    data = %{"target" => dir(at) <> "/" <> parent}
    refuse(acc, [{"UNRESOLVED_REFERENCE", at, data, other_kind(files, parent)}])
  end

  defp own({rel, %{"extends" => _}}, _, _, _, acc),
    do: refuse(acc, [{"SCHEMA_VIOLATION", rel, %{"error" => "invalid_type"}, nil}])

  defp own({_, value}, _, _, _, acc), do: {{:ok, value}, acc}

  defp inherit(value, {{:ok, %{} = up}, acc}),
    do: {{:ok, merge(Map.delete(up, "abstract"), Map.delete(value, "extends"))}, acc}

  defp inherit(_, {_, acc}), do: {:invalid, acc}

  defp dir({rel, []}), do: Path.dirname(rel)
  defp dir({_, [dir, _]}), do: dir

  defp other_kind(files, key),
    do:
      Enum.find_value(files, fn {rel, k, _} ->
        if match?({_, ^key, _}, k), do: {rel, elem(k, 2)}
      end)

  defp refuse({memo, faults}, new), do: {:invalid, {memo, new ++ faults}}

  # `stack` runs from the latest child back to the first; the cycle runs from that child to `id`.
  defp cycle({kind, _} = id, stack, {index, _}, {memo, faults}) do
    {after_id, _} = Enum.split_while(stack, &(&1 != id))
    members = after_id ++ [id]

    found =
      for m <- members do
        {rel, %{"extends" => parent}} = index[m]
        {parent_rel, _} = index[{kind, parent}]
        {"SCHEMA_VIOLATION", rel, %{"error" => "invalid_value"}, parent_rel}
      end

    refuse({Enum.reduce(members, memo, &Map.put(&2, &1, :invalid)), faults}, found)
  end

  # ponytail: there is no delete or append; a child cannot remove an inherited key.
  defp merge(%{} = parent, %{} = child),
    do: Map.merge(parent, child, fn _, a, b -> merge(a, b) end)

  defp merge(_, child), do: child
end
