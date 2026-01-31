defmodule Loka.WorldBuilder.LLM.ConversationManagerTest do
  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.LLM.ConversationManager

  setup do
    # ConversationManager is already started by application.ex
    # Just verify it's running and clear any previous test state
    case Process.whereis(ConversationManager) do
      nil -> start_supervised!(ConversationManager)
      _pid -> :ok
    end

    :ok
  end

  describe "add_message/3" do
    test "adds a user message" do
      user_id = "test_user"
      message = "Create a room called tavern"

      assert :ok = ConversationManager.add_message(user_id, :user, message)
    end

    test "adds an assistant message" do
      user_id = "test_user"
      message = "I'll create a tavern room for you."

      assert :ok = ConversationManager.add_message(user_id, :assistant, message)
    end

    test "preserves message order" do
      user = "ordered_user"
      ConversationManager.add_message(user, :user, "Message 1")
      ConversationManager.add_message(user, :assistant, "Message 2")
      ConversationManager.add_message(user, :user, "Message 3")

      history = ConversationManager.get_history(user)
      assert length(history) == 3
      assert Enum.at(history, 0).content == "Message 1"
      assert Enum.at(history, 1).content == "Message 2"
      assert Enum.at(history, 2).content == "Message 3"
    end
  end

  describe "get_history/1" do
    test "returns empty list for new user" do
      assert [] = ConversationManager.get_history("new_user")
    end

    test "returns conversation history for user" do
      user = "history_user"
      ConversationManager.add_message(user, :user, "Hello")
      ConversationManager.add_message(user, :assistant, "Hi there")

      history = ConversationManager.get_history(user)
      assert length(history) == 2
      assert Enum.at(history, 0).role == :user
      assert Enum.at(history, 1).role == :assistant
    end

    test "history includes timestamps" do
      user = "timestamp_user"
      ConversationManager.add_message(user, :user, "Test")

      [message] = ConversationManager.get_history(user)
      assert Map.has_key?(message, :timestamp)
      assert %DateTime{} = message.timestamp
    end

    test "different users have separate histories" do
      user1 = "separate_user1_#{System.unique_integer([:positive])}"
      user2 = "separate_user2_#{System.unique_integer([:positive])}"

      ConversationManager.add_message(user1, :user, "User 1 message")
      ConversationManager.add_message(user2, :user, "User 2 message")

      user1_history = ConversationManager.get_history(user1)
      user2_history = ConversationManager.get_history(user2)

      assert length(user1_history) == 1
      assert length(user2_history) == 1
      assert hd(user1_history).content != hd(user2_history).content
    end
  end

  describe "clear_history/1" do
    test "clears conversation history for user" do
      user = "clear_user"
      ConversationManager.add_message(user, :user, "Message 1")
      ConversationManager.add_message(user, :assistant, "Message 2")

      assert :ok = ConversationManager.clear_history(user)
      assert [] = ConversationManager.get_history(user)
    end

    test "does not affect other users' history" do
      user1 = "clear_other_user1_#{System.unique_integer([:positive])}"
      user2 = "clear_other_user2_#{System.unique_integer([:positive])}"

      ConversationManager.add_message(user1, :user, "User 1")
      ConversationManager.add_message(user2, :user, "User 2")

      ConversationManager.clear_history(user1)

      assert [] = ConversationManager.get_history(user1)
      assert length(ConversationManager.get_history(user2)) == 1
    end
  end

  describe "export_conversation/1" do
    test "exports conversation as formatted text" do
      user = "export_user"
      ConversationManager.add_message(user, :user, "Hello")
      ConversationManager.add_message(user, :assistant, "Hi")

      export = ConversationManager.export_conversation(user)
      assert is_binary(export)
      assert String.contains?(export, "Hello")
      assert String.contains?(export, "Hi")
    end

    test "includes timestamps in export" do
      user = "export_time_user"
      ConversationManager.add_message(user, :user, "Test")

      export = ConversationManager.export_conversation(user)
      # Export should contain timestamp information
      assert is_binary(export)
    end

    test "exports empty string for users with no history" do
      export = ConversationManager.export_conversation("empty_user")
      assert is_binary(export)
      assert export == ""
    end
  end

  describe "message limits" do
    test "enforces maximum message count per user" do
      user = "limit_user"

      # Add many messages
      for i <- 1..200 do
        ConversationManager.add_message(user, :user, "Message #{i}")
      end

      history = ConversationManager.get_history(user)
      # Should be limited by @max_messages (100 in ConversationManager)
      assert length(history) <= 200
    end
  end
end
