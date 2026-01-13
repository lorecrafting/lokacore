defmodule Loka.WorldBuilder.LLM.ConversationManager do
  @moduledoc """
  Manages multi-turn conversation history for LLM sessions.

  Preserves context across exchanges for iterative refinement.

  ## Memory Management

  Conversations are automatically cleaned up:
  - After 60 minutes of inactivity
  - Maximum 5 message pairs per conversation
  - Cleanup runs every 10 minutes
  """

  use GenServer
  require Logger

  @max_history 5
  @idle_ttl_minutes 60
  @cleanup_interval_minutes 10

  # Client API

  @doc """
  Starts the ConversationManager GenServer.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Adds a message to a user's conversation history.

  ## Parameters

    * `user_id` - ID of the user
    * `role` - Message role (:user or :assistant)
    * `content` - Message content

  ## Returns

    * `:ok` - Message added successfully
  """
  @spec add_message(term(), atom(), String.t()) :: :ok
  def add_message(user_id, role, content) do
    GenServer.call(__MODULE__, {:add_message, user_id, role, content})
  end

  @doc """
  Gets conversation history for a user.

  ## Parameters

    * `user_id` - ID of the user
    * `limit` - Maximum number of message pairs to return (default: #{@max_history})

  ## Returns

  List of message maps with keys: :role, :content, :timestamp
  Messages are returned in chronological order (oldest first).
  """
  @spec get_history(term(), non_neg_integer()) :: [map()]
  def get_history(user_id, limit \\ @max_history) do
    GenServer.call(__MODULE__, {:get_history, user_id, limit})
  end

  @doc """
  Clears all conversation history for a user.
  """
  @spec clear_history(term()) :: :ok
  def clear_history(user_id) do
    GenServer.call(__MODULE__, {:clear_history, user_id})
  end

  @doc """
  Exports conversation as formatted text.

  ## Returns

  String with timestamp, role, and content for each message.
  """
  @spec export_conversation(term()) :: String.t()
  def export_conversation(user_id) do
    GenServer.call(__MODULE__, {:export_conversation, user_id})
  end

  @doc """
  Formats conversation history for Claude API messages format.

  ## Returns

  List of maps with :role and :content keys, suitable for Claude API.
  """
  @spec format_for_api(term()) :: [map()]
  def format_for_api(user_id) do
    get_history(user_id)
    |> Enum.map(fn msg ->
      %{role: msg.role, content: msg.content}
    end)
  end

  # Server Callbacks

  @impl true
  def init(_opts) do
    schedule_cleanup()
    {:ok, %{conversations: %{}}}
  end

  @impl true
  def handle_call({:add_message, user_id, role, content}, _from, state) do
    message = %{
      role: role,
      content: content,
      timestamp: DateTime.utc_now()
    }

    conversation = Map.get(state.conversations, user_id, %{messages: [], last_activity: nil})

    updated_messages =
      [message | conversation.messages]
      |> Enum.take(@max_history * 2)

    updated_conversation = %{
      messages: updated_messages,
      last_activity: DateTime.utc_now()
    }

    new_conversations = Map.put(state.conversations, user_id, updated_conversation)
    {:reply, :ok, %{state | conversations: new_conversations}}
  end

  @impl true
  def handle_call({:get_history, user_id, limit}, _from, state) do
    messages =
      case Map.get(state.conversations, user_id) do
        nil ->
          []

        conversation ->
          conversation.messages
          |> Enum.take(limit * 2)
          |> Enum.reverse()
      end

    {:reply, messages, state}
  end

  @impl true
  def handle_call({:clear_history, user_id}, _from, state) do
    new_conversations = Map.delete(state.conversations, user_id)
    {:reply, :ok, %{state | conversations: new_conversations}}
  end

  @impl true
  def handle_call({:export_conversation, user_id}, _from, state) do
    text =
      case Map.get(state.conversations, user_id) do
        nil ->
          ""

        conversation ->
          conversation.messages
          |> Enum.reverse()
          |> Enum.map(fn msg ->
            timestamp = Calendar.strftime(msg.timestamp, "%Y-%m-%d %H:%M:%S")
            "#{timestamp} [#{msg.role}]: #{msg.content}"
          end)
          |> Enum.join("\n\n")
      end

    {:reply, text, state}
  end

  @impl true
  def handle_info(:cleanup_idle_conversations, state) do
    cutoff = DateTime.add(DateTime.utc_now(), -@idle_ttl_minutes, :minute)

    new_conversations =
      state.conversations
      |> Enum.reject(fn {_user_id, conversation} ->
        # Remove conversations that have been idle longer than TTL
        case conversation.last_activity do
          nil -> true
          last_activity -> DateTime.compare(last_activity, cutoff) == :lt
        end
      end)
      |> Map.new()

    removed_count = map_size(state.conversations) - map_size(new_conversations)

    if removed_count > 0 do
      Logger.info(
        "[ConversationManager] Cleaned up #{removed_count} idle conversations (#{map_size(new_conversations)} remaining)"
      )
    end

    schedule_cleanup()
    {:noreply, %{state | conversations: new_conversations}}
  end

  # Private Helpers

  defp schedule_cleanup do
    Process.send_after(
      self(),
      :cleanup_idle_conversations,
      :timer.minutes(@cleanup_interval_minutes)
    )
  end
end
