defmodule Loka.AI.ConversationTest do
  use ExUnit.Case, async: true

  alias Loka.AI.Conversation

  defp new_state(opts \\ []) do
    config = %{
      tools: opts[:tools] || [],
      system_prompt_fn: opts[:system_prompt_fn] || fn _ctx -> "test prompt" end,
      tool_executor_fn:
        opts[:tool_executor_fn] || fn _name, _input, _opts -> {:ok, "mock result"} end,
      verbosity: opts[:verbosity] || :verbose,
      caller_pid: opts[:caller_pid] || self(),
      model: "test-model",
      max_tokens: 1024
    }

    Conversation.new(config)
  end

  describe "new/1" do
    test "initializes empty state" do
      state = new_state()

      assert state.messages == []
      assert state.pending_tool_results == []
      assert state.streaming == false
      assert state.tool_iterations == 0
    end

    test "stores config" do
      state = new_state(verbosity: :conversational)

      assert state.config.verbosity == :conversational
      assert state.config.model == "test-model"
      assert state.config.max_tokens == 1024
    end
  end

  describe "handle_text_delta/2" do
    test "sends text delta to caller pid" do
      state = new_state(caller_pid: self())

      Conversation.handle_text_delta(state, "Hello")

      assert_received {:ai_text_delta, "Hello"}
    end

    test "returns state unchanged" do
      state = new_state()
      result = Conversation.handle_text_delta(state, "text")

      assert result == state
    end
  end

  describe "handle_tool_use/4" do
    test "executes tool and stores result" do
      executor = fn "test_tool", %{"key" => "val"}, _opts -> {:ok, "tool output"} end
      state = new_state(tool_executor_fn: executor, caller_pid: self())

      result = Conversation.handle_tool_use(state, "test_tool", "id_1", %{"key" => "val"})

      assert length(result.pending_tool_results) == 1
      [tr] = result.pending_tool_results
      assert tr.tool_use_id == "id_1"
      assert tr.tool_name == "test_tool"
      assert tr.result.success == true
      assert tr.result.data == "tool output"
    end

    test "handles tool errors" do
      executor = fn _name, _input, _opts -> {:error, "something broke"} end
      state = new_state(tool_executor_fn: executor, caller_pid: self())

      result = Conversation.handle_tool_use(state, "bad_tool", "id_2", %{})

      [tr] = result.pending_tool_results
      assert tr.result.success == false
      assert tr.result.error == "something broke"
    end

    test "handles tool crash" do
      executor = fn _name, _input, _opts -> raise "boom" end
      state = new_state(tool_executor_fn: executor, caller_pid: self())

      result = Conversation.handle_tool_use(state, "crash_tool", "id_3", %{})

      [tr] = result.pending_tool_results
      assert tr.result.success == false
      assert tr.result.error =~ "Tool crashed"
    end

    test "sends tool_use event in verbose mode" do
      state = new_state(verbosity: :verbose, caller_pid: self())

      Conversation.handle_tool_use(state, "my_tool", "id_4", %{"x" => 1})

      assert_received {:ai_tool_use, "my_tool", "id_4", %{"x" => 1}, %{success: true, data: _}}
    end

    test "does not send tool_use event in conversational mode" do
      state = new_state(verbosity: :conversational, caller_pid: self())

      Conversation.handle_tool_use(state, "my_tool", "id_5", %{})

      refute_received {:ai_tool_use, _, _, _, _}
    end

    test "accumulates multiple tool results" do
      state = new_state()

      state = Conversation.handle_tool_use(state, "tool_a", "id_a", %{})
      state = Conversation.handle_tool_use(state, "tool_b", "id_b", %{})

      assert length(state.pending_tool_results) == 2
      assert Enum.at(state.pending_tool_results, 0).tool_name == "tool_a"
      assert Enum.at(state.pending_tool_results, 1).tool_name == "tool_b"
    end
  end

  describe "handle_done/2" do
    test "sends :ai_done when no pending tool results" do
      state = new_state(caller_pid: self())
      response = %{text: "Done!", tool_uses: []}

      result = Conversation.handle_done(state, response)

      assert_received {:ai_done}
      assert result.streaming == false
      assert result.tool_iterations == 0
      # Assistant message should be added
      assert length(result.messages) == 1
      assert hd(result.messages).role == "assistant"
      assert hd(result.messages).content == "Done!"
    end

    test "adds assistant message to history" do
      state = new_state()
      response = %{text: "response text", tool_uses: []}

      result = Conversation.handle_done(state, response)

      [msg] = result.messages
      assert msg.role == "assistant"
      assert msg.content == "response text"
      assert msg.tool_uses == []
    end

    test "stops at max tool iterations" do
      state = new_state(caller_pid: self())

      # Simulate max iterations reached
      state = %{state | tool_iterations: 10}

      # Add a pending tool result so it would normally continue
      state = %{
        state
        | pending_tool_results: [
            %{
              tool_use_id: "id",
              tool_name: "tool",
              input: %{},
              result: %{success: true, data: "ok"}
            }
          ]
      }

      response = %{text: "text", tool_uses: [%{id: "id", name: "tool", input: %{}}]}

      result = Conversation.handle_done(state, response)

      # Should send :ai_done instead of continuing
      assert_received {:ai_done}
      assert result.tool_iterations == 0
    end
  end

  describe "handle_error/2" do
    test "sends error to caller pid" do
      state = new_state(caller_pid: self())

      Conversation.handle_error(state, "API timeout")

      assert_received {:ai_error, "API timeout"}
    end

    test "formats non-string errors" do
      state = new_state(caller_pid: self())

      Conversation.handle_error(state, {:connection_refused, :econnrefused})

      assert_received {:ai_error, error}
      assert is_binary(error)
    end

    test "sets streaming to false" do
      state = %{new_state() | streaming: true}

      result = Conversation.handle_error(state, "error")

      assert result.streaming == false
    end
  end

  describe "clear_history/1" do
    test "resets messages and pending results" do
      state = new_state()
      state = %{state | messages: [%{role: "user", content: "hi"}], streaming: true}

      result = Conversation.clear_history(state)

      assert result.messages == []
      assert result.pending_tool_results == []
      assert result.streaming == false
    end

    test "preserves config" do
      state = new_state(verbosity: :conversational)
      state = %{state | messages: [%{role: "user", content: "hi"}]}

      result = Conversation.clear_history(state)

      assert result.config.verbosity == :conversational
    end
  end
end
