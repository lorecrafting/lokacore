defmodule Loka.Framework.Combat.WeaponArmorTypes do
  @moduledoc """
  Weapon and armor type interaction system.

  Defines effectiveness relationships between weapon damage types
  and armor material types, creating tactical combat choices.

  ## Weapon Types

  - `slashing` - Swords, axes (effective vs cloth/leather)
  - `bludgeoning` - Maces, hammers (effective vs plate)
  - `piercing` - Spears, arrows (effective vs chain)

  ## Armor Types

  - `cloth` - Robes, clothing (weak vs slashing)
  - `leather` - Hide armor (balanced)
  - `chain` - Chainmail (weak vs piercing)
  - `plate` - Full plate (weak vs bludgeoning)
  - `scale` - Scale armor (balanced)

  ## Configuration (YAML)

      # priv/world/combat/weapon_armor.yml
      effectiveness_matrix:
        slashing:
          cloth: 1.25
          leather: 1.15
          chain: 1.0
          plate: 0.75
          scale: 0.85
          none: 1.0
        bludgeoning:
          cloth: 1.0
          leather: 0.9
          chain: 1.1
          plate: 1.25
          scale: 1.0
          none: 1.0

  ## Usage

      alias Loka.Framework.Combat.WeaponArmorTypes

      # Get damage modifier
      modifier = WeaponArmorTypes.get_modifier(:slashing, :cloth)
      # => 1.25 (effective, 25% bonus)

      # Apply to damage
      final_damage = WeaponArmorTypes.apply_modifier(100, :slashing, :cloth)
      # => 125
  """

  @yaml_path "priv/world/combat/weapon_armor.yml"

  # Load config at compile time for performance
  # Defaults are inlined in the else branch to avoid unused variable warnings
  @external_resource @yaml_path
  @effectiveness_matrix (
                          path = Path.join(:code.priv_dir(:loka), "world/combat/weapon_armor.yml")

                          if File.exists?(path) do
                            yaml = YamlElixir.read_from_file!(path)

                            yaml["effectiveness_matrix"]
                            |> Enum.map(fn {weapon_key, armor_values} ->
                              weapon_atom =
                                if is_atom(weapon_key),
                                  do: weapon_key,
                                  else: String.to_atom(weapon_key)

                              armor_map =
                                armor_values
                                |> Enum.map(fn {armor_key, modifier} ->
                                  armor_atom =
                                    if is_atom(armor_key),
                                      do: armor_key,
                                      else: String.to_atom(armor_key)

                                  {armor_atom, modifier}
                                end)
                                |> Map.new()

                              {weapon_atom, armor_map}
                            end)
                            |> Map.new()
                          else
                            # Fallback defaults (used when YAML doesn't exist)
                            %{
                              slashing: %{
                                cloth: 1.25,
                                leather: 1.15,
                                chain: 1.0,
                                plate: 0.75,
                                scale: 0.85,
                                none: 1.0
                              },
                              bludgeoning: %{
                                cloth: 1.0,
                                leather: 0.9,
                                chain: 1.1,
                                plate: 1.25,
                                scale: 1.0,
                                none: 1.0
                              },
                              piercing: %{
                                cloth: 1.15,
                                leather: 1.1,
                                chain: 1.25,
                                plate: 0.7,
                                scale: 0.9,
                                none: 1.0
                              },
                              magic: %{
                                cloth: 0.9,
                                leather: 0.95,
                                chain: 1.0,
                                plate: 1.0,
                                scale: 1.0,
                                none: 1.0
                              }
                            }
                          end
                        )

  # Derive types from loaded matrix
  @weapon_types Map.keys(@effectiveness_matrix)
  @armor_types @effectiveness_matrix
               |> Map.values()
               |> Enum.flat_map(&Map.keys/1)
               |> Enum.uniq()

  @doc """
  Gets the damage modifier for a weapon type vs armor type.

  Returns a multiplier (1.0 = normal, >1.0 = effective, <1.0 = resisted).
  """
  def get_modifier(weapon_type, armor_type) do
    weapon_type = normalize_type(weapon_type)
    armor_type = normalize_type(armor_type)

    case Map.get(@effectiveness_matrix, weapon_type) do
      nil -> 1.0
      armor_mods -> Map.get(armor_mods, armor_type, 1.0)
    end
  end

  @doc """
  Applies the weapon/armor modifier to damage.
  """
  def apply_modifier(base_damage, weapon_type, armor_type) do
    modifier = get_modifier(weapon_type, armor_type)
    round(base_damage * modifier)
  end

  @doc """
  Gets weapons that are effective against an armor type.
  """
  def effective_weapons(armor_type) do
    armor_type = normalize_type(armor_type)

    @effectiveness_matrix
    |> Enum.filter(fn {_weapon, armors} ->
      Map.get(armors, armor_type, 1.0) > 1.0
    end)
    |> Enum.map(fn {weapon, _} -> weapon end)
  end

  @doc """
  Gets weapons that are weak against an armor type.
  """
  def weak_weapons(armor_type) do
    armor_type = normalize_type(armor_type)

    @effectiveness_matrix
    |> Enum.filter(fn {_weapon, armors} ->
      Map.get(armors, armor_type, 1.0) < 1.0
    end)
    |> Enum.map(fn {weapon, _} -> weapon end)
  end

  @doc """
  Gets armor types that are weak against a weapon type.
  """
  def effective_against(weapon_type) do
    weapon_type = normalize_type(weapon_type)

    case Map.get(@effectiveness_matrix, weapon_type) do
      nil ->
        []

      armor_mods ->
        armor_mods
        |> Enum.filter(fn {_armor, mod} -> mod > 1.0 end)
        |> Enum.map(fn {armor, _} -> armor end)
    end
  end

  @doc """
  Gets armor types that resist a weapon type.
  """
  def resisted_by(weapon_type) do
    weapon_type = normalize_type(weapon_type)

    case Map.get(@effectiveness_matrix, weapon_type) do
      nil ->
        []

      armor_mods ->
        armor_mods
        |> Enum.filter(fn {_armor, mod} -> mod < 1.0 end)
        |> Enum.map(fn {armor, _} -> armor end)
    end
  end

  @doc """
  Gets the effectiveness description.
  """
  def describe_effectiveness(weapon_type, armor_type) do
    modifier = get_modifier(weapon_type, armor_type)

    cond do
      modifier >= 1.2 -> "very effective"
      modifier > 1.0 -> "effective"
      modifier == 1.0 -> "normal"
      modifier >= 0.8 -> "resisted"
      true -> "highly resisted"
    end
  end

  @doc """
  Returns all valid weapon types.
  """
  def weapon_types, do: @weapon_types

  @doc """
  Returns all valid armor types.
  """
  def armor_types, do: @armor_types

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp normalize_type(type) when is_atom(type), do: type

  defp normalize_type(type) when is_binary(type) do
    String.to_existing_atom(type)
  rescue
    ArgumentError -> :none
  end

  defp normalize_type(_), do: :none
end
