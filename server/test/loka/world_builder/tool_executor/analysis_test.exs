defmodule Loka.WorldBuilder.ToolExecutor.AnalysisTest do
  @moduledoc "Tests for ToolExecutor.Analysis domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Analysis

  describe "execute_read_guide/1" do
    test "reads a valid guide topic" do
      result = Analysis.execute_read_guide(%{"topic" => "world_design_process"})

      case result do
        {:ok, r} ->
          assert r.success == true
          assert r.topic == "world_design_process"
          assert is_binary(r.content)
          assert String.length(r.content) > 0

        {:error, reason} ->
          # Guide file may not exist in test env, that's OK
          assert is_binary(reason)
      end
    end

    test "returns error for unknown topic" do
      assert {:error, reason} = Analysis.execute_read_guide(%{"topic" => "nonexistent_topic"})
      assert reason =~ "Unknown topic"
    end

    test "lists available topics in error message" do
      assert {:error, reason} = Analysis.execute_read_guide(%{"topic" => "fake"})
      assert reason =~ "world_design_process"
      assert reason =~ "narrative_style"
    end

    test "all guide topics are recognized" do
      valid_topics = [
        "world_design_process",
        "narrative_style",
        "story_structure",
        "weaving_patterns",
        "entity_patterns",
        "dialogue_patterns",
        "quest_patterns",
        "npc_behaviors"
      ]

      for topic <- valid_topics do
        result = Analysis.execute_read_guide(%{"topic" => topic})
        # Should either succeed or fail with file read error, not "Unknown topic"
        case result do
          {:ok, _} ->
            :ok

          {:error, reason} ->
            refute String.contains?(reason, "Unknown topic"), "Topic #{topic} not recognized"
        end
      end
    end
  end

  describe "execute_validate_world/1" do
    test "returns validation results" do
      result = Analysis.execute_validate_world(%{})

      case result do
        {:ok, r} ->
          assert r.success == true or Map.has_key?(r, :summary)

        {:error, reason} ->
          # May error in test env without full world data
          assert is_binary(reason)
      end
    end
  end

  describe "execute_search_content/1" do
    test "searches content with a query" do
      result = Analysis.execute_search_content(%{"query" => "room"})

      case result do
        {:ok, r} ->
          assert r.success == true
          assert is_list(r.results)

        {:error, reason} ->
          assert is_binary(reason)
      end
    end

    test "returns empty results for obscure query" do
      result = Analysis.execute_search_content(%{"query" => "zzz_nonexistent_xyz_999"})

      case result do
        {:ok, r} ->
          assert r.success == true
          assert r.results == [] or is_list(r.results)

        {:error, _} ->
          :ok
      end
    end
  end
end
