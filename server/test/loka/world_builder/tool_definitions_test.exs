defmodule Loka.WorldBuilder.ToolDefinitionsTest do
  @moduledoc """
  Validates MCP tool definitions for completeness and consistency.

  Ensures all tools have required fields, names map to handlers,
  and random inputs don't crash the executor.
  """
  use Loka.DataCase, async: false
  use ExUnitProperties

  alias Loka.WorldBuilder.MCP.Tools
  alias Loka.WorldBuilder.ToolExecutor

  defp tools, do: Tools.tools()
  defp tool_names, do: Enum.map(tools(), fn t -> t[:name] || t.name end)

  describe "tool definition completeness" do
    test "all tools have a name" do
      for tool <- tools() do
        name = tool[:name] || tool.name
        assert is_binary(name), "Tool missing name: #{inspect(Map.drop(tool, [:callback]))}"
        assert name != "", "Tool has empty name"
      end
    end

    test "all tools have a description" do
      for tool <- tools() do
        desc = tool[:description] || tool.description
        assert is_binary(desc), "Tool #{tool[:name]} missing description"
        assert String.length(String.trim(desc)) > 0, "Tool #{tool[:name]} has empty description"
      end
    end

    test "all tools have an input schema" do
      for tool <- tools() do
        schema = tool[:inputSchema] || tool[:input_schema] || tool.inputSchema
        assert is_map(schema), "Tool #{tool[:name]} missing inputSchema"

        assert schema[:type] == "object" || schema["type"] == "object",
               "Tool #{tool[:name]} inputSchema type should be 'object'"
      end
    end

    test "all tools have a callback" do
      for tool <- tools() do
        callback = tool[:callback] || tool.callback
        assert is_function(callback, 1), "Tool #{tool[:name]} missing or invalid callback"
      end
    end

    test "all tool names are unique" do
      names = tool_names()

      assert length(names) == length(Enum.uniq(names)),
             "Duplicate tool names found: #{inspect(names -- Enum.uniq(names))}"
    end
  end

  describe "tool naming conventions" do
    test "all tool names use snake_case with optional wb_ prefix" do
      for name <- tool_names() do
        assert String.match?(name, ~r/^(wb_)?[a-z][a-z0-9_]*$/),
               "Tool name '#{name}' doesn't follow snake_case convention"
      end
    end
  end

  describe "tool-to-handler mapping" do
    test "every tool name dispatches without Unknown tool error" do
      for name <- tool_names() do
        # Strip wb_ prefix as ToolExecutor does
        normalized = String.replace_prefix(name, "wb_", "")

        # Call with empty map - may return error or crash, but should NOT return "Unknown tool"
        result =
          try do
            ToolExecutor.execute(normalized, %{})
          rescue
            _e -> {:error, "raised"}
          end

        case result do
          {:error, "Unknown tool: " <> _} ->
            flunk("Tool '#{name}' (normalized: '#{normalized}') has no handler in ToolExecutor")

          {:error, _reason} ->
            :ok

          {:ok, _} ->
            :ok
        end
      end
    end
  end

  describe "crash safety" do
    property "random string tool names don't crash ToolExecutor" do
      check all(name <- string(:alphanumeric, min_length: 1, max_length: 50)) do
        result = ToolExecutor.execute(name, %{})
        assert match?({:ok, _}, result) or match?({:error, _}, result)
      end
    end

    property "random map inputs don't crash ToolExecutor for known tools" do
      check all(
              key <- string(:alphanumeric, min_length: 1, max_length: 20),
              value <- one_of([string(:alphanumeric), integer(), constant(nil)])
            ) do
        input = %{key => value}
        result = ToolExecutor.execute("list_rooms", input)
        assert match?({:ok, _}, result) or match?({:error, _}, result)
      end
    end
  end

  describe "input schema properties" do
    test "schemas with required fields list actual property names" do
      for tool <- tools() do
        schema = tool[:inputSchema] || tool[:input_schema] || tool.inputSchema
        required = schema[:required] || schema["required"] || []
        properties = schema[:properties] || schema["properties"] || %{}

        for req <- required do
          assert Map.has_key?(properties, req) or Map.has_key?(properties, String.to_atom(req)),
                 "Tool #{tool[:name]} requires '#{req}' but doesn't define it in properties"
        end
      end
    end
  end
end
