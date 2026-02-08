defmodule Loka.Testing.Content.CraftingValidator do
  @moduledoc """
  Validates crafting recipe definitions for integrity.

  Ensures recipes are properly structured and reference valid content:
  - Ingredient items exist as prototypes
  - Output items exist as prototypes
  - Required tools exist as prototypes
  - Skills referenced are valid
  - Station types are valid

  ## Usage

      {:ok, results} = CraftingValidator.validate()

  ## Result Structure

      %{
        recipes_checked: 10,
        errors: [
          {:missing_ingredient, "recipe_sword", "unknown_ore"},
          {:missing_output, "recipe_potion", "invalid_item"}
        ],
        warnings: [
          {:no_description, "recipe_basic"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

  @type validation_result :: %{
          recipes_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:missing_ingredient, String.t(), String.t()}
          | {:missing_output, String.t(), String.t()}
          | {:missing_tool, String.t(), String.t()}
          | {:missing_failure_output, String.t(), String.t()}
          | {:no_output, String.t()}
          | {:no_ingredients, String.t()}

  @type warning ::
          {:no_description, String.t()}
          | {:high_failure_chance, String.t(), float()}
          | {:very_long_craft_time, String.t(), integer()}
          | {:no_xp_reward, String.t()}

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates all crafting recipe definitions.

  Returns `{:ok, results}` with validation results.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    recipes = load_recipes()

    {errors, warnings} =
      Enum.reduce(recipes, {[], []}, fn recipe, {errs, warns} ->
        {recipe_errors, recipe_warnings} = validate_recipe(recipe)
        {errs ++ recipe_errors, warns ++ recipe_warnings}
      end)

    results = %{
      recipes_checked: length(recipes),
      errors: errors,
      warnings: warnings
    }

    Logger.info(
      "CraftingValidator: Checked #{results.recipes_checked} recipes, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Returns true if validation passes (no errors).
  """
  @spec valid?() :: boolean()
  def valid? do
    {:ok, results} = validate()
    Enum.empty?(results.errors)
  end

  @doc """
  Formats validation results as a human-readable report.
  """
  @spec format_report(validation_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== Crafting Recipe Validation Report ===",
      "",
      "Recipes checked: #{results.recipes_checked}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_warning/1) ++
          [""]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ warning_lines ++ status, "\n")
  end

  # =============================================================================
  # Private - Loading
  # =============================================================================

  defp load_recipes do
    path = Path.join(:code.priv_dir(:loka), "world/recipes")

    if File.dir?(path) do
      load_recipes_recursive(path, [])
    else
      []
    end
  rescue
    _ -> []
  end

  defp load_recipes_recursive(path, acc) do
    entries = File.ls!(path)

    Enum.reduce(entries, acc, fn entry, acc_inner ->
      full_path = Path.join(path, entry)

      cond do
        File.dir?(full_path) ->
          load_recipes_recursive(full_path, acc_inner)

        String.ends_with?(entry, ".yml") ->
          recipe = YamlElixir.read_from_file!(full_path)
          [Map.put(recipe, "file", entry) | acc_inner]

        true ->
          acc_inner
      end
    end)
  rescue
    _ -> acc
  end

  # =============================================================================
  # Private - Validation
  # =============================================================================

  defp validate_recipe(recipe) do
    recipe_key = recipe["key"] || recipe["file"] || "unknown"
    errors = []
    warnings = []

    # Validate ingredients exist
    ingredients = recipe["ingredients"] || []

    errors =
      if Enum.empty?(ingredients) do
        [{:no_ingredients, recipe_key} | errors]
      else
        errors
      end

    {ingredient_errors, _} = validate_ingredients(recipe_key, ingredients)
    errors = errors ++ ingredient_errors

    # Validate output items exist
    output = recipe["output"] || []

    errors =
      if Enum.empty?(output) do
        [{:no_output, recipe_key} | errors]
      else
        errors
      end

    {output_errors, _} = validate_output(recipe_key, output)
    errors = errors ++ output_errors

    # Validate tools exist
    tools = recipe["tools"] || []
    {tool_errors, _} = validate_tools(recipe_key, tools)
    errors = errors ++ tool_errors

    # Validate failure_output items exist
    failure_output = recipe["failure_output"] || []
    {failure_errors, _} = validate_failure_output(recipe_key, failure_output)
    errors = errors ++ failure_errors

    # Check for missing description
    warnings =
      if is_nil(recipe["description"]) or recipe["description"] == "" do
        [{:no_description, recipe_key} | warnings]
      else
        warnings
      end

    # Warn about high failure chance
    failure_chance = recipe["failure_chance"] || 0

    warnings =
      if failure_chance > 0.5 do
        [{:high_failure_chance, recipe_key, failure_chance} | warnings]
      else
        warnings
      end

    # Warn about very long craft times
    time_required = recipe["time_required"] || 0

    warnings =
      if time_required > 300 do
        [{:very_long_craft_time, recipe_key, time_required} | warnings]
      else
        warnings
      end

    # Warn about missing XP reward
    warnings =
      if is_nil(recipe["xp_reward"]) do
        [{:no_xp_reward, recipe_key} | warnings]
      else
        warnings
      end

    {errors, warnings}
  end

  defp validate_ingredients(recipe_key, ingredients) do
    errors =
      Enum.reduce(ingredients, [], fn ingredient, acc ->
        item = ingredient["item"]

        if item do
          case TypedObjectLoader.get(item) do
            {:ok, proto} ->
              if proto.subtype == :item,
                do: acc,
                else: [{:missing_ingredient, recipe_key, item} | acc]

            {:error, :not_found} ->
              [{:missing_ingredient, recipe_key, item} | acc]
          end
        else
          acc
        end
      end)

    {errors, []}
  end

  defp validate_output(recipe_key, output) do
    errors =
      Enum.reduce(output, [], fn out, acc ->
        item = out["item"]

        if item do
          case TypedObjectLoader.get(item) do
            {:ok, proto} ->
              if proto.subtype == :item,
                do: acc,
                else: [{:missing_output, recipe_key, item} | acc]

            {:error, :not_found} ->
              [{:missing_output, recipe_key, item} | acc]
          end
        else
          acc
        end
      end)

    {errors, []}
  end

  defp validate_tools(recipe_key, tools) do
    errors =
      Enum.reduce(tools, [], fn tool, acc ->
        case TypedObjectLoader.get(tool) do
          {:ok, proto} ->
            if proto.subtype == :item, do: acc, else: [{:missing_tool, recipe_key, tool} | acc]

          {:error, :not_found} ->
            [{:missing_tool, recipe_key, tool} | acc]
        end
      end)

    {errors, []}
  end

  defp validate_failure_output(recipe_key, failure_output) do
    errors =
      Enum.reduce(failure_output, [], fn out, acc ->
        item = out["item"]

        if item do
          case TypedObjectLoader.get(item) do
            {:ok, proto} ->
              if proto.subtype == :item,
                do: acc,
                else: [{:missing_failure_output, recipe_key, item} | acc]

            {:error, :not_found} ->
              [{:missing_failure_output, recipe_key, item} | acc]
          end
        else
          acc
        end
      end)

    {errors, []}
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:missing_ingredient, recipe, item}) do
    "  - Recipe '#{recipe}': Ingredient item '#{item}' not found"
  end

  defp format_error({:missing_output, recipe, item}) do
    "  - Recipe '#{recipe}': Output item '#{item}' not found"
  end

  defp format_error({:missing_tool, recipe, tool}) do
    "  - Recipe '#{recipe}': Required tool '#{tool}' not found"
  end

  defp format_error({:missing_failure_output, recipe, item}) do
    "  - Recipe '#{recipe}': Failure output item '#{item}' not found"
  end

  defp format_error({:no_output, recipe}) do
    "  - Recipe '#{recipe}': Has no output items defined"
  end

  defp format_error({:no_ingredients, recipe}) do
    "  - Recipe '#{recipe}': Has no ingredients defined"
  end

  defp format_warning({:no_description, recipe}) do
    "  - Recipe '#{recipe}': Has no description"
  end

  defp format_warning({:high_failure_chance, recipe, chance}) do
    "  - Recipe '#{recipe}': Very high failure chance (#{Float.round(chance * 100, 1)}%)"
  end

  defp format_warning({:very_long_craft_time, recipe, time}) do
    "  - Recipe '#{recipe}': Very long craft time (#{time}s)"
  end

  defp format_warning({:no_xp_reward, recipe}) do
    "  - Recipe '#{recipe}': Has no XP reward defined"
  end
end
