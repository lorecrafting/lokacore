defmodule Loka.RedControlsTest do
  use ExUnit.Case, async: true

  # Breaks: a check overwrites and deletes an untracked local file at a planted path.
  test "red controls refuse an occupied path and preserve its bytes" do
    root = Path.join(System.tmp_dir!(), "loka-red-safety-#{System.unique_integer([:positive])}")
    on_exit(fn -> File.rm_rf!(root) end)

    # What the script reads before its guard; without one it crashes first, a false green.
    for rel <-
          ~w(bin/red_controls.exs protocol/capability_registry.json docs/features.json
                  docs/MECHANICS-TOOLBOX.md cartridges/toolbox_showcase/transcripts/walk_combat.jsonl) do
      File.mkdir_p!(Path.dirname(Path.join(root, rel)))
      File.cp!(rel, Path.join(root, rel))
    end

    existing = Path.join(root, "lib/loka_web/red_control.ex")
    File.mkdir_p!(Path.dirname(existing))
    File.write!(existing, "# local scratch\nkeep me\n")

    {output, status} =
      System.cmd("elixir", ["bin/red_controls.exs"], cd: root, stderr_to_stdout: true)

    assert status != 0
    # Every crash exits 1: only the guard's own words show the guard refused.
    assert output =~ "refusing to overwrite red-control file: lib/loka_web/red_control.ex"
    assert File.read(existing) == {:ok, "# local scratch\nkeep me\n"}
  end
end
