# LiveView External API Streaming Pattern

## Trigger
- "Stream API responses to LiveView"
- "Anthropic streaming in LiveView"
- "Real-time API responses in Phoenix"
- "Replace React chat with LiveView"

## Problem
You want to stream responses from an external API (like Anthropic) to a LiveView, showing tokens as they arrive.

## Solution
Use Task.start to call the API and send messages to the LiveView process.

### 1. API Client with LiveView Streaming

```elixir
# lib/my_app/api_client.ex
defmodule MyApp.ApiClient do
  def stream_to_liveview(lv_pid, request_params, opts \\ []) do
    opts =
      opts
      |> Keyword.put(:on_text, fn text ->
        send(lv_pid, {:api_text_delta, text})
      end)
      |> Keyword.put(:on_done, fn response ->
        send(lv_pid, {:api_done, response})
      end)
      |> Keyword.put(:on_error, fn error ->
        send(lv_pid, {:api_error, error})
      end)

    # Run in separate process to not block LiveView
    Task.start(fn ->
      do_streaming_request(request_params, opts)
    end)
  end

  defp do_streaming_request(params, opts) do
    # Use Req with into: :self for streaming
    request = Req.new(
      url: @api_url,
      method: :post,
      json: params,
      receive_timeout: 120_000,
      into: :self
    )

    case Req.request(request) do
      {:ok, response} -> process_stream(response, opts)
      {:error, reason} -> opts[:on_error].(reason)
    end
  end

  defp process_stream(response, opts) do
    receive do
      {_, ^response, {:data, data}} ->
        # Parse SSE data, call on_text callback
        process_sse_data(data, opts)
        process_stream(response, opts)

      {_, ^response, :done} ->
        opts[:on_done].(%{...})
    after
      120_000 -> opts[:on_error].("timeout")
    end
  end
end
```

### 2. State Management Helper

```elixir
# lib/my_app/chat.ex
defmodule MyApp.Chat do
  def init_assigns(socket) do
    Phoenix.Component.assign(socket,
      messages: [],
      streaming: false,
      current_response: "",
      error: nil
    )
  end

  def send_message(socket, message) do
    socket =
      socket
      |> assign(:messages, socket.assigns.messages ++ [%{role: "user", content: message}])
      |> assign(:streaming, true)
      |> assign(:current_response, "")

    MyApp.ApiClient.stream_to_liveview(self(), %{message: message})
    socket
  end

  def handle_text_delta(socket, text) do
    current = socket.assigns.current_response
    assign(socket, :current_response, current <> text)
  end

  def handle_done(socket, response) do
    messages = socket.assigns.messages ++ [%{role: "assistant", content: response.text}]

    socket
    |> assign(:messages, messages)
    |> assign(:streaming, false)
    |> assign(:current_response, "")
  end

  def handle_error(socket, error) do
    socket
    |> assign(:streaming, false)
    |> assign(:error, inspect(error))
  end
end
```

### 3. LiveView handle_info Clauses

```elixir
# In your LiveView module
@impl true
def handle_info({:api_text_delta, text}, socket) do
  {:noreply, MyApp.Chat.handle_text_delta(socket, text)}
end

@impl true
def handle_info({:api_done, response}, socket) do
  {:noreply, MyApp.Chat.handle_done(socket, response)}
end

@impl true
def handle_info({:api_error, error}, socket) do
  {:noreply, MyApp.Chat.handle_error(socket, error)}
end
```

### 4. Component with Streaming Display

```elixir
def chat_panel(assigns) do
  ~H"""
  <div class="chat-messages" phx-hook="ScrollBottom">
    <%= for message <- @messages do %>
      <.chat_message message={message} />
    <% end %>

    <%= if @streaming do %>
      <div class="message streaming">
        {@current_response}
        <span class="typing-indicator">▊</span>
      </div>
    <% end %>
  </div>
  """
end
```

### 5. Auto-Scroll JS Hook

```javascript
// In app.js
const Hooks = {
  ScrollBottom: {
    mounted() { this.scrollToBottom() },
    updated() { this.scrollToBottom() },
    scrollToBottom() {
      this.el.scrollTop = this.el.scrollHeight
    }
  }
}
```

## Key Points

1. **Task.start, not Task.async** - Don't block the LiveView process
2. **send() to self()** - Messages go to LiveView's handle_info
3. **Req with into: :self** - Enables streaming HTTP responses
4. **Accumulate in assigns** - current_response grows with each delta
5. **ScrollBottom hook** - Auto-scroll as content streams in

## Files Created
- `lib/loka/world_builder/anthropic_client.ex`
- `lib/loka/world_builder/chat.ex`
- `lib/loka_web/live/admin_live/world_builder/chat_panel.ex`

## Related
- Req streaming: https://hexdocs.pm/req/Req.html#module-streaming
- LiveView handle_info: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#c:handle_info/2
