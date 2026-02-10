defmodule Loka.Framework.Resources.ResourceRegistryTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Resources.ResourceRegistry

  setup do
    # Start a unique registry for each test
    registry_name = :"registry_#{:erlang.unique_integer([:positive])}"

    {:ok, pid} =
      start_supervised(
        {ResourceRegistry, name: registry_name, load_on_start: false},
        id: registry_name
      )

    %{registry: registry_name, pid: pid}
  end

  describe "start_link/1" do
    test "starts the registry GenServer" do
      registry_name = :"test_registry_#{:erlang.unique_integer([:positive])}"

      {:ok, pid} =
        start_supervised(
          {ResourceRegistry, name: registry_name, load_on_start: false},
          id: registry_name
        )

      assert Process.alive?(pid)
    end

    test "loads resources on start if load_on_start is true" do
      # Create a temporary directory with test resources
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      resource_file = Path.join(test_dir, "mana.yml")

      File.write!(resource_file, """
      key: mana
      name: Mana
      max_formula: "100"
      """)

      registry_name = :"test_registry_#{:erlang.unique_integer([:positive])}"

      {:ok, _pid} =
        start_supervised(
          {ResourceRegistry, name: registry_name, path: test_dir, load_on_start: true},
          id: registry_name
        )

      # Give it a moment to load
      Process.sleep(100)

      assert {:ok, resource} = ResourceRegistry.get("mana", registry_name)
      assert resource.name == "Mana"

      # Cleanup
      File.rm_rf!(test_dir)
    end
  end

  describe "get/2" do
    test "returns resource when it exists", %{registry: registry} do
      # Load a test resource
      test_dir = setup_test_resource(registry, "energy", "Energy", "100")

      assert {:ok, resource} = ResourceRegistry.get("energy", registry)
      assert resource.key == "energy"
      assert resource.name == "Energy"

      File.rm_rf!(test_dir)
    end

    test "returns error when resource not found", %{registry: registry} do
      assert {:error, :not_found} = ResourceRegistry.get("nonexistent", registry)
    end

    test "can retrieve multiple resources", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      """)

      File.write!(Path.join(test_dir, "stamina.yml"), """
      key: stamina
      name: Stamina
      """)

      ResourceRegistry.load_from(test_dir, registry)

      assert {:ok, mana} = ResourceRegistry.get("mana", registry)
      assert {:ok, stamina} = ResourceRegistry.get("stamina", registry)
      assert mana.name == "Mana"
      assert stamina.name == "Stamina"

      File.rm_rf!(test_dir)
    end
  end

  describe "get!/2" do
    test "returns resource when it exists", %{registry: registry} do
      test_dir = setup_test_resource(registry, "health", "Health", "100")

      resource = ResourceRegistry.get!("health", registry)
      assert resource.key == "health"

      File.rm_rf!(test_dir)
    end

    test "raises when resource not found", %{registry: registry} do
      assert_raise RuntimeError, ~r/Resource not found/, fn ->
        ResourceRegistry.get!("nonexistent", registry)
      end
    end
  end

  describe "all/1" do
    test "returns empty list when no resources loaded", %{registry: registry} do
      assert [] = ResourceRegistry.all(registry)
    end

    test "returns all loaded resources", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      """)

      File.write!(Path.join(test_dir, "health.yml"), """
      key: health
      name: Health
      """)

      ResourceRegistry.load_from(test_dir, registry)

      resources = ResourceRegistry.all(registry)
      assert length(resources) == 2
      assert Enum.any?(resources, &(&1.key == "mana"))
      assert Enum.any?(resources, &(&1.key == "health"))

      File.rm_rf!(test_dir)
    end
  end

  describe "count/1" do
    test "returns 0 when no resources loaded", %{registry: registry} do
      assert 0 = ResourceRegistry.count(registry)
    end

    test "returns count of loaded resources", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "r1.yml"), "key: r1\nname: R1")
      File.write!(Path.join(test_dir, "r2.yml"), "key: r2\nname: R2")
      File.write!(Path.join(test_dir, "r3.yml"), "key: r3\nname: R3")

      ResourceRegistry.load_from(test_dir, registry)

      assert 3 = ResourceRegistry.count(registry)

      File.rm_rf!(test_dir)
    end
  end

  describe "exists?/2" do
    test "returns true when resource exists", %{registry: registry} do
      test_dir = setup_test_resource(registry, "mana", "Mana", "100")

      assert true = ResourceRegistry.exists?("mana", registry)

      File.rm_rf!(test_dir)
    end

    test "returns false when resource does not exist", %{registry: registry} do
      refute ResourceRegistry.exists?("nonexistent", registry)
    end
  end

  describe "regenerating/1" do
    test "returns empty list when no resources loaded", %{registry: registry} do
      assert [] = ResourceRegistry.regenerating(registry)
    end

    test "returns only resources that regenerate", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      regen_rate: 5
      regen_condition: always
      """)

      File.write!(Path.join(test_dir, "action.yml"), """
      key: action
      name: Action
      regen_rate: 0
      regen_condition: never
      """)

      File.write!(Path.join(test_dir, "health.yml"), """
      key: health
      name: Health
      regen_rate: 2
      regen_condition: out_of_combat
      """)

      ResourceRegistry.load_from(test_dir, registry)

      regen_resources = ResourceRegistry.regenerating(registry)
      assert length(regen_resources) == 2
      assert Enum.any?(regen_resources, &(&1.key == "mana"))
      assert Enum.any?(regen_resources, &(&1.key == "health"))
      refute Enum.any?(regen_resources, &(&1.key == "action"))

      File.rm_rf!(test_dir)
    end
  end

  describe "reload/1" do
    test "reloads resources from disk", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      # Initial load
      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      """)

      ResourceRegistry.load_from(test_dir, registry)
      assert 1 = ResourceRegistry.count(registry)

      # Add another resource
      File.write!(Path.join(test_dir, "health.yml"), """
      key: health
      name: Health
      """)

      # Reload
      assert :ok = ResourceRegistry.reload(registry)

      assert 2 = ResourceRegistry.count(registry)
      assert {:ok, _} = ResourceRegistry.get("mana", registry)
      assert {:ok, _} = ResourceRegistry.get("health", registry)

      File.rm_rf!(test_dir)
    end

    test "returns error if reload fails due to parse errors", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      # Create valid resource first
      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      """)

      ResourceRegistry.load_from(test_dir, registry)

      # Create invalid resource
      File.write!(Path.join(test_dir, "invalid.yml"), """
      name: Invalid
      """)

      # Reload should fail
      assert {:error, _errors} = ResourceRegistry.reload(registry)

      File.rm_rf!(test_dir)
    end
  end

  describe "load_from/2" do
    test "loads resources from specified path", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      max_formula: "100"
      """)

      assert :ok = ResourceRegistry.load_from(test_dir, registry)
      assert {:ok, resource} = ResourceRegistry.get("mana", registry)
      assert resource.name == "Mana"

      File.rm_rf!(test_dir)
    end

    test "handles non-existent directory gracefully", %{registry: registry} do
      assert :ok = ResourceRegistry.load_from("test/nonexistent", registry)
      assert 0 = ResourceRegistry.count(registry)
    end

    test "loads from nested directories", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      nested_dir = Path.join(test_dir, "combat")
      File.mkdir_p!(nested_dir)

      File.write!(Path.join(nested_dir, "rage.yml"), """
      key: rage
      name: Rage
      """)

      ResourceRegistry.load_from(test_dir, registry)

      assert {:ok, resource} = ResourceRegistry.get("rage", registry)
      assert resource.name == "Rage"

      File.rm_rf!(test_dir)
    end

    test "supports both .yml and .yaml extensions", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "mana.yml"), """
      key: mana
      name: Mana
      """)

      File.write!(Path.join(test_dir, "energy.yaml"), """
      key: energy
      name: Energy
      """)

      ResourceRegistry.load_from(test_dir, registry)

      assert {:ok, _} = ResourceRegistry.get("mana", registry)
      assert {:ok, _} = ResourceRegistry.get("energy", registry)

      File.rm_rf!(test_dir)
    end

    test "returns error for invalid YAML", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "invalid.yml"), "key: missing_name")

      result = ResourceRegistry.load_from(test_dir, registry)
      assert {:error, errors} = result
      assert is_list(errors)
      assert errors != []

      File.rm_rf!(test_dir)
    end
  end

  describe "resource validation during load" do
    test "loads resource with all valid fields", %{registry: registry} do
      test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "complete.yml"), """
      key: complete
      name: Complete Resource
      max_formula: "level * 10 + sta * 2"
      regen_rate: 5
      regen_condition: out_of_combat
      color: blue
      description: "A complete resource definition"
      min_value: 0
      starts_full: true
      hidden: false
      """)

      ResourceRegistry.load_from(test_dir, registry)

      assert {:ok, resource} = ResourceRegistry.get("complete", registry)
      assert resource.max_formula == "level * 10 + sta * 2"
      assert resource.regen_rate == 5
      assert resource.regen_condition == :out_of_combat
      assert resource.color == "blue"

      File.rm_rf!(test_dir)
    end

    test "loads resource with minimal fields", %{registry: registry} do
      test_dir = setup_test_resource(registry, "minimal", "Minimal", nil)

      assert {:ok, resource} = ResourceRegistry.get("minimal", registry)
      assert resource.key == "minimal"
      assert resource.name == "Minimal"
      assert resource.max_formula == "100"

      File.rm_rf!(test_dir)
    end
  end

  # Helper functions
  defp setup_test_resource(registry, key, name, formula) do
    test_dir = "test/tmp/resources_#{:erlang.unique_integer([:positive])}"
    File.mkdir_p!(test_dir)

    content =
      if formula do
        """
        key: #{key}
        name: #{name}
        max_formula: "#{formula}"
        """
      else
        """
        key: #{key}
        name: #{name}
        """
      end

    File.write!(Path.join(test_dir, "#{key}.yml"), content)
    ResourceRegistry.load_from(test_dir, registry)

    test_dir
  end
end
