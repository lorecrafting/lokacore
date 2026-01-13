defmodule Loka.Framework.Skills.SkillRegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Skills.SkillRegistry

  @test_skills_dir "test/fixtures/skills"

  setup do
    # Create a unique registry for each test
    registry_name = :"registry_#{:erlang.unique_integer([:positive])}"

    # Clean up any existing test directory
    if File.exists?(@test_skills_dir) do
      File.rm_rf!(@test_skills_dir)
    end

    on_exit(fn ->
      # Clean up test directory
      if File.exists?(@test_skills_dir) do
        File.rm_rf!(@test_skills_dir)
      end
    end)

    {:ok, registry: registry_name}
  end

  describe "start_link/1" do
    test "starts registry with default options" do
      assert {:ok, pid} = SkillRegistry.start_link(name: :test_registry_1, load_on_start: false)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts registry and loads skills from path", %{registry: name} do
      create_test_skill_file("basic_combat.yml", """
      key: basic_combat
      name: "Basic Combat"
      category: combat
      max_level: 100
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      assert Process.alive?(pid)
      assert {:ok, _skill} = SkillRegistry.get("basic_combat", name)

      GenServer.stop(pid)
    end

    test "starts empty when path doesn't exist", %{registry: name} do
      {:ok, pid} =
        SkillRegistry.start_link(
          name: name,
          path: "nonexistent/path",
          load_on_start: true
        )

      assert Process.alive?(pid)
      assert SkillRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns skill when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      assert {:ok, skill} = SkillRegistry.get("basic_combat", name)
      assert skill.key == "basic_combat"
      assert skill.name == "Basic Combat"
      assert skill.category == "combat"

      GenServer.stop(pid)
    end

    test "returns error when skill not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      assert {:error, :not_found} = SkillRegistry.get("nonexistent", name)

      GenServer.stop(pid)
    end
  end

  describe "get!/2" do
    test "returns skill when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      skill = SkillRegistry.get!("basic_combat", name)
      assert skill.key == "basic_combat"

      GenServer.stop(pid)
    end

    test "raises when skill not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      assert_raise RuntimeError, "Skill not found: nonexistent", fn ->
        SkillRegistry.get!("nonexistent", name)
      end

      GenServer.stop(pid)
    end
  end

  describe "by_category/2" do
    test "returns skills in specified category", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      combat_skills = SkillRegistry.by_category("combat", name)

      assert length(combat_skills) == 2
      assert Enum.all?(combat_skills, &(&1.category == "combat"))

      skill_keys = Enum.map(combat_skills, & &1.key) |> Enum.sort()
      assert skill_keys == ["basic_combat", "swordsmanship"]

      GenServer.stop(pid)
    end

    test "returns empty list when no skills in category", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      skills = SkillRegistry.by_category("unknown_category", name)

      assert skills == []

      GenServer.stop(pid)
    end

    test "returns skills from specific category only", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      crafting_skills = SkillRegistry.by_category("crafting", name)

      assert length(crafting_skills) == 1
      assert hd(crafting_skills).key == "blacksmithing"

      GenServer.stop(pid)
    end
  end

  describe "by_tag/2" do
    test "returns skills with specified tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      weapon_skills = SkillRegistry.by_tag("weapon", name)

      assert length(weapon_skills) == 1
      assert hd(weapon_skills).key == "swordsmanship"

      GenServer.stop(pid)
    end

    test "returns empty list when no skills have tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      skills = SkillRegistry.by_tag("nonexistent_tag", name)

      assert skills == []

      GenServer.stop(pid)
    end

    test "returns multiple skills with same tag", %{registry: name} do
      create_test_skill_file("archery.yml", """
      key: archery
      name: "Archery"
      category: combat
      tags:
        - ranged
        - weapon
      """)

      create_test_skill_file("swordsmanship.yml", """
      key: swordsmanship
      name: "Swordsmanship"
      category: combat
      tags:
        - melee
        - weapon
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      weapon_skills = SkillRegistry.by_tag("weapon", name)

      assert length(weapon_skills) == 2
      skill_keys = Enum.map(weapon_skills, & &1.key) |> Enum.sort()
      assert skill_keys == ["archery", "swordsmanship"]

      GenServer.stop(pid)
    end
  end

  describe "all/1" do
    test "returns all registered skills", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      all_skills = SkillRegistry.all(name)

      assert length(all_skills) == 3
      skill_keys = Enum.map(all_skills, & &1.key) |> Enum.sort()
      assert skill_keys == ["basic_combat", "blacksmithing", "swordsmanship"]

      GenServer.stop(pid)
    end

    test "returns empty list when no skills registered", %{registry: name} do
      {:ok, pid} = SkillRegistry.start_link(name: name, load_on_start: false)

      assert SkillRegistry.all(name) == []

      GenServer.stop(pid)
    end
  end

  describe "count/1" do
    test "returns number of registered skills", %{registry: name} do
      {:ok, pid} = start_registry_with_test_skills(name)

      assert SkillRegistry.count(name) == 3

      GenServer.stop(pid)
    end

    test "returns 0 when no skills registered", %{registry: name} do
      {:ok, pid} = SkillRegistry.start_link(name: name, load_on_start: false)

      assert SkillRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "reload/1" do
    test "reloads skills from disk", %{registry: name} do
      create_test_skill_file("skill1.yml", """
      key: skill1
      name: "Skill 1"
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      assert SkillRegistry.count(name) == 1

      # Add another skill file
      create_test_skill_file("skill2.yml", """
      key: skill2
      name: "Skill 2"
      """)

      # Reload
      assert :ok = SkillRegistry.reload(name)

      assert SkillRegistry.count(name) == 2
      assert {:ok, _} = SkillRegistry.get("skill2", name)

      GenServer.stop(pid)
    end

    test "replaces existing skills on reload", %{registry: name} do
      create_test_skill_file("skill1.yml", """
      key: skill1
      name: "Original Name"
      category: combat
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      {:ok, original} = SkillRegistry.get("skill1", name)
      assert original.name == "Original Name"

      # Update the file
      create_test_skill_file("skill1.yml", """
      key: skill1
      name: "Updated Name"
      category: magic
      """)

      assert :ok = SkillRegistry.reload(name)

      {:ok, updated} = SkillRegistry.get("skill1", name)
      assert updated.name == "Updated Name"
      assert updated.category == "magic"

      GenServer.stop(pid)
    end

    test "returns error when files have parse errors", %{registry: name} do
      create_test_skill_file("valid.yml", """
      key: valid
      name: "Valid Skill"
      """)

      create_test_skill_file("invalid.yml", """
      key: invalid
      # Missing required 'name' field
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      # Initial load may succeed or fail depending on file order
      # Reload should return error due to invalid file
      result = SkillRegistry.reload(name)

      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0

      GenServer.stop(pid)
    end
  end

  describe "YAML loading" do
    test "loads skill with all fields", %{registry: name} do
      create_test_skill_file("full_skill.yml", """
      key: full_skill
      name: "Full Skill"
      category: combat
      max_level: 75
      description: "A complete skill definition"
      prerequisites:
        - skill: basic_combat
          level: 10
      unlocks:
        - advanced_technique
      trainers:
        - master_trainer
      practice_actions:
        - practice_action
      xp_per_use: 2
      xp_per_level: 150
      point_cost_formula: "level_squared"
      tags:
        - advanced
        - special
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      {:ok, skill} = SkillRegistry.get("full_skill", name)

      assert skill.key == "full_skill"
      assert skill.name == "Full Skill"
      assert skill.category == "combat"
      assert skill.max_level == 75
      assert skill.description == "A complete skill definition"
      assert skill.prerequisites == [%{skill: "basic_combat", level: 10}]
      assert skill.unlocks == ["advanced_technique"]
      assert skill.trainers == ["master_trainer"]
      assert skill.practice_actions == ["practice_action"]
      assert skill.xp_per_use == 2
      assert skill.xp_per_level == 150
      assert skill.point_cost_formula == "level_squared"
      assert skill.tags == ["advanced", "special"]

      GenServer.stop(pid)
    end

    test "loads skill with minimal fields", %{registry: name} do
      create_test_skill_file("minimal.yml", """
      key: minimal
      name: "Minimal Skill"
      """)

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      {:ok, skill} = SkillRegistry.get("minimal", name)

      assert skill.key == "minimal"
      assert skill.name == "Minimal Skill"
      assert skill.category == "general"
      assert skill.max_level == 100
      assert skill.description == ""
      assert skill.prerequisites == []
      assert skill.unlocks == []
      assert skill.trainers == []
      assert skill.practice_actions == []
      assert skill.xp_per_use == 1
      assert skill.xp_per_level == 100
      assert skill.point_cost_formula == "level"
      assert skill.tags == []

      GenServer.stop(pid)
    end

    test "loads skills from nested directories", %{registry: name} do
      # Create nested directory structure
      nested_dir = Path.join(@test_skills_dir, "combat")
      File.mkdir_p!(nested_dir)

      File.write!(
        Path.join(nested_dir, "swordsmanship.yml"),
        """
        key: swordsmanship
        name: "Swordsmanship"
        category: combat
        """
      )

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      assert {:ok, skill} = SkillRegistry.get("swordsmanship", name)
      assert skill.name == "Swordsmanship"

      GenServer.stop(pid)
    end

    test "supports both .yml and .yaml extensions", %{registry: name} do
      create_test_skill_file("skill1.yml", """
      key: skill1
      name: "Skill 1"
      """)

      File.mkdir_p!(@test_skills_dir)

      File.write!(
        Path.join(@test_skills_dir, "skill2.yaml"),
        """
        key: skill2
        name: "Skill 2"
        """
      )

      {:ok, pid} = SkillRegistry.start_link(name: name, path: @test_skills_dir)

      assert {:ok, _} = SkillRegistry.get("skill1", name)
      assert {:ok, _} = SkillRegistry.get("skill2", name)
      assert SkillRegistry.count(name) == 2

      GenServer.stop(pid)
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp create_test_skill_file(filename, content) do
    File.mkdir_p!(@test_skills_dir)
    File.write!(Path.join(@test_skills_dir, filename), content)
  end

  defp start_registry_with_test_skills(name) do
    create_test_skill_file("basic_combat.yml", """
    key: basic_combat
    name: "Basic Combat"
    category: combat
    max_level: 100
    xp_per_use: 1
    xp_per_level: 100
    """)

    create_test_skill_file("swordsmanship.yml", """
    key: swordsmanship
    name: "Swordsmanship"
    category: combat
    max_level: 100
    prerequisites:
      - skill: basic_combat
        level: 10
    tags:
      - weapon
      - melee
    """)

    create_test_skill_file("blacksmithing.yml", """
    key: blacksmithing
    name: "Blacksmithing"
    category: crafting
    max_level: 100
    """)

    SkillRegistry.start_link(name: name, path: @test_skills_dir)
  end
end
