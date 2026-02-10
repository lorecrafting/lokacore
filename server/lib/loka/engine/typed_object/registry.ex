defmodule Loka.Engine.TypedObject.Registry do
  @moduledoc """
  ETS-based cache for loaded TypedObjects.

  The Registry provides fast concurrent access to TypedObjects loaded from
  YAML files or database. It maintains multiple indexes for efficient lookup:

  - `:typed_objects` - Primary storage by key
  - `:typed_objects_by_type` - Index by type
  - `:typed_objects_by_tag` - Index by tag

  ## Usage

      # Initialize (typically done by the Loader)
      Registry.init()

      # Store a TypedObject
      Registry.put("goblin", typed_object)

      # Retrieve by key
      {:ok, typed_object} = Registry.get("goblin")

      # Query by type
      npcs = Registry.list_by_type(:entity, :npc)

      # Query by tag
      hostile = Registry.list_by_tag("hostile")
  """

  require Logger

  @table :typed_objects
  @type_index :typed_objects_by_type
  @tag_index :typed_objects_by_tag

  alias Loka.Engine.TypedObject

  @doc """
  Initializes the ETS tables for TypedObject storage.

  Should be called once at application startup (typically by the Loader).
  """
  @spec init() :: :ok
  def init do
    # Create tables if they don't exist
    create_table(@table, [:set, :public, :named_table, read_concurrency: true])
    create_table(@type_index, [:bag, :public, :named_table, read_concurrency: true])
    create_table(@tag_index, [:bag, :public, :named_table, read_concurrency: true])
    :ok
  end

  @doc """
  Stores a TypedObject in the registry.

  Updates all indexes.
  """
  @spec put(String.t(), TypedObject.t()) :: :ok
  def put(key, %TypedObject{} = typed_object) when is_binary(key) do
    # Remove old indexes if this key exists
    case get(key) do
      {:ok, old} -> remove_indexes(old)
      _ -> :ok
    end

    # Store in primary table
    :ets.insert(@table, {key, typed_object})

    # Update type index
    type_key = {typed_object.type, typed_object.subtype}
    :ets.insert(@type_index, {type_key, key})

    # Update tag indexes
    Enum.each(typed_object.tags, fn tag ->
      :ets.insert(@tag_index, {tag, key})
    end)

    :ok
  end

  @doc """
  Retrieves a TypedObject by key.
  """
  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case :ets.lookup(@table, key) do
      [{^key, typed_object}] -> {:ok, typed_object}
      [] -> {:error, :not_found}
    end
  end

  @doc """
  Retrieves a TypedObject by key, raises if not found.
  """
  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, typed_object} -> typed_object
      {:error, :not_found} -> raise "TypedObject not found: #{key}"
    end
  end

  @doc """
  Lists all TypedObjects of a specific type.
  """
  @spec list_by_type(atom()) :: [TypedObject.t()]
  def list_by_type(type) when is_atom(type) do
    list_by_type(type, nil)
  end

  @doc """
  Lists all TypedObjects of a specific type and subtype.
  """
  @spec list_by_type(atom(), atom() | nil) :: [TypedObject.t()]
  def list_by_type(type, subtype) when is_atom(type) do
    type_key = {type, subtype}

    @type_index
    |> :ets.lookup(type_key)
    |> Enum.flat_map(fn {_, key} ->
      case get(key) do
        {:ok, obj} -> [obj]
        {:error, :not_found} -> []
      end
    end)
  end

  @doc """
  Lists all TypedObjects with a specific tag.
  """
  @spec list_by_tag(String.t()) :: [TypedObject.t()]
  def list_by_tag(tag) when is_binary(tag) do
    @tag_index
    |> :ets.lookup(tag)
    |> Enum.flat_map(fn {_, key} ->
      case get(key) do
        {:ok, obj} -> [obj]
        {:error, :not_found} -> []
      end
    end)
  end

  @doc """
  Lists all published (non-draft) TypedObjects of a specific type and subtype.
  """
  @spec list_by_type_published(atom(), atom() | nil) :: [TypedObject.t()]
  def list_by_type_published(type, subtype \\ nil) when is_atom(type) do
    list_by_type(type, subtype)
    |> Enum.reject(&TypedObject.draft?/1)
  end

  @doc """
  Lists all published (non-draft) TypedObjects with a specific tag.
  """
  @spec list_by_tag_published(String.t()) :: [TypedObject.t()]
  def list_by_tag_published(tag) when is_binary(tag) do
    list_by_tag(tag)
    |> Enum.reject(&TypedObject.draft?/1)
  end

  @doc """
  Returns all keys in the registry.
  """
  @spec keys() :: [String.t()]
  def keys do
    :ets.foldl(fn {key, _}, acc -> [key | acc] end, [], @table)
  end

  @doc """
  Returns all TypedObjects in the registry.
  """
  @spec all() :: [TypedObject.t()]
  def all do
    :ets.foldl(fn {_, typed_object}, acc -> [typed_object | acc] end, [], @table)
  end

  @doc """
  Returns the count of TypedObjects in the registry.
  """
  @spec count() :: non_neg_integer()
  def count do
    :ets.info(@table, :size) || 0
  end

  @doc """
  Removes a TypedObject from the registry.
  """
  @spec delete(String.t()) :: :ok
  def delete(key) when is_binary(key) do
    case get(key) do
      {:ok, typed_object} ->
        remove_indexes(typed_object)
        :ets.delete(@table, key)

      _ ->
        :ok
    end

    :ok
  end

  @doc """
  Clears all TypedObjects from the registry.
  """
  @spec clear() :: :ok
  def clear do
    :ets.delete_all_objects(@table)
    :ets.delete_all_objects(@type_index)
    :ets.delete_all_objects(@tag_index)
    :ok
  end

  @doc """
  Checks if a key exists in the registry.
  """
  @spec exists?(String.t()) :: boolean()
  def exists?(key) when is_binary(key) do
    :ets.member(@table, key)
  end

  @doc """
  Returns all keys in the registry.
  """
  @spec all_keys() :: [String.t()]
  def all_keys do
    :ets.select(@table, [{{:"$1", :_}, [], [:"$1"]}])
  end

  @doc """
  Bulk inserts TypedObjects into the registry.

  More efficient than individual puts for loading many objects.
  """
  @spec put_all(map()) :: :ok
  def put_all(typed_objects) when is_map(typed_objects) do
    Enum.each(typed_objects, fn {key, typed_object} ->
      put(key, typed_object)
    end)

    :ok
  end

  # Private helpers

  defp create_table(name, opts) do
    case :ets.whereis(name) do
      :undefined -> :ets.new(name, opts)
      _ref -> name
    end
  end

  defp remove_indexes(%TypedObject{} = typed_object) do
    # Remove from type index
    type_key = {typed_object.type, typed_object.subtype}
    :ets.delete_object(@type_index, {type_key, typed_object.key})

    # Remove from tag indexes
    Enum.each(typed_object.tags, fn tag ->
      :ets.delete_object(@tag_index, {tag, typed_object.key})
    end)
  end
end
