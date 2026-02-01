defmodule Loka.Framework.RegistryBase do
  @moduledoc """
  Base macro for YAML-backed registry GenServers.

  Provides common functionality for registries that:
  - Load data from YAML files in `priv/world/` directories
  - Store items in ETS for fast concurrent lookup
  - Support hot-reload from disk

  ## Usage

      defmodule MyApp.ItemRegistry do
        use Loka.Framework.RegistryBase,
          table: :my_items,
          path: "priv/world/items",
          item_module: MyApp.Item,
          item_name: "item",
          state_key: :items

        # Optional: Add custom query functions
        def by_type(type, server \\ __MODULE__) do
          GenServer.call(server, {:by_type, type})
        end

        # Optional: Handle custom queries
        def handle_custom_call({:by_type, type}, state) do
          items = state.items |> Map.values() |> Enum.filter(&(&1.type == type))
          {:reply, items}
        end
      end

  ## Options

  - `:table` - ETS table name (required)
  - `:path` - Default path for YAML files (required)
  - `:item_module` - Module with `from_map/1` function (required)
  - `:item_name` - Human-readable name for logging (required)
  - `:state_key` - Key in state map for items (required)

  ## Generated Functions

  - `start_link/1` - Start the GenServer
  - `get/2` - Get item by key, returns `{:ok, item}` or `{:error, :not_found}`
  - `get!/2` - Get item by key, raises if not found
  - `all/1` - Get all items
  - `count/1` - Get count of items
  - `exists?/2` - Check if item exists
  - `reload/1` - Reload all items from disk
  - `load_from/2` - Load from specific path

  ## Customization

  Define `handle_custom_call/2` in your module to handle additional query types.
  It receives the call message and state, and should return `{:reply, result}`.
  """

  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    default_path = Keyword.fetch!(opts, :path)
    item_module = Keyword.fetch!(opts, :item_module)
    item_name = Keyword.fetch!(opts, :item_name)
    state_key = Keyword.fetch!(opts, :state_key)

    quote do
      use GenServer
      require Logger

      alias Loka.Utils.YamlLoader

      @table unquote(table)
      @default_path unquote(default_path)
      @item_module unquote(item_module)
      @item_name unquote(item_name)
      @state_key unquote(state_key)

      # =============================================================================
      # Client API
      # =============================================================================

      @doc """
      Starts the #{unquote(item_name)} registry GenServer.
      """
      def start_link(opts \\ []) do
        name = Keyword.get(opts, :name, __MODULE__)
        GenServer.start_link(__MODULE__, opts, name: name)
      end

      @doc """
      Gets a #{unquote(item_name)} by key.

      Returns `{:ok, #{unquote(item_name)}}` or `{:error, :not_found}`.

      Uses direct ETS lookup for O(1) concurrent reads when using the default server.
      Falls back to GenServer.call for custom server names (useful in tests).
      """
      def get(key, server \\ __MODULE__) when is_binary(key) do
        if server == __MODULE__ do
          # Direct ETS lookup - O(1) concurrent reads
          case :ets.lookup(@table, key) do
            [{^key, item}] -> {:ok, item}
            [] -> {:error, :not_found}
          end
        else
          # Custom server (tests) - use GenServer.call
          GenServer.call(server, {:get, key})
        end
      end

      @doc """
      Gets a #{unquote(item_name)} by key, raises if not found.
      """
      def get!(key, server \\ __MODULE__) when is_binary(key) do
        case get(key, server) do
          {:ok, item} ->
            item

          {:error, :not_found} ->
            raise "#{String.capitalize(unquote(item_name))} not found: #{key}"
        end
      end

      @doc """
      Returns all loaded #{unquote(item_name)}s.

      Uses direct ETS access for concurrent reads when using the default server.
      """
      def all(server \\ __MODULE__) do
        if server == __MODULE__ do
          # Direct ETS access
          :ets.tab2list(@table)
          |> Enum.map(fn {_key, item} -> item end)
        else
          GenServer.call(server, :all)
        end
      end

      @doc """
      Returns the count of loaded #{unquote(item_name)}s.

      Uses direct ETS access for concurrent reads when using the default server.
      """
      def count(server \\ __MODULE__) do
        if server == __MODULE__ do
          :ets.info(@table, :size)
        else
          GenServer.call(server, :count)
        end
      end

      @doc """
      Checks if a #{unquote(item_name)} exists.

      Uses direct ETS lookup for O(1) concurrent reads when using the default server.
      """
      def exists?(key, server \\ __MODULE__) when is_binary(key) do
        if server == __MODULE__ do
          :ets.member(@table, key)
        else
          case get(key, server) do
            {:ok, _} -> true
            {:error, _} -> false
          end
        end
      end

      @doc """
      Registers a #{unquote(item_name)} in the registry (useful for testing).

      Updates both the GenServer state and ETS table to keep them in sync.
      """
      def register(item, server \\ __MODULE__) do
        GenServer.call(server, {:register, item})
      end

      @doc """
      Reloads all #{unquote(item_name)}s from disk.
      """
      def reload(server \\ __MODULE__) do
        GenServer.call(server, :reload)
      end

      @doc """
      Loads #{unquote(item_name)}s from a specific path (useful for testing).
      """
      def load_from(path, server \\ __MODULE__) when is_binary(path) do
        GenServer.call(server, {:load_from, path})
      end

      # =============================================================================
      # GenServer Callbacks
      # =============================================================================

      @impl true
      def init(opts) do
        path = Keyword.get(opts, :path, @default_path)
        load_on_start = Keyword.get(opts, :load_on_start, true)
        server_name = Keyword.get(opts, :name, __MODULE__)

        # Create ETS table for data storage
        # - Default server (__MODULE__): Use named table for direct O(1) reads from client API
        # - Custom server (tests): Use anonymous table to avoid conflicts
        table =
          if server_name == __MODULE__ do
            # Production: named table for direct ETS lookups
            case :ets.whereis(@table) do
              :undefined ->
                :ets.new(@table, [:set, :protected, :named_table, read_concurrency: true])

              existing_table ->
                # Table exists (app restart) - clear and reuse
                :ets.delete_all_objects(existing_table)
                existing_table
            end
          else
            # Test: anonymous table (accessed via GenServer.call)
            :ets.new(@table, [:set, :protected, read_concurrency: true])
          end

        state =
          %{table: table, path: path}
          |> Map.put(@state_key, %{})

        if load_on_start do
          case do_load_all(state, path) do
            {:ok, new_state} ->
              count = map_size(Map.get(new_state, @state_key))
              Logger.info("#{inspect(__MODULE__)} loaded #{count} #{@item_name}s")
              {:ok, new_state}

            {:error, errors} ->
              Logger.warning("#{inspect(__MODULE__)} started with errors: #{inspect(errors)}")
              {:ok, state}
          end
        else
          {:ok, state}
        end
      end

      @impl true
      def handle_call({:get, key}, _from, state) do
        items = Map.get(state, @state_key)

        result =
          case Map.get(items, key) do
            nil -> {:error, :not_found}
            item -> {:ok, item}
          end

        {:reply, result, state}
      end

      @impl true
      def handle_call(:all, _from, state) do
        {:reply, Map.values(Map.get(state, @state_key)), state}
      end

      @impl true
      def handle_call(:count, _from, state) do
        {:reply, map_size(Map.get(state, @state_key)), state}
      end

      @impl true
      def handle_call({:register, item}, _from, state) do
        # Get the key from the item (assumes item has a :key field)
        key = Map.get(item, :key) || Map.get(item, "key")

        if key do
          # Update ETS table
          :ets.insert(state.table, {key, item})

          # Update state
          items = Map.get(state, @state_key)
          new_items = Map.put(items, key, item)
          new_state = Map.put(state, @state_key, new_items)

          {:reply, :ok, new_state}
        else
          {:reply, {:error, :no_key}, state}
        end
      end

      @impl true
      def handle_call(:reload, _from, state) do
        case do_load_all(state, state.path) do
          {:ok, new_state} ->
            count = map_size(Map.get(new_state, @state_key))
            Logger.info("#{inspect(__MODULE__)} reloaded #{count} #{@item_name}s")
            {:reply, :ok, new_state}

          {:error, errors} ->
            {:reply, {:error, errors}, state}
        end
      end

      @impl true
      def handle_call({:load_from, path}, _from, state) do
        case do_load_all(state, path) do
          {:ok, new_state} ->
            {:reply, :ok, %{new_state | path: path}}

          {:error, errors} ->
            {:reply, {:error, errors}, state}
        end
      end

      # Catch-all for custom calls - delegates to handle_custom_call if defined
      # Note: Not using @impl true here to allow child modules to override with @impl
      def handle_call(msg, from, state) do
        handle_custom_call(msg, from, state)
      end

      # Default implementation - override in child modules
      def handle_custom_call(_msg, _from, state) do
        {:reply, {:error, :unknown_call}, state}
      end

      # =============================================================================
      # Private Implementation
      # =============================================================================

      defp do_load_all(state, path) do
        full_path = YamlLoader.resolve_path(path)

        if YamlLoader.path_exists?(full_path) do
          yaml_files = YamlLoader.find_yaml_files(full_path)
          {items, parse_errors} = YamlLoader.parse_files(yaml_files, &@item_module.from_map/1)

          if Enum.any?(parse_errors) do
            {:error, parse_errors}
          else
            YamlLoader.update_ets(state.table, items)
            {:ok, Map.put(state, @state_key, items)}
          end
        else
          Logger.debug("#{inspect(__MODULE__)}: path #{full_path} does not exist, starting empty")
          # Also clear the ETS table when path doesn't exist
          YamlLoader.update_ets(state.table, %{})
          {:ok, Map.put(state, @state_key, %{})}
        end
      end

      # Allow modules to override
      defoverridable init: 1, handle_call: 3, handle_custom_call: 3
    end
  end
end
