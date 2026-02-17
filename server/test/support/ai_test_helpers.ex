defmodule Loka.Testing.AITestHelpers do
  @moduledoc """
  Shared test helpers for AI builder tests.

  Provides utilities for setting up mock clients, creating test scenarios,
  and asserting on AI conversation results.
  """

  alias Loka.AI.Conversation
  alias Loka.Testing.Mocks.MockAnthropicClient

  @doc """
  Creates a Conversation state configured for testing with the mock client.
  """
  @spec test_conversation(keyword()) :: Conversation.state()
  def test_conversation(opts \\ []) do
    tools = opts[:tools] || []
    verbosity = opts[:verbosity] || :verbose

    tool_executor_fn =
      opts[:tool_executor_fn] ||
        fn name, input, _opts ->
          # Default mock executor that always succeeds
          {:ok, %{success: true, message: "Executed #{name}", tool: name, input: input}}
        end

    Conversation.new(%{
      tools: tools,
      system_prompt_fn: opts[:system_prompt_fn] || fn _ctx -> "You are a test AI." end,
      tool_executor_fn: tool_executor_fn,
      verbosity: verbosity,
      caller_pid: opts[:caller_pid] || self(),
      model: opts[:model] || "mock-model",
      max_tokens: opts[:max_tokens] || 4096
    })
  end

  @doc """
  Starts the mock Anthropic client.
  Call in test setup and pair with `stop_mock_client/0` in on_exit.
  """
  @spec start_mock_client(keyword()) :: :ok
  def start_mock_client(opts \\ []) do
    MockAnthropicClient.start_link(opts)
    :ok
  end

  @doc """
  Stops the mock Anthropic client.
  """
  @spec stop_mock_client() :: :ok
  def stop_mock_client do
    MockAnthropicClient.stop()
  end

  @doc """
  Collects all messages sent to the current process within the timeout.
  Returns a list of messages received.
  """
  @spec collect_messages(non_neg_integer()) :: [any()]
  def collect_messages(timeout \\ 100) do
    collect_messages_acc(timeout, [])
  end

  defp collect_messages_acc(timeout, acc) do
    receive do
      msg -> collect_messages_acc(timeout, [msg | acc])
    after
      timeout -> Enum.reverse(acc)
    end
  end

  @doc """
  Asserts that a specific AI event was received.
  """
  defmacro assert_ai_event(pattern, timeout \\ 200) do
    quote do
      assert_receive unquote(pattern), unquote(timeout)
    end
  end

  @doc """
  Refutes that a specific AI event was received.
  """
  defmacro refute_ai_event(pattern, timeout \\ 100) do
    quote do
      refute_receive unquote(pattern), unquote(timeout)
    end
  end

  @doc """
  Creates a minimal tool definition for testing.
  """
  @spec test_tool(String.t(), map()) :: map()
  def test_tool(name, schema \\ %{}) do
    %{
      name: name,
      description: "Test tool: #{name}",
      input_schema: Map.merge(%{type: "object", properties: %{}}, schema),
      callback: fn args ->
        {:ok, %{success: true, tool: name, args: args}}
      end
    }
  end
end
