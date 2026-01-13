defmodule Loka.Engine.SocialLoader do
  @moduledoc """
  Loads social/emote definitions from YAML into an ETS table.

  Socials are defined in `priv/world/socials.yml` and loaded at startup.
  Supports hot-reload without restart.

  ## Usage

      # Get a social by key
      {:ok, social} = SocialLoader.get("smile")

      # List all socials
      socials = SocialLoader.all()

      # Hot-reload from disk
      :ok = SocialLoader.reload()

  ## YAML Format

      socials:
        smile:
          aliases: [grin]
          min_position: resting
          messages:
            no_target:
              to_actor: "You smile happily."
              to_room: "{actor} smiles happily."
            with_target:
              to_actor: "You smile at {target}."
              to_target: "{actor} smiles at you warmly."
              to_room: "{actor} smiles at {target}."
  """

  use GenServer
  require Logger

  alias Loka.Engine.Social

  @table :loka_socials
  @default_path "priv/world/socials.yml"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the SocialLoader GenServer.

  ## Options

  - `:path` - Path to socials.yml (default: "priv/world/socials.yml")
  - `:name` - Process name (default: __MODULE__)
  - `:load_on_start` - Whether to load on start (default: true)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a social by key.

  Returns `{:ok, social}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a social by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, social} -> social
      {:error, :not_found} -> raise "Social not found: #{key}"
    end
  end

  @doc """
  Returns all loaded socials as a map of key => Social.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns all social keys (primary keys only, not aliases).
  """
  def keys(server \\ __MODULE__) do
    GenServer.call(server, :keys)
  end

  @doc """
  Returns the count of loaded socials.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Reloads socials from disk. Hot-reload without restart.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads socials from a specific path (useful for testing).
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

    # Create ETS table for social storage
    table = :ets.new(@table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      socials: %{},
      aliases: %{}
    }

    if load_on_start do
      case do_load(state, path) do
        {:ok, new_state} ->
          Logger.info("SocialLoader loaded #{map_size(new_state.socials)} socials")
          {:ok, new_state}

        {:error, reason} ->
          Logger.warning("SocialLoader started with errors: #{inspect(reason)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.socials, key) do
        nil ->
          # Try alias lookup
          case Map.get(state.aliases, key) do
            nil -> {:error, :not_found}
            social -> {:ok, social}
          end

        social ->
          {:ok, social}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, state.socials, state}
  end

  @impl true
  def handle_call(:keys, _from, state) do
    {:reply, Map.keys(state.socials), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.socials), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load(state, state.path) do
      {:ok, new_state} ->
        Logger.info("SocialLoader reloaded #{map_size(new_state.socials)} socials")
        {:reply, :ok, new_state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_call({:load_from, path}, _from, state) do
    case do_load(state, path) do
      {:ok, new_state} ->
        {:reply, :ok, %{new_state | path: path}}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      case parse_yaml_file(full_path) do
        {:ok, socials, aliases} ->
          update_ets(state.table, socials)
          {:ok, %{state | socials: socials, aliases: aliases}}

        {:error, reason} ->
          {:error, reason}
      end
    else
      Logger.debug("SocialLoader: #{full_path} does not exist, starting empty")
      {:ok, %{state | socials: %{}, aliases: %{}}}
    end
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  # sobelow_skip ["Traversal.FileModule"] - file path from priv/world config, not user input
  defp parse_yaml_file(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, socials, aliases} <- parse_socials(data["socials"]) do
      {:ok, socials, aliases}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp parse_socials(nil), do: {:ok, %{}, %{}}

  defp parse_socials(socials_data) when is_map(socials_data) do
    {socials, aliases, errors} =
      Enum.reduce(socials_data, {%{}, %{}, []}, fn {key, data}, {soc_acc, alias_acc, err_acc} ->
        case Social.from_map(key, data) do
          {:ok, social} ->
            # Build alias map
            new_aliases =
              Enum.reduce(social.aliases, alias_acc, fn alias_key, acc ->
                Map.put(acc, alias_key, social)
              end)

            {Map.put(soc_acc, key, social), new_aliases, err_acc}

          {:error, reason} ->
            {soc_acc, alias_acc, [{key, reason} | err_acc]}
        end
      end)

    if Enum.empty?(errors) do
      {:ok, socials, aliases}
    else
      {:error, {:parse_errors, errors}}
    end
  end

  defp update_ets(table, socials) do
    :ets.delete_all_objects(table)

    Enum.each(socials, fn {key, social} ->
      :ets.insert(table, {key, social})
    end)
  end
end
