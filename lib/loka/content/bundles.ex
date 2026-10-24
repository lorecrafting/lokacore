defmodule Loka.Content.Bundles do
  @moduledoc """
  Area bundles: `areas/<name>.json` holds `{"<dir>": {"<key>": definition without key}}` for
  any definition directory (docs/system/cartridge.md, Source shortcuts). `split/2` opens them
  into definition entries at steps `[dir, key]`; `unique/1`, run before `extends` is flattened
  (Extends indexes one per kind and key), refuses two definitions of one kind and key. Both
  return faults; Source builds the diagnostics, so this module never calls Source (a call
  either way is an xref cycle).
  """

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t()]}, map()}

  @doc "Every bundle entry replaced by its definitions; a bad member is refused at its path."
  @spec split([entry()], %{String.t() => atom()}) :: {[entry()], [fault()]}
  def split(files, dirs) do
    {files, faults} = files |> Enum.map(&open(&1, dirs)) |> Enum.unzip()
    {List.flatten(files), List.flatten(faults)}
  end

  # A bundle that failed to decode adds nothing; its INVALID_JSON or DUPLICATE_KEY stands.
  defp open({_, :bundle, :invalid}, _), do: {[], []}

  defp open({rel, :bundle, %{} = bundle}, dirs),
    do: bundle |> Enum.map(&member(rel, &1, dirs)) |> Enum.unzip()

  defp open({rel, :bundle, _}, _), do: {[], [{"SCHEMA_VIOLATION", {rel, []}, invalid_type()}]}

  defp open(file, _), do: {[file], []}

  defp member(rel, {dir, defs}, dirs) do
    cond do
      not is_map_key(dirs, dir) -> {[], [{"UNKNOWN_FIELD", {rel, [dir]}, %{}}]}
      not is_map(defs) -> {[], [{"SCHEMA_VIOLATION", {rel, [dir]}, invalid_type()}]}
      true -> {for({k, v} <- defs, do: {rel, {dirs[dir], k, [dir, k]}, v}), []}
    end
  end

  defp invalid_type, do: %{"error" => "invalid_type"}

  @doc "The first definition of each kind and key; every site of a repeat is DUPLICATE_DEFINITION."
  @spec unique([entry()]) :: {[entry()], [fault()]}
  def unique(files) do
    repeats =
      for {_, [_, _ | _] = group} <- Enum.group_by(files, &id/1),
          {rel, {_, _, steps}, _} <- group,
          do: {"DUPLICATE_DEFINITION", {rel, steps}, %{}}

    {Enum.uniq_by(files, &id/1), repeats}
  end

  # A root file is unique by its path; the loader reads each path once.
  defp id({_, {kind, key, _}, _}), do: {kind, key}
  defp id({rel, _, _}), do: rel
end
