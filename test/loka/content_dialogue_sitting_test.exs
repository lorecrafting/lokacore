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
          %{"a" => Map.put(@sitting, "story_point", "met/a"), "b" => @plain},
          %{"a" => Map.put(@sitting, "check", @check), "b" => @plain},
          %{"a" => @sitting, "b" => Map.put(@plain, "then", "guard")}
        ] do
      refusal(dir, [choices(bad)], "sitting_no_return")
    end

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
    point = Map.put(@plain, "story_point", "met/a")

    assert {:ok, bytes, _} =
             Loka.ContentSource.compile(dir, [choices(%{"a" => point, "b" => @plain})])

    assert bytes =~ "story_point/met"

    refusal(
      dir,
      [choices(%{"a" => Map.put(point, "then", "guard"), "b" => @plain})],
      "story_point_then"
    )

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
  end
end
