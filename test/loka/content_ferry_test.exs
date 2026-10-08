defmodule Loka.ContentFerryTest do
  # The calendar start and an NPC's daily schedule in the compiler (Early R7/R8 S;
  # cartridge.schema.json Calendar, entity.schema.json NpcDefinition daily_schedule). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode, with the
  # loader's paths in kernel/ts/test/schedule.test.ts; the known answer is
  # protocol/fixtures/cartridge_ferry_hash.json (Python).
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_ferry")}
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_ferry_hash.json"))
  @src "cartridges/ashmere_ferry"
  @point "story_points/lantern_resolved.json"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp ref(key),
    do: %{
      "cartridge_id" => "ashmere_ferry",
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
  test "ashmere_ferry compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a schedule's short room left short (Checks.expand; the loader would reject it).
  test "full schedule rooms compile to the same artifact", %{dir: dir} do
    full = %{"6" => ref("ferry_landing"), "19" => ref("village_green")}
    assert compile(dir, schedule(full)) == {:ok, @expected, []}
  end

  # coil_rope with its Bram participant replaced by `p`.
  defp bram(p) do
    r = src("recipes/coil_rope.json")
    %{"recipes/coil_rope.json" => put_in(r, ~w(outcomes success narration participants bram), p)}
  end

  @bram "recipes/coil_rope.outcomes.success.narration.participants.bram"

  # Breaks: a participant's short npc left short (Checks.expand; the loader would reject it).
  test "a full participant reference compiles to the same artifact", %{dir: dir} do
    full = %{"role" => "npc", "npc" => Map.put(ref("bram"), "kind", "npc")}
    assert compile(dir, bram(full)) == {:ok, @expected, []}
  end

  # Breaks: a participant naming no npc or item of its role compiling (the kernel would pin an
  # undefined EntityId).
  test "a participant naming no definition of its role is UNRESOLVED_REFERENCE", %{dir: dir} do
    unresolved = &{:error, [d("UNRESOLVED_REFERENCE", @bram <> &1, %{"target" => &2})]}

    assert compile(dir, bram(%{"role" => "npc", "npc" => "ada"})) ==
             unresolved.(".npc", "ashmere_ferry@0.0.1:npc/ada")

    assert compile(dir, bram(%{"role" => "npc", "npc" => ref("ferry_landing")})) ==
             unresolved.(".npc", "ashmere_ferry@0.0.1:room/ferry_landing")

    assert compile(dir, bram(%{"role" => "item", "item" => "bram"})) ==
             unresolved.(".item", "ashmere_ferry@0.0.1:item/bram")
  end

  # Breaks: a schedule naming a room the cartridge lacks compiling (run_job would crash).
  test "a schedule's unknown room is UNRESOLVED_REFERENCE", %{dir: dir} do
    assert compile(dir, schedule(%{"6" => "ferry_landing", "19" => "shed"})) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "npcs/bram.daily_schedule.19", %{
                  "target" => "ashmere_ferry@0.0.1:room/shed"
                })
              ]}
  end

  # Breaks: a daily schedule compiling without behavior@1, or a calendar without calendar@1, in
  # the manifest (capability_registry.json definitions).
  test "a schedule needs behavior@1 and a calendar calendar@1", %{dir: dir} do
    m = src("cartridge.json")
    without = &update_in(m, ["requires", "capabilities"], fn c -> Map.delete(c, &1) end)

    assert compile(dir, %{"cartridge.json" => without.("behavior")}) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "npcs/bram.daily_schedule",
                  %{"capability" => "behavior"},
                  ["behavior@1"]
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
      "label" => "actions.coil_rope",
      "accessibility" => "actions.coil_rope",
      "target" => %{"kind" => "none"},
      "command" => "run_job",
      "priority" => 0,
      "input" => [],
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
    }

    assert compile(dir, %{"actions/hurry.json" => action}) ==
             {:error, [d("UNKNOWN_COMMAND", "actions/hurry.command", %{})]}
  end

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

  # Breaks: a dialogue's short speaker, quest, role or fact left short (Checks.expand; the loader
  # would reject the artifact).
  test "a full-reference dialogue compiles to the same artifact", %{dir: dir} do
    full = fn kind, key -> Map.merge(ref(key), %{"kind" => kind}) end

    files =
      dialogue(fn d ->
        d
        |> Map.merge(%{"npc" => full.("npc", "bram"), "quest" => full.("quest", "lantern")})
        |> put_in(~w(roles bram npc), full.("npc", "bram"))
        |> put_in(~w(roles lantern item), full.("item", "lantern"))
        |> update_in(~w(choices carry sequence), fn [s] ->
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
    missing = &"ashmere_ferry@0.0.1:#{&1}/missing"
    m = src("cartridge.json")

    cases = [
      {dialogue(&Map.put(&1, "npc", "missing")), unresolved.(".npc", missing.("npc"))},
      {dialogue(&put_in(&1, ~w(roles lantern item), "missing")),
       unresolved.(".roles.lantern.item", missing.("item"))},
      {dialogue(&Map.put(&1, "quest", "missing")), unresolved.(".quest", missing.("quest"))},
      {dialogue(&put_in(&1, ~w(policy root quest), "missing")),
       unresolved.(".policy.root.quest", missing.("quest"))},
      {dialogue(fn d ->
         d
         |> put_in(~w(roles bram), %{"role" => "item", "item" => "lantern"})
         |> update_in(~w(choices leave), &Map.delete(&1, "hand_over"))
       end), unresolved.(".npc", "ashmere_ferry@0.0.1:npc/bram")},
      {dialogue(&put_in(&1, ~w(choices leave hand_over item), "bram")),
       unresolved.(".choices.leave.hand_over.item", "bram")},
      {dialogue(&put_in(&1, ~w(choices leave hand_over to), "lantern")),
       unresolved.(".choices.leave.hand_over.to", "lantern")},
      {dialogue(&Map.put(&1, "prompt", "dialogue.none")),
       unresolved.(".prompt", "dialogue.none")},
      {dialogue(&put_in(&1, ~w(choices carry narration), "dialogue.none")),
       unresolved.(".choices.carry.narration", "dialogue.none")},
      {dialogue(
         &update_in(&1, ~w(choices carry sequence), fn [s] -> [%{s | "fact" => "missing"}] end)
       ), unresolved.(".choices.carry.sequence[0].fact", missing.("fact"))},
      {dialogue(
         &update_in(&1, ~w(choices carry sequence), fn [s] -> [%{s | "value" => "lost"}] end)
       ), d("FACT_TYPE_MISMATCH", at <> ".choices.carry.sequence[0].value", %{})},
      {dialogue(&put_in(&1, ~w(roles actor), %{"role" => "npc", "npc" => "bram"})),
       d("DUPLICATE_DEFINITION", at <> ".roles.actor", %{})},
      {dialogue(&Map.put(&1, "choices", %{})),
       d("SCHEMA_VIOLATION", at <> ".choices", %{"error" => "too_few_items"})},
      {Map.merge(dialogue(& &1, "dialogues/lantern.json"), %{"dialogues/bram.json" => nil}),
       d("DUPLICATE_DEFINITION", "dialogues/lantern", %{})},
      {%{
         "cartridge.json" => update_in(m, ~w(requires capabilities), &Map.delete(&1, "dialogue"))
       }, d("UNDECLARED_CAPABILITY", at, %{"capability" => "dialogue"}, ["dialogue@1"])}
    ]

    # Story points, which name bram, have their own test below.
    for {files, diag} <- cases do
      assert compile(dir, Map.put(files, @point, nil)) == {:error, [diag]},
             inspect(diag)
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
            "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}},
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
         "target" => "ashmere_ferry@0.0.1:quest/missing"
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

  # Breaks (23 §3: the compiler validates its trigger, outcome coverage and capability
  # dependencies): the compiler admitting what the loader rejects (kernel/ts/test/dialogue.test.ts):
  # a trigger naming no dialogue or a choice it lacks, one choice feeding two outcomes, a dialogue
  # without a quest (its choice repeatable), a story point with no outcome, dialogue@1 not required.
  test "the compiler checks story point triggers, outcomes and the lock", %{dir: dir} do
    at = "story_points/lantern_resolved"
    point = &%{@point => update_in(src(@point), ["outcomes"], &1)}
    carry = &point.(fn o -> put_in(o, ["carry", &1], &2) end)
    each = fn code -> for o <- ~w(carry leave), do: d(code, "#{at}.outcomes.#{o}", %{}) end
    m = src("cartridge.json")

    cases = [
      {carry.("dialogue", "missing"),
       [
         d("UNRESOLVED_REFERENCE", at <> ".outcomes.carry.dialogue", %{
           "target" => "ashmere_ferry@0.0.1:dialogue/missing"
         })
       ]},
      {carry.("choice", "wave"),
       [d("UNRESOLVED_REFERENCE", at <> ".outcomes.carry.choice", %{"target" => "wave"})]},
      {point.(&put_in(&1, ~w(leave choice), "carry")), each.("DUPLICATE_DEFINITION")},
      {dialogue(&Map.delete(&1, "quest")), each.("OUTCOME_MISMATCH")},
      {point.(fn _ -> %{} end),
       [d("SCHEMA_VIOLATION", at <> ".outcomes", %{"error" => "too_few_items"})]},
      {%{
         "cartridge.json" => update_in(m, ~w(requires capabilities), &Map.delete(&1, "dialogue"))
       },
       for(
         p <- ["dialogues/bram", at],
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
      "recipes/coil_rope.json" => Map.delete(src("recipes/coil_rope.json"), "duration")
    }
  end

  # Breaks: opted-in policy dropped from the compiled artifact, or legacy duration rules
  # applied to an elapsed release despite removing the recipe's time skip.
  test "elapsed release preserves its policy in its artifact", %{dir: dir} do
    assert {:ok, bytes, []} = compile(dir, elapsed_files())
    artifact = JSON.decode!(bytes)

    assert artifact["cartridge"]["manifest"]["time_policy"] ==
             %{"profile" => "real_elapsed", "rate" => 50}
  end

  # Breaks: elapsed mechanics can be claimed by an API 1.0 release or without a schedule owner.
  test "elapsed policy requires API 1.1 and schedule ownership", %{dir: dir} do
    files = elapsed_files()
    low = put_in(files, ["cartridge.json", "requires", "kernel_api", "at_least"], "1.0")

    assert compile(dir, low) ==
             {:error,
              [
                d("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})
              ]}

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
  # through Wait; duration recipes likewise cannot opt into elapsed time.
  test "elapsed release refuses time-skip recipes and player clock aliases", %{dir: dir} do
    files = elapsed_files()

    action = %{
      "label" => "actions.coil_rope",
      "accessibility" => "actions.coil_rope",
      "target" => %{"kind" => "none"},
      "priority" => 0,
      "input" => ["until"],
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}
    }

    for name <- ~w(elapsed wait) do
      alias_files = Map.put(files, "actions/hurry.json", Map.put(action, "command", name))

      assert compile(dir, alias_files) ==
               {:error,
                [
                  d("UNKNOWN_COMMAND", "actions/hurry.command", %{})
                ]}
    end

    duration = Map.put(files, "recipes/coil_rope.json", src("recipes/coil_rope.json"))

    assert compile(dir, duration) ==
             {:error,
              [
                d("INVALID_TIME_POLICY", "recipes/coil_rope.duration", %{})
              ]}
  end
end
