defmodule Loka.WorldBuilder.ChatTest do
  @moduledoc """
  Tests for the World Builder Chat module queue and cancel functionality.
  """
  use LokaWeb.ConnCase, async: true
  import Phoenix.LiveViewTest

  alias Loka.WorldBuilder.Chat

  # Helper to create a test LiveView socket
  defp live_socket(assigns \\ %{}) do
    # Phoenix.LiveView.Socket struct with minimal fields
    %Phoenix.LiveView.Socket{
      assigns: Map.merge(%{__changed__: %{}}, assigns),
      endpoint: LokaWeb.Endpoint,
      view: LokaWeb.AdminLive.WorldBuilderLive,
      router: LokaWeb.Router
    }
  end

  describe "init_assigns/1" do
    test "initializes all chat-related assigns" do
      socket = live_socket()
      result = Chat.init_assigns(socket)

      assert result.assigns.chat_messages == []
      assert result.assigns.chat_streaming == false
      assert result.assigns.chat_current_response == ""
      assert result.assigns.chat_error == nil
      assert result.assigns.pending_tool_results == []
      assert result.assigns.chat_queued_messages == []
      assert result.assigns.chat_current_tool == nil
    end
  end

  describe "queue_message/2" do
    test "adds message to empty queue" do
      socket = live_socket(%{chat_queued_messages: []})
      result = Chat.queue_message(socket, "Hello")

      assert result.assigns.chat_queued_messages == ["Hello"]
    end

    test "appends message to existing queue" do
      socket = live_socket(%{chat_queued_messages: ["First"]})
      result = Chat.queue_message(socket, "Second")

      assert result.assigns.chat_queued_messages == ["First", "Second"]
    end

    test "ignores empty messages" do
      socket = live_socket(%{chat_queued_messages: []})
      result = Chat.queue_message(socket, "")

      assert result.assigns.chat_queued_messages == []
    end

    test "handles nil queue gracefully" do
      socket = live_socket(%{})
      result = Chat.queue_message(socket, "Hello")

      assert result.assigns.chat_queued_messages == ["Hello"]
    end
  end

  describe "clear_queue/1" do
    test "clears the message queue" do
      socket = live_socket(%{chat_queued_messages: ["One", "Two", "Three"]})
      result = Chat.clear_queue(socket)

      assert result.assigns.chat_queued_messages == []
    end
  end

  describe "process_queue/1" do
    test "returns :done when queue is empty" do
      socket =
        live_socket(%{
          chat_queued_messages: [],
          chat_messages: [],
          chat_streaming: false,
          chat_current_response: "",
          chat_error: nil,
          current_project: nil
        })

      {status, _socket} = Chat.process_queue(socket)
      assert status == :done
    end

    test "returns :done when queue is nil" do
      socket =
        live_socket(%{
          chat_messages: [],
          chat_streaming: false,
          chat_current_response: "",
          chat_error: nil,
          current_project: nil
        })

      {status, _socket} = Chat.process_queue(socket)
      assert status == :done
    end
  end

  describe "cancel_streaming/1" do
    test "does nothing when not streaming" do
      socket =
        live_socket(%{
          chat_streaming: false,
          chat_messages: [],
          chat_current_response: ""
        })

      result = Chat.cancel_streaming(socket)
      assert result.assigns.chat_streaming == false
    end

    test "stops streaming and clears current response" do
      socket =
        live_socket(%{
          chat_streaming: true,
          chat_messages: [],
          chat_current_response: "Partial response",
          pending_tool_results: []
        })

      result = Chat.cancel_streaming(socket)

      assert result.assigns.chat_streaming == false
      assert result.assigns.chat_current_response == ""
      # Should add cancelled message
      assert length(result.assigns.chat_messages) == 1
      assert hd(result.assigns.chat_messages).content =~ "_(cancelled)_"
    end

    test "does not add message when no partial response" do
      socket =
        live_socket(%{
          chat_streaming: true,
          chat_messages: [],
          chat_current_response: "",
          pending_tool_results: []
        })

      result = Chat.cancel_streaming(socket)

      assert result.assigns.chat_messages == []
    end
  end

  describe "clear_chat/1" do
    test "resets all chat state including queue" do
      socket =
        live_socket(%{
          chat_messages: [%{role: "user", content: "Hi"}],
          chat_streaming: true,
          chat_current_response: "In progress",
          chat_error: "Some error",
          pending_tool_results: [%{id: 1}],
          chat_queued_messages: ["Queued message"]
        })

      result = Chat.clear_chat(socket)

      assert result.assigns.chat_messages == []
      assert result.assigns.chat_streaming == false
      assert result.assigns.chat_current_response == ""
      assert result.assigns.chat_error == nil
      assert result.assigns.pending_tool_results == []
      assert result.assigns.chat_queued_messages == []
    end
  end
end
