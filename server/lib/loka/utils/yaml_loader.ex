defmodule Loka.Utils.YamlLoader do
  @moduledoc """
  Common YAML loading utilities used by registries and loaders.

  Provides shared functions for:
  - Path resolution (relative to absolute)
  - Finding YAML files recursively
  - ETS table management
  - Parsing YAML files

  ## Usage

      # Resolve a path
      full_path = YamlLoader.resolve_path("priv/world/quests")

      # Find YAML files
      files = YamlLoader.find_yaml_files(full_path)

      # Parse files with a custom parser
      {items, errors} = YamlLoader.parse_files(files, &MyModule.from_map/1)

      # Update ETS table
      YamlLoader.update_ets(table, items)
  """

  @doc """
  Resolves a path to an absolute path.

  If the path is already absolute, returns it as-is.
  Otherwise, joins it with the current working directory.

  ## Examples

      iex> YamlLoader.resolve_path("/absolute/path")
      "/absolute/path"

      iex> YamlLoader.resolve_path("relative/path")
      "/cwd/relative/path"
  """
  @spec resolve_path(String.t()) :: String.t()
  def resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  @doc """
  Finds all YAML files (*.yml, *.yaml) recursively in a directory.

  ## Examples

      iex> YamlLoader.find_yaml_files("/path/to/dir")
      ["/path/to/dir/file1.yml", "/path/to/dir/subdir/file2.yaml"]
  """
  @spec find_yaml_files(String.t()) :: [String.t()]
  def find_yaml_files(dir) do
    Path.wildcard(Path.join([dir, "**", "*.{yml,yaml}"]))
  end

  @doc """
  Parses a list of YAML files using a custom parser function.

  The parser function should accept a map and return `{:ok, item}` or `{:error, reason}`.
  Items are keyed by their `key` or `id` field.

  Returns `{items_map, errors_list}`.

  ## Examples

      {items, errors} = YamlLoader.parse_files(files, fn data ->
        {:ok, %MyStruct{key: data["key"], name: data["name"]}}
      end)
  """
  @spec parse_files([String.t()], (map() -> {:ok, term()} | {:error, term()})) ::
          {map(), [{String.t(), term()}]}
  def parse_files(files, parser_fn) do
    Enum.reduce(files, {%{}, []}, fn file, {items, errors} ->
      case parse_yaml_file(file, parser_fn) do
        {:ok, item} ->
          key = get_item_key(item)
          {Map.put(items, key, item), errors}

        {:error, reason} ->
          {items, [{file, reason} | errors]}
      end
    end)
  end

  @doc """
  Parses a single YAML file using a custom parser function.

  ## Examples

      {:ok, item} = YamlLoader.parse_yaml_file("path/to/file.yml", &MyModule.from_map/1)
  """
  # sobelow_skip ["Traversal.FileModule"] - file paths from Path.wildcard on priv/world
  @spec parse_yaml_file(String.t(), (map() -> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def parse_yaml_file(file, parser_fn) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, item} <- parser_fn.(data) do
      {:ok, item}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Updates an ETS table with items, clearing existing data first.

  Items should be a map of `{key, item}` pairs.

  ## Examples

      YamlLoader.update_ets(:my_table, %{"key1" => item1, "key2" => item2})
  """
  @spec update_ets(:ets.table(), map()) :: :ok
  def update_ets(table, items) do
    :ets.delete_all_objects(table)

    Enum.each(items, fn {key, item} ->
      :ets.insert(table, {key, item})
    end)

    :ok
  end

  @doc """
  Checks if a path exists, useful for graceful handling of missing directories.

  ## Examples

      if YamlLoader.path_exists?(path) do
        # load files
      else
        # return empty
      end
  """
  @spec path_exists?(String.t()) :: boolean()
  def path_exists?(path), do: File.exists?(path)

  # Gets the key from an item - tries :key, then :id
  defp get_item_key(item) when is_struct(item) do
    Map.get(item, :key) || Map.get(item, :id)
  end

  defp get_item_key(item) when is_map(item) do
    item[:key] || item[:id] || item["key"] || item["id"]
  end
end
