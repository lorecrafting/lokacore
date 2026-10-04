defmodule Loka.RedControlsTest do
  use ExUnit.Case, async: true

  # Breaks: a check overwrites and deletes an untracked local file at a planted path.
  test "red controls refuse an occupied path and preserve its bytes" do
    root = Path.join(System.tmp_dir!(), "loka-red-safety-#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(root, "bin"))
    on_exit(fn -> File.rm_rf!(root) end)
    File.cp!("bin/red_controls.exs", Path.join(root, "bin/red_controls.exs"))
    File.mkdir_p!(Path.join(root, "docs"))
    File.write!(Path.join(root, "docs/features.json"), "{}")
    existing = Path.join(root, "lib/loka_web/red_control.ex")
    File.mkdir_p!(Path.dirname(existing))
    File.write!(existing, "# local scratch\nkeep me\n")

    {_output, status} =
      System.cmd("elixir", ["bin/red_controls.exs"], cd: root, stderr_to_stdout: true)

    assert status != 0
    assert File.read(existing) == {:ok, "# local scratch\nkeep me\n"}
  end
end
