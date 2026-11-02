# loka-vduxr.11: what the compiler says of once per sitting, end_talk and a story point on any choice.
defmodule Loka.ContentDialogueSittingTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/persuade_sampler")}

  @guard "dialogues/guard.json"
  @label "dialogue.guard.persuade"
  @said "narration.guard.persuade"
  @sitting %{"label" => @label, "narration" => @said, "sitting" => true}
  @plain %{"label" => @label, "narration" => @said}

  @check %{
    "key" => "c",
    "kind" => "opposed",
    "attribute" => "cha",
    "npc" => "guard",
    "failure" => @said
  }

  @patrol %{"npc" => "guard", "quest" => "any", "transition" => "continue"}
  @riddle %{
    "choice_id" => "a",
    "answer" => "tide",
    "bank" => ["T", "I", "D", "E"],
    "wrong" => @said
  }

  defp choices(cs), do: {@guard, &Map.put(&1, "choices", cs)}
  defp why(diags), do: Enum.map(diags, & &1["data"]["why"])

  defp refusal(dir, changes, want) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    assert want in why(diags), inspect(diags)
  end

  defp warned(dir, changes) do
    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, changes)
    Enum.map(warnings, & &1["code"])
  end

  # Breaks: sitting accepted where the hub never comes back, so the writer's choice silently stays.
  test "sitting is refused where the talk does not come back", %{dir: dir} do
    for bad <- [
          %{"a" => Map.put(@sitting, "then", "end"), "b" => @plain},
          %{"a" => @sitting},
          %{"a" => Map.put(@sitting, "once", true), "b" => @plain},
          %{"a" => Map.put(@sitting, "story_point", "met/a"), "b" => @plain},
          %{"a" => Map.put(@sitting, "check", @check), "b" => @plain},
          %{"a" => @sitting, "b" => Map.put(@plain, "then", "guard")},
          %{"a" => Map.put(@sitting, "patrol", @patrol), "b" => @plain}
        ] do
      refusal(dir, [choices(bad)], "sitting_no_return")
    end

    riddle =
      {@guard,
       &Map.merge(&1, %{"riddle" => @riddle, "choices" => %{"a" => @plain, "b" => @sitting}})}

    refusal(dir, [riddle], "sitting_no_return")

    fine = choices(%{"a" => @sitting, "b" => @plain})
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [fine])
  end

  # Breaks: a chapter counted by a quest-less choice builds, and its chapter never comes.
  test "a chapter cannot count a choice with no quest" do
    dir = Loka.ContentSource.copy("cartridges/chapters_sampler")

    plain = fn d ->
      Map.delete(d, "quest")
    end

    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"dialogues/bram.json", plain}])
    assert "chapter_no_quest" in why(diags), inspect(diags)
  end

  # Breaks: the warning misses a set with no choice that stays, counts a plain one as spent, or
  # fires with no sitting choice at all.
  test "a hub of only spent choices warns, and one choice that stays clears it", %{dir: dir} do
    assert "SITTING_SPENT" in warned(dir, [choices(%{"a" => @sitting, "b" => @sitting})])
    refute "SITTING_SPENT" in warned(dir, [choices(%{"a" => @sitting, "b" => @plain})])
    refute "SITTING_SPENT" in warned(dir, [choices(%{"a" => @plain, "b" => @plain})])

    gated =
      Map.merge(@plain, %{
        "policy" => %{
          "op" => "not",
          "item" => %{"op" => "fact_compare", "fact" => "gate_open", "equals" => true}
        },
        "steps" => [%{"op" => "fact.assign", "fact" => "gate_open", "value" => true}]
      })

    refute "SITTING_SPENT" in warned(dir, [choices(%{"a" => gated, "b" => gated})])
  end

  # Breaks: a story point still needs a quest, or an answer that ends the talk may also lead on.
  test "a story point on a plain choice compiles, and with a then is refused", %{dir: dir} do
    point = Map.merge(@plain, %{"story_point" => "met/a", "once" => true})

    assert {:ok, bytes, _} =
             Loka.ContentSource.compile(dir, [choices(%{"a" => point, "b" => @plain})])

    assert bytes =~ "story_point/met"

    refusal(
      dir,
      [choices(%{"a" => Map.put(point, "then", "guard"), "b" => @plain})],
      "story_point_then"
    )

    repeats = Map.delete(point, "once")
    refusal(dir, [choices(%{"a" => repeats, "b" => @plain})], "story_point_repeats")

    ended = Map.put(point, "then", "end")

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [choices(%{"a" => ended, "b" => @plain})])
  end

  # Breaks: end_talk refused in a reaction, or taking a field it has no use for.
  test "end_talk is a reaction step with no fields", %{dir: dir} do
    caps = {"cartridge.json", &put_in(&1, ["requires", "capabilities", "reaction"], 1)}
    rule = &{"reactions/cut.json", %{"on" => %{"event" => "choice_resolved"}, "steps" => [&1]}}
    assert {:ok, bytes, _} = Loka.ContentSource.compile(dir, [caps, rule.(%{"op" => "end_talk"})])
    assert bytes =~ ~s("op":"end_talk")
    extra = rule.(%{"op" => "end_talk", "x" => 1})
    assert {:error, _} = Loka.ContentSource.compile(dir, [caps, extra])
  end

  # Breaks: a delayed end_talk closes whatever talk is open by then, or a second one in a rule
  # closes one row twice and faults the player's action.
  test "end_talk is refused after a wait and twice in a rule", %{dir: dir} do
    caps = {"cartridge.json", &put_in(&1, ["requires", "capabilities", "reaction"], 1)}
    rule = &{"reactions/cut.json", %{"on" => %{"event" => "choice_resolved"}, "steps" => &1}}
    cut = %{"op" => "end_talk"}

    assert {:error, a} =
             Loka.ContentSource.compile(dir, [
               caps,
               rule.([%{"op" => "wait", "seconds" => 30}, cut])
             ])

    refute Enum.any?(a, &(&1["code"] == "DUPLICATE_DEFINITION"))
    assert {:error, b} = Loka.ContentSource.compile(dir, [caps, rule.([cut, cut])])
    assert Enum.any?(b, &(&1["code"] == "DUPLICATE_DEFINITION")), inspect(b)
  end

  # Breaks: a rule on an event about someone else closes the acting player's talk instead.
  test "end_talk is refused on an event that is not the player's own act", %{dir: dir} do
    caps = {"cartridge.json", &put_in(&1, ["requires", "capabilities", "reaction"], 1)}

    for on <- [%{"event" => "spoken"}, %{"event" => "clock_hour"}] do
      rule = %{"on" => on, "steps" => [%{"op" => "end_talk"}]}
      refusal(dir, [caps, {"reactions/cut.json", rule}], "end_talk_event")
    end
  end

  # Breaks: the guide's example stops compiling, or the guide stops showing it.
  test "the guide's end_talk example compiles as written", %{dir: dir} do
    guide = File.read!("docs/guides/writing-the-game.md")
    [_, section] = String.split(guide, "## Cut a talk short\n")
    [_, fence] = Regex.run(~r/^```json\n(.*?)^```$/ms, section)
    caps = {"cartridge.json", &put_in(&1, ["requires", "capabilities", "reaction"], 1)}
    line = {"text.json", &put_in(&1, ["narration.maud_talk.cut_short"], "x")}
    rule = {"reactions/cut.json", JSON.decode!(fence)}
    assert {:ok, bytes, _} = Loka.ContentSource.compile(dir, [caps, line, rule])
    assert bytes =~ ~s("op":"end_talk")
  end

  # Breaks: two outcomes of a quest-less point build, so one player reaches the point twice.
  test "a story point with no quest takes one outcome", %{dir: dir} do
    point = fn o -> Map.merge(@plain, %{"story_point" => "met/" <> o, "once" => true}) end
    two = choices(%{"a" => point.("a"), "b" => point.("b"), "c" => @plain})
    refusal(dir, [two], "story_point_two_outcomes")
    one = choices(%{"a" => point.("a"), "c" => @plain})
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [one])
  end

  # Breaks: outcomes that exclude each other through one fact refused, so the only remedy is a
  # journal chapter; or a gate on two different facts (the lowered `once`) taken for exclusion.
  test "outcomes gated on one fact their steps set may share a story point", %{dir: dir} do
    point = fn o, fact ->
      Map.merge(@plain, %{
        "story_point" => "met/" <> o,
        "policy" => %{
          "op" => "not",
          "item" => %{"op" => "fact_compare", "fact" => fact, "equals" => true}
        },
        "steps" => [%{"op" => "fact.assign", "fact" => fact, "value" => true}]
      })
    end

    fact = %{
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => "x"
    }

    facts =
      {"facts.json",
       &Map.update!(&1, "facts", fn f -> Map.merge(f, %{"d" => fact, "e" => fact}) end)}

    same = choices(%{"a" => point.("a", "d"), "b" => point.("b", "d"), "c" => @plain})
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [facts, same])
    apart = choices(%{"a" => point.("a", "d"), "b" => point.("b", "e"), "c" => @plain})
    refusal(dir, [facts, apart], "story_point_two_outcomes")
  end

  # Breaks: any assign counts as the gate though a later step or another choice sets the fact back,
  # so the two outcomes can both fire; or the positive form a writer reaches for is refused.
  test "a shared gate holds only while nothing in the dialogue sets its fact back", %{dir: dir} do
    bool = %{"type" => "bool", "default" => false}
    fact = %{"version" => 1, "scopes" => ["player"], "meaning" => "x"}

    facts =
      {"facts.json",
       &Map.update!(&1, "facts", fn f ->
         Map.merge(f, %{
           "d" => Map.put(fact, "value_type", bool),
           "n" => Map.put(fact, "value_type", %{"type" => "int", "default" => 0})
         })
       end)}

    set = fn f, v -> %{"op" => "fact.assign", "fact" => f, "value" => v} end
    open = %{"op" => "fact_compare", "fact" => "d", "equals" => false}
    step = fn extra -> Map.merge(@plain, %{"steps" => extra}) end

    gated = fn o, policy, steps ->
      Map.merge(@plain, %{"story_point" => "met/" <> o, "policy" => policy, "steps" => steps})
    end

    a = gated.("a", open, [set.("d", true)])
    b = gated.("b", open, [set.("d", true)])

    built = fn cs ->
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [facts, choices(cs)])
    end

    refused = &refusal(dir, [facts, choices(&1)], "story_point_two_outcomes")

    built.(%{"a" => a, "b" => b, "c" => @plain})
    built.(%{"a" => a, "c" => @plain})
    refused.(%{"a" => a, "b" => b, "c" => step.([set.("d", false)])})

    refused.(%{
      "a" => gated.("a", open, [set.("d", false), set.("d", true)]),
      "b" => b,
      "c" => @plain
    })

    closed = %{
      "op" => "not",
      "item" => %{"op" => "fact_compare", "fact" => "d", "equals" => true}
    }

    last_false = gated.("a", closed, [set.("d", true), set.("d", false)])
    two = %{"a" => last_false, "b" => gated.("b", closed, [set.("d", true)]), "c" => @plain}
    refusal(dir, [facts, choices(two)], "story_point_repeats")

    # A step that leaves the positive gate open is no gate at all.
    still = gated.("a", open, [set.("d", false)])
    refusal(dir, [facts, choices(%{"a" => still, "c" => @plain})], "story_point_repeats")

    zero = %{"op" => "fact_compare", "fact" => "n", "equals" => 0}
    na = gated.("a", zero, [set.("n", 1)])
    nb = gated.("b", zero, [set.("n", 1)])
    built.(%{"a" => na, "b" => nb, "c" => @plain})
    bump = %{"op" => "fact.adjust", "fact" => "n", "amount" => 1}
    refused.(%{"a" => na, "b" => nb, "c" => step.([bump])})
  end

  # Breaks: the line lowers to the wrong field or to `once`, both lines on one choice pass, or the
  # line outside a choice is not refused.
  test "`once: sitting` lowers to sitting and refuses its neighbours" do
    dir = Loka.ContentSource.copy("cartridges/speech_sampler")
    File.mkdir_p!(Path.join(dir, "scenes"))
    file = Path.join(dir, "scenes/test_hub.scene")
    scene = &"npc: elder\n\nelder: words\n#{&1}"

    File.write!(file, scene.("- Stay\n  elder: words\n- Go\n  once: sitting\n  elder: words\n"))
    assert {:ok, bytes, _} = Loka.ContentSource.compile(dir, [])
    assert bytes =~ ~s("sitting":true)

    for bad <- [
          "- Stay\n  elder: words\n- Go\n  once: sitting\n  once\n",
          "- Stay\n  elder: words\n- Go\n  once\n  once: sitting\n",
          "once: sitting\n- Stay\n  elder: words\n"
        ] do
      File.write!(file, scene.(bad))
      assert {:error, diags} = Loka.ContentSource.compile(dir, [])
      assert Enum.any?(why(diags), &(&1 in ["bad_once", "once_outside_choice"])), inspect(diags)
    end

    # Linked rows carry no memory: the row a nested list opens never comes back on itself.
    nested =
      "- Stay\n  elder: words\n  - On\n    once: sitting\n    elder: words\n  - Off\n    elder: words\n"

    File.write!(file, scene.(nested <> "- Go\n  elder: words\n"))
    assert {:error, diags} = Loka.ContentSource.compile(dir, [])
    assert "sitting_no_return" in why(diags), inspect(diags)
  end
end
