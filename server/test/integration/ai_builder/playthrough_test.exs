defmodule Loka.Integration.AIBuilder.PlaythroughTest do
  @moduledoc """
  Integration tests that verify AI-built content is playable.

  These tests use the ContentVerifier bot strategy to walk through
  content created by the AI builder, verifying rooms are connected,
  NPCs exist, and quest flow works.

  Run with: mix test test/integration/ai_builder/ --include integration
  """

  use ExUnit.Case, async: false

  @moduletag :integration

  alias Loka.Testing.Bot.Strategies.ContentVerifier

  describe "ContentVerifier strategy" do
    test "initializes with steps" do
      steps = [
        {:move, "north"},
        {:verify_entity, "test_npc"}
      ]

      {:ok, state} = ContentVerifier.init(steps: steps, max_steps: 100)

      assert state.steps == steps
      assert state.current_step_index == 0
      assert state.results == []
      assert state.phase == :running
    end

    test "executes move step" do
      {:ok, state} = ContentVerifier.init(steps: [{:move, "north"}])

      context = %{
        room: nil,
        nearby_entities: [],
        game_state: %{}
      }

      {action, new_state} = ContentVerifier.decide(context, state)

      assert action == {:move, "north"}
      assert new_state.current_step_index == 1
      assert [{_, :pass}] = ContentVerifier.results(new_state)
    end

    test "verify_entity passes when entity found" do
      {:ok, state} = ContentVerifier.init(steps: [{:verify_entity, "guard_npc"}])

      entity = %Loka.Engine.Entity{
        id: "uuid-1",
        key: "guard_npc",
        type: :npc,
        components: %{}
      }

      context = %{
        room: nil,
        nearby_entities: [entity],
        game_state: %{}
      }

      {_action, new_state} = ContentVerifier.decide(context, state)

      assert [{_, :pass}] = ContentVerifier.results(new_state)
    end

    test "verify_entity fails when entity missing" do
      {:ok, state} = ContentVerifier.init(steps: [{:verify_entity, "missing_npc"}])

      context = %{
        room: nil,
        nearby_entities: [],
        game_state: %{}
      }

      {_action, new_state} = ContentVerifier.decide(context, state)

      assert [{_, {:fail, reason}}] = ContentVerifier.results(new_state)
      assert reason =~ "not found"
    end

    test "finishes when all steps completed" do
      {:ok, state} = ContentVerifier.init(steps: [{:move, "north"}])

      context = %{room: nil, nearby_entities: [], game_state: %{}}

      # Execute the one step
      {_action, state} = ContentVerifier.decide(context, state)

      # Next decide should be idle (all steps done)
      {action, final_state} = ContentVerifier.decide(context, state)

      assert action == :idle
      assert final_state.phase == :done
    end

    test "summary reports pass/fail counts" do
      {:ok, state} =
        ContentVerifier.init(
          steps: [
            {:move, "north"},
            {:verify_entity, "missing_npc"}
          ]
        )

      context = %{room: nil, nearby_entities: [], game_state: %{}}

      {_action, state} = ContentVerifier.decide(context, state)
      {_action, state} = ContentVerifier.decide(context, state)

      summary = ContentVerifier.summary(state)
      assert summary.passed == 1
      assert summary.failed == 1
      assert summary.total == 2
    end

    test "all_passed? returns false when any step fails" do
      {:ok, state} =
        ContentVerifier.init(
          steps: [
            {:move, "north"},
            {:verify_entity, "missing"}
          ]
        )

      context = %{room: nil, nearby_entities: [], game_state: %{}}

      {_action, state} = ContentVerifier.decide(context, state)
      {_action, state} = ContentVerifier.decide(context, state)

      refute ContentVerifier.all_passed?(state)
    end
  end

  # TODO: Full integration test that:
  # 1. Runs an AI eval scenario to build content
  # 2. Spawns a ChannelBot with ContentVerifier strategy
  # 3. Verifies the bot can navigate the built content
  # 4. Asserts all verification steps pass
  #
  # This requires a running server and is excluded from CI by default.
  # Run with: mix test test/integration/ai_builder/ --include integration
end
