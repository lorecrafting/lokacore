defmodule Loka.Framework.Status.StatusManagerTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Status.{StatusManager, StatusRegistry, StatusEffect}

  # Create test YAML files for loading
  setup_all do
    # Create temporary directory with test status YAML files
    temp_dir = System.tmp_dir!() <> "/status_test_#{System.unique_integer([:positive])}"
    File.mkdir_p!(temp_dir)

    # Create test status YAML files
    poison_yaml = """
    key: poisoned
    name: Poisoned
    type: debuff
    duration: 5
    stackable: true
    max_stacks: 3
    effects:
      - trigger: on_turn_start
        effect: damage
        amount: 5
        damage_type: poison
      - trigger: on_apply
        effect: damage
        amount: 2
        damage_type: poison
    cure_items:
      - antidote
    cure_abilities:
      - cure_poison
    tags:
      - poison
      - dot
    """

    blessed_yaml = """
    key: blessed
    name: Blessed
    type: buff
    duration: 10
    stackable: false
    max_stacks: 1
    effects:
      - trigger: passive
        effect: stat_modify
        stat: str
        modifier: 5
      - trigger: passive
        effect: stat_modify
        stat: dex
        modifier: 3
    exclusive_with:
      - cursed
    tags:
      - holy
    """

    cursed_yaml = """
    key: cursed
    name: Cursed
    type: debuff
    duration: null
    stackable: false
    max_stacks: 1
    effects:
      - trigger: passive
        effect: stat_modify
        stat: str
        modifier: -5
    exclusive_with:
      - blessed
    tags:
      - curse
    """

    stun_yaml = """
    key: stunned
    name: Stunned
    type: debuff
    duration: 2
    stackable: false
    max_stacks: 1
    effects:
      - trigger: passive
        effect: prevent_action
        action_type: all
    tags:
      - control
    """

    regen_yaml = """
    key: regenerating
    name: Regenerating
    type: buff
    duration: 8
    stackable: true
    max_stacks: 5
    effects:
      - trigger: on_turn_start
        effect: heal
        amount: 3
    tags:
      - heal
    """

    File.write!(Path.join(temp_dir, "poisoned.yml"), poison_yaml)
    File.write!(Path.join(temp_dir, "blessed.yml"), blessed_yaml)
    File.write!(Path.join(temp_dir, "cursed.yml"), cursed_yaml)
    File.write!(Path.join(temp_dir, "stunned.yml"), stun_yaml)
    File.write!(Path.join(temp_dir, "regenerating.yml"), regen_yaml)

    on_exit(fn ->
      File.rm_rf!(temp_dir)
    end)

    {:ok, temp_dir: temp_dir}
  end

  setup %{temp_dir: temp_dir} do
    # Start fresh managers for each test (if not already started by app)
    _registry_pid =
      case start_supervised({StatusRegistry, name: StatusRegistry, path: temp_dir}) do
        {:ok, p} -> p
        {:error, {:already_started, p}} -> p
      end

    _manager_pid =
      case start_supervised({StatusManager, name: StatusManager}) do
        {:ok, p} -> p
        {:error, {:already_started, p}} -> p
      end

    on_exit(fn ->
      # Clean up active statuses table
      try do
        :ets.delete_all_objects(:loka_active_statuses)
      rescue
        _ -> :ok
      end
    end)

    :ok
  end

  describe "apply_status/4" do
    test "applies a status to an entity" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      assert {:ok, active} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      assert active.status_key == "poisoned"
      assert active.stacks == 1
      assert active.remaining_duration == 5
      assert active.source_id == source_id
      assert active.applied_at
    end

    test "applies status with custom stacks" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      assert {:ok, active} =
               StatusManager.apply_status(entity_id, "poisoned", source_id, stacks: 2)

      assert active.stacks == 2
    end

    test "applies status with custom duration" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      assert {:ok, active} =
               StatusManager.apply_status(entity_id, "poisoned", source_id, duration: 10)

      assert active.remaining_duration == 10
    end

    test "stacks status up to max when stackable" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, active} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      assert active.stacks == 3
    end

    test "caps stacks at max_stacks" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id, stacks: 3)
      {:ok, active} = StatusManager.apply_status(entity_id, "poisoned", source_id, stacks: 2)

      assert active.stacks == 3
    end

    test "refreshes duration for non-stackable status" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _first} = StatusManager.apply_status(entity_id, "blessed", source_id)

      # Manually modify duration to simulate time passing
      statuses = StatusManager.get_active(entity_id)
      modified = Enum.map(statuses, &%{&1 | remaining_duration: 5})
      :ets.insert(:loka_active_statuses, {entity_id, modified})

      {:ok, refreshed} = StatusManager.apply_status(entity_id, "blessed", source_id)

      assert refreshed.remaining_duration == 10
      assert refreshed.stacks == 1
    end

    test "returns error for non-existent status" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      assert {:error, :status_not_found} =
               StatusManager.apply_status(entity_id, "nonexistent", source_id)
    end

    test "returns error when exclusive status conflict" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      assert {:error, {:exclusive_conflict, "blessed"}} =
               StatusManager.apply_status(entity_id, "cursed", source_id)
    end
  end

  describe "remove_status/2" do
    test "removes an active status" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      assert :ok = StatusManager.remove_status(entity_id, "poisoned")

      assert StatusManager.has?(entity_id, "poisoned") == false
    end

    test "returns error when status not found" do
      entity_id = Ecto.UUID.generate()

      assert {:error, :not_found} = StatusManager.remove_status(entity_id, "poisoned")
    end
  end

  describe "clear_all/1" do
    test "removes all statuses from entity" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      StatusManager.clear_all(entity_id)
      # Give the cast time to process
      Process.sleep(10)

      assert StatusManager.get_active(entity_id) == []
    end
  end

  describe "has?/2" do
    test "returns true when entity has status" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      assert StatusManager.has?(entity_id, "poisoned") == true
    end

    test "returns false when entity does not have status" do
      entity_id = Ecto.UUID.generate()

      assert StatusManager.has?(entity_id, "poisoned") == false
    end
  end

  describe "get_active/1" do
    test "returns all active statuses for entity" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      statuses = StatusManager.get_active(entity_id)
      assert length(statuses) == 2

      keys = Enum.map(statuses, & &1.status_key)
      assert "poisoned" in keys
      assert "blessed" in keys
    end

    test "returns empty list for entity with no statuses" do
      entity_id = Ecto.UUID.generate()

      assert StatusManager.get_active(entity_id) == []
    end
  end

  describe "get_stacks/2" do
    test "returns stack count for active status" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id, stacks: 2)

      assert StatusManager.get_stacks(entity_id, "poisoned") == 2
    end

    test "returns 0 for status not on entity" do
      entity_id = Ecto.UUID.generate()

      assert StatusManager.get_stacks(entity_id, "poisoned") == 0
    end
  end

  describe "tick/2" do
    test "processes status effects for trigger" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      results = StatusManager.tick(entity_id, :on_turn_start)

      assert length(results) == 1
      result = List.first(results)
      assert result.action == :damage
      # Fixed: now correctly reads amount from YAML string keys
      assert result.amount == 5
      assert result.damage_type == :poison
      assert result.status_key == "poisoned"
      assert result.stacks == 1
    end

    test "scales effect by stack count" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id, stacks: 3)

      results = StatusManager.tick(entity_id, :on_turn_start)

      result = List.first(results)
      # Fixed: correctly calculates 5 * 3 stacks = 15
      assert result.amount == 15
    end

    test "returns multiple results for multiple statuses" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "regenerating", source_id)

      results = StatusManager.tick(entity_id, :on_turn_start)

      assert length(results) == 2
      actions = Enum.map(results, & &1.action)
      assert :damage in actions
      assert :heal in actions
    end

    test "returns empty list when no effects for trigger" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      results = StatusManager.tick(entity_id, :on_turn_start)

      assert results == []
    end
  end

  describe "tick_duration/1" do
    test "decrements duration for all statuses" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      {:ok, expired} = StatusManager.tick_duration(entity_id)

      statuses = StatusManager.get_active(entity_id)
      status = List.first(statuses)
      assert status.remaining_duration == 4
      assert expired == 0
    end

    test "removes statuses with duration 1" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id, duration: 1)

      {:ok, expired} = StatusManager.tick_duration(entity_id)

      assert expired == 1
      assert StatusManager.has?(entity_id, "poisoned") == false
    end

    test "does not affect permanent statuses" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "cursed", source_id)

      {:ok, expired} = StatusManager.tick_duration(entity_id)

      assert expired == 0
      assert StatusManager.has?(entity_id, "cursed") == true
    end

    test "returns count of expired statuses" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id, duration: 1)
      {:ok, _} = StatusManager.apply_status(entity_id, "stunned", source_id, duration: 1)

      {:ok, expired} = StatusManager.tick_duration(entity_id)

      assert expired == 2
    end
  end

  describe "try_cure/3" do
    test "cures status with correct item" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      assert :ok = StatusManager.try_cure(entity_id, "poisoned", "antidote", :item)
      assert StatusManager.has?(entity_id, "poisoned") == false
    end

    test "cures status with correct ability" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      assert :ok = StatusManager.try_cure(entity_id, "poisoned", "cure_poison", :ability)
      assert StatusManager.has?(entity_id, "poisoned") == false
    end

    test "returns error with incorrect item" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)

      assert {:error, :cannot_cure} =
               StatusManager.try_cure(entity_id, "poisoned", "potion", :item)

      assert StatusManager.has?(entity_id, "poisoned") == true
    end

    test "returns error for non-existent status" do
      entity_id = Ecto.UUID.generate()

      assert {:error, :status_not_found} =
               StatusManager.try_cure(entity_id, "nonexistent", "antidote", :item)
    end
  end

  describe "get_stat_modifiers/2" do
    test "returns sum of stat modifiers from all statuses" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      str_mod = StatusManager.get_stat_modifiers(entity_id, :str)
      dex_mod = StatusManager.get_stat_modifiers(entity_id, :dex)

      assert str_mod == 5
      assert dex_mod == 3
    end

    test "handles negative modifiers" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "cursed", source_id)

      str_mod = StatusManager.get_stat_modifiers(entity_id, :str)

      assert str_mod == -5
    end

    test "returns 0 for stat with no modifiers" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      wis_mod = StatusManager.get_stat_modifiers(entity_id, :wis)

      assert wis_mod == 0
    end

    test "returns 0 for entity with no statuses" do
      entity_id = Ecto.UUID.generate()

      str_mod = StatusManager.get_stat_modifiers(entity_id, :str)

      assert str_mod == 0
    end

    test "accepts string stat names" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      str_mod = StatusManager.get_stat_modifiers(entity_id, "str")

      assert str_mod == 5
    end
  end

  describe "dispel/3" do
    test "dispels all statuses when type is :all" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      {:ok, count} = StatusManager.dispel(entity_id, :all, :all)

      assert count == 2
      assert StatusManager.get_active(entity_id) == []
    end

    test "dispels only buffs" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      {:ok, count} = StatusManager.dispel(entity_id, :buff, :all)

      assert count == 1
      assert StatusManager.has?(entity_id, "blessed") == false
      assert StatusManager.has?(entity_id, "poisoned") == true
    end

    test "dispels only debuffs" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      {:ok, count} = StatusManager.dispel(entity_id, :debuff, :all)

      assert count == 1
      assert StatusManager.has?(entity_id, "poisoned") == false
      assert StatusManager.has?(entity_id, "blessed") == true
    end

    test "dispels limited number of statuses" do
      entity_id = Ecto.UUID.generate()
      source_id = Ecto.UUID.generate()

      {:ok, _} = StatusManager.apply_status(entity_id, "poisoned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "stunned", source_id)
      {:ok, _} = StatusManager.apply_status(entity_id, "blessed", source_id)

      {:ok, count} = StatusManager.dispel(entity_id, :all, 2)

      assert count == 2
      assert length(StatusManager.get_active(entity_id)) == 1
    end

    test "returns 0 when no statuses to dispel" do
      entity_id = Ecto.UUID.generate()

      {:ok, count} = StatusManager.dispel(entity_id, :all, :all)

      assert count == 0
    end
  end
end
