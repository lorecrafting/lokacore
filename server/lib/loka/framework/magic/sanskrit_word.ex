defmodule Loka.Framework.Magic.SanskritWord do
  @moduledoc """
  Sanskrit magic word definitions for the mantra system.

  Magic words are organized into three types:
  - **RUPA (Form)** - How the spell travels/manifests
  - **TATTVA (Element)** - What the spell does
  - **GUNA (Modifier)** - How powerful/special

  ## The Three Strata

  Words are organized into three Strata based on INT requirements:

  | Stratum | INT Required | Who Can Access |
  |---------|--------------|----------------|
  | First | 30 | Everyone (hybrids, fighters with cantrips) |
  | Second | 50 | Semi-dedicated casters |
  | Third | 70 | Pure mages only |

  Some words also have SPI requirements (healing words).

  ## Word Structure

      %SanskritWord{
        key: :agni,
        name: "AGNI",
        english: "Fire",
        type: :tattva,
        stratum: 1,
        mana_cost: 5,
        base_power: 20,
        skill_cost: 1,
        int_required: 30,
        spi_required: 0,
        effect: :damage,
        element: :fire,
        description: "Damage + Burning DoT"
      }
  """

  alias Loka.Utils.MapHelpers

  @type word_type :: :rupa | :tattva | :guna
  @type effect :: :damage | :heal | :buff | :debuff | :utility | :control

  @type t :: %__MODULE__{
          key: atom(),
          name: String.t(),
          english: String.t(),
          type: word_type(),
          stratum: 1 | 2 | 3,
          mana_cost: non_neg_integer(),
          base_power: non_neg_integer(),
          skill_cost: 1 | 2 | 3,
          int_required: non_neg_integer(),
          spi_required: non_neg_integer(),
          effect: effect(),
          element: atom() | nil,
          description: String.t(),
          pronunciation: String.t()
        }

  defstruct [
    :key,
    :name,
    :english,
    type: :tattva,
    stratum: 1,
    mana_cost: 5,
    base_power: 10,
    skill_cost: 1,
    int_required: 30,
    spi_required: 0,
    effect: :damage,
    element: nil,
    description: "",
    pronunciation: ""
  ]

  # =============================================================================
  # Word Definitions - RUPA (Forms)
  # =============================================================================

  @doc """
  Returns all RUPA (Form) words.

  Forms determine how the spell travels/manifests.
  """
  @spec rupa_words() :: [t()]
  def rupa_words do
    [
      # First Stratum
      %__MODULE__{
        key: :astra,
        name: "ASTRA",
        english: "Arrow/Missile",
        type: :rupa,
        stratum: 1,
        mana_cost: 5,
        skill_cost: 1,
        int_required: 30,
        effect: :damage,
        description: "Single target projectile",
        pronunciation: "AHS-trah"
      },
      %__MODULE__{
        key: :sparsha,
        name: "SPARSHA",
        english: "Touch",
        type: :rupa,
        stratum: 1,
        mana_cost: 3,
        skill_cost: 1,
        int_required: 30,
        effect: :damage,
        description: "Adjacent only, melee range",
        pronunciation: "SPAR-shah"
      },
      %__MODULE__{
        key: :taranga,
        name: "TARANGA",
        english: "Wave",
        type: :rupa,
        stratum: 1,
        mana_cost: 10,
        skill_cost: 1,
        int_required: 30,
        effect: :damage,
        description: "Cone AoE forward",
        pronunciation: "tah-RAHN-gah"
      },
      %__MODULE__{
        key: :mandala,
        name: "MANDALA",
        english: "Circle/Aura",
        type: :rupa,
        stratum: 1,
        mana_cost: 10,
        skill_cost: 1,
        int_required: 30,
        effect: :buff,
        description: "Buff aura around self",
        pronunciation: "MAHN-dah-lah"
      },
      # Second Stratum
      %__MODULE__{
        key: :visphota,
        name: "VISPHOTA",
        english: "Explosion/Burst",
        type: :rupa,
        stratum: 2,
        mana_cost: 15,
        skill_cost: 2,
        int_required: 50,
        effect: :damage,
        description: "AoE around self",
        pronunciation: "vis-FOH-tah"
      },
      %__MODULE__{
        key: :megha,
        name: "MEGHA",
        english: "Cloud",
        type: :rupa,
        stratum: 2,
        mana_cost: 20,
        skill_cost: 2,
        int_required: 50,
        effect: :damage,
        description: "Room-wide, persists",
        pronunciation: "MAY-gah"
      },
      # Third Stratum
      %__MODULE__{
        key: :yantra,
        name: "YANTRA",
        english: "Device/Trap",
        type: :rupa,
        stratum: 3,
        mana_cost: 18,
        skill_cost: 3,
        int_required: 70,
        effect: :damage,
        description: "Trap/ward that triggers",
        pronunciation: "YAHN-trah"
      },
      %__MODULE__{
        key: :bandha,
        name: "BANDHA",
        english: "Binding/Enchant",
        type: :rupa,
        stratum: 3,
        mana_cost: 15,
        skill_cost: 3,
        int_required: 70,
        effect: :buff,
        description: "Enchant item temporarily",
        pronunciation: "BAHN-dah"
      }
    ]
  end

  # =============================================================================
  # Word Definitions - TATTVA (Elements)
  # =============================================================================

  @doc """
  Returns all TATTVA (Element) words.

  Elements determine what the spell does.
  """
  @spec tattva_words() :: [t()]
  def tattva_words do
    [
      # First Stratum - Damage
      %__MODULE__{
        key: :agni,
        name: "AGNI",
        english: "Fire",
        type: :tattva,
        stratum: 1,
        mana_cost: 5,
        base_power: 20,
        skill_cost: 1,
        int_required: 30,
        effect: :damage,
        element: :fire,
        description: "Damage + Burning DoT",
        pronunciation: "AHG-nee"
      },
      %__MODULE__{
        key: :hima,
        name: "HIMA",
        english: "Frost",
        type: :tattva,
        stratum: 1,
        mana_cost: 5,
        base_power: 18,
        skill_cost: 1,
        int_required: 30,
        effect: :damage,
        element: :ice,
        description: "Damage + Slow",
        pronunciation: "HEE-mah"
      },
      %__MODULE__{
        key: :vayu,
        name: "VAYU",
        english: "Wind",
        type: :tattva,
        stratum: 1,
        mana_cost: 5,
        base_power: 15,
        skill_cost: 1,
        int_required: 30,
        effect: :damage,
        element: :force,
        description: "Knockback",
        pronunciation: "VAH-yoo"
      },
      # First Stratum - Healing (SPI required)
      %__MODULE__{
        key: :prana,
        name: "PRANA",
        english: "Life Force",
        type: :tattva,
        stratum: 1,
        mana_cost: 8,
        base_power: 25,
        skill_cost: 1,
        int_required: 30,
        spi_required: 30,
        effect: :heal,
        description: "Heal HP",
        pronunciation: "PRAH-nah"
      },
      %__MODULE__{
        key: :raksha,
        name: "RAKSHA",
        english: "Protection",
        type: :tattva,
        stratum: 1,
        mana_cost: 10,
        base_power: 30,
        skill_cost: 1,
        int_required: 30,
        spi_required: 20,
        effect: :buff,
        description: "Absorb damage (shield)",
        pronunciation: "RAHK-shah"
      },
      %__MODULE__{
        key: :jyoti,
        name: "JYOTI",
        english: "Light",
        type: :tattva,
        stratum: 1,
        mana_cost: 4,
        base_power: 10,
        skill_cost: 1,
        int_required: 30,
        effect: :utility,
        element: :light,
        description: "Reveal hidden, damage undead",
        pronunciation: "JYO-tee"
      },
      # Second Stratum
      %__MODULE__{
        key: :vidyut,
        name: "VIDYUT",
        english: "Lightning",
        type: :tattva,
        stratum: 2,
        mana_cost: 8,
        base_power: 28,
        skill_cost: 2,
        int_required: 50,
        effect: :damage,
        element: :lightning,
        description: "High damage, chains to nearby",
        pronunciation: "VID-yoot"
      },
      %__MODULE__{
        key: :visha,
        name: "VISHA",
        english: "Poison",
        type: :tattva,
        stratum: 2,
        mana_cost: 6,
        base_power: 15,
        skill_cost: 2,
        int_required: 50,
        effect: :damage,
        element: :poison,
        description: "Damage over time",
        pronunciation: "VEE-shah"
      },
      %__MODULE__{
        key: :kshaya,
        name: "KSHAYA",
        english: "Drain",
        type: :tattva,
        stratum: 2,
        mana_cost: 12,
        base_power: 20,
        skill_cost: 2,
        int_required: 50,
        effect: :damage,
        element: :drain,
        description: "Damage + self-heal",
        pronunciation: "KSHAH-yah"
      },
      %__MODULE__{
        key: :shunya,
        name: "SHUNYA",
        english: "Void",
        type: :tattva,
        stratum: 2,
        mana_cost: 8,
        base_power: 0,
        skill_cost: 2,
        int_required: 50,
        effect: :utility,
        description: "Dispel magic effects",
        pronunciation: "SHOON-yah"
      },
      # Third Stratum
      %__MODULE__{
        key: :tamas,
        name: "TAMAS",
        english: "Darkness",
        type: :tattva,
        stratum: 3,
        mana_cost: 8,
        base_power: 15,
        skill_cost: 3,
        int_required: 70,
        effect: :control,
        element: :darkness,
        description: "Blind target",
        pronunciation: "TAH-mahs"
      },
      %__MODULE__{
        key: :nidra,
        name: "NIDRA",
        english: "Sleep",
        type: :tattva,
        stratum: 3,
        mana_cost: 12,
        base_power: 0,
        skill_cost: 3,
        int_required: 70,
        spi_required: 40,
        effect: :control,
        description: "Incapacitate target",
        pronunciation: "NID-rah"
      }
    ]
  end

  # =============================================================================
  # Word Definitions - GUNA (Modifiers)
  # =============================================================================

  @doc """
  Returns all GUNA (Modifier) words.

  Modifiers change how powerful/special the spell is.
  """
  @spec guna_words() :: [t()]
  def guna_words do
    [
      # First Stratum
      %__MODULE__{
        key: :maha,
        name: "MAHA",
        english: "Great",
        type: :guna,
        stratum: 1,
        mana_cost: 0,
        base_power: 50,
        skill_cost: 1,
        int_required: 30,
        effect: :buff,
        description: "1.5× power, 1.5× cost",
        pronunciation: "MAH-hah"
      },
      %__MODULE__{
        key: :laghu,
        name: "LAGHU",
        english: "Small",
        type: :guna,
        stratum: 1,
        mana_cost: 0,
        base_power: -50,
        skill_cost: 1,
        int_required: 30,
        effect: :buff,
        description: "0.5× power, 0.5× cost",
        pronunciation: "LAH-goo"
      },
      # Second Stratum
      %__MODULE__{
        key: :dvaya,
        name: "DVAYA",
        english: "Twin",
        type: :guna,
        stratum: 2,
        mana_cost: 0,
        skill_cost: 2,
        int_required: 50,
        effect: :buff,
        description: "Cast twice",
        pronunciation: "DVAH-yah"
      },
      %__MODULE__{
        key: :sthira,
        name: "STHIRA",
        english: "Lasting",
        type: :guna,
        stratum: 2,
        mana_cost: 0,
        skill_cost: 2,
        int_required: 50,
        effect: :buff,
        description: "2× duration",
        pronunciation: "STHEE-rah"
      },
      %__MODULE__{
        key: :shighra,
        name: "SHIGHRA",
        english: "Swift",
        type: :guna,
        stratum: 2,
        mana_cost: 0,
        skill_cost: 2,
        int_required: 50,
        effect: :buff,
        description: "-1 lag on cast",
        pronunciation: "SHIG-rah"
      },
      # Third Stratum
      %__MODULE__{
        key: :bheda,
        name: "BHEDA",
        english: "Piercing",
        type: :guna,
        stratum: 3,
        mana_cost: 0,
        skill_cost: 3,
        int_required: 70,
        effect: :buff,
        description: "Ignore 50% resistance",
        pronunciation: "BAY-dah"
      }
    ]
  end

  # =============================================================================
  # Word Lookup
  # =============================================================================

  @doc """
  Returns all words.
  """
  @spec all_words() :: [t()]
  def all_words do
    rupa_words() ++ tattva_words() ++ guna_words()
  end

  @doc """
  Gets a word by key.
  """
  @spec get(atom()) :: {:ok, t()} | {:error, :not_found}
  def get(key) when is_atom(key) do
    case Enum.find(all_words(), &(&1.key == key)) do
      nil -> {:error, :not_found}
      word -> {:ok, word}
    end
  end

  def get(key) when is_binary(key) do
    get(String.to_atom(key))
  end

  @doc """
  Gets words by stratum.
  """
  @spec by_stratum(1 | 2 | 3) :: [t()]
  def by_stratum(stratum) when stratum in [1, 2, 3] do
    Enum.filter(all_words(), &(&1.stratum == stratum))
  end

  @doc """
  Gets words by type.
  """
  @spec by_type(word_type()) :: [t()]
  def by_type(type) when type in [:rupa, :tattva, :guna] do
    Enum.filter(all_words(), &(&1.type == type))
  end

  # =============================================================================
  # Requirements
  # =============================================================================

  @doc """
  Checks if player meets requirements to learn a word.
  """
  @spec can_learn?(t(), map()) :: boolean()
  def can_learn?(%__MODULE__{int_required: int_req, spi_required: spi_req}, stats) do
    player_int = Map.get(stats, :int) || Map.get(stats, "int", 0)
    player_spi = Map.get(stats, :spi) || Map.get(stats, "spi", 0)

    player_int >= int_req and player_spi >= spi_req
  end

  @doc """
  Returns why a player can't learn a word.
  """
  @spec learning_requirements(t(), map()) :: :ok | {:error, term()}
  def learning_requirements(%__MODULE__{} = word, stats) do
    player_int = Map.get(stats, :int) || Map.get(stats, "int", 0)
    player_spi = Map.get(stats, :spi) || Map.get(stats, "spi", 0)

    cond do
      player_int < word.int_required ->
        {:error, {:insufficient_int, word.int_required, player_int}}

      player_spi < word.spi_required ->
        {:error, {:insufficient_spi, word.spi_required, player_spi}}

      true ->
        :ok
    end
  end

  # =============================================================================
  # From Map (YAML Loading)
  # =============================================================================

  @doc """
  Creates a SanskritWord from a map (for custom words from YAML).
  """
  @spec from_map(map()) :: {:ok, t()} | {:error, term()}
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, :key),
         {:ok, name} <- require_field(data, :name) do
      word = %__MODULE__{
        key: to_atom(key),
        name: name,
        english: MapHelpers.get_flexible(data, :english, name),
        type: parse_type(data),
        stratum: MapHelpers.get_flexible(data, :stratum, 1),
        mana_cost: MapHelpers.get_flexible(data, :mana_cost, 5),
        base_power: MapHelpers.get_flexible(data, :base_power, 10),
        skill_cost: MapHelpers.get_flexible(data, :skill_cost, 1),
        int_required: MapHelpers.get_flexible(data, :int_required, 30),
        spi_required: MapHelpers.get_flexible(data, :spi_required, 0),
        effect: parse_effect(data),
        element: parse_element(data),
        description: MapHelpers.get_flexible(data, :description, ""),
        pronunciation: MapHelpers.get_flexible(data, :pronunciation, "")
      }

      {:ok, word}
    end
  end

  defp require_field(data, field) do
    value = MapHelpers.get_flexible(data, field, nil)
    if value, do: {:ok, value}, else: {:error, {:missing_field, field}}
  end

  defp to_atom(value) when is_atom(value), do: value
  defp to_atom(value) when is_binary(value), do: String.to_atom(value)

  defp parse_type(data) do
    type = MapHelpers.get_flexible(data, :type, "tattva")

    case to_atom(type) do
      t when t in [:rupa, :tattva, :guna] -> t
      _ -> :tattva
    end
  end

  defp parse_effect(data) do
    effect = MapHelpers.get_flexible(data, :effect, "damage")

    case to_atom(effect) do
      e when e in [:damage, :heal, :buff, :debuff, :utility, :control] -> e
      _ -> :damage
    end
  end

  defp parse_element(data) do
    element = MapHelpers.get_flexible(data, :element, nil)
    if element, do: to_atom(element), else: nil
  end
end
