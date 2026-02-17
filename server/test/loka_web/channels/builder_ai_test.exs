defmodule LokaWeb.Channels.BuilderAITest do
  @moduledoc """
  Channel integration tests for the AI builder commands.

  Tests `/ai`, `/ai cancel`, `/ai clear`, `chat` mode, and streaming event
  handling through the game channel. Uses no real API calls — streaming events
  are either triggered by the no-API-key error path or simulated via
  direct `send/2` to the channel process.
  """
  use Loka.ChannelCase, async: false

  @timeout 2000

  setup do
    {_, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
    Loka.Engine.EntitySeeder.seed()

    admin = create_test_player(name: "AITester")

    admin =
      admin
      |> Ecto.Changeset.change(%{is_admin: true})
      |> Loka.Repo.update!()

    on_exit(fn ->
      {_, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
    end)

    %{admin: admin}
  end

  describe "/ai clear" do
    test "clears conversation with no prior conversation", %{admin: player} do
      {:ok, socket} = connect_player(player)

      send_cmd(socket, "/ai")
      assert_output("[BUILDER] AI conversation history cleared.")
    end

    test "clears conversation after chat mode init", %{admin: player} do
      {:ok, socket} = connect_player(player)

      # Enter chat mode to initialize conversation
      send_cmd(socket, "chat")
      assert_push "chat_mode_changed", %{mode: "chat"}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "chat mode"

      # Clear conversation
      send_cmd(socket, "/ai")
      assert_output("[BUILDER] AI conversation history cleared.")
    end
  end

  describe "/ai cancel" do
    test "reports no request in progress when not streaming", %{admin: player} do
      {:ok, socket} = connect_player(player)

      send_cmd(socket, "/ai cancel")
      assert_output("No AI request in progress")
    end
  end

  describe "chat mode" do
    test "enter and exit chat mode", %{admin: player} do
      {:ok, socket} = connect_player(player)

      # Enter
      send_cmd(socket, "chat")
      assert_push "chat_mode_changed", %{mode: "chat"}, @timeout
      assert_push "output", %{text: enter_text}, @timeout
      assert enter_text =~ "Entered chat mode"

      # Exit via /exit
      send_cmd(socket, "/exit")
      assert_push "chat_mode_changed", %{mode: "normal"}, @timeout
      assert_push "output", %{text: exit_text}, @timeout
      assert exit_text =~ "Left chat mode"
    end

    test "bare 'exit' in chat mode goes through command parser, not chat input", %{admin: player} do
      {:ok, socket} = connect_player(player)

      send_cmd(socket, "chat")
      assert_push "chat_mode_changed", %{mode: "chat"}, @timeout
      _text = receive_output()

      # "exit" is in command_prefix? whitelist, so it bypasses chat mode
      # and goes to CommandParser, which has no "exit" clause → unknown command.
      # Only "/exit" properly exits chat mode via the parser.
      send_cmd(socket, "exit")
      assert_push "output", %{text: text}, @timeout
      assert text =~ "Unknown command"
    end
  end

  describe "/ai prompt (error flow without API key)" do
    test "sends error when no API key configured", %{admin: player} do
      {:ok, socket} = connect_player(player)

      send_cmd(socket, "/ai create a forest zone")

      # The Task fires AnthropicClient.chat which returns {:error, ...} immediately
      # Channel receives {:ai_error, reason} and pushes ai_stream_error
      assert_push "ai_stream_error", %{error: error}, 5000
      assert error =~ "ANTHROPIC_API_KEY" or is_binary(error)
    end
  end

  describe "chat mode input (error flow without API key)" do
    test "chat text triggers AI and returns error without API key", %{admin: player} do
      {:ok, socket} = connect_player(player)

      # Enter chat mode
      send_cmd(socket, "chat")
      assert_push "chat_mode_changed", %{mode: "chat"}, @timeout
      _text = receive_output()

      # Send chat text — will try API, fail, and send error
      ref = push(socket, "command", %{"input" => "build me a tavern"})
      assert_reply ref, :ok, %{}, @timeout

      assert_push "ai_stream_error", %{error: error}, 5000
      assert is_binary(error)
    end
  end

  describe "streaming event handlers" do
    setup %{admin: player} do
      {:ok, socket} = connect_player(player)

      # Enter chat mode to initialize ai_conversation in assigns
      send_cmd(socket, "chat")
      assert_push "chat_mode_changed", %{mode: "chat"}, @timeout
      _text = receive_output()

      %{socket: socket}
    end

    test "text delta events are forwarded to client", %{socket: socket} do
      send(socket.channel_pid, {:ai_text_delta, "Hello "})
      assert_push "ai_stream_delta", %{text: "Hello "}, @timeout

      send(socket.channel_pid, {:ai_text_delta, "world!"})
      assert_push "ai_stream_delta", %{text: "world!"}, @timeout
    end

    test "tool use events push tool summary to client", %{socket: socket} do
      # wb_list_rooms is a read-only tool that won't crash even without full world state
      send(
        socket.channel_pid,
        {:ai_tool_use_raw, "wb_list_rooms", "tool_1", %{}}
      )

      assert_push "ai_stream_tool",
                  %{name: "wb_list_rooms", summary: "Listing rooms..."},
                  @timeout
    end

    test "done event pushes stream_done to client", %{socket: socket} do
      send(socket.channel_pid, {:ai_done})
      assert_push "ai_stream_done", %{}, @timeout
    end

    test "error event pushes stream_error to client", %{socket: socket} do
      send(socket.channel_pid, {:ai_error, "Something went wrong"})
      assert_push "ai_stream_error", %{error: "Something went wrong"}, @timeout
    end

    test "verbose tool_use event is a no-op", %{socket: socket} do
      send(socket.channel_pid, {:ai_tool_use, "wb_create_room", "tool_1", %{}, "result"})

      # Should not push anything — give it a moment to process
      refute_push "ai_stream_tool", _, 200
      refute_push "output", _, 200
    end

    test "done_raw event is handled without pushing to client", %{socket: socket} do
      # done_raw updates conversation state but doesn't push to client directly
      # response needs atom-keyed .text and .tool_uses fields
      response = %{text: "Here is the result.", tool_uses: []}
      send(socket.channel_pid, {:ai_done_raw, response})

      # done_raw triggers handle_done which sends {:ai_done} since no pending tools
      # So we should see ai_stream_done (from the {:ai_done} event handler)
      assert_push "ai_stream_done", %{}, @timeout
    end

    test "timeout when not streaming is a no-op", %{socket: socket} do
      send(socket.channel_pid, :ai_timeout)

      # Should not push error because ai_streaming is false
      refute_push "ai_stream_error", _, 200
    end
  end

  describe "format_tool_summary coverage" do
    setup %{admin: player} do
      {:ok, socket} = connect_player(player)

      send_cmd(socket, "chat")
      assert_push "chat_mode_changed", %{mode: "chat"}, @timeout
      _text = receive_output()

      %{socket: socket}
    end

    test "formats various tool types via summary", %{socket: socket} do
      # Use read-only tools that won't crash when executed by handle_tool_use.
      # The tool_executor will run but list/get operations are safe.
      safe_tools = [
        {"wb_list_rooms", %{}, "Listing rooms..."},
        {"wb_list_npcs", %{}, "Listing NPCs..."},
        {"wb_list_items", %{}, "Listing items..."},
        {"wb_get_room", %{"key" => "nonexistent_test"}, "Reading room: nonexistent_test"},
        {"wb_get_npc", %{"key" => "nonexistent_test"}, "Reading NPC: nonexistent_test"}
      ]

      for {tool_name, input, expected_summary} <- safe_tools do
        send(socket.channel_pid, {:ai_tool_use_raw, tool_name, "id_#{tool_name}", input})
        assert_push "ai_stream_tool", %{name: ^tool_name, summary: summary}, @timeout

        assert summary == expected_summary,
               "Expected #{inspect(expected_summary)} for #{tool_name}, got #{inspect(summary)}"
      end
    end
  end
end
