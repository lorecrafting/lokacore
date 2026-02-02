defmodule Loka.WorldBuilder.MCP.Router do
  @moduledoc """
  Plug router for the World Builder MCP endpoint.

  Handles MCP protocol requests at /world_builder_mcp
  """

  use Plug.Router
  require Logger

  alias Loka.WorldBuilder.MCP.Server

  plug :match

  # Parse JSON body
  plug Plug.Parsers,
    parsers: [:json],
    pass: ["application/json"],
    json_decoder: Jason

  plug :dispatch

  # Health check
  get "/" do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(
      200,
      Jason.encode!(%{
        status: "ok",
        server: "Loka World Builder MCP Server",
        version: "1.0.0",
        protocol: "MCP 2025-03-26"
      })
    )
  end

  # MCP message endpoint
  post "/" do
    Server.handle_http_request(conn)
  end

  # SSE endpoint for streaming (future)
  get "/sse" do
    conn
    |> put_resp_content_type("text/event-stream")
    |> send_resp(501, "SSE not implemented yet")
  end

  # Fallback
  match _ do
    send_resp(conn, 404, "Not found")
  end
end
