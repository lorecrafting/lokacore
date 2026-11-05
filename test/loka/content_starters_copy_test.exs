# `bin/loka new cartridge <dir>` and `--from <cartridge>`, which the editor's New world runs.
defmodule Loka.ContentStartersCopyTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Break: the blank world needs a fix before it compiles, or warns.
  test "a blank cartridge compiles with no warning", %{tmp_dir: tmp} do
    new(~w(--cwd #{tmp} cartridge blank))
    assert {:ok, _, []} = Loka.Content.compile(Path.join(tmp, "blank"))
  end

  # Break: the copy keeps the source's id (two worlds, one save slot), loses or changes a file,
  # or carries the source's checkpoints (saves of another world).
  test "a copy has its own id and every other byte of the source", %{tmp_dir: tmp} do
    src = Path.join(tmp, "src")
    new(~w(--cwd #{tmp} cartridge src rooms yard --from start east))
    File.mkdir_p!(Path.join(src, "checkpoints"))
    File.write!(Path.join(src, "checkpoints/one.json"), "{}")
    new(~w(--cwd #{tmp} cartridge copy --from src))
    copy = Path.join(tmp, "copy")

    assert JSON.decode!(File.read!(Path.join(copy, "cartridge.json"))) ==
             %{JSON.decode!(File.read!(Path.join(src, "cartridge.json"))) | "id" => "copy"}

    files = fn dir ->
      for f <- Path.wildcard("#{dir}/**/*", match_dot: true), do: Path.relative_to(f, dir)
    end

    assert files.(copy) == files.(src) -- ["checkpoints", "checkpoints/one.json"]

    for rel <- files.(copy) -- ["cartridge.json"],
        File.regular?(Path.join(copy, rel)),
        do: assert(File.read!(Path.join(copy, rel)) == File.read!(Path.join(src, rel)), rel)
  end

  # Break: a link copied (it could point out of cartridges/), a refused copy left half written, or a
  # source with no cartridge.json copied.
  test "a source holding a link is refused and nothing is written", %{tmp_dir: tmp} do
    new(~w(--cwd #{tmp} cartridge src))
    File.ln_s!(Path.join(tmp, "src/rooms/start.json"), Path.join(tmp, "src/rooms/linked.json"))

    assert_raise Mix.Error, ~r{src/rooms/linked.json is a symlink}, fn ->
      new(~w(--cwd #{tmp} cartridge copy --from src))
    end

    refute File.exists?(Path.join(tmp, "copy"))

    assert_raise Mix.Error, ~r{is not a cartridge}, fn ->
      new(~w(--cwd #{tmp} cartridge copy --from #{tmp}))
    end
  end

  defp new(args), do: ExUnit.CaptureIO.capture_io(fn -> Mix.Tasks.Loka.New.run(args) end)
end
