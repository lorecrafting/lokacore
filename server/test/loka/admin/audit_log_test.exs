defmodule Loka.Admin.AuditLogTest do
  use Loka.DataCase, async: false

  alias Loka.Admin.AuditLog
  alias Loka.Repo

  describe "changeset/2" do
    test "valid changeset with required fields" do
      attrs = %{
        action: "create",
        entity_type: "room",
        entity_key: "tavern_main"
      }

      changeset = AuditLog.changeset(%AuditLog{}, attrs)
      assert changeset.valid?
    end

    test "invalid without action" do
      attrs = %{entity_type: "room"}
      changeset = AuditLog.changeset(%AuditLog{}, attrs)
      refute changeset.valid?
      assert {:action, {"can't be blank", _}} = hd(changeset.errors)
    end

    test "invalid without entity_type" do
      attrs = %{action: "create"}
      changeset = AuditLog.changeset(%AuditLog{}, attrs)
      refute changeset.valid?
      assert {:entity_type, {"can't be blank", _}} = hd(changeset.errors)
    end

    test "validates action in allowed list" do
      attrs = %{action: "invalid_action", entity_type: "room"}
      changeset = AuditLog.changeset(%AuditLog{}, attrs)
      refute changeset.valid?
      assert {:action, {"is invalid", _}} = hd(changeset.errors)
    end

    test "validates entity_type in allowed list" do
      attrs = %{action: "create", entity_type: "invalid_type"}
      changeset = AuditLog.changeset(%AuditLog{}, attrs)
      refute changeset.valid?
      assert {:entity_type, {"is invalid", _}} = hd(changeset.errors)
    end

    test "accepts all valid actions" do
      for action <- AuditLog.actions() do
        attrs = %{action: action, entity_type: "room"}
        changeset = AuditLog.changeset(%AuditLog{}, attrs)
        assert changeset.valid?, "Expected #{action} to be valid"
      end
    end

    test "accepts all valid entity_types" do
      for entity_type <- AuditLog.entity_types() do
        attrs = %{action: "create", entity_type: entity_type}
        changeset = AuditLog.changeset(%AuditLog{}, attrs)
        assert changeset.valid?, "Expected #{entity_type} to be valid"
      end
    end

    test "accepts optional fields" do
      attrs = %{
        action: "update",
        entity_type: "npc",
        entity_key: "guard_captain",
        before_state: %{"level" => 5},
        after_state: %{"level" => 6},
        metadata: %{"reason" => "level up"},
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0"
      }

      changeset = AuditLog.changeset(%AuditLog{}, attrs)
      assert changeset.valid?
    end
  end

  describe "query helpers" do
    setup do
      # Create test player
      {:ok, player} =
        Loka.Accounts.register_player(%{
          email: "audit_test_#{System.unique_integer()}@example.com",
          password: "password123456"
        })

      # Create some audit logs
      logs =
        for {action, entity_type, key} <- [
              {"create", "room", "room_1"},
              {"create", "npc", "npc_1"},
              {"update", "room", "room_1"},
              {"delete", "item", "item_1"},
              {"batch_delete", "room", nil}
            ] do
          {:ok, log} =
            %AuditLog{}
            |> AuditLog.changeset(%{
              player_id: player.id,
              action: action,
              entity_type: entity_type,
              entity_key: key
            })
            |> Repo.insert()

          log
        end

      %{player: player, logs: logs}
    end

    test "by_player/1 filters by player_id", %{player: player} do
      logs = AuditLog.by_player(player.id) |> Repo.all()
      assert length(logs) == 5
      assert Enum.all?(logs, &(&1.player_id == player.id))
    end

    test "by_entity/2 filters by entity_type" do
      logs = AuditLog.by_entity(:room) |> Repo.all()
      assert length(logs) == 3
      assert Enum.all?(logs, &(&1.entity_type == "room"))
    end

    test "by_entity/3 filters by entity_type and key" do
      logs = AuditLog.by_entity(:room, "room_1") |> Repo.all()
      assert length(logs) == 2
      assert Enum.all?(logs, &(&1.entity_type == "room" && &1.entity_key == "room_1"))
    end

    test "by_action/1 filters by action" do
      logs = AuditLog.by_action(:create) |> Repo.all()
      assert length(logs) == 2
      assert Enum.all?(logs, &(&1.action == "create"))
    end

    test "recent/1 limits results" do
      logs = AuditLog.recent(3) |> Repo.all()
      assert length(logs) == 3
    end

    test "recent/1 orders by inserted_at desc" do
      logs = AuditLog.recent(5) |> Repo.all()
      timestamps = Enum.map(logs, & &1.inserted_at)
      assert timestamps == Enum.sort(timestamps, {:desc, DateTime})
    end

    test "with_player/1 preloads player association", %{player: player} do
      [log | _] = AuditLog.recent(1) |> AuditLog.with_player() |> Repo.all()
      assert log.player.id == player.id
      assert log.player.email == player.email
    end

    test "queries can be chained" do
      logs =
        AuditLog
        |> AuditLog.by_entity(:room)
        |> AuditLog.by_action(:create)
        |> AuditLog.recent(10)
        |> Repo.all()

      assert length(logs) == 1
      assert hd(logs).entity_type == "room"
      assert hd(logs).action == "create"
    end
  end

  describe "actions/0 and entity_types/0" do
    test "returns expected actions" do
      actions = AuditLog.actions()
      assert "create" in actions
      assert "update" in actions
      assert "delete" in actions
      assert "batch_create" in actions
      assert "batch_update" in actions
      assert "batch_delete" in actions
    end

    test "returns expected entity_types" do
      types = AuditLog.entity_types()
      assert "room" in types
      assert "npc" in types
      assert "item" in types
      assert "quest" in types
      assert "dialogue" in types
      assert "script" in types
    end
  end
end
