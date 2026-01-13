defmodule Loka.Framework.Quest.QuestRegistryTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Quest.QuestRegistry

  @test_quests_path "test/fixtures/quests"

  setup do
    # Create a fresh registry for each test
    {:ok, pid} =
      QuestRegistry.start_link(path: @test_quests_path, name: nil, load_on_start: false)

    {:ok, registry: pid}
  end

  describe "template inheritance" do
    test "child quest inherits fields from parent template", %{registry: registry} do
      # Create test fixtures directory
      File.mkdir_p!(@test_quests_path)

      # Write parent template
      File.write!(Path.join(@test_quests_path, "parent_template.yml"), """
      id: parent_template
      is_template: true
      type: side
      description: "Parent description"
      rewards:
        xp: 100
      objectives:
        - id: obj1
          type: kill
          target_id: monster
          target_count: 5
          description: "Kill monsters"
      """)

      # Write child quest
      File.write!(Path.join(@test_quests_path, "child_quest.yml"), """
      id: child_quest
      parent: parent_template
      name: "Child Quest"
      giver: npc1
      """)

      # Reload registry
      :ok = QuestRegistry.reload(registry)

      # Verify child inherited from parent
      {:ok, quest} = QuestRegistry.get("child_quest", registry)

      assert quest.name == "Child Quest"
      assert quest.description == "Parent description"
      assert quest.type == "side"
      assert quest.giver == "npc1"
      assert quest.rewards == %{"xp" => 100}
      assert length(quest.objectives) == 1
      assert hd(quest.objectives).target_count == 5
    after
      File.rm_rf!(@test_quests_path)
    end

    test "child quest can override parent fields", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "base_template.yml"), """
      id: base_template
      is_template: true
      type: side
      description: "Base description"
      rewards:
        xp: 50
        gold: 25
      """)

      File.write!(Path.join(@test_quests_path, "override_quest.yml"), """
      id: override_quest
      parent: base_template
      name: "Override Quest"
      description: "Overridden description"
      rewards:
        xp: 100
      """)

      :ok = QuestRegistry.reload(registry)

      {:ok, quest} = QuestRegistry.get("override_quest", registry)

      assert quest.description == "Overridden description"
      # Rewards are deep merged, so gold is inherited and xp is overridden
      assert quest.rewards["xp"] == 100
      assert quest.rewards["gold"] == 25
    after
      File.rm_rf!(@test_quests_path)
    end

    test "templates are filtered out from final quests", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "template.yml"), """
      id: hidden_template
      is_template: true
      type: side
      """)

      :ok = QuestRegistry.reload(registry)

      assert {:error, :not_found} = QuestRegistry.get("hidden_template", registry)
    after
      File.rm_rf!(@test_quests_path)
    end
  end

  describe "variable substitution" do
    test "substitutes ${var} in quest name and description", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "var_quest.yml"), """
      id: var_quest
      name: "Kill the ${enemy_name}"
      description: "Defeat ${count} ${enemy_name} in the ${location}."
      variables:
        enemy_name: goblins
        count: 5
        location: forest
      objectives: []
      """)

      :ok = QuestRegistry.reload(registry)

      {:ok, quest} = QuestRegistry.get("var_quest", registry)

      assert quest.name == "Kill the goblins"
      assert quest.description == "Defeat 5 goblins in the forest."
    after
      File.rm_rf!(@test_quests_path)
    end

    test "substitutes variables in objectives", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "obj_var_quest.yml"), """
      id: obj_var_quest
      name: "Test Quest"
      variables:
        target: wolf
        amount: 3
      objectives:
        - id: kill_target
          type: kill
          target_id: ${target}
          target_count: ${amount}
          description: "Kill ${amount} ${target}"
      """)

      :ok = QuestRegistry.reload(registry)

      {:ok, quest} = QuestRegistry.get("obj_var_quest", registry)

      [objective] = quest.objectives
      assert objective.target_id == "wolf"
      assert objective.target_count == 3
      assert objective.description == "Kill 3 wolf"
    after
      File.rm_rf!(@test_quests_path)
    end

    test "substitutes variables in journal entries", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "journal_var_quest.yml"), """
      id: journal_var_quest
      name: "Journal Quest"
      variables:
        npc_name: Elder
      objectives: []
      journal_entries:
        start: "I spoke with ${npc_name}."
        complete: "${npc_name} thanked me."
      """)

      :ok = QuestRegistry.reload(registry)

      {:ok, quest} = QuestRegistry.get("journal_var_quest", registry)

      assert quest.journal_entries["start"] == "I spoke with Elder."
      assert quest.journal_entries["complete"] == "Elder thanked me."
    after
      File.rm_rf!(@test_quests_path)
    end

    test "child quest inherits and can override parent variables", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "var_template.yml"), """
      id: var_template
      is_template: true
      name: "Defeat ${count} ${enemy}"
      variables:
        count: 5
        enemy: monsters
      objectives:
        - id: kill
          type: kill
          target_id: ${target}
          description: "Defeat ${count} ${enemy}"
      """)

      File.write!(Path.join(@test_quests_path, "var_child.yml"), """
      id: var_child
      parent: var_template
      variables:
        target: dragon
        enemy: dragons
        count: 1
      """)

      :ok = QuestRegistry.reload(registry)

      {:ok, quest} = QuestRegistry.get("var_child", registry)

      assert quest.name == "Defeat 1 dragons"
      [objective] = quest.objectives
      assert objective.target_id == "dragon"
      assert objective.description == "Defeat 1 dragons"
    after
      File.rm_rf!(@test_quests_path)
    end

    test "undefined variables are left as-is", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      File.write!(Path.join(@test_quests_path, "undefined_var.yml"), """
      id: undefined_var
      name: "Quest with ${undefined_var}"
      objectives: []
      """)

      :ok = QuestRegistry.reload(registry)

      {:ok, quest} = QuestRegistry.get("undefined_var", registry)

      assert quest.name == "Quest with ${undefined_var}"
    after
      File.rm_rf!(@test_quests_path)
    end
  end

  describe "template + variables combined" do
    test "full template with variable substitution workflow", %{registry: registry} do
      File.mkdir_p!(@test_quests_path)

      # Kill template similar to the one in priv/world/quests/_templates
      File.write!(Path.join(@test_quests_path, "kill_template.yml"), """
      id: kill_template
      is_template: true
      type: side
      name: "Defeat the ${target_name}"
      description: "Eliminate ${count} ${target_name} threatening the area."
      objectives:
        - id: kill_target
          type: kill
          target_id: ${target}
          target_count: ${count}
          description: "Defeat ${count} ${target_name}"
      rewards:
        xp: ${xp_reward}
      journal_entries:
        start: "I must defeat ${count} ${target_name}."
        complete: "The ${target_name} have been defeated."
      """)

      # Child quest using the template
      File.write!(Path.join(@test_quests_path, "kill_bandits.yml"), """
      id: kill_bandits
      parent: kill_template
      giver: village_elder
      variables:
        target: bandit
        target_name: bandits
        count: 5
        xp_reward: 75
      """)

      :ok = QuestRegistry.reload(registry)

      # Template should be filtered out
      assert {:error, :not_found} = QuestRegistry.get("kill_template", registry)

      # Child should have all substitutions applied
      {:ok, quest} = QuestRegistry.get("kill_bandits", registry)

      assert quest.name == "Defeat the bandits"
      assert quest.description == "Eliminate 5 bandits threatening the area."
      assert quest.giver == "village_elder"
      assert quest.type == "side"

      [objective] = quest.objectives
      assert objective.target_id == "bandit"
      assert objective.target_count == 5
      assert objective.description == "Defeat 5 bandits"

      assert quest.rewards["xp"] == "75"
      assert quest.journal_entries["start"] == "I must defeat 5 bandits."
      assert quest.journal_entries["complete"] == "The bandits have been defeated."
    after
      File.rm_rf!(@test_quests_path)
    end
  end
end
