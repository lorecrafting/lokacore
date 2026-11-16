defmodule Loka.Content.LintSource do
  @moduledoc """
  The decoded-source shape the story lints read: every map a file holds, the units under one
  source folder, and the key a reference names. `LintStory` and `LintFacts` share it so a rule
  reads a nested step, policy leaf or guard the same way.
  """

  alias Loka.Content.LintLabels

  @doc "Every map a decoded source file holds, so a rule reads each step, policy leaf and guard."
  @spec walk(map() | list() | term()) :: [map()]
  def walk(%{} = v), do: [v | Enum.flat_map(Map.values(v), &walk/1)]
  def walk(v) when is_list(v), do: Enum.flat_map(v, &walk/1)
  def walk(_), do: []

  @doc "The maps under one source folder as `{key, rel, map}`, keyed by file name."
  @spec units(%{String.t() => map()}, String.t()) :: [{String.t(), String.t(), map()}]
  def units(files, dir) do
    for {rel, v} <- Enum.sort(files),
        [^dir, file] <- [LintLabels.parts(rel)],
        is_map(v),
        do: {Path.rootname(file), rel, v}
  end

  @doc "The id a reference names: a bare string or a `{\"key\" => id}` map."
  @spec key_of(term()) :: String.t() | nil
  def key_of(%{"key" => k}) when is_binary(k), do: k
  def key_of(k) when is_binary(k), do: k
  def key_of(_), do: nil

  @doc "The id `m` names in `field`, or nil when it names none."
  @spec named(map(), String.t()) :: String.t() | nil
  def named(m, field) do
    case key_of(m[field]) do
      k when is_binary(k) -> k
      _ -> nil
    end
  end
end
