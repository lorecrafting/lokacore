defmodule Exmud.Engine.Locks do
  @moduledoc """
  String-based access control system.

  Provides Evennia-style lock strings for flexible access control. Locks are
  stored as strings that define conditions for various access types.

  ## Lock String Format

      lockfunc(args) [AND|OR] lockfunc2(args)

  ## Examples

      "all()"                             # Anyone can access
      "none()"                            # No one can access
      "perm(admin)"                       # Only admins
      "has_key(gold_key)"                 # Need gold_key item
      "attr_gt(strength, 50)"             # Strength > 50
      "id(abc123) OR perm(admin)"         # Owner or admin
      "perm(builder) AND NOT tag(broken)" # Builder, not broken

  ## Usage

      # Check access on an entity
      case Locks.check(chest, player, "get") do
        :ok -> allow_get()
        {:denied, reason} -> deny_with_message(reason)
      end

      # Entity locks are stored in the locks field
      entity = %Entity{
        locks: %{
          "get" => "perm(builder) OR attr_gt(strength, 50)",
          "edit" => "perm(admin)",
          "delete" => "id(owner123)"
        }
      }

  ## Built-in Lock Functions

  - `all()` - Always passes
  - `none()` - Always fails
  - `perm(name)` - Check if accessor has permission
  - `attr(name, value)` - Check entity attribute equals value
  - `attr_gt(name, value)` - Attribute greater than value
  - `attr_lt(name, value)` - Attribute less than value
  - `id(entity_id)` - Match accessor's ID
  - `tag(name)` - Check if entity has tag
  - `has_item(key)` - Accessor has item with key in inventory
  - `is_type(type)` - Accessor is of entity type
  - `in_room(room_key)` - Accessor is in room with key
  """

  alias Exmud.Engine.Entity

  # ETS table for custom lock functions
  @functions_table :exmud_lock_functions

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Checks if an accessor can perform an action on an entity.

  ## Parameters

  - `entity` - The entity being accessed
  - `accessor` - The entity trying to access (usually a player/character)
  - `access_type` - String key for the type of access (e.g., "get", "edit")

  ## Returns

  - `:ok` if access is granted
  - `{:denied, reason}` if access is denied
  """
  @spec check(Entity.t() | map(), Entity.t() | map(), String.t()) :: :ok | {:denied, String.t()}
  def check(entity, accessor, access_type) do
    lock_string = get_lock(entity, access_type)

    case lock_string do
      nil ->
        # No lock defined = allow access
        :ok

      "" ->
        :ok

      lock_str ->
        case parse(lock_str) do
          {:ok, ast} ->
            if evaluate(ast, entity, accessor) do
              :ok
            else
              {:denied, "Access denied: #{access_type}"}
            end

          {:error, reason} ->
            {:denied, "Invalid lock: #{reason}"}
        end
    end
  end

  @doc """
  Gets the lock string for an access type from an entity.
  """
  @spec get_lock(Entity.t() | map(), String.t()) :: String.t() | nil
  def get_lock(%{locks: locks}, access_type) when is_map(locks) do
    Map.get(locks, access_type) || Map.get(locks, to_string(access_type))
  end

  def get_lock(_, _), do: nil

  @doc """
  Sets a lock on an entity. Returns the updated entity.
  """
  @spec set_lock(Entity.t(), String.t(), String.t()) :: Entity.t()
  def set_lock(%Entity{locks: locks} = entity, access_type, lock_string) do
    %{entity | locks: Map.put(locks || %{}, access_type, lock_string)}
  end

  @doc """
  Parses a lock string into an AST for evaluation.

  ## Examples

      iex> Locks.parse("all()")
      {:ok, {:func, "all", []}}

      iex> Locks.parse("perm(admin) OR id(123)")
      {:ok, {:or, {:func, "perm", ["admin"]}, {:func, "id", ["123"]}}}
  """
  @spec parse(String.t()) :: {:ok, term()} | {:error, String.t()}
  def parse(lock_string) when is_binary(lock_string) do
    lock_string = String.trim(lock_string)

    if lock_string == "" do
      {:ok, {:func, "all", []}}
    else
      case tokenize(lock_string) do
        {:ok, tokens} ->
          parse_expression(tokens)

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Evaluates a parsed lock AST against an entity and accessor.
  """
  @spec evaluate(term(), Entity.t() | map(), Entity.t() | map()) :: boolean()
  def evaluate({:and, left, right}, entity, accessor) do
    evaluate(left, entity, accessor) and evaluate(right, entity, accessor)
  end

  def evaluate({:or, left, right}, entity, accessor) do
    evaluate(left, entity, accessor) or evaluate(right, entity, accessor)
  end

  def evaluate({:not, expr}, entity, accessor) do
    not evaluate(expr, entity, accessor)
  end

  def evaluate({:func, name, args}, entity, accessor) do
    case get_function(name) do
      nil -> false
      fun -> fun.(entity, accessor, args)
    end
  end

  def evaluate(_, _, _), do: false

  @doc """
  Registers a custom lock function.

  The function should have arity 3: `fn(entity, accessor, args) -> boolean`

  ## Examples

      Locks.register_function("has_gold", fn _entity, accessor, [min_amount] ->
        gold = get_in(accessor.components, ["inventory", "gold"]) || 0
        gold >= String.to_integer(min_amount)
      end)
  """
  @spec register_function(String.t(), function()) :: :ok
  def register_function(name, fun) when is_binary(name) and is_function(fun, 3) do
    ensure_table_exists()
    :ets.insert(@functions_table, {name, fun})
    :ok
  end

  @doc """
  Unregisters a custom lock function.
  """
  @spec unregister_function(String.t()) :: :ok
  def unregister_function(name) when is_binary(name) do
    ensure_table_exists()
    :ets.delete(@functions_table, name)
    :ok
  end

  # =============================================================================
  # Built-in Lock Functions
  # =============================================================================

  @doc false
  def check_all(_entity, _accessor, _args), do: true

  @doc false
  def check_none(_entity, _accessor, _args), do: false

  @doc false
  def check_permission(_entity, accessor, args) do
    perm_name = List.first(args)

    permissions =
      get_in_map(accessor, [:permissions]) || get_in_map(accessor, ["permissions"]) || []

    is_admin = get_in_map(accessor, [:is_admin]) || get_in_map(accessor, ["is_admin"]) || false

    # Admin permission always grants all permissions
    is_admin || perm_name in permissions || to_string(perm_name) in permissions
  end

  @doc false
  def check_attribute(entity, _accessor, args) do
    case args do
      [attr_name, expected] ->
        actual = get_entity_attribute(entity, attr_name)
        to_string(actual) == to_string(expected)

      _ ->
        false
    end
  end

  @doc false
  def check_attribute_gt(entity, _accessor, args) do
    case args do
      [attr_name, threshold] ->
        actual = get_entity_attribute(entity, attr_name)
        compare_gt(actual, threshold)

      _ ->
        false
    end
  end

  @doc false
  def check_attribute_lt(entity, _accessor, args) do
    case args do
      [attr_name, threshold] ->
        actual = get_entity_attribute(entity, attr_name)
        compare_lt(actual, threshold)

      _ ->
        false
    end
  end

  @doc false
  def check_id(_entity, accessor, args) do
    expected_id = List.first(args)
    accessor_id = get_in_map(accessor, [:id]) || get_in_map(accessor, ["id"])
    to_string(accessor_id) == to_string(expected_id)
  end

  @doc false
  def check_tag(entity, _accessor, args) do
    tag_name = List.first(args)
    tags = get_in_map(entity, [:tags]) || get_in_map(entity, ["tags"]) || []
    tag_name in tags || to_string(tag_name) in tags
  end

  @doc false
  def check_has_item(_entity, accessor, args) do
    item_key = List.first(args)

    # Check accessor's contents for an item with the given key
    contents = get_in_map(accessor, [:contents]) || get_in_map(accessor, ["contents"]) || []

    Enum.any?(contents, fn
      %{key: key} -> key == item_key
      %{"key" => key} -> key == item_key
      _ -> false
    end)
  end

  @doc false
  def check_has_key(_entity, accessor, args) do
    # Alias for has_item, commonly used for doors
    check_has_item(nil, accessor, args)
  end

  @doc false
  def check_is_type(_entity, accessor, args) do
    expected_type = List.first(args)
    accessor_type = get_in_map(accessor, [:type]) || get_in_map(accessor, ["type"])

    to_string(accessor_type) == to_string(expected_type)
  end

  @doc false
  def check_in_room(_entity, accessor, args) do
    expected_room = List.first(args)
    location_id = get_in_map(accessor, [:location_id]) || get_in_map(accessor, ["location_id"])
    to_string(location_id) == to_string(expected_room)
  end

  # =============================================================================
  # Tokenizer
  # =============================================================================

  defp tokenize(string) do
    string
    |> String.trim()
    |> do_tokenize([])
    |> case do
      {:error, _} = error -> error
      tokens -> {:ok, Enum.reverse(tokens)}
    end
  end

  defp do_tokenize("", acc), do: acc

  defp do_tokenize(<<" ", rest::binary>>, acc) do
    do_tokenize(String.trim_leading(rest), acc)
  end

  defp do_tokenize(<<"AND", rest::binary>>, acc) do
    do_tokenize(String.trim_leading(rest), [:and | acc])
  end

  defp do_tokenize(<<"OR", rest::binary>>, acc) do
    do_tokenize(String.trim_leading(rest), [:or | acc])
  end

  defp do_tokenize(<<"NOT", rest::binary>>, acc) do
    do_tokenize(String.trim_leading(rest), [:not | acc])
  end

  defp do_tokenize(<<"(", rest::binary>>, acc) do
    do_tokenize(rest, [:lparen | acc])
  end

  defp do_tokenize(<<")", rest::binary>>, acc) do
    do_tokenize(rest, [:rparen | acc])
  end

  defp do_tokenize(string, acc) do
    # Try to parse a function call: name(args)
    case parse_function_call(string) do
      {:ok, func_token, rest} ->
        do_tokenize(String.trim_leading(rest), [func_token | acc])

      :error ->
        {:error, "Invalid token at: #{String.slice(string, 0, 20)}"}
    end
  end

  defp parse_function_call(string) do
    # Match: identifier(args)
    case Regex.run(~r/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)(.*)$/s, string) do
      [_, name, args_str, rest] ->
        args = parse_args(args_str)
        {:ok, {:func, name, args}, rest}

      nil ->
        :error
    end
  end

  defp parse_args(""), do: []

  defp parse_args(args_str) do
    args_str
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  # =============================================================================
  # Parser
  # =============================================================================

  defp parse_expression(tokens) do
    case parse_or(tokens) do
      {:ok, ast, []} -> {:ok, ast}
      {:ok, _ast, remaining} -> {:error, "Unexpected tokens: #{inspect(remaining)}"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp parse_or(tokens) do
    with {:ok, left, rest} <- parse_and(tokens) do
      case rest do
        [:or | rest2] ->
          case parse_or(rest2) do
            {:ok, right, rest3} -> {:ok, {:or, left, right}, rest3}
            error -> error
          end

        _ ->
          {:ok, left, rest}
      end
    end
  end

  defp parse_and(tokens) do
    with {:ok, left, rest} <- parse_not(tokens) do
      case rest do
        [:and | rest2] ->
          case parse_and(rest2) do
            {:ok, right, rest3} -> {:ok, {:and, left, right}, rest3}
            error -> error
          end

        _ ->
          {:ok, left, rest}
      end
    end
  end

  defp parse_not([:not | rest]) do
    case parse_primary(rest) do
      {:ok, expr, rest2} -> {:ok, {:not, expr}, rest2}
      error -> error
    end
  end

  defp parse_not(tokens), do: parse_primary(tokens)

  defp parse_primary([:lparen | rest]) do
    with {:ok, expr, [:rparen | rest2]} <- parse_or(rest) do
      {:ok, expr, rest2}
    else
      {:ok, _expr, rest} -> {:error, "Expected closing paren, got: #{inspect(rest)}"}
      error -> error
    end
  end

  defp parse_primary([{:func, name, args} | rest]) do
    {:ok, {:func, name, args}, rest}
  end

  defp parse_primary([token | _]) do
    {:error, "Unexpected token: #{inspect(token)}"}
  end

  defp parse_primary([]) do
    {:error, "Unexpected end of expression"}
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp get_function(name) do
    # Check built-in functions first
    case name do
      "all" -> &check_all/3
      "none" -> &check_none/3
      "perm" -> &check_permission/3
      "attr" -> &check_attribute/3
      "attr_gt" -> &check_attribute_gt/3
      "attr_lt" -> &check_attribute_lt/3
      "id" -> &check_id/3
      "tag" -> &check_tag/3
      "has_item" -> &check_has_item/3
      "has_key" -> &check_has_key/3
      "is_type" -> &check_is_type/3
      "in_room" -> &check_in_room/3
      _ -> get_custom_function(name)
    end
  end

  defp get_custom_function(name) do
    ensure_table_exists()

    case :ets.lookup(@functions_table, name) do
      [{^name, fun}] -> fun
      [] -> nil
    end
  end

  defp ensure_table_exists do
    if :ets.whereis(@functions_table) == :undefined do
      :ets.new(@functions_table, [:named_table, :set, :public])
    end
  end

  defp get_in_map(map, path) when is_map(map) and is_list(path) do
    Enum.reduce_while(path, map, fn key, acc ->
      case acc do
        %{^key => value} -> {:cont, value}
        _ -> {:halt, nil}
      end
    end)
  end

  defp get_in_map(_, _), do: nil

  defp get_entity_attribute(entity, attr_name) do
    # Try attributes first, then components
    attrs = get_in_map(entity, [:attributes]) || get_in_map(entity, ["attributes"]) || %{}

    case Map.get(attrs, attr_name) || Map.get(attrs, to_string(attr_name)) do
      nil ->
        # Try components
        comps = get_in_map(entity, [:components]) || get_in_map(entity, ["components"]) || %{}
        find_in_nested(comps, attr_name)

      value ->
        value
    end
  end

  defp find_in_nested(map, key) when is_map(map) do
    case Map.get(map, key) || Map.get(map, to_string(key)) do
      nil ->
        # Search nested maps
        Enum.find_value(map, fn
          {_, v} when is_map(v) -> find_in_nested(v, key)
          _ -> nil
        end)

      value ->
        value
    end
  end

  defp find_in_nested(_, _), do: nil

  defp compare_gt(nil, _), do: false

  defp compare_gt(actual, threshold) when is_number(actual) do
    threshold_num = parse_number(threshold)
    threshold_num != nil and actual > threshold_num
  end

  defp compare_gt(actual, threshold) when is_binary(actual) do
    case Float.parse(actual) do
      {num, _} -> compare_gt(num, threshold)
      :error -> false
    end
  end

  defp compare_gt(_, _), do: false

  defp compare_lt(nil, _), do: false

  defp compare_lt(actual, threshold) when is_number(actual) do
    threshold_num = parse_number(threshold)
    threshold_num != nil and actual < threshold_num
  end

  defp compare_lt(actual, threshold) when is_binary(actual) do
    case Float.parse(actual) do
      {num, _} -> compare_lt(num, threshold)
      :error -> false
    end
  end

  defp compare_lt(_, _), do: false

  defp parse_number(n) when is_number(n), do: n

  defp parse_number(s) when is_binary(s) do
    case Float.parse(s) do
      {num, _} -> num
      :error -> nil
    end
  end

  defp parse_number(_), do: nil
end
