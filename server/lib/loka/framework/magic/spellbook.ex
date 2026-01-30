defmodule Loka.Framework.Magic.Spellbook do
  @moduledoc """
  Manages a player's learned magic words and quick slots.

  ## State Storage

  Player's spellbook is stored in game_state.stats:

      game_state.stats[:spellbook] = %{
        words: MapSet.new([:agni, :hima, :astra, :sparsha]),
        quick_slots: [
          %{words: [:agni, :astra], name: "AGNI ASTRA"},
          nil,
          nil,
          nil,
          nil
        ]
      }

  ## Usage

      alias Loka.Framework.Magic.Spellbook

      # Check if word is known
      Spellbook.knows_word?(game_state, :agni)

      # Learn a word
      {:ok, state} = Spellbook.learn_word(game_state, :agni)

      # Get learnable words
      Spellbook.learnable_words(game_state)

      # Set a quick slot
      {:ok, state} = Spellbook.set_quick_slot(game_state, 0, [:agni, :astra])

      # Cast from quick slot
      {:ok, mantra} = Spellbook.cast_from_slot(game_state, 0)
  """

  alias Loka.Framework.Magic.{SanskritWord, Mantra}
  alias Loka.Framework.Player.GameState
  alias Loka.Config.Balance
  alias Loka.Utils.MapHelpers

  # Compile-time constant for guards (also used as default for Balance.get)
  @quick_slot_count 5

  # Defaults for stratum INT requirements (used when Balance config not loaded)
  @default_first_stratum_int 30
  @default_second_stratum_int 50
  @default_third_stratum_int 70

  # =============================================================================
  # Word Knowledge
  # =============================================================================

  @doc """
  Returns all words the player knows.
  """
  @spec known_words(GameState.t()) :: MapSet.t(atom())
  def known_words(%GameState{} = game_state) do
    spellbook = get_spellbook(game_state)
    Map.get(spellbook, :words, MapSet.new())
  end

  @doc """
  Checks if the player knows a specific word.
  """
  @spec knows_word?(GameState.t(), atom()) :: boolean()
  def knows_word?(%GameState{} = game_state, word_key) do
    MapSet.member?(known_words(game_state), word_key)
  end

  @doc """
  Returns known words with their definitions.
  """
  @spec known_words_with_info(GameState.t()) :: [SanskritWord.t()]
  def known_words_with_info(%GameState{} = game_state) do
    game_state
    |> known_words()
    |> Enum.map(&SanskritWord.get/1)
    |> Enum.filter(&match?({:ok, _}, &1))
    |> Enum.map(fn {:ok, word} -> word end)
  end

  @doc """
  Returns known words grouped by type.
  """
  @spec known_words_by_type(GameState.t()) :: %{atom() => [SanskritWord.t()]}
  def known_words_by_type(%GameState{} = game_state) do
    game_state
    |> known_words_with_info()
    |> Enum.group_by(& &1.type)
  end

  # =============================================================================
  # Learning Words
  # =============================================================================

  @doc """
  Learns a new magic word.

  Requirements:
  - Word exists
  - Player doesn't already know it
  - Player meets INT requirement (stratum)
  - Player meets SPI requirement (if any)

  ## Options

  - `:free` - Learn without skill point cost (quest reward, scroll)
  """
  @spec learn_word(GameState.t(), atom(), keyword()) ::
          {:ok, GameState.t(), map()} | {:error, term()}
  def learn_word(%GameState{} = game_state, word_key, opts \\ []) do
    free = Keyword.get(opts, :free, false)

    with {:ok, word} <- SanskritWord.get(word_key),
         :ok <- check_not_already_known(game_state, word_key),
         :ok <- check_stat_requirements(game_state, word),
         :ok <- check_can_afford_word(game_state, word, free) do
      spellbook = get_spellbook(game_state)
      words = Map.get(spellbook, :words, MapSet.new())
      new_words = MapSet.put(words, word_key)
      new_spellbook = Map.put(spellbook, :words, new_words)
      new_state = put_spellbook(game_state, new_spellbook)

      # Deduct skill points if not free
      new_state =
        if free do
          new_state
        else
          deduct_skill_points(new_state, word.skill_cost)
        end

      audit = %{
        operation: :learn_word,
        word_key: word_key,
        word_name: word.name,
        cost: if(free, do: 0, else: word.skill_cost),
        free: free,
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_state, audit}
    end
  end

  @doc """
  Forgets a word, refunding skill points.
  """
  @spec forget_word(GameState.t(), atom()) :: {:ok, GameState.t(), map()} | {:error, term()}
  def forget_word(%GameState{} = game_state, word_key) do
    with {:ok, word} <- SanskritWord.get(word_key),
         :ok <- check_is_known(game_state, word_key) do
      spellbook = get_spellbook(game_state)
      words = Map.get(spellbook, :words, MapSet.new())
      new_words = MapSet.delete(words, word_key)
      new_spellbook = Map.put(spellbook, :words, new_words)

      # Remove from any quick slots that use this word
      new_spellbook = remove_word_from_slots(new_spellbook, word_key)

      new_state = put_spellbook(game_state, new_spellbook)
      new_state = refund_skill_points(new_state, word.skill_cost)

      audit = %{
        operation: :forget_word,
        word_key: word_key,
        refunded: word.skill_cost,
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_state, audit}
    end
  end

  # =============================================================================
  # Learnable Words
  # =============================================================================

  @doc """
  Returns words the player can currently learn.

  Filters for:
  - Not already known
  - Meets INT requirement
  - Meets SPI requirement
  - Can afford (unless include_unaffordable: true)
  """
  @spec learnable_words(GameState.t(), keyword()) :: [SanskritWord.t()]
  def learnable_words(%GameState{} = game_state, opts \\ []) do
    include_unaffordable = Keyword.get(opts, :include_unaffordable, false)
    known = known_words(game_state)
    stats = get_player_stats(game_state)
    skill_points = get_magic_skill_points(game_state)

    SanskritWord.all_words()
    |> Enum.filter(fn word ->
      not MapSet.member?(known, word.key) and
        SanskritWord.can_learn?(word, stats) and
        (include_unaffordable or word.skill_cost <= skill_points)
    end)
  end

  @doc """
  Returns words available from a specific trainer by stratum.
  """
  @spec words_from_trainer(GameState.t(), 1 | 2 | 3) :: [SanskritWord.t()]
  def words_from_trainer(%GameState{} = game_state, stratum) do
    known = known_words(game_state)
    stats = get_player_stats(game_state)

    SanskritWord.by_stratum(stratum)
    |> Enum.filter(fn word ->
      not MapSet.member?(known, word.key) and
        SanskritWord.can_learn?(word, stats)
    end)
  end

  # =============================================================================
  # Quick Slots
  # =============================================================================

  @doc """
  Returns all quick slots.
  """
  @spec quick_slots(GameState.t()) :: [map() | nil]
  def quick_slots(%GameState{} = game_state) do
    spellbook = get_spellbook(game_state)
    Map.get(spellbook, :quick_slots, default_quick_slots())
  end

  @doc """
  Gets a specific quick slot.
  """
  @spec get_quick_slot(GameState.t(), non_neg_integer()) :: map() | nil
  def get_quick_slot(%GameState{} = game_state, slot_index)
      when slot_index >= 0 and slot_index < @quick_slot_count do
    Enum.at(quick_slots(game_state), slot_index)
  end

  @doc """
  Sets a quick slot to a mantra.
  """
  @spec set_quick_slot(GameState.t(), non_neg_integer(), [atom()]) ::
          {:ok, GameState.t()} | {:error, term()}
  def set_quick_slot(%GameState{} = game_state, slot_index, word_keys)
      when slot_index >= 0 and slot_index < @quick_slot_count do
    known = known_words(game_state)

    # Validate all words are known
    unknown = Enum.reject(word_keys, &MapSet.member?(known, &1))

    if Enum.any?(unknown) do
      {:error, {:unknown_words, unknown}}
    else
      # Build the mantra to validate it
      case Mantra.build(word_keys) do
        {:ok, mantra} ->
          slot_data = Mantra.to_slot(mantra)
          spellbook = get_spellbook(game_state)
          slots = Map.get(spellbook, :quick_slots, default_quick_slots())
          new_slots = List.replace_at(slots, slot_index, slot_data)
          new_spellbook = Map.put(spellbook, :quick_slots, new_slots)
          {:ok, put_spellbook(game_state, new_spellbook)}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Clears a quick slot.
  """
  @spec clear_quick_slot(GameState.t(), non_neg_integer()) :: {:ok, GameState.t()}
  def clear_quick_slot(%GameState{} = game_state, slot_index)
      when slot_index >= 0 and slot_index < @quick_slot_count do
    spellbook = get_spellbook(game_state)
    slots = Map.get(spellbook, :quick_slots, default_quick_slots())
    new_slots = List.replace_at(slots, slot_index, nil)
    new_spellbook = Map.put(spellbook, :quick_slots, new_slots)
    {:ok, put_spellbook(game_state, new_spellbook)}
  end

  # =============================================================================
  # Casting
  # =============================================================================

  @doc """
  Builds a mantra from the given words, validating the player knows them.
  """
  @spec cast(GameState.t(), [atom()]) :: {:ok, Mantra.t()} | {:error, term()}
  def cast(%GameState{} = game_state, word_keys) do
    known = known_words(game_state)

    # Check all words are known
    unknown = Enum.reject(word_keys, &MapSet.member?(known, &1))

    if Enum.any?(unknown) do
      {:error, {:unknown_words, unknown}}
    else
      Mantra.build(word_keys)
    end
  end

  @doc """
  Casts from a quick slot.
  """
  @spec cast_from_slot(GameState.t(), non_neg_integer()) :: {:ok, Mantra.t()} | {:error, term()}
  def cast_from_slot(%GameState{} = game_state, slot_index)
      when slot_index >= 0 and slot_index < @quick_slot_count do
    case get_quick_slot(game_state, slot_index) do
      nil -> {:error, :empty_slot}
      slot -> Mantra.from_slot(slot)
    end
  end

  # =============================================================================
  # Stats
  # =============================================================================

  @doc """
  Returns total skill points spent on magic words.
  """
  @spec magic_points_spent(GameState.t()) :: non_neg_integer()
  def magic_points_spent(%GameState{} = game_state) do
    game_state
    |> known_words_with_info()
    |> Enum.reduce(0, fn word, acc -> acc + word.skill_cost end)
  end

  @doc """
  Returns the highest stratum the player can access based on INT.
  """
  @spec max_stratum(GameState.t()) :: 0 | 1 | 2 | 3
  def max_stratum(%GameState{} = game_state) do
    int = get_player_stats(game_state).int
    first_req = stratum_int_required(1)
    second_req = stratum_int_required(2)
    third_req = stratum_int_required(3)

    cond do
      int >= third_req -> 3
      int >= second_req -> 2
      int >= first_req -> 1
      true -> 0
    end
  end

  @doc """
  Returns stratum info for display.
  """
  @spec stratum_info(GameState.t()) :: map()
  def stratum_info(%GameState{} = game_state) do
    max = max_stratum(game_state)
    int = get_player_stats(game_state).int
    first_req = stratum_int_required(1)
    second_req = stratum_int_required(2)
    third_req = stratum_int_required(3)

    %{
      current: max,
      first: %{unlocked: max >= 1, int_required: first_req},
      second: %{
        unlocked: max >= 2,
        int_required: second_req,
        int_needed: max(0, second_req - int)
      },
      third: %{unlocked: max >= 3, int_required: third_req, int_needed: max(0, third_req - int)}
    }
  end

  @doc """
  Returns INT required for a given stratum (from Balance config).
  """
  @spec stratum_int_required(1 | 2 | 3) :: non_neg_integer()
  def stratum_int_required(1),
    do: Balance.get(:magic, :stratum, :first, default: @default_first_stratum_int)

  def stratum_int_required(2),
    do: Balance.get(:magic, :stratum, :second, default: @default_second_stratum_int)

  def stratum_int_required(3),
    do: Balance.get(:magic, :stratum, :third, default: @default_third_stratum_int)

  # =============================================================================
  # Validation Helpers
  # =============================================================================

  defp check_not_already_known(%GameState{} = game_state, word_key) do
    if knows_word?(game_state, word_key) do
      {:error, {:already_known, word_key}}
    else
      :ok
    end
  end

  defp check_is_known(%GameState{} = game_state, word_key) do
    if knows_word?(game_state, word_key) do
      :ok
    else
      {:error, {:not_known, word_key}}
    end
  end

  defp check_stat_requirements(%GameState{} = game_state, %SanskritWord{} = word) do
    stats = get_player_stats(game_state)
    SanskritWord.learning_requirements(word, stats)
  end

  defp check_can_afford_word(%GameState{}, %SanskritWord{}, true = _free), do: :ok

  defp check_can_afford_word(%GameState{} = game_state, %SanskritWord{skill_cost: cost}, _free) do
    available = get_magic_skill_points(game_state)

    if available >= cost do
      :ok
    else
      {:error, {:insufficient_skill_points, cost, available}}
    end
  end

  # =============================================================================
  # State Helpers
  # =============================================================================

  defp get_spellbook(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :spellbook, %{
      words: MapSet.new(),
      quick_slots: default_quick_slots()
    })
  end

  defp put_spellbook(%GameState{stats: stats} = game_state, spellbook) do
    %{game_state | stats: Map.put(stats, :spellbook, spellbook)}
  end

  defp get_player_stats(%GameState{stats: stats}) do
    %{
      str: MapHelpers.get_flexible(stats, :str, 10),
      dex: MapHelpers.get_flexible(stats, :dex, 10),
      con: MapHelpers.get_flexible(stats, :con, 10),
      int: MapHelpers.get_flexible(stats, :int, 10),
      per: MapHelpers.get_flexible(stats, :per, 10),
      spi: MapHelpers.get_flexible(stats, :spi, 10)
    }
  end

  defp get_magic_skill_points(%GameState{} = game_state) do
    # Magic words share the same skill point pool as regular skills
    # This would need to integrate with BinarySkillManager
    # For now, we'll track separately in spellbook
    spellbook = get_spellbook(game_state)
    max_points = get_max_magic_points(game_state)
    spent = magic_points_spent(game_state)
    max(0, max_points - spent)
  end

  defp get_max_magic_points(%GameState{stats: stats}) do
    # Could be shared pool or separate - design decision
    # For now, use the same 50 points as skills (shared pool)
    level = MapHelpers.get_flexible(stats, :level, 1)
    level
  end

  defp deduct_skill_points(%GameState{} = game_state, _cost) do
    # Skill points are implicitly tracked by counting learned words
    # No explicit deduction needed since we recalculate on demand
    game_state
  end

  defp refund_skill_points(%GameState{} = game_state, _cost) do
    # Same as above - implicit tracking
    game_state
  end

  defp default_quick_slots do
    List.duplicate(nil, @quick_slot_count)
  end

  defp remove_word_from_slots(spellbook, word_key) do
    slots = Map.get(spellbook, :quick_slots, default_quick_slots())

    new_slots =
      Enum.map(slots, fn
        nil ->
          nil

        %{words: words} = slot ->
          if word_key in words, do: nil, else: slot
      end)

    Map.put(spellbook, :quick_slots, new_slots)
  end

  # =============================================================================
  # Constants (from Balance config)
  # =============================================================================

  @doc "Returns the number of quick slots available (default: 5)."
  @spec quick_slot_count() :: pos_integer()
  def quick_slot_count do
    Balance.get(:magic, :quick_slots, default: @quick_slot_count)
  end
end
