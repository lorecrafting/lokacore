defmodule Loka.Framework.Status.StatusRegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Status.{StatusRegistry, StatusEffect}

  # Create test YAML files for loading
  setup_all do
    # Create temporary directory with test status YAML files
    temp_dir = System.tmp_dir!() <> "/status_registry_test_#{System.unique_integer([:positive])}"
    File.mkdir_p!(temp_dir)

    # Create test status YAML files
    poison_yaml = """
    key: poisoned
    name: Poisoned
    type: debuff
    duration: 5
    effects:
      - trigger: on_turn_start
        effect: damage
        amount: 5
    tags:
      - poison
      - dot
    """

    blessed_yaml = """
    key: blessed
    name: Blessed
    type: buff
    duration: 10
    effects:
      - trigger: passive
        effect: stat_modify
        stat: str
        modifier: 5
    tags:
      - holy
      - buff
    """

    cursed_yaml = """
    key: cursed
    name: Cursed
    type: debuff
    duration: null
    effects:
      - trigger: passive
        effect: stat_modify
        stat: str
        modifier: -5
    tags:
      - curse
    """

    stunned_yaml = """
    key: stunned
    name: Stunned
    type: neutral
    duration: 2
    effects: []
    tags:
      - control
    """

    File.write!(Path.join(temp_dir, "poisoned.yml"), poison_yaml)
    File.write!(Path.join(temp_dir, "blessed.yml"), blessed_yaml)
    File.write!(Path.join(temp_dir, "cursed.yml"), cursed_yaml)
    File.write!(Path.join(temp_dir, "stunned.yml"), stunned_yaml)

    on_exit(fn ->
      File.rm_rf!(temp_dir)
    end)

    {:ok, temp_dir: temp_dir}
  end

  setup %{temp_dir: temp_dir} do
    # Start a fresh registry for each test (if not already started by app)
    _pid =
      case start_supervised({StatusRegistry, name: StatusRegistry, path: temp_dir}) do
        {:ok, p} -> p
        {:error, {:already_started, p}} -> p
      end

    :ok
  end

  describe "get/1" do
    test "returns status by key" do
      assert {:ok, status} = StatusRegistry.get("poisoned")
      assert status.key == "poisoned"
      assert status.name == "Poisoned"
      assert status.type == :debuff
    end

    test "returns error for non-existent key" do
      assert {:error, :not_found} = StatusRegistry.get("nonexistent")
    end

    test "works with different keys" do
      assert {:ok, blessed} = StatusRegistry.get("blessed")
      assert blessed.key == "blessed"

      assert {:ok, cursed} = StatusRegistry.get("cursed")
      assert cursed.key == "cursed"
    end
  end

  describe "get!/1" do
    test "returns status by key" do
      status = StatusRegistry.get!("poisoned")
      assert status.key == "poisoned"
      assert status.name == "Poisoned"
    end

    test "raises for non-existent key" do
      assert_raise RuntimeError, "Status effect not found: nonexistent", fn ->
        StatusRegistry.get!("nonexistent")
      end
    end
  end

  describe "by_type/1" do
    test "returns all buffs" do
      buffs = StatusRegistry.by_type(:buff)
      assert length(buffs) == 1
      assert Enum.all?(buffs, &(&1.type == :buff))

      buff = List.first(buffs)
      assert buff.key == "blessed"
    end

    test "returns all debuffs" do
      debuffs = StatusRegistry.by_type(:debuff)
      assert length(debuffs) == 2
      assert Enum.all?(debuffs, &(&1.type == :debuff))

      keys = Enum.map(debuffs, & &1.key)
      assert "poisoned" in keys
      assert "cursed" in keys
    end

    test "returns all neutral statuses" do
      neutral = StatusRegistry.by_type(:neutral)
      assert length(neutral) == 1
      assert Enum.all?(neutral, &(&1.type == :neutral))

      status = List.first(neutral)
      assert status.key == "stunned"
    end
  end

  describe "by_tag/1" do
    test "returns statuses with specific tag" do
      poison_statuses = StatusRegistry.by_tag("poison")
      assert length(poison_statuses) == 1

      status = List.first(poison_statuses)
      assert status.key == "poisoned"
      assert "poison" in status.tags
    end

    test "returns statuses with holy tag" do
      holy_statuses = StatusRegistry.by_tag("holy")
      assert length(holy_statuses) == 1

      status = List.first(holy_statuses)
      assert status.key == "blessed"
    end

    test "returns empty list for non-existent tag" do
      statuses = StatusRegistry.by_tag("nonexistent")
      assert statuses == []
    end
  end

  describe "all/0" do
    test "returns all loaded statuses" do
      statuses = StatusRegistry.all()
      assert length(statuses) == 4

      keys = Enum.map(statuses, & &1.key)
      assert "poisoned" in keys
      assert "blessed" in keys
      assert "cursed" in keys
      assert "stunned" in keys
    end
  end

  describe "count/0" do
    test "returns count of loaded statuses" do
      assert StatusRegistry.count() == 4
    end
  end

  describe "exists?/1" do
    test "returns true for existing status" do
      assert StatusRegistry.exists?("poisoned") == true
      assert StatusRegistry.exists?("blessed") == true
    end

    test "returns false for non-existent status" do
      assert StatusRegistry.exists?("nonexistent") == false
    end
  end

  describe "reload/0" do
    test "reloads statuses from disk" do
      # Initial count
      initial_count = StatusRegistry.count()
      assert initial_count == 4

      # Reload should work
      assert :ok = StatusRegistry.reload()
      assert StatusRegistry.count() == initial_count
    end
  end

  describe "load_from/1" do
    test "loads from specified path" do
      # Create a new temporary directory with test YAML file
      temp_dir = System.tmp_dir!() <> "/status_load_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      # Create a test YAML file
      yaml_content = """
      key: test_status
      name: Test Status
      type: buff
      duration: 5
      effects:
        - trigger: on_apply
          effect: heal
          amount: 10
      """

      File.write!(Path.join(temp_dir, "test.yml"), yaml_content)

      # Load from temp directory
      assert :ok = StatusRegistry.load_from(temp_dir)

      # Verify it loaded
      assert {:ok, status} = StatusRegistry.get("test_status")
      assert status.name == "Test Status"
      assert status.type == :buff

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "returns error for invalid YAML" do
      temp_dir = System.tmp_dir!() <> "/status_invalid_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      # Create invalid YAML (missing required field)
      yaml_content = """
      key: invalid_status
      """

      File.write!(Path.join(temp_dir, "invalid.yml"), yaml_content)

      # Should return error but not crash
      result = StatusRegistry.load_from(temp_dir)
      assert match?({:error, _}, result)

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "handles empty directory" do
      temp_dir = System.tmp_dir!() <> "/status_empty_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      assert :ok = StatusRegistry.load_from(temp_dir)

      # After loading empty dir, count should be 0
      assert StatusRegistry.count() == 0

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "handles non-existent directory" do
      non_existent_path = "/tmp/this_path_definitely_does_not_exist_#{System.unique_integer()}"

      # Should not crash
      assert :ok = StatusRegistry.load_from(non_existent_path)
      assert StatusRegistry.count() == 0
    end
  end

  describe "YAML file loading" do
    test "loads multiple YAML files from directory" do
      temp_dir = System.tmp_dir!() <> "/status_multi_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      # Create multiple YAML files
      yaml1 = """
      key: status_one
      name: Status One
      type: buff
      """

      yaml2 = """
      key: status_two
      name: Status Two
      type: debuff
      """

      File.write!(Path.join(temp_dir, "one.yml"), yaml1)
      File.write!(Path.join(temp_dir, "two.yaml"), yaml2)

      assert :ok = StatusRegistry.load_from(temp_dir)
      assert StatusRegistry.count() == 2
      assert StatusRegistry.exists?("status_one")
      assert StatusRegistry.exists?("status_two")

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "loads YAML files from subdirectories" do
      temp_dir = System.tmp_dir!() <> "/status_nested_test_#{System.unique_integer([:positive])}"
      subdir = Path.join(temp_dir, "buffs")
      File.mkdir_p!(subdir)

      yaml_content = """
      key: nested_status
      name: Nested Status
      type: buff
      """

      File.write!(Path.join(subdir, "nested.yml"), yaml_content)

      assert :ok = StatusRegistry.load_from(temp_dir)
      assert StatusRegistry.exists?("nested_status")

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "skips non-YAML files" do
      temp_dir = System.tmp_dir!() <> "/status_skip_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      # Create YAML and non-YAML files
      yaml_content = """
      key: valid_status
      name: Valid Status
      """

      File.write!(Path.join(temp_dir, "valid.yml"), yaml_content)
      File.write!(Path.join(temp_dir, "readme.txt"), "This is not YAML")

      assert :ok = StatusRegistry.load_from(temp_dir)
      assert StatusRegistry.count() == 1
      assert StatusRegistry.exists?("valid_status")

      # Cleanup
      File.rm_rf!(temp_dir)
    end
  end

  describe "concurrent access" do
    test "handles concurrent reads" do
      # Spawn multiple processes reading concurrently
      tasks =
        for _ <- 1..10 do
          Task.async(fn ->
            StatusRegistry.get("poisoned")
          end)
        end

      results = Task.await_many(tasks)

      assert Enum.all?(results, fn result ->
               match?({:ok, %StatusEffect{key: "poisoned"}}, result)
             end)
    end

    test "handles mix of reads and existence checks" do
      tasks =
        for i <- 1..20 do
          Task.async(fn ->
            if rem(i, 2) == 0 do
              StatusRegistry.get("blessed")
            else
              StatusRegistry.exists?("blessed")
            end
          end)
        end

      results = Task.await_many(tasks)
      assert length(results) == 20
    end
  end
end
