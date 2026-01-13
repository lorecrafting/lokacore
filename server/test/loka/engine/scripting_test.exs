defmodule Loka.Engine.ScriptingTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Entity
  alias Loka.Engine.Scripting

  # Create a minimal entity for testing
  defp test_entity(attrs \\ %{}) do
    base = %Entity{
      id: "test_entity_#{:erlang.unique_integer()}",
      type: :npc,
      short_desc: "Test Entity",
      long_desc: "A test entity for scripting.",
      extra_desc: "Extra description",
      keywords: ["test", "entity"],
      mood: "neutral",
      location_id: "test_room"
    }

    Map.merge(base, attrs)
  end

  describe "execute/4" do
    test "executes simple Lua script and returns result" do
      entity = test_entity()
      script = "return 42"

      {:ok, [result]} = Scripting.execute(script, entity)
      # Luerl may return integers or floats depending on the value
      assert result == 42 or result == 42.0
    end

    test "executes script with string result" do
      entity = test_entity()
      script = ~s[return "hello world"]

      assert {:ok, ["hello world"]} = Scripting.execute(script, entity)
    end

    test "executes script with boolean result" do
      entity = test_entity()
      script = "return true"

      assert {:ok, [true]} = Scripting.execute(script, entity)
    end

    test "executes script with nil result" do
      entity = test_entity()
      script = "return nil"

      assert {:ok, [nil]} = Scripting.execute(script, entity)
    end

    test "provides access to entity data" do
      entity = test_entity(%{short_desc: "Goblin Guard"})
      script = "return entity.name"

      assert {:ok, ["Goblin Guard"]} = Scripting.execute(script, entity)
    end

    test "provides access to entity id" do
      entity = test_entity()
      script = "return entity.id"

      assert {:ok, [entity.id]} == Scripting.execute(script, entity)
    end

    test "provides access to entity type" do
      entity = test_entity(%{type: :npc})
      script = "return entity.type"

      assert {:ok, ["npc"]} = Scripting.execute(script, entity)
    end

    test "provides access to context values" do
      entity = test_entity()
      context = %{custom_value: "test_data", number: 42}
      script = "return context.custom_value"

      assert {:ok, ["test_data"]} = Scripting.execute(script, entity, context)
    end

    test "returns error for invalid Lua syntax" do
      entity = test_entity()
      script = "this is not valid lua syntax @#$%"

      assert {:error, {:script_error, _reason}} = Scripting.execute(script, entity)
    end

    test "returns error for runtime Lua error" do
      entity = test_entity()
      # Calling a nil value results in error (script_exception for undefined function)
      script = "return undefined_function()"

      result = Scripting.execute(script, entity)
      assert {:error, _} = result
    end

    test "times out on long-running scripts" do
      entity = test_entity()
      # Infinite loop
      script = "while true do end"

      # Use short timeout
      assert {:error, :script_timeout} = Scripting.execute(script, entity, %{}, timeout: 100)
    end

    test "respects custom timeout option" do
      entity = test_entity()
      script = "return 1"

      # Very short timeout should still work for quick scripts
      assert {:ok, [1]} = Scripting.execute(script, entity, %{}, timeout: 1000)
    end
  end

  describe "execute/4 with game API" do
    test "game.log is available" do
      entity = test_entity()
      script = ~s[game.log("test message")]

      # Should not raise, returns empty result
      assert {:ok, _} = Scripting.execute(script, entity)
    end

    test "game.message is available" do
      entity = test_entity()
      script = ~s[game.message("player_1", "Hello player!")]

      # Should not raise
      assert {:ok, _} = Scripting.execute(script, entity)
    end
  end

  describe "sandbox security" do
    # Helper to assert that a sandbox violation results in an error
    # The exact error type varies: removed functions return script_exception,
    # while blocked module accesses may return script_error
    defp assert_sandbox_error(script) do
      entity = test_entity()
      result = Scripting.execute(script, entity)
      assert {:error, _} = result
    end

    test "os module is not available" do
      assert_sandbox_error("return os.execute('ls')")
    end

    test "io module is not available" do
      assert_sandbox_error("return io.open('test.txt', 'r')")
    end

    test "debug module is not available" do
      assert_sandbox_error("return debug.getinfo(1)")
    end

    test "require is not available" do
      assert_sandbox_error("return require('os')")
    end

    test "dofile is not available" do
      assert_sandbox_error("return dofile('/etc/passwd')")
    end

    test "loadfile is not available" do
      assert_sandbox_error("return loadfile('/etc/passwd')")
    end

    test "getmetatable is not available" do
      assert_sandbox_error("return getmetatable('')")
    end

    test "setmetatable is not available" do
      assert_sandbox_error("return setmetatable({}, {})")
    end

    test "rawget is not available" do
      assert_sandbox_error("return rawget({a=1}, 'a')")
    end

    test "rawset is not available" do
      assert_sandbox_error("return rawset({}, 'a', 1)")
    end

    test "collectgarbage is not available" do
      assert_sandbox_error("return collectgarbage('count')")
    end

    test "string.dump is not available" do
      assert_sandbox_error("return string.dump(function() end)")
    end

    test "coroutine module is not available" do
      assert_sandbox_error("return coroutine.create(function() end)")
    end

    test "package module is not available" do
      assert_sandbox_error("return package.path")
    end
  end

  describe "validate_script/1" do
    test "returns :ok for valid safe script" do
      script = ~s[
        local x = 10
        if x > 5 then
          return "greater"
        else
          return "lesser"
        end
      ]

      assert :ok = Scripting.validate_script(script)
    end

    test "rejects script with os module access" do
      script = "os.execute('rm -rf /')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with io module access" do
      script = "io.open('file.txt')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with debug module access" do
      script = "debug.getinfo(1)"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with require" do
      script = "require('socket')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with dofile" do
      script = "dofile('/etc/passwd')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with loadfile" do
      script = "loadfile('/etc/passwd')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with load" do
      script = "load('return 1')()"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with loadstring" do
      script = "loadstring('return 1')()"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with getmetatable" do
      script = "getmetatable('')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with setmetatable" do
      script = "setmetatable({}, {})"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with rawget" do
      script = "rawget({}, 'key')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with rawset" do
      script = "rawset({}, 'key', 'value')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with _G access" do
      script = "return _G.print"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with _ENV access" do
      script = "return _ENV"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with string.dump" do
      script = "string.dump(function() end)"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with collectgarbage" do
      script = "collectgarbage('count')"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with coroutine access" do
      script = "coroutine.create(function() end)"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script with hex escape sequences" do
      script = ~s[local x = "\\x41\\x42"]

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script that reassigns os" do
      script = "os = {}"

      assert {:error, {:blocked_pattern, _}} = Scripting.validate_script(script)
    end

    test "rejects script that is too long" do
      # Create a script over 50,000 characters
      long_script = String.duplicate("x = 1\n", 10_001)

      assert {:error, {:script_too_long, _}} = Scripting.validate_script(long_script)
    end

    test "allows safe string operations" do
      script = ~s[
        local s = "hello"
        return string.upper(s)
      ]

      assert :ok = Scripting.validate_script(script)
    end

    test "allows safe table operations" do
      script = ~s[
        local t = {a = 1, b = 2}
        t.c = 3
        return t.a + t.b + t.c
      ]

      assert :ok = Scripting.validate_script(script)
    end

    test "allows safe math operations" do
      script = ~s[
        local x = math.sqrt(16)
        local y = math.floor(3.7)
        return x + y
      ]

      assert :ok = Scripting.validate_script(script)
    end
  end

  describe "result size limits" do
    test "accepts normal-sized results" do
      entity = test_entity()
      script = ~s[return "normal result"]

      assert {:ok, ["normal result"]} = Scripting.execute(script, entity)
    end

    test "rejects results that are too large" do
      entity = test_entity()
      # Create a large string in Lua
      script = "return string.rep('x', 20000)"

      assert {:error, :result_too_large} = Scripting.execute(script, entity)
    end
  end
end
