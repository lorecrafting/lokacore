defmodule Loka.Timers.ServerTest do
  use ExUnit.Case, async: false

  alias Loka.Timers.Server, as: TimersServer

  describe "schedule_script/4" do
    test "schedules a script and returns a reference" do
      entity_id = "test-entity-#{:erlang.unique_integer([:positive])}"
      script_key = "test_script"
      delay_seconds = 10

      assert {:ok, ref} = TimersServer.schedule_script(entity_id, delay_seconds, script_key, %{})
      assert is_reference(ref)
    end

    test "accepts context configuration" do
      entity_id = "test-entity-#{:erlang.unique_integer([:positive])}"
      script_key = "test_script"
      context = %{config: %{route: ["a", "b", "c"]}}

      assert {:ok, _ref} = TimersServer.schedule_script(entity_id, 10, script_key, context)
    end

    test "can cancel a scheduled script timer" do
      entity_id = "test-entity-#{:erlang.unique_integer([:positive])}"
      script_key = "test_script"

      {:ok, ref} = TimersServer.schedule_script(entity_id, 60, script_key, %{})
      assert :ok = TimersServer.cancel_script_timer(ref)
    end
  end
end
