defmodule Loka.ContentSource do
  @moduledoc """
  Content tests: one copy of a cartridge source per test module, changed and restored per
  case, so a list of mutations costs one copy instead of one per mutation.
  """
  import ExUnit.Callbacks, only: [on_exit: 1]

  @doc "Copies `src` once (call from `setup_all`); the copy is removed after the module."
  def copy(src) do
    # The OS pid keeps concurrent test runs apart; a leftover copy is replaced, not merged.
    name = "loka-source-#{System.pid()}-#{System.unique_integer([:positive])}"
    dir = Path.join(System.tmp_dir!(), name)
    File.rm_rf!(dir)
    File.cp_r!(src, dir)
    on_exit(fn -> File.rm_rf!(dir) end)
    dir
  end

  @doc """
  Compiles `dir` with `changes` written over it, then restores every changed file. Each
  change is `{relative path, value}`: a decoded JSON value, `nil` to delete the file, or a
  function of the file's decoded current value.
  """
  def compile(dir, changes) do
    saved = for {rel, _} <- changes, into: %{}, do: {rel, File.read(Path.join(dir, rel))}

    try do
      for {rel, change} <- changes, do: write(Path.join(dir, rel), change)
      Loka.Content.compile(dir)
    after
      for {rel, old} <- saved do
        case old do
          {:ok, bytes} -> File.write!(Path.join(dir, rel), bytes)
          {:error, :enoent} -> File.rm_rf!(Path.join(dir, rel))
        end
      end
    end
  end

  defp write(path, change) when is_function(change, 1),
    do: write(path, change.(JSON.decode!(File.read!(path))))

  defp write(path, nil), do: File.rm!(path)

  defp write(path, value) do
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, JSON.encode!(value))
  end
end

ExUnit.start()
