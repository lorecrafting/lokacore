defmodule Loka.WorldBuilder.ScriptManager do
  @moduledoc """
  Manages script CRUD operations for the World Builder.

  Scripts are Elixir code snippets that can be attached to entities via hooks.
  This module provides creation, update, deletion, validation, and testing.

  ## Functions

    - create_script/1 - Create a new script (saves to YAML)
    - get_script/1 - Load script by key
    - update_script/2 - Update existing script
    - delete_script/1 - Delete script and YAML file
    - validate_script/1 - Run sandbox validation on source
    - test_script/3 - Dry-run with mock context
    - list_scripts/0 - List all scripts
  """
  require Logger

  alias Loka.Content.Script
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Loader
  alias Loka.Engine.Script.{Sandbox, Validator}

  @scripts_dir "priv/world/scripts"

  # Valid hooks
  @valid_hooks ~w(
    at_enter_room on_enter on_exit on_look
    on_talk on_talk_topic on_talk_choice
    on_damage on_heal on_death on_defeat
    on_combat_start on_combat_end on_attack on_defend
    on_item_use on_item_get on_item_drop
    on_meditate on_level_up
    on_spawn on_despawn on_tick
    at_command_pre at_command_post
    at_combat_pre at_combat_post
    at_move_pre at_move_post
  )a

  @doc """
  List all scripts.
  """
  @spec list_scripts() :: [TypedObject.t()]
  def list_scripts do
    Script.all()
  end

  @doc """
  Get a script by key.
  """
  @spec get_script(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get_script(key) when is_binary(key) do
    Script.get(key)
  end

  @doc """
  Create a new script.

  ## Attributes
    - key: Unique identifier (snake_case)
    - name: Display name
    - description: What the script does
    - hook: Hook type (e.g., :on_enter, :on_damage)
    - source: Elixir source code
    - tags: List of tags (optional)
    - timeout_ms: Execution timeout (optional, default 5000)
  """
  @spec create_script(map()) :: {:ok, TypedObject.t()} | {:error, term()}
  def create_script(attrs) when is_map(attrs) do
    key = attrs[:key] || attrs["key"]

    # Validate key doesn't already exist
    case Script.get(key) do
      {:ok, _} ->
        {:error, :already_exists}

      {:error, :not_found} ->
        # Build script data
        script_data = build_script_data(attrs)

        # Validate the script before saving
        case validate_script_source(script_data[:source], script_data[:hook]) do
          :ok ->
            # Save to YAML file
            save_script_yaml(key, script_data)

          {:error, _} = error ->
            error
        end
    end
  end

  @doc """
  Update an existing script.

  ## Updateable Attributes
    - name, description, hook, source, tags, timeout_ms
  """
  @spec update_script(String.t(), map()) :: {:ok, TypedObject.t()} | {:error, term()}
  def update_script(key, attrs) when is_binary(key) and is_map(attrs) do
    case Script.get(key) do
      {:ok, script} ->
        # Merge updates
        current_data = %{
          key: script.key,
          name: script.name,
          description: script.description,
          hook: Script.hook(script),
          source: Script.source(script),
          tags: script.tags,
          timeout_ms: Script.timeout_ms(script)
        }

        updated_data =
          current_data
          |> merge_attr(:name, attrs)
          |> merge_attr(:description, attrs)
          |> merge_attr(:hook, attrs)
          |> merge_attr(:source, attrs)
          |> merge_attr(:tags, attrs)
          |> merge_attr(:timeout_ms, attrs)

        # Validate if source changed
        case validate_script_source(updated_data[:source], updated_data[:hook]) do
          :ok ->
            save_script_yaml(key, updated_data)

          {:error, _} = error ->
            error
        end

      {:error, :not_found} = error ->
        error
    end
  end

  @doc """
  Delete a script by key.
  """
  @spec delete_script(String.t()) :: :ok | {:error, term()}
  def delete_script(key) when is_binary(key) do
    file_path = script_file_path(key)

    if File.exists?(file_path) do
      case File.rm(file_path) do
        :ok ->
          # Reload scripts to update registry
          Loader.reload()
          Logger.info("[ScriptManager] Deleted script: #{key}")
          :ok

        {:error, reason} ->
          {:error, "Failed to delete script file: #{reason}"}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Validate a script's source code.

  Returns :ok if valid, or {:error, errors} with validation errors.
  """
  @spec validate_script(String.t()) :: :ok | {:error, [String.t()]}
  def validate_script(key) when is_binary(key) do
    case Script.get(key) do
      {:ok, script} ->
        Script.validate(script)

      {:error, :not_found} = error ->
        error
    end
  end

  @doc """
  Validate raw script source code.

  ## Parameters
    - source: Elixir source code string
    - hook: Hook type (optional, for context-specific validation)
  """
  @spec validate_script_source(String.t(), atom() | String.t() | nil) ::
          :ok | {:error, [String.t()]}
  def validate_script_source(source, hook \\ nil) when is_binary(source) do
    try do
      errors = []

      # Check syntax
      errors =
        case Code.string_to_quoted(source) do
          {:ok, _ast} -> errors
          {:error, {line, msg, _}} -> ["Syntax error on line #{line}: #{msg}" | errors]
        end

      # Check hook is valid if provided
      errors =
        if hook do
          hook_str = if is_atom(hook), do: Atom.to_string(hook), else: hook

          valid_hook_strings = Enum.map(@valid_hooks, &Atom.to_string/1)

          if hook_str in valid_hook_strings do
            errors
          else
            ["Invalid hook type: #{hook}" | errors]
          end
        else
          errors
        end

      # Run sandbox validation
      errors =
        case Validator.validate(source) do
          :ok -> errors
          {:error, validation_errors} -> validation_errors ++ errors
        end

      if Enum.empty?(errors), do: :ok, else: {:error, errors}
    rescue
      e ->
        {:error, ["Validation error: #{Exception.message(e)}"]}
    end
  end

  @doc """
  Test a script with mock context.

  ## Parameters
    - key: Script key
    - entity: Mock entity (map)
    - context: Mock context (map)

  Returns {:ok, result} with execution result or {:error, reason}.
  """
  @spec test_script(String.t(), map(), map()) :: {:ok, term()} | {:error, term()}
  def test_script(key, entity \\ %{}, context \\ %{}) do
    case Script.get(key) do
      {:ok, script} ->
        source = Script.source(script)

        # Build mock bindings
        mock_bindings = build_mock_bindings(entity, context)

        # Try to execute in sandbox (dry run)
        try do
          case Sandbox.execute(source, mock_bindings, Script.timeout_ms(script)) do
            {:ok, result} ->
              {:ok, %{success: true, result: result}}

            {:error, reason} ->
              {:error, reason}
          end
        rescue
          e ->
            {:error, Exception.message(e)}
        end

      {:error, :not_found} = error ->
        error
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp build_script_data(attrs) do
    %{
      key: attrs[:key] || attrs["key"],
      name: attrs[:name] || attrs["name"] || "Unnamed Script",
      description: attrs[:description] || attrs["description"] || "",
      hook: normalize_hook(attrs[:hook] || attrs["hook"]),
      source: attrs[:source] || attrs["source"] || "",
      tags: attrs[:tags] || attrs["tags"] || [],
      timeout_ms: attrs[:timeout_ms] || attrs["timeout_ms"] || 5000
    }
  end

  defp normalize_hook(hook) when is_atom(hook), do: Atom.to_string(hook)
  defp normalize_hook(hook) when is_binary(hook), do: hook
  defp normalize_hook(_), do: "on_tick"

  defp merge_attr(data, key, attrs) do
    value = attrs[key] || attrs[Atom.to_string(key)]
    if value, do: Map.put(data, key, value), else: data
  end

  defp script_file_path(key) do
    Path.join([@scripts_dir, "#{key}.yml"])
  end

  defp save_script_yaml(key, data) do
    yaml_content = """
    key: #{key}
    type: script
    name: "#{data[:name]}"
    description: "#{data[:description]}"
    tags: #{format_yaml_list(data[:tags])}
    data:
      hook: #{data[:hook]}
      timeout_ms: #{data[:timeout_ms]}
      source: |
    #{indent_source(data[:source], 4)}
    """

    file_path = script_file_path(key)

    case File.write(file_path, yaml_content) do
      :ok ->
        # Reload to update registry
        Loader.reload()
        Logger.info("[ScriptManager] Saved script: #{key}")

        # Return the loaded script
        case Script.get(key) do
          {:ok, script} -> {:ok, script}
          {:error, _} -> {:error, "Script saved but failed to reload"}
        end

      {:error, reason} ->
        {:error, "Failed to save script: #{reason}"}
    end
  end

  defp format_yaml_list([]), do: "[]"
  defp format_yaml_list(tags), do: "[#{Enum.join(tags, ", ")}]"

  defp indent_source(source, spaces) do
    indent = String.duplicate(" ", spaces)

    source
    |> String.split("\n")
    |> Enum.map(fn line -> indent <> line end)
    |> Enum.join("\n")
  end

  defp build_mock_bindings(entity, context) do
    %{
      entity: entity,
      player: entity,
      context: Map.merge(%{room: %{tags: [], key: "test_room"}}, context),
      # Mock functions that just return :ok
      message: fn _msg -> :ok end,
      say: fn _msg -> :ok end,
      emote: fn _msg -> :ok end,
      log: fn _msg -> :ok end,
      continue: fn -> :continue end,
      deny: fn -> :deny end,
      allow: fn -> :allow end,
      handled: fn -> :handled end,
      default: fn -> :default end
    }
  end
end
