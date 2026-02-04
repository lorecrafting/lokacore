# Phoenix MCP Server Pattern

## Trigger
- "Add MCP server to Phoenix"
- "Expose tools to Claude Desktop"
- "Create Model Context Protocol endpoint"
- "MCP alongside Tidewave"

## Problem
You want to expose tools via MCP (Model Context Protocol) so Claude Desktop can call them directly, but Tidewave's tools are hardcoded and don't support extension.

## Solution
Create a separate MCP server at a different endpoint.

### 1. MCP Tools Module

Define tools with MCP schema format:

```elixir
# lib/my_app/mcp/tools.ex
defmodule MyApp.MCP.Tools do
  def tools do
    [
      %{
        name: "my_tool",
        description: "Tool description",
        inputSchema: %{  # Note: camelCase for MCP
          type: "object",
          required: ["param1"],
          properties: %{
            param1: %{type: "string", description: "..."}
          }
        },
        callback: fn args -> execute_tool(args) end
      }
    ]
  end

  defp execute_tool(args) do
    # Return {:ok, result} or {:error, reason}
  end
end
```

### 2. MCP Server Module

Handle MCP protocol messages:

```elixir
# lib/my_app/mcp/server.ex
defmodule MyApp.MCP.Server do
  @protocol_version "2025-03-26"

  def init_tools do
    tools = MyApp.MCP.Tools.tools()
    dispatch_map = Map.new(tools, fn t -> {t.name, t.callback} end)
    :ets.new(:my_mcp_tools, [:set, :named_table, :public, read_concurrency: true])
    :ets.insert(:my_mcp_tools, {:tools, {tools, dispatch_map}})
  end

  def handle_message(%{"method" => "initialize", "id" => id, "params" => params}) do
    {:ok, %{
      jsonrpc: "2.0",
      id: id,
      result: %{
        protocolVersion: @protocol_version,
        capabilities: %{tools: %{listChanged: false}},
        serverInfo: %{name: "My MCP Server", version: "1.0.0"},
        tools: get_tools()
      }
    }}
  end

  def handle_message(%{"method" => "tools/call", "id" => id, "params" => params}) do
    # Dispatch to tool callback, format result
  end
end
```

### 3. Router

```elixir
# lib/my_app/mcp/router.ex
defmodule MyApp.MCP.Router do
  use Plug.Router

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  post "/" do
    MyApp.MCP.Server.handle_http_request(conn)
  end
end
```

### 4. Endpoint Integration

**Critical:** Forward BEFORE Plug.Parsers so router can do its own JSON parsing:

```elixir
# lib/my_app_web/endpoint.ex

# After Tidewave, before Plug.Parsers:
plug :my_mcp_router

defp my_mcp_router(%Plug.Conn{path_info: ["my_mcp" | rest]} = conn, _opts) do
  conn
  |> Plug.forward(rest, MyApp.MCP.Router, [])
  |> Plug.Conn.halt()
end

defp my_mcp_router(conn, _opts), do: conn
```

## Key Points

1. **Separate from Tidewave** - Don't try to extend Tidewave's hardcoded tools
2. **Forward before Plug.Parsers** - MCP router needs to parse its own JSON
3. **ETS for tool storage** - Fast concurrent reads
4. **MCP uses camelCase** - `inputSchema` not `input_schema`
5. **Tool callbacks return tuples** - `{:ok, result}` or `{:error, reason}`

## Files Created
- `lib/loka/world_builder/mcp/tools.ex`
- `lib/loka/world_builder/mcp/server.ex`
- `lib/loka/world_builder/mcp/router.ex`

## Related
- Tidewave MCP: `deps/tidewave/lib/tidewave/mcp/`
- MCP Protocol: https://spec.modelcontextprotocol.io/
