defmodule Mix.Tasks.Loka.Validate.Yaml do
  @moduledoc """
  Validates YAML syntax for all game content files.

  This is a fast pre-commit check that only validates syntax,
  not semantic correctness (use `mix loka.test.validate` for that).

  ## Usage

      mix loka.validate.yaml

  ## Exit codes

  - 0: All YAML files are syntactically valid
  - 1: One or more files have syntax errors
  """

  use Mix.Task

  @shortdoc "Validates YAML syntax in priv/world/"

  @yaml_directories [
    "priv/world/prototypes",
    "priv/world/quests",
    "priv/world/zones",
    "priv/world/dialogues",
    "priv/world/scripts",
    "priv/world/cutscenes"
  ]

  @impl Mix.Task
  def run(_args) do
    errors =
      @yaml_directories
      |> Enum.filter(&File.dir?/1)
      |> Enum.flat_map(&find_yaml_files/1)
      |> Enum.map(&validate_file/1)
      |> Enum.filter(&match?({:error, _, _}, &1))

    case errors do
      [] ->
        Mix.shell().info("✓ All YAML files are syntactically valid")

      errors ->
        Mix.shell().error("YAML syntax errors found:\n")

        Enum.each(errors, fn {:error, file, reason} ->
          Mix.shell().error("  #{file}")
          Mix.shell().error("    #{format_error(reason)}\n")
        end)

        Mix.raise("#{length(errors)} YAML file(s) have syntax errors")
    end
  end

  defp find_yaml_files(dir) do
    Path.wildcard(Path.join(dir, "**/*.{yml,yaml}"))
  end

  defp validate_file(file) do
    case YamlElixir.read_from_file(file) do
      {:ok, _} -> {:ok, file}
      {:error, reason} -> {:error, file, reason}
    end
  end

  defp format_error(%YamlElixir.ParsingError{} = error) do
    "Line #{error.line}, column #{error.column}: #{error.message}"
  end

  defp format_error(error) when is_binary(error) do
    error
  end

  defp format_error(error) do
    inspect(error)
  end
end
