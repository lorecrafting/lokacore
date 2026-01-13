defmodule Loka.Framework.Combat.DamageMessage do
  @moduledoc """
  Generates immersive combat messages based on damage tiers.

  Instead of "You attack goblin for 15 damage!", this module produces
  literary descriptions like "You slash the goblin!" based on damage amount.

  ## Configuration

  Messages are defined in `priv/world/config/damage_messages.yml` with:
  - Damage tiers (ranges) with associated verbs and messages
  - Weapon-specific verb overrides
  - Spell damage messages by element
  - Avoidance messages (miss, dodge, parry, block)
  - Critical hit and death messages

  ## Usage

      # Generate attack messages
      DamageMessage.generate(15, attacker, defender)
      #=> %{to_attacker: "You hit the goblin.", to_defender: "...", to_room: "..."}

      # With weapon type override
      DamageMessage.generate(25, attacker, defender, weapon_type: :sword)
      #=> %{to_attacker: "You cleave the goblin!", ...}

      # Avoidance messages
      DamageMessage.avoidance(:dodge, attacker, defender)
      #=> %{to_attacker: "The goblin dodges your attack!", ...}

      # Death messages
      DamageMessage.death(attacker, defender)
      #=> %{to_attacker: "You have slain the goblin!", ...}

  ## Message Perspectives

  Each message type returns three versions:
  - `to_attacker` - What the attacker sees ("You slash...")
  - `to_defender` - What the defender sees ("Alice slashes you...")
  - `to_room` - What observers see ("Alice slashes the goblin...")
  """

  @config_path "priv/world/config/damage_messages.yml"

  # Load config at compile time for performance
  @external_resource @config_path
  @config (
            path = Path.join(:code.priv_dir(:loka), "world/config/damage_messages.yml")

            if File.exists?(path) do
              YamlElixir.read_from_file!(path)
            else
              # Default minimal config for compilation without file
              %{
                "melee" => %{
                  "tiers" => [
                    %{
                      "range" => [0, nil],
                      "verb" => "hit",
                      "to_attacker" => ["You hit {target}."],
                      "to_defender" => ["{attacker} hits you."],
                      "to_room" => ["{attacker} hits {target}."]
                    }
                  ]
                }
              }
            end
          )

  @type perspective :: :to_attacker | :to_defender | :to_room
  @type messages :: %{to_attacker: String.t(), to_defender: String.t(), to_room: String.t()}
  @type entity :: %{name: String.t()} | String.t()

  @doc """
  Generate damage messages for a combat attack.

  ## Options

  - `:damage_type` - Type of damage (`:melee`, `:spell`). Default: `:melee`
  - `:weapon_type` - Weapon type for verb overrides (`:sword`, `:mace`, etc.)
  - `:element` - Element for spell damage (`:fire`, `:ice`, etc.)
  - `:critical` - Whether this was a critical hit. Default: `false`

  ## Examples

      iex> DamageMessage.generate(15, %{name: "Alice"}, %{name: "goblin"})
      %{to_attacker: "You hit the goblin.", to_defender: "Alice hits you.", to_room: "Alice hits the goblin."}

      iex> DamageMessage.generate(50, %{name: "Alice"}, %{name: "orc"}, weapon_type: :sword)
      %{to_attacker: "You carve the orc!", ...}
  """
  @spec generate(integer(), entity(), entity(), keyword()) :: messages()
  def generate(damage, attacker, defender, opts \\ []) do
    damage_type = Keyword.get(opts, :damage_type, :melee)
    weapon_type = Keyword.get(opts, :weapon_type)
    element = Keyword.get(opts, :element)
    critical = Keyword.get(opts, :critical, false)

    if critical do
      critical_message(attacker, defender, opts)
    else
      case damage_type do
        :spell -> spell_message(damage, attacker, defender, element)
        _ -> melee_message(damage, attacker, defender, weapon_type)
      end
    end
  end

  @doc """
  Generate a message for combat avoidance (miss, dodge, parry, block).

  ## Examples

      iex> DamageMessage.avoidance(:dodge, %{name: "Alice"}, %{name: "goblin"})
      %{to_attacker: "The goblin dodges your attack!", ...}
  """
  @spec avoidance(atom(), entity(), entity()) :: messages()
  def avoidance(type, attacker, defender) do
    avoidance_config = get_in(@config, ["avoidance", to_string(type)]) || %{}

    %{
      to_attacker: select_and_substitute(avoidance_config["to_attacker"], attacker, defender),
      to_defender: select_and_substitute(avoidance_config["to_defender"], attacker, defender),
      to_room: select_and_substitute(avoidance_config["to_room"], attacker, defender)
    }
  end

  @doc """
  Generate a death message.

  ## Options

  - `:overkill` - Whether the killing blow was overkill (excessive damage). Default: `false`

  ## Examples

      iex> DamageMessage.death(%{name: "Alice"}, %{name: "goblin"})
      %{to_attacker: "You have slain the goblin!", ...}
  """
  @spec death(entity(), entity(), keyword()) :: messages()
  def death(attacker, defender, opts \\ []) do
    overkill = Keyword.get(opts, :overkill, false)
    death_type = if overkill, do: "overkill", else: "normal"

    death_config = get_in(@config, ["death", death_type]) || %{}

    %{
      to_attacker: select_and_substitute(death_config["to_attacker"], attacker, defender),
      to_defender: select_and_substitute(death_config["to_defender"], attacker, defender),
      to_room: select_and_substitute(death_config["to_room"], attacker, defender)
    }
  end

  @doc """
  Generate a critical hit message.

  ## Options

  - `:type` - Critical type (`:melee`, `:backstab`). Default: `:melee`
  """
  @spec critical_message(entity(), entity(), keyword()) :: messages()
  def critical_message(attacker, defender, opts \\ []) do
    crit_type = Keyword.get(opts, :type, :melee)
    crit_config = get_in(@config, ["critical", to_string(crit_type)]) || %{}

    %{
      to_attacker: select_and_substitute(crit_config["to_attacker"], attacker, defender),
      to_defender: select_and_substitute(crit_config["to_defender"], attacker, defender),
      to_room: select_and_substitute(crit_config["to_room"], attacker, defender)
    }
  end

  @doc """
  Generate a defensive stance message.

  ## Examples

      iex> DamageMessage.defense(:enter, %{name: "Alice"})
      %{to_attacker: "You raise your guard and take a defensive stance.", to_room: "Alice raises their guard."}
  """
  @spec defense(atom(), entity()) :: map()
  def defense(:enter, entity) do
    config = get_in(@config, ["defense", "enter"]) || %{}

    %{
      to_attacker: select_and_substitute(config["to_attacker"], entity, nil),
      to_room: select_and_substitute(config["to_room"], entity, nil)
    }
  end

  def defense(:enemy_enter, entity) do
    config = get_in(@config, ["defense", "enemy_enter"]) || %{}

    %{
      to_defender: select_and_substitute(config["to_defender"], nil, entity),
      to_room: select_and_substitute(config["to_room"], nil, entity)
    }
  end

  @doc """
  Generate a flee message.

  ## Examples

      iex> DamageMessage.flee(:success, %{name: "Alice"}, %{name: "goblin"})
      %{to_attacker: "You successfully flee from combat!", to_room: "Alice flees from the goblin!"}
  """
  @spec flee(atom(), entity(), entity() | nil) :: map()
  def flee(result, attacker, defender \\ nil) do
    config = get_in(@config, ["flee", to_string(result)]) || %{}

    %{
      to_attacker: select_and_substitute(config["to_attacker"], attacker, defender),
      to_room: select_and_substitute(config["to_room"], attacker, defender)
    }
  end

  @doc """
  Reload the damage message configuration from disk.

  Useful for hot-reloading during development.
  """
  @spec reload_config() :: :ok | {:error, term()}
  def reload_config do
    # This requires runtime loading since @config is compile-time
    # For now, restart is needed. Future: use Agent or ETS for runtime config.
    :ok
  end

  @doc """
  Get the verb for a damage tier.

  Useful for weapon override lookups.
  """
  @spec get_tier_verb(integer()) :: String.t()
  def get_tier_verb(damage) do
    tier = find_tier(damage, get_in(@config, ["melee", "tiers"]) || [])
    tier["verb"] || "hit"
  end

  # Private functions

  defp melee_message(damage, attacker, defender, weapon_type) do
    tiers = get_in(@config, ["melee", "tiers"]) || []
    tier = find_tier(damage, tiers)

    messages = %{
      to_attacker: select_and_substitute(tier["to_attacker"], attacker, defender),
      to_defender: select_and_substitute(tier["to_defender"], attacker, defender),
      to_room: select_and_substitute(tier["to_room"], attacker, defender)
    }

    # Apply weapon-specific verb overrides if applicable
    if weapon_type do
      apply_weapon_override(messages, tier["verb"], weapon_type)
    else
      messages
    end
  end

  defp spell_message(damage, attacker, defender, element) do
    element_key = to_string(element || "fire")
    tiers = get_in(@config, ["spell", element_key, "tiers"]) || []

    # Fall back to melee if no spell config
    if Enum.empty?(tiers) do
      melee_message(damage, attacker, defender, nil)
    else
      tier = find_tier(damage, tiers)

      %{
        to_attacker: select_and_substitute(tier["to_attacker"], attacker, defender),
        to_defender: select_and_substitute(tier["to_defender"], attacker, defender),
        to_room: select_and_substitute(tier["to_room"], attacker, defender)
      }
    end
  end

  defp find_tier(damage, tiers) do
    Enum.find(tiers, List.last(tiers) || default_tier(), fn tier ->
      [min, max] = tier["range"] || [0, nil]

      cond do
        max == nil -> damage >= min
        true -> damage >= min && damage <= max
      end
    end)
  end

  defp default_tier do
    %{
      "verb" => "hit",
      "to_attacker" => ["You hit {target}."],
      "to_defender" => ["{attacker} hits you."],
      "to_room" => ["{attacker} hits {target}."]
    }
  end

  defp select_and_substitute(nil, _attacker, _defender), do: ""

  defp select_and_substitute(messages, attacker, defender) when is_list(messages) do
    messages
    |> Enum.random()
    |> substitute(attacker, defender)
  end

  defp select_and_substitute(message, attacker, defender) when is_binary(message) do
    substitute(message, attacker, defender)
  end

  defp substitute(template, attacker, defender) do
    attacker_name = get_name(attacker)
    defender_name = get_name(defender)

    template
    |> String.replace("{attacker}", attacker_name)
    |> String.replace("{target}", defender_name)
  end

  defp get_name(nil), do: "someone"
  defp get_name(%{name: name}), do: name
  defp get_name(name) when is_binary(name), do: name
  defp get_name(_), do: "someone"

  defp apply_weapon_override(messages, verb, weapon_type) do
    weapon_key = to_string(weapon_type)
    overrides = get_in(@config, ["weapon_overrides", weapon_key]) || %{}
    override_verb = overrides[verb]

    if override_verb do
      # Replace the verb in all messages
      %{
        to_attacker: replace_verb(messages.to_attacker, verb, override_verb),
        to_defender: replace_verb(messages.to_defender, verb, override_verb),
        to_room: replace_verb(messages.to_room, verb, override_verb)
      }
    else
      messages
    end
  end

  defp replace_verb(message, old_verb, new_verb) do
    # Replace verb forms (verb, verbs, verbed patterns)
    message
    |> String.replace(~r/\b#{old_verb}s\b/i, conjugate_third_person(new_verb))
    |> String.replace(~r/\b#{old_verb}\b/i, new_verb)
  end

  defp conjugate_third_person(verb) do
    cond do
      String.ends_with?(verb, "sh") ->
        verb <> "es"

      String.ends_with?(verb, "ch") ->
        verb <> "es"

      String.ends_with?(verb, "s") ->
        verb <> "es"

      String.ends_with?(verb, "x") ->
        verb <> "es"

      String.ends_with?(verb, "z") ->
        verb <> "es"

      String.ends_with?(verb, "o") ->
        verb <> "es"

      String.ends_with?(verb, "y") && !String.ends_with?(verb, ~r/[aeiou]y/) ->
        String.slice(verb, 0..-2//1) <> "ies"

      true ->
        verb <> "s"
    end
  end

  # ===========================================================================
  # Health Status Descriptions (LegendMUD style)
  # ===========================================================================

  @doc """
  Generates a health status description based on HP percentage.

  Returns a descriptive phrase like "has several wounds" or "is near death".

  ## Examples

      iex> DamageMessage.health_status(80, 100, "goblin")
      "The goblin has a few scratches."

      iex> DamageMessage.health_status(15, 100, "orc")
      "The orc is near death."
  """
  @spec health_status(number(), number(), String.t()) :: String.t()
  def health_status(current_hp, max_hp, name) when max_hp > 0 do
    percentage = current_hp / max_hp * 100

    status =
      cond do
        percentage >= 100 -> "is in excellent condition"
        percentage >= 80 -> "has a few scratches"
        percentage >= 60 -> "has some bruises"
        percentage >= 40 -> "has several wounds"
        percentage >= 20 -> "is bleeding freely"
        percentage > 0 -> "is near death"
        true -> "is DEAD!"
      end

    capitalized_name = String.capitalize(name)
    "#{capitalized_name} #{status}."
  end

  def health_status(_current_hp, _max_hp, name) do
    "#{String.capitalize(name)} is in unknown condition."
  end
end
