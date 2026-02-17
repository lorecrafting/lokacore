defmodule Loka.Testing.Mocks.MockAnthropicClient do
  @moduledoc """
  Mock Anthropic API client for testing the Conversation engine.

  Provides canned responses to simulate Claude API behavior without
  making real API calls. Supports text-only, tool-use, and error scenarios.

  ## Usage

      # Simple text response
      MockAnthropicClient.set_responses([
        {:text, "Hello! I'll help you build that."}
      ])

      # Tool use + text continuation
      MockAnthropicClient.set_responses([
        {:tool_use, "create_room", %{"key" => "tavern"}},
        {:text, "I've created the room for you."}
      ])

      # Error
      MockAnthropicClient.set_responses([
        {:error, "Rate limited"}
      ])
  """

  use Agent

  @spec start_link(keyword()) :: {:ok, pid()}
  def start_link(opts \\ []) do
    Agent.start_link(fn -> %{responses: opts[:responses] || [], call_count: 0, calls: []} end,
      name: __MODULE__
    )
  end

  @spec stop() :: :ok
  def stop do
    if Process.whereis(__MODULE__), do: Agent.stop(__MODULE__)
    :ok
  end

  @spec set_responses([
          {:text, String.t()} | {:tool_use, String.t(), map()} | {:error, String.t()}
        ]) ::
          :ok
  def set_responses(responses) do
    Agent.update(__MODULE__, fn state -> %{state | responses: responses} end)
  end

  @spec get_calls() :: [map()]
  def get_calls do
    Agent.get(__MODULE__, fn state -> state.calls end)
  end

  @spec call_count() :: non_neg_integer()
  def call_count do
    Agent.get(__MODULE__, fn state -> state.call_count end)
  end

  @doc """
  Mock implementation of AnthropicClient.chat/3.

  Pops the next canned response and sends appropriate messages to the caller.
  """
  @spec chat(list(), list(), keyword()) :: {:ok, map()} | {:error, String.t()}
  def chat(messages, tools, opts \\ []) do
    _caller = opts[:caller_pid] || self()
    on_text = opts[:on_text] || fn _ -> :ok end
    on_tool_use = opts[:on_tool_use] || fn _, _, _ -> :ok end
    on_done = opts[:on_done] || fn _ -> :ok end
    on_error = opts[:on_error] || fn _ -> :ok end

    {response, _state} =
      Agent.get_and_update(__MODULE__, fn state ->
        call = %{messages: messages, tools: tools, opts: opts}
        remaining = state.responses

        case remaining do
          [] ->
            {{:text, "No more mock responses configured."},
             %{state | call_count: state.call_count + 1, calls: state.calls ++ [call]}}

          [next | rest] ->
            {next,
             %{
               state
               | responses: rest,
                 call_count: state.call_count + 1,
                 calls: state.calls ++ [call]
             }}
        end
      end)

    case response do
      {:text, text} ->
        on_text.(text)
        response_map = %{text: text, tool_uses: []}
        on_done.(response_map)
        {:ok, response_map}

      {:tool_use, name, input} ->
        tool_id = "toolu_mock_#{:rand.uniform(100_000)}"
        on_tool_use.(name, tool_id, input)
        response_map = %{text: "", tool_uses: [%{id: tool_id, name: name, input: input}]}
        on_done.(response_map)
        {:ok, response_map}

      {:multi, parts} ->
        # Supports multiple text + tool_use parts in one response
        text_parts =
          parts
          |> Enum.filter(fn {type, _} -> type == :text end)
          |> Enum.map(fn {:text, t} -> t end)

        tool_parts =
          parts
          |> Enum.filter(fn {type, _, _} -> type == :tool_use end)
          |> Enum.map(fn {:tool_use, name, input} ->
            tool_id = "toolu_mock_#{:rand.uniform(100_000)}"
            on_tool_use.(name, tool_id, input)
            %{id: tool_id, name: name, input: input}
          end)

        full_text = Enum.join(text_parts, "")
        if full_text != "", do: on_text.(full_text)

        response_map = %{text: full_text, tool_uses: tool_parts}
        on_done.(response_map)
        {:ok, response_map}

      {:error, reason} ->
        on_error.(reason)
        {:error, reason}
    end
  end
end
