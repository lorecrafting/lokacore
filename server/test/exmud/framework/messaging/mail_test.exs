defmodule Exmud.Framework.Messaging.MailTest do
  use ExUnit.Case

  alias Exmud.Framework.Messaging.Mail
  alias Exmud.Framework.Player.GameState

  setup do
    # Create a test GameState
    game_state = %GameState{
      player_id: "test_player",
      stats: %{},
      inventory: [],
      equipment: %{},
      quests: %{},
      flags: %{},
      health: %{current: 100, max: 100},
      current_room_id: nil
    }

    %{game_state: game_state}
  end

  describe "send/5" do
    test "sends mail with basic fields", %{game_state: game_state} do
      {:ok, mail_id, mail} = Mail.send(game_state, "recipient_123", "Test Subject", "Test Body")

      assert is_binary(mail_id)
      assert mail.id == mail_id
      assert mail.from == "test_player"
      assert mail.to == "recipient_123"
      assert mail.subject == "Test Subject"
      assert mail.body == "Test Body"
      assert mail.read == false
      assert mail.archived == false
    end

    test "sends mail with attachments", %{game_state: game_state} do
      {:ok, _mail_id, mail} =
        Mail.send(game_state, "recipient_123", "Gift", "Here's a gift", ["sword_01", "potion_02"])

      assert mail.attachments == ["sword_01", "potion_02"]
    end

    test "sends mail without attachments", %{game_state: game_state} do
      {:ok, _mail_id, mail} = Mail.send(game_state, "recipient_123", "Hello", "Hi there")

      assert mail.attachments == []
    end

    test "sets sent_at timestamp", %{game_state: game_state} do
      before = System.system_time(:second)
      {:ok, _mail_id, mail} = Mail.send(game_state, "recipient_123", "Subject", "Body")
      after_time = System.system_time(:second)

      assert mail.sent_at >= before
      assert mail.sent_at <= after_time
    end

    test "sets expiry timestamp", %{game_state: game_state} do
      {:ok, _mail_id, mail} = Mail.send(game_state, "recipient_123", "Subject", "Body")

      assert is_integer(mail.expires_at)
      assert mail.expires_at > mail.sent_at
    end

    test "generates unique mail IDs", %{game_state: game_state} do
      {:ok, id1, _mail1} = Mail.send(game_state, "recipient_123", "Subject 1", "Body 1")
      {:ok, id2, _mail2} = Mail.send(game_state, "recipient_123", "Subject 2", "Body 2")

      assert id1 != id2
    end
  end

  describe "send_system/4" do
    test "sends system mail", %{} do
      {:ok, mail_id, mail} =
        Mail.send_system("recipient_123", "System Notice", "This is a system message")

      assert is_binary(mail_id)
      assert mail.from == "system"
      assert mail.from_name == "System"
      assert mail.to == "recipient_123"
      assert mail.subject == "System Notice"
      assert mail.body == "This is a system message"
      assert mail.read == false
    end

    test "sends system mail with attachments", %{} do
      {:ok, _mail_id, mail} =
        Mail.send_system("recipient_123", "Quest Reward", "Congrats!", ["gold_coin"])

      assert mail.attachments == ["gold_coin"]
    end

    test "sends system mail without attachments", %{} do
      {:ok, _mail_id, mail} = Mail.send_system("recipient_123", "Notice", "Message")

      assert mail.attachments == []
    end
  end

  describe "get_inbox/1" do
    test "returns empty inbox for new player", %{game_state: game_state} do
      inbox = Mail.get_inbox(game_state)

      assert inbox == []
    end

    test "returns inbox messages sorted by date", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      mail2 = %{id: "mail_2", sent_at: 200, read: false, archived: false}
      mail3 = %{id: "mail_3", sent_at: 150, read: false, archived: false}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1, mail2, mail3], sent: []}}}

      inbox = Mail.get_inbox(game_state)

      assert length(inbox) == 3
      # Should be sorted newest first
      assert Enum.at(inbox, 0).id == "mail_2"
      assert Enum.at(inbox, 1).id == "mail_3"
      assert Enum.at(inbox, 2).id == "mail_1"
    end

    test "excludes archived messages", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      mail2 = %{id: "mail_2", sent_at: 200, read: false, archived: true}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1, mail2], sent: []}}}

      inbox = Mail.get_inbox(game_state)

      assert length(inbox) == 1
      assert hd(inbox).id == "mail_1"
    end
  end

  describe "unread_count/1" do
    test "returns 0 for empty inbox", %{game_state: game_state} do
      assert Mail.unread_count(game_state) == 0
    end

    test "counts only unread messages", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      mail2 = %{id: "mail_2", sent_at: 200, read: true, archived: false}
      mail3 = %{id: "mail_3", sent_at: 150, read: false, archived: false}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1, mail2, mail3], sent: []}}}

      assert Mail.unread_count(game_state) == 2
    end

    test "excludes archived messages from count", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, read: false, archived: true}
      mail2 = %{id: "mail_2", sent_at: 200, read: false, archived: false}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1, mail2], sent: []}}}

      assert Mail.unread_count(game_state) == 1
    end
  end

  describe "get_sent/1" do
    test "returns empty list for new player", %{game_state: game_state} do
      assert Mail.get_sent(game_state) == []
    end

    test "returns sent messages sorted by date", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100}
      mail2 = %{id: "mail_2", sent_at: 200}
      mail3 = %{id: "mail_3", sent_at: 150}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [], sent: [mail1, mail2, mail3]}}}

      sent = Mail.get_sent(game_state)

      assert length(sent) == 3
      assert Enum.at(sent, 0).id == "mail_2"
      assert Enum.at(sent, 1).id == "mail_3"
      assert Enum.at(sent, 2).id == "mail_1"
    end
  end

  describe "get_archived/1" do
    test "returns only archived messages", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, archived: false}
      mail2 = %{id: "mail_2", sent_at: 200, archived: true}
      mail3 = %{id: "mail_3", sent_at: 150, archived: true}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1, mail2, mail3], sent: []}}}

      archived = Mail.get_archived(game_state)

      assert length(archived) == 2
      ids = Enum.map(archived, & &1.id)
      assert "mail_2" in ids
      assert "mail_3" in ids
      refute "mail_1" in ids
    end

    test "returns empty list when no archived messages", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, archived: false}

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1], sent: []}}}

      assert Mail.get_archived(game_state) == []
    end
  end

  describe "read/2" do
    test "marks mail as read", %{game_state: game_state} do
      mail = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail], sent: []}}}

      {:ok, updated_mail, updated_state} = Mail.read(game_state, "mail_1")

      assert updated_mail.read == true
      assert updated_mail.id == "mail_1"

      # Verify in state
      inbox = Mail.get_inbox(updated_state)
      assert hd(inbox).read == true
    end

    test "returns error for non-existent mail", %{game_state: game_state} do
      assert {:error, :mail_not_found} = Mail.read(game_state, "fake_id")
    end

    test "preserves other mail properties", %{game_state: game_state} do
      mail = %{id: "mail_1", sent_at: 100, read: false, archived: false, subject: "Test"}
      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail], sent: []}}}

      {:ok, updated_mail, _updated_state} = Mail.read(game_state, "mail_1")

      assert updated_mail.subject == "Test"
      assert updated_mail.sent_at == 100
    end
  end

  describe "archive/2" do
    test "archives a mail message", %{game_state: game_state} do
      mail = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail], sent: []}}}

      {:ok, updated_state} = Mail.archive(game_state, "mail_1")

      # Should no longer appear in regular inbox
      inbox = Mail.get_inbox(updated_state)
      assert inbox == []

      # Should appear in archived
      archived = Mail.get_archived(updated_state)
      assert length(archived) == 1
      assert hd(archived).archived == true
    end

    test "returns error for non-existent mail", %{game_state: game_state} do
      assert {:error, :mail_not_found} = Mail.archive(game_state, "fake_id")
    end
  end

  describe "delete/2" do
    test "deletes a mail message", %{game_state: game_state} do
      mail1 = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      mail2 = %{id: "mail_2", sent_at: 200, read: false, archived: false}
      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail1, mail2], sent: []}}}

      {:ok, updated_state} = Mail.delete(game_state, "mail_1")

      inbox = Mail.get_inbox(updated_state)
      assert length(inbox) == 1
      assert hd(inbox).id == "mail_2"
    end

    test "returns error for non-existent mail", %{game_state: game_state} do
      assert {:error, :mail_not_found} = Mail.delete(game_state, "fake_id")
    end
  end

  describe "collect_attachments/2" do
    test "collects attachments and removes them from mail", %{game_state: game_state} do
      mail = %{
        id: "mail_1",
        sent_at: 100,
        read: false,
        archived: false,
        attachments: ["sword", "potion"]
      }

      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail], sent: []}}}

      {:ok, items, updated_state} = Mail.collect_attachments(game_state, "mail_1")

      assert items == ["sword", "potion"]

      # Mail should have no attachments now
      mailbox = updated_state.stats.mailbox
      updated_mail = hd(mailbox.inbox)
      assert updated_mail.attachments == []
    end

    test "returns error for mail with no attachments", %{game_state: game_state} do
      mail = %{id: "mail_1", sent_at: 100, read: false, archived: false, attachments: []}
      game_state = %{game_state | stats: %{mailbox: %{inbox: [mail], sent: []}}}

      assert {:error, :no_attachments} = Mail.collect_attachments(game_state, "mail_1")
    end

    test "returns error for non-existent mail", %{game_state: game_state} do
      assert {:error, :mail_not_found} = Mail.collect_attachments(game_state, "fake_id")
    end
  end

  describe "receive_mail/2" do
    test "adds mail to inbox", %{game_state: game_state} do
      mail = %{id: "mail_1", sent_at: 100, read: false, archived: false}

      {:ok, updated_state} = Mail.receive_mail(game_state, mail)

      inbox = Mail.get_inbox(updated_state)
      assert length(inbox) == 1
      assert hd(inbox).id == "mail_1"
    end

    test "adds to existing inbox", %{game_state: game_state} do
      existing_mail = %{id: "mail_1", sent_at: 100, read: false, archived: false}
      game_state = %{game_state | stats: %{mailbox: %{inbox: [existing_mail], sent: []}}}

      new_mail = %{id: "mail_2", sent_at: 200, read: false, archived: false}
      {:ok, updated_state} = Mail.receive_mail(game_state, new_mail)

      inbox = Mail.get_inbox(updated_state)
      assert length(inbox) == 2
    end

    test "cleans inbox when at max size", %{game_state: game_state} do
      # Create 100 old archived/read messages (max inbox size)
      old_mails =
        Enum.map(1..100, fn i ->
          %{id: "old_#{i}", sent_at: i, read: true, archived: true}
        end)

      game_state = %{game_state | stats: %{mailbox: %{inbox: old_mails, sent: []}}}

      new_mail = %{id: "new_mail", sent_at: 200, read: false, archived: false}
      {:ok, updated_state} = Mail.receive_mail(game_state, new_mail)

      # Should still be at max size
      mailbox = updated_state.stats.mailbox
      assert length(mailbox.inbox) == 100

      # New mail should be in inbox
      assert Enum.any?(mailbox.inbox, &(&1.id == "new_mail"))
    end

    test "prioritizes unread messages when cleaning", %{game_state: game_state} do
      # Create inbox at capacity with mix of read/unread
      unread_mail = %{id: "unread", sent_at: 50, read: false, archived: false}

      read_mails =
        Enum.map(1..99, fn i ->
          %{id: "read_#{i}", sent_at: i, read: true, archived: false}
        end)

      all_mails = [unread_mail | read_mails]
      game_state = %{game_state | stats: %{mailbox: %{inbox: all_mails, sent: []}}}

      new_mail = %{id: "new_mail", sent_at: 200, read: false, archived: false}
      {:ok, updated_state} = Mail.receive_mail(game_state, new_mail)

      mailbox = updated_state.stats.mailbox

      # Unread message should still be there
      assert Enum.any?(mailbox.inbox, &(&1.id == "unread"))
      # New mail should be there
      assert Enum.any?(mailbox.inbox, &(&1.id == "new_mail"))
    end
  end
end
