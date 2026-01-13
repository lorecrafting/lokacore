# Combat System Benchmarks
#
# Run with: mix run test/bench/combat_benchmark.exs
#
# These benchmarks measure the performance of combat calculations
# and the weapon/armor type system.

alias Loka.Framework.Combat.WeaponArmorTypes

IO.puts("\n=== Combat System Benchmarks ===\n")

# Pre-compute some test data
weapon_types = WeaponArmorTypes.weapon_types()
armor_types = WeaponArmorTypes.armor_types()

# Sample damage values for testing
damage_values = Enum.to_list(1..100)

# =============================================================================
# Weapon/Armor Type Calculations
# =============================================================================

IO.puts("--- Weapon/Armor Type Calculations ---\n")

Benchee.run(
  %{
    "get_modifier (single)" => fn ->
      WeaponArmorTypes.get_modifier(:slashing, :cloth)
    end,
    "get_modifier (random pair)" => fn ->
      weapon = Enum.random(weapon_types)
      armor = Enum.random(armor_types)
      WeaponArmorTypes.get_modifier(weapon, armor)
    end,
    "apply_modifier" => fn ->
      WeaponArmorTypes.apply_modifier(100, :slashing, :cloth)
    end,
    "apply_modifier (batch 100)" => fn ->
      for damage <- damage_values do
        WeaponArmorTypes.apply_modifier(damage, :slashing, :cloth)
      end
    end,
    "effective_weapons" => fn ->
      WeaponArmorTypes.effective_weapons(:cloth)
    end,
    "weak_weapons" => fn ->
      WeaponArmorTypes.weak_weapons(:plate)
    end,
    "effective_against" => fn ->
      WeaponArmorTypes.effective_against(:slashing)
    end,
    "resisted_by" => fn ->
      WeaponArmorTypes.resisted_by(:piercing)
    end,
    "describe_effectiveness" => fn ->
      WeaponArmorTypes.describe_effectiveness(:slashing, :cloth)
    end,
    "full damage calculation chain" => fn ->
      # Simulate a complete damage calculation
      base_damage = 50
      weapon = :slashing
      armor = :cloth

      modifier = WeaponArmorTypes.get_modifier(weapon, armor)
      final_damage = WeaponArmorTypes.apply_modifier(base_damage, weapon, armor)
      description = WeaponArmorTypes.describe_effectiveness(weapon, armor)
      {final_damage, description, modifier}
    end
  },
  warmup: 1,
  time: 3,
  memory_time: 1,
  formatters: [Benchee.Formatters.Console]
)

# =============================================================================
# All Combinations
# =============================================================================

IO.puts("\n--- All Type Combinations ---\n")

Benchee.run(
  %{
    "all weapon vs armor modifiers" => fn ->
      for weapon <- weapon_types, armor <- armor_types do
        WeaponArmorTypes.get_modifier(weapon, armor)
      end
    end,
    "all weapon descriptions" => fn ->
      for weapon <- weapon_types do
        WeaponArmorTypes.effective_against(weapon)
        WeaponArmorTypes.resisted_by(weapon)
      end
    end
  },
  warmup: 1,
  time: 3,
  memory_time: 1,
  formatters: [Benchee.Formatters.Console]
)

IO.puts("\n=== Combat Benchmarks Complete ===\n")
