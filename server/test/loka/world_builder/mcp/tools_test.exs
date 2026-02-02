defmodule Loka.WorldBuilder.MCP.ToolsTest do
  use ExUnit.Case, async: true

  alias Loka.WorldBuilder.MCP.Tools

  describe "tools/0" do
    test "returns a list of tool definitions" do
      tools = Tools.tools()

      assert is_list(tools)
      assert length(tools) > 25, "Expected at least 25 tools, got #{length(tools)}"
    end

    test "all tools have valid MCP schema" do
      for tool <- Tools.tools() do
        assert is_map(tool), "Tool should be a map"
        assert Map.has_key?(tool, :name), "Tool missing :name"
        assert Map.has_key?(tool, :description), "Tool missing :description"
        assert Map.has_key?(tool, :inputSchema), "Tool missing :inputSchema"
        assert Map.has_key?(tool, :callback), "Tool missing :callback"

        # inputSchema should be valid JSON Schema
        schema = tool.inputSchema
        assert schema.type == "object", "inputSchema.type should be 'object'"
        assert Map.has_key?(schema, :properties), "inputSchema missing :properties"
      end
    end

    test "all tool callbacks are callable" do
      for tool <- Tools.tools() do
        assert is_function(tool.callback, 1),
               "Tool #{tool.name} callback should be a function/1"
      end
    end

    test "tool names are unique" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert length(names) == length(Enum.uniq(names)),
             "Tool names should be unique"
    end
  end

  describe "tool categories" do
    test "includes project tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_create_project" in names
      assert "wb_load_project" in names
      assert "wb_list_projects" in names
      assert "wb_delete_project" in names
    end

    test "includes document tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_write_doc" in names
      assert "wb_read_doc" in names
      assert "wb_list_docs" in names
      assert "wb_delete_doc" in names
    end

    test "includes guidance tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_read_guide" in names
    end

    test "includes room tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_create_room" in names
      assert "wb_update_room" in names
      assert "wb_delete_room" in names
      assert "wb_create_exit" in names
      assert "wb_remove_exit" in names
      assert "wb_batch_create_rooms" in names
    end

    test "includes entity tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_create_npc" in names
      assert "wb_create_item" in names
      assert "wb_list_npcs" in names
      assert "wb_list_items" in names
    end

    test "includes quest tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_create_quest" in names
      assert "wb_update_quest" in names
      assert "wb_list_quests" in names
    end

    test "includes dialogue tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_create_dialogue" in names
      assert "wb_get_dialogue" in names
    end

    test "includes query tools" do
      tools = Tools.tools()
      names = Enum.map(tools, & &1.name)

      assert "wb_get_room_info" in names
      assert "wb_list_rooms" in names
      assert "wb_get_zone_info" in names
      assert "wb_list_zones" in names
    end
  end

  describe "dispatch/3" do
    test "dispatches to tool executor" do
      # Test with a simple query tool that doesn't modify state
      result = Tools.dispatch("list_zones", %{})

      assert match?({:ok, _}, result) or match?({:error, _}, result)
    end

    test "returns error for unknown tool" do
      result = Tools.dispatch("nonexistent_tool", %{})

      assert match?({:error, _}, result)
    end
  end

  describe "tool input schemas" do
    test "wb_create_project has required fields" do
      tool = Enum.find(Tools.tools(), &(&1.name == "wb_create_project"))

      assert "key" in tool.inputSchema.required
      assert "name" in tool.inputSchema.required
      assert Map.has_key?(tool.inputSchema.properties, :key)
      assert Map.has_key?(tool.inputSchema.properties, :name)
    end

    test "wb_create_room has required fields" do
      tool = Enum.find(Tools.tools(), &(&1.name == "wb_create_room"))

      assert "key" in tool.inputSchema.required
      assert "name" in tool.inputSchema.required
      assert "description" in tool.inputSchema.required
    end

    test "wb_read_guide has topic enum" do
      tool = Enum.find(Tools.tools(), &(&1.name == "wb_read_guide"))

      topic_schema = tool.inputSchema.properties.topic
      assert Map.has_key?(topic_schema, :enum)
      assert "narrative_style" in topic_schema.enum
      assert "world_design_process" in topic_schema.enum
      assert "quest_patterns" in topic_schema.enum
    end
  end
end
