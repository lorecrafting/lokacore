defmodule Loka.ContentEmotesTest do
  # NPC emotes (G9, emote@1; docs/system/mechanics.md#npc-emotes-g9) on a copy of the emote sampler.
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(dir, rel, fun) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(fun.(JSON.decode!(File.read!(path)))))
  end

  defp drop(m, [k]), do: Map.delete(m, k)
  defp drop(l, [i | p]) when is_list(l), do: List.update_at(l, i, &drop(&1, p))
  defp drop(m, [k | p]), do: Map.update!(m, k, &drop(&1, p))

  defp refused(dir, code, path) do
    assert {:error, ds} = Loka.Content.compile(dir)
    assert Enum.any?(ds, &(&1["code"] == code and &1["path"] == path)), inspect(ds)
  end

  setup %{tmp_dir: dir} do
    File.cp_r!("cartridges/emote_sampler", dir)
    :ok
  end

  # Breaks: the sampler stops compiling, or a step's short emote and npc refs stop expanding.
  test "the sampler compiles its emote table and expands the step refs", %{tmp_dir: dir} do
    assert {:ok, bytes, []} = Loka.Content.compile(dir)
    c = JSON.decode!(bytes)["cartridge"]

    assert %{"key" => "bow", "to" => %{"you" => "emote.bow.you"}} =
             c["emotes"]["emote_sampler@0.0.1:emote/bow"]

    [step] = c["reactions"]["emote_sampler@0.0.1:reaction/greet"]["steps"]

    assert %{
             "emote" => %{"kind" => "emote", "key" => "bow"},
             "npc" => %{"kind" => "npc", "key" => "nell"}
           } = step
  end

  # Breaks: the schema drops a required emote field: a `to` form, the untargeted line, or a step's emote.
  for {name, rel, drop} <- [
        {"a to without you", "emotes/bow.json", ["to", "you"]},
        {"a to without others", "emotes/bow.json", ["to", "others"]},
        {"an emote without others", "emotes/cower.json", ["others"]},
        {"an emote step without its emote", "reactions/cower.json", ["steps", 0, "emote"]}
      ] do
    test "#{name} is a schema violation", %{tmp_dir: dir} do
      update(dir, unquote(rel), &drop(&1, unquote(drop)))
      assert {:error, ds} = Loka.Content.compile(dir)
      assert Enum.any?(ds, &(&1["code"] == "SCHEMA_VIOLATION")), inspect(ds)
    end
  end

  # Breaks: an emote's text key missing from the catalog is admitted.
  test "an emote text key the catalog lacks is unresolved", %{tmp_dir: dir} do
    update(dir, "emotes/bow.json", &put_in(&1, ["to", "you"], "emote.bow.missing"))
    refused(dir, "UNRESOLVED_REFERENCE", "emotes/bow.to.you")
  end

  # Breaks: emotes compile without the emote@1 capability.
  test "emotes without emote@1 are an undeclared capability", %{tmp_dir: dir} do
    update(
      dir,
      "cartridge.json",
      &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "emote") end)
    )

    assert {:error, ds} = Loka.Content.compile(dir)
    assert Enum.any?(ds, &(&1["code"] == "UNDECLARED_CAPABILITY")), inspect(ds)
  end

  # Breaks: a step naming an emote the table lacks is admitted.
  test "a step's unknown emote is unresolved", %{tmp_dir: dir} do
    update(dir, "reactions/cower.json", &put_in(&1, ["steps", Access.at(0), "emote"], "sneer"))
    assert {:error, ds} = Loka.Content.compile(dir)
    assert Enum.any?(ds, &(&1["code"] == "UNRESOLVED_REFERENCE")), inspect(ds)
  end

  # Breaks: a step's `to` on an emote without `to` forms is admitted (no line could word it).
  test "a step to on an emote without to forms is refused at the step", %{tmp_dir: dir} do
    update(dir, "reactions/cower.json", &put_in(&1, ["steps", Access.at(0), "to"], "subject"))
    refused(dir, "UNRESOLVED_REFERENCE", "reactions/cower.steps[0].to")
  end

  # Breaks: an emote step's npc naming a spawn template is admitted (no single emoter to resolve at play).
  test "a step's npc that is a spawn template is refused", %{tmp_dir: dir} do
    update(dir, "reactions/greet.json", &put_in(&1, ["steps", Access.at(0), "npc"], "goblin"))
    refused(dir, "SCHEMA_VIOLATION", "reactions/greet.steps[0].npc")
  end
end
