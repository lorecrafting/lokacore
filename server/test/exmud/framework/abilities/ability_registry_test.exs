defmodule Exmud.Framework.Abilities.AbilityRegistryTest do
  use Exmud.DataCase, async: false

  alias Exmud.Framework.Abilities.{AbilityRegistry, Ability}
  alias Exmud.Framework.Player.GameState

  import Exmud.AccountsFixtures

  @test_abilities_path "test/support/fixtures/abilities"

  setup do
    # Create test abilities directory and files
    File.mkdir_p!(@test_abilities_path)

    # Create a test ability YAML file
    fireball_yaml = """
    key: fireball
    name: Fireball
    type: offensive
    cost:
      mana: 15
    cooldown: 3
    target: enemy
    effects:
      - type: damage
        amount: 25
        damage_type: fire
    requirements:
      level: 5
      skills:
        - fire_magic
    description: "Hurls a ball of flame at the target."
    cast_message: "You conjure flames and hurl them at {target}!"
    tags:
      - magic
      - fire
    """

    heal_yaml = """
    key: heal
    name: Healing Touch
    type: defensive
    cost:
      mana: 10
    cooldown: 2
    target: ally
    effects:
      - type: heal
        amount: 50
    requirements:
      level: 3
      skills:
        - healing_magic
    description: "Heals an ally."
    cast_message: "You channel healing energy into {target}!"
    tags:
      - magic
      - healing
    """

    shield_yaml = """
    key: shield
    name: Magic Shield
    type: defensive
    cost:
      mana: 20
    cooldown: 10
    target: self
    effects:
      - type: buff
        stat: defense
        modifier: 10
        duration: 5
    requirements:
      level: 7
    description: "Creates a protective shield."
    cast_message: "A shimmering shield surrounds you!"
    tags:
      - magic
      - protection
    """

    File.write!("#{@test_abilities_path}/fireball.yml", fireball_yaml)
    File.write!("#{@test_abilities_path}/heal.yml", heal_yaml)
    File.write!("#{@test_abilities_path}/shield.yml", shield_yaml)

    # Start registry with test path
    {:ok, registry} =
      start_supervised(
        {AbilityRegistry,
         name: TestAbilityRegistry, path: @test_abilities_path, load_on_start: true}
      )

    on_exit(fn ->
      File.rm_rf!(@test_abilities_path)
    end)

    {:ok, registry: registry}
  end

  describe "start_link/1" do
    test "starts the registry and loads abilities", %{registry: registry} do
      assert Process.alive?(registry)
      assert AbilityRegistry.count(TestAbilityRegistry) == 3
    end

    test "can start with empty directory" do
      empty_path = "test/support/fixtures/empty_abilities"
      File.mkdir_p!(empty_path)

      {:ok, pid} =
        start_supervised(
          {AbilityRegistry, name: EmptyRegistry, path: empty_path, load_on_start: true},
          id: :empty_registry
        )

      assert Process.alive?(pid)
      assert AbilityRegistry.count(EmptyRegistry) == 0

      File.rm_rf!(empty_path)
    end

    test "can start without loading on start" do
      {:ok, pid} =
        start_supervised(
          {AbilityRegistry,
           name: NoLoadRegistry, path: @test_abilities_path, load_on_start: false},
          id: :no_load_registry
        )

      assert Process.alive?(pid)
      assert AbilityRegistry.count(NoLoadRegistry) == 0
    end
  end

  describe "get/2" do
    test "retrieves ability by key" do
      assert {:ok, ability} = AbilityRegistry.get("fireball", TestAbilityRegistry)
      assert ability.key == "fireball"
      assert ability.name == "Fireball"
      assert ability.type == :offensive
    end

    test "returns error for non-existent ability" do
      assert {:error, :not_found} = AbilityRegistry.get("nonexistent", TestAbilityRegistry)
    end

    test "retrieved ability has correct structure" do
      {:ok, ability} = AbilityRegistry.get("heal", TestAbilityRegistry)
      assert %Ability{} = ability
      assert ability.key == "heal"
      assert ability.name == "Healing Touch"
      assert ability.type == :defensive
      assert ability.cost == %{"mana" => 10}
      assert ability.cooldown == 2
      assert ability.target == :ally
    end
  end

  describe "get!/2" do
    test "retrieves ability by key" do
      ability = AbilityRegistry.get!("fireball", TestAbilityRegistry)
      assert ability.key == "fireball"
    end

    test "raises for non-existent ability" do
      assert_raise RuntimeError, "Ability not found: nonexistent", fn ->
        AbilityRegistry.get!("nonexistent", TestAbilityRegistry)
      end
    end
  end

  describe "by_type/2" do
    test "filters abilities by offensive type" do
      abilities = AbilityRegistry.by_type(:offensive, TestAbilityRegistry)
      assert length(abilities) == 1
      assert hd(abilities).key == "fireball"
    end

    test "filters abilities by defensive type" do
      abilities = AbilityRegistry.by_type(:defensive, TestAbilityRegistry)
      assert length(abilities) == 2

      ability_keys = Enum.map(abilities, & &1.key) |> Enum.sort()
      assert ability_keys == ["heal", "shield"]
    end

    test "returns empty list for type with no abilities" do
      abilities = AbilityRegistry.by_type(:passive, TestAbilityRegistry)
      assert abilities == []
    end
  end

  describe "by_tag/2" do
    test "filters abilities by tag" do
      magic_abilities = AbilityRegistry.by_tag("magic", TestAbilityRegistry)
      assert length(magic_abilities) == 3
    end

    test "filters abilities by specific tag" do
      fire_abilities = AbilityRegistry.by_tag("fire", TestAbilityRegistry)
      assert length(fire_abilities) == 1
      assert hd(fire_abilities).key == "fireball"
    end

    test "returns empty list for tag with no abilities" do
      abilities = AbilityRegistry.by_tag("nonexistent", TestAbilityRegistry)
      assert abilities == []
    end
  end

  describe "all/1" do
    test "returns all loaded abilities" do
      abilities = AbilityRegistry.all(TestAbilityRegistry)
      assert length(abilities) == 3

      ability_keys = Enum.map(abilities, & &1.key) |> Enum.sort()
      assert ability_keys == ["fireball", "heal", "shield"]
    end
  end

  describe "count/1" do
    test "returns count of loaded abilities" do
      assert AbilityRegistry.count(TestAbilityRegistry) == 3
    end
  end

  describe "exists?/2" do
    test "returns true for existing ability" do
      assert AbilityRegistry.exists?("fireball", TestAbilityRegistry) == true
    end

    test "returns false for non-existent ability" do
      assert AbilityRegistry.exists?("nonexistent", TestAbilityRegistry) == false
    end
  end

  describe "reload/1" do
    test "reloads abilities from disk" do
      # Initial count
      assert AbilityRegistry.count(TestAbilityRegistry) == 3

      # Add a new ability file
      new_ability_yaml = """
      key: lightning
      name: Lightning Bolt
      type: offensive
      cost:
        mana: 20
      cooldown: 4
      target: enemy
      effects:
        - type: damage
          amount: 30
          damage_type: lightning
      description: "Strikes with lightning."
      cast_message: "Lightning crackles from your hands!"
      """

      File.write!("#{@test_abilities_path}/lightning.yml", new_ability_yaml)

      # Reload
      assert :ok = AbilityRegistry.reload(TestAbilityRegistry)

      # New ability should be available
      assert AbilityRegistry.count(TestAbilityRegistry) == 4
      assert {:ok, ability} = AbilityRegistry.get("lightning", TestAbilityRegistry)
      assert ability.name == "Lightning Bolt"
    end

    test "removes deleted abilities on reload" do
      assert {:ok, _} = AbilityRegistry.get("fireball", TestAbilityRegistry)

      # Delete ability file
      File.rm!("#{@test_abilities_path}/fireball.yml")

      # Reload
      AbilityRegistry.reload(TestAbilityRegistry)

      # Ability should be gone
      assert {:error, :not_found} = AbilityRegistry.get("fireball", TestAbilityRegistry)
      assert AbilityRegistry.count(TestAbilityRegistry) == 2
    end
  end

  describe "load_from/2" do
    test "loads abilities from a different path" do
      # Create a different directory with one ability
      alt_path = "test/support/fixtures/alt_abilities"
      File.mkdir_p!(alt_path)

      alt_ability_yaml = """
      key: teleport
      name: Teleport
      type: utility
      cost:
        mana: 25
      cooldown: 15
      target: self
      effects:
        - type: teleport
          room_key: town_square
      description: "Teleports to town."
      cast_message: "You vanish in a flash of light!"
      """

      File.write!("#{alt_path}/teleport.yml", alt_ability_yaml)

      assert :ok = AbilityRegistry.load_from(alt_path, TestAbilityRegistry)

      # Should now have only the new ability
      assert AbilityRegistry.count(TestAbilityRegistry) == 1
      assert {:ok, ability} = AbilityRegistry.get("teleport", TestAbilityRegistry)
      assert ability.name == "Teleport"

      File.rm_rf!(alt_path)
    end
  end

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      # Merge stats instead of replacing them
      merged_attrs =
        if Map.has_key?(attrs, :stats) do
          merged_stats = Map.merge(state.stats, attrs.stats)
          Map.put(attrs, :stats, merged_stats)
        else
          attrs
        end

      {:ok, state} = GameState.update_state(state, merged_attrs)
      state
    else
      state
    end
  end

  describe "available_for/2" do
    setup do
      player_low = player_fixture()
      player_mid = player_fixture()
      player_high = player_fixture()

      state_low_level =
        game_state_fixture(player_low.id, %{
          stats: %{level: 2, skills: []}
        })

      state_mid_level =
        game_state_fixture(player_mid.id, %{
          stats: %{level: 5, skills: ["fire_magic"]}
        })

      state_high_level =
        game_state_fixture(player_high.id, %{
          stats: %{level: 10, skills: ["fire_magic", "healing_magic"]}
        })

      {:ok, state_low: state_low_level, state_mid: state_mid_level, state_high: state_high_level}
    end

    test "returns no abilities for low-level player without skills", %{state_low: state} do
      abilities = AbilityRegistry.available_for(state, TestAbilityRegistry)
      assert abilities == []
    end

    test "returns abilities player meets requirements for", %{state_mid: state} do
      abilities = AbilityRegistry.available_for(state, TestAbilityRegistry)
      ability_keys = Enum.map(abilities, & &1.key) |> Enum.sort()

      # Can use fireball (level 5, fire_magic) but not shield (level 7)
      assert "fireball" in ability_keys
      refute "shield" in ability_keys
    end

    test "returns all available abilities for high-level player with skills", %{
      state_high: state
    } do
      abilities = AbilityRegistry.available_for(state, TestAbilityRegistry)
      ability_keys = Enum.map(abilities, & &1.key) |> Enum.sort()

      # Should have fireball, heal, and shield
      assert "fireball" in ability_keys
      assert "heal" in ability_keys
      assert "shield" in ability_keys
    end

    test "checks both level and skill requirements", %{state_mid: state} do
      # Player has level 5 and fire_magic, but not healing_magic
      abilities = AbilityRegistry.available_for(state, TestAbilityRegistry)
      ability_keys = Enum.map(abilities, & &1.key)

      # Should have fireball but not heal (missing healing_magic skill)
      assert "fireball" in ability_keys
      refute "heal" in ability_keys
    end
  end

  describe "error handling" do
    test "handles invalid YAML gracefully" do
      invalid_path = "test/support/fixtures/invalid_abilities"
      File.mkdir_p!(invalid_path)

      # Create invalid YAML
      File.write!("#{invalid_path}/bad.yml", "key: test\n  invalid: : : yaml")

      # Registry should start but report errors
      {:ok, pid} =
        start_supervised(
          {AbilityRegistry, name: InvalidRegistry, path: invalid_path, load_on_start: true},
          id: :invalid_registry
        )

      assert Process.alive?(pid)
      # No abilities should be loaded from invalid file
      assert AbilityRegistry.count(InvalidRegistry) == 0

      File.rm_rf!(invalid_path)
    end

    test "handles missing required fields" do
      invalid_path = "test/support/fixtures/missing_fields"
      File.mkdir_p!(invalid_path)

      # Create ability without required 'name' field
      File.write!(
        "#{invalid_path}/bad.yml",
        "key: bad_ability\ntype: offensive"
      )

      {:ok, _pid} =
        start_supervised(
          {AbilityRegistry, name: MissingFieldsRegistry, path: invalid_path, load_on_start: true},
          id: :missing_fields_registry
        )

      # Ability with missing fields should not be loaded
      assert AbilityRegistry.count(MissingFieldsRegistry) == 0

      File.rm_rf!(invalid_path)
    end
  end
end
