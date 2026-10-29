defmodule Loka.ContentSpeechTest do
  use ExUnit.Case, async: true

  @dir "cartridges/speech_sampler"
  @kat JSON.decode!(File.read!("protocol/fixtures/speech_sampler_hash.json"))
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks: a keyword or a spoken trigger dropped or reshaped in the artifact the speech transcript
  # replays against (protocol/fixtures/speech_sampler_hash.json, pinned compiler output).
  test "speech_sampler compiles to its pinned artifact without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@dir) == {:ok, expected, []}
  end

  # Breaks (toolbox row G9): the compiler accepts a keyword without speech@1, or a keyword on a riddle.
  test "a keyword needs speech@1 and takes no riddle" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "speech") end)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [unowned])

    assert {"UNDECLARED_CAPABILITY", "areas/village.dialogues.elder_ward.keyword"} in pairs(diags),
           inspect(diags)

    riddle = %{
      "choice_id" => "thank",
      "answer" => "ward",
      "bank" => ~w(W A R D),
      "wrong" => "narration.elder_ward.thank"
    }

    riddled = {"areas/village.json", &put_in(&1, ["dialogues", "elder_ward", "riddle"], riddle)}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [riddled])

    assert {"OUTCOME_MISMATCH", "areas/village.dialogues.elder_ward.keyword"} in pairs(diags),
           inspect(diags)
  end

  # Breaks (word bar S2): the compiler accepts a speech.phrases entry that is not a Word, an empty
  # phrases list, or phrases without speech@1 (the TS loader refuses them
  # too; speech.test.ts).
  test "speech.phrases are Words and need speech@1" do
    dir = Loka.ContentSource.copy(@dir)
    phrases = &{"cartridge.json", fn c -> put_in(c, ["speech", "phrases"], &1) end}

    for {edits, expected} <- [
          {[phrases.(["ward", "Help!"])], {"SCHEMA_VIOLATION", "cartridge.speech.phrases[1]"}},
          {[phrases.([])], {"SCHEMA_VIOLATION", "cartridge.speech.phrases"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert pairs(diags) == [expected]
    end

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "speech") end)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [unowned])
    assert {"UNDECLARED_CAPABILITY", "cartridge.speech.phrases"} in pairs(diags), inspect(diags)
  end
end
