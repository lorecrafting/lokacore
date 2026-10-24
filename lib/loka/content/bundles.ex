defmodule Loka.Content.Bundles do
  @moduledoc """
  Area bundles: `areas/<name>.json` holds `{"<dir>": {"<key>": definition without key}}` for
  any definition directory (docs/system/cartridge.md, Source shortcuts). `split/1` opens them
  into definition entries at steps `[dir, key]`; `unique/1`, run before `extends` is flattened,
  refuses two definitions of one kind and key.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2, dirs: 0]

  @type entry :: {String.t(), term(), term()}
  @type loaded :: {[entry()], [map()]}

  @doc "Every bundle entry replaced by its definitions; a bad member is refused at its path."
  @spec split(loaded()) :: loaded()
  def split({files, diags}) do
    {files, extra} = files |> Enum.map(&open/1) |> Enum.unzip()
    {List.flatten(files), diags ++ List.flatten(extra)}
  end

  # A bundle that failed to decode adds nothing; its INVALID_JSON or DUPLICATE_KEY stands.
  defp open({_, :bundle, :invalid}), do: {[], []}

  defp open({rel, :bundle, %{} = bundle}),
    do: bundle |> Enum.map(&member(rel, &1)) |> Enum.unzip()

  defp open({rel, :bundle, _}), do: {[], [diag("SCHEMA_VIOLATION", at(rel, []), invalid_type())]}

  defp open(file), do: {[file], []}

  defp member(rel, {dir, defs}) do
    cond do
      not is_map_key(dirs(), dir) -> {[], [diag("UNKNOWN_FIELD", at(rel, [dir]))]}
      not is_map(defs) -> {[], [diag("SCHEMA_VIOLATION", at(rel, [dir]), invalid_type())]}
      true -> {for({k, v} <- defs, do: {rel, {dirs()[dir], k, [dir, k]}, v}), []}
    end
  end

  defp invalid_type, do: %{"error" => "invalid_type"}

  @doc "The first definition of each kind and key; every site of a repeat is DUPLICATE_DEFINITION."
  @spec unique(loaded()) :: loaded()
  def unique({files, diags}) do
    repeats =
      for {_, [_, _ | _] = group} <- Enum.group_by(files, &id/1),
          {rel, {_, _, steps}, _} <- group,
          do: diag("DUPLICATE_DEFINITION", at(rel, steps))

    {Enum.uniq_by(files, &id/1), diags ++ repeats}
  end

  # A root file is unique by its path; the loader reads each path once.
  defp id({_, {kind, key, _}, _}), do: {kind, key}
  defp id({rel, _, _}), do: rel
end
