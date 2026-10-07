defmodule Loka.ContentD9Test do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Breaks: D9 compiles a cue with a non-boolean source, an unsupported plan, or an older API.
  test "D9 source declarations reject unusable cue and suppression contracts", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    manifest_path = Path.join(dir, "cartridge.json")
    reaction_path = Path.join(dir, "reactions/d9_suppress_hounds.json")
    manifest = manifest_path |> File.read!() |> JSON.decode!()
    reaction = reaction_path |> File.read!() |> JSON.decode!()

    for {path, original, changed} <- [
          {manifest_path, manifest,
           put_in(manifest, ["world", "bell_cue", "fact"], "chapel_allegiance")},
          {manifest_path, manifest,
           put_in(manifest, ["requires", "kernel_api", "at_least"], "1.34")},
          {reaction_path, reaction,
           put_in(reaction, ["apply", Access.at(0), "plan"], "willow_deer")}
        ] do
      File.write!(path, JSON.encode!(changed))
      assert {:error, _} = Loka.Content.compile(dir)
      File.write!(path, JSON.encode!(original))
    end
  end
end
