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

  # Break: a long-form reference (`cartridge_id`) in the entry or an exit still names the source, so
  # the copy does not compile ("Nothing defines the room"); or a text rewrite that also changes prose
  # holding the same word.
  test "a copy renames every reference to the source and no prose", %{tmp_dir: tmp} do
    new(~w(--cwd #{tmp} cartridge src rooms yard --from start east))

    ref = fn key ->
      %{"cartridge_id" => "src", "cartridge_version" => "0.0.1", "kind" => "room", "key" => key}
    end

    edit(tmp, "src/cartridge.json", &%{&1 | "entry" => ref.("start")})

    edit(
      tmp,
      "src/rooms/start.json",
      &(&1 |> put_in(~w(exits east to), ref.("yard")) |> put_in(~w(name prose), "src"))
    )

    edit(tmp, "src/rooms/yard.json", & &1)
    new(~w(--cwd #{tmp} cartridge copy --from src))
    copy = Path.join(tmp, "copy")

    assert {:ok, _, []} = Loka.Content.compile(copy)
    # a file with no reference keeps its bytes (here compact, not the starters' two spaces)
    assert File.read!(Path.join(copy, "rooms/yard.json")) ==
             File.read!(Path.join(src_dir(tmp), "rooms/yard.json"))

    start = JSON.decode!(File.read!(Path.join(copy, "rooms/start.json")))
    assert start["exits"]["east"]["to"]["cartridge_id"] == "copy"
    assert start["name"]["prose"] == "src"
  end

  # Break: a rewritten file's keys reordered (a noisy diff of the author's file) or an empty object
  # printed over lines.
  test "an ordered object prints in its own order" do
    assert Loka.Content.Starters.Parts.pretty(%{"b" => 1, "a" => 2}) ==
             ~s({\n  "a": 2,\n  "b": 1\n}\n)

    assert Loka.Content.Starters.Parts.pretty({:obj, [{"b", {:obj, []}}, {"a", 1}]}) ==
             ~s({\n  "b": {},\n  "a": 1\n}\n)
  end

  # Break: a shipped world whose copy does not compile (the editor's New world from it).
  for world <- ~w(rooms_sampler toolbox_showcase) do
    test "a copy of #{world} compiles with no warning", %{tmp_dir: tmp} do
      new(~w(--cwd #{tmp} cartridge copy --from #{Path.expand("cartridges/#{unquote(world)}")}))
      assert {:ok, _, []} = Loka.Content.compile(Path.join(tmp, "copy"))
    end
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

  defp src_dir(tmp), do: Path.join(tmp, "src")

  defp edit(tmp, rel, fun) do
    path = Path.join(tmp, rel)
    File.write!(path, JSON.encode!(fun.(JSON.decode!(File.read!(path)))))
  end

  defp new(args), do: ExUnit.CaptureIO.capture_io(fn -> Mix.Tasks.Loka.New.run(args) end)
end
