defmodule Loka.WorldBuilder.MCP.ServerTest do
  use Loka.DataCase, async: true

  alias Loka.WorldBuilder.MCP.Server

  setup do
    # Ensure tools are initialized
    Server.init_tools()
    :ok
  end

  describe "init_tools/0" do
    test "creates ETS table with tools" do
      Server.init_tools()

      {tools, dispatch} = Server.tools_and_dispatch()

      assert is_list(tools)
      assert length(tools) > 0
      assert is_map(dispatch)
    end

    test "tools have required MCP fields" do
      {tools, _dispatch} = Server.tools_and_dispatch()

      for tool <- tools do
        assert Map.has_key?(tool, :name)
        assert Map.has_key?(tool, :description)
        assert Map.has_key?(tool, :inputSchema)
        assert Map.has_key?(tool, :callback)

        assert is_binary(tool.name)
        assert is_binary(tool.description)
        assert is_map(tool.inputSchema)
        assert is_function(tool.callback, 1)
      end
    end

    test "all tool names are prefixed with wb_" do
      {tools, _dispatch} = Server.tools_and_dispatch()

      for tool <- tools do
        assert String.starts_with?(tool.name, "wb_"),
               "Tool #{tool.name} should be prefixed with wb_"
      end
    end
  end

  describe "handle_message/2 - initialize" do
    test "returns server info and tools on valid initialize" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "initialize",
        "params" => %{"protocolVersion" => "2025-03-26"}
      }

      {:ok, response} = Server.handle_message(message)

      assert response.jsonrpc == "2.0"
      assert response.id == 1
      assert response.result.protocolVersion == "2025-03-26"
      assert response.result.serverInfo.name == "Loka World Builder MCP Server"
      assert is_list(response.result.tools)
      assert length(response.result.tools) > 0
    end

    test "rejects old protocol versions" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "initialize",
        "params" => %{"protocolVersion" => "2024-01-01"}
      }

      {:error, response} = Server.handle_message(message)

      assert response.error.message =~ "Unsupported protocol version"
    end

    test "requires protocol version" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "initialize",
        "params" => %{}
      }

      {:error, response} = Server.handle_message(message)

      assert response.error.message =~ "Protocol version is required"
    end
  end

  describe "handle_message/2 - ping" do
    test "responds to ping" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 42,
        "method" => "ping"
      }

      {:ok, response} = Server.handle_message(message)

      assert response.jsonrpc == "2.0"
      assert response.id == 42
      assert response.result == %{}
    end
  end

  describe "handle_message/2 - tools/list" do
    test "returns list of tools" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "tools/list"
      }

      {:ok, response} = Server.handle_message(message)

      assert response.jsonrpc == "2.0"
      assert response.id == 1
      assert is_list(response.result.tools)

      # Verify tools don't have callbacks (stripped for wire format)
      for tool <- response.result.tools do
        refute Map.has_key?(tool, :callback)
        assert Map.has_key?(tool, :name)
        assert Map.has_key?(tool, :description)
        assert Map.has_key?(tool, :inputSchema)
      end
    end
  end

  describe "handle_message/2 - tools/call" do
    test "calls wb_list_zones tool" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "tools/call",
        "params" => %{
          "name" => "wb_list_zones",
          "arguments" => %{}
        }
      }

      {:ok, response} = Server.handle_message(message)

      assert response.jsonrpc == "2.0"
      assert response.id == 1
      assert is_list(response.result.content)
    end

    test "calls wb_read_guide tool" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "tools/call",
        "params" => %{
          "name" => "wb_read_guide",
          "arguments" => %{"topic" => "narrative_style"}
        }
      }

      {:ok, response} = Server.handle_message(message)

      assert response.jsonrpc == "2.0"
      assert response.id == 1
      assert is_list(response.result.content)
      # Should have content from the guide
      text = hd(response.result.content).text
      assert is_binary(text)
    end

    test "returns error for unknown tool" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "tools/call",
        "params" => %{
          "name" => "nonexistent_tool",
          "arguments" => %{}
        }
      }

      {:error, response} = Server.handle_message(message)

      assert response.error.code == -32601
      assert response.error.message == "Method not found"
    end

    test "handles tool errors gracefully" do
      # Call a tool with invalid arguments
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "tools/call",
        "params" => %{
          "name" => "wb_read_guide",
          "arguments" => %{"topic" => "nonexistent_topic"}
        }
      }

      {:ok, response} = Server.handle_message(message)

      # Tool errors return isError: true, not protocol errors
      assert response.result.isError == true
      assert is_list(response.result.content)
    end
  end

  describe "handle_message/2 - notifications" do
    test "handles initialized notification" do
      message = %{
        "jsonrpc" => "2.0",
        "method" => "notifications/initialized"
      }

      {:ok, nil} = Server.handle_message(message)
    end

    test "handles cancelled notification" do
      message = %{
        "jsonrpc" => "2.0",
        "method" => "notifications/cancelled",
        "params" => %{"requestId" => 123}
      }

      {:ok, nil} = Server.handle_message(message)
    end
  end

  describe "handle_message/2 - unsupported methods" do
    test "returns error for unsupported method" do
      message = %{
        "jsonrpc" => "2.0",
        "id" => 1,
        "method" => "unsupported/method"
      }

      {:error, response} = Server.handle_message(message)

      assert response.error.code == -32601
      assert response.error.message == "Method not found"
    end
  end
end
