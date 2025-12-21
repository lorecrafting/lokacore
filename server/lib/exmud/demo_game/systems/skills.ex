defmodule Exmud.DemoGame.Systems.Skills do
  @moduledoc """
  Defines available skills and skill trainers for the demo game.

  ## Skills
  Skills are combat abilities that players can learn by spending skill points
  at Skill Trainer NPCs. Each skill has a cost and provides combat benefits.

  ## Skill Trainers
  Different trainers teach different categories of skills:
  - Combat Trainer: Offensive combat skills (power_strike, whirlwind, etc.)
  - Defense Trainer: Defensive skills (shield_wall, parry, etc.)
  - Magic Trainer: Magical abilities (heal, fireball, etc.)
  """

  @skills %{
    # Combat Skills (taught by Combat Trainer)
    "power_strike" => %{
      name: "Power Strike",
      description: "A powerful attack that deals 50% more damage.",
      category: :combat,
      cost: 2,
      effect: %{damage_bonus: 0.5}
    },
    "critical_eye" => %{
      name: "Critical Eye",
      description: "Increases critical hit chance by 15%.",
      category: :combat,
      cost: 3,
      effect: %{crit_chance: 0.15}
    },
    "berserker_rage" => %{
      name: "Berserker Rage",
      description: "Deal 100% more damage but take 25% more damage.",
      category: :combat,
      cost: 4,
      effect: %{damage_bonus: 1.0, damage_taken: 0.25}
    },

    # Defense Skills (taught by Defense Trainer)
    "shield_wall" => %{
      name: "Shield Wall",
      description: "Reduces incoming damage by 25% when defending.",
      category: :defense,
      cost: 2,
      effect: %{defense_bonus: 0.25}
    },
    "parry" => %{
      name: "Parry",
      description: "10% chance to completely avoid an attack.",
      category: :defense,
      cost: 3,
      effect: %{dodge_chance: 0.10}
    },
    "fortitude" => %{
      name: "Fortitude",
      description: "Permanently increases max health by 20.",
      category: :defense,
      cost: 4,
      effect: %{max_health: 20}
    },

    # Magic Skills (taught by Magic Trainer)
    "heal" => %{
      name: "Heal",
      description: "Restore 30 health during combat.",
      category: :magic,
      cost: 2,
      effect: %{heal: 30}
    },
    "flame_touch" => %{
      name: "Flame Touch",
      description: "Attacks deal an additional 5 fire damage.",
      category: :magic,
      cost: 3,
      effect: %{fire_damage: 5}
    },
    "arcane_shield" => %{
      name: "Arcane Shield",
      description: "Absorb the first 10 damage each combat.",
      category: :magic,
      cost: 4,
      effect: %{absorb: 10}
    }
  }

  @doc """
  Gets all available skills.
  """
  def all_skills, do: @skills

  @doc """
  Gets a specific skill by ID.
  """
  def get_skill(skill_id) do
    Map.get(@skills, skill_id)
  end

  @doc """
  Gets skills for a specific category.
  """
  def skills_by_category(category) do
    @skills
    |> Enum.filter(fn {_id, skill} -> skill.category == category end)
    |> Enum.into(%{})
  end

  @doc """
  Gets skills taught by a specific trainer type.
  """
  def get_trainer_skills(trainer_type) do
    case trainer_type do
      "combat_trainer" -> skills_by_category(:combat)
      "defense_trainer" -> skills_by_category(:defense)
      "magic_trainer" -> skills_by_category(:magic)
      _ -> %{}
    end
  end

  @doc """
  Checks if a skill ID is valid.
  """
  def valid_skill?(skill_id) do
    Map.has_key?(@skills, skill_id)
  end
end
