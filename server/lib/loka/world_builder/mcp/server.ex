defmodule Loka.WorldBuilder.MCP.Server do
  @moduledoc """
  MCP (Model Context Protocol) server for the World Builder.

  Implements the MCP protocol to allow Claude Desktop/Code to interact
  with World Builder tools. Runs alongside Tidewave at a separate endpoint.

  ## Protocol

  Uses JSON-RPC 2.0 over HTTP. Key methods:
  - initialize: Handshake and capability exchange
  - tools/list: Return available tools
  - tools/call: Execute a tool

  ## Usage

  Connect Claude Desktop to: http://localhost:4000/world_builder_mcp
  """

  require Logger

  alias Loka.WorldBuilder.MCP.Tools

  @protocol_version "2025-03-26"
  @server_name "Loka World Builder MCP Server"
  @server_version "1.0.0"

  # Tool management

  @doc """
  Initialize tools and store in ETS for fast lookup.
  """
  def init_tools do
    tools = Tools.tools()
    dispatch_map = Map.new(tools, fn tool -> {tool.name, tool.callback} end)

    # Create ETS table if it doesn't exist
    if :ets.whereis(:world_builder_mcp_tools) == :undefined do
      :ets.new(:world_builder_mcp_tools, [:set, :named_table, :public, read_concurrency: true])
    end

    :ets.insert(:world_builder_mcp_tools, {:tools, {tools, dispatch_map}})
  end

  @doc """
  Get tools and dispatch map from ETS.
  """
  def tools_and_dispatch do
    case :ets.whereis(:world_builder_mcp_tools) do
      :undefined ->
        init_tools()
        tools_and_dispatch()

      _table ->
        case :ets.lookup(:world_builder_mcp_tools, :tools) do
          [{:tools, data}] ->
            data

          [] ->
            init_tools()
            [{:tools, data}] = :ets.lookup(:world_builder_mcp_tools, :tools)
            data
        end
    end
  end

  defp tools do
    {tools, _} = tools_and_dispatch()

    for tool <- tools do
      tool
      |> Map.put(:description, String.trim(tool.description))
      |> Map.drop([:callback])
    end
  end

  defp dispatch(name, args) do
    {_tools, dispatch_map} = tools_and_dispatch()

    case dispatch_map do
      %{^name => callback} when is_function(callback, 1) ->
        callback.(args)

      _ ->
        {:error,
         %{
           code: -32601,
           message: "Method not found",
           data: %{name: name}
         }}
    end
  end

  # MCP message handlers

  @doc """
  Handle an incoming MCP message.
  """
  def handle_message(message, _assigns \\ %{}) do
    case message do
      %{"method" => "notifications/initialized"} ->
        Logger.info("[WorldBuilder MCP] Client initialized")
        {:ok, nil}

      %{"method" => "notifications/cancelled", "params" => params} ->
        Logger.info("[WorldBuilder MCP] Request cancelled: #{inspect(params)}")
        {:ok, nil}

      %{"method" => "ping", "id" => id} ->
        handle_ping(id)

      %{"method" => "initialize", "id" => id, "params" => params} ->
        handle_initialize(id, params)

      %{"method" => "tools/list", "id" => id} ->
        handle_list_tools(id)

      %{"method" => "tools/call", "id" => id, "params" => params} ->
        safe_call_tool(id, params)

      %{"method" => method, "id" => id} ->
        Logger.warning("[WorldBuilder MCP] Unsupported method: #{method}")
        {:error, error_response(id, -32601, "Method not found", %{name: method})}

      _ ->
        Logger.warning("[WorldBuilder MCP] Invalid message format")
        {:error, error_response(nil, -32600, "Invalid request")}
    end
  end

  defp handle_ping(request_id) do
    {:ok, %{jsonrpc: "2.0", id: request_id, result: %{}}}
  end

  defp handle_initialize(request_id, params) do
    case validate_protocol_version(params["protocolVersion"]) do
      :ok ->
        {:ok,
         %{
           jsonrpc: "2.0",
           id: request_id,
           result: %{
             protocolVersion: @protocol_version,
             capabilities: %{
               tools: %{listChanged: false}
             },
             serverInfo: %{
               name: @server_name,
               version: @server_version
             },
             tools: tools()
           }
         }}

      {:error, reason} ->
        {:error, error_response(request_id, -32600, reason)}
    end
  end

  defp validate_protocol_version(nil), do: {:error, "Protocol version is required"}

  defp validate_protocol_version(version) when version < @protocol_version do
    {:error, "Unsupported protocol version. Server supports #{@protocol_version} or later"}
  end

  defp validate_protocol_version(_), do: :ok

  defp handle_list_tools(request_id) do
    {:ok, %{jsonrpc: "2.0", id: request_id, result: %{tools: tools()}}}
  end

  defp safe_call_tool(request_id, params) do
    handle_call_tool(request_id, params)
  catch
    kind, reason ->
      error_text = "Failed to call tool: #{Exception.format(kind, reason, __STACKTRACE__)}"
      Logger.error("[WorldBuilder MCP] #{error_text}")

      {:ok,
       %{
         jsonrpc: "2.0",
         id: request_id,
         result: %{
           content: [%{type: "text", text: error_text}],
           isError: true
         }
       }}
  end

  defp handle_call_tool(request_id, %{"name" => name, "arguments" => args}) do
    handle_call_tool(request_id, %{"name" => name}, args)
  end

  defp handle_call_tool(request_id, %{"name" => name}) do
    handle_call_tool(request_id, %{"name" => name}, %{})
  end

  defp handle_call_tool(request_id, %{"name" => name}, args) do
    Logger.info("[WorldBuilder MCP] Calling tool: #{name}")
    Logger.debug("[WorldBuilder MCP] Args: #{inspect(args)}")

    case dispatch(name, args) do
      {:ok, result} ->
        text = format_result(result)

        {:ok,
         %{jsonrpc: "2.0", id: request_id, result: %{content: [%{type: "text", text: text}]}}}

      {:error, reason} when is_binary(reason) ->
        {:ok,
         %{
           jsonrpc: "2.0",
           id: request_id,
           result: %{content: [%{type: "text", text: reason}], isError: true}
         }}

      {:error, %{code: _, message: _} = error} ->
        {:error, %{jsonrpc: "2.0", id: request_id, error: error}}

      {:error, reason} ->
        {:ok,
         %{
           jsonrpc: "2.0",
           id: request_id,
           result: %{content: [%{type: "text", text: inspect(reason)}], isError: true}
         }}
    end
  end

  defp format_result(result) when is_binary(result), do: result
  defp format_result(result) when is_map(result), do: Jason.encode!(result, pretty: true)
  defp format_result(result) when is_list(result), do: Jason.encode!(result, pretty: true)
  defp format_result(result), do: inspect(result, pretty: true)

  defp error_response(id, code, message, data \\ nil) do
    error = %{code: code, message: message}
    error = if data, do: Map.put(error, :data, data), else: error
    %{jsonrpc: "2.0", id: id, error: error}
  end

  # HTTP transport

  @doc """
  Handle an HTTP request containing an MCP message.
  """
  def handle_http_request(conn) do
    import Plug.Conn

    case validate_jsonrpc(conn.body_params) do
      {:ok, message} ->
        case handle_message(message) do
          {:ok, nil} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(202, Jason.encode!(%{status: "ok"}))

          {:ok, response} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(200, Jason.encode!(response))

          {:error, error_response} ->
            conn
            |> put_resp_content_type("application/json")
            |> send_resp(400, Jason.encode!(error_response))
        end

      {:error, :invalid_jsonrpc} ->
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(400, Jason.encode!(error_response(nil, -32600, "Invalid JSON-RPC message")))
    end
  end

  defp validate_jsonrpc(%{"jsonrpc" => "2.0"} = message) do
    cond do
      # Request: has method and id
      Map.has_key?(message, "id") and Map.has_key?(message, "method") ->
        case message["id"] do
          id when is_binary(id) or is_number(id) -> {:ok, message}
          _ -> {:error, :invalid_jsonrpc}
        end

      # Notification: has method but no id
      not Map.has_key?(message, "id") and Map.has_key?(message, "method") ->
        {:ok, message}

      # Reply: has id and result
      Map.has_key?(message, "id") and Map.has_key?(message, "result") ->
        {:ok, message}

      true ->
        {:error, :invalid_jsonrpc}
    end
  end

  defp validate_jsonrpc(_), do: {:error, :invalid_jsonrpc}
end
