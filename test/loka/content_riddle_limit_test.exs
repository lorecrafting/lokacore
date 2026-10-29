defmodule Loka.ContentRiddleLimitTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/scene_sampler")}

  # Twin of kernel/ts/test/riddle_fixture.ts: a sphinx beside Bram asks a bounded riddle of the
  # lantern quest.
  @riddle %{
    "npc" => "sphinx",
    "prompt" => "dialogue.riddle.prompt",
    "quest" => "lantern",
    "policy" => %{"op" => "quest_state", "quest" => "lantern", "state" => "active"},
    "roles" => %{
      "sphinx" => %{"role" => "npc", "npc" => "sphinx"},
      "bram" => %{"role" => "npc", "npc" => "bram"}
    },
    "choices" => %{
      "answer" => %{
        "label" => "dialogue.riddle.answer",
        "narration" => "narration.riddle.answer",
        "steps" => [%{"op" => "fact.assign", "fact" => "riddle_solved", "value" => true}]
      }
    },
    "riddle" => %{
      "choice_id" => "answer",
      "answer" => "tide",
      "bank" => ["T", "I", "D", "E"],
      "wrong" => "narration.riddle.wrong",
      "wrong_limit" => 3
    }
  }

  defp source(riddle, extra \\ []) do
    [
      {"cartridge.json", &put_in(&1, ~w(requires kernel_api at_least), "1.21")},
      {"npcs/sphinx.json",
       %{
         "keywords" => ["sphinx"],
         "name" => "npc.sphinx.short",
         "description" => "npc.sphinx.description",
         "room_line" => "npc.sphinx.room",
         "room" => "ferry_landing"
       }},
      {"facts.json",
       &put_in(&1, ~w(facts riddle_solved), %{
         "version" => 1,
         "value_type" => %{"type" => "bool", "default" => false},
         "scopes" => ["player"],
         "meaning" => "The sphinx riddle was answered."
       })},
      {"text.json",
       &Map.merge(&1, %{
         "npc.sphinx.short" => "a sphinx",
         "npc.sphinx.description" => "A sphinx.",
         "npc.sphinx.room" => "A sphinx is here.",
         "dialogue.riddle.prompt" => "What comes in twice a day?",
         "dialogue.riddle.answer" => "Answer",
         "narration.riddle.answer" => "The sphinx nods.",
         "narration.riddle.wrong" => "The sphinx shakes its head."
       })},
      {"dialogues/riddle.json", riddle} | extra
    ]
  end

  defp diagnostics({:error, diags}), do: diags
  defp diagnostics({:ok, _, _}), do: []

  # Breaks: a bounded sitting without a quest, or with no allowed wrong answer, compiles.
  test "a bounded riddle needs a quest and a positive wrong limit", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, source(@riddle))

    for riddle <- [Map.put(@riddle, "quest", nil), put_in(@riddle, ~w(riddle wrong_limit), 0)] do
      diags = diagnostics(Loka.ContentSource.compile(dir, source(riddle)))
      assert Enum.any?(diags, &(&1["code"] == "SCHEMA_VIOLATION")), inspect(diags)
    end
  end

  # Breaks (loka-x6t.5 save re-check, twin of kernel/ts/test/riddle.test.ts): a reopening hub answer
  # directly assigning a bounded riddle's answer fact (riddle-save proves it by one receipt)
  # compiles; or the check flags an unbounded riddle's fact or any other fact.
  test "a reopening dialogue rejects a direct assignment of a bounded riddle answer fact", %{
    dir: dir
  } do
    at = "dialogues/chat.choices.ask.sequence[0].op"

    unbounded =
      @riddle |> Map.delete("quest") |> Map.update!("riddle", &Map.delete(&1, "wrong_limit"))

    for {fact, riddle, flagged} <- [
          {"riddle_solved", @riddle, true},
          {"riddle_solved", unbounded, false},
          {"bell_heard", @riddle, false}
        ] do
      # No quest, no riddle, two choices: Bram's chat reopens after each answer.
      chat = %{
        "npc" => "bram",
        "prompt" => "dialogue.bram.prompt",
        "policy" => @riddle["policy"],
        "roles" => %{"bram" => %{"role" => "npc", "npc" => "bram"}},
        "choices" => %{
          "ask" => %{
            "label" => "dialogue.bram.carry",
            "narration" => "narration.bram.carry",
            "steps" => [%{"op" => "fact.assign", "fact" => fact, "value" => true}]
          },
          "bye" => %{"label" => "dialogue.bram.leave", "narration" => "narration.bram.leave"}
        }
      }

      result = Loka.ContentSource.compile(dir, source(riddle, [{"dialogues/chat.json", chat}]))
      diags = diagnostics(result)

      assert Enum.any?(diags, &(&1["code"] == "OUTCOME_MISMATCH" and &1["path"] == at)) == flagged,
             "#{fact}: #{inspect(diags)}"

      if !flagged, do: assert({:ok, _, _} = result)
    end
  end
end
