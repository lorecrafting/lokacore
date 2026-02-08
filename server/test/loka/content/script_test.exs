defmodule Loka.Content.ScriptTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Script
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns script by key" do
      {:ok, script} =
        TypedObject.new(
          key: "test_script",
          type: :script,
          data: %{
            "hook" => "on_enter",
            "source" => "message(player, \"Hello!\")"
          }
        )

      Registry.put("test_script", script)

      assert {:ok, fetched} = Script.get("test_script")
      assert fetched.key == "test_script"
    end

    test "returns error for non-script" do
      {:ok, entity} = TypedObject.new(key: "not_script", type: :entity)
      Registry.put("not_script", entity)

      assert {:error, :not_found} = Script.get("not_script")
    end
  end

  describe "for_hook/1" do
    test "returns scripts for hook" do
      {:ok, s1} =
        TypedObject.new(
          key: "script1",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "1 + 1"}
        )

      {:ok, s2} =
        TypedObject.new(
          key: "script2",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "2 + 2"}
        )

      {:ok, s3} =
        TypedObject.new(
          key: "script3",
          type: :script,
          data: %{"hook" => "on_exit", "source" => "3 + 3"}
        )

      Registry.put("script1", s1)
      Registry.put("script2", s2)
      Registry.put("script3", s3)

      enter_scripts = Script.for_hook(:on_enter)
      assert length(enter_scripts) == 2

      exit_scripts = Script.for_hook(:on_exit)
      assert length(exit_scripts) == 1
    end
  end

  describe "source/1" do
    test "returns source code" do
      {:ok, script} =
        TypedObject.new(
          key: "source_test",
          type: :script,
          data: %{"hook" => "on_say", "source" => "player.name"}
        )

      assert Script.source(script) == "player.name"
    end
  end

  describe "bindings/1" do
    test "returns bindings as atoms" do
      {:ok, script} =
        TypedObject.new(
          key: "bindings_test",
          type: :script,
          data: %{
            "hook" => "on_enter",
            "source" => "message(player, text)",
            "bindings" => ["player", "message"]
          }
        )

      assert Script.bindings(script) == [:player, :message]
    end

    test "returns empty list when no bindings" do
      {:ok, script} =
        TypedObject.new(
          key: "no_bindings",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "1 + 1"}
        )

      assert Script.bindings(script) == []
    end
  end

  describe "timeout_ms/1" do
    test "returns custom timeout" do
      {:ok, script} =
        TypedObject.new(
          key: "timeout_test",
          type: :script,
          data: %{"hook" => "on_say", "source" => "1", "timeout_ms" => 1000}
        )

      assert Script.timeout_ms(script) == 1000
    end

    test "returns default timeout" do
      {:ok, script} =
        TypedObject.new(
          key: "default_timeout",
          type: :script,
          data: %{"hook" => "on_say", "source" => "1"}
        )

      assert Script.timeout_ms(script) == 5000
    end
  end

  describe "valid_syntax?/1" do
    test "returns true for valid Elixir" do
      {:ok, script} =
        TypedObject.new(
          key: "valid_syntax",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "if true, do: 1, else: 2"}
        )

      assert Script.valid_syntax?(script)
    end

    test "returns false for invalid Elixir" do
      {:ok, script} =
        TypedObject.new(
          key: "invalid_syntax",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "if then else"}
        )

      refute Script.valid_syntax?(script)
    end

    test "returns false for nil source" do
      {:ok, script} =
        TypedObject.new(
          key: "nil_source",
          type: :script,
          data: %{"hook" => "on_enter"}
        )

      refute Script.valid_syntax?(script)
    end
  end

  describe "validate/1" do
    test "passes for valid script" do
      {:ok, script} =
        TypedObject.new(
          key: "valid_script",
          type: :script,
          data: %{
            "hook" => "on_enter",
            "source" => "message(player, \"Welcome!\")"
          }
        )

      assert :ok = Script.validate(script)
    end

    test "fails for script without source" do
      {:ok, script} =
        TypedObject.new(
          key: "no_source",
          type: :script,
          data: %{"hook" => "on_enter"}
        )

      assert {:error, errors} = Script.validate(script)
      assert "script must have source code" in errors
    end

    test "fails for script without hook" do
      {:ok, script} =
        TypedObject.new(
          key: "no_hook",
          type: :script,
          data: %{"source" => "1 + 1"}
        )

      assert {:error, errors} = Script.validate(script)
      assert "script must specify a hook" in errors
    end

    test "fails for invalid syntax" do
      {:ok, script} =
        TypedObject.new(
          key: "bad_syntax",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "def foo("}
        )

      assert {:error, errors} = Script.validate(script)
      assert Enum.any?(errors, &String.contains?(&1, "syntax error"))
    end
  end
end
