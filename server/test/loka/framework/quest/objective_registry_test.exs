defmodule Loka.Framework.Quest.ObjectiveRegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Quest.ObjectiveRegistry
  alias Loka.Framework.Quest.Handlers.{KillHandler, GetItemHandler, GoToHandler, TalkHandler}

  # Custom test handler for testing registration
  defmodule TestEscortHandler do
    @behaviour Loka.Framework.Quest.ObjectiveHandler

    @impl true
    def type, do: :escort

    @impl true
    def matches?(obj_def, event) do
      event.type == :escort && obj_def.target_id == event.target_id
    end

    @impl true
    def progress(_obj_def, event, current) do
      current + Map.get(event, :distance, 1)
    end

    @impl true
    def is_complete?(obj_def, progress) do
      target = Map.get(obj_def, :target_distance) || 100
      progress >= target
    end

    @impl true
    def validate(obj_def) do
      if Map.get(obj_def, :target_id) do
        :ok
      else
        {:error, "escort requires target_id"}
      end
    end

    @impl true
    def description(obj_def, progress) do
      target = Map.get(obj_def, :target_distance) || 100
      "Escort progress: #{progress}/#{target}"
    end
  end

  # Invalid handler missing required callbacks
  defmodule InvalidHandler do
    def type, do: :invalid
    # Missing other required callbacks
  end

  describe "start_link/1" do
    test "starts the registry with built-in handlers" do
      # Registry is started in test setup via application, just verify it's running
      assert Process.whereis(ObjectiveRegistry) != nil
    end

    test "registers built-in handlers automatically" do
      types = ObjectiveRegistry.list_types()

      assert :kill in types
      assert :get_item in types
      assert :go_to in types
      assert :talk in types
    end
  end

  describe "register/1" do
    test "registers a valid custom handler" do
      # Unregister first in case of previous test runs
      ObjectiveRegistry.unregister(:escort)

      assert :ok = ObjectiveRegistry.register(TestEscortHandler)
      assert {:ok, TestEscortHandler} = ObjectiveRegistry.get(:escort)
    end

    test "returns error for invalid handler" do
      assert {:error, :invalid_handler} = ObjectiveRegistry.register(InvalidHandler)
    end

    test "returns error for non-module" do
      assert {:error, :invalid_handler} = ObjectiveRegistry.register(:not_a_module)
    end
  end

  describe "unregister/1" do
    test "removes a registered handler" do
      # First register it
      ObjectiveRegistry.register(TestEscortHandler)
      assert ObjectiveRegistry.registered?(:escort)

      # Then unregister
      assert :ok = ObjectiveRegistry.unregister(:escort)
      refute ObjectiveRegistry.registered?(:escort)
    end
  end

  describe "get/1" do
    test "returns handler for registered type" do
      assert {:ok, KillHandler} = ObjectiveRegistry.get(:kill)
      assert {:ok, GetItemHandler} = ObjectiveRegistry.get(:get_item)
      assert {:ok, GoToHandler} = ObjectiveRegistry.get(:go_to)
      assert {:ok, TalkHandler} = ObjectiveRegistry.get(:talk)
    end

    test "returns error for unregistered type" do
      assert {:error, :not_found} = ObjectiveRegistry.get(:nonexistent)
    end
  end

  describe "get!/1" do
    test "returns handler for registered type" do
      assert KillHandler = ObjectiveRegistry.get!(:kill)
    end

    test "raises for unregistered type" do
      assert_raise RuntimeError, ~r/No handler registered/, fn ->
        ObjectiveRegistry.get!(:nonexistent)
      end
    end
  end

  describe "list_types/0" do
    test "returns all registered types" do
      types = ObjectiveRegistry.list_types()

      assert is_list(types)
      assert length(types) >= 4
      assert :kill in types
    end
  end

  describe "list_handlers/0" do
    test "returns type-handler pairs" do
      handlers = ObjectiveRegistry.list_handlers()

      assert is_list(handlers)
      assert {:kill, KillHandler} in handlers
      assert {:get_item, GetItemHandler} in handlers
    end
  end

  describe "registered?/1" do
    test "returns true for registered type" do
      assert ObjectiveRegistry.registered?(:kill)
    end

    test "returns false for unregistered type" do
      refute ObjectiveRegistry.registered?(:nonexistent)
    end
  end

  describe "check_event/3" do
    test "returns match info for matching kill event" do
      obj_def = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "goblin", count: 1}

      result = ObjectiveRegistry.check_event(obj_def, event, 2)

      assert {:ok, KillHandler, 3, false} = result
    end

    test "returns match info when kill objective completes" do
      obj_def = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "goblin", count: 1}

      result = ObjectiveRegistry.check_event(obj_def, event, 4)

      assert {:ok, KillHandler, 5, true} = result
    end

    test "returns :no_match for non-matching event" do
      obj_def = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "orc", count: 1}

      assert :no_match = ObjectiveRegistry.check_event(obj_def, event, 0)
    end

    test "returns error for unknown type" do
      obj_def = %{type: :unknown_type, target_id: "test"}
      event = %{type: :unknown_type, target_id: "test"}

      assert {:error, :unknown_type} = ObjectiveRegistry.check_event(obj_def, event, 0)
    end

    test "handles go_to objectives" do
      obj_def = %{type: :go_to, target_id: "temple"}
      event = %{type: :go_to, target_id: "temple"}

      result = ObjectiveRegistry.check_event(obj_def, event, 0)

      assert {:ok, GoToHandler, 1, true} = result
    end

    test "handles get_item objectives" do
      obj_def = %{type: :get_item, target_id: "sword"}
      event = %{type: :get_item, target_id: "sword"}

      result = ObjectiveRegistry.check_event(obj_def, event, 0)

      assert {:ok, GetItemHandler, 1, true} = result
    end

    test "handles talk objectives with topic" do
      obj_def = %{type: :talk, target_id: "npc", dialogue_topic: "greeting"}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "greeting"}

      result = ObjectiveRegistry.check_event(obj_def, event, 0)

      assert {:ok, TalkHandler, 1, true} = result
    end

    test "talk objective with topic doesn't match different topic" do
      obj_def = %{type: :talk, target_id: "npc", dialogue_topic: "greeting"}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "farewell"}

      assert :no_match = ObjectiveRegistry.check_event(obj_def, event, 0)
    end
  end

  describe "validate_objective/1" do
    test "validates kill objective" do
      valid = %{type: :kill, target_id: "goblin", target_count: 5}
      assert :ok = ObjectiveRegistry.validate_objective(valid)

      invalid = %{type: :kill, target_id: nil}
      assert {:error, _} = ObjectiveRegistry.validate_objective(invalid)
    end

    test "validates get_item objective" do
      valid = %{type: :get_item, target_id: "sword"}
      assert :ok = ObjectiveRegistry.validate_objective(valid)

      invalid = %{type: :get_item, target_id: ""}
      assert {:error, _} = ObjectiveRegistry.validate_objective(invalid)
    end

    test "validates go_to objective" do
      valid = %{type: :go_to, target_id: "temple"}
      assert :ok = ObjectiveRegistry.validate_objective(valid)

      invalid = %{type: :go_to}
      assert {:error, _} = ObjectiveRegistry.validate_objective(invalid)
    end

    test "validates talk objective" do
      valid = %{type: :talk, target_id: "npc"}
      assert :ok = ObjectiveRegistry.validate_objective(valid)

      invalid = %{type: :talk, target_id: nil}
      assert {:error, _} = ObjectiveRegistry.validate_objective(invalid)
    end

    test "returns error for unknown type" do
      obj = %{type: :unknown, target_id: "test"}

      assert {:error, "Unknown objective type: unknown"} =
               ObjectiveRegistry.validate_objective(obj)
    end
  end

  describe "describe_objective/2" do
    test "returns description for kill objective with progress" do
      obj_def = %{
        type: :kill,
        target_id: "goblin",
        target_count: 5,
        description: "Defeat goblins"
      }

      desc = ObjectiveRegistry.describe_objective(obj_def, 3)

      assert desc == "Defeat goblins (3/5)"
    end

    test "returns description for go_to objective" do
      obj_def = %{type: :go_to, target_id: "temple", description: "Visit the temple"}

      desc = ObjectiveRegistry.describe_objective(obj_def, 0)

      assert desc == "Visit the temple"
    end
  end
end
