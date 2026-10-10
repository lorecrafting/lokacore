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

  # Breaks (toolbox row G9): the compiler accepts a keyword dialogue or a spoken reaction below
  # kernel_api 1.48, a keyword without speech@1, or a keyword on a riddle.
  test "keywords and spoken reactions need 1.48 and speech@1; a keyword takes no riddle" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.47")}
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    unkeyed = {"dialogues/elder_ward.json", &Map.delete(&1, "keyword")}

    no_reactions =
      for f <- ~w(elder_hears watchman_alarm miller_hears),
          do: {"reactions/#{f}.json", &Map.put(&1, "on", %{"event" => "check_failed"})}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [api, unkeyed])
    assert floor in pairs(diags), inspect(diags)

    assert {:error, diags} = Loka.ContentSource.compile(dir, [api | no_reactions])
    assert floor in pairs(diags), inspect(diags)

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "speech") end)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [unowned])

    assert {"UNDECLARED_CAPABILITY", "dialogues/elder_ward.keyword"} in pairs(diags),
           inspect(diags)

    riddle = %{
      "choice_id" => "thank",
      "answer" => "ward",
      "bank" => ~w(W A R D),
      "wrong" => "narration.elder_ward.thank"
    }

    riddled = {"dialogues/elder_ward.json", &Map.put(&1, "riddle", riddle)}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [riddled])
    assert {"OUTCOME_MISMATCH", "dialogues/elder_ward.keyword"} in pairs(diags), inspect(diags)
  end
end
