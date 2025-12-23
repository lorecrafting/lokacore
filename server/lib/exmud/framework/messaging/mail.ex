defmodule Exmud.Framework.Messaging.Mail do
  @moduledoc """
  In-game mail and messaging system.

  Allows players to:
  - Send messages to other players
  - Attach items to mail
  - Receive notifications of new mail
  - Maintain inbox/sent/archived folders

  ## Mail Message Structure

      %{
        id: "mail_abc123",
        from: "player_id",
        from_name: "Sir Knight",
        to: "recipient_id",
        subject: "Greetings",
        body: "Hello friend...",
        attachments: ["item_123"],
        sent_at: timestamp,
        read: false,
        archived: false,
        expires_at: timestamp | nil
      }

  ## Usage

      alias Exmud.Framework.Messaging.Mail

      # Send mail
      {:ok, mail_id} = Mail.send(from_state, to_id, "Subject", "Body")

      # Send with attachment
      {:ok, mail_id} = Mail.send(from_state, to_id, "Gift!", "Here's a gift", ["sword_01"])

      # Check inbox
      messages = Mail.get_inbox(game_state)

      # Read message
      {:ok, message, state} = Mail.read(game_state, mail_id)

      # Collect attachments
      {:ok, items, state} = Mail.collect_attachments(game_state, mail_id)
  """

  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @max_inbox_size 100
  @mail_expiry_days 30

  # =============================================================================
  # Sending Mail
  # =============================================================================

  @doc """
  Sends a mail message to another player.
  """
  def send(%GameState{player_id: from_id} = _from_state, to_id, subject, body, attachments \\ []) do
    mail = %{
      id: generate_mail_id(),
      from: from_id,
      from_name: "Player",  # Would look up actual name
      to: to_id,
      subject: subject,
      body: body,
      attachments: attachments,
      sent_at: System.system_time(:second),
      read: false,
      archived: false,
      expires_at: calculate_expiry()
    }

    # In a real implementation, this would persist to database
    # and notify the recipient
    {:ok, mail.id, mail}
  end

  @doc """
  Sends a system mail (from NPCs, quests, etc.)
  """
  def send_system(to_id, subject, body, attachments \\ []) do
    mail = %{
      id: generate_mail_id(),
      from: "system",
      from_name: "System",
      to: to_id,
      subject: subject,
      body: body,
      attachments: attachments,
      sent_at: System.system_time(:second),
      read: false,
      archived: false,
      expires_at: calculate_expiry()
    }

    {:ok, mail.id, mail}
  end

  # =============================================================================
  # Inbox Management
  # =============================================================================

  @doc """
  Gets the player's inbox (unread and recent mail).
  """
  def get_inbox(%GameState{} = game_state) do
    mailbox = get_mailbox(game_state)
    mailbox.inbox
    |> Enum.reject(& &1.archived)
    |> Enum.sort_by(& &1.sent_at, :desc)
  end

  @doc """
  Gets unread mail count.
  """
  def unread_count(%GameState{} = game_state) do
    get_inbox(game_state)
    |> Enum.count(&(not &1.read))
  end

  @doc """
  Gets sent mail.
  """
  def get_sent(%GameState{} = game_state) do
    mailbox = get_mailbox(game_state)
    mailbox.sent
    |> Enum.sort_by(& &1.sent_at, :desc)
  end

  @doc """
  Gets archived mail.
  """
  def get_archived(%GameState{} = game_state) do
    mailbox = get_mailbox(game_state)
    mailbox.inbox
    |> Enum.filter(& &1.archived)
    |> Enum.sort_by(& &1.sent_at, :desc)
  end

  # =============================================================================
  # Reading and Managing Mail
  # =============================================================================

  @doc """
  Reads a mail message, marking it as read.
  """
  def read(%GameState{} = game_state, mail_id) do
    mailbox = get_mailbox(game_state)

    case find_mail(mailbox.inbox, mail_id) do
      nil ->
        {:error, :mail_not_found}

      mail ->
        updated_mail = %{mail | read: true}
        updated_inbox = replace_mail(mailbox.inbox, mail_id, updated_mail)
        updated_mailbox = %{mailbox | inbox: updated_inbox}

        {:ok, updated_mail, put_mailbox(game_state, updated_mailbox)}
    end
  end

  @doc """
  Archives a mail message.
  """
  def archive(%GameState{} = game_state, mail_id) do
    mailbox = get_mailbox(game_state)

    case find_mail(mailbox.inbox, mail_id) do
      nil ->
        {:error, :mail_not_found}

      mail ->
        updated_mail = %{mail | archived: true}
        updated_inbox = replace_mail(mailbox.inbox, mail_id, updated_mail)
        updated_mailbox = %{mailbox | inbox: updated_inbox}

        {:ok, put_mailbox(game_state, updated_mailbox)}
    end
  end

  @doc """
  Deletes a mail message permanently.
  """
  def delete(%GameState{} = game_state, mail_id) do
    mailbox = get_mailbox(game_state)

    if find_mail(mailbox.inbox, mail_id) do
      updated_inbox = Enum.reject(mailbox.inbox, &(&1.id == mail_id))
      updated_mailbox = %{mailbox | inbox: updated_inbox}
      {:ok, put_mailbox(game_state, updated_mailbox)}
    else
      {:error, :mail_not_found}
    end
  end

  @doc """
  Collects attachments from a mail message.
  """
  def collect_attachments(%GameState{} = game_state, mail_id) do
    mailbox = get_mailbox(game_state)

    case find_mail(mailbox.inbox, mail_id) do
      nil ->
        {:error, :mail_not_found}

      %{attachments: []} ->
        {:error, :no_attachments}

      mail ->
        items = mail.attachments
        updated_mail = %{mail | attachments: []}
        updated_inbox = replace_mail(mailbox.inbox, mail_id, updated_mail)
        updated_mailbox = %{mailbox | inbox: updated_inbox}

        {:ok, items, put_mailbox(game_state, updated_mailbox)}
    end
  end

  # =============================================================================
  # Receiving Mail (called by the system)
  # =============================================================================

  @doc """
  Receives a new mail message (adds to inbox).
  """
  def receive_mail(%GameState{} = game_state, mail) do
    mailbox = get_mailbox(game_state)

    if length(mailbox.inbox) >= @max_inbox_size do
      # Remove oldest archived/read mail
      cleaned_inbox = clean_inbox(mailbox.inbox)
      updated_mailbox = %{mailbox | inbox: [mail | cleaned_inbox]}
      {:ok, put_mailbox(game_state, updated_mailbox)}
    else
      updated_mailbox = %{mailbox | inbox: [mail | mailbox.inbox]}
      {:ok, put_mailbox(game_state, updated_mailbox)}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_mailbox(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :mailbox, %{inbox: [], sent: []})
  end

  defp put_mailbox(%GameState{stats: stats} = game_state, mailbox) do
    %{game_state | stats: Map.put(stats, :mailbox, mailbox)}
  end

  defp find_mail(inbox, mail_id) do
    Enum.find(inbox, &(&1.id == mail_id))
  end

  defp replace_mail(inbox, mail_id, new_mail) do
    Enum.map(inbox, fn mail ->
      if mail.id == mail_id, do: new_mail, else: mail
    end)
  end

  defp clean_inbox(inbox) do
    inbox
    |> Enum.sort_by(fn mail ->
      # Priority: unread > read > archived, then by date
      {mail.read, mail.archived, -mail.sent_at}
    end)
    |> Enum.take(@max_inbox_size - 1)
  end

  defp generate_mail_id do
    "mail_" <> (:crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower))
  end

  defp calculate_expiry do
    System.system_time(:second) + @mail_expiry_days * 24 * 60 * 60
  end
end
