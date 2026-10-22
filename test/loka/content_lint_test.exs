defmodule Loka.ContentLintTest do
  # Author-time lints (Loka.Content.Lint; pass-1 analysis rows 1, 3, 3b, 5 and 6). Each check has
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

    assert lint(%{"reactions/p.json" => %{"apply" => apply ++ [%{"op" => "narrate"}]}}) == []
    assert lint(%{"reactions/p.json" => %{"apply" => apply, "silent" => true}}) == []
    assert lint(%{"reactions/q.json" => %{"apply" => [%{"op" => "quest.fail"}]}}) == []
  end

  test "check 3b: a hostile NPC with an attack has an engage line (C2a)" do
    d = %{"hostile" => @refuses}

    assert lint(%{"npcs/wight.json" => %{"disposition" => d, "attack" => %{}}}) ==
             ["npcs/wight.json: hostile with an attack but no disposition.engage line"]

    engage = Map.put(d, "engage", "npc.wight.engage")
    assert lint(%{"npcs/wight.json" => %{"disposition" => engage, "attack" => %{}}}) == []
    arrest = Map.put(d, "arrest", %{"to" => "cell"})
    assert lint(%{"npcs/guard.json" => %{"disposition" => arrest, "attack" => %{}}}) == []
    # A hostile shopkeeper refuses trade and never fights (bess).
    assert lint(%{"npcs/bess.json" => %{"disposition" => d}}) == []
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

  test "check 6: the normal band starts below 100% (UK, mv)" do
    old = [%{"at_percent" => 100, "tone" => "normal"}, %{"at_percent" => 25, "tone" => "warning"}]

    assert lint(%{"resources.json" => %{"resources" => %{"mv" => %{"bands" => old}}}}) ==
             ["resources.json: mv bands have no normal band below 100%"]

    assert lint(%{"cartridge.json" => %{"world" => %{"bands" => old}}}) ==
             ["cartridge.json: world.bands have no normal band below 100%"]

    fixed = [%{"at_percent" => 50, "tone" => "normal"} | tl(old)]
    assert lint(%{"resources.json" => %{"resources" => %{"mv" => %{"bands" => fixed}}}}) == []
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

    # pass-1 W1 (visits before tide) is order, not shadowing: neither guard contains the other.
    assert lint(room.([variant([@visits]), variant([@tide])])) == []
  end

  # Story cartridges only (ruling b): toolbox_showcase, the one story cartridge since Ashmere's
  # retirement (loka-4hik). Out: every *_sampler (samplers break rules on purpose),
  # r9c_interactions (synthetic), lantern_proof and the ashmere_* cartridges. The findings over the slice's
  # timebox are pinned in lint_baseline.txt until loka-kgd.184 clears them: a new finding fails.
  @baseline File.read!("test/loka/lint_baseline.txt") |> String.split("\n", trim: true)
  for cartridge <- ~w(toolbox_showcase) do
    test "#{cartridge} has no lint finding beyond the pinned baseline" do
      prefix = unquote(cartridge) <> " "

      known =
        for l <- @baseline, String.starts_with?(l, prefix), do: String.trim_leading(l, prefix)

      assert Loka.Content.lint("cartridges/#{unquote(cartridge)}") == known
    end
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
    assert Mix.Tasks.Loka.Lint.run([dir]) == :ok
    File.mkdir_p!(Path.join(dir, "recipes"))
    File.write!(Path.join(dir, "recipes/flamma.json"), Jason.encode!(%{"policy" => @refuses}))

    ExUnit.CaptureIO.capture_io(:stderr, fn ->
      assert catch_exit(Mix.Tasks.Loka.Lint.run([dir])) == {:shutdown, 1}
    end)
  end
end
