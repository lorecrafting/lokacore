defmodule Loka.ContentFerryTest do
  # The calendar start and an NPC's daily schedule in the compiler (Early R7/R8 S;
  # cartridge.schema.json Calendar, entity.schema.json NpcDefinition daily_schedule). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode, with the
  # loader's paths in kernel/ts/test/schedule.test.ts; the known answer is
  # protocol/fixtures/cartridge_ferry_hash.json (Python).
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ferry_sampler")}
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_ferry_hash.json"))
  @src "cartridges/ferry_sampler"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp ref(key),
    do: %{
      "cartridge_id" => "ferry_sampler",
      "cartridge_version" => "0.0.1",
      "kind" => "room",
      "key" => key
    }

  defp d(code, path, data, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp schedule(s), do: %{"npcs/bram.json" => Map.put(src("npcs/bram.json"), "daily_schedule", s)}

  # Breaks: the calendar or a daily schedule dropped, misplaced or reshaped in the artifact.
  test "ferry_sampler compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a schedule's short room left short (Resolve.expand; the loader would reject it).
  test "full schedule rooms compile to the same artifact", %{dir: dir} do
    full = %{"6" => ref("ferry_landing"), "19" => ref("village_green")}
    assert compile(dir, schedule(full)) == {:ok, @expected, []}
  end

  # coil_rope with its Bram participant replaced by `p`.
  defp bram(p) do
    r = src("actions/coil_rope.json")
    %{"actions/coil_rope.json" => put_in(r, ~w(outcomes success narration participants bram), p)}
  end

  @bram "actions/coil_rope.outcomes.success.narration.participants.bram"

  # Breaks: a participant's short npc left short (Resolve.expand; the loader would reject it).
  test "a full participant reference compiles to the same artifact", %{dir: dir} do
    full = %{"role" => "npc", "npc" => Map.put(ref("bram"), "kind", "npc")}
    assert compile(dir, bram(full)) == {:ok, @expected, []}
  end

  # Breaks: a participant naming no npc or item of its role compiling (the kernel would pin an
  # undefined EntityId).
  test "a participant naming no definition of its role is UNRESOLVED_REFERENCE", %{dir: dir} do
    unresolved = &{:error, [d("UNRESOLVED_REFERENCE", @bram <> &1, %{"target" => &2})]}

    assert compile(dir, bram(%{"role" => "npc", "npc" => "ada"})) ==
             unresolved.(".npc", "ferry_sampler@0.0.1:npc/ada")

    assert compile(dir, bram(%{"role" => "npc", "npc" => ref("ferry_landing")})) ==
             unresolved.(".npc", "ferry_sampler@0.0.1:room/ferry_landing")

    assert compile(dir, bram(%{"role" => "item", "item" => "bram"})) ==
             unresolved.(".item", "ferry_sampler@0.0.1:item/bram")
  end

  # Breaks: a schedule naming a room the cartridge lacks compiling (run_job would crash).
  test "a schedule's unknown room is UNRESOLVED_REFERENCE", %{dir: dir} do
    assert compile(dir, schedule(%{"6" => "ferry_landing", "19" => "shed"})) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "npcs/bram.daily_schedule.19", %{
                  "target" => "ferry_sampler@0.0.1:room/shed"
                })
              ]}
  end

  # Breaks: a daily schedule compiling without schedule@1, or a calendar without calendar@1, in
  # the manifest (capability_registry.json definitions).
  test "a schedule needs schedule@1 and a calendar calendar@1", %{dir: dir} do
    m = src("cartridge.json")
    without = &update_in(m, ["requires", "capabilities"], fn c -> Map.delete(c, &1) end)

    assert compile(dir, %{"cartridge.json" => without.("schedule")}) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "npcs/bram.daily_schedule",
                  %{"capability" => "schedule"},
                  ["schedule@1"]
                )
              ]}

    assert compile(dir, %{"cartridge.json" => without.("calendar")}) ==
             {:error,
              [
                d("UNDECLARED_CAPABILITY", "cartridge.calendar", %{"capability" => "calendar"}, [
                  "calendar@1"
                ])
              ]}
  end

  # Breaks: an invalid schedule key or a calendar without start compiling.
  test "schedule hours and the calendar are schema-checked", %{dir: dir} do
    assert compile(dir, schedule(%{"06" => "ferry_landing"})) ==
             {:error,
              [
                d("SCHEMA_VIOLATION", "npcs/bram.daily_schedule.06", %{
                  "error" => "pattern_mismatch"
                })
              ]}

    m = Map.put(src("cartridge.json"), "calendar", %{})

    assert compile(dir, %{"cartridge.json" => m}) ==
             {:error,
              [
                d("SCHEMA_VIOLATION", "cartridge.calendar.start", %{
                  "error" => "missing_property"
                })
              ]}
  end

  # Breaks: an action built on run_job compiling (authority-internal, 04 §1: a dead action).
  test "an action's command is never run_job", %{dir: dir} do
    action = %{
      "name" => "actions.coil_rope",
      "accessibility" => "actions.coil_rope",
      "target" => %{"kind" => "none"},
      "command" => "run_job",
      "priority" => 0,
      "input" => [],
      "policy" => %{"op" => "all", "items" => []}
    }

    assert compile(dir, %{"actions/hurry.json" => action}) ==
             {:error, [d("UNKNOWN_COMMAND", "actions/hurry.command", %{})]}
  end

  # A source file's choices without their story_point declarations.
  defp unclaimed(%{"choices" => cs} = d),
    do: %{d | "choices" => Map.new(cs, fn {c, o} -> {c, Map.delete(o, "story_point")} end)}

  defp unclaimed(v), do: v

  # Bram's dialogue source with `f` applied, under `rel` (dialogues/bram.json by default).
  defp dialogue(f, rel \\ "dialogues/bram.json"),
    do: %{rel => f.(src("dialogues/bram.json"))}

  # Breaks: a room contribution naming a dialogue's talk unresolved (its key is an ActionSet
  # identity; kernel/ts/test/dialogue.test.ts loads the same).
  test "a room contribution may name a dialogue's talk", %{dir: dir} do
    room = src("rooms/ferry_landing.json")

    files = %{
      "rooms/ferry_landing.json" =>
        Map.put(room, "actions", [%{"op" => "subtract", "actions" => ["bram"]}])
    }

    assert {:ok, _, []} = compile(dir, files)
  end

  # Breaks: a dialogue's short speaker, quest, role or fact left short (Resolve.expand; the loader
  # would reject the artifact).
  test "a full-reference dialogue compiles to the same artifact", %{dir: dir} do
    full = fn kind, key -> Map.merge(ref(key), %{"kind" => kind}) end

    files =
      dialogue(fn d ->
        d
        |> Map.merge(%{"npc" => full.("npc", "bram"), "quest" => full.("quest", "lantern")})
        |> put_in(~w(roles bram npc), full.("npc", "bram"))
        |> put_in(~w(roles lantern item), full.("item", "lantern"))
        |> update_in(~w(choices carry steps), fn [s] ->
          [%{s | "fact" => full.("fact", "search_plan")}]
        end)
      end)

    assert compile(dir, files) == {:ok, @expected, []}
  end

  # Breaks: the compiler admitting what the loader rejects (kernel/ts/test/dialogue.test.ts): an
  # unresolved speaker, role, quest or policy quest; a speaker that is no npc role; a hand_over
  # through a role of the wrong kind; a missing text; an undeclared fact or a wrong value; a role
  # named actor; no choice; a talk key another action's; dialogue@1 not required.
  test "the compiler checks dialogue references, roles, texts, facts, keys and the lock", %{
    dir: dir
  } do
    at = "dialogues/bram"
    unresolved = &d("UNRESOLVED_REFERENCE", at <> &1, %{"target" => &2})
    missing = &"ferry_sampler@0.0.1:#{&1}/missing"
    m = src("cartridge.json")

    cases = [
      {dialogue(&Map.put(&1, "npc", "missing")), unresolved.(".npc", missing.("npc"))},
      {dialogue(&put_in(&1, ~w(roles lantern item), "missing")),
       unresolved.(".roles.lantern.item", missing.("item"))},
      {dialogue(&Map.put(&1, "quest", "missing")), unresolved.(".quest", missing.("quest"))},
      {dialogue(&put_in(&1, ~w(policy quest), "missing")),
       unresolved.(".policy.quest", missing.("quest"))},
      {dialogue(fn d ->
         d
         |> put_in(~w(roles bram), %{"role" => "item", "item" => "lantern"})
         |> update_in(~w(choices leave), &Map.delete(&1, "hand_over"))
       end), unresolved.(".npc", "ferry_sampler@0.0.1:npc/bram")},
      {dialogue(&put_in(&1, ~w(choices leave hand_over item), "bram")),
       unresolved.(".choices.leave.hand_over.item", "bram")},
      {dialogue(&put_in(&1, ~w(choices leave hand_over to), "lantern")),
       unresolved.(".choices.leave.hand_over.to", "lantern")},
      {dialogue(&Map.put(&1, "prompt", "dialogue.none")),
       unresolved.(".prompt", "dialogue.none")},
      {dialogue(&put_in(&1, ~w(choices carry narration), "dialogue.none")),
       unresolved.(".choices.carry.narration", "dialogue.none")},
      {dialogue(
         &update_in(&1, ~w(choices carry steps), fn [s] -> [%{s | "fact" => "missing"}] end)
       ), unresolved.(".choices.carry.steps[0].fact", missing.("fact"))},
      {dialogue(
         &update_in(&1, ~w(choices carry steps), fn [s] -> [%{s | "value" => "lost"}] end)
       ), d("FACT_TYPE_MISMATCH", at <> ".choices.carry.steps[0].value", %{})},
      {dialogue(&put_in(&1, ~w(roles actor), %{"role" => "npc", "npc" => "bram"})),
       d("DUPLICATE_DEFINITION", at <> ".roles.actor", %{})},
      {dialogue(&put_in(&1, ~w(roles speaker), %{"role" => "npc", "npc" => "bram"})),
       d("DUPLICATE_DEFINITION", at <> ".roles.speaker", %{})},
      {dialogue(&Map.put(&1, "choices", %{})),
       d("SCHEMA_VIOLATION", at <> ".choices", %{"error" => "too_few_items"})},
      {Map.merge(dialogue(& &1, "dialogues/lantern.json"), %{"dialogues/bram.json" => nil}),
       d("DUPLICATE_DEFINITION", "dialogues/lantern", %{})},
      {%{
         "cartridge.json" => update_in(m, ~w(requires capabilities), &Map.delete(&1, "dialogue"))
       }, d("UNDECLARED_CAPABILITY", at, %{"capability" => "dialogue"}, ["dialogue@1"])}
    ]

    # Story points, declared on bram's choices, have their own test below.
    for {files, diag} <- cases do
      files = Map.new(Map.merge(dialogue(& &1), files), fn {r, d} -> {r, unclaimed(d)} end)
      assert compile(dir, files) == {:error, [diag]}, inspect(diag)
    end
  end

  # Breaks (twin of kernel/ts/test/quest_dialogue.test.ts): one dialogue per speaker still
  # enforced; the compiler admitting an accept of no quest, an accept in a dialogue that resolves
  # a quest, or an accept with a hand_over; a short accept left unexpanded.
  test "a second dialogue of Bram's may accept the quest, checked", %{dir: dir} do
    at = "dialogues/bram_offer.choices.accept"
    choice = %{"label" => "quest.lantern.accept", "narration" => "narration.bram.carry"}

    offer = fn f ->
      %{
        "dialogues/bram_offer.json" =>
          f.(%{
            "npc" => "bram",
            "policy" => %{"op" => "all", "items" => []},
            "prompt" => "dialogue.bram.prompt",
            "roles" => %{"bram" => %{"role" => "npc", "npc" => "bram"}},
            "choices" => %{"accept" => Map.put(choice, "accept", "lantern")}
          })
      }
    end

    assert {:ok, _, []} = compile(dir, offer.(& &1))

    cases = [
      {&put_in(&1, ~w(choices accept accept), "missing"),
       d("UNRESOLVED_REFERENCE", at <> ".accept", %{
         "target" => "ferry_sampler@0.0.1:quest/missing"
       })},
      {&Map.put(&1, "quest", "lantern"), d("OUTCOME_MISMATCH", at <> ".accept", %{})},
      {fn o ->
         o
         |> put_in(~w(roles lantern), %{"role" => "item", "item" => "lantern"})
         |> put_in(~w(choices accept hand_over), %{"item" => "lantern", "to" => "bram"})
       end, d("OUTCOME_MISMATCH", at <> ".hand_over", %{})}
    ]

    for {f, diag} <- cases do
      assert compile(dir, offer.(f)) == {:error, [diag]}, inspect(diag)
    end
  end

  # Breaks (loka-x6t.5, twin of kernel/ts/test/quest_dialogue.test.ts): the compiler admitting, in
  # a dialogue that reopens after each answer (no quest, two choices), an answer without the
  # once-only accept that receives an item, which a player could give back and receive again.
  test "a reopening dialogue rejects a repeatable receive", %{dir: dir} do
    give = %{
      "label" => "dialogue.bram.leave",
      "narration" => "narration.bram.leave",
      "receive" => %{"item" => "lantern", "from" => "bram"}
    }

    files = %{
      "dialogues/bram_offer.json" => %{
        "npc" => "bram",
        "policy" => %{"op" => "all", "items" => []},
        "prompt" => "dialogue.bram.prompt",
        "roles" => %{
          "bram" => %{"role" => "npc", "npc" => "bram"},
          "lantern" => %{"role" => "item", "item" => "lantern"}
        },
        "choices" => %{
          "accept" => %{
            "label" => "quest.lantern.accept",
            "narration" => "narration.bram.carry",
            "accept" => "lantern"
          },
          "give" => give
        }
      }
    }

    assert {:error, diags} = compile(dir, files)
    assert d("OUTCOME_MISMATCH", "dialogues/bram_offer.choices.give.receive", %{}) in diags
  end

  # Breaks (loka-vduxr.10): a linked single-choice dialogue escaping the rule above, since it runs
  # again through its then; or the once gate (policy not fact, steps set it) refused all the same.
  test "a linked receive repeats unless its own policy stops it", %{dir: dir} do
    give = %{
      "label" => "dialogue.bram.leave",
      "narration" => "narration.bram.leave",
      "then" => "bram_offer",
      "receive" => %{"item" => "lantern", "from" => "bram"}
    }

    assign = %{"op" => "fact.assign", "fact" => "lantern_lit", "value" => true}
    held = %{"op" => "fact_compare", "fact" => "lantern_lit", "equals" => true}
    once = %{"policy" => %{"op" => "not", "item" => held}, "steps" => [assign]}

    offer = fn choice ->
      %{
        "dialogues/bram_offer.json" => %{
          "npc" => "bram",
          "policy" => %{"op" => "all", "items" => []},
          "prompt" => "dialogue.bram.prompt",
          "roles" => %{
            "bram" => %{"role" => "npc", "npc" => "bram"},
            "lantern" => %{"role" => "item", "item" => "lantern"}
          },
          "choices" => %{"give" => choice}
        }
      }
    end

    path = "dialogues/bram_offer.choices.give.receive"
    assert {:error, diags} = compile(dir, offer.(give))
    assert d("OUTCOME_MISMATCH", path, %{}) in diags

    other = fn choices ->
      %{
        "npc" => "bram",
        "policy" => %{"op" => "all", "items" => []},
        "prompt" => "dialogue.bram.prompt",
        "roles" => %{"bram" => %{"role" => "npc", "npc" => "bram"}},
        "choices" => choices
      }
    end

    plain = Map.take(give, ~w(label narration))

    # A one-option target of another answer runs again through that answer.
    lead = other.(%{"go" => Map.put(plain, "then", "bram_offer")})
    linked = Map.put(offer.(Map.delete(give, "then")), "dialogues/bram_lead.json", lead)
    assert {:error, reached} = compile(dir, linked)
    assert d("OUTCOME_MISMATCH", path, %{}) in reached
    # An answer that leads on keeps the talk going, so its own dialogue counts as linked.
    onward = offer.(Map.put(give, "then", "bram_far"))
    far = Map.put(onward, "dialogues/bram_far.json", other.(%{"bye" => plain}))
    assert {:error, led} = compile(dir, far)
    assert d("OUTCOME_MISMATCH", path, %{}) in led
    # lantern_lit is not a fact here, so it fails on that alone, never on the repeat rule.
    assert {:error, gated} = compile(dir, offer.(Map.merge(give, once)))
    refute d("OUTCOME_MISMATCH", path, %{}) in gated, inspect(gated)
  end

  # Breaks (23 §3: the compiler validates its triggers and capability dependencies): the compiler
  # admitting what the loader rejects (kernel/ts/test/dialogue.test.ts): two choices claiming one
  # outcome, a claim without its outcome, a dialogue without a quest (its choice repeatable),
  # dialogue@1 not required.
  test "the compiler checks story point claims, outcomes and the lock", %{dir: dir} do
    at = &"dialogues/bram.choices.#{&1}.story_point"
    claim = &dialogue(fn d -> put_in(d, ~w(choices leave story_point), &1) end)
    m = src("cartridge.json")

    cases = [
      {claim.("lantern_resolved/carry"), [d("DUPLICATE_DEFINITION", at.("leave"), %{})]},
      {claim.("lantern_resolved"),
       [d("SCHEMA_VIOLATION", at.("leave"), %{"error" => "pattern_mismatch"})]},
      {dialogue(&Map.delete(&1, "quest")),
       for(o <- ~w(carry leave), do: d("OUTCOME_MISMATCH", at.(o), %{}))},
      {%{
         "cartridge.json" => update_in(m, ~w(requires capabilities), &Map.delete(&1, "dialogue"))
       },
       for(
         p <- ["dialogues/bram", at.("carry")],
         do: d("UNDECLARED_CAPABILITY", p, %{"capability" => "dialogue"}, ["dialogue@1"])
       )}
    ]

    for {files, diags} <- cases do
      assert compile(dir, files) == {:error, diags}, inspect(diags)
    end
  end

  defp elapsed_files do
    manifest =
      src("cartridge.json")
      |> Map.put("time_policy", %{"profile" => "real_elapsed", "rate" => 50})
      |> put_in(~w(requires kernel_api at_least), "1.1")
      |> put_in(~w(requires capabilities schedule), 1)

    %{
      "cartridge.json" => manifest,
      "actions/coil_rope.json" => Map.delete(src("actions/coil_rope.json"), "duration")
    }
  end

  # Breaks: opted-in policy dropped from the compiled artifact, or legacy duration rules
  # applied to an elapsed release despite removing the scripted action's time skip.
  test "elapsed release preserves its policy in its artifact", %{dir: dir} do
    assert {:ok, bytes, []} = compile(dir, elapsed_files())
    artifact = JSON.decode!(bytes)

    assert artifact["cartridge"]["manifest"]["time_policy"] ==
             %{"profile" => "real_elapsed", "rate" => 50}
  end

  # Breaks: elapsed mechanics can be claimed without a schedule owner.
  test "elapsed policy requires schedule ownership", %{dir: dir} do
    files = elapsed_files()

    missing =
      files
      |> update_in(["cartridge.json", "requires", "capabilities"], &Map.delete(&1, "schedule"))
      |> Map.put("npcs/bram.json", Map.delete(src("npcs/bram.json"), "daily_schedule"))

    assert compile(dir, missing) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "cartridge.time_policy",
                  %{"capability" => "schedule"},
                  ["schedule@1"]
                )
              ]}
  end

  # Breaks: a cartridge alias can manufacture authority elapsed evidence or skip real time
  # through Wait; duration scripted actions likewise cannot opt into elapsed time.
  test "elapsed release refuses time-skip scripted actions and player clock aliases", %{dir: dir} do
    files = elapsed_files()

    action = %{
      "name" => "actions.coil_rope",
      "accessibility" => "actions.coil_rope",
      "target" => %{"kind" => "none"},
      "priority" => 0,
      "input" => ["until"],
      "policy" => %{"op" => "all", "items" => []}
    }

    for name <- ~w(elapsed wait) do
      alias_files = Map.put(files, "actions/hurry.json", Map.put(action, "command", name))

      assert compile(dir, alias_files) ==
               {:error,
                [
                  d("UNKNOWN_COMMAND", "actions/hurry.command", %{})
                ]}
    end

    duration = Map.put(files, "actions/coil_rope.json", src("actions/coil_rope.json"))

    assert compile(dir, duration) ==
             {:error,
              [
                d("INVALID_TIME_POLICY", "actions/coil_rope.duration", %{})
              ]}
  end
end
