defmodule Loka.ContentLintStoryTest do
  # Story-logic lint (docs/design/story-tooling.md rows L1 and L2). Each test plants the break, and
  # the valid form beside it, on a file map; the showcase baseline test keeps them silent on real
  # source. The rows are a separate module, so these run it directly.
  use ExUnit.Case, async: true

  alias Loka.Content.LintStory

  defp lint(files), do: LintStory.run(files)

  defp facts(type, extra \\ %{}) do
    vt = %{"value_type" => type, "meaning" => "m"}
    %{"facts.json" => %{"facts" => %{"f" => Map.merge(vt, extra)}}}
  end

  defp dialogue(choices), do: %{"choices" => choices}

  @gated %{"op" => "visited_count", "room" => "well", "at_least" => 1}

  test "a quest nothing resolves, and no deadline to fail it, is a finding" do
    quest = %{
      "objective" => %{
        "policy" => %{"op" => "fact_at_least", "fact" => "wanted", "at_least" => 1}
      }
    }

    resolve = %{"steps" => [%{"op" => "quest.resolve", "quest" => "errand", "outcome" => "done"}]}

    assert lint(%{"quests/errand.json" => quest}) == [
             "quests/errand.json: nothing resolves or fails this quest; add a quest.resolve step or a deadline"
           ]

    assert lint(%{"quests/errand.json" => quest, "reactions/done.json" => resolve}) == []

    # A dialogue's own `quest` resolves it, every choice with the choice id as the outcome
    # (dialogue/rule.ts:211), and a scene's `on_end.quest` resolves it too (scene/sequence.ts:103).
    talk = %{"quest" => "errand", "choices" => %{"done" => %{"label" => "l"}}}
    assert lint(%{"quests/errand.json" => quest, "dialogues/a.json" => talk}) == []

    ended = %{
      "on" => %{"action" => "dig"},
      "on_end" => %{"quest" => "errand", "outcome" => "done"}
    }

    assert lint(%{"quests/errand.json" => quest, "scenes/a.json" => ended}) == []

    # A walk that completes itself needs no resolver, and no deadline to fail it.
    walk = Map.put(quest, "objective", %{"evidence" => "patrol"})
    assert lint(%{"quests/errand.json" => walk}) == []

    # A deadline fails the quest by itself (quest_failed, step.schema.json).
    assert lint(%{"quests/errand.json" => Map.put(quest, "deadline", %{"after" => 60000})}) == []
  end

  test "a story point outcome nothing consumes is a finding" do
    scene = %{
      "on" => %{"story_point" => "letter_fate", "outcome" => "deliver"},
      "steps" => [%{"type" => "end"}]
    }

    talk = dialogue(%{"read" => %{"story_point" => "letter_fate/deliver"}})

    assert lint(%{"dialogues/talk.json" => talk}) == [
             "dialogues/talk.json: story point letter_fate outcome deliver; nothing consumes it"
           ]

    # A scene that starts on it consumes it.
    assert lint(%{"dialogues/talk.json" => talk, "scenes/deliver.json" => scene}) == []

    # Naming the point with no outcome consumes all of them (chapters, reactions).
    watch = %{"on" => %{"event" => "story_point_reached", "story_point" => "letter_fate"}}

    assert lint(%{"dialogues/talk.json" => talk, "reactions/w.json" => watch}) == []
  end

  test "a scene only its own chain claims can never start" do
    # a ends on p/a and starts on p/b; b ends on p/b and starts on p/a: the pair only starts itself.
    a = %{
      "on" => %{"story_point" => "p", "outcome" => "b"},
      "on_end" => %{"story_point" => "p", "outcome" => "a"},
      "steps" => [%{"type" => "end"}]
    }

    b = %{
      "on" => %{"story_point" => "p", "outcome" => "a"},
      "on_end" => %{"story_point" => "p", "outcome" => "b"},
      "steps" => [%{"type" => "end"}]
    }

    assert lint(%{"scenes/a.json" => a, "scenes/b.json" => b}) == [
             "scenes/a.json: on.story_point p/b is claimed only by scenes it starts",
             "scenes/b.json: on.story_point p/a is claimed only by scenes it starts"
           ]

    # A choice claims p/b, so the chain starts there and both scenes can run.
    talk = dialogue(%{"c" => %{"story_point" => "p/b"}})
    assert lint(%{"scenes/a.json" => a, "scenes/b.json" => b, "dialogues/t.json" => talk}) == []

    # A scene that starts on no story point also seeds the chain.
    free = %{"on_end" => %{"story_point" => "p", "outcome" => "a"}, "steps" => []}
    assert lint(%{"scenes/a.json" => a, "scenes/b.json" => b, "scenes/free.json" => free}) == []
  end

  test "a fact_changed reaction cycle with no when to break it is a finding" do
    a = %{
      "on" => %{"event" => "fact_changed", "fact" => "f"},
      "steps" => [%{"op" => "fact.adjust", "fact" => "g", "amount" => 1}]
    }

    b = %{
      "on" => %{"event" => "fact_changed", "fact" => "g"},
      "steps" => [%{"op" => "fact.adjust", "fact" => "f", "amount" => 1}]
    }

    assert lint(%{"reactions/a.json" => a, "reactions/b.json" => b}) == [
             "reactions/a.json: fact_changed cycle, no when to break it: a, b"
           ]

    # A when on either one breaks the cycle.
    assert lint(%{"reactions/a.json" => a, "reactions/b.json" => Map.put(b, "when", @gated)}) ==
             []

    # A one-way write is not a cycle.
    c = %{
      "on" => %{"event" => "fact_changed", "fact" => "f"},
      "steps" => [%{"op" => "fact.assign", "fact" => "h", "value" => true}]
    }

    assert lint(%{"reactions/a.json" => a, "reactions/c.json" => c}) == []
  end

  test "a compare value nothing writes can never hold" do
    enum = facts(%{"type" => "enum", "values" => ~w(a b c), "default" => "a"})
    bool = facts(%{"type" => "bool", "default" => false})

    compare = fn v -> %{"op" => "fact_compare", "fact" => "f", "equals" => v} end
    write = %{"op" => "fact.assign", "fact" => "f", "value" => "b"}

    assert lint(Map.put(enum, "actions/co.json", compare.("c"))) == [
             ~s(actions/co.json: fact_compare f tests "c"; nothing writes that value)
           ]

    # The default and a written value are both readable.
    assert lint(Map.put(enum, "actions/co.json", compare.("a"))) == []

    assert lint(Map.merge(enum, %{"actions/co.json" => compare.("b"), "actions/w.json" => write})) ==
             []

    # A writer the cartridge only opts into (world.theft's stolen fact) stays silent.
    theft = %{"cartridge.json" => %{"world" => %{"theft" => %{"stolen" => "f"}}}}

    assert lint(Map.merge(bool, Map.put(theft, "actions/co.json", compare.(true)))) == []

    # A service benefit and a spell's `learned` are writers too.
    service = %{"services/s.json" => %{"benefit" => %{"op" => "entitlement", "fact" => "f"}}}
    assert lint(Map.merge(bool, Map.put(service, "actions/co.json", compare.(true)))) == []

    spell = %{"actions/cast.json" => %{"learned" => "f"}}
    assert lint(Map.merge(bool, Map.put(spell, "actions/co.json", compare.(true)))) == []

    # Any other mention of the fact in source is not a writer, so the row still fires.
    prose = %{"rooms/r.json" => %{"description" => "f"}}

    assert lint(Map.merge(bool, Map.put(prose, "actions/co.json", compare.(true)))) == [
             "actions/co.json: fact_compare f tests true; nothing writes that value"
           ]
  end

  test "a threshold the one-shot writes cannot reach is a finding" do
    int = facts(%{"type" => "int", "default" => 0, "minimum" => 0, "maximum" => 10})

    adjust = fn a -> %{"op" => "fact.adjust", "fact" => "f", "amount" => a} end
    at_least = fn n -> %{"op" => "fact_at_least", "fact" => "f", "at_least" => n} end

    # Two quest resolves write 1 and 2 once each, so together they reach 3 and no further.
    writes = %{
      "reactions/a.json" => %{"on" => %{"event" => "quest_resolved"}, "steps" => [adjust.(1)]},
      "reactions/b.json" => %{"on" => %{"event" => "quest_resolved"}, "steps" => [adjust.(2)]}
    }

    assert lint(Map.merge(int, Map.put(writes, "actions/co.json", at_least.(5)))) == [
             "actions/co.json: fact_at_least f tests 5; its one-shot writes reach 3"
           ]

    assert lint(Map.merge(int, Map.put(writes, "actions/co.json", at_least.(3)))) == []

    # A repeating event can run its adjust any number of times, so it can reach anything.
    repeat = %{
      "reactions/a.json" => %{"on" => %{"event" => "entity_died"}, "steps" => [adjust.(1)]}
    }

    assert lint(Map.merge(int, Map.put(repeat, "actions/co.json", at_least.(5)))) == []

    # A quest resolves once per quest, so one adjust on it reaches 1.
    once = %{
      "reactions/a.json" => %{"on" => %{"event" => "quest_resolved"}, "steps" => [adjust.(1)]}
    }

    assert lint(Map.merge(int, Map.put(once, "actions/co.json", at_least.(5)))) == [
             "actions/co.json: fact_at_least f tests 5; its one-shot writes reach 1"
           ]

    # A repeatable quest resolves any number of times, so a reaction on its resolution
    # accumulates and reaches any threshold; without repeatable the same reaction runs once.
    quest = %{"quests/errand.json" => %{"repeatable" => true}}

    named = %{
      "reactions/a.json" => %{
        "on" => %{"event" => "quest_resolved", "quest" => "errand"},
        "steps" => [adjust.(1)]
      }
    }

    assert lint(Map.merge(Map.merge(int, quest), Map.put(named, "actions/co.json", at_least.(5)))) ==
             []

    plain = Map.merge(int, Map.put(named, "actions/co.json", at_least.(5)))

    assert lint(plain) == [
             "actions/co.json: fact_at_least f tests 5; its one-shot writes reach 1"
           ]
  end

  test "a shadowed ambient set is a finding" do
    line = %{"lines" => ["text.json a"]}
    gated = Map.put(line, "when", @gated)

    assert lint(%{"rooms/hall.json" => %{"ambient" => [line, gated]}}) == [
             "rooms/hall.json: ambient[1] is shadowed by ambient[0]"
           ]

    # A lone unconditioned set is the normal case.
    assert lint(%{"rooms/hall.json" => %{"ambient" => [line]}}) == []

    # A narrower guard after a wider one never shows.
    wide = %{"lines" => ["a"], "when" => %{"op" => "sky", "sky" => "rain"}}

    narrow = %{
      "lines" => ["b"],
      "when" => %{"op" => "all", "items" => [%{"op" => "sky", "sky" => "rain"}, @gated]}
    }

    assert lint(%{"rooms/hall.json" => %{"ambient" => [wide, narrow]}}) == [
             "rooms/hall.json: ambient[1] is shadowed by ambient[0]"
           ]

    # The reverse order is the one that shows: the wider guard last still fires.
    assert lint(%{"rooms/hall.json" => %{"ambient" => [narrow, wide]}}) == []
  end

  test "a talk where every choice is gated has no fallback" do
    gated = %{"policy" => @gated}
    open = %{"then" => "end"}

    assert lint(%{"dialogues/t.json" => dialogue(%{"a" => gated, "b" => gated})}) == [
             "dialogues/t.json: every choice is gated; add one with no policy and no availability"
           ]

    assert lint(%{"dialogues/t.json" => dialogue(%{"a" => gated, "b" => open})}) == []

    # A single-choice talk keeps its one gated choice.
    assert lint(%{"dialogues/t.json" => dialogue(%{"a" => gated})}) == []
  end

  test "a fact with no meaning is a nit" do
    bare = %{"facts.json" => %{"facts" => %{"f" => %{"value_type" => %{"type" => "bool"}}}}}

    assert lint(bare) == ["facts.json: facts.f has no meaning"]
    assert lint(facts(%{"type" => "bool"})) == []
  end
end
