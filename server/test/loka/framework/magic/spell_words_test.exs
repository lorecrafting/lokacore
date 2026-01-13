defmodule Loka.Framework.Magic.SpellWordsTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Magic.SpellWords
  alias Loka.Framework.Player.GameState

  setup do
    # Start the default SpellWords server if not running
    pid =
      case Process.whereis(SpellWords) do
        nil ->
          {:ok, p} = SpellWords.start_link(name: SpellWords, load_on_start: true)
          p

        existing ->
          existing
      end

    # Create a test GameState
    game_state = %GameState{
      player_id: "test_player",
      stats: %{known_spell_words: []},
      inventory: [],
      equipment: %{},
      quests: %{},
      flags: %{},
      health: %{current: 100, max: 100},
      current_room_id: nil
    }

    %{game_state: game_state, server_pid: pid}
  end

  describe "get_word/2" do
    test "returns error for unknown word" do
      assert {:error, :not_found} = SpellWords.get_word("unknown_word")
    end

    test "returns word definition when word exists" do
      assert {:ok, word} = SpellWords.get_word("ignis")
      assert word.key == "ignis"
      assert word.name == "Ignis"
      assert word.meaning == "fire"
      assert word.power == 10
    end
  end

  describe "all_words/1" do
    test "returns all loaded words" do
      words = SpellWords.all_words()
      assert is_list(words)
      # Default has at least 4 words
      assert length(words) >= 4

      word_keys = Enum.map(words, & &1.key)
      assert "ignis" in word_keys
      assert "aqua" in word_keys
      assert "creo" in word_keys
    end
  end

  describe "get_combination/2" do
    test "returns combination when words match" do
      assert {:ok, combo} = SpellWords.get_combination(["ignis", "creo"])
      assert combo.result == "fireball"
      assert combo.description =~ "fire"
    end

    test "word order doesn't matter" do
      # Try both orders
      assert {:ok, _combo1} = SpellWords.get_combination(["ignis", "creo"])
      assert {:ok, _combo2} = SpellWords.get_combination(["creo", "ignis"])
    end

    test "returns error for unknown combination" do
      assert {:error, :not_found} = SpellWords.get_combination(["ignis", "aqua"])
    end

    test "returns error for non-existent words" do
      assert {:error, :not_found} = SpellWords.get_combination(["fake", "words"])
    end
  end

  describe "reload/1" do
    test "successfully reloads words" do
      assert :ok = SpellWords.reload()

      # Verify words are loaded
      words = SpellWords.all_words()
      assert length(words) > 0
    end

    test "can reload multiple times" do
      assert :ok = SpellWords.reload()
      assert :ok = SpellWords.reload()
      assert :ok = SpellWords.reload()

      words = SpellWords.all_words()
      assert length(words) > 0
    end
  end

  describe "known_words/1" do
    test "returns empty list for new player", %{game_state: game_state} do
      assert SpellWords.known_words(game_state) == []
    end

    test "returns list of known words", %{game_state: game_state} do
      game_state = %{game_state | stats: %{known_spell_words: ["ignis", "aqua"]}}

      words = SpellWords.known_words(game_state)
      assert length(words) == 2
      assert "ignis" in words
      assert "aqua" in words
    end

    test "handles stats without known_spell_words key", %{game_state: game_state} do
      game_state = %{game_state | stats: %{}}

      assert SpellWords.known_words(game_state) == []
    end
  end

  describe "knows_word?/2" do
    test "returns false when word is unknown", %{game_state: game_state} do
      assert SpellWords.knows_word?(game_state, "ignis") == false
    end

    test "returns true when word is known", %{game_state: game_state} do
      game_state = %{game_state | stats: %{known_spell_words: ["ignis"]}}

      assert SpellWords.knows_word?(game_state, "ignis") == true
    end

    test "returns false for empty word list", %{game_state: game_state} do
      game_state = %{game_state | stats: %{known_spell_words: []}}

      assert SpellWords.knows_word?(game_state, "ignis") == false
    end
  end

  describe "learn_word/2" do
    test "successfully learns a new word", %{game_state: game_state} do
      assert {:ok, updated_state, word} = SpellWords.learn_word(game_state, "ignis")

      assert word.key == "ignis"
      assert "ignis" in updated_state.stats.known_spell_words
    end

    test "returns error when word already known", %{game_state: game_state} do
      game_state = %{game_state | stats: %{known_spell_words: ["ignis"]}}

      assert {:error, :already_known} = SpellWords.learn_word(game_state, "ignis")
    end

    test "returns error for unknown word", %{game_state: game_state} do
      assert {:error, :unknown_word} = SpellWords.learn_word(game_state, "fake_word")
    end

    test "adds word to existing list", %{game_state: game_state} do
      game_state = %{game_state | stats: %{known_spell_words: ["aqua"]}}

      {:ok, updated_state, _word} = SpellWords.learn_word(game_state, "ignis")

      assert "ignis" in updated_state.stats.known_spell_words
      assert "aqua" in updated_state.stats.known_spell_words
      assert length(updated_state.stats.known_spell_words) == 2
    end
  end

  describe "cast/2" do
    setup %{game_state: game_state} do
      # Player knows the words
      game_state = %{game_state | stats: %{known_spell_words: ["ignis", "creo", "aqua"]}}

      %{game_state: game_state}
    end

    test "successfully casts known combination", %{game_state: game_state} do
      assert {:ok, result} = SpellWords.cast(game_state, ["ignis", "creo"])

      assert result.spell == "fireball"
      # ignis (10) + creo (5)
      assert result.power == 15
      assert is_binary(result.description)
      assert result.words_used == ["ignis", "creo"]
    end

    test "returns error for unknown words", %{game_state: game_state} do
      assert {:error, {:unknown_words, unknown}} = SpellWords.cast(game_state, ["fake", "words"])

      assert "fake" in unknown
      assert "words" in unknown
    end

    test "returns error for unknown combination", %{game_state: game_state} do
      assert {:error, :unknown_combination, words} =
               SpellWords.cast(game_state, ["ignis", "aqua"])

      assert "ignis" in words
      assert "aqua" in words
    end

    test "calculates power correctly", %{game_state: game_state} do
      {:ok, result} = SpellWords.cast(game_state, ["aqua", "creo"])

      # aqua (8) + creo (5) = 13
      assert result.power == 13
    end

    test "returns error if player doesn't know all words", %{game_state: game_state} do
      # Player only knows ignis
      game_state = %{game_state | stats: %{known_spell_words: ["ignis"]}}

      assert {:error, {:unknown_words, unknown}} = SpellWords.cast(game_state, ["ignis", "creo"])

      assert "creo" in unknown
      assert "ignis" not in unknown
    end
  end

  describe "speak_words/1" do
    test "converts word keys to names" do
      result = SpellWords.speak_words(["ignis", "creo"])

      assert result == "Ignis Creo"
    end

    test "handles unknown words gracefully" do
      result = SpellWords.speak_words(["ignis", "unknown", "creo"])

      assert result == "Ignis unknown Creo"
    end

    test "handles empty list" do
      result = SpellWords.speak_words([])

      assert result == ""
    end

    test "handles single word" do
      result = SpellWords.speak_words(["ignis"])

      assert result == "Ignis"
    end
  end

  describe "GenServer initialization" do
    test "starts with load_on_start: false" do
      server_name = :"spell_words_test_#{System.unique_integer([:positive])}"
      {:ok, pid} = SpellWords.start_link(name: server_name, load_on_start: false)

      words = SpellWords.all_words(server_name)
      assert words == []

      GenServer.stop(pid)
    end

    test "starts with load_on_start: true loads default words" do
      server_name = :"spell_words_test_#{System.unique_integer([:positive])}"
      {:ok, pid} = SpellWords.start_link(name: server_name, load_on_start: true)

      words = SpellWords.all_words(server_name)
      assert length(words) >= 4

      GenServer.stop(pid)
    end

    test "accepts custom path option" do
      server_name = :"spell_words_test_#{System.unique_integer([:positive])}"

      {:ok, pid} =
        SpellWords.start_link(name: server_name, path: "/custom/path", load_on_start: false)

      # Should start without error even with custom path
      assert Process.alive?(pid)

      GenServer.stop(pid)
    end
  end
end
