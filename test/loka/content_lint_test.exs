defmodule Loka.ContentLintTest do
  # Author-time lints (Loka.Content.Lint; pass-1 analysis rows 1, 3, 5, 6 and 7). Each check has
  # one invalid fragment, from the pass-1 offender where one existed, and the valid form beside it.
  use ExUnit.Case, async: true

  alias Loka.Content.Lint

  @refuses %{"op" => "npc_present", "npc" => "wight"}
  @always %{"op" => "all", "items" => []}
  @tide %{"op" => "sky", "tide" => "high"}
  @visits %{"op" => "visited_count", "room" => "shore_steps", "at_least" => 3}

  defp lint(files), do: Lint.findings(files)
  defp variant(items), do: %{"when" => %{"op" => "all", "items" => items}}

  test "check 1: a recipe whose policy refuses names a reason (M1, flamma)" do
    assert lint(%{"actions/flamma.json" => %{"policy" => @refuses}}) ==
             ["actions/flamma.json: policy refuses with no reason"]

    assert lint(%{"actions/flamma.json" => %{"policy" => @refuses, "reason" => "reason.flamma"}}) ==
             []

    # Break: a built-in action (with command, no reason field to add) gets an unfixable finding.
    assert lint(%{"actions/look.json" => %{"command" => "look", "policy" => @refuses}}) == []
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
    room = %{
      "description" => "room.hall",
      "details" => %{"slate" => %{"readable" => %{"label" => "action.read"}}}
    }

    linked = %{"room.hall" => "A [slate](slate)."}

    assert lint(%{"rooms/lever_hall.json" => room, "text.json" => linked}) ==
             ["rooms/lever_hall.json: readable details.slate has no title"]

    titled = put_in(room, ["details", "slate", "readable", "title"], "detail.slate.title")
    assert lint(%{"rooms/lever_hall.json" => titled, "text.json" => linked}) == []

    talk = "text.json: action.talk has no text, yet a dialogue has no label of its own"
    assert lint(%{"dialogues/bram.json" => %{}, "text.json" => %{}}) == [talk]
    assert lint(%{"dialogues/bram.json" => %{}, "text.json" => %{"action.talk" => ""}}) == [talk]

    assert lint(%{"dialogues/bram.json" => %{}, "text.json" => %{"action.talk" => "Talk to"}}) ==
             []

    assert lint(%{"dialogues/bram.json" => %{"label" => "action.bram"}, "text.json" => %{}}) == []
    assert lint(%{"dialogues/bram.json" => %{"keyword" => "ember"}, "text.json" => %{}}) == []
  end

  # loka-x6t.120 (book-ui.md fixture rule): a detail with a page is linked from its room's prose,
  # and a recipe aimed at a detail gives that detail a title.
  test "a detail with a page is linked from the prose; a recipe's target detail has a title" do
    hearth = %{"aliases" => ["hearth"], "description" => "detail.hearth"}
    room = %{"description" => "room.loft", "details" => %{"hearth" => hearth}}
    aim = %{"target" => %{"kind" => "detail", "room" => "loft", "detail" => "hearth"}}
    plain = %{"room.loft" => "A low loft with a hearth."}
    linked = %{"room.loft" => "A low loft with a [hearth](hearth)."}
    files = &Map.merge(%{"rooms/loft.json" => room, "actions/gather_ash.json" => aim}, &1)
    unlinked = "rooms/loft.json: details.hearth has a page and no prose link"
    untitled = "rooms/loft.json: details.hearth is a recipe target (gather_ash) and has no title"

    assert lint(files.(%{"text.json" => plain})) == [unlinked, untitled]

    titled = put_in(room, ["details", "hearth", "title"], "detail.hearth.title")
    assert lint(files.(%{"rooms/loft.json" => titled, "text.json" => linked})) == []

    # A variant's prose links it too; a detail no recipe aims at and of no page kind needs neither.
    varied =
      Map.put(titled, "variants", [Map.put(variant([@tide]), "description", "room.loft.lit")])

    lit = Map.put(plain, "room.loft.lit", "Firelight from the [hearth](hearth).")
    assert lint(files.(%{"rooms/loft.json" => varied, "text.json" => lit})) == []
    assert lint(%{"rooms/loft.json" => room, "text.json" => plain}) == []

    bed = put_in(room, ["details", "hearth", "bed"], %{})
    assert lint(%{"rooms/loft.json" => bed, "text.json" => plain}) == [unlinked]
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

  test "a do-nothing Leave or Close choice is refused in a talk with more than one choice" do
    talk = fn choice ->
      %{
        "dialogues/t.json" => %{
          "keyword" => "k",
          "choices" => %{"leave" => choice, "ask" => %{"label" => "a"}}
        },
        "text.json" => %{
          "a" => "Ask about the mill",
          "l" => "Leave her be",
          "c" => "Close the ledger",
          "s" => "Leave it with Bram",
          "w" => "Ask why we never Leave"
        }
      }
    end

    bad = [
      "dialogues/t.json: choice leave only leaves; the page's own Leave control ends the talk"
    ]

    assert Lint.findings(talk.(%{"label" => "l", "narration" => "n"})) == bad
    assert Lint.findings(talk.(%{"label" => "c"})) == bad
    # only a label that starts with Leave or Close is an exit
    assert Lint.findings(talk.(%{"label" => "w"})) == []
    # a single-choice talk keeps its own Leave
    one =
      put_in(talk.(%{"label" => "l"}), ["dialogues/t.json", "choices"], %{
        "leave" => %{"label" => "l"}
      })

    assert Lint.findings(one) == []
    # a Leave label that does something (a hand-over sequence) is a real choice
    assert Lint.findings(talk.(%{"label" => "s", "sequence" => []})) == []
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

  # Breaks: the rule dropped, a gate key (qualification) left out, a nested gate (a quest offer)
  # not walked, or an optional trigger (hostile, absent means never) flagged.
  test "an always-true policy, when or qualification is written by omission" do
    # Break: an always policy with no reason also reported as refusing.
    assert lint(%{"actions/look.json" => %{"policy" => @always}}) ==
             ["actions/look.json: policy always holds; omit it"]

    assert lint(%{"skills/s.json" => %{"qualification" => @always}}) ==
             ["skills/s.json: qualification always holds; omit it"]

    assert lint(%{"quests/q.json" => %{"offer" => %{"policy" => @always}}}) ==
             ["quests/q.json: offer.policy always holds; omit it"]

    assert lint(%{"npcs/n.json" => %{"disposition" => %{"hostile" => @always}}}) == []
  end

  test "check 6: no description variant is shadowed by an earlier one that always wins first" do
    shadow = "rooms/shore_steps.json: variants[1] is shadowed by variants[0]"
    room = &%{"rooms/shore_steps.json" => %{"variants" => &1}}

    assert lint(room.([variant([@visits]), variant([@visits, @tide])])) == [shadow]

    assert lint(room.([variant([]), variant([@tide])])) ==
             [shadow, "rooms/shore_steps.json: variants.0.when always holds; omit it"]

    assert lint(room.([variant([@visits, @tide]), variant([@visits])])) == []
    any = %{"op" => "any", "items" => [@visits, @tide]}
    assert lint(room.([%{"when" => any}, variant([@visits])])) == []
    assert lint(room.([%{"when" => any}, variant([any, @visits])])) == [shadow]
    detail = %{"details" => %{"post" => %{"variants" => [variant([]), variant([@tide])]}}}

    assert lint(%{"rooms/shore_steps.json" => detail}) ==
             [
               "rooms/shore_steps.json details.post: variants[1] is shadowed by variants[0]",
               "rooms/shore_steps.json: details.post.variants.0.when always holds; omit it"
             ]

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
      "actions/oil_winch.json" => %{"target" => %{"tool" => %{"liquid" => "oil"}}},
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
          {"actions/r.json", %{"craft" => %{"yield" => %{"items" => ["ear"]}}}},
          {"npcs/n.json", %{"drops" => [%{"item" => "ear", "chance" => 1}]}},
          {"npcs/n.json", shop.(%{"item" => "ear", "buy" => 1})},
          {"npcs/n.json", shop.(%{"item" => "x", "stock" => %{"items" => ["ear"]}})},
          {"populations/b.json", %{"item" => "ear"}},
          {"populations/b.json", %{"corpse" => "ear"}},
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
          {"actions/r.json", %{"craft" => %{"consume" => %{"items" => ["lamp_oil"]}}}},
          {"npcs/n.json", shop.(%{"item" => "x", "stock" => %{"items" => ["lamp_oil"]}})},
          {"services/s.json", %{"benefit" => %{"escrow" => %{"items" => ["lamp_oil"]}}}},
          {"dialogues/d.json",
           %{"label" => "d", "choices" => %{"give" => %{"hand_over" => %{"item" => "lamp_oil"}}}}},
          {"npcs/n.json", shop.(%{"item" => "lamp_oil", "buy" => 2, "sell" => 1})}
        ],
        do: assert(lint(Map.put(flask, rel, v)) == [], rel)

    # Holding it for a quest or a recipe guard checks the item; neither takes it out of play.
    quest = %{"objective" => %{"policy" => has}}
    guard = %{"policy" => has, "reason" => "reason.r"}
    assert lint(Map.merge(flask, %{"actions/r.json" => guard, "quests/q.json" => quest})) == dry

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
          String.starts_with?(rel, ["actions/", "reactions/"]),
          tag <- List.wrap(get_in(r, ["target", "tool", "tag"])) ++ queried(r),
          into: %{},
          do: {"#{rel} #{tag}", Enum.sort(holders.(tag))}

    metal = ~w(anvil attic_lantern axe gate_winch lantern training_sword)
    holding = ~w(items/loft_bucket items/oilcan items/smithy_bucket items/watering_can)

    assert matches == %{
             "actions/fish.json rod" => ["items/rod", "items/rod_2"],
             "actions/fish.json water" => ["items/pond_water"],
             "actions/lux.json lamp" => ["items/attic_lantern", "items/lantern"],
             "actions/oil_winch.json metal" => Enum.map(metal, &"items/#{&1}"),
             "actions/quench.json liquid_holding" => holding,
             "actions/water_croft.json liquid_holding" => holding,
             "actions/water_plot.json liquid_holding" => holding
           }
  end

  defp queried(%{} = m) do
    own = if m["op"] == "has_tag" and m["subject"] == "target", do: [m["tag"]], else: []
    own ++ Enum.flat_map(Map.values(m), &queried/1)
  end

  defp queried(l) when is_list(l), do: Enum.flat_map(l, &queried/1)
  defp queried(_), do: []

  # Story cartridges only (ruling b): toolbox_showcase, the one story cartridge (loka-4hik). Out:
  # every *_sampler (samplers break rules on purpose) and lantern_proof. Findings over the
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

  # Breaks: lint reads the source before extends is flattened, so it blames the prototype.
  @tag :tmp_dir
  test "lint sees the flattened source: a write inherited from an abstract reaction", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/build_sampler", dir)
    before = Loka.Content.lint(dir)
    write = %{"op" => "fact.assign", "fact" => "x", "value" => true}
    base = %{"abstract" => true, "on" => %{"event" => "x"}, "apply" => [write]}
    File.write!(Path.join(dir, "reactions/base.json"), Jason.encode!(base))
    File.write!(Path.join(dir, "reactions/child.json"), Jason.encode!(%{"extends" => "base"}))

    assert Loka.Content.lint(dir) -- before ==
             [~s(reactions/child.json: writes state with no narrate step and no "silent": true)]
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
    File.mkdir_p!(Path.join(dir, "actions"))
    File.write!(Path.join(dir, "actions/flamma.json"), Jason.encode!(%{"policy" => @refuses}))

    ExUnit.CaptureIO.capture_io(:stderr, fn ->
      assert catch_exit(Mix.Tasks.Loka.Lint.run([dir])) == {:shutdown, 1}
    end)
  end
end
