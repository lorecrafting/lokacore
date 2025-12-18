defmodule Exmud.Engine.ScriptsTest do
  use Exmud.DataCase

  alias Exmud.Engine.Scripts
  alias Exmud.Engine.Schema.ScriptSchema

  import Exmud.EngineFixtures

  describe "list_scripts/0" do
    test "returns all scripts ordered by name" do
      script1 = script_fixture(%{name: "b_script"})
      script2 = script_fixture(%{name: "a_script"})

      result = Scripts.list_scripts()
      assert length(result) == 2
      assert hd(result).id == script2.id
      assert List.last(result).id == script1.id
    end

    test "returns empty list when no scripts" do
      assert Scripts.list_scripts() == []
    end
  end

  describe "get_script!/1" do
    test "returns script with given id" do
      script = script_fixture()
      assert Scripts.get_script!(script.id).id == script.id
    end

    test "raises for non-existent id" do
      assert_raise Ecto.NoResultsError, fn ->
        Scripts.get_script!(-1)
      end
    end
  end

  describe "get_script/1" do
    test "returns script with given id" do
      script = script_fixture()
      assert Scripts.get_script(script.id).id == script.id
    end

    test "returns nil for non-existent id" do
      assert is_nil(Scripts.get_script(-1))
    end
  end

  describe "get_script_by_name/1" do
    test "returns script with given name" do
      script = script_fixture()
      assert Scripts.get_script_by_name(script.name).id == script.id
    end

    test "returns nil for non-existent name" do
      assert is_nil(Scripts.get_script_by_name("nonexistent"))
    end
  end

  describe "create_script/1" do
    test "creates script with valid data" do
      attrs = valid_script_attrs()
      assert {:ok, %ScriptSchema{} = script} = Scripts.create_script(attrs)
      assert script.name == attrs.name
      assert script.description == attrs.description
      assert script.source == attrs.source
      assert script.hook == attrs.hook
      assert script.enabled == true
    end

    test "returns error for missing required fields" do
      assert {:error, changeset} = Scripts.create_script(%{})
      assert %{name: ["can't be blank"], source: ["can't be blank"]} = errors_on(changeset)
    end

    test "returns error for duplicate name" do
      script = script_fixture()
      assert {:error, changeset} = Scripts.create_script(%{name: script.name, source: "return true"})
      assert %{name: ["has already been taken"]} = errors_on(changeset)
    end

    test "creates disabled script" do
      attrs = valid_script_attrs(%{enabled: false})
      assert {:ok, script} = Scripts.create_script(attrs)
      assert script.enabled == false
    end
  end

  describe "update_script/2" do
    test "updates script with valid data" do
      script = script_fixture()
      assert {:ok, updated} = Scripts.update_script(script, %{name: "updated_script"})
      assert updated.name == "updated_script"
    end

    test "updates script source" do
      script = script_fixture()
      new_source = "return 42"
      assert {:ok, updated} = Scripts.update_script(script, %{source: new_source})
      assert updated.source == new_source
    end

    test "returns error for invalid data" do
      script = script_fixture()
      assert {:error, changeset} = Scripts.update_script(script, %{name: nil})
      assert %{name: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "delete_script/1" do
    test "deletes script" do
      script = script_fixture()
      assert {:ok, %ScriptSchema{}} = Scripts.delete_script(script)
      assert is_nil(Scripts.get_script(script.id))
    end
  end

  describe "count_scripts/0" do
    test "returns count of all scripts" do
      assert Scripts.count_scripts() == 0
      script_fixture()
      assert Scripts.count_scripts() == 1
      script_fixture()
      assert Scripts.count_scripts() == 2
    end
  end

  describe "list_scripts/1 with hook filter" do
    test "returns scripts with specified hook" do
      script1 = script_fixture(%{hook: "on_enter"})
      _script2 = script_fixture(%{hook: "on_tick"})

      result = Scripts.list_scripts(hook: "on_enter")
      assert length(result) == 1
      assert hd(result).id == script1.id
    end

    test "returns empty list for non-existent hook" do
      _script = script_fixture(%{hook: "on_enter"})
      assert Scripts.list_scripts(hook: "nonexistent") == []
    end
  end

  describe "list_scripts/1 with enabled filter" do
    test "returns only enabled scripts" do
      enabled = script_fixture(%{enabled: true})
      _disabled = script_fixture(%{enabled: false})

      result = Scripts.list_scripts(enabled: true)
      assert length(result) == 1
      assert hd(result).id == enabled.id
    end

    test "returns only disabled scripts" do
      _enabled = script_fixture(%{enabled: true})
      disabled = script_fixture(%{enabled: false})

      result = Scripts.list_scripts(enabled: false)
      assert length(result) == 1
      assert hd(result).id == disabled.id
    end
  end

  describe "toggle_script/1" do
    test "toggles script from enabled to disabled" do
      script = script_fixture(%{enabled: true})
      assert {:ok, updated} = Scripts.toggle_script(script)
      assert updated.enabled == false
    end

    test "toggles script from disabled to enabled" do
      script = script_fixture(%{enabled: false})
      assert {:ok, updated} = Scripts.toggle_script(script)
      assert updated.enabled == true
    end
  end

  describe "enable_script/1" do
    test "enables a disabled script" do
      script = script_fixture(%{enabled: false})
      assert {:ok, updated} = Scripts.enable_script(script)
      assert updated.enabled == true
    end
  end

  describe "disable_script/1" do
    test "disables an enabled script" do
      script = script_fixture(%{enabled: true})
      assert {:ok, updated} = Scripts.disable_script(script)
      assert updated.enabled == false
    end
  end

  describe "get_scripts_for_hook/1" do
    test "returns enabled scripts for a hook" do
      enabled = script_fixture(%{hook: "on_enter", enabled: true})
      _disabled = script_fixture(%{hook: "on_enter", enabled: false})
      _other_hook = script_fixture(%{hook: "on_tick", enabled: true})

      result = Scripts.get_scripts_for_hook("on_enter")
      assert length(result) == 1
      assert hd(result).id == enabled.id
    end
  end
end
