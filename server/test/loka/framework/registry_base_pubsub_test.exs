defmodule Loka.Framework.RegistryBasePubSubTest do
  @moduledoc """
  Tests for PubSub integration in RegistryBase and non-destructive YamlLoader.update_ets/2.
  """
  use ExUnit.Case, async: false

  alias Loka.Utils.YamlLoader

  # =============================================================================
  # YamlLoader.update_ets/2 Non-Destructive Tests
  # =============================================================================

  describe "YamlLoader.update_ets/2" do
    setup do
      # Table is owned by the test process and auto-deleted when it exits
      table = :ets.new(:yaml_loader_test, [:set, :public])
      {:ok, table: table}
    end

    test "upserts new and existing keys", %{table: table} do
      # Pre-populate with items A and B
      :ets.insert(table, {"a", %{key: "a", name: "A Original"}})
      :ets.insert(table, {"b", %{key: "b", name: "B Original"}})

      # Update with A (updated) and C (new)
      new_items = %{
        "a" => %{key: "a", name: "A Updated"},
        "c" => %{key: "c", name: "C New"}
      }

      assert :ok = YamlLoader.update_ets(table, new_items)

      # A should be updated
      assert [{_, %{name: "A Updated"}}] = :ets.lookup(table, "a")
      # C should be added
      assert [{_, %{name: "C New"}}] = :ets.lookup(table, "c")
    end

    test "removes stale keys not in new items", %{table: table} do
      # Pre-populate with A, B, C
      :ets.insert(table, {"a", %{key: "a"}})
      :ets.insert(table, {"b", %{key: "b"}})
      :ets.insert(table, {"c", %{key: "c"}})

      # Update with only A and B
      new_items = %{
        "a" => %{key: "a"},
        "b" => %{key: "b"}
      }

      assert :ok = YamlLoader.update_ets(table, new_items)

      # A and B should exist
      assert [{_, _}] = :ets.lookup(table, "a")
      assert [{_, _}] = :ets.lookup(table, "b")
      # C should be removed
      assert [] = :ets.lookup(table, "c")
    end

    test "table is never fully empty during update", %{table: table} do
      # Pre-populate with items
      :ets.insert(table, {"x", %{key: "x"}})
      :ets.insert(table, {"y", %{key: "y"}})

      # Replace with new set (overlapping)
      new_items = %{
        "x" => %{key: "x", name: "Updated"},
        "z" => %{key: "z"}
      }

      assert :ok = YamlLoader.update_ets(table, new_items)

      # After update: x (updated) and z (new) exist, y removed
      assert [{_, %{name: "Updated"}}] = :ets.lookup(table, "x")
      assert [{_, _}] = :ets.lookup(table, "z")
      assert [] = :ets.lookup(table, "y")
      # Table should have items (not empty)
      assert :ets.info(table, :size) == 2
    end

    test "handles empty new items by clearing all", %{table: table} do
      :ets.insert(table, {"a", %{key: "a"}})
      :ets.insert(table, {"b", %{key: "b"}})

      assert :ok = YamlLoader.update_ets(table, %{})

      assert :ets.info(table, :size) == 0
    end

    test "handles empty table with new items", %{table: table} do
      new_items = %{
        "a" => %{key: "a"},
        "b" => %{key: "b"}
      }

      assert :ok = YamlLoader.update_ets(table, new_items)
      assert :ets.info(table, :size) == 2
    end
  end

  # =============================================================================
  # RegistryBase PubSub Integration Tests
  # =============================================================================

  describe "RegistryBase PubSub: content_changed" do
    setup do
      # Create a temp dir with a skill YAML fixture
      tmp_dir =
        Path.join(
          System.tmp_dir!(),
          "registry_pubsub_test_#{:erlang.unique_integer([:positive])}"
        )

      File.mkdir_p!(tmp_dir)

      yaml = """
      key: pubsub_test_skill
      name: "PubSub Test Skill"
      category: combat
      max_level: 50
      description: "A skill for testing PubSub"
      """

      File.write!(Path.join(tmp_dir, "pubsub_test_skill.yml"), yaml)

      # Start a SkillRegistry instance with unique name
      registry_name = :"skill_reg_pubsub_#{:erlang.unique_integer([:positive])}"

      {:ok, pid} =
        Loka.Framework.Skills.SkillRegistry.start_link(
          name: registry_name,
          path: tmp_dir,
          load_on_start: true
        )

      on_exit(fn ->
        if Process.alive?(pid), do: GenServer.stop(pid)
        File.rm_rf!(tmp_dir)
      end)

      {:ok, pid: pid, registry_name: registry_name, tmp_dir: tmp_dir}
    end

    test "reloads when matching content_type is broadcast", %{
      registry_name: name,
      tmp_dir: tmp_dir
    } do
      # Verify initial state
      assert {:ok, skill} = Loka.Framework.Skills.SkillRegistry.get("pubsub_test_skill", name)
      assert skill.name == "PubSub Test Skill"

      # Add a new skill file
      new_yaml = """
      key: new_pubsub_skill
      name: "New Skill via PubSub"
      category: exploration
      max_level: 25
      description: "Added dynamically"
      """

      File.write!(Path.join(tmp_dir, "new_pubsub_skill.yml"), new_yaml)

      # Broadcast content_changed with matching type {:skill, nil}
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "content:changed",
        {:content_changed, "new_pubsub_skill", :skill, nil}
      )

      # Give GenServer time to process the message
      Process.sleep(100)

      # Registry should have reloaded and now contain the new skill
      assert {:ok, new_skill} = Loka.Framework.Skills.SkillRegistry.get("new_pubsub_skill", name)
      assert new_skill.name == "New Skill via PubSub"
    end

    test "ignores content_changed for non-matching types", %{
      registry_name: name
    } do
      # Get count before
      count_before = Loka.Framework.Skills.SkillRegistry.count(name)

      # Broadcast content_changed with non-matching type
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "content:changed",
        {:content_changed, "some_quest", :quest, nil}
      )

      Process.sleep(100)

      # Count should be unchanged
      assert Loka.Framework.Skills.SkillRegistry.count(name) == count_before
    end

    test "content_deleted removes item from ETS and state", %{
      registry_name: name
    } do
      # Verify item exists
      assert {:ok, _} = Loka.Framework.Skills.SkillRegistry.get("pubsub_test_skill", name)

      # Broadcast content_deleted
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "content:changed",
        {:content_deleted, "pubsub_test_skill"}
      )

      Process.sleep(100)

      # Item should be gone
      assert {:error, :not_found} =
               Loka.Framework.Skills.SkillRegistry.get("pubsub_test_skill", name)
    end

    test "content_deleted for unknown key is a no-op", %{
      registry_name: name
    } do
      count_before = Loka.Framework.Skills.SkillRegistry.count(name)

      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "content:changed",
        {:content_deleted, "nonexistent_skill_key"}
      )

      Process.sleep(100)

      assert Loka.Framework.Skills.SkillRegistry.count(name) == count_before
    end
  end
end
