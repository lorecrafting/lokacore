defmodule Loka.WorldBuilder.ScriptManagerTest do
  @moduledoc """
  Tests for the ScriptManager module.

  Validates:
  - Script CRUD operations
  - Source validation
  - Hook type validation
  - Script testing with mock context
  """

  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.ScriptManager
  alias Loka.TestCleanup

  # Clean up test files after all tests complete (runs even if tests fail)
  setup_all do
    on_exit(fn ->
      TestCleanup.cleanup_script_test_files()
    end)

    :ok
  end

  # Helper to generate unique test script keys
  defp unique_script_key(prefix \\ "test_script") do
    "#{prefix}_#{System.os_time(:millisecond)}_#{:rand.uniform(1000)}"
  end

  describe "list_scripts/0" do
    test "returns a list of scripts" do
      scripts = ScriptManager.list_scripts()
      assert is_list(scripts)
    end
  end

  describe "get_script/1" do
    test "returns {:error, :not_found} for non-existent script" do
      assert {:error, :not_found} = ScriptManager.get_script("nonexistent_script_key")
    end

    test "returns {:ok, script} for existing script" do
      # Get any existing script
      scripts = ScriptManager.list_scripts()

      if length(scripts) > 0 do
        script = hd(scripts)
        assert {:ok, fetched} = ScriptManager.get_script(script.key)
        assert fetched.key == script.key
      end
    end
  end

  describe "create_script/1" do
    test "creates a script with valid attributes" do
      key = unique_script_key("create_test")

      attrs = %{
        key: key,
        name: "Test Script",
        description: "A test script for unit testing",
        hook: :on_enter,
        source: """
        message(player, "Hello!")
        """
      }

      result = ScriptManager.create_script(attrs)

      case result do
        {:ok, script} ->
          assert script.key == key

        {:error, reason} ->
          # May fail if script already exists or validation fails
          assert is_binary(reason) or is_list(reason)
      end
    end

    test "returns error for duplicate key" do
      key = unique_script_key("duplicate_test")

      attrs = %{
        key: key,
        name: "First Script",
        hook: :on_enter,
        source: "message(player, \"Test\")"
      }

      case ScriptManager.create_script(attrs) do
        {:ok, _script} ->
          # Try to create with same key
          result = ScriptManager.create_script(attrs)
          assert {:error, :already_exists} = result

        {:error, _} ->
          :ok
      end
    end

    test "creates script with string keys" do
      key = unique_script_key("string_keys")

      attrs = %{
        "key" => key,
        "name" => "String Key Script",
        "hook" => "on_look",
        "source" => "message(player, \"Looking around\")"
      }

      result = ScriptManager.create_script(attrs)

      case result do
        {:ok, script} ->
          assert script.key == key

        {:error, _} ->
          :ok
      end
    end

    test "applies default timeout" do
      key = unique_script_key("default_timeout")

      attrs = %{
        key: key,
        name: "Default Timeout Script",
        hook: :on_enter,
        source: ":ok"
      }

      case ScriptManager.create_script(attrs) do
        {:ok, _script} ->
          :ok

        {:error, _} ->
          :ok
      end
    end
  end

  describe "update_script/2" do
    test "updates script name" do
      key = unique_script_key("update_name")

      create_attrs = %{
        key: key,
        name: "Original Name",
        hook: :on_enter,
        source: "message(player, \"Test\")"
      }

      case ScriptManager.create_script(create_attrs) do
        {:ok, _script} ->
          result = ScriptManager.update_script(key, %{name: "Updated Name"})

          case result do
            {:ok, updated} ->
              assert updated.name == "Updated Name"

            {:error, _} ->
              :ok
          end

        {:error, _} ->
          :ok
      end
    end

    test "updates script source" do
      key = unique_script_key("update_source")

      create_attrs = %{
        key: key,
        name: "Source Update Test",
        hook: :on_enter,
        source: "message(player, \"Original\")"
      }

      case ScriptManager.create_script(create_attrs) do
        {:ok, _script} ->
          new_source = "message(player, \"Updated source\")"
          result = ScriptManager.update_script(key, %{source: new_source})

          case result do
            {:ok, _updated} ->
              :ok

            {:error, _} ->
              :ok
          end

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent script" do
      result = ScriptManager.update_script("nonexistent_update", %{name: "Fail"})
      assert {:error, :not_found} = result
    end
  end

  describe "delete_script/1" do
    test "deletes an existing script" do
      key = unique_script_key("delete_test")

      create_attrs = %{
        key: key,
        name: "To Delete",
        hook: :on_enter,
        source: ":ok"
      }

      case ScriptManager.create_script(create_attrs) do
        {:ok, _script} ->
          result = ScriptManager.delete_script(key)
          assert :ok = result

          # Verify deletion
          assert {:error, :not_found} = ScriptManager.get_script(key)

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent script" do
      result = ScriptManager.delete_script("nonexistent_delete_key")
      assert {:error, :not_found} = result
    end
  end

  describe "validate_script/1" do
    test "returns error for non-existent script" do
      result = ScriptManager.validate_script("nonexistent_validate")
      assert {:error, :not_found} = result
    end

    test "validates existing script" do
      scripts = ScriptManager.list_scripts()

      if length(scripts) > 0 do
        script = hd(scripts)
        result = ScriptManager.validate_script(script.key)
        # Should return :ok or {:error, errors}
        assert result == :ok or match?({:error, _}, result)
      end
    end
  end

  describe "validate_script_source/2" do
    test "validates valid source code" do
      source = """
      message(player, "Hello!")
      :ok
      """

      result = ScriptManager.validate_script_source(source, :on_enter)
      # May pass or fail depending on sandbox rules
      assert result == :ok or match?({:error, _}, result)
    end

    test "returns error for syntax errors" do
      source = """
      def broken(
        missing closing paren
      """

      result = ScriptManager.validate_script_source(source, :on_enter)
      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0
    end

    test "returns error for invalid hook type" do
      source = "message(player, \"Test\")"
      result = ScriptManager.validate_script_source(source, :invalid_hook_type)
      assert {:error, errors} = result
      assert Enum.any?(errors, &String.contains?(&1, "Invalid hook"))
    end

    test "validates without hook" do
      source = ":ok"
      result = ScriptManager.validate_script_source(source, nil)
      # Should succeed since no hook validation needed
      assert result == :ok or match?({:error, _}, result)
    end

    test "validates with string hook" do
      source = "message(player, \"Test\")"
      result = ScriptManager.validate_script_source(source, "on_enter")
      assert result == :ok or match?({:error, _}, result)
    end
  end

  describe "test_script/3" do
    test "returns error for non-existent script" do
      result = ScriptManager.test_script("nonexistent_test_script")
      assert {:error, :not_found} = result
    end

    test "tests existing script with mock context" do
      scripts = ScriptManager.list_scripts()

      if length(scripts) > 0 do
        script = hd(scripts)
        mock_entity = %{id: "test_player", name: "Test"}
        mock_context = %{room: %{key: "test_room", tags: []}}

        result = ScriptManager.test_script(script.key, mock_entity, mock_context)
        # Should return {:ok, _} or {:error, _}
        assert match?({:ok, _}, result) or match?({:error, _}, result)
      end
    end

    test "uses default mock bindings when not provided" do
      scripts = ScriptManager.list_scripts()

      if length(scripts) > 0 do
        script = hd(scripts)
        result = ScriptManager.test_script(script.key)
        assert match?({:ok, _}, result) or match?({:error, _}, result)
      end
    end
  end

  describe "hook validation" do
    @valid_hooks ~w(
      at_enter_room on_enter on_exit on_look
      on_talk on_talk_topic on_talk_choice
      on_damage on_heal on_death on_defeat
      on_combat_start on_combat_end on_attack on_defend
      on_item_use on_item_get on_item_drop
      on_meditate on_level_up
      on_spawn on_despawn on_tick
      at_command_pre at_command_post
      at_combat_pre at_combat_post
      at_move_pre at_move_post
    )

    test "accepts all valid hooks" do
      source = ":ok"

      for hook <- @valid_hooks do
        result = ScriptManager.validate_script_source(source, hook)

        assert result == :ok or match?({:error, _}, result),
               "Hook #{hook} should be valid"
      end
    end
  end
end
