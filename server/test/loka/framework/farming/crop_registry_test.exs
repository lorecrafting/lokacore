defmodule Loka.Framework.Farming.CropRegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Farming.CropRegistry

  @test_crops_dir "test/fixtures/crops"

  setup do
    # Create a unique registry for each test
    registry_name = :"registry_#{:erlang.unique_integer([:positive])}"

    # Clean up any existing test directory
    if File.exists?(@test_crops_dir) do
      File.rm_rf!(@test_crops_dir)
    end

    on_exit(fn ->
      # Clean up test directory
      if File.exists?(@test_crops_dir) do
        File.rm_rf!(@test_crops_dir)
      end
    end)

    {:ok, registry: registry_name}
  end

  describe "start_link/1" do
    test "starts registry with default options" do
      assert {:ok, pid} = CropRegistry.start_link(name: :test_registry_1, load_on_start: false)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts registry and loads crops from path", %{registry: name} do
      create_test_crop_file("wheat.yml", """
      key: wheat_crop
      name: "Wheat"
      seed_item: wheat_seeds
      growth_stages:
        - stage: planted
          duration: 300
          description: "Seeds freshly planted."
        - stage: harvestable
          duration: null
          description: "Golden wheat ready for harvest."
      harvest_yield:
        - item: wheat
          quantity: [3, 6]
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      assert Process.alive?(pid)
      assert {:ok, _crop} = CropRegistry.get("wheat_crop", name)

      GenServer.stop(pid)
    end

    test "starts empty when path doesn't exist", %{registry: name} do
      {:ok, pid} =
        CropRegistry.start_link(
          name: name,
          path: "nonexistent/path",
          load_on_start: true
        )

      assert Process.alive?(pid)
      assert CropRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns crop when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert {:ok, crop} = CropRegistry.get("wheat_crop", name)
      assert crop.key == "wheat_crop"
      assert crop.name == "Wheat"
      assert crop.seed_item == "wheat_seeds"

      GenServer.stop(pid)
    end

    test "returns error when crop not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert {:error, :not_found} = CropRegistry.get("nonexistent", name)

      GenServer.stop(pid)
    end
  end

  describe "get!/2" do
    test "returns crop when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      crop = CropRegistry.get!("wheat_crop", name)
      assert crop.key == "wheat_crop"

      GenServer.stop(pid)
    end

    test "raises when crop not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert_raise RuntimeError, "Crop not found: nonexistent", fn ->
        CropRegistry.get!("nonexistent", name)
      end

      GenServer.stop(pid)
    end
  end

  describe "by_seed/2" do
    test "returns crop for specified seed item", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert {:ok, crop} = CropRegistry.by_seed("wheat_seeds", name)
      assert crop.key == "wheat_crop"
      assert crop.seed_item == "wheat_seeds"

      GenServer.stop(pid)
    end

    test "returns error when no crop uses the seed", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert {:error, :not_found} = CropRegistry.by_seed("unknown_seeds", name)

      GenServer.stop(pid)
    end

    test "finds correct crop among multiple crops", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert {:ok, carrot_crop} = CropRegistry.by_seed("carrot_seeds", name)
      assert carrot_crop.key == "carrot_crop"
      assert carrot_crop.name == "Carrot"

      GenServer.stop(pid)
    end
  end

  describe "by_tag/2" do
    test "returns crops with specified tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      basic_crops = CropRegistry.by_tag("basic", name)

      assert length(basic_crops) == 2
      assert Enum.all?(basic_crops, &("basic" in &1.tags))

      crop_keys = Enum.map(basic_crops, & &1.key) |> Enum.sort()
      assert crop_keys == ["carrot_crop", "wheat_crop"]

      GenServer.stop(pid)
    end

    test "returns empty list when no crops have tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      crops = CropRegistry.by_tag("nonexistent_tag", name)

      assert crops == []

      GenServer.stop(pid)
    end

    test "returns crops from specific tag only", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      grain_crops = CropRegistry.by_tag("grain", name)

      assert length(grain_crops) == 1
      assert hd(grain_crops).key == "wheat_crop"

      GenServer.stop(pid)
    end

    test "returns multiple crops with same tag", %{registry: name} do
      create_test_crop_file("corn.yml", """
      key: corn_crop
      name: "Corn"
      seed_item: corn_seeds
      tags:
        - basic
        - grain
      """)

      create_test_crop_file("wheat.yml", """
      key: wheat_crop
      name: "Wheat"
      seed_item: wheat_seeds
      tags:
        - basic
        - grain
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      grain_crops = CropRegistry.by_tag("grain", name)

      assert length(grain_crops) == 2
      crop_keys = Enum.map(grain_crops, & &1.key) |> Enum.sort()
      assert crop_keys == ["corn_crop", "wheat_crop"]

      GenServer.stop(pid)
    end
  end

  describe "all/1" do
    test "returns all registered crops", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      all_crops = CropRegistry.all(name)

      assert length(all_crops) == 3
      crop_keys = Enum.map(all_crops, & &1.key) |> Enum.sort()
      assert crop_keys == ["carrot_crop", "tomato_crop", "wheat_crop"]

      GenServer.stop(pid)
    end

    test "returns empty list when no crops registered", %{registry: name} do
      {:ok, pid} = CropRegistry.start_link(name: name, load_on_start: false)

      assert CropRegistry.all(name) == []

      GenServer.stop(pid)
    end
  end

  describe "count/1" do
    test "returns number of registered crops", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert CropRegistry.count(name) == 3

      GenServer.stop(pid)
    end

    test "returns 0 when no crops registered", %{registry: name} do
      {:ok, pid} = CropRegistry.start_link(name: name, load_on_start: false)

      assert CropRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "exists?/2" do
    test "returns true when crop exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert CropRegistry.exists?("wheat_crop", name) == true

      GenServer.stop(pid)
    end

    test "returns false when crop does not exist", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      assert CropRegistry.exists?("nonexistent", name) == false

      GenServer.stop(pid)
    end
  end

  describe "reload/1" do
    test "reloads crops from disk", %{registry: name} do
      create_test_crop_file("crop1.yml", """
      key: crop1
      name: "Crop 1"
      seed_item: seeds1
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      assert CropRegistry.count(name) == 1

      # Add another crop file
      create_test_crop_file("crop2.yml", """
      key: crop2
      name: "Crop 2"
      seed_item: seeds2
      """)

      # Reload
      assert :ok = CropRegistry.reload(name)

      assert CropRegistry.count(name) == 2
      assert {:ok, _} = CropRegistry.get("crop2", name)

      GenServer.stop(pid)
    end

    test "replaces existing crops on reload", %{registry: name} do
      create_test_crop_file("crop1.yml", """
      key: crop1
      name: "Original Name"
      seed_item: seeds1
      requires_water: false
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      {:ok, original} = CropRegistry.get("crop1", name)
      assert original.name == "Original Name"
      assert original.requires_water == false

      # Update the file
      create_test_crop_file("crop1.yml", """
      key: crop1
      name: "Updated Name"
      seed_item: seeds1
      requires_water: true
      """)

      assert :ok = CropRegistry.reload(name)

      {:ok, updated} = CropRegistry.get("crop1", name)
      assert updated.name == "Updated Name"
      assert updated.requires_water == true

      GenServer.stop(pid)
    end

    test "returns error when files have parse errors", %{registry: name} do
      create_test_crop_file("valid.yml", """
      key: valid
      name: "Valid Crop"
      seed_item: valid_seeds
      """)

      create_test_crop_file("invalid.yml", """
      key: invalid
      name: "Invalid"
      # Missing required 'seed_item' field
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      # Reload should return error due to invalid file
      result = CropRegistry.reload(name)

      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0

      GenServer.stop(pid)
    end
  end

  describe "load_from/2" do
    test "loads crops from specified path", %{registry: name} do
      create_test_crop_file("wheat.yml", """
      key: wheat_crop
      name: "Wheat"
      seed_item: wheat_seeds
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, load_on_start: false)

      assert :ok = CropRegistry.load_from(@test_crops_dir, name)
      assert {:ok, crop} = CropRegistry.get("wheat_crop", name)
      assert crop.name == "Wheat"

      GenServer.stop(pid)
    end

    test "updates path when loading from new location", %{registry: name} do
      # Create initial directory
      create_test_crop_file("crop1.yml", """
      key: crop1
      name: "Crop 1"
      seed_item: seeds1
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, load_on_start: false)
      assert :ok = CropRegistry.load_from(@test_crops_dir, name)
      assert CropRegistry.count(name) == 1

      # Create a different directory
      alternate_dir = "test/fixtures/alternate_crops"
      File.mkdir_p!(alternate_dir)

      File.write!(
        Path.join(alternate_dir, "crop2.yml"),
        """
        key: crop2
        name: "Crop 2"
        seed_item: seeds2
        """
      )

      # Load from alternate path
      assert :ok = CropRegistry.load_from(alternate_dir, name)
      assert CropRegistry.count(name) == 1
      assert {:ok, _} = CropRegistry.get("crop2", name)
      assert {:error, :not_found} = CropRegistry.get("crop1", name)

      # Reload should use the new path
      File.write!(
        Path.join(alternate_dir, "crop3.yml"),
        """
        key: crop3
        name: "Crop 3"
        seed_item: seeds3
        """
      )

      assert :ok = CropRegistry.reload(name)
      assert CropRegistry.count(name) == 2

      File.rm_rf!(alternate_dir)
      GenServer.stop(pid)
    end

    test "handles non-existent directory gracefully", %{registry: name} do
      {:ok, pid} = CropRegistry.start_link(name: name, load_on_start: false)

      assert :ok = CropRegistry.load_from("test/nonexistent", name)
      assert CropRegistry.count(name) == 0

      GenServer.stop(pid)
    end

    test "returns error for invalid YAML", %{registry: name} do
      create_test_crop_file("invalid.yml", """
      key: missing_required_fields
      # Missing 'name' and 'seed_item'
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, load_on_start: false)

      result = CropRegistry.load_from(@test_crops_dir, name)
      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0

      GenServer.stop(pid)
    end
  end

  describe "YAML loading" do
    test "loads crop with all fields", %{registry: name} do
      create_test_crop_file("full_crop.yml", """
      key: full_crop
      name: "Full Crop"
      seed_item: full_seeds
      growth_stages:
        - stage: planted
          duration: 300
          description: "Seeds planted in soil."
        - stage: sprouting
          duration: 600
          description: "Green shoots emerging."
        - stage: growing
          duration: 900
          description: "Plants growing tall."
        - stage: harvestable
          duration: null
          description: "Ready to harvest."
      harvest_yield:
        - item: full_crop_item
          quantity: [5, 10]
          chance: 1.0
        - item: full_seeds
          quantity: [1, 3]
          chance: 0.5
      requires_water: true
      can_wither: true
      wither_time: 2400
      skill_required: farming
      skill_level: 25
      xp_reward:
        skill: farming
        amount: 50
      plant_message: "You carefully plant the seeds."
      water_message: "You water the thirsty plants."
      harvest_message: "You harvest a bountiful crop."
      wither_message: "The plants have died from neglect."
      tags:
        - advanced
        - valuable
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      {:ok, crop} = CropRegistry.get("full_crop", name)

      assert crop.key == "full_crop"
      assert crop.name == "Full Crop"
      assert crop.seed_item == "full_seeds"
      assert length(crop.growth_stages) == 4
      assert crop.requires_water == true
      assert crop.can_wither == true
      assert crop.wither_time == 2400
      assert crop.skill_required == "farming"
      assert crop.skill_level == 25
      assert crop.xp_reward == %{skill: "farming", amount: 50}
      assert crop.plant_message == "You carefully plant the seeds."
      assert crop.water_message == "You water the thirsty plants."
      assert crop.harvest_message == "You harvest a bountiful crop."
      assert crop.wither_message == "The plants have died from neglect."
      assert crop.tags == ["advanced", "valuable"]
      assert length(crop.harvest_yield) == 2

      GenServer.stop(pid)
    end

    test "loads crop with minimal fields", %{registry: name} do
      create_test_crop_file("minimal.yml", """
      key: minimal
      name: "Minimal Crop"
      seed_item: minimal_seeds
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      {:ok, crop} = CropRegistry.get("minimal", name)

      assert crop.key == "minimal"
      assert crop.name == "Minimal Crop"
      assert crop.seed_item == "minimal_seeds"
      assert crop.growth_stages == []
      assert crop.harvest_yield == []
      assert crop.requires_water == false
      assert crop.can_wither == false
      assert crop.wither_time == 1800
      assert crop.skill_required == nil
      assert crop.skill_level == 0
      assert crop.xp_reward == nil
      assert crop.plant_message == "You plant the seeds in the soil."
      assert crop.water_message == "You water the growing plants."
      assert crop.harvest_message == "You harvest the crop."
      assert crop.wither_message == "The plants have withered from neglect."
      assert crop.tags == []

      GenServer.stop(pid)
    end

    test "loads crops from nested directories", %{registry: name} do
      # Create nested directory structure
      nested_dir = Path.join(@test_crops_dir, "vegetables")
      File.mkdir_p!(nested_dir)

      File.write!(
        Path.join(nested_dir, "potato.yml"),
        """
        key: potato_crop
        name: "Potato"
        seed_item: potato_seeds
        tags:
          - vegetable
        """
      )

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      assert {:ok, crop} = CropRegistry.get("potato_crop", name)
      assert crop.name == "Potato"
      assert crop.tags == ["vegetable"]

      GenServer.stop(pid)
    end

    test "supports both .yml and .yaml extensions", %{registry: name} do
      create_test_crop_file("crop1.yml", """
      key: crop1
      name: "Crop 1"
      seed_item: seeds1
      """)

      File.mkdir_p!(@test_crops_dir)

      File.write!(
        Path.join(@test_crops_dir, "crop2.yaml"),
        """
        key: crop2
        name: "Crop 2"
        seed_item: seeds2
        """
      )

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      assert {:ok, _} = CropRegistry.get("crop1", name)
      assert {:ok, _} = CropRegistry.get("crop2", name)
      assert CropRegistry.count(name) == 2

      GenServer.stop(pid)
    end

    test "handles growth stages with varied durations", %{registry: name} do
      create_test_crop_file("staged.yml", """
      key: staged_crop
      name: "Staged Crop"
      seed_item: staged_seeds
      growth_stages:
        - stage: planted
          duration: 100
          description: "Freshly planted."
        - stage: final
          duration: null
          description: "Ready to harvest."
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      {:ok, crop} = CropRegistry.get("staged_crop", name)

      assert length(crop.growth_stages) == 2
      first_stage = Enum.at(crop.growth_stages, 0)
      second_stage = Enum.at(crop.growth_stages, 1)

      assert first_stage.stage == "planted"
      assert first_stage.duration == 100
      assert second_stage.stage == "final"
      assert second_stage.duration == nil

      GenServer.stop(pid)
    end

    test "handles harvest yield with different quantity formats", %{registry: name} do
      create_test_crop_file("yield_test.yml", """
      key: yield_crop
      name: "Yield Crop"
      seed_item: yield_seeds
      harvest_yield:
        - item: item1
          quantity: 5
        - item: item2
          quantity: [3, 8]
          chance: 0.75
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      {:ok, crop} = CropRegistry.get("yield_crop", name)

      assert length(crop.harvest_yield) == 2

      first_yield = Enum.at(crop.harvest_yield, 0)
      assert first_yield.item == "item1"
      assert first_yield.quantity == 5
      assert first_yield.chance == 1.0

      second_yield = Enum.at(crop.harvest_yield, 1)
      assert second_yield.item == "item2"
      assert second_yield.quantity == {3, 8}
      assert second_yield.chance == 0.75

      GenServer.stop(pid)
    end
  end

  describe "ETS table management" do
    test "stores crops in ETS table", %{registry: name} do
      create_test_crop_file("wheat.yml", """
      key: wheat_crop
      name: "Wheat"
      seed_item: wheat_seeds
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)

      # Verify crop is accessible (which means it's in ETS)
      assert {:ok, crop} = CropRegistry.get("wheat_crop", name)
      assert crop.key == "wheat_crop"

      GenServer.stop(pid)
    end

    test "clears ETS table on reload", %{registry: name} do
      create_test_crop_file("crop1.yml", """
      key: crop1
      name: "Crop 1"
      seed_item: seeds1
      """)

      {:ok, pid} = CropRegistry.start_link(name: name, path: @test_crops_dir)
      assert CropRegistry.count(name) == 1

      # Replace with different crops
      File.rm_rf!(@test_crops_dir)
      File.mkdir_p!(@test_crops_dir)

      create_test_crop_file("crop2.yml", """
      key: crop2
      name: "Crop 2"
      seed_item: seeds2
      """)

      assert :ok = CropRegistry.reload(name)

      # Old crop should be gone
      assert {:error, :not_found} = CropRegistry.get("crop1", name)
      # New crop should exist
      assert {:ok, _} = CropRegistry.get("crop2", name)
      assert CropRegistry.count(name) == 1

      GenServer.stop(pid)
    end
  end

  describe "concurrent access" do
    test "handles concurrent reads", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      # Spawn multiple processes reading concurrently
      tasks =
        for _ <- 1..20 do
          Task.async(fn ->
            CropRegistry.get("wheat_crop", name)
          end)
        end

      results = Task.await_many(tasks)

      # All reads should succeed
      assert Enum.all?(results, fn
               {:ok, crop} -> crop.key == "wheat_crop"
               _ -> false
             end)

      GenServer.stop(pid)
    end

    test "handles concurrent different queries", %{registry: name} do
      {:ok, pid} = start_registry_with_test_crops(name)

      tasks = [
        Task.async(fn -> CropRegistry.get("wheat_crop", name) end),
        Task.async(fn -> CropRegistry.by_seed("carrot_seeds", name) end),
        Task.async(fn -> CropRegistry.by_tag("basic", name) end),
        Task.async(fn -> CropRegistry.all(name) end),
        Task.async(fn -> CropRegistry.count(name) end)
      ]

      [get_result, by_seed_result, by_tag_result, all_result, count_result] =
        Task.await_many(tasks)

      assert {:ok, %{key: "wheat_crop"}} = get_result
      assert {:ok, %{key: "carrot_crop"}} = by_seed_result
      assert is_list(by_tag_result)
      assert is_list(all_result)
      assert is_integer(count_result)

      GenServer.stop(pid)
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp create_test_crop_file(filename, content) do
    File.mkdir_p!(@test_crops_dir)
    File.write!(Path.join(@test_crops_dir, filename), content)
  end

  defp start_registry_with_test_crops(name) do
    create_test_crop_file("wheat.yml", """
    key: wheat_crop
    name: "Wheat"
    seed_item: wheat_seeds
    growth_stages:
      - stage: planted
        duration: 300
        description: "Seeds freshly planted."
      - stage: sprouting
        duration: 600
        description: "Green shoots emerge."
      - stage: harvestable
        duration: null
        description: "Golden wheat ready for harvest."
    harvest_yield:
      - item: wheat
        quantity: [3, 6]
      - item: wheat_seeds
        quantity: [1, 2]
        chance: 0.5
    requires_water: true
    can_wither: true
    wither_time: 1800
    skill_required: farming
    xp_reward:
      skill: farming
      amount: 15
    tags:
      - basic
      - grain
    """)

    create_test_crop_file("carrot.yml", """
    key: carrot_crop
    name: "Carrot"
    seed_item: carrot_seeds
    growth_stages:
      - stage: planted
        duration: 200
        description: "Carrot seeds planted."
      - stage: harvestable
        duration: null
        description: "Orange carrots ready to pull."
    harvest_yield:
      - item: carrot
        quantity: [2, 4]
    requires_water: true
    tags:
      - basic
      - vegetable
    """)

    create_test_crop_file("tomato.yml", """
    key: tomato_crop
    name: "Tomato"
    seed_item: tomato_seeds
    growth_stages:
      - stage: planted
        duration: 400
        description: "Tomato seeds planted."
      - stage: flowering
        duration: 800
        description: "Yellow flowers blooming."
      - stage: harvestable
        duration: null
        description: "Red tomatoes ready to pick."
    harvest_yield:
      - item: tomato
        quantity: [4, 8]
    requires_water: true
    can_wither: true
    tags:
      - vegetable
    """)

    CropRegistry.start_link(name: name, path: @test_crops_dir)
  end
end
