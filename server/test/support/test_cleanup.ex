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

  # Published content directories
  @rooms_dir "priv/world/prototypes/rooms"
  @npcs_dir "priv/world/prototypes/npcs"
  @items_dir "priv/world/prototypes/items"
  @quests_dir "priv/world/quests"
  @scripts_dir "priv/world/scripts"
  @dialogues_dir "priv/world/dialogues"

  # Draft content directories (where builder commands write)
  @draft_rooms_dir "priv/world/drafts/prototypes/rooms"
  @draft_npcs_dir "priv/world/drafts/prototypes/npcs"
  @draft_items_dir "priv/world/drafts/prototypes/items"
  @draft_quests_dir "priv/world/drafts/quests"
  @draft_scripts_dir "priv/world/drafts/scripts"
  @draft_dialogues_dir "priv/world/drafts/dialogues"
  @draft_zones_dir "priv/world/drafts/zones"
  @draft_cutscenes_dir "priv/world/drafts/cutscenes"
  @draft_storylines_dir "priv/world/drafts/storylines"
  @draft_invalid_types_dir "priv/world/drafts/prototypes/invalid_types"

  @doc """
  Cleans up test files matching the given prefixes for a specific entity type.
  Cleans both published and draft directories.
  """
  def cleanup_test_files(entity_type, prefixes) when is_list(prefixes) do
    dir = dir_for_type(entity_type)
    cleanup_files_in_dir(dir, prefixes)

    draft_dir = draft_dir_for_type(entity_type)
    cleanup_files_in_dir(draft_dir, prefixes)
  end

  @doc """
  Cleans up a specific file by key and entity type.
  Removes from both published and draft directories.
  """
  def cleanup_file(entity_type, key) do
    dir = dir_for_type(entity_type)
    File.rm(Path.join(dir, "#{key}.yml"))

    draft_dir = draft_dir_for_type(entity_type)
    File.rm(Path.join(draft_dir, "#{key}.yml"))
  end

  @doc """
  Removes all non-.gitkeep files from the given draft directory.
  """
  def cleanup_draft_files(draft_type) do
    dir = draft_only_dir(draft_type)
    remove_all_test_files_in_dir(dir)
  end

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
      "e2e_test_",
      "test_cascade_room_"
    ])
  end

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
      "preview_npc"
    ])
  end

  def cleanup_item_test_files do
    cleanup_test_files(:item, ["test_item_", "tool_item_", "e2e_test_"])
  end

  def cleanup_quest_test_files do
    cleanup_test_files(:quest, [
      "test_lua_",
      "tool_quest_",
      "minimal_quest_",
      "test_quest_",
      "pub_test"
    ])
  end

  def cleanup_script_test_files do
    cleanup_test_files(:script, [
      "test_script_",
      "create_test_",
      "duplicate_test_",
      "string_keys_",
      "default_timeout_",
      "update_name_",
      "update_source_",
      "delete_test_",
      "test_crud_"
    ])
  end

  def cleanup_dialogue_test_files do
    cleanup_test_files(:dialogue, [
      "tool_dialogue_",
      "test_dlg_",
      "test_create_dlg_"
    ])
  end

  def cleanup_all_draft_files do
    cleanup_draft_files(:zone)
    cleanup_draft_files(:cutscene)
    cleanup_draft_files(:storyline)
    remove_all_test_files_in_dir(@draft_invalid_types_dir)
  end

  def cleanup_all_test_files do
    cleanup_room_test_files()
    cleanup_npc_test_files()
    cleanup_item_test_files()
    cleanup_quest_test_files()
    cleanup_script_test_files()
    cleanup_dialogue_test_files()
    cleanup_all_draft_files()
    File.rm_rf("priv/world/prototypes/invalid_types")
  end

  def sweep_all_draft_directories do
    draft_dirs = [
      @draft_rooms_dir,
      @draft_npcs_dir,
      @draft_items_dir,
      @draft_quests_dir,
      @draft_scripts_dir,
      @draft_dialogues_dir,
      @draft_zones_dir,
      @draft_cutscenes_dir,
      @draft_storylines_dir,
      @draft_invalid_types_dir
    ]

    count =
      Enum.reduce(draft_dirs, 0, fn dir, acc ->
        acc + remove_all_test_files_in_dir(dir)
      end)

    if count > 0 do
      IO.puts(
        "\n[TestCleanup] WARNING: Swept #{count} leftover draft file(s). " <>
          "Tests should clean up after themselves."
      )
    end

    count
  end

  # Private helpers

  defp cleanup_files_in_dir(dir, prefixes) do
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

  defp remove_all_test_files_in_dir(dir) do
    case File.ls(dir) do
      {:ok, files} ->
        test_files = Enum.reject(files, &(&1 == ".gitkeep"))
        Enum.each(test_files, fn file -> File.rm(Path.join(dir, file)) end)
        length(test_files)

      {:error, _} ->
        0
    end
  end

  defp dir_for_type(:room), do: @rooms_dir
  defp dir_for_type(:npc), do: @npcs_dir
  defp dir_for_type(:item), do: @items_dir
  defp dir_for_type(:quest), do: @quests_dir
  defp dir_for_type(:script), do: @scripts_dir
  defp dir_for_type(:dialogue), do: @dialogues_dir

  defp draft_dir_for_type(:room), do: @draft_rooms_dir
  defp draft_dir_for_type(:npc), do: @draft_npcs_dir
  defp draft_dir_for_type(:item), do: @draft_items_dir
  defp draft_dir_for_type(:quest), do: @draft_quests_dir
  defp draft_dir_for_type(:script), do: @draft_scripts_dir
  defp draft_dir_for_type(:dialogue), do: @draft_dialogues_dir

  defp draft_only_dir(:zone), do: @draft_zones_dir
  defp draft_only_dir(:cutscene), do: @draft_cutscenes_dir
  defp draft_only_dir(:storyline), do: @draft_storylines_dir
end
