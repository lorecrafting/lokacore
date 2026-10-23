defmodule Loka.ContentLintTest do
  # Author-time lints (Loka.Content.Lint; pass-1 analysis rows 1, 3, 5, 6 and 7). Each check has
  # one invalid fragment, from the pass-1 offender where one existed, and the valid form beside it.
  use ExUnit.Case, async: true

  alias Loka.Content.Lint

  @refuses %{"policy_version" => 1, "root" => %{"op" => "npc_present", "npc" => "wight"}}
  @always %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
  @tide %{"op" => "sky", "tide" => "high"}
  @visits %{"op" => "visited_count", "room" => "shore_steps", "at_least" => 3}

  defp lint(files), do: Lint.findings(files)
  defp variant(items), do: %{"when" => %{"root" => %{"op" => "all", "items" => items}}}

  test "check 1: a recipe whose policy refuses names a reason (M1, flamma)" do
    assert lint(%{"recipes/flamma.json" => %{"policy" => @refuses}}) ==
             ["recipes/flamma.json: policy refuses with no reason"]

    assert lint(%{"recipes/flamma.json" => %{"policy" => @refuses, "reason" => "reason.flamma"}}) ==
             []

    assert lint(%{"recipes/look.json" => %{"policy" => @always}}) == []
  end

  test "check 3: a reaction that writes state narrates or says it is silent (T4, plate_springs)" do
    apply = [%{"op" => "status.apply"}, %{"op" => "fact.assign"}]

    assert lint(%{"reactions/plate_springs.json" => %{"apply" => apply}}) ==
             [
               ~s(reactions/plate_springs.json: writes state with no narrate step and no "silent": true)
             ]

    assert lint(%{"reactions/a.json" => %{"apply" => [%{"op" => "fact.adjust"}]}}) ==
             [~s(reactions/a.json: writes state with no narrate step and no "silent": true)]

    # status.cure says nothing by spec, and fact.stamp is a fact write (warmth_dries, water_croft).
    for op <- ~w(status.cure fact.stamp) do
      assert lint(%{"reactions/w.json" => %{"apply" => [%{"op" => op}]}}) ==
               [~s(reactions/w.json: writes state with no narrate step and no "silent": true)]
    end

    assert lint(%{"reactions/p.json" => %{"apply" => apply ++ [%{"op" => "narrate"}]}}) == []
    assert lint(%{"reactions/p.json" => %{"apply" => apply, "silent" => true}}) == []
    assert lint(%{"reactions/q.json" => %{"apply" => [%{"op" => "quest.fail"}]}}) == []
  end

  test "check 5: a readable has a title; a dialogue with no label needs action.talk (T5, UH)" do
    room = %{"details" => %{"slate" => %{"readable" => %{"label" => "action.read"}}}}

    assert lint(%{"rooms/lever_hall.json" => room}) ==
             ["rooms/lever_hall.json: readable details.slate has no title"]

    titled = put_in(room, ["details", "slate", "readable", "title"], "detail.slate.title")
    assert lint(%{"rooms/lever_hall.json" => titled}) == []

    talk = "text.json: action.talk has no text, yet a dialogue has no label of its own"
    assert lint(%{"dialogues/bram.json" => %{}, "text.json" => %{}}) == [talk]
    assert lint(%{"dialogues/bram.json" => %{}, "text.json" => %{"action.talk" => ""}}) == [talk]

    assert lint(%{"dialogues/bram.json" => %{}, "text.json" => %{"action.talk" => "Talk to"}}) ==
             []

    assert lint(%{"dialogues/bram.json" => %{"label" => "action.bram"}, "text.json" => %{}}) == []
    assert lint(%{"dialogues/bram.json" => %{"keyword" => "ember"}, "text.json" => %{}}) == []
  end

  test "label rules: a choice or action label has no final period; a status label is lowercase" do
    dlg = fn key ->
      %{"dialogues/hal.json" => %{"keyword" => "hal", "choices" => %{"a" => %{"label" => key}}}}
    end

    bad = ["dialogues/hal.json: label l ends in a period"]

    assert Lint.findings(Map.put(dlg.("l"), "text.json", %{"l" => "Hire him."})) == bad

    for ok <- ["Hire him", "Wait...", "\"Aye,\" he says.", "“Aye,” he says."],
        do: assert(Lint.findings(Map.put(dlg.("l"), "text.json", %{"l" => ok})) == [])

    act = %{"actions/walk.json" => %{"label" => "l"}, "text.json" => %{"l" => "Walk."}}
    assert Lint.findings(act) == ["actions/walk.json: label l ends in a period"]

    st = fn key, text ->
      Lint.findings(%{"statuses/s.json" => %{"label" => key}, "text.json" => %{key => text}})
    end

    assert st.("condition.wet", "Wet") == [
             "statuses/s.json: label condition.wet is not lowercase"
           ]

    assert st.("condition.wet", "wet") == []
    assert st.("condition.bleeding", "Bleeding") == []
  end

  test "a do-nothing Leave or Close choice is refused outside the six single-choice talks" do
    talk = fn id, file, choice ->
      %{
        "cartridge.json" => %{"id" => id},
        "dialogues/#{file}.json" => %{"keyword" => "k", "choices" => %{"leave" => choice}},
        "text.json" => %{
          "l" => "Leave her be",
          "c" => "Close the ledger",
          "s" => "Leave it with Bram"
        }
      }
    end

    bad = fn file ->
      [
        "dialogues/#{file}.json: choice leave only leaves; the page's own Leave control ends the talk"
      ]
    end

    assert Lint.findings(
             talk.("toolbox_showcase", "bess_talk", %{"label" => "l", "narration" => "n"})
           ) ==
             bad.("bess_talk")

    assert Lint.findings(talk.("toolbox_showcase", "bess_talk", %{"label" => "c"})) ==
             bad.("bess_talk")

    # the allowlist is keyed by cartridge too: a sampler's nell_talk is not exempt
    assert Lint.findings(talk.("other", "nell_talk", %{"label" => "l"})) == bad.("nell_talk")
    assert Lint.findings(talk.("toolbox_showcase", "nell_talk", %{"label" => "l"})) == []
    # a Leave label that does something (a hand-over sequence) is a real choice
    assert Lint.findings(talk.("other", "bram", %{"label" => "s", "sequence" => []})) == []
  end

  # Samplers break lint rules on purpose, but not label wording (loka-p2ey, loka-z2j2).
  test "every cartridge's choice, action and status labels follow the label rules" do
    for dir <- Path.wildcard("cartridges/*"), File.exists?(Path.join(dir, "cartridge.json")) do
      assert {dir, Lint.labels(dir)} == {dir, []}
    end
  end

  test "check 6: the normal band starts below 100% (UK, mv)" do
    old = [%{"at_percent" => 100, "tone" => "normal"}, %{"at_percent" => 25, "tone" => "warning"}]

    assert lint(%{"resources.json" => %{"resources" => %{"mv" => %{"bands" => old}}}}) ==
             ["resources.json: mv bands have no normal band below 100%"]

    assert lint(%{"cartridge.json" => %{"world" => %{"bands" => old}}}) ==
             ["cartridge.json: world.bands have no normal band below 100%"]

    fixed = [%{"at_percent" => 50, "tone" => "normal"} | tl(old)]
    assert lint(%{"resources.json" => %{"resources" => %{"mv" => %{"bands" => fixed}}}}) == []
    # A later normal cut does not help: 99% draws the first cut below 100, here a warning.
    late = [
      hd(old),
      %{"at_percent" => 60, "tone" => "warning"},
      %{"at_percent" => 30, "tone" => "normal"}
    ]

    assert lint(%{"resources.json" => %{"resources" => %{"mv" => %{"bands" => late}}}}) ==
             ["resources.json: mv bands have no normal band below 100%"]

    assert lint(%{"resources.json" => %{"resources" => %{"hp" => %{}}}}) == []
  end

  test "check 6: no description variant is shadowed by an earlier one that always wins first" do
    shadow = "rooms/shore_steps.json: variants[1] is shadowed by variants[0]"
    room = &%{"rooms/shore_steps.json" => %{"variants" => &1}}

    assert lint(room.([variant([@visits]), variant([@visits, @tide])])) == [shadow]
    assert lint(room.([variant([]), variant([@tide])])) == [shadow]
    assert lint(room.([variant([@visits, @tide]), variant([@visits])])) == []
    any = %{"op" => "any", "items" => [@visits, @tide]}
    assert lint(room.([%{"when" => %{"root" => any}}, variant([@visits])])) == []
    assert lint(room.([%{"when" => %{"root" => any}}, variant([any, @visits])])) == [shadow]
    detail = %{"details" => %{"post" => %{"variants" => [variant([]), variant([@tide])]}}}

    assert lint(%{"rooms/shore_steps.json" => detail}) ==
             ["rooms/shore_steps.json details.post: variants[1] is shadowed by variants[0]"]

    assert lint(room.([%{"description" => "d"}, variant([@tide])])) ==
             ["rooms/shore_steps.json: variants[0] has no when", shadow]

    # pass-1 W1 (visits before tide) is order, not shadowing: neither guard contains the other.
    assert lint(room.([variant([@visits]), variant([@tide])])) == []
  end

  # Breaks: a fill source the lint stops reading (vessel, room detail, fuel above 0), or a want it
  # drops (use recipe, drink service, lamp). M8c: the dry flask a lantern burns.
  test "check 7: a wanted liquid or a burned fuel supply has something that fills it (M8c)" do
    fills = &Enum.filter(lint(&1), fn l -> l =~ ~r/ (want|burn) it;/ end)
    lamp = %{"items/lantern.json" => %{"fuel" => %{"kind" => "source", "supply" => "lamp_oil"}}}
    flask = &%{"items/lamp_oil.json" => %{"fuel" => %{"kind" => "supply", "initial" => &1}}}

    assert fills.(Map.merge(lamp, flask.(0))) ==
             ["items/lamp_oil.json: lantern burn it; it starts empty and nothing fills it"]

    assert fills.(Map.merge(lamp, flask.(1))) == []

    want = %{
      "recipes/oil_winch.json" => %{"target" => %{"tool" => %{"liquid" => "oil"}}},
      "services/s.json" => %{
        "benefit" => %{"kind" => "drink", "liquid" => "oil", "vessel" => "cask"}
      }
    }

    dry = [
      "liquids/oil.json: cask, oil_winch want it; no vessel starts with it and no detail gives it"
    ]

    assert fills.(want) == dry

    can =
      &%{
        "items/oilcan.json" => %{"vessel" => %{"initial" => %{"kind" => "oil", "quantity" => &1}}}
      }

    assert fills.(Map.merge(want, can.(0))) == dry
    assert fills.(Map.merge(want, can.(2))) == []
    well = %{"details" => %{"well" => %{"liquid_source" => "oil"}}}
    assert fills.(Map.put(want, "rooms/r.json", well)) == []
  end

  # Breaks: a source or sink field the lint stops reading, or an id named elsewhere (a guard, a
  # quest that only checks it) counted as one.
  test "check 7: every item has a source and a sink, read by field" do
    ear = %{"items/ear.json" => %{"location" => %{"in" => "template"}, "edible" => %{}}}
    assert lint(ear) == ["items/ear.json: nothing puts it in play"]
    shop = &%{"shop" => %{"offers" => [&1]}}

    for {rel, v} <- [
          {"replenish/r.json", %{"items" => ["ear"]}},
          {"recipes/r.json", %{"craft" => %{"yield" => %{"items" => ["ear"]}}}},
          {"npcs/n.json", %{"drops" => [%{"item" => "ear", "chance" => 1}]}},
          {"npcs/n.json", shop.(%{"item" => "ear", "buy" => 1})},
          {"npcs/n.json", shop.(%{"item" => "x", "stock" => %{"items" => ["ear"]}})},
          {"population_bundles/b.json", %{"item" => "ear"}},
          {"population_bundles/b.json", %{"corpse" => "ear"}},
          {"cartridge.json", %{"world" => %{"death" => %{"npc_corpse" => "ear"}}}},
          {"cartridge.json", %{"world" => %{"death" => %{"player_corpse" => "ear"}}}},
          {"services/s.json", %{"benefit" => %{"escrow" => %{"output" => "ear"}}}}
        ],
        do: assert(lint(Map.put(ear, rel, v)) == [], rel)

    flask = %{"items/lamp_oil.json" => %{"location" => %{"in" => "npc"}}}
    dry = ["items/lamp_oil.json: nothing takes it out of play"]
    assert lint(flask) == dry
    has = %{"op" => "has_item", "item" => "lamp_oil"}

    for {rel, v} <- [
          {"items/lamp_oil.json", %{"location" => %{"in" => "npc"}, "edible" => %{}}},
          {"recipes/r.json", %{"craft" => %{"consume" => %{"items" => ["lamp_oil"]}}}},
          {"npcs/n.json", shop.(%{"item" => "x", "stock" => %{"items" => ["lamp_oil"]}})},
          {"services/s.json", %{"benefit" => %{"escrow" => %{"items" => ["lamp_oil"]}}}},
          {"dialogues/d.json",
           %{"label" => "d", "choices" => %{"give" => %{"hand_over" => %{"item" => "lamp_oil"}}}}},
          {"npcs/n.json", shop.(%{"item" => "lamp_oil", "buy" => 2, "sell" => 1})}
        ],
        do: assert(lint(Map.put(flask, rel, v)) == [], rel)

    # Holding it for a quest or a recipe guard checks the item; neither takes it out of play.
    quest = %{"objective" => %{"policy" => %{"root" => has}}}
    guard = %{"policy" => %{"root" => has}, "reason" => "reason.r"}
    assert lint(Map.merge(flask, %{"recipes/r.json" => guard, "quests/q.json" => quest})) == dry

    assert lint(%{"items/ear.json" => %{"location" => %{"in" => "template"}}}) ==
             [
               "items/ear.json: nothing puts it in play",
               "items/ear.json: nothing takes it out of play"
             ]
  end

  # Row 7 (M8a): a target or tool tag query matches every item and NPC carrying the tag, wherever it
  # is, so oiling the winch's metal also took the attic lantern. Breaks: a new holder of a queried
  # tag, or a new tag query, enters unreviewed.
  test "toolbox_showcase target and tool tag queries match exactly the pinned items and NPCs" do
    {files, _} = Loka.Content.Source.load("cartridges/toolbox_showcase")

    holders = fn tag ->
      for {rel, _, %{"tags" => tags}} <- files,
          String.starts_with?(rel, ["items/", "npcs/"]) and tag in tags,
          do: Path.rootname(rel)
    end

    matches =
      for {rel, _, %{} = r} <- files,
          String.starts_with?(rel, ["recipes/", "reactions/"]),
          tag <- List.wrap(get_in(r, ["target", "tool", "tag"])) ++ queried(r),
          into: %{},
          do: {"#{rel} #{tag}", Enum.sort(holders.(tag))}

    metal = ~w(anvil attic_lantern axe gate_winch lantern training_sword)
    holding = ~w(items/loft_bucket items/oilcan items/smithy_bucket items/watering_can)

    assert matches == %{
             "recipes/fish.json rod" => ["items/rod", "items/rod_2"],
             "recipes/fish.json water" => ["items/pond_water"],
             "recipes/oil_winch.json metal" => Enum.map(metal, &"items/#{&1}"),
             "recipes/quench.json liquid_holding" => holding,
             "recipes/water_croft.json liquid_holding" => holding,
             "recipes/water_plot.json liquid_holding" => holding
           }
  end

  defp queried(%{} = m) do
    own = if m["op"] == "has_tag" and m["subject"] == "target", do: [m["tag"]], else: []
    own ++ Enum.flat_map(Map.values(m), &queried/1)
  end

  defp queried(l) when is_list(l), do: Enum.flat_map(l, &queried/1)
  defp queried(_), do: []

  # Story cartridges only (ruling b): toolbox_showcase, the one story cartridge since Ashmere's
  # retirement (loka-4hik). Out: every *_sampler (samplers break rules on purpose),
  # r9c_interactions (synthetic), lantern_proof and the ashmere_* cartridges. Findings over the
  # slice's timebox are pinned in lint_baseline.txt until loka-kgd.184 clears them: a new finding
  # fails, and so does a baseline grown past its cap.
  @baseline_cap 204
  @baseline File.read!("test/loka/lint_baseline.txt")
            |> String.split("\n", trim: true)
            |> Enum.reject(&String.starts_with?(&1, "#"))
  test "toolbox_showcase has no lint finding beyond the pinned baseline" do
    known = for l <- @baseline, do: String.trim_leading(l, "toolbox_showcase ")
    assert length(known) <= @baseline_cap
    assert Loka.Content.lint("cartridges/toolbox_showcase") == known
  end

  @tag :tmp_dir
  test "the compiler drops a reaction's silent mark: same artifact bytes, no silent key", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/toolbox_showcase", dir)
    {:ok, plain, _} = Loka.Content.compile(dir)
    rule = Path.join(dir, "reactions/attic_drench.json")
    File.write!(rule, Jason.encode!(Map.put(Jason.decode!(File.read!(rule)), "silent", true)))
    assert {:ok, ^plain, _} = Loka.Content.compile(dir)
  end

  test "a reaction's silent mark is true or absent (reaction.schema.json ReactionRule)" do
    # The source form fails other compiled-form rules; only the /silent errors matter here.
    rule = Jason.decode!(File.read!("cartridges/toolbox_showcase/reactions/attic_drench.json"))

    silent =
      &for(
        %{path: "/silent"} = e <-
          elem(Loka.Core.Contracts.validate("ReactionRule", Map.put(rule, "silent", &1)), 1),
        do: e
      )

    assert silent.(true) == []
    assert [_] = silent.(false)
  end

  @tag :tmp_dir
  test "mix loka.lint exits 1 on a finding and returns on none", %{tmp_dir: dir} do
    assert_raise ArgumentError, fn -> Mix.Tasks.Loka.Lint.run([dir]) end
    File.write!(Path.join(dir, "cartridge.json"), "{}")
    assert Mix.Tasks.Loka.Lint.run([dir]) == :ok
    # The parent folder holds cartridges but no manifest of its own.
    assert_raise ArgumentError, fn -> Lint.run(Path.dirname(dir)) end
    assert_raise ArgumentError, fn -> Lint.run(Path.join(dir, "missing")) end
    File.mkdir_p!(Path.join(dir, "recipes"))
    File.write!(Path.join(dir, "recipes/flamma.json"), Jason.encode!(%{"policy" => @refuses}))

    ExUnit.CaptureIO.capture_io(:stderr, fn ->
      assert catch_exit(Mix.Tasks.Loka.Lint.run([dir])) == {:shutdown, 1}
    end)
  end
end
