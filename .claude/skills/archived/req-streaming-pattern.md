# Req 0.5.x Streaming Pattern

## Trigger
Use this skill when:
- Streaming HTTP responses with Req library in Elixir
- Seeing "Stream timeout" errors with `into: :self`
- Migrating from older Req versions to 0.5.x
- Implementing SSE (Server-Sent Events) streaming

## Problem

In Req 0.5.x, the streaming API changed. The old pattern using `into: :self` with manual `receive` blocks no longer works because the message format changed.

**Symptoms:**
- Stream timeout errors even though API is responding
- `receive` block never matches
- Works in tests but fails in production

**Old (broken) pattern:**
```elixir
request = Req.new(url: url, into: :self)

case Req.request(request) do
  {:ok, %Req.Response{status: 200} = response} ->
    # This receive pattern DOES NOT WORK in Req 0.5.x
    receive do
      {_, ^response, {:data, data}} -> ...
      {_, ^response, :done} -> ...
    end
end
```

## Solution

Use the callback form of `into:` instead:

**New (working) pattern:**
```elixir
# Use callback function for streaming
stream_fn = fn {:data, data}, {req, resp} ->
  # Process each chunk here
  process_chunk(data)
  {:cont, {req, resp}}
end

request = Req.new(
  url: url,
  method: :post,
  json: body,
  into: stream_fn
)

case Req.request(request) do
  {:ok, %Req.Response{status: 200}} ->
    # Streaming completed, all chunks processed via callback
    {:ok, get_accumulated_result()}

  {:ok, %Req.Response{status: status, body: body}} ->
    {:error, "API error: #{status}"}

  {:error, reason} ->
    {:error, reason}
end
```

## State Management Pattern

For streaming that accumulates state (like SSE events), use process dictionary or agent:

```elixir
defp stream_request(url, headers, body, opts) do
  initial_state = %{text: "", events: []}

  # Store state in process dictionary
  Process.put(:stream_state, initial_state)

  stream_fn = fn {:data, data}, {req, resp} ->
    state = Process.get(:stream_state)
    new_state = process_sse_chunk(data, state)
    Process.put(:stream_state, new_state)
    {:cont, {req, resp}}
  end

  request = Req.new(url: url, into: stream_fn, ...)

  case Req.request(request) do
    {:ok, %Req.Response{status: 200}} ->
      final_state = Process.get(:stream_state)
      Process.delete(:stream_state)
      {:ok, final_state}

    error ->
      Process.delete(:stream_state)
      error
  end
end
```

## SSE (Server-Sent Events) Processing

For APIs like Anthropic that use SSE format:

```elixir
defp process_sse_chunk(data, state) do
  data
  |> String.split("\n")
  |> Enum.reduce(state, fn line, acc ->
    case line do
      "data: " <> json_data ->
        case Jason.decode(json_data) do
          {:ok, event} -> handle_event(event, acc)
          {:error, _} -> acc
        end
      _ -> acc
    end
  end)
end
```

## Real-time Callbacks

To send updates to another process (e.g., LiveView) during streaming:

```elixir
def stream_to_liveview(lv_pid, url, body) do
  stream_fn = fn {:data, data}, {req, resp} ->
    # Send each chunk to LiveView immediately
    send(lv_pid, {:stream_chunk, data})
    {:cont, {req, resp}}
  end

  Task.start(fn ->
    case Req.request(Req.new(url: url, into: stream_fn)) do
      {:ok, _} -> send(lv_pid, :stream_done)
      {:error, reason} -> send(lv_pid, {:stream_error, reason})
    end
  end)
end
```

## Alternative: Enumerable API

For simpler cases, use the enumerable response body:

```elixir
resp = Req.get!(url, into: :self)
# resp.body is Req.Response.Async, implements Enumerable

Enum.each(resp.body, fn chunk ->
  IO.puts("Got chunk: #{chunk}")
end)
```

## References
- Req 0.5 release notes: https://dashbit.co/blog/req-v0.5
- Req hexdocs: https://hexdocs.pm/req/Req.html
- Example fix: `lib/loka/world_builder/anthropic_client.ex`

## Version Info
- Req version: 0.5.x (tested with 0.5.17)
- Created: 2026-02-02
- Context: Fixed World Builder AI Assistant streaming
