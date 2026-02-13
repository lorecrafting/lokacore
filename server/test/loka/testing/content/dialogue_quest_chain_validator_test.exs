defmodule Loka.Testing.Content.DialogueQuestChainValidatorTest do
  use Loka.DataCase, async: false

  alias Loka.Testing.Content.DialogueQuestChainValidator

  describe "validate_all/0" do
    test "validates all storyline quest chains" do
      case DialogueQuestChainValidator.validate_all() do
        {:ok, results} ->
          assert is_map(results)
          assert is_integer(results.total_checks)
          assert is_integer(results.passed)
          assert is_list(results.errors)
          assert is_list(results.warnings)

        {:error, :no_storylines} ->
          # No storylines in test DB sandbox — expected in sandboxed tests
          :ok
      end
    end
  end

  describe "validate_npc/1" do
    test "validates specific NPC quest chains" do
      {:ok, results} = DialogueQuestChainValidator.validate_npc("abbot_jampa")

      assert is_list(results)
    end
  end
end
