defmodule Loka.Framework.Quest.HandlersTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Quest.Handlers.{
    KillHandler,
    GetItemHandler,
    GoToHandler,
    TalkHandler
  }

  describe "KillHandler" do
    test "type/0 returns :kill" do
      assert :kill = KillHandler.type()
    end

    test "matches?/2 returns true for matching target" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "goblin", count: 1}

      assert KillHandler.matches?(obj, event)
    end

    test "matches?/2 returns false for different target" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "orc", count: 1}

      refute KillHandler.matches?(obj, event)
    end

    test "matches?/2 returns false for different event type" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :get_item, target_id: "goblin"}

      refute KillHandler.matches?(obj, event)
    end

    test "progress/3 adds count to current progress" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "goblin", count: 2}

      assert 5 = KillHandler.progress(obj, event, 3)
    end

    test "progress/3 defaults count to 1" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}
      event = %{type: :kill, target_id: "goblin"}

      assert 4 = KillHandler.progress(obj, event, 3)
    end

    test "is_complete?/2 returns true when progress >= target_count" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}

      assert KillHandler.is_complete?(obj, 5)
      assert KillHandler.is_complete?(obj, 6)
    end

    test "is_complete?/2 returns false when progress < target_count" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}

      refute KillHandler.is_complete?(obj, 4)
    end

    test "is_complete?/2 defaults target_count to 1" do
      obj = %{type: :kill, target_id: "goblin"}

      assert KillHandler.is_complete?(obj, 1)
      refute KillHandler.is_complete?(obj, 0)
    end

    test "validate/1 returns :ok for valid objective" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5}
      assert :ok = KillHandler.validate(obj)
    end

    test "validate/1 returns error for missing target_id" do
      obj = %{type: :kill, target_count: 5}
      assert {:error, _} = KillHandler.validate(obj)
    end

    test "validate/1 returns error for empty target_id" do
      obj = %{type: :kill, target_id: "", target_count: 5}
      assert {:error, _} = KillHandler.validate(obj)
    end

    test "description/2 includes progress for multi-kill" do
      obj = %{type: :kill, target_id: "goblin", target_count: 5, description: "Defeat goblins"}
      assert "Defeat goblins (3/5)" = KillHandler.description(obj, 3)
    end

    test "description/2 shows no count for single kill" do
      obj = %{type: :kill, target_id: "boss", target_count: 1, description: "Defeat the boss"}
      assert "Defeat the boss" = KillHandler.description(obj, 0)
    end

    test "handles string keys from YAML" do
      obj = %{"type" => "kill", "target_id" => "goblin", "target_count" => 5}
      event = %{type: :kill, target_id: "goblin", count: 1}

      assert KillHandler.matches?(obj, event)
      assert KillHandler.is_complete?(obj, 5)
      assert :ok = KillHandler.validate(obj)
    end
  end

  describe "GetItemHandler" do
    test "type/0 returns :get_item" do
      assert :get_item = GetItemHandler.type()
    end

    test "matches?/2 returns true for matching item" do
      obj = %{type: :get_item, target_id: "sword"}
      event = %{type: :get_item, target_id: "sword"}

      assert GetItemHandler.matches?(obj, event)
    end

    test "matches?/2 returns false for different item" do
      obj = %{type: :get_item, target_id: "sword"}
      event = %{type: :get_item, target_id: "shield"}

      refute GetItemHandler.matches?(obj, event)
    end

    test "progress/3 adds count to current progress" do
      obj = %{type: :get_item, target_id: "herb", target_count: 10}
      event = %{type: :get_item, target_id: "herb", count: 3}

      assert 5 = GetItemHandler.progress(obj, event, 2)
    end

    test "is_complete?/2 returns true when progress >= target_count" do
      obj = %{type: :get_item, target_id: "herb", target_count: 10}

      assert GetItemHandler.is_complete?(obj, 10)
    end

    test "is_complete?/2 defaults target_count to 1" do
      obj = %{type: :get_item, target_id: "sword"}

      assert GetItemHandler.is_complete?(obj, 1)
      refute GetItemHandler.is_complete?(obj, 0)
    end

    test "validate/1 returns :ok for valid objective" do
      obj = %{type: :get_item, target_id: "sword"}
      assert :ok = GetItemHandler.validate(obj)
    end

    test "validate/1 returns error for missing target_id" do
      obj = %{type: :get_item}
      assert {:error, _} = GetItemHandler.validate(obj)
    end

    test "handles string keys from YAML" do
      obj = %{"type" => "get_item", "target_id" => "sword"}
      event = %{type: :get_item, target_id: "sword"}

      assert GetItemHandler.matches?(obj, event)
      assert :ok = GetItemHandler.validate(obj)
    end
  end

  describe "GoToHandler" do
    test "type/0 returns :go_to" do
      assert :go_to = GoToHandler.type()
    end

    test "matches?/2 returns true for matching room" do
      obj = %{type: :go_to, target_id: "temple"}
      event = %{type: :go_to, target_id: "temple"}

      assert GoToHandler.matches?(obj, event)
    end

    test "matches?/2 returns false for different room" do
      obj = %{type: :go_to, target_id: "temple"}
      event = %{type: :go_to, target_id: "cave"}

      refute GoToHandler.matches?(obj, event)
    end

    test "progress/3 always returns 1 (binary completion)" do
      obj = %{type: :go_to, target_id: "temple"}
      event = %{type: :go_to, target_id: "temple"}

      # Even with existing progress, entering the room sets to 1
      assert 1 = GoToHandler.progress(obj, event, 0)
      assert 1 = GoToHandler.progress(obj, event, 5)
    end

    test "is_complete?/2 returns true when progress >= 1" do
      obj = %{type: :go_to, target_id: "temple"}

      assert GoToHandler.is_complete?(obj, 1)
      assert GoToHandler.is_complete?(obj, 10)
    end

    test "is_complete?/2 returns false when progress < 1" do
      obj = %{type: :go_to, target_id: "temple"}

      refute GoToHandler.is_complete?(obj, 0)
    end

    test "validate/1 returns :ok for valid objective" do
      obj = %{type: :go_to, target_id: "temple"}
      assert :ok = GoToHandler.validate(obj)
    end

    test "validate/1 returns error for missing target_id" do
      obj = %{type: :go_to}
      assert {:error, _} = GoToHandler.validate(obj)
    end

    test "description/2 does not show progress" do
      obj = %{type: :go_to, target_id: "temple", description: "Visit the temple"}
      assert "Visit the temple" = GoToHandler.description(obj, 0)
      assert "Visit the temple" = GoToHandler.description(obj, 1)
    end

    test "handles string keys from YAML" do
      obj = %{"type" => "go_to", "target_id" => "temple"}
      event = %{type: :go_to, target_id: "temple"}

      assert GoToHandler.matches?(obj, event)
      assert :ok = GoToHandler.validate(obj)
    end
  end

  describe "TalkHandler" do
    test "type/0 returns :talk" do
      assert :talk = TalkHandler.type()
    end

    test "matches?/2 returns true for matching NPC without topic" do
      obj = %{type: :talk, target_id: "npc"}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "greeting"}

      assert TalkHandler.matches?(obj, event)
    end

    test "matches?/2 returns true for matching NPC with matching topic" do
      obj = %{type: :talk, target_id: "npc", dialogue_topic: "quest_start"}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "quest_start"}

      assert TalkHandler.matches?(obj, event)
    end

    test "matches?/2 returns false for matching NPC with different topic" do
      obj = %{type: :talk, target_id: "npc", dialogue_topic: "quest_start"}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "greeting"}

      refute TalkHandler.matches?(obj, event)
    end

    test "matches?/2 returns false for different NPC" do
      obj = %{type: :talk, target_id: "npc_a"}
      event = %{type: :talk, target_id: "npc_b"}

      refute TalkHandler.matches?(obj, event)
    end

    test "matches?/2 handles nil topic in objective as wildcard" do
      obj = %{type: :talk, target_id: "npc", dialogue_topic: nil}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "any_topic"}

      assert TalkHandler.matches?(obj, event)
    end

    test "matches?/2 handles empty string topic as wildcard" do
      obj = %{type: :talk, target_id: "npc", dialogue_topic: ""}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "any_topic"}

      assert TalkHandler.matches?(obj, event)
    end

    test "progress/3 always returns 1 (binary completion)" do
      obj = %{type: :talk, target_id: "npc"}
      event = %{type: :talk, target_id: "npc"}

      assert 1 = TalkHandler.progress(obj, event, 0)
    end

    test "is_complete?/2 returns true when progress >= 1" do
      obj = %{type: :talk, target_id: "npc"}

      assert TalkHandler.is_complete?(obj, 1)
    end

    test "is_complete?/2 returns false when progress < 1" do
      obj = %{type: :talk, target_id: "npc"}

      refute TalkHandler.is_complete?(obj, 0)
    end

    test "validate/1 returns :ok for valid objective" do
      obj = %{type: :talk, target_id: "npc"}
      assert :ok = TalkHandler.validate(obj)

      obj_with_topic = %{type: :talk, target_id: "npc", dialogue_topic: "quest"}
      assert :ok = TalkHandler.validate(obj_with_topic)
    end

    test "validate/1 returns error for missing target_id" do
      obj = %{type: :talk, dialogue_topic: "quest"}
      assert {:error, _} = TalkHandler.validate(obj)
    end

    test "description/2 does not show progress" do
      obj = %{type: :talk, target_id: "npc", description: "Speak with the NPC"}
      assert "Speak with the NPC" = TalkHandler.description(obj, 0)
    end

    test "handles string keys from YAML" do
      obj = %{"type" => "talk", "target_id" => "npc", "dialogue_topic" => "quest"}
      event = %{type: :talk, target_id: "npc", dialogue_topic: "quest"}

      assert TalkHandler.matches?(obj, event)
      assert :ok = TalkHandler.validate(obj)
    end
  end
end
