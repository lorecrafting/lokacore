defmodule Loka.Config.Balance do
  @moduledoc """
  Balance configuration system.

  Loads and provides access to game balance values from `priv/config/balance.yml`.
  All formulas, multipliers, and game constants are defined there for easy tuning.

  ## Usage

      alias Loka.Config.Balance

      # Get a specific value
      Balance.get(:combat, :damage, :minimum)
      # => 1

      # Get a nested section
      Balance.get(:combat, :damage)
      # => %{base_formula: "str + weapon_bonus", ...}

      # Get with default
      Balance.get(:combat, :unknown, :value, default: 10)
      # => 10

      # Evaluate a formula with context
      Balance.eval_formula(:combat, :damage, :base_formula, %{str: 15, weapon_bonus: 5})
      # => 20

  ## Configuration Structure

  The YAML file has these top-level sections:
  - `combat` - Damage, healing, and check formulas
  - `progression` - XP, leveling, base stats
  - `resources` - Health, mana, stamina pools
  - `abilities` - Cooldowns, costs, effects
  - `economy` - Gold, shop prices, repairs
  - `gathering` - Success rates, quality chances
  - `crafting` - Success rates, quality chances
  """

  use GenServer
  require Logger

  alias Loka.Utils.MapHelpers

  @config_path "priv/config/balance.yml"
  @ets_table :loka_balance_config

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the Balance config server.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a value from the balance config.

  Accepts a path of keys to navigate the config structure.

  ## Examples

      Balance.get(:combat, :damage, :minimum)
      # => 1

      Balance.get(:progression, :max_level)
      # => 50

      Balance.get(:unknown, :path, default: 0)
      # => 0
  """
  def get(keys, opts \\ [])

  def get(keys, opts) when is_list(keys) do
    default = Keyword.get(opts, :default, nil)

    case :ets.lookup(@ets_table, :config) do
      [{:config, config}] ->
        get_in_flexible(config, keys) || default

      [] ->
        default
    end
  rescue
    ArgumentError -> Keyword.get(opts, :default, nil)
  end

  def get(key, opts) when is_atom(key), do: get([key], opts)

  @doc """
  Gets a value with path specified as separate arguments.

  ## Examples

      Balance.get(:combat, :damage, :minimum)
  """
  def get(key1, key2, opts) when is_list(opts), do: get([key1, key2], opts)
  def get(key1, key2, key3) when is_atom(key3), do: get([key1, key2, key3], [])

  def get(key1, key2, key3, opts) when is_list(opts), do: get([key1, key2, key3], opts)
  def get(key1, key2, key3, key4) when is_atom(key4), do: get([key1, key2, key3, key4], [])

  @doc """
  Evaluates a formula from the config with the given context.

  ## Examples

      Balance.eval_formula(:combat, :damage, :base_formula, %{str: 15, weapon_bonus: 5})
      # => 20.0

      Balance.eval_formula(:resources, :health, :max_formula, %{sta: 12, level: 5})
      # => 160.0
  """
  def eval_formula(keys, context, opts \\ [])

  def eval_formula(keys, context, opts) when is_list(keys) do
    formula = get(keys, opts)
    evaluate_formula(formula, context, Keyword.get(opts, :default, 0))
  end

  def eval_formula(key1, key2, context) when is_map(context) do
    eval_formula([key1, key2], context, [])
  end

  def eval_formula(key1, key2, key3, context) when is_map(context) do
    eval_formula([key1, key2, key3], context, [])
  end

  @doc """
  Returns the full config map.
  """
  def all do
    case :ets.lookup(@ets_table, :config) do
      [{:config, config}] -> config
      [] -> %{}
    end
  rescue
    ArgumentError -> %{}
  end

  @doc """
  Reloads the config from disk.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Merges additional config from a file into the existing config.

  This is used by plugins to add their own balance sections without
  overwriting the main config. Values from the new file take precedence
  for any conflicts.

  ## Examples

      Balance.merge_from_file("priv/plugins/guilds/balance.yml")
      # => :ok

      Balance.merge_from_file("nonexistent.yml")
      # => {:error, :file_not_found}
  """
  def merge_from_file(path, server \\ __MODULE__) do
    GenServer.call(server, {:merge_from_file, path})
  end

  @doc """
  Checks if the balance config has been loaded.
  """
  def loaded? do
    case :ets.lookup(@ets_table, :config) do
      [{:config, _}] -> true
      [] -> false
    end
  rescue
    ArgumentError -> false
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @config_path)

    # Create ETS table
    table =
      :ets.new(@ets_table, [
        :set,
        :public,
        :named_table,
        read_concurrency: true
      ])

    state = %{
      table: table,
      path: path
    }

    # Load config
    case load_config(path) do
      {:ok, config} ->
        :ets.insert(table, {:config, config})
        Logger.info("Balance config loaded from #{path}")

      {:error, reason} ->
        Logger.warning("Failed to load balance config: #{inspect(reason)}, using defaults")
        :ets.insert(table, {:config, default_config()})
    end

    {:ok, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case load_config(state.path) do
      {:ok, config} ->
        :ets.insert(state.table, {:config, config})
        Logger.info("Balance config reloaded")
        {:reply, :ok, state}

      {:error, reason} ->
        Logger.error("Failed to reload balance config: #{inspect(reason)}")
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_call({:merge_from_file, path}, _from, state) do
    case load_config(path) do
      {:ok, new_config} ->
        [{:config, existing}] = :ets.lookup(state.table, :config)
        merged = deep_merge(existing, new_config)
        :ets.insert(state.table, {:config, merged})
        Logger.debug("Balance config merged from #{path}")
        {:reply, :ok, state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  # Deep merge two maps, with right taking precedence for conflicts
  defp deep_merge(left, right) when is_map(left) and is_map(right) do
    Map.merge(left, right, fn _key, left_val, right_val ->
      deep_merge(left_val, right_val)
    end)
  end

  defp deep_merge(_left, right), do: right

  defp load_config(path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      case YamlElixir.read_from_file(full_path) do
        {:ok, data} ->
          {:ok, atomize_keys(data)}

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, :file_not_found}
    end
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} ->
      key = if is_binary(k), do: String.to_atom(k), else: k
      {key, atomize_keys(v)}
    end)
  end

  defp atomize_keys(list) when is_list(list) do
    Enum.map(list, &atomize_keys/1)
  end

  defp atomize_keys(value), do: value

  defp get_in_flexible(map, []), do: map

  defp get_in_flexible(map, [key | rest]) when is_map(map) do
    value = MapHelpers.get_flexible(map, key, nil)

    if is_nil(value) do
      nil
    else
      get_in_flexible(value, rest)
    end
  end

  defp get_in_flexible(_, _), do: nil

  defp evaluate_formula(nil, _context, default), do: default
  defp evaluate_formula(value, _context, _default) when is_number(value), do: value

  defp evaluate_formula(formula, context, default) when is_binary(formula) do
    # Simple formula evaluator
    # Supports: +, -, *, /, variables, numbers
    try do
      # Replace variables with their values
      replaced =
        Enum.reduce(context, formula, fn {key, value}, acc ->
          key_str = to_string(key)
          String.replace(acc, key_str, to_string(value))
        end)

      # Parse and evaluate the expression
      case parse_and_eval(replaced) do
        {:ok, result} -> result
        {:error, _} -> default
      end
    rescue
      _ -> default
    end
  end

  defp evaluate_formula(_, _, default), do: default

  # Simple expression parser/evaluator
  defp parse_and_eval(expr) do
    # Remove whitespace and tokenize
    expr = String.replace(expr, " ", "")

    case parse_expression(expr) do
      {:ok, value, ""} -> {:ok, value}
      {:ok, value, _rest} -> {:ok, value}
      :error -> {:error, :parse_error}
    end
  end

  # Parse additive expression (lowest precedence)
  defp parse_expression(input) do
    case parse_term(input) do
      {:ok, left, rest} ->
        parse_additive(left, rest)

      :error ->
        :error
    end
  end

  defp parse_additive(left, "+" <> rest) do
    case parse_term(rest) do
      {:ok, right, remaining} ->
        parse_additive(left + right, remaining)

      :error ->
        :error
    end
  end

  defp parse_additive(left, "-" <> rest) do
    case parse_term(rest) do
      {:ok, right, remaining} ->
        parse_additive(left - right, remaining)

      :error ->
        :error
    end
  end

  defp parse_additive(value, rest), do: {:ok, value, rest}

  # Parse multiplicative expression (higher precedence)
  defp parse_term(input) do
    case parse_factor(input) do
      {:ok, left, rest} ->
        parse_multiplicative(left, rest)

      :error ->
        :error
    end
  end

  defp parse_multiplicative(left, "*" <> rest) do
    case parse_factor(rest) do
      {:ok, right, remaining} ->
        parse_multiplicative(left * right, remaining)

      :error ->
        :error
    end
  end

  defp parse_multiplicative(left, "/" <> rest) do
    case parse_factor(rest) do
      {:ok, right, remaining} when right != 0 ->
        parse_multiplicative(left / right, remaining)

      _ ->
        :error
    end
  end

  defp parse_multiplicative(value, rest), do: {:ok, value, rest}

  # Parse number (highest precedence)
  defp parse_factor(input) do
    case Float.parse(input) do
      {value, rest} -> {:ok, value, rest}
      :error -> :error
    end
  end

  defp default_config do
    %{
      combat: %{
        damage: %{
          base_formula: "str + weapon_bonus",
          minimum: 1,
          variance_min: 0.8,
          variance_max: 1.2
        },
        healing: %{
          base_formula: "int + level * 2",
          variance_min: 0.9,
          variance_max: 1.1
        }
      },
      progression: %{
        xp_formula: "level * level * 100",
        max_level: 50
      },
      resources: %{
        health: %{
          max_formula: "50 + sta * 5 + level * 10"
        }
      }
    }
  end
end
