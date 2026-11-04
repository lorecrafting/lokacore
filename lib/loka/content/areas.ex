defmodule Loka.Content.Areas do
  @moduledoc """
  Area bundles: `areas/<name>.json` holds `{"<dir>": {"<key>": definition without key}}` for
  any definition directory (docs/system/cartridge.md, Source shortcuts). `split/2` opens them
  into definition entries at steps `[dir, key]`; `unique/1`, run before `extends` is flattened
  (Extends indexes one per kind and key), refuses two definitions of one kind and key. Both
  return faults; Source builds the diagnostics, so this module never calls Source (a call
  either way is an xref cycle). Area folders: `areas/<name>/<dir>/<file>` is a definition of
  the area `<name>`; `area_of/1`, `crossed/2` and `check/1` hold the border rules
  (docs/system/cartridge.md, Area folders).
  """

  alias Loka.Core.Contracts

  @typedoc "A loaded file, `{relative path, kind, decoded value}` (Loka.Content.Source.load/1)."
  @type entry :: {String.t(), term(), term()}
  @typedoc "A refusal: code, `{rel, steps}` and diagnostic data."
  @type fault :: {String.t(), {String.t(), [String.t()]}, map()}

  @doc """
  Every bundle entry replaced by its definitions; a bad member is refused at its path, and a
  refused bundle stays as `{rel, :area, :invalid}`.
  """
  @spec split([entry()], %{String.t() => atom()}) :: {[entry()], [fault()]}
  def split(files, dirs) do
    {files, faults} = files |> Enum.map(&open(&1, dirs)) |> Enum.unzip()
    {List.flatten(files), List.flatten(faults)}
  end

  # The compiler holds back unresolved references while a refused bundle stays. One that failed to
  # decode adds nothing else; its INVALID_JSON or DUPLICATE_KEY stands.
  defp open({_, :area, :invalid} = file, _), do: {[file], []}

  defp open({rel, :area, %{} = bundle}, dirs) do
    {files, faults} = bundle |> Enum.map(&member(rel, &1, dirs)) |> Enum.unzip()
    if List.flatten(faults) == [], do: {files, []}, else: {[refused(rel) | files], faults}
  end

  defp open({rel, :area, _}, _),
    do: {[refused(rel)], [{"SCHEMA_VIOLATION", {rel, []}, invalid_type()}]}

  defp open(file, _), do: {[file], []}

  defp member(rel, {dir, defs}, dirs) do
    cond do
      not is_map_key(dirs, dir) -> {[], [{"UNKNOWN_FIELD", {rel, [dir]}, %{}}]}
      not is_map(defs) -> {[], [{"SCHEMA_VIOLATION", {rel, [dir]}, invalid_type()}]}
      true -> {for({k, v} <- defs, do: {rel, {dirs[dir], k, [dir, k]}, v}), []}
    end
  end

  defp refused(rel), do: {rel, :area, :invalid}
  defp invalid_type, do: %{"error" => "invalid_type"}

  @doc "The area of a source path: `<a>` for `areas/<a>.json` and `areas/<a>/<dir>/<file>`, else nil (the root)."
  @spec area_of(String.t()) :: String.t() | nil
  def area_of(rel) do
    case Path.split(rel) do
      ["areas", file] -> Path.rootname(file)
      ["areas", area, _, _] -> area
      _ -> nil
    end
  end

  @doc """
  The area a definition at `to` belongs to when one at `from` may not name it, else nil: only its
  own area and the root may name an area's definition (rooms are exempt; the caller checks kind).
  """
  @spec crossed(String.t(), String.t()) :: String.t() | nil
  def crossed(from, to) do
    {a, b} = {area_of(from), area_of(to)}
    if a && b && a != b, do: b
  end

  @doc """
  An `area_empty` fault for each area, folder or bundle, with no room among `files`, and an
  `area_name` fault for each area folder whose name is not a Key.
  """
  @spec check([entry()]) :: [fault()]
  def check(files) do
    areas = for {rel, {_, _, _}, _} <- files, a <- [area_of(rel)], a, uniq: true, do: a
    rooms = for {rel, {:room, _, _}, _} <- files, do: area_of(rel)

    for(a <- areas -- rooms, do: fault("area_empty", "areas/#{a}.json", %{"area" => a})) ++
      names(files)
  end

  defp names(files) do
    folders = for {rel, _, _} <- files, ["areas", a, _, _] <- [Path.split(rel)], uniq: true, do: a

    for a <- folders,
        Contracts.validate("Key", a) != :ok,
        do: fault("area_name", "areas/" <> a, %{})
  end

  defp fault(why, rel, data), do: {"SCHEMA_VIOLATION", {rel, []}, Map.put(data, "why", why)}

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
