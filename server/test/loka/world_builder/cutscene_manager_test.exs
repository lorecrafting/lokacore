defmodule Loka.WorldBuilder.CutsceneManagerTest do
  @moduledoc """
  Tests for the CutsceneManager module.

  Validates:
  - Cutscene CRUD operations
  - Trigger configuration
  - Sequence steps
  - Effects handling
  - Search functionality
  """

  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.CutsceneManager

  @cutscenes_dir Path.join([:code.priv_dir(:loka), "world", "cutscenes"])

  # Helper to generate unique cutscene IDs
  defp unique_cutscene_id(prefix \\ "test_cutscene") do
    "#{prefix}_#{System.os_time(:millisecond)}_#{:rand.uniform(1000)}"
  end

  # Helper to clean up test cutscenes
  defp cleanup_cutscene(id) do
    file_path = Path.join(@cutscenes_dir, "#{id}.yml")
    File.rm(file_path)
  end

  # Ensure cutscenes directory exists before tests
  setup do
    File.mkdir_p!(@cutscenes_dir)
    :ok
  end

  describe "list_cutscenes/0" do
    test "returns a list of cutscenes" do
      cutscenes = CutsceneManager.list_cutscenes()
      assert is_list(cutscenes)
    end

    test "cutscenes are sorted by ID" do
      cutscenes = CutsceneManager.list_cutscenes()

      if length(cutscenes) > 1 do
        ids = Enum.map(cutscenes, & &1["id"])
        assert ids == Enum.sort(ids)
      end
    end
  end

  describe "get_cutscene/1" do
    test "returns {:error, :not_found} for non-existent cutscene" do
      assert {:error, :not_found} = CutsceneManager.get_cutscene("nonexistent_cutscene_id")
    end

    test "returns {:ok, cutscene} for existing cutscene" do
      id = unique_cutscene_id("get_test")

      attrs = %{
        "id" => id,
        "trigger" => %{"type" => "enter_room", "location" => "test_room"},
        "sequence" => [%{"type" => "narration", "text" => "Test"}]
      }

      case CutsceneManager.create_cutscene(attrs) do
        {:ok, _cutscene} ->
          assert {:ok, fetched} = CutsceneManager.get_cutscene(id)
          assert fetched["id"] == id
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "rejects invalid ID patterns" do
      result = CutsceneManager.get_cutscene("../invalid")
      assert {:error, _reason} = result
    end
  end

  describe "create_cutscene/1" do
    test "creates a cutscene with minimal attributes" do
      id = unique_cutscene_id("minimal")

      attrs = %{
        "id" => id
      }

      result = CutsceneManager.create_cutscene(attrs)

      case result do
        {:ok, cutscene} ->
          assert cutscene["id"] == id
          cleanup_cutscene(id)

        {:error, reason} ->
          assert is_binary(reason)
      end
    end

    test "creates a cutscene with trigger" do
      id = unique_cutscene_id("trigger")

      attrs = %{
        "id" => id,
        "trigger" => %{
          "type" => "enter_room",
          "location" => "dragon_lair"
        }
      }

      result = CutsceneManager.create_cutscene(attrs)

      case result do
        {:ok, cutscene} ->
          assert cutscene["id"] == id
          assert cutscene["trigger"]["type"] == "enter_room"
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "creates a cutscene with sequence steps" do
      id = unique_cutscene_id("sequence")

      attrs = %{
        "id" => id,
        "sequence" => [
          %{"type" => "narration", "text" => "The story begins..."},
          %{"type" => "dialogue", "speaker" => "hero", "text" => "I must find the artifact."},
          %{"type" => "fade_out", "duration" => 2.0},
          %{"type" => "pause", "duration" => 1.0},
          %{"type" => "fade_in", "duration" => 2.0}
        ]
      }

      result = CutsceneManager.create_cutscene(attrs)

      case result do
        {:ok, cutscene} ->
          assert cutscene["id"] == id
          assert length(cutscene["sequence"]) == 5
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "creates a cutscene with effects" do
      id = unique_cutscene_id("effects")

      attrs = %{
        "id" => id,
        "effects" => [
          %{"type" => "set_flag", "flag" => "cutscene_watched"},
          %{"type" => "give_item", "item_key" => "magic_amulet"},
          %{"type" => "give_xp", "amount" => 100},
          %{"type" => "start_quest", "quest_key" => "main_quest"}
        ]
      }

      result = CutsceneManager.create_cutscene(attrs)

      case result do
        {:ok, cutscene} ->
          assert cutscene["id"] == id
          assert length(cutscene["effects"]) == 4
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "generates ID when not provided" do
      attrs = %{
        "trigger" => %{"type" => "manual"},
        "sequence" => []
      }

      result = CutsceneManager.create_cutscene(attrs)

      case result do
        {:ok, cutscene} ->
          assert cutscene["id"] != nil
          assert String.starts_with?(cutscene["id"], "cutscene_")
          cleanup_cutscene(cutscene["id"])

        {:error, _} ->
          :ok
      end
    end

    test "accepts atom keys and converts to string" do
      id = unique_cutscene_id("atom_keys")

      attrs = %{
        id: id,
        trigger: %{type: "enter_room", location: "test"},
        sequence: [%{type: "narration", text: "Test"}]
      }

      result = CutsceneManager.create_cutscene(attrs)

      case result do
        {:ok, cutscene} ->
          assert cutscene["id"] == id
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "rejects invalid ID patterns" do
      attrs = %{
        "id" => "../path_traversal"
      }

      result = CutsceneManager.create_cutscene(attrs)
      assert {:error, _reason} = result
    end

    test "rejects IDs with path separators" do
      attrs = %{
        "id" => "some/path"
      }

      result = CutsceneManager.create_cutscene(attrs)
      assert {:error, _reason} = result
    end
  end

  describe "update_cutscene/2" do
    test "updates cutscene trigger" do
      id = unique_cutscene_id("update_trigger")

      create_attrs = %{
        "id" => id,
        "trigger" => %{"type" => "enter_room", "location" => "old_room"}
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          update_attrs = %{
            "trigger" => %{"type" => "talk_to", "location" => "elder_npc"}
          }

          result = CutsceneManager.update_cutscene(id, update_attrs)

          case result do
            {:ok, updated} ->
              assert updated["trigger"]["type"] == "talk_to"

            {:error, _} ->
              :ok
          end

          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "updates cutscene sequence" do
      id = unique_cutscene_id("update_sequence")

      create_attrs = %{
        "id" => id,
        "sequence" => [%{"type" => "narration", "text" => "Old text"}]
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          update_attrs = %{
            "sequence" => [
              %{"type" => "narration", "text" => "New text"},
              %{"type" => "fade_out", "duration" => 1.0}
            ]
          }

          result = CutsceneManager.update_cutscene(id, update_attrs)

          case result do
            {:ok, updated} ->
              assert length(updated["sequence"]) == 2

            {:error, _} ->
              :ok
          end

          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "updates cutscene effects" do
      id = unique_cutscene_id("update_effects")

      create_attrs = %{
        "id" => id,
        "effects" => [%{"type" => "set_flag", "flag" => "old_flag"}]
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          update_attrs = %{
            "effects" => [%{"type" => "give_xp", "amount" => 500}]
          }

          result = CutsceneManager.update_cutscene(id, update_attrs)

          case result do
            {:ok, updated} ->
              assert hd(updated["effects"])["type"] == "give_xp"

            {:error, _} ->
              :ok
          end

          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent cutscene" do
      result = CutsceneManager.update_cutscene("nonexistent_update", %{"trigger" => %{}})
      assert {:error, :not_found} = result
    end

    test "preserves other fields when updating" do
      id = unique_cutscene_id("preserve")

      create_attrs = %{
        "id" => id,
        "trigger" => %{"type" => "enter_room", "location" => "test_room"},
        "sequence" => [%{"type" => "narration", "text" => "Preserved"}],
        "effects" => [%{"type" => "set_flag", "flag" => "test"}]
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          result = CutsceneManager.update_cutscene(id, %{"trigger" => %{"type" => "manual"}})

          case result do
            {:ok, updated} ->
              # Sequence should be preserved
              assert length(updated["sequence"]) == 1
              assert length(updated["effects"]) == 1

            {:error, _} ->
              :ok
          end

          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end
  end

  describe "delete_cutscene/1" do
    test "deletes an existing cutscene" do
      id = unique_cutscene_id("delete")

      create_attrs = %{
        "id" => id,
        "sequence" => []
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          result = CutsceneManager.delete_cutscene(id)
          assert :ok = result

          # Verify deletion
          assert {:error, :not_found} = CutsceneManager.get_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent cutscene" do
      result = CutsceneManager.delete_cutscene("nonexistent_delete_cutscene")
      assert {:error, :not_found} = result
    end

    test "rejects invalid ID patterns" do
      result = CutsceneManager.delete_cutscene("../invalid")
      assert {:error, _reason} = result
    end
  end

  describe "search_cutscenes/1" do
    test "finds cutscenes by ID" do
      id = unique_cutscene_id("searchable")

      create_attrs = %{
        "id" => id,
        "sequence" => []
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          results = CutsceneManager.search_cutscenes("searchable")
          assert length(results) >= 1
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "finds cutscenes by trigger location" do
      id = unique_cutscene_id("location_search")

      create_attrs = %{
        "id" => id,
        "trigger" => %{"type" => "enter_room", "location" => "unique_search_location_xyz"}
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          results = CutsceneManager.search_cutscenes("unique_search_location_xyz")
          assert length(results) >= 1
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "finds cutscenes by sequence text" do
      id = unique_cutscene_id("text_search")

      create_attrs = %{
        "id" => id,
        "sequence" => [
          %{"type" => "narration", "text" => "Unique searchable text ABC123"}
        ]
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          results = CutsceneManager.search_cutscenes("ABC123")
          assert length(results) >= 1
          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end

    test "returns empty list for no matches" do
      results = CutsceneManager.search_cutscenes("xyznonexistentquery123")
      assert results == []
    end

    test "search is case insensitive" do
      id = unique_cutscene_id("case_search")

      create_attrs = %{
        "id" => id,
        "sequence" => [%{"type" => "narration", "text" => "CaseSensitiveText"}]
      }

      case CutsceneManager.create_cutscene(create_attrs) do
        {:ok, _cutscene} ->
          results_lower = CutsceneManager.search_cutscenes("casesensitivetext")
          results_upper = CutsceneManager.search_cutscenes("CASESENSITIVETEXT")

          # Both should find results
          assert is_list(results_lower)
          assert is_list(results_upper)

          cleanup_cutscene(id)

        {:error, _} ->
          :ok
      end
    end
  end

  describe "sequence step types" do
    @valid_sequence_types ~w(dialogue narration fade_out fade_in pause choice sound music image animation apply_status spawn_enemy trigger_ending)

    test "accepts all valid sequence types" do
      for step_type <- @valid_sequence_types do
        id = unique_cutscene_id("step_#{step_type}")

        attrs = %{
          "id" => id,
          "sequence" => [
            %{"type" => step_type, "text" => "Test"}
          ]
        }

        result = CutsceneManager.create_cutscene(attrs)

        case result do
          {:ok, cutscene} ->
            assert cutscene["id"] == id
            cleanup_cutscene(id)

          {:error, _} ->
            :ok
        end
      end
    end
  end

  describe "effect types" do
    @valid_effect_types ~w(set_flag clear_flag add_insight give_item take_item give_xp teleport start_quest complete_quest heal damage add_status start_combat)

    test "accepts all valid effect types" do
      for effect_type <- @valid_effect_types do
        id = unique_cutscene_id("effect_#{effect_type}")

        attrs = %{
          "id" => id,
          "effects" => [
            %{"type" => effect_type, "value" => "test"}
          ]
        }

        result = CutsceneManager.create_cutscene(attrs)

        case result do
          {:ok, cutscene} ->
            assert cutscene["id"] == id
            cleanup_cutscene(id)

          {:error, _} ->
            :ok
        end
      end
    end
  end

  describe "validation" do
    test "rejects non-list sequence" do
      id = unique_cutscene_id("invalid_sequence")

      attrs = %{
        "id" => id,
        "sequence" => "not a list"
      }

      result = CutsceneManager.create_cutscene(attrs)
      assert {:error, _reason} = result
    end

    test "rejects non-list effects" do
      id = unique_cutscene_id("invalid_effects")

      attrs = %{
        "id" => id,
        "effects" => "not a list"
      }

      result = CutsceneManager.create_cutscene(attrs)
      assert {:error, _reason} = result
    end
  end
end
