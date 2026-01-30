defmodule Loka.Admin.AuditTest do
  use Loka.DataCase, async: false

  alias Loka.Admin.{Audit, AuditLog}
  alias Loka.Repo

  # Helper to create a properly initialized socket for testing
  defp test_socket(assigns \\ %{}) do
    %Phoenix.LiveView.Socket{
      assigns: Map.merge(%{__changed__: %{}}, assigns)
    }
  end

  describe "init_context/3" do
    test "assigns audit_context to socket" do
      socket = test_socket()
      player = %{id: 123}

      socket = Audit.init_context(socket, player)

      assert socket.assigns.audit_context.player_id == 123
      assert socket.assigns.audit_context.ip_address == nil
      assert socket.assigns.audit_context.user_agent == nil
    end

    test "extracts IP from peer_data" do
      socket = test_socket()
      player = %{id: 123}
      conn_info = %{peer_data: %{address: {192, 168, 1, 100}}}

      socket = Audit.init_context(socket, player, conn_info)

      assert socket.assigns.audit_context.ip_address == "192.168.1.100"
    end

    test "extracts user_agent from conn_info" do
      socket = test_socket()
      player = %{id: 123}
      conn_info = %{user_agent: "Mozilla/5.0"}

      socket = Audit.init_context(socket, player, conn_info)

      assert socket.assigns.audit_context.user_agent == "Mozilla/5.0"
    end

    test "handles nil player" do
      socket = test_socket()

      socket = Audit.init_context(socket, nil)

      assert socket.assigns.audit_context.player_id == nil
    end
  end

  describe "log/7" do
    test "returns socket unchanged" do
      socket =
        test_socket(%{
          audit_context: %{player_id: nil, ip_address: nil, user_agent: nil}
        })

      result = Audit.log(socket, :create, :room, "tavern", nil, %{name: "Tavern"})

      # Socket should have same assigns (audit_context unchanged)
      assert result.assigns.audit_context == socket.assigns.audit_context
    end

    test "handles missing audit_context gracefully" do
      socket = test_socket()

      # Should not raise, just log warning
      result = Audit.log(socket, :create, :room, "tavern", nil, %{})

      assert result.assigns.__changed__ == socket.assigns.__changed__
    end
  end

  # Note: Async logging is tested via log_sync which is synchronous
  # The async Task.Supervisor requires shared sandbox mode which complicates tests

  describe "log_sync/7" do
    test "logs action synchronously" do
      {:ok, player} =
        Loka.Accounts.register_player(%{
          email: "audit_sync_#{System.unique_integer()}@example.com",
          password: "password123456"
        })

      socket =
        test_socket(%{
          audit_context: %{
            player_id: player.id,
            ip_address: "10.0.0.2",
            user_agent: nil
          }
        })

      entity_key = "npc_sync_#{System.unique_integer()}"
      before_state = %{level: 5, name: "Guard"}
      after_state = %{level: 6, name: "Guard"}

      Audit.log_sync(socket, :update, :npc, entity_key, before_state, after_state)

      # Should be available immediately (sync)
      logs = AuditLog.by_entity(:npc, entity_key) |> Repo.all()
      assert length(logs) == 1

      [log] = logs
      assert log.action == "update"
      assert log.before_state == %{"level" => 5, "name" => "Guard"}
      assert log.after_state == %{"level" => 6, "name" => "Guard"}
    end
  end

  describe "log_direct/8" do
    test "logs action without socket" do
      {:ok, player} =
        Loka.Accounts.register_player(%{
          email: "audit_direct_#{System.unique_integer()}@example.com",
          password: "password123456"
        })

      entity_key = "item_direct_#{System.unique_integer()}"

      Audit.log_direct(
        player,
        :delete,
        :item,
        entity_key,
        %{name: "Sword"},
        nil,
        %{reason: "cleanup"},
        ip_address: "127.0.0.1"
      )

      logs = AuditLog.by_entity(:item, entity_key) |> Repo.all()
      assert length(logs) == 1

      [log] = logs
      assert log.action == "delete"
      assert log.before_state == %{"name" => "Sword"}
      assert log.after_state == nil
      assert log.metadata == %{"reason" => "cleanup"}
      assert log.ip_address == "127.0.0.1"
    end
  end

  describe "state sanitization" do
    test "handles struct-like state" do
      socket =
        test_socket(%{
          audit_context: %{player_id: nil, ip_address: nil, user_agent: nil}
        })

      # Create a struct-like map to simulate entity state
      entity_key = "struct_test_#{System.unique_integer()}"

      state = %{
        __struct__: SomeModule,
        __meta__: %{some: :meta},
        name: "Test",
        level: 5
      }

      Audit.log_sync(socket, :create, :npc, entity_key, nil, state)

      logs = AuditLog.by_entity(:npc, entity_key) |> Repo.all()
      [log] = logs

      # Should have removed __struct__ and __meta__
      refute Map.has_key?(log.after_state, "__struct__")
      refute Map.has_key?(log.after_state, "__meta__")
      assert log.after_state["name"] == "Test"
      assert log.after_state["level"] == 5
    end
  end
end
