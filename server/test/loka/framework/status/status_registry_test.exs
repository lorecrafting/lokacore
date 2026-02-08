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
    # Use a unique name to avoid conflicts with the production StatusRegistry
    server_name = :"test_status_registry_#{System.unique_integer([:positive])}"

    {:ok, pid} =
      start_supervised({StatusRegistry, name: server_name, path: temp_dir})

    {:ok, server: pid}
  end

  describe "get/1" do
    test "returns status by key", %{server: server} do
      assert {:ok, status} = StatusRegistry.get("poisoned", server)
      assert status.key == "poisoned"
      assert status.name == "Poisoned"
      assert status.type == :debuff
    end

    test "returns error for non-existent key", %{server: server} do
      assert {:error, :not_found} = StatusRegistry.get("nonexistent", server)
    end

    test "works with different keys", %{server: server} do
      assert {:ok, blessed} = StatusRegistry.get("blessed", server)
      assert blessed.key == "blessed"

      assert {:ok, cursed} = StatusRegistry.get("cursed", server)
      assert cursed.key == "cursed"
    end
  end

  describe "get!/1" do
    test "returns status by key", %{server: server} do
      status = StatusRegistry.get!("poisoned", server)
      assert status.key == "poisoned"
      assert status.name == "Poisoned"
    end

    test "raises for non-existent key", %{server: server} do
      assert_raise RuntimeError, "Status effect not found: nonexistent", fn ->
        StatusRegistry.get!("nonexistent", server)
      end
    end
  end

  describe "by_type/1" do
    test "returns all buffs", %{server: server} do
      buffs = StatusRegistry.by_type(:buff, server)
      assert length(buffs) == 1
      assert Enum.all?(buffs, &(&1.type == :buff))

      buff = List.first(buffs)
      assert buff.key == "blessed"
    end

    test "returns all debuffs", %{server: server} do
      debuffs = StatusRegistry.by_type(:debuff, server)
      assert length(debuffs) == 2
      assert Enum.all?(debuffs, &(&1.type == :debuff))

      keys = Enum.map(debuffs, & &1.key)
      assert "poisoned" in keys
      assert "cursed" in keys
    end

    test "returns all neutral statuses", %{server: server} do
      neutral = StatusRegistry.by_type(:neutral, server)
      assert length(neutral) == 1
      assert Enum.all?(neutral, &(&1.type == :neutral))

      status = List.first(neutral)
      assert status.key == "stunned"
    end
  end

  describe "by_tag/1" do
    test "returns statuses with specific tag", %{server: server} do
      poison_statuses = StatusRegistry.by_tag("poison", server)
      assert length(poison_statuses) == 1

      status = List.first(poison_statuses)
      assert status.key == "poisoned"
      assert "poison" in status.tags
    end

    test "returns statuses with holy tag", %{server: server} do
      holy_statuses = StatusRegistry.by_tag("holy", server)
      assert length(holy_statuses) == 1

      status = List.first(holy_statuses)
      assert status.key == "blessed"
    end

    test "returns empty list for non-existent tag", %{server: server} do
      statuses = StatusRegistry.by_tag("nonexistent", server)
      assert statuses == []
    end
  end

  describe "all/0" do
    test "returns all loaded statuses", %{server: server} do
      statuses = StatusRegistry.all(server)
      assert length(statuses) == 4

      keys = Enum.map(statuses, & &1.key)
      assert "poisoned" in keys
      assert "blessed" in keys
      assert "cursed" in keys
      assert "stunned" in keys
    end
  end

  describe "count/0" do
    test "returns count of loaded statuses", %{server: server} do
      assert StatusRegistry.count(server) == 4
    end
  end

  describe "exists?/1" do
    test "returns true for existing status", %{server: server} do
      assert StatusRegistry.exists?("poisoned", server) == true
      assert StatusRegistry.exists?("blessed", server) == true
    end

    test "returns false for non-existent status", %{server: server} do
      assert StatusRegistry.exists?("nonexistent", server) == false
    end
  end

  describe "reload/0" do
    test "reloads statuses from disk", %{server: server} do
      # Initial count
      initial_count = StatusRegistry.count(server)
      assert initial_count == 4

      # Reload should work
      assert :ok = StatusRegistry.reload(server)
      assert StatusRegistry.count(server) == initial_count
    end
  end

  describe "load_from/1" do
    test "loads from specified path", %{server: server} do
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
      assert :ok = StatusRegistry.load_from(temp_dir, server)

      # Verify it loaded
      assert {:ok, status} = StatusRegistry.get("test_status", server)
      assert status.name == "Test Status"
      assert status.type == :buff

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "returns error for invalid YAML", %{server: server} do
      temp_dir = System.tmp_dir!() <> "/status_invalid_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      # Create invalid YAML (missing required field)
      yaml_content = """
      key: invalid_status
      """

      File.write!(Path.join(temp_dir, "invalid.yml"), yaml_content)

      # Should return error but not crash
      result = StatusRegistry.load_from(temp_dir, server)
      assert match?({:error, _}, result)

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "handles empty directory", %{server: server} do
      temp_dir = System.tmp_dir!() <> "/status_empty_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      assert :ok = StatusRegistry.load_from(temp_dir, server)

      # After loading empty dir, count should be 0
      assert StatusRegistry.count(server) == 0

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "handles non-existent directory", %{server: server} do
      non_existent_path = "/tmp/this_path_definitely_does_not_exist_#{System.unique_integer()}"

      # Should not crash
      assert :ok = StatusRegistry.load_from(non_existent_path, server)
      assert StatusRegistry.count(server) == 0
    end
  end

  describe "YAML file loading" do
    test "loads multiple YAML files from directory", %{server: server} do
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

      assert :ok = StatusRegistry.load_from(temp_dir, server)
      assert StatusRegistry.count(server) == 2
      assert StatusRegistry.exists?("status_one", server)
      assert StatusRegistry.exists?("status_two", server)

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "loads YAML files from subdirectories", %{server: server} do
      temp_dir = System.tmp_dir!() <> "/status_nested_test_#{System.unique_integer([:positive])}"
      subdir = Path.join(temp_dir, "buffs")
      File.mkdir_p!(subdir)

      yaml_content = """
      key: nested_status
      name: Nested Status
      type: buff
      """

      File.write!(Path.join(subdir, "nested.yml"), yaml_content)

      assert :ok = StatusRegistry.load_from(temp_dir, server)
      assert StatusRegistry.exists?("nested_status", server)

      # Cleanup
      File.rm_rf!(temp_dir)
    end

    test "skips non-YAML files", %{server: server} do
      temp_dir = System.tmp_dir!() <> "/status_skip_test_#{System.unique_integer([:positive])}"
      File.mkdir_p!(temp_dir)

      # Create YAML and non-YAML files
      yaml_content = """
      key: valid_status
      name: Valid Status
      """

      File.write!(Path.join(temp_dir, "valid.yml"), yaml_content)
      File.write!(Path.join(temp_dir, "readme.txt"), "This is not YAML")

      assert :ok = StatusRegistry.load_from(temp_dir, server)
      assert StatusRegistry.count(server) == 1
      assert StatusRegistry.exists?("valid_status", server)

      # Cleanup
      File.rm_rf!(temp_dir)
    end
  end

  describe "concurrent access" do
    test "handles concurrent reads", %{server: server} do
      # Spawn multiple processes reading concurrently
      tasks =
        for _ <- 1..10 do
          Task.async(fn ->
            StatusRegistry.get("poisoned", server)
          end)
        end

      results = Task.await_many(tasks)

      assert Enum.all?(results, fn result ->
               match?({:ok, %StatusEffect{key: "poisoned"}}, result)
             end)
    end

    test "handles mix of reads and existence checks", %{server: server} do
      tasks =
        for i <- 1..20 do
          Task.async(fn ->
            if rem(i, 2) == 0 do
              StatusRegistry.get("blessed", server)
            else
              StatusRegistry.exists?("blessed", server)
            end
          end)
        end

      results = Task.await_many(tasks)
      assert length(results) == 20
    end
  end
end
