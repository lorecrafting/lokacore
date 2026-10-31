defmodule Loka.ContentErrandTest do
  # Quests in the compiler (Early R7/R8 Q; quest.schema.json QuestDefinition; policy.schema.json
  # quest_state). Expected diagnostics are hand-written from protocol/cartridge.schema.json
  # DiagnosticCode, with the loader's paths in kernel/ts/test/quests.test.ts; the known answer
  # is protocol/fixtures/cartridge_errand_hash.json (Python).
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/errand_sampler")}
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_errand_hash.json"))
  @src "cartridges/errand_sampler"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))
  defp edit(rel, path, v), do: %{rel => put_in(src(rel), path, v)}

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "errand_sampler",
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

  defp variant, do: ["variants", Access.at(0), "when", "quest"]
  @strict %{"evidence" => "post_activation_event", "item_acquired" => "lantern"}

  # Breaks: a quest, its objective or a quest_state dropped or reshaped.
  test "errand_sampler compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a short quest, objective item or item_acquired reference left short (the loader
  # would reject it).
  test "full quest and item references compile to the same artifact", %{dir: dir} do
    objective = ["objective", "policy", "item"]

    files = %{
      "rooms/ferry_landing.json" =>
        put_in(src("rooms/ferry_landing.json"), variant(), ref("quest", "lantern")),
      "quests/lantern.json" =>
        put_in(src("quests/lantern.json"), objective, ref("item", "lantern"))
    }

    assert compile(dir, files) == {:ok, @expected, []}

    strict = fn item ->
      edit("quests/lantern.json", ["objective"], %{@strict | "item_acquired" => item})
    end

    {:ok, short, []} = compile(dir, strict.("lantern"))
    assert compile(dir, strict.(ref("item", "lantern"))) == {:ok, short, []}
    quest = JSON.decode!(short)["cartridge"]["quests"]["errand_sampler@0.0.1:quest/lantern"]
    assert quest["objective"]["item_acquired"] == ref("item", "lantern")
  end

  # Breaks: a quest_state, objective item or quest text naming what the cartridge lacks compiles
  # (the loader rejects it).
  test "an unknown quest, item or text is UNRESOLVED_REFERENCE", %{dir: dir} do
    oil = %{"target" => "errand_sampler@0.0.1:item/oil"}

    assert compile(dir, edit("rooms/ferry_landing.json", variant(), "missing")) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/ferry_landing.variants[0].when.quest", %{
                  "target" => "errand_sampler@0.0.1:quest/missing"
                })
              ]}

    assert compile(
             dir,
             edit("quests/lantern.json", ["objective"], %{@strict | "item_acquired" => "oil"})
           ) ==
             {:error, [d("UNRESOLVED_REFERENCE", "quests/lantern.objective.item_acquired", oil)]}

    assert compile(
             dir,
             edit("quests/lantern.json", ["objective", "policy", "item"], "oil")
           ) ==
             {:error, [d("UNRESOLVED_REFERENCE", "quests/lantern.objective.policy.item", oil)]}

    text = Map.drop(src("text.json"), ["quest.lantern.title", "quest.lantern.accept"])

    assert compile(dir, %{"text.json" => text}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "quests/lantern.name", %{
                  "target" => "quest.lantern.title"
                }),
                d("UNRESOLVED_REFERENCE", "quests/lantern.offer.label", %{
                  "target" => "quest.lantern.accept"
                })
              ]}
  end

  # Breaks: a quest or quest_state compiling without quest@1 in the manifest, or a quest whose
  # offer takes a registered command's, an action's or a scripted action's key (the offer would replace it).
  test "a quest needs quest@1 and a key of its own", %{dir: dir} do
    m = src("cartridge.json")
    caps = ["requires", "capabilities"]
    files = %{"cartridge.json" => update_in(m, caps, &Map.delete(&1, "quest"))}
    undeclared = &d("UNDECLARED_CAPABILITY", &1, %{"capability" => "quest"}, ["quest@1"])

    assert compile(dir, files) ==
             {:error,
              [
                undeclared.("quests/lantern"),
                undeclared.("rooms/ferry_landing.variants[0].when.op")
              ]}

    take = %{
      "quests/lantern.json" => nil,
      "quests/take.json" => src("quests/lantern.json"),
      "rooms/ferry_landing.json" => put_in(src("rooms/ferry_landing.json"), variant(), "take")
    }

    assert compile(dir, take) ==
             {:error, [d("DUPLICATE_DEFINITION", "quests/take")]}

    action = %{
      "name" => "quest.lantern.accept",
      "accessibility" => "quest.lantern.accept",
      "target" => %{"kind" => "none"},
      "command" => "look",
      "priority" => 0,
      "input" => [],
      "policy" => %{"op" => "all", "items" => []}
    }

    assert compile(dir, %{"actions/lantern.json" => action}) ==
             {:error, [d("DUPLICATE_DEFINITION", "quests/lantern")]}

    caps = ["requires", "capabilities"]
    post = %{"aliases" => ["post"], "description" => "quest.lantern.title"}

    scripted = %{
      "cartridge.json" =>
        update_in(
          src("cartridge.json"),
          caps,
          &Map.merge(&1, %{"scripted_action" => 1, "inspectable_detail" => 1})
        ),
      "rooms/ferry_landing.json" =>
        put_in(src("rooms/ferry_landing.json"), ["details"], %{"post" => post}),
      "actions/lantern.json" => %{
        "name" => "quest.lantern.accept",
        "aliases" => ["lantern"],
        "target" => %{"kind" => "detail", "room" => "ferry_landing", "detail" => "post"},
        "priority" => 0,
        "policy" => action["policy"],
        "outcomes" => %{
          "success" => %{
            "steps" => [%{"op" => "event.emit", "event" => "rang"}],
            "narration" => %{"actor" => "quest.lantern.title"}
          }
        }
      }
    }

    assert compile(dir, scripted) ==
             {:error, [d("DUPLICATE_DEFINITION", "quests/lantern")]}
  end

  # Breaks: a room's action contribution naming a quest's offer rejected as unresolved.
  test "a room may contribute a quest's offer", %{dir: dir} do
    landing = src("rooms/ferry_landing.json")

    contribute = fn k ->
      %{
        "rooms/ferry_landing.json" =>
          Map.put(landing, "actions", [%{"op" => "replace", "actions" => [k]}])
      }
    end

    assert {:ok, _, []} = compile(dir, contribute.("lantern"))

    assert compile(dir, contribute.("shed")) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/ferry_landing.actions[0].actions[0]", %{
                  "target" => "shed"
                })
              ]}
  end

  # Breaks: an offer target naming a room, a detail or an NPC the cartridge does not have compiling,
  # or a short ref not expanding (loka-vx2v; the good target is the ferry's, in quest_dialogue.test.ts).
  test "an offer target's room, detail and npc resolve", %{dir: dir} do
    target = fn t -> edit("quests/lantern.json", ["offer", "target"], t) end
    missing = fn key -> "errand_sampler@0.0.1:#{key}" end

    assert compile(dir, target.(%{"kind" => "detail", "room" => "nowhere", "detail" => "post"})) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "quests/lantern.offer.target.room", %{
                  "target" => missing.("room/nowhere")
                })
              ]}

    assert compile(
             dir,
             target.(%{"kind" => "detail", "room" => "ferry_landing", "detail" => "post"})
           ) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "quests/lantern.offer.target.detail", %{
                  "target" => "post"
                })
              ]}

    assert compile(dir, target.(%{"kind" => "npc", "npc" => "nobody"})) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "quests/lantern.offer.target.npc", %{
                  "target" => missing.("npc/nobody")
                })
              ]}

    assert {:ok, bytes, []} = compile(dir, target.(%{"kind" => "npc", "npc" => "bram"}))
    compiled = JSON.decode!(bytes)["cartridge"]["quests"]["errand_sampler@0.0.1:quest/lantern"]
    assert compiled["offer"]["target"] == %{"kind" => "npc", "npc" => ref("npc", "bram")}
  end
end
