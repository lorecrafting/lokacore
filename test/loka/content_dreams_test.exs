defmodule Loka.ContentDreamsTest do
  use ExUnit.Case, async: true

  @always %{"op" => "all", "items" => []}
  @flag %{
    "version" => 1,
    "value_type" => %{"type" => "bool", "default" => false},
    "scopes" => ["player"]
  }

  # Inline Rest dream on sleep_sampler: Maud rents the Inn Rooms bed east of the camp, and the
  # first paid Rest there starts a presentation-only dream that resolves quest a_room.
  @dream %{
    "rooms/inn_rooms.json" => %{
      "name" => "room.inn_rooms.title",
      "description" => "room.inn_rooms.description",
      "exits" => %{"west" => %{"to" => "camp"}},
      "details" => %{
        "bed" => %{
          "aliases" => ["bed"],
          "description" => "detail.bed",
          "bed" => %{"entitlement" => "bed_paid", "title" => "detail.bed.title"}
        }
      }
    },
    "npcs/maud.json" => %{
      "keywords" => ["maud"],
      "name" => "npc.maud.short",
      "room_line" => "npc.maud.room",
      "description" => "npc.maud.description",
      "room" => "camp",
      "resource_starts" => %{"pennies" => 10},
      "services" => ["bed_room"]
    },
    "services/bed_room.json" => %{
      "provider" => "maud",
      "currency" => "pennies",
      "action" => "rent_room",
      "name" => "service.room",
      "narration" => "service.room.used",
      "price" => 3,
      "benefit" => %{"kind" => "entitlement", "fact" => "bed_paid"}
    },
    "dialogues/maud_talk.json" => %{
      "npc" => "maud",
      "policy" => @always,
      "prompt" => "dialogue.maud.prompt",
      "roles" => %{"maud" => %{"role" => "npc", "npc" => "maud"}},
      "choices" => %{
        "chat" => %{"label" => "dialogue.maud.chat", "narration" => "dialogue.maud.chat"}
      },
      "name" => "dialogue.maud.label"
    },
    "quests/a_room.json" => %{
      "name" => "quest.room.title",
      "objective" => %{
        "evidence" => "current_state",
        "policy" => %{"op" => "fact_compare", "fact" => "dream_seen", "equals" => true}
      },
      "journal" =>
        Map.new(~w(active objectives_met resolved failed abandoned), &{&1, "quest.room.active"})
    },
    "scenes/fen_dream.json" => %{
      "control" => "presentation_only",
      "name" => "dream.title",
      "description" => "dream.description",
      "on" => %{
        "rest" => %{
          "room" => "inn_rooms",
          "detail" => "bed",
          "entitlement" => "bed_paid",
          "credit" => "slept_paid",
          "quest" => "a_room"
        }
      },
      "steps" => [
        %{"type" => "narrate", "text" => "dream.opening"},
        %{"type" => "narrate", "text" => "dream.fen"},
        %{"type" => "narrate", "text" => "dream.fox"},
        %{
          "type" => "choice",
          "key" => "fen_fork",
          "prompt" => "dream.choice",
          "choices" => [
            %{
              "choice_id" => "follow_fox",
              "label" => "dream.follow",
              "text" => "dream.follow.final"
            },
            %{"choice_id" => "wake", "label" => "dream.wake", "text" => "dream.wake.final"}
          ]
        },
        %{"type" => "branch"},
        %{"type" => "await_ack"},
        %{"type" => "end"}
      ],
      "on_end" => %{
        "assign" => [%{"fact" => "dream_seen", "value" => true}],
        "quest" => "a_room",
        "outcome" => "acknowledged"
      }
    },
    "actions/rent_room.json" => %{
      "name" => "service.room",
      "command" => "use_service",
      "target" => %{"kind" => "entity", "scopes" => ["room_occupants"]},
      "input" => ["service", "quoted_price"],
      "priority" => 0,
      "policy" => @always,
      "accessibility" => "service.room"
    },
    "actions/dream_next.json" => %{
      "command" => "continue",
      "target" => %{"kind" => "none"},
      "input" => ["scene", "line"],
      "name" => "action.continue",
      "priority" => 0,
      "policy" => @always,
      "accessibility" => "action.continue"
    },
    "actions/dream_choose.json" => %{
      "command" => "choose",
      "target" => %{"kind" => "none"},
      "input" => ["continuation_id", "choice_id", "dream"],
      "name" => "dream.choose",
      "priority" => 0,
      "policy" => @always,
      "accessibility" => "dream.choose"
    }
  }

  @text ~w(room.inn_rooms.title room.inn_rooms.description detail.bed detail.bed.title
           npc.maud.short npc.maud.room npc.maud.description service.room service.room.used
           service.unaffordable service.already_paid dialogue.maud.prompt dialogue.maud.chat
           dialogue.maud.label quest.room.title quest.room.active action.continue dream.title
           dream.description dream.opening dream.fen dream.fox dream.choice dream.follow
           dream.wake dream.choose dream.follow.final dream.wake.final)

  setup_all do
    dir = Loka.ContentSource.copy("cartridges/sleep_sampler")
    read = fn file -> JSON.decode!(File.read!(Path.join(dir, file))) end
    write = fn file, value -> File.write!(Path.join(dir, file), JSON.encode!(value)) end

    for {file, value} <- @dream do
      File.mkdir_p!(Path.dirname(Path.join(dir, file)))
      write.(file, value)
    end

    write.(
      "cartridge.json",
      update_in(
        read.("cartridge.json"),
        ["requires", "capabilities"],
        &Map.merge(
          &1,
          Map.new(~w(scene quest service dialogue inspectable_detail scripted_action), fn k ->
            {k, 1}
          end)
        )
      )
    )

    write.(
      "rooms/camp.json",
      put_in(read.("rooms/camp.json"), ["exits", "east"], %{"to" => "inn_rooms"})
    )

    write.(
      "resources.json",
      put_in(read.("resources.json"), ["resources", "pennies"], %{
        "minimum" => 0,
        "maximum" => 1000,
        "start" => 20,
        "gain" => 0
      })
    )

    write.(
      "facts.json",
      update_in(read.("facts.json"), ["facts"], fn f ->
        Map.merge(f, %{
          "bed_paid" => Map.put(@flag, "meaning", "The player paid Maud for the bed."),
          "slept_paid" => Map.put(@flag, "meaning", "First actual paid Rest in the bed."),
          "dream_seen" => Map.put(@flag, "meaning", "Only the acknowledged dream end writes it.")
        })
      end)
    )

    # The room description and Maud's room line carry their touch links, so the source compiles clean.
    links = %{"room.inn_rooms.description" => "A [bed](bed).", "npc.maud.room" => "[Maud] waits."}
    text = Map.new(@text, &{&1, &1}) |> Map.merge(links)
    write.("text.json", Map.merge(read.("text.json"), text))
    %{dir: dir}
  end

  # Breaks: new Rest/end short refs survive expansion, or source accepts unsafe graph, bed, consequence ownership or required dependencies.
  test "Rest dream source expands its current bindings and rejects impossible declarations", %{
    dir: dir
  } do
    assert {:ok, bytes, []} = Loka.ContentSource.compile(dir, [])
    c = JSON.decode!(bytes)["cartridge"]
    s = c["scenes"]["sleep_sampler@0.0.1:scene/fen_dream"]

    ref =
      &%{
        "cartridge_id" => "sleep_sampler",
        "cartridge_version" => "0.0.1",
        "kind" => &1,
        "key" => &2
      }

    assert s["on"]["rest"]["room"] == ref.("room", "inn_rooms")
    assert s["on_end"]["assign"] == [%{"fact" => ref.("fact", "dream_seen"), "value" => true}]

    scene = "scenes/fen_dream.json"

    cases = [
      {[
         {"cartridge.json",
          &update_in(&1, ["requires", "capabilities"], fn x -> Map.delete(x, "death") end)}
       ], {"OUTCOME_MISMATCH", "cartridge.requires.capabilities.death"}},
      {[{scene, &put_in(&1, ["on", "rest", "room"], "camp")}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest"}},
      {[{scene, &put_in(&1, ["on", "rest", "detail"], "other")}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest"}},
      {[{scene, &put_in(&1, ["on", "rest", "entitlement"], "dream_seen")}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest"}},
      {[{"facts.json", &put_in(&1, ["facts", "slept_paid", "scopes"], ["instance"])}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest"}},
      {[{"facts.json", &put_in(&1, ["facts", "slept_paid", "value_type", "default"], true)}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest"}},
      {[{scene, &put_in(&1, ["steps", Access.at(0)], %{"type" => "branch"})}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.steps"}},
      {[
         {scene,
          &put_in(&1, ["steps", Access.at(3), "choices", Access.at(1), "choice_id"], "follow_fox")}
       ], {"OUTCOME_MISMATCH", "scenes/fen_dream.steps[3].choices"}},
      {[
         {scene,
          &put_in(&1, ["steps", Access.at(3), "choices", Access.at(1), "text"], "missing.line")}
       ], {"UNRESOLVED_REFERENCE", "scenes/fen_dream.steps[3].choices[1].text"}},
      {[
         {"quests/other.json", @dream["quests/a_room.json"]},
         {scene, &put_in(&1, ["on_end", "quest"], "other")}
       ], {"OUTCOME_MISMATCH", "scenes/fen_dream.on_end"}},
      {[
         {"quests/a_room.json", &put_in(&1, ["objective", "policy", "fact"], "slept_paid")}
       ], {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest.quest"}},
      {[{scene, &put_in(&1, ["on_end", "assign", Access.at(0), "value"], false)}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on_end.assign[0]"}},
      {[{scene, &put_in(&1, ["on_end", "assign", Access.at(0), "fact"], "slept_paid")}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on_end.assign[0]"}},
      {[
         {"dialogues/maud_talk.json",
          &put_in(&1, ["choices", "chat", "sequence"], [
            %{"op" => "fact.assign", "fact" => "dream_seen", "value" => true}
          ])}
       ], {"RESERVED_FACT", "dialogues/maud_talk.choices.chat.sequence[0].fact"}},
      {[{"dialogues/maud_talk.json", &put_in(&1, ["choices", "chat", "accept"], "a_room")}],
       {"OUTCOME_MISMATCH", "scenes/fen_dream.on.rest"}}
    ]

    # Each case names the diagnostic its change must raise, at the field it breaks.
    for {changes, want} <- cases do
      assert {:error, d} = Loka.ContentSource.compile(dir, changes), inspect(hd(changes))
      assert want in Enum.map(d, &{&1["code"], &1["path"]}), inspect(hd(changes))
    end
  end

  # Breaks: differing consequence refs let two dreams consume one Rest anchor, or normalization rejects distinct room/detail anchors.
  @tag :duplicate_rest_trigger
  test "Rest trigger identity is its room and detail, independent of consequence refs", %{
    dir: dir
  } do
    read = fn file -> JSON.decode!(File.read!(Path.join(dir, file))) end
    facts = read.("facts.json")
    room = read.("rooms/inn_rooms.json")

    annex = [
      {"facts.json",
       facts
       |> put_in(["facts", "annex_slept"], facts["facts"]["slept_paid"])
       |> put_in(["facts", "annex_seen"], facts["facts"]["dream_seen"])},
      {"quests/annex_rest.json",
       put_in(read.("quests/a_room.json"), ["objective", "policy", "fact"], "annex_seen")},
      {"rooms/dream_annex.json", room}
    ]

    other_bed =
      {"rooms/inn_rooms.json",
       put_in(
         room,
         ["details", "other_bed"],
         Map.put(room["details"]["bed"], "aliases", ["other_bed"])
       )}

    scene =
      read.("scenes/fen_dream.json")
      |> put_in(["on", "rest", "credit"], "annex_slept")
      |> put_in(["on", "rest", "quest"], "annex_rest")
      |> put_in(["on_end", "assign", Access.at(0), "fact"], "annex_seen")
      |> put_in(["on_end", "quest"], "annex_rest")

    for {anchor, detail} <- [{"dream_annex", "bed"}, {"inn_rooms", "other_bed"}] do
      another =
        scene
        |> put_in(["on", "rest", "room"], anchor)
        |> put_in(["on", "rest", "detail"], detail)

      assert {:ok, _, _} =
               Loka.ContentSource.compile(dir, [
                 other_bed,
                 {"scenes/another_dream.json", another} | annex
               ])
    end

    assert {:error, diagnostics} =
             Loka.ContentSource.compile(dir, [{"scenes/another_dream.json", scene} | annex])

    assert Enum.map(diagnostics, &{&1["code"], &1["path"]}) == [
             {"DUPLICATE_DEFINITION", "scenes/another_dream.on"},
             {"DUPLICATE_DEFINITION", "scenes/fen_dream.on"}
           ]
  end
end
