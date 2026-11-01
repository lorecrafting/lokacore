defmodule Loka.ContentDialogueLinksTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/persuade_sampler")}

  @guard "dialogues/guard.json"
  @at "dialogues/guard.choices.persuade."
  @label "dialogue.guard.persuade"
  @said "narration.guard.persuade"

  defp persuade(f), do: &update_in(&1, ["choices", "persuade"], f)
  defp field(k, v), do: persuade(&Map.put(&1, k, v))

  defp talk(npc, extra \\ %{}) do
    Map.merge(
      %{
        "npc" => npc,
        "prompt" => "dialogue.guard.prompt",
        "roles" => %{npc => %{"role" => "npc", "npc" => npc}},
        "choices" => %{"x" => %{"label" => @label, "narration" => @said}}
      },
      extra
    )
  end

  defp second_npc do
    "cartridges/persuade_sampler/npcs/guard.json"
    |> File.read!()
    |> Jason.decode!()
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  defp refused(dir, changes, want) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    assert want in codes(diags), inspect({want, diags})
  end

  # Breaks: a root, hand-off, return chain refused though it plays; its speaker's missing entry
  # not warned; or that warning reaching a speaker with an entry of their own.
  test "a then loop compiles and warns of a speaker Talk only reaches through it", %{dir: dir} do
    to = fn key -> %{"x" => %{"label" => @label, "narration" => @said, "then" => key}} end
    captain = {"dialogues/a_captain.json", talk("guard", %{"choices" => to.("z_loop")})}
    other = Map.put(talk("guard", %{"choices" => to.("a_captain")}), "npc", "second")
    other = Map.put(other, "roles", %{"second" => %{"role" => "npc", "npc" => "second"}})
    loop = {"dialogues/z_loop.json", other}
    npc = {"npcs/second.json", second_npc()}
    warning = {"warning", "LOOP_SPEAKER", "dialogues/z_loop.npc"}
    seen = &Enum.map(&1, fn d -> {d["severity"], d["code"], d["path"]} end)
    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [captain, loop, npc])
    assert warning in seen.(warnings), inspect(warnings)

    own = Map.put(talk("guard"), "npc", "second")

    own =
      {"dialogues/b_second.json",
       Map.put(own, "roles", %{"second" => %{"role" => "npc", "npc" => "second"}})}

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [captain, loop, npc, own])
    refute warning in seen.(warnings), inspect(warnings)
  end

  # Breaks: the compiler enters a loop at its first key by sort while Talk enters at the hub, so
  # the speaker of a leaf sorted first counts as reachable and its warning is lost.
  test "the loop warning enters a loop at the hub Talk opens", %{dir: dir} do
    to = fn keys ->
      Map.new(keys, &{"to_" <> &1, %{"label" => @label, "narration" => @said, "then" => &1}})
    end

    roles = %{"second" => %{"role" => "npc", "npc" => "second"}}
    leaf = talk("guard", %{"choices" => to.(["z_detail"]), "npc" => "second", "roles" => roles})

    files = [
      {"dialogues/a_leaf.json", leaf},
      {"dialogues/m_hub.json", talk("guard", %{"choices" => to.(["a_leaf", "z_detail"])})},
      {"dialogues/z_detail.json", talk("guard", %{"choices" => to.(["m_hub"])})},
      {"npcs/second.json", second_npc()}
    ]

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, files)

    assert for(%{"code" => "LOOP_SPEAKER", "path" => p} <- warnings, do: p) == [
             "dialogues/a_leaf.npc"
           ]
  end

  # Breaks: a wider loop downstream of the entry counts as a second entry (its speaker's warning is
  # lost), or a loop with no link to another loses to it (a false warning on its speaker).
  test "the loop warning reads each loop with no way in once", %{dir: dir} do
    to = fn keys ->
      Map.new(keys, &{"to_" <> &1, %{"label" => @label, "narration" => @said, "then" => &1}})
    end

    second = fn keys ->
      roles = %{"second" => %{"role" => "npc", "npc" => "second"}}
      talk("guard", %{"choices" => to.(keys), "npc" => "second", "roles" => roles})
    end

    guard = &talk("guard", %{"choices" => to.(&1)})
    npc = {"npcs/second.json", second_npc()}
    file = &"dialogues/#{&1}.json"

    downstream = [
      {file.("g_a"), guard.(["g_b", "s_c"])},
      {file.("g_b"), guard.(["g_a"])},
      {file.("s_c"), second.(["s_d", "s_e", "s_f"])},
      {file.("s_d"), second.(["s_c"])},
      {file.("s_e"), second.(["end"])},
      {file.("s_f"), second.(["end"])},
      npc
    ]

    assert {:ok, _, warned} = Loka.ContentSource.compile(dir, downstream)

    assert Enum.sort(for(%{"code" => "LOOP_SPEAKER", "path" => p} <- warned, do: p)) ==
             ["dialogues/s_c.npc", "dialogues/s_d.npc"]

    apart = [
      {file.("g_a"), guard.(["g_b", "g_c"])},
      {file.("g_b"), guard.(["g_a"])},
      {file.("g_c"), guard.(["end"])},
      {file.("s_x"), second.(["s_y"])},
      {file.("s_y"), second.(["s_x"])},
      npc
    ]

    assert {:ok, _, warned} = Loka.ContentSource.compile(dir, apart)
    assert for(%{"code" => "LOOP_SPEAKER"} = w <- warned, do: w) == []

    # Breaks: a link to itself lifts a detail level with its hub, so the detail is entered.
    repeat = [
      {file.("a_x"), second.(["a_x", "g_hub"])},
      {file.("g_hub"), guard.(["a_x", "z_y"])},
      {file.("z_y"), guard.(["end"])},
      npc
    ]

    assert {:ok, _, warned} = Loka.ContentSource.compile(dir, repeat)
    assert for(%{"code" => "LOOP_SPEAKER", "path" => p} <- warned, do: p) == ["dialogues/a_x.npc"]
  end

  # Breaks: a link rule dropped, so a then the runtime cannot follow compiles and fails at play.
  test "then and then_failed refuse what cannot be followed", %{dir: dir} do
    child = {"dialogues/child.json", talk("guard")}
    worded = {"dialogues/child.json", talk("guard", %{"keyword" => "gate"})}
    clash = {"dialogues/end.json", talk("guard")}
    quest = &Map.put(&1, "quest", "any")

    refused(dir, [{@guard, field("then", "nobody")}], {"UNRESOLVED_REFERENCE", @at <> "then"})
    refused(dir, [worded, {@guard, field("then", "child")}], {"OUTCOME_MISMATCH", @at <> "then"})
    refused(dir, [clash, {@guard, field("then", "end")}], {"OUTCOME_MISMATCH", @at <> "then"})

    refused(
      dir,
      [{@guard, field("then_failed", "nobody")}],
      {"UNRESOLVED_REFERENCE", @at <> "then_failed"}
    )

    refused(
      dir,
      [
        child,
        {@guard, persuade(&(&1 |> Map.delete("check") |> Map.put("then_failed", "child")))}
      ],
      {"OUTCOME_MISMATCH", @at <> "then_failed"}
    )

    # A row opened by an answer has no quest instance and no riddle talk evidence on reload.
    for extra <- [
          %{"quest" => "any"},
          %{
            "riddle" => %{
              "choice_id" => "x",
              "answer" => "x",
              "bank" => ["X"],
              "wrong" => "narration.guard.persuade_failed"
            }
          }
        ] do
      target = {"dialogues/child.json", talk("guard", extra)}

      assert {:error, diags} =
               Loka.ContentSource.compile(dir, [target, {@guard, field("then", "child")}])

      assert {"OUTCOME_MISMATCH", @at <> "then"} in codes(diags), inspect(extra)
    end

    refused(
      dir,
      [child, {@guard, &(&1 |> field("then", "child").() |> quest.())}],
      {"OUTCOME_MISMATCH", @at <> "then"}
    )

    # An answer on a riddle or starting a patrol has its own continuation.
    riddled = %{
      "choice_id" => "persuade",
      "answer" => "x",
      "bank" => ["X"],
      "wrong" => "narration.guard.persuade_failed"
    }

    refused(
      dir,
      [child, {@guard, &(&1 |> field("then", "child").() |> Map.put("riddle", riddled))}],
      {"OUTCOME_MISMATCH", @at <> "then"}
    )

    patrol = %{"npc" => "guard", "quest" => "any", "transition" => "start"}

    refused(
      dir,
      [child, {@guard, &(&1 |> field("then", "child").() |> field("patrol", patrol).())}],
      {"OUTCOME_MISMATCH", @at <> "then"}
    )
  end

  # Breaks: a link that is allowed refused, the old same-speaker refusal back among them.
  test "then: end and a pass and fail branch compile", %{dir: dir} do
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [{@guard, field("then", "end")}])

    assert {:ok, _, []} =
             Loka.ContentSource.compile(dir, [
               {"dialogues/child.json", talk("guard")},
               {@guard, persuade(&Map.merge(&1, %{"then" => "child", "then_failed" => "child"}))}
             ])
  end

  # Breaks: the warning fails the build, fires for a speaker in the same room, or a hand-off
  # to another speaker is refused outright as before.
  test "a hand-off to a speaker in another room warns and compiles", %{dir: dir} do
    npc = fn room ->
      {"npcs/captain.json",
       %{
         "keywords" => ["captain"],
         "name" => "npc.guard.short",
         "room_line" => "npc.guard.room",
         "description" => "npc.guard.description",
         "room" => room
       }}
    end

    far =
      {"rooms/far.json",
       %{
         "name" => "room.gate_room.title",
         "description" => "room.gate_room.description",
         "exits" => %{}
       }}

    then = [
      {"dialogues/captain.json", talk("captain")},
      {@guard, field("then", "captain")}
    ]

    warning = {"warning", "SPEAKER_ELSEWHERE", @at <> "then"}
    seen = &Enum.map(&1, fn d -> {d["severity"], d["code"], d["path"]} end)

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [far, npc.("far") | then])
    assert warning in seen.(warnings), inspect(warnings)
    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [npc.("gate_room") | then])
    refute warning in seen.(warnings), inspect(warnings)
  end

  # Breaks: a choice's condition, reply words or narrate step left out of the reference walk, so a
  # bad reference compiles and fails only when played.
  test "a choice's policy, variants and narrate step are checked", %{dir: dir} do
    variant = fn w, d -> [%{"when" => w, "description" => d}] end
    held = %{"op" => "fact_compare", "fact" => "gate_open", "equals" => true}
    unlocked = %{"op" => "quest_state", "quest" => "any", "state" => "active"}

    refused(
      dir,
      [{@guard, field("policy", %{held | "fact" => "nothing"})}],
      {"UNRESOLVED_REFERENCE", @at <> "policy.fact"}
    )

    refused(
      dir,
      [{@guard, field("policy", unlocked)}],
      {"UNDECLARED_CAPABILITY", @at <> "policy.op"}
    )

    refused(
      dir,
      [{@guard, field("narration_variants", variant.(held, "missing"))}],
      {"UNRESOLVED_REFERENCE", @at <> "narration_variants[0].description"}
    )

    refused(
      dir,
      [{@guard, field("narration_variants", variant.(%{held | "fact" => "nothing"}, @said))}],
      {"UNRESOLVED_REFERENCE", @at <> "narration_variants[0].when.fact"}
    )

    refused(
      dir,
      [{@guard, field("steps", [%{"op" => "narrate", "text" => "missing"}])}],
      {"UNRESOLVED_REFERENCE", @at <> "steps[0].text"}
    )
  end

  # Breaks: at_least accepted on a non-int fact, which never holds at play.
  test "at_least needs an int fact", %{dir: dir} do
    policy = %{"op" => "fact_at_least", "fact" => "gate_open", "at_least" => 1}

    refused(
      dir,
      [{@guard, field("policy", policy)}],
      {"FACT_TYPE_MISMATCH", @at <> "policy.at_least"}
    )
  end

  defp d(key, npc, links \\ [], extra \\ %{}) do
    choices = Map.new(links, &{"to_" <> &1, %{"then" => &1}})

    {"dialogues/#{key}.json",
     Map.merge(%{"key" => key, "npc" => npc, "choices" => choices}, extra)}
  end

  defp entry_findings(all) do
    for x <- Loka.Content.DialogueLinks.entry_checks(all),
        do: {x["severity"], x["code"], x["path"], x["data"]["target"]}
  end

  defp guess(key), do: {"warning", "ENTRY_GUESSED", "dialogues/#{key}.npc", key}

  # Breaks: a one-way leaf warned; a loop's pick or a condition-free first key not warned, or the
  # wrong node named; a labelled Talk control or a keyword dialogue counted as tied, every shadowed key warned, a named first key not warned, or a lone self-link warned.
  test "ENTRY_GUESSED names Talk's pick only when it is a guess" do
    p = %{"policy" => %{"op" => "x"}}
    assert entry_findings([d("leaf", "a", ["next"]), d("next", "a")]) == []

    assert entry_findings([d("a_x", "a", ["hub"]), d("hub", "a", ["a_x"]), d("l", "a", ["hub"])]) ==
             []

    assert entry_findings([d("a_x", "a", ["b"]), d("b", "a", ["a_x"])]) == [guess("a_x")]
    assert entry_findings([d("a_x", "a"), d("b", "a")]) == [guess("a_x")]
    assert entry_findings([d("a_x", "a", [], p), d("b", "a")]) == []
    assert entry_findings([d("a_x", "a"), d("b", "a", [], %{"name" => "n"})]) == []
    assert entry_findings([d("a_x", "a"), d("b", "a", [], %{"keyword" => "w"})]) == []
    assert entry_findings([d("a_x", "a"), d("b", "a"), d("c", "a")]) == [guess("a_x")]
    assert entry_findings([d("a_x", "a", [], %{"name" => "n"}), d("b", "a")]) == [guess("a_x")]
    assert entry_findings([d("a_x", "a", ["a_x"])]) == []
  end

  # Breaks: the marker still warned as a guess, a second marker or a keyword marker compiled, a
  # shut-out dialogue not named, another speaker's marker shutting this speaker's out, or a keyword dialogue called shut out.
  test "the entry marker settles the guess and refuses what Talk could not open" do
    m = %{"entry" => true}
    invalid = &{"error", "ENTRY_INVALID", "dialogues/#{&1}.entry", nil}
    assert entry_findings([d("a_x", "a", ["b"]), d("b", "a", ["a_x"], m)]) == []

    assert entry_findings([d("a_x", "a", [], m), d("b", "a", [], m)]) == [
             invalid.("a_x"),
             invalid.("b")
           ]

    assert entry_findings([d("a_x", "a", [], Map.put(m, "keyword", "w"))]) == [invalid.("a_x")]

    assert entry_findings([d("a_x", "a"), d("b", "a", [], m)]) ==
             [{"warning", "ENTRY_UNUSED", "dialogues/a_x.npc", "a_x"}]

    assert entry_findings([d("a_x", "z"), d("b", "a", [], m)]) == []
    assert entry_findings([d("a_x", "a", [], %{"keyword" => "w"}), d("b", "a", [], m)]) == []
    unused = &{"warning", "ENTRY_UNUSED", "dialogues/#{&1}.npc", &1}

    # the shut-out dialogue is no way in: another speaker's chain or loop past it still opens
    assert entry_findings([d("a_x", "a", [], m), d("b", "a", ["c"]), d("c", "z")]) == [
             unused.("b")
           ]

    assert entry_findings([d("a_x", "a", [], m), d("b", "a", ["c"]), d("c", "z", ["b"])]) ==
             []

    # a shut-out loop warns for every member, not only the head
    assert entry_findings([d("a_x", "a", [], m), d("b", "a", ["c"]), d("c", "a", ["b"])]) ==
             [unused.("b"), unused.("c")]
  end

  # Breaks: the marker stops making its dialogue an entry when another speaker's root leads to it,
  # so its own loop reads as unreachable and draws a false LOOP_SPEAKER.
  test "another speaker's root leading to a marked hub draws no LOOP_SPEAKER" do
    all = [
      d("z_intro", "z", ["a_hub"]),
      d("a_hub", "a", ["a_x"], %{"entry" => true}),
      d("a_x", "a", ["a_hub"])
    ]

    assert Loka.Content.DialogueLinks.loops(all) == []
  end

  # Breaks: a clear hub warned as a guess, or a tie for most links in a loop not warned.
  test "a loop warns only when its members tie for most links" do
    hub = [d("a_x", "a", ["main"]), d("main", "a", ["a_x", "z_y"]), d("z_y", "a", ["main"])]
    assert entry_findings(hub) == []

    assert entry_findings([
             d("a_x", "a", ["b", "c"]),
             d("b", "a", ["a_x", "c"]),
             d("c", "a", ["a_x"])
           ]) ==
             [guess("a_x")]
  end

  # Breaks: the compiler drops the marker, or a marked dialogue fails the schema, so Talk never sees it.
  test "entry: true compiles through to the artifact", %{dir: dir} do
    assert {:ok, artifact, []} =
             Loka.ContentSource.compile(dir, [{@guard, &Map.put(&1, "entry", true)}])

    assert artifact =~ ~s("entry":true)
  end

  # Breaks: a keyword dialogue counts as Talk's way to its speaker, hiding the warning (Talk never
  # opens one, selection.ts talks).
  test "a keyword dialogue does not stop the loop speaker warning" do
    loop = [d("a_x", "a", ["b"]), d("b", "z", ["a_x"]), d("k", "z", [], %{"keyword" => "w"})]

    assert [%{"code" => "LOOP_SPEAKER", "path" => "dialogues/b.npc"}] =
             Loka.Content.DialogueLinks.loops(loop)
  end
end
