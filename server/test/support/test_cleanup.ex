defmodule Loka.TestCleanup do
  @moduledoc """
  Helper module for cleaning up test artifacts from priv/world/ directories.

  Tests that create YAML files should use this module to ensure cleanup happens
  even if tests fail.

  ## Usage

      setup_all do
        on_exit(fn ->
          TestCleanup.cleanup_test_files(:room, ~w(test_ tool_ update_ delete_ batch_ exit_ remove_exit_ filter_ info_))
        end)
        :ok
      end
  """

  @rooms_dir "priv/world/prototypes/rooms"
  @npcs_dir "priv/world/prototypes/npcs"
  @items_dir "priv/world/prototypes/items"
  @quests_dir "priv/world/quests"
  @scripts_dir "priv/world/scripts"
  @dialogues_dir "priv/world/dialogues"

  @doc """
  Cleans up test files matching the given prefixes for a specific entity type.

  ## Examples

      # Clean up room files starting with "test_", "tool_", etc.
      cleanup_test_files(:room, ~w(test_ tool_ update_))

      # Clean up all test NPCs
      cleanup_test_files(:npc, ~w(test_ tool_ entity))
  """
  def cleanup_test_files(entity_type, prefixes) when is_list(prefixes) do
    dir = dir_for_type(entity_type)

    case File.ls(dir) do
      {:ok, files} ->
        files
        |> Enum.filter(fn file ->
          Enum.any?(prefixes, &String.starts_with?(file, &1))
        end)
        |> Enum.each(fn file ->
          File.rm(Path.join(dir, file))
        end)

      {:error, _} ->
        :ok
    end
  end

  @doc """
  Cleans up a specific file by key and entity type.
  """
  def cleanup_file(entity_type, key) do
    dir = dir_for_type(entity_type)
    File.rm(Path.join(dir, "#{key}.yml"))
  end

  @doc """
  Cleans up room files with common test prefixes used by RoomManager and ToolExecutor tests.
  """
  def cleanup_room_test_files do
    cleanup_test_files(:room, [
      "test_room_",
      "tool_test_",
      "update_tool_test_",
      "update_test",
      "delete_test",
      "delete_tool_test_",
      "batch_room_",
      "batch_ok_",
      "exit_from_",
      "exit_to_",
      "exit_remove_",
      "remove_exit_",
      "filter_test_",
      "info_test_",
      "npc_room_",
      "get_test_",
      "get_by_",
      "new_room",
      "minimal_room",
      "default_coords",
      "dest_room",
      "room_with_exits",
      "desc_test",
      "coord_test",
      "registry_delete_test",
      "from_room",
      "to_room",
      "east_room",
      "north_room",
      "south_room",
      "northeast_room",
      "northwest_room",
      "southeast_room",
      "southwest_room",
      "up_room",
      "down_room",
      "west_room",
      # PreviewManager test prefixes
      "accept_room_",
      "mark_test",
      "reject_test",
      "preview_room",
      "r1",
      "r2",
      "r3",
      "u1r1",
      "u2r1",
      "room_",
      # E2E test prefixes
      "e2e_test_"
    ])
  end

  @doc """
  Cleans up NPC files with common test prefixes.
  """
  def cleanup_npc_test_files do
    cleanup_test_files(:npc, [
      "test_npc_",
      "tool_npc_",
      "entity1_",
      "entity2_",
      "update_test_",
      "preserve_test_",
      "delete_test_",
      "list_delete_test_",
      "validate_test",
      "e2e_test_",
      "new_npc_",
      # PreviewManager test prefixes
      "preview_npc"
    ])
  end

  @doc """
  Cleans up item files with common test prefixes.
  """
  def cleanup_item_test_files do
    cleanup_test_files(:item, [
      "test_item_",
      "tool_item_",
      # E2E test prefixes
      "e2e_test_"
    ])
  end

  @doc """
  Cleans up quest files with common test prefixes.
  """
  def cleanup_quest_test_files do
    cleanup_test_files(:quest, [
      "test_lua_",
      "tool_quest_",
      "minimal_quest_"
    ])
  end

  @doc """
  Cleans up script files with common test prefixes.
  """
  def cleanup_script_test_files do
    cleanup_test_files(:script, [
      "test_script_",
      "create_test_",
      "duplicate_test_",
      "string_keys_",
      "default_timeout_",
      "update_name_",
      "update_source_",
      "delete_test_"
    ])
  end

  @doc """
  Cleans up dialogue files with common test prefixes.
  """
  def cleanup_dialogue_test_files do
    cleanup_test_files(:dialogue, [
      "tool_dialogue_"
    ])
  end

  @doc """
  Cleans up all test files across all entity types.
  """
  def cleanup_all_test_files do
    cleanup_room_test_files()
    cleanup_npc_test_files()
    cleanup_item_test_files()
    cleanup_quest_test_files()
    cleanup_script_test_files()
    cleanup_dialogue_test_files()

    # Also clean up the invalid_types test directory if it exists
    File.rm_rf("priv/world/prototypes/invalid_types")
  end

  # Private helpers

  defp dir_for_type(:room), do: @rooms_dir
  defp dir_for_type(:npc), do: @npcs_dir
  defp dir_for_type(:item), do: @items_dir
  defp dir_for_type(:quest), do: @quests_dir
  defp dir_for_type(:script), do: @scripts_dir
  defp dir_for_type(:dialogue), do: @dialogues_dir
end
