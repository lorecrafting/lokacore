defmodule Exmud.Framework.Magic.SpellWords do
  @moduledoc """
  Spell word system for discoverable magic.

  Players discover magic words that combine to form spells:
  - Words have meanings (fire, water, create, destroy, etc.)
  - Combinations create different effects
  - Unknown combinations may have unexpected results
  - Words can be discovered through exploration, NPCs, or items

  ## Spell Word Configuration (YAML)

      # priv/world/magic/words.yml
      words:
        ignis:
          name: "Ignis"
          meaning: fire
          power: 10
          element: fire
          discovered_by_default: false
        aqua:
          name: "Aqua"
          meaning: water
          power: 8
          element: water
        creo:
          name: "Creo"
          meaning: create
          power: 5
          type: verb

      combinations:
        - words: [ignis, creo]
          result: fireball
          description: "A ball of fire appears and shoots forward."
        - words: [aqua, creo]
          result: water_jet
          description: "A jet of water bursts forth."

  ## Usage

      alias Exmud.Framework.Magic.SpellWords

      # Learn a word
      {:ok, state} = SpellWords.learn_word(game_state, "ignis")

      # Cast using words
      {:ok, result} = SpellWords.cast(game_state, ["ignis", "creo"])

      # Check known words
      words = SpellWords.known_words(game_state)
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @words_table :exmud_spell_words
  @default_path "priv/world/magic"

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a spell word definition.
  """
  def get_word(word_key, server \\ __MODULE__) do
    GenServer.call(server, {:get_word, word_key})
  end

  @doc """
  Gets all available words.
  """
  def all_words(server \\ __MODULE__) do
    GenServer.call(server, :all_words)
  end

  @doc """
  Gets the result of combining words.
  """
  def get_combination(words, server \\ __MODULE__) when is_list(words) do
    GenServer.call(server, {:get_combination, Enum.sort(words)})
  end

  @doc """
  Reloads spell word definitions.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  # =============================================================================
  # Player Functions (Stateless)
  # =============================================================================

  @doc """
  Gets words known by a player.
  """
  def known_words(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :known_spell_words, [])
  end

  @doc """
  Checks if player knows a word.
  """
  def knows_word?(%GameState{} = game_state, word_key) do
    word_key in known_words(game_state)
  end

  @doc """
  Teaches a new word to the player.
  """
  def learn_word(%GameState{} = game_state, word_key) do
    if knows_word?(game_state, word_key) do
      {:error, :already_known}
    else
      case get_word(word_key) do
        {:ok, word} ->
          known = known_words(game_state)
          updated_stats = Map.put(game_state.stats, :known_spell_words, [word_key | known])
          {:ok, %{game_state | stats: updated_stats}, word}

        {:error, _} ->
          {:error, :unknown_word}
      end
    end
  end

  @doc """
  Attempts to cast a spell using a combination of words.
  """
  def cast(%GameState{} = game_state, word_keys) when is_list(word_keys) do
    # Check player knows all words
    unknown = Enum.reject(word_keys, &knows_word?(game_state, &1))

    if Enum.any?(unknown) do
      {:error, {:unknown_words, unknown}}
    else
      case get_combination(word_keys) do
        {:ok, combination} ->
          # Calculate power based on words
          power = calculate_power(word_keys)

          result = %{
            spell: combination.result,
            description: combination.description,
            power: power,
            words_used: word_keys
          }

          {:ok, result}

        {:error, :not_found} ->
          # Unknown combination - could fizzle or have random effect
          {:error, :unknown_combination, word_keys}
      end
    end
  end

  @doc """
  Speaks words (for flavor text).
  """
  def speak_words(word_keys) do
    word_keys
    |> Enum.map(fn key ->
      case get_word(key) do
        {:ok, word} -> word.name
        _ -> key
      end
    end)
    |> Enum.join(" ")
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@words_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      words: %{},
      combinations: []
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info(
            "SpellWords loaded #{map_size(new_state.words)} words, #{length(new_state.combinations)} combinations"
          )

          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("SpellWords started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get_word, word_key}, _from, state) do
    result =
      case Map.get(state.words, word_key) do
        nil -> {:error, :not_found}
        word -> {:ok, word}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all_words, _from, state) do
    {:reply, Map.values(state.words), state}
  end

  @impl true
  def handle_call({:get_combination, sorted_words}, _from, state) do
    combination =
      Enum.find(state.combinations, fn combo ->
        Enum.sort(combo.words) == sorted_words
      end)

    result = if combination, do: {:ok, combination}, else: {:error, :not_found}
    {:reply, result, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("SpellWords reloaded")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = if Path.type(path) == :absolute, do: path, else: Path.join(File.cwd!(), path)
    words_file = Path.join(full_path, "words.yml")

    if File.exists?(words_file) do
      case parse_words_file(words_file) do
        {:ok, words, combinations} ->
          :ets.delete_all_objects(state.table)
          Enum.each(words, fn {key, word} -> :ets.insert(state.table, {key, word}) end)
          {:ok, %{state | words: words, combinations: combinations}}

        {:error, reason} ->
          {:error, reason}
      end
    else
      # Use defaults
      Logger.debug("SpellWords: #{words_file} not found, using defaults")
      {:ok, %{state | words: default_words(), combinations: default_combinations()}}
    end
  end

  defp parse_words_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      words = parse_words(MapHelpers.get_flexible(data, :words, %{}))
      combinations = parse_combinations(MapHelpers.get_flexible(data, :combinations, []))
      {:ok, words, combinations}
    end
  end

  defp parse_words(words_data) do
    Enum.map(words_data, fn {key, data} ->
      word = %{
        key: to_string(key),
        name: MapHelpers.get_flexible(data, :name, to_string(key)),
        meaning: MapHelpers.get_flexible(data, :meaning, "unknown"),
        power: MapHelpers.get_flexible(data, :power, 5),
        element: MapHelpers.get_flexible(data, :element, nil),
        type: MapHelpers.get_flexible(data, :type, "noun"),
        discovered_by_default: MapHelpers.get_flexible(data, :discovered_by_default, false)
      }

      {to_string(key), word}
    end)
    |> Enum.into(%{})
  end

  defp parse_combinations(combos_data) do
    Enum.map(combos_data, fn combo ->
      %{
        words: MapHelpers.get_flexible(combo, :words, []),
        result: MapHelpers.get_flexible(combo, :result, "unknown"),
        description: MapHelpers.get_flexible(combo, :description, "Something happens.")
      }
    end)
  end

  defp calculate_power(word_keys) do
    word_keys
    |> Enum.map(fn key ->
      case get_word(key) do
        {:ok, word} -> word.power
        _ -> 0
      end
    end)
    |> Enum.sum()
  end

  defp default_words do
    %{
      "ignis" => %{
        key: "ignis",
        name: "Ignis",
        meaning: "fire",
        power: 10,
        element: "fire",
        type: "noun",
        discovered_by_default: true
      },
      "aqua" => %{
        key: "aqua",
        name: "Aqua",
        meaning: "water",
        power: 8,
        element: "water",
        type: "noun",
        discovered_by_default: true
      },
      "creo" => %{
        key: "creo",
        name: "Creo",
        meaning: "create",
        power: 5,
        element: nil,
        type: "verb",
        discovered_by_default: true
      },
      "perdo" => %{
        key: "perdo",
        name: "Perdo",
        meaning: "destroy",
        power: 7,
        element: nil,
        type: "verb",
        discovered_by_default: false
      }
    }
  end

  defp default_combinations do
    [
      %{
        words: ["creo", "ignis"],
        result: "fireball",
        description: "A ball of fire shoots forward!"
      },
      %{
        words: ["aqua", "creo"],
        result: "water_jet",
        description: "A jet of water bursts forth!"
      },
      %{
        words: ["ignis", "perdo"],
        result: "fire_shield",
        description: "Flames surround you protectively."
      }
    ]
  end
end
