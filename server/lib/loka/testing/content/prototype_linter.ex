defmodule Loka.Testing.Content.PrototypeLinter do
  @moduledoc """
  Lints YAML prototype definitions for common issues.

  Checks for:
  - Missing required fields (key, type)
  - Invalid parent references
  - Unknown component types
  - Invalid field values
  - Naming conventions

  ## Usage

      {:ok, results} = PrototypeLinter.lint()

      # Lint specific file
      {:ok, issues} = PrototypeLinter.lint_file("priv/world/prototypes/npcs/goblin.yml")

  ## Result Structure

      %{
        files_checked: 15,
        prototypes_checked: 20,
        errors: [
          {:missing_key, "npcs/unnamed.yml"},
          {:invalid_parent, "npcs/goblin.yml", "base_enemy"}
        ],
        warnings: [
          {:empty_description, "npcs/goblin.yml", "goblin"},
          {:unusual_naming, "rooms/Room1.yml", "Room1"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.{Entities, Constants.EntityTypes}

  @type lint_result :: %{
          files_checked: non_neg_integer(),
          prototypes_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:missing_key, String.t()}
          | {:missing_type, String.t(), String.t()}
          | {:invalid_parent, String.t(), String.t()}
          | {:invalid_type, String.t(), String.t(), term()}

  @type warning ::
          {:empty_description, String.t(), String.t()}
          | {:empty_name, String.t(), String.t()}
          | {:unusual_naming, String.t(), String.t()}
          | {:unknown_component, String.t(), String.t(), String.t()}
          | {:primary_keyword_not_in_long_desc, String.t(), String.t(), String.t(), String.t()}

  @valid_types EntityTypes.all()

  @known_components [
    # Combat & Stats
    "combatant",
    "loot",
    "boss",
    # Dialogue & Quests
    "dialogue",
    "dialogue_tree",
    "quest",
    "quests",
    # Inventory & Items
    "equipable",
    "useable",
    "consumable",
    "physical",
    "valuable",
    "carriable",
    "weapon",
    "armor",
    "key",
    "readable",
    "collectible",
    # Shops & Economy
    "shop",
    # Containers & Locks
    "container",
    "lockable",
    # NPCs & Behaviors
    "spawner",
    "behavior",
    "teacher",
    "state",
    # Resources & Crafting
    "ability",
    "skill",
    "resource",
    "status",
    "herb",
    "crafting_tool",
    "crafting_station",
    # Room Components
    "lighting",
    "room_elements",
    "offering_shrine",
    "rest_point",
    "on_enter_script",
    "time_locked_items",
    "size",
    # NPC Behaviors
    "companion",
    "gives_items",
    # Special Items
    "seal_fragment",
    "usable"
  ]

  @prototype_dir Loka.Engine.Constants.WorldPaths.prototypes_dir()

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Lints all loaded prototypes.

  Returns `{:ok, results}` with lint results.
  """
  @spec lint() :: {:ok, lint_result()}
  def lint do
    all_prototypes =
      Entities.find_all(is_prototype: true)
      |> Enum.reject(&draft?/1)

    {errors, warnings} =
      Enum.reduce(all_prototypes, {[], []}, fn proto, {errs, warns} ->
        {proto_errors, proto_warnings} = lint_prototype(proto.key, proto)
        {errs ++ proto_errors, warns ++ proto_warnings}
      end)

    results = %{
      files_checked: count_prototype_files(),
      prototypes_checked: length(all_prototypes),
      errors: errors,
      warnings: warnings
    }

    Logger.info(
      "PrototypeLinter: Checked #{results.prototypes_checked} prototypes, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Lints a specific prototype by key.
  """
  @spec lint_prototype(String.t()) :: {:ok, {[error()], [warning()]}} | {:error, :not_found}
  def lint_prototype(key) do
    case Entities.find_one(key: key) do
      {:error, :not_found} ->
        {:error, :not_found}

      {:ok, proto} ->
        {:ok, lint_prototype(key, proto)}
    end
  end

  @doc """
  Returns true if linting passes (no errors).
  """
  @spec valid?() :: boolean()
  def valid? do
    {:ok, results} = lint()
    Enum.empty?(results.errors)
  end

  @doc """
  Formats lint results as a human-readable report.
  """
  @spec format_report(lint_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== Prototype Lint Report ===",
      "",
      "Files checked: #{results.files_checked}",
      "Prototypes checked: #{results.prototypes_checked}",
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
  # Private - Prototype Linting
  # =============================================================================

  defp lint_prototype(key, proto) do
    errors = []
    warnings = []

    # Check required fields
    {errors, warnings} = check_key(key, proto, errors, warnings)
    {errors, warnings} = check_type(key, proto, errors, warnings)
    {errors, warnings} = check_parent(key, proto, errors, warnings)
    {errors, warnings} = check_components(key, proto, errors, warnings)
    {errors, warnings} = check_naming(key, proto, errors, warnings)
    {errors, warnings} = check_description(key, proto, errors, warnings)
    {errors, warnings} = check_primary_keyword_in_long_desc(key, proto, errors, warnings)

    {errors, warnings}
  end

  defp check_key(key, proto, errors, warnings) do
    if is_nil(proto.key) or proto.key == "" do
      {[{:missing_key, key} | errors], warnings}
    else
      {errors, warnings}
    end
  end

  defp check_type(key, proto, errors, warnings) do
    cond do
      # Legacy: base_ prefixed keys may have nil subtype
      is_nil(proto.type) and String.starts_with?(proto.key || "", "base_") ->
        {errors, warnings}

      is_nil(proto.type) ->
        {[{:missing_type, key, proto.key || "unknown"} | errors], warnings}

      proto.type not in @valid_types ->
        {[{:invalid_type, key, proto.key || "unknown", proto.type} | errors], warnings}

      true ->
        {errors, warnings}
    end
  end

  defp check_parent(key, proto, errors, warnings) do
    parent_key = (proto.metadata || %{})["parent_key"]

    if parent_key do
      case Entities.find_one(key: parent_key) do
        {:error, :not_found} ->
          {[{:invalid_parent, key, parent_key} | errors], warnings}

        {:ok, _} ->
          {errors, warnings}
      end
    else
      {errors, warnings}
    end
  end

  defp check_components(key, proto, errors, warnings) do
    components = proto.components || %{}

    unknown_warnings =
      components
      |> Map.keys()
      |> Enum.filter(fn comp_name ->
        comp_str = to_string(comp_name)
        comp_str not in @known_components
      end)
      |> Enum.map(fn comp_name ->
        {:unknown_component, key, proto.key || "unknown", to_string(comp_name)}
      end)

    {errors, warnings ++ unknown_warnings}
  end

  defp check_naming(key, proto, errors, warnings) do
    proto_key = proto.key || ""

    cond do
      # Check for spaces
      String.contains?(proto_key, " ") ->
        {errors, [{:unusual_naming, key, proto_key} | warnings]}

      # Check for uppercase (should be snake_case)
      proto_key != String.downcase(proto_key) ->
        {errors, [{:unusual_naming, key, proto_key} | warnings]}

      true ->
        {errors, warnings}
    end
  end

  defp check_description(key, proto, errors, warnings) do
    if is_nil(proto.extra_desc) or proto.extra_desc == "" do
      # Only warn for non-base-prefixed prototypes
      if not String.starts_with?(proto.key || "", "base_") do
        {errors, [{:empty_description, key, proto.key || "unknown"} | warnings]}
      else
        {errors, warnings}
      end
    else
      {errors, warnings}
    end
  end

  # Check that primary_keyword appears in long_desc for displayable entities (NPCs, items)
  # This ensures the keyword can be highlighted and made clickable in the UI
  defp check_primary_keyword_in_long_desc(key, proto, errors, warnings) do
    # Only check for types that are displayed in rooms
    displayable_types = [:npc, :item]

    primary_keyword = proto.primary_keyword

    cond do
      # Skip if not a displayable type
      proto.type not in displayable_types ->
        {errors, warnings}

      # Skip if no primary_keyword
      is_nil(primary_keyword) or primary_keyword == "" ->
        {errors, warnings}

      # Skip if no long_desc
      is_nil(proto.long_desc) or proto.long_desc == "" ->
        {errors, warnings}

      # Skip base-prefixed prototypes
      String.starts_with?(proto.key || "", "base_") ->
        {errors, warnings}

      # Check if primary_keyword appears in long_desc (case insensitive)
      true ->
        long_desc_lower = String.downcase(proto.long_desc)
        keyword_lower = String.downcase(primary_keyword)

        if String.contains?(long_desc_lower, keyword_lower) do
          {errors, warnings}
        else
          warning =
            {:primary_keyword_not_in_long_desc, key, proto.key || "unknown", primary_keyword,
             proto.long_desc}

          {errors, [warning | warnings]}
        end
    end
  end

  defp draft?(entity), do: get_in(entity.metadata || %{}, ["draft"]) == true

  defp count_prototype_files do
    case File.ls(@prototype_dir) do
      {:ok, _dirs} ->
        Path.wildcard("#{@prototype_dir}/**/*.yml")
        |> length()

      {:error, _} ->
        0
    end
  end

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:missing_key, file}) do
    "  - #{file}: Missing 'key' field"
  end

  defp format_error({:missing_type, file, key}) do
    "  - #{file} (#{key}): Missing 'type' field"
  end

  defp format_error({:invalid_parent, file, parent}) do
    "  - #{file}: Parent '#{parent}' not found"
  end

  defp format_error({:invalid_type, file, key, type}) do
    "  - #{file} (#{key}): Invalid type '#{type}'"
  end

  defp format_warning({:empty_description, file, key}) do
    "  - #{file} (#{key}): Missing description"
  end

  defp format_warning({:empty_name, file, key}) do
    "  - #{file} (#{key}): Missing name"
  end

  defp format_warning({:unusual_naming, file, key}) do
    "  - #{file}: Key '#{key}' should be snake_case"
  end

  defp format_warning({:unknown_component, file, key, component}) do
    "  - #{file} (#{key}): Unknown component '#{component}'"
  end

  defp format_warning({:primary_keyword_not_in_long_desc, file, key, keyword, long_desc}) do
    "  - #{file} (#{key}): primary_keyword '#{keyword}' not found in long_desc '#{long_desc}'"
  end
end
