defmodule Loka.Framework.Magic.Mantra do
  @moduledoc """
  Mantra construction and spell casting from Sanskrit words.

  ## Mantra Structure

      MANTRA = [GUNA] + TATTVA + RUPA
               modifier + element + form

      Example: MAHA AGNI ASTRA = "Great Fire Arrow"

  A valid mantra requires:
  - Exactly one TATTVA (element) - required
  - Exactly one RUPA (form) - required
  - Zero or one GUNA (modifier) - optional

  ## Mana Cost Formula

      Base Cost = Form Mana + Element Mana
      Final Cost = Base Cost × Guna Multiplier × (1 - INT/200)

  ## Spell Power Formula

      Damage = Base × (1 + INT/100) × Guna Multiplier
      Healing = Base × (1 + SPI/100) × Guna Multiplier

  ## Usage

      alias Loka.Framework.Magic.Mantra

      # Build a mantra
      {:ok, mantra} = Mantra.build([:agni, :astra])
      {:ok, mantra} = Mantra.build([:maha, :agni, :astra])

      # Calculate costs and power
      mana_cost = Mantra.mana_cost(mantra, player_stats)
      damage = Mantra.damage(mantra, player_stats)

      # Get display name
      Mantra.name(mantra)  # => "AGNI ASTRA"
      Mantra.english_name(mantra)  # => "Fire Arrow"
  """

  alias Loka.Framework.Magic.SanskritWord
  alias Loka.Mechanics.CombatStats

  @type t :: %__MODULE__{
          guna: SanskritWord.t() | nil,
          tattva: SanskritWord.t(),
          rupa: SanskritWord.t(),
          words: [atom()]
        }

  defstruct [:guna, :tattva, :rupa, words: []]

  # Guna multipliers
  @guna_multipliers %{
    maha: 1.5,
    laghu: 0.5,
    dvaya: 2.0,
    sthira: 1.0,
    shighra: 1.0,
    bheda: 1.0
  }

  # =============================================================================
  # Mantra Construction
  # =============================================================================

  @doc """
  Builds a mantra from word keys.

  Words can be provided in any order - they will be organized correctly.

  ## Examples

      {:ok, mantra} = Mantra.build([:agni, :astra])
      {:ok, mantra} = Mantra.build([:maha, :agni, :astra])
      {:error, :no_tattva} = Mantra.build([:astra])
  """
  @spec build([atom()]) :: {:ok, t()} | {:error, term()}
  def build(word_keys) when is_list(word_keys) do
    # Load all words
    words_result =
      Enum.reduce_while(word_keys, {:ok, []}, fn key, {:ok, acc} ->
        case SanskritWord.get(key) do
          {:ok, word} -> {:cont, {:ok, [word | acc]}}
          {:error, _} -> {:halt, {:error, {:unknown_word, key}}}
        end
      end)

    with {:ok, words} <- words_result,
         {:ok, guna, tattva, rupa} <- classify_words(words) do
      mantra = %__MODULE__{
        guna: guna,
        tattva: tattva,
        rupa: rupa,
        words: word_keys
      }

      {:ok, mantra}
    end
  end

  defp classify_words(words) do
    gunas = Enum.filter(words, &(&1.type == :guna))
    tattvas = Enum.filter(words, &(&1.type == :tattva))
    rupas = Enum.filter(words, &(&1.type == :rupa))

    cond do
      length(tattvas) == 0 ->
        {:error, :no_tattva}

      length(tattvas) > 1 ->
        {:error, :multiple_tattvas}

      length(rupas) == 0 ->
        {:error, :no_rupa}

      length(rupas) > 1 ->
        {:error, :multiple_rupas}

      length(gunas) > 1 ->
        {:error, :multiple_gunas}

      true ->
        guna = List.first(gunas)
        tattva = List.first(tattvas)
        rupa = List.first(rupas)
        {:ok, guna, tattva, rupa}
    end
  end

  # =============================================================================
  # Validation
  # =============================================================================

  @doc """
  Validates that a player can cast this mantra.

  Checks:
  - Player knows all words (in known_words set)
  - Player has sufficient mana
  """
  @spec validate(t(), MapSet.t(), map(), non_neg_integer()) :: :ok | {:error, term()}
  def validate(%__MODULE__{} = mantra, known_words, stats, current_mana) do
    with :ok <- validate_known_words(mantra, known_words),
         :ok <- validate_mana(mantra, stats, current_mana) do
      :ok
    end
  end

  defp validate_known_words(%__MODULE__{words: words}, known_words) do
    unknown = Enum.reject(words, &MapSet.member?(known_words, &1))

    case unknown do
      [] -> :ok
      _ -> {:error, {:unknown_words, unknown}}
    end
  end

  defp validate_mana(%__MODULE__{} = mantra, stats, current_mana) do
    cost = mana_cost(mantra, stats)

    if current_mana >= cost do
      :ok
    else
      {:error, {:insufficient_mana, cost, current_mana}}
    end
  end

  # =============================================================================
  # Mana Cost
  # =============================================================================

  @doc """
  Calculates the mana cost for this mantra.

  Formula: (Form Mana + Element Mana) × Guna Multiplier × (1 - INT/200)
  """
  @spec mana_cost(t(), map()) :: non_neg_integer()
  def mana_cost(%__MODULE__{guna: guna, tattva: tattva, rupa: rupa}, stats) do
    base_cost = tattva.mana_cost + rupa.mana_cost

    guna_mult = guna_cost_multiplier(guna)
    int_discount = CombatStats.mana_cost_multiplier(stats)

    max(1, trunc(base_cost * guna_mult * int_discount))
  end

  defp guna_cost_multiplier(nil), do: 1.0

  defp guna_cost_multiplier(%SanskritWord{key: :maha}), do: 1.5
  defp guna_cost_multiplier(%SanskritWord{key: :laghu}), do: 0.5
  defp guna_cost_multiplier(%SanskritWord{key: :dvaya}), do: 2.0
  defp guna_cost_multiplier(%SanskritWord{key: :sthira}), do: 1.3
  defp guna_cost_multiplier(%SanskritWord{key: :shighra}), do: 1.3
  defp guna_cost_multiplier(%SanskritWord{key: :bheda}), do: 1.4
  defp guna_cost_multiplier(_), do: 1.0

  # =============================================================================
  # Spell Power
  # =============================================================================

  @doc """
  Calculates damage for this mantra.

  Formula: Base × (1 + INT/100) × Guna Multiplier
  """
  @spec damage(t(), map()) :: non_neg_integer()
  def damage(%__MODULE__{guna: guna, tattva: tattva}, stats) do
    base = tattva.base_power
    int_mult = CombatStats.spell_power_multiplier(stats)
    guna_mult = guna_power_multiplier(guna)

    max(1, trunc(base * int_mult * guna_mult))
  end

  @doc """
  Calculates healing for this mantra.

  Formula: Base × (1 + SPI/100) × Guna Multiplier
  """
  @spec healing(t(), map()) :: non_neg_integer()
  def healing(%__MODULE__{guna: guna, tattva: tattva}, stats) do
    base = tattva.base_power
    spi_mult = CombatStats.heal_power_multiplier(stats)
    guna_mult = guna_power_multiplier(guna)

    max(1, trunc(base * spi_mult * guna_mult))
  end

  defp guna_power_multiplier(nil), do: 1.0
  defp guna_power_multiplier(%SanskritWord{key: key}), do: Map.get(@guna_multipliers, key, 1.0)

  # =============================================================================
  # Spell Properties
  # =============================================================================

  @doc """
  Returns the effect type of this mantra.
  """
  @spec effect(t()) :: SanskritWord.effect()
  def effect(%__MODULE__{tattva: tattva}), do: tattva.effect

  @doc """
  Returns the element of this mantra (or nil).
  """
  @spec element(t()) :: atom() | nil
  def element(%__MODULE__{tattva: tattva}), do: tattva.element

  @doc """
  Returns whether this is a healing spell.
  """
  @spec healing?(t()) :: boolean()
  def healing?(%__MODULE__{tattva: tattva}), do: tattva.effect == :heal

  @doc """
  Returns whether this is a damage spell.
  """
  @spec damage?(t()) :: boolean()
  def damage?(%__MODULE__{tattva: tattva}), do: tattva.effect == :damage

  @doc """
  Returns the lag (casting time) for this mantra.
  """
  @spec lag(t()) :: non_neg_integer()
  def lag(%__MODULE__{guna: guna}) do
    base_lag = 2

    case guna do
      %SanskritWord{key: :shighra} -> max(1, base_lag - 1)
      _ -> base_lag
    end
  end

  @doc """
  Returns whether this spell ignores resistance (BHEDA).
  """
  @spec piercing?(t()) :: boolean()
  def piercing?(%__MODULE__{guna: %SanskritWord{key: :bheda}}), do: true
  def piercing?(_), do: false

  @doc """
  Returns the duration multiplier (STHIRA doubles duration).
  """
  @spec duration_multiplier(t()) :: float()
  def duration_multiplier(%__MODULE__{guna: %SanskritWord{key: :sthira}}), do: 2.0
  def duration_multiplier(_), do: 1.0

  @doc """
  Returns the number of casts (DVAYA = 2).
  """
  @spec cast_count(t()) :: pos_integer()
  def cast_count(%__MODULE__{guna: %SanskritWord{key: :dvaya}}), do: 2
  def cast_count(_), do: 1

  # =============================================================================
  # Display
  # =============================================================================

  @doc """
  Returns the Sanskrit name of the mantra.

  Example: "MAHA AGNI ASTRA"
  """
  @spec name(t()) :: String.t()
  def name(%__MODULE__{guna: guna, tattva: tattva, rupa: rupa}) do
    parts =
      [guna, tattva, rupa]
      |> Enum.reject(&is_nil/1)
      |> Enum.map(& &1.name)

    Enum.join(parts, " ")
  end

  @doc """
  Returns the English name of the mantra.

  Example: "Great Fire Arrow"
  """
  @spec english_name(t()) :: String.t()
  def english_name(%__MODULE__{guna: guna, tattva: tattva, rupa: rupa}) do
    parts =
      [guna, tattva, rupa]
      |> Enum.reject(&is_nil/1)
      |> Enum.map(& &1.english)

    Enum.join(parts, " ")
  end

  @doc """
  Returns a short description of the mantra's effect.
  """
  @spec description(t()) :: String.t()
  def description(%__MODULE__{tattva: tattva, rupa: rupa}) do
    "#{rupa.description}. #{tattva.description}"
  end

  @doc """
  Returns the highest stratum required for this mantra.
  """
  @spec stratum(t()) :: 1 | 2 | 3
  def stratum(%__MODULE__{guna: guna, tattva: tattva, rupa: rupa}) do
    [guna, tattva, rupa]
    |> Enum.reject(&is_nil/1)
    |> Enum.map(& &1.stratum)
    |> Enum.max()
  end

  @doc """
  Returns the total skill points required to learn all words in this mantra.
  """
  @spec skill_cost(t()) :: non_neg_integer()
  def skill_cost(%__MODULE__{guna: guna, tattva: tattva, rupa: rupa}) do
    [guna, tattva, rupa]
    |> Enum.reject(&is_nil/1)
    |> Enum.map(& &1.skill_cost)
    |> Enum.sum()
  end

  # =============================================================================
  # Quick Slots
  # =============================================================================

  @doc """
  Converts a mantra to a saveable format for quick slots.
  """
  @spec to_slot(t()) :: map()
  def to_slot(%__MODULE__{words: words} = mantra) do
    %{
      words: words,
      name: name(mantra),
      english: english_name(mantra),
      effect: effect(mantra)
    }
  end

  @doc """
  Rebuilds a mantra from a quick slot.
  """
  @spec from_slot(map()) :: {:ok, t()} | {:error, term()}
  def from_slot(%{words: words}) when is_list(words) do
    build(words)
  end

  def from_slot(_), do: {:error, :invalid_slot}
end
