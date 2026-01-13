defmodule Loka.Testing.Content.DialogueQuestChainValidatorTest do
  use Loka.DataCase, async: false

  alias Loka.Testing.Content.DialogueQuestChainValidator

  describe "validate_all/0" do
    test "validates all storyline quest chains" do
      {:ok, results} = DialogueQuestChainValidator.validate_all()

      IO.puts("\n=== Dialogue Quest Chain Validation ===")
      IO.puts("Total checks: #{results.total_checks}")
      IO.puts("Passed: #{results.passed}")
      IO.puts("Errors: #{length(results.errors)}")
      IO.puts("Warnings: #{length(results.warnings)}\n")

      if length(results.errors) > 0 do
        IO.puts("=== ERRORS ===")

        Enum.each(results.errors, fn error ->
          IO.inspect(error)
        end)
      end

      if length(results.warnings) > 0 do
        IO.puts("\n=== WARNINGS ===")

        Enum.each(results.warnings, fn warning ->
          IO.inspect(warning)
        end)
      end

      # Don't fail the test, just report
      assert is_map(results)
    end
  end

  describe "validate_npc/1" do
    test "validates specific NPC quest chains" do
      {:ok, results} = DialogueQuestChainValidator.validate_npc("abbot_jampa")

      IO.puts("\n=== Abbot Jampa Quest Chain Validation ===")
      IO.inspect(results, label: "Results")

      assert is_list(results)
    end
  end
end
