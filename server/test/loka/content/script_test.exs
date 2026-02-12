defmodule Loka.Content.ScriptTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Script
  alias Loka.Engine.{Entity, Entities}

  defp create_script(key, data) do
    entity =
      Entity.new(
        type: :script,
        key: key,
        short_desc: key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns script by key" do
      create_script("test_script", %{
        "hook" => "on_enter",
        "source" => "message(player, \"Hello!\")"
      })

      assert {:ok, fetched} = Script.get("test_script")
      assert fetched.key == "test_script"
    end

    test "returns error for non-script" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_script",
          short_desc: "Not a script",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Script.get("not_script")
    end
  end

  describe "for_hook/1" do
    test "returns scripts for hook" do
      create_script("script1", %{"hook" => "on_enter", "source" => "1 + 1"})
      create_script("script2", %{"hook" => "on_enter", "source" => "2 + 2"})
      create_script("script3", %{"hook" => "on_exit", "source" => "3 + 3"})

      enter_scripts = Script.for_hook(:on_enter)
      assert length(enter_scripts) == 2

      exit_scripts = Script.for_hook(:on_exit)
      assert length(exit_scripts) == 1
    end
  end

  describe "source/1" do
    test "returns source code" do
      entity = create_script("source_test", %{"hook" => "on_say", "source" => "player.name"})
      {:ok, script} = Entity.to_typed_object(entity)

      assert Script.source(script) == "player.name"
    end
  end

  describe "bindings/1" do
    test "returns bindings as atoms" do
      entity =
        create_script("bindings_test", %{
          "hook" => "on_enter",
          "source" => "message(player, text)",
          "bindings" => ["player", "message"]
        })

      {:ok, script} = Entity.to_typed_object(entity)

      assert Script.bindings(script) == [:player, :message]
    end

    test "returns empty list when no bindings" do
      entity = create_script("no_bindings", %{"hook" => "on_enter", "source" => "1 + 1"})
      {:ok, script} = Entity.to_typed_object(entity)

      assert Script.bindings(script) == []
    end
  end

  describe "timeout_ms/1" do
    test "returns custom timeout" do
      entity =
        create_script("timeout_test", %{
          "hook" => "on_say",
          "source" => "1",
          "timeout_ms" => 1000
        })

      {:ok, script} = Entity.to_typed_object(entity)

      assert Script.timeout_ms(script) == 1000
    end

    test "returns default timeout" do
      entity = create_script("default_timeout", %{"hook" => "on_say", "source" => "1"})
      {:ok, script} = Entity.to_typed_object(entity)

      assert Script.timeout_ms(script) == 5000
    end
  end

  describe "valid_syntax?/1" do
    test "returns true for valid Elixir" do
      entity =
        create_script("valid_syntax", %{
          "hook" => "on_enter",
          "source" => "if true, do: 1, else: 2"
        })

      {:ok, script} = Entity.to_typed_object(entity)

      assert Script.valid_syntax?(script)
    end

    test "returns false for invalid Elixir" do
      entity =
        create_script("invalid_syntax", %{
          "hook" => "on_enter",
          "source" => "if then else"
        })

      {:ok, script} = Entity.to_typed_object(entity)

      refute Script.valid_syntax?(script)
    end

    test "returns false for nil source" do
      entity = create_script("nil_source", %{"hook" => "on_enter"})
      {:ok, script} = Entity.to_typed_object(entity)

      refute Script.valid_syntax?(script)
    end
  end

  describe "validate/1" do
    test "passes for valid script" do
      entity =
        create_script("valid_script", %{
          "hook" => "on_enter",
          "source" => "message(player, \"Welcome!\")"
        })

      {:ok, script} = Entity.to_typed_object(entity)

      assert :ok = Script.validate(script)
    end

    test "fails for script without source" do
      entity = create_script("no_source", %{"hook" => "on_enter"})
      {:ok, script} = Entity.to_typed_object(entity)

      assert {:error, errors} = Script.validate(script)
      assert "script must have source code" in errors
    end

    test "fails for script without hook" do
      entity = create_script("no_hook", %{"source" => "1 + 1"})
      {:ok, script} = Entity.to_typed_object(entity)

      assert {:error, errors} = Script.validate(script)
      assert "script must specify a hook" in errors
    end

    test "fails for invalid syntax" do
      entity =
        create_script("bad_syntax", %{
          "hook" => "on_enter",
          "source" => "def foo("
        })

      {:ok, script} = Entity.to_typed_object(entity)

      assert {:error, errors} = Script.validate(script)
      assert Enum.any?(errors, &String.contains?(&1, "syntax error"))
    end
  end
end
