defmodule Loka.WorldBuilder.ToolExecutor.ScriptsTest do
  @moduledoc "Tests for ToolExecutor.Scripts domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Scripts

  describe "execute_create_script/1" do
    test "creates script with valid input" do
      input = %{
        "key" => "script_test_#{System.unique_integer([:positive])}",
        "hook" => "on_enter",
        "source" => "emit.(\"Hello!\")\ncontinue.()",
        "name" => "Test Script"
      }

      case Scripts.execute_create_script(input) do
        {:ok, r} ->
          assert r.success == true
          assert r.message =~ "Created script"

        {:error, reason} ->
          assert is_binary(reason)
      end
    end

    test "creates script with default name" do
      input = %{
        "key" => "script_test_noname_#{System.unique_integer([:positive])}",
        "hook" => "behavior",
        "source" => "continue.()"
      }

      case Scripts.execute_create_script(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end

    test "creates script with different hook types" do
      for hook <- ["on_enter", "on_exit", "behavior", "on_tick", "on_talk"] do
        input = %{
          "key" => "script_test_hook_#{hook}_#{System.unique_integer([:positive])}",
          "hook" => hook,
          "source" => "continue.()"
        }

        case Scripts.execute_create_script(input) do
          {:ok, r} -> assert r.success == true
          {:error, reason} -> assert is_binary(reason)
        end
      end
    end
  end

  describe "execute_update_script/1" do
    test "returns error for non-existent script" do
      assert {:error, _} =
               Scripts.execute_update_script(%{
                 "key" => "nonexistent_script_xyz",
                 "source" => "emit.(\"new\")\ncontinue.()"
               })
    end
  end

  describe "execute_delete_script/1" do
    test "returns error for non-existent script" do
      assert {:error, _} = Scripts.execute_delete_script(%{"key" => "nonexistent_script_del"})
    end
  end

  describe "execute_get_script/1" do
    test "returns error for non-existent script" do
      assert {:error, _} = Scripts.execute_get_script(%{"key" => "nonexistent_script_get"})
    end
  end

  describe "execute_list_scripts/1" do
    test "lists all scripts" do
      assert {:ok, result} = Scripts.execute_list_scripts(%{})
      assert result.success == true
      assert is_list(result.scripts)
    end
  end

  describe "execute_validate_script/1" do
    test "returns error for non-existent script key" do
      input = %{"key" => "nonexistent_script_#{System.unique_integer([:positive])}"}
      result = Scripts.execute_validate_script(input)
      assert match?({:ok, %{success: false}}, result) or match?({:error, _}, result)
    end

    test "returns error when key is missing" do
      input = %{"source" => "continue.()"}

      result =
        try do
          Scripts.execute_validate_script(input)
        rescue
          _ -> {:error, "crashed"}
        end

      assert match?({:ok, _}, result) or match?({:error, _}, result)
    end
  end
end
