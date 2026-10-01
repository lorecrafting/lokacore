defmodule Loka.ContentErrandTest do
  # Quests in the compiler (Early R7/R8 Q; quest.schema.json QuestDefinition; policy.schema.json
  # quest_state). Expected diagnostics are hand-written from protocol/cartridge.schema.json
  # DiagnosticCode, with the loader's paths in kernel/ts/test/quests.test.ts; the known answer
  # is protocol/fixtures/cartridge_errand_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_errand_hash.json"))
  @src "cartridges/ashmere_errand"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  # ashmere_errand's source with `files` merged over it (nil removes a file).
  defp compile(dir, files) do
    base =
      for rel <- Path.wildcard("#{@src}/**/*.json"),
          not String.contains?(rel, "transcripts"),
          into: %{},
          do: {Path.relative_to(rel, @src), JSON.decode!(File.read!(rel))}

    for {rel, v} <- Map.merge(base, files), v != nil do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))
  defp edit(rel, path, v), do: %{rel => put_in(src(rel), path, v)}

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "ashmere_errand",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  defp d(code, path, data \\ %{}, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp variant, do: ["variants", Access.at(0), "when", "root", "quest"]
  @strict %{"evidence" => "post_activation_event", "item_acquired" => "lantern"}

  # Breaks: a quest, its objective or a quest_state dropped or reshaped.
  test "ashmere_errand compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a short quest, objective item or item_acquired reference left short (the loader
  # would reject it).
  test "full quest and item references compile to the same artifact", %{tmp_dir: dir} do
    objective = ["objective", "policy", "root", "item"]

    files = %{
      "rooms/ferry_landing.json" =>
        put_in(src("rooms/ferry_landing.json"), variant(), ref("quest", "lantern")),
      "quests/lantern.json" =>
        put_in(src("quests/lantern.json"), objective, ref("item", "lantern"))
    }

    assert compile(Path.join(dir, "a"), files) == {:ok, @expected, []}

    strict = fn item ->
      edit("quests/lantern.json", ["objective"], %{@strict | "item_acquired" => item})
    end

    {:ok, short, []} = compile(Path.join(dir, "b"), strict.("lantern"))
    assert compile(Path.join(dir, "c"), strict.(ref("item", "lantern"))) == {:ok, short, []}
    quest = JSON.decode!(short)["cartridge"]["quests"]["ashmere_errand@0.0.1:quest/lantern"]
    assert quest["objective"]["item_acquired"] == ref("item", "lantern")
  end

  # Breaks: a quest_state, objective item or quest text naming what the cartridge lacks compiles
  # (the loader rejects it).
  test "an unknown quest, item or text is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    oil = %{"target" => "ashmere_errand@0.0.1:item/oil"}

    assert compile(Path.join(dir, "a"), edit("rooms/ferry_landing.json", variant(), "missing")) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/ferry_landing.variants[0].when.root.quest", %{
                  "target" => "ashmere_errand@0.0.1:quest/missing"
                })
              ]}

    assert compile(
             Path.join(dir, "b"),
             edit("quests/lantern.json", ["objective"], %{@strict | "item_acquired" => "oil"})
           ) ==
             {:error, [d("UNRESOLVED_REFERENCE", "quests/lantern.objective.item_acquired", oil)]}

    assert compile(
             Path.join(dir, "c"),
             edit("quests/lantern.json", ["objective", "policy", "root", "item"], "oil")
           ) ==
             {:error,
              [d("UNRESOLVED_REFERENCE", "quests/lantern.objective.policy.root.item", oil)]}

    text = Map.drop(src("text.json"), ["quest.lantern.title", "quest.lantern.accept"])

    assert compile(Path.join(dir, "d"), %{"text.json" => text}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "quests/lantern.offer.label", %{
                  "target" => "quest.lantern.accept"
                }),
                d("UNRESOLVED_REFERENCE", "quests/lantern.title", %{
                  "target" => "quest.lantern.title"
                })
              ]}
  end

  # Breaks: a quest or quest_state compiling without quest@1 in the manifest, or a quest whose
  # offer takes a registered command's key.
  test "a quest needs quest@1 and a key of its own", %{tmp_dir: dir} do
    m = src("cartridge.json")
    caps = ["requires", "capabilities"]
    files = %{"cartridge.json" => update_in(m, caps, &Map.delete(&1, "quest"))}
    undeclared = &d("UNDECLARED_CAPABILITY", &1, %{"capability" => "quest"}, ["quest@1"])

    assert compile(Path.join(dir, "a"), files) ==
             {:error,
              [
                undeclared.("quests/lantern"),
                undeclared.("rooms/ferry_landing.variants[0].when.root.op")
              ]}

    take = %{
      "quests/lantern.json" => nil,
      "quests/take.json" => src("quests/lantern.json"),
      "rooms/ferry_landing.json" => put_in(src("rooms/ferry_landing.json"), variant(), "take")
    }

    assert compile(Path.join(dir, "b"), take) ==
             {:error, [d("DUPLICATE_DEFINITION", "quests/take")]}
  end
end
