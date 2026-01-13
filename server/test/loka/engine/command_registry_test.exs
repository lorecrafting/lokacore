defmodule Loka.Engine.CommandRegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Engine.CommandRegistry

  # Test command module
  defmodule TestCommand do
    use Loka.Engine.Command

    def key, do: "test"
    def aliases, do: ["t", "testing"]
    def help, do: "A test command."

    def parse(args, _context) do
      {:ok, %{args: args}}
    end

    def execute(%{args: args}, _context) do
      event = %{
        type: :test,
        text: "Test executed with args: #{args}",
        timestamp: DateTime.utc_now()
      }

      {:ok, [event]}
    end
  end

  # Test command with locks
  defmodule AdminCommand do
    use Loka.Engine.Command

    def key, do: "admin_test"
    def aliases, do: []
    def help, do: "An admin-only command."
    def locks, do: [:admin]

    def parse(_args, _context), do: {:ok, %{}}

    def execute(_parsed, _context) do
      {:ok, [%{type: :admin, text: "Admin action"}]}
    end
  end

  # Test command that fails parsing
  defmodule FailingParseCommand do
    use Loka.Engine.Command

    def key, do: "fail_parse"
    def aliases, do: []
    def help, do: "A command that fails parsing."

    def parse(_args, _context), do: {:error, "Parse failed"}
    def execute(_parsed, _context), do: {:ok, []}
  end

  setup do
    # Start a fresh registry for each test
    {:ok, pid} = CommandRegistry.start_link(name: :test_registry, register_builtins: false)

    on_exit(fn ->
      if Process.alive?(pid), do: GenServer.stop(pid)
    end)

    {:ok, registry: :test_registry}
  end

  describe "register/2" do
    test "registers a valid command", %{registry: registry} do
      assert :ok = CommandRegistry.register(TestCommand, registry)
      assert {:ok, TestCommand} = CommandRegistry.get("test", registry)
    end

    test "registers command aliases", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)

      assert {:ok, TestCommand} = CommandRegistry.get("t", registry)
      assert {:ok, TestCommand} = CommandRegistry.get("testing", registry)
    end

    test "rejects invalid modules", %{registry: registry} do
      assert {:error, :invalid_command} = CommandRegistry.register(String, registry)
    end
  end

  describe "unregister/2" do
    test "removes a registered command", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      assert :ok = CommandRegistry.unregister("test", registry)
      assert {:error, :not_found} = CommandRegistry.get("test", registry)
    end

    test "removes aliases when unregistering", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      :ok = CommandRegistry.unregister("test", registry)

      assert {:error, :not_found} = CommandRegistry.get("t", registry)
      assert {:error, :not_found} = CommandRegistry.get("testing", registry)
    end

    test "returns error for unknown command", %{registry: registry} do
      assert {:error, :not_found} = CommandRegistry.unregister("unknown", registry)
    end
  end

  describe "get/2" do
    test "returns command by key", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      assert {:ok, TestCommand} = CommandRegistry.get("test", registry)
    end

    test "returns command by alias", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      assert {:ok, TestCommand} = CommandRegistry.get("t", registry)
    end

    test "returns not_found for unknown command", %{registry: registry} do
      assert {:error, :not_found} = CommandRegistry.get("unknown", registry)
    end
  end

  describe "execute/4" do
    test "executes a command and returns events", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)

      context = %{
        actor: %{player_id: "player1"},
        location: nil,
        game_state: %{}
      }

      assert {:ok, [event]} = CommandRegistry.execute("test", "hello", context, registry)
      assert event.type == :test
      assert event.text == "Test executed with args: hello"
    end

    test "executes via alias", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)

      context = %{actor: %{player_id: "player1"}}
      assert {:ok, [_event]} = CommandRegistry.execute("t", "args", context, registry)
    end

    test "returns not_found for unknown command", %{registry: registry} do
      context = %{actor: %{player_id: "player1"}}
      assert {:error, :not_found} = CommandRegistry.execute("unknown", "", context, registry)
    end

    test "returns parse error", %{registry: registry} do
      :ok = CommandRegistry.register(FailingParseCommand, registry)

      context = %{actor: %{player_id: "player1"}}

      assert {:error, "Parse failed"} =
               CommandRegistry.execute("fail_parse", "", context, registry)
    end

    test "checks locks and denies access", %{registry: registry} do
      :ok = CommandRegistry.register(AdminCommand, registry)

      context = %{actor: %{player_id: "player1", is_admin: false, permissions: []}}

      assert {:error, {:access_denied, _reason}} =
               CommandRegistry.execute("admin_test", "", context, registry)
    end

    test "allows admin access to locked commands", %{registry: registry} do
      :ok = CommandRegistry.register(AdminCommand, registry)

      context = %{actor: %{player_id: "player1", is_admin: true}}
      assert {:ok, [_event]} = CommandRegistry.execute("admin_test", "", context, registry)
    end
  end

  describe "list_commands/1" do
    test "lists all registered command keys", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      :ok = CommandRegistry.register(AdminCommand, registry)

      commands = CommandRegistry.list_commands(registry)
      assert "test" in commands
      assert "admin_test" in commands
      assert length(commands) == 2
    end
  end

  describe "registered?/2" do
    test "returns true for registered command", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      assert CommandRegistry.registered?("test", registry)
      assert CommandRegistry.registered?("t", registry)
    end

    test "returns false for unregistered command", %{registry: registry} do
      refute CommandRegistry.registered?("unknown", registry)
    end
  end

  describe "help/2" do
    test "returns help text for command", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      assert {:ok, "A test command."} = CommandRegistry.help("test", registry)
    end

    test "returns help via alias", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      assert {:ok, "A test command."} = CommandRegistry.help("t", registry)
    end

    test "returns not_found for unknown command", %{registry: registry} do
      assert {:error, :not_found} = CommandRegistry.help("unknown", registry)
    end
  end

  describe "command_info/1" do
    test "returns info for all commands", %{registry: registry} do
      :ok = CommandRegistry.register(TestCommand, registry)
      :ok = CommandRegistry.register(AdminCommand, registry)

      info = CommandRegistry.command_info(registry)
      assert length(info) == 2

      test_info = Enum.find(info, &(&1.key == "test"))
      assert test_info.aliases == ["t", "testing"]
      assert test_info.help == "A test command."
    end
  end
end
