defmodule LokaWeb.Channels.BuilderCommands.Scripts do
  @moduledoc """
  Script CRUD commands: create, delete, info, list, validate, test,
  templates, from-template, attach, detach.
  """

  alias Loka.Engine.TypedObject.Loader
  alias Loka.Content.Script
  alias Loka.WorldBuilder.YamlBuilder
  alias LokaWeb.Channels.BuilderCommands.{Helpers, Formatter}

  @scripts_dir Path.join([:code.priv_dir(:loka), "world", "scripts"])

  def execute(:script_create, %{key: key, hook: hook}, socket) do
    case Script.get(key) do
      {:ok, _} ->
        {:error, "Script '#{key}' already exists.", socket}

      {:error, :not_found} ->
        yaml_content = """
        key: #{key}
        type: script
        name: "Script: #{key}"
        data:
          hook: #{hook}
          source: |
            # Script: #{key}
            # Hook: #{hook}
            continue()
          timeout_ms: 5000
        """

        Helpers.ensure_dir(@scripts_dir)

        file_path = Path.join(@scripts_dir, "#{key}.yml")

        case File.write(file_path, yaml_content) do
          :ok ->
            Loader.reload_file(file_path)

            {:ok,
             "Script '#{key}' created (hook: #{hook}).\n" <>
               "  Use /ai to add logic: /ai add patrol behavior to #{key}", socket}

          {:error, reason} ->
            {:error, "Failed to create script: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:delete_script, %{key: key}, socket) do
    file_path = Path.join(@scripts_dir, "#{key}.yml")

    if File.exists?(file_path) do
      case File.rm(file_path) do
        :ok ->
          Loader.remove(key)
          {:ok, "Script '#{key}' deleted.", socket}

        {:error, reason} ->
          {:error, "Failed to delete script: #{inspect(reason)}", socket}
      end
    else
      {:error, "Script '#{key}' not found.", socket}
    end
  end

  def execute(:script_info, %{key: key}, socket) do
    case Script.get(key) do
      {:ok, script} ->
        yaml_text = Helpers.format_typed_object(script)
        {:ok, "Script '#{key}':\n#{yaml_text}", socket}

      {:error, :not_found} ->
        {:error, "Script '#{key}' not found.", socket}
    end
  end

  def execute(:script_list, %{hook: nil}, socket) do
    scripts = Script.all()

    rows =
      Enum.map(scripts, fn s ->
        hook = Script.hook(s) || ""
        [s.key, s.name || s.key, to_string(hook)]
      end)

    text =
      Formatter.section(
        Formatter.count_label(length(scripts), "script"),
        Formatter.table(["Key", "Name", "Hook"], rows)
      )

    {:ok, text, socket}
  end

  def execute(:script_list, %{hook: hook}, socket) do
    hook_atom =
      try do
        String.to_existing_atom(hook)
      rescue
        _ -> hook
      end

    scripts = Script.for_hook(hook_atom)

    rows =
      Enum.map(scripts, fn s ->
        [s.key, s.name || s.key, to_string(Script.hook(s) || "")]
      end)

    text =
      Formatter.section(
        "Scripts for hook '#{hook}' (#{length(scripts)})",
        Formatter.table(["Key", "Name", "Hook"], rows)
      )

    {:ok, text, socket}
  end

  def execute(:script_validate, %{key: key}, socket) do
    case Script.get(key) do
      {:ok, script} ->
        case Script.validate(script) do
          :ok ->
            {:ok, "Script '#{key}' is valid.", socket}

          {:error, errors} ->
            error_text = Enum.join(errors, "\n  ")
            {:error, "Script '#{key}' validation errors:\n  #{error_text}", socket}
        end

      {:error, :not_found} ->
        {:error, "Script '#{key}' not found.", socket}
    end
  end

  def execute(:script_test, %{key: key}, socket) do
    case Script.get(key) do
      {:ok, script} ->
        case Script.validate(script) do
          :ok ->
            source = Script.source(script)

            case Code.string_to_quoted(source) do
              {:ok, _ast} ->
                {:ok, "Script '#{key}' dry-run passed (syntax valid, sandbox compatible).",
                 socket}

              {:error, {line, msg, _}} ->
                {:error, "Script '#{key}' syntax error at line #{line}: #{msg}", socket}
            end

          {:error, errors} ->
            error_text = Enum.join(errors, "\n  ")
            {:error, "Script '#{key}' validation failed:\n  #{error_text}", socket}
        end

      {:error, :not_found} ->
        {:error, "Script '#{key}' not found.", socket}
    end
  end

  def execute(:script_templates, _params, socket) do
    templates = get_template_list()

    rows =
      Enum.map(templates, fn {id, name, _desc} ->
        [id, name]
      end)

    text =
      Formatter.section(
        "Script Templates (#{length(templates)})",
        Formatter.table(["ID", "Name"], rows)
      )

    {:ok, text, socket}
  end

  def execute(:script_template_info, %{template: tpl}, socket) do
    case find_template(tpl) do
      {:ok, {_id, name, desc}} ->
        {:ok, "Template '#{tpl}':\n  #{name}\n  #{desc}", socket}

      :error ->
        {:error, "Template '#{tpl}' not found. Use 'script templates' to see available.", socket}
    end
  end

  def execute(:script_from_template, %{key: key, template: tpl, config: config_str}, socket) do
    case Script.get(key) do
      {:ok, _} ->
        {:error, "Script '#{key}' already exists.", socket}

      {:error, :not_found} ->
        case generate_from_template(key, tpl, config_str) do
          {:ok, yaml_content} ->
            Helpers.ensure_dir(@scripts_dir)

            file_path = Path.join(@scripts_dir, "#{key}.yml")

            case File.write(file_path, yaml_content) do
              :ok ->
                Loader.reload_file(file_path)
                {:ok, "Script '#{key}' created from template '#{tpl}'.", socket}

              {:error, reason} ->
                {:error, "Failed to create script: #{inspect(reason)}", socket}
            end

          {:error, reason} ->
            {:error, reason, socket}
        end
    end
  end

  def execute(:script_attach, %{script_key: script_key, entity_key: entity_key}, socket) do
    case Script.get(script_key) do
      {:ok, _script} ->
        case Loader.get(entity_key) do
          {:ok, entity} ->
            data = entity.data || %{}
            scripts = data["scripts"] || []

            if script_key in scripts do
              {:error, "Script '#{script_key}' already attached to '#{entity_key}'.", socket}
            else
              updated_data = Map.put(data, "scripts", scripts ++ [script_key])
              YamlBuilder.save_entity_with_data(entity, updated_data)
              # Full reload: save_entity_with_data path not easily determined
              Loader.reload()
              {:ok, "Attached script '#{script_key}' to '#{entity_key}'.", socket}
            end

          _ ->
            {:error, "Entity '#{entity_key}' not found.", socket}
        end

      {:error, :not_found} ->
        {:error, "Script '#{script_key}' not found.", socket}
    end
  end

  def execute(:script_detach, %{script_key: script_key, entity_key: entity_key}, socket) do
    case Loader.get(entity_key) do
      {:ok, entity} ->
        data = entity.data || %{}
        scripts = data["scripts"] || []

        if script_key in scripts do
          updated_data = Map.put(data, "scripts", List.delete(scripts, script_key))
          YamlBuilder.save_entity_with_data(entity, updated_data)
          # Full reload: save_entity_with_data path not easily determined
          Loader.reload()
          {:ok, "Detached script '#{script_key}' from '#{entity_key}'.", socket}
        else
          {:error, "Script '#{script_key}' not attached to '#{entity_key}'.", socket}
        end

      _ ->
        {:error, "Entity '#{entity_key}' not found.", socket}
    end
  end

  # Template system
  defp get_template_list do
    [
      {"patrol", "Patrol Script", "NPC patrols between rooms on a timer"},
      {"greeting", "Greeting Script", "NPC greets players entering the room"},
      {"merchant", "Merchant Script", "NPC opens shop when talked to"},
      {"guard", "Guard Script", "NPC blocks passage without required flag/quest"},
      {"quest_giver", "Quest Giver Script", "NPC gives quest through dialogue"},
      {"ambient", "Ambient Script", "Periodic atmospheric messages"},
      {"trap", "Trap Script", "Triggers effect when player enters room"},
      {"door", "Door Script", "Locked door requiring key item"},
      {"respawn", "Respawn Script", "Entity respawns after being killed/taken"},
      {"on_death", "On Death Script", "Triggers when entity dies"},
      {"on_damage", "On Damage Script", "Triggers when entity takes damage"},
      {"schedule", "Schedule Script", "NPC follows time-based schedule"},
      {"react_item", "React to Item", "NPC reacts when player has specific item"},
      {"weather_react", "Weather React", "Changes behavior based on weather"},
      {"level_gate", "Level Gate", "Blocks low-level players from area"}
    ]
  end

  defp find_template(tpl_id) do
    case Enum.find(get_template_list(), fn {id, _, _} -> id == tpl_id end) do
      nil -> :error
      template -> {:ok, template}
    end
  end

  # Public for use by ToolExecutor
  def generate_from_template_public(key, tpl, config_str),
    do: generate_from_template(key, tpl, config_str)

  defp generate_from_template(key, tpl, config_str) do
    config = parse_config(config_str)

    case tpl do
      "patrol" ->
        route = config["route"] || "room1,room2"
        interval = config["interval"] || "300"

        {:ok,
         """
         key: #{key}
         type: script
         name: "Patrol: #{key}"
         data:
           hook: at_tick
           source: |
             route = #{inspect(String.split(route, ","))}
             interval = #{interval}
             current = get_flag(entity, "patrol_index") || 0
             next = rem(current + 1, length(route))
             target_room = Enum.at(route, next)
             move_entity(entity, target_room)
             set_flag(entity, "patrol_index", next)
             continue()
           timeout_ms: 5000
         """}

      "greeting" ->
        message = config["message"] || "Welcome, traveler!"

        {:ok,
         """
         key: #{key}
         type: script
         name: "Greeting: #{key}"
         data:
           hook: at_enter_room
           source: |
             message(player, "#{YamlBuilder.escape_yaml(message)}")
             continue()
           timeout_ms: 5000
         """}

      "guard" ->
        flag = config["flag"] || "has_pass"
        direction = config["direction"] || "north"

        {:ok,
         """
         key: #{key}
         type: script
         name: "Guard: #{key}"
         data:
           hook: at_exit_room
           source: |
             if context.direction == "#{direction}" and not has_flag?(player, "#{flag}") do
               message(player, "The guard blocks your path.")
               deny()
             else
               continue()
             end
           timeout_ms: 5000
         """}

      "ambient" ->
        messages = config["messages"] || "Wind whispers,Leaves rustle"
        interval = config["interval"] || "60"

        {:ok,
         """
         key: #{key}
         type: script
         name: "Ambient: #{key}"
         data:
           hook: at_tick
           source: |
             messages = #{inspect(String.split(messages, ","))}
             if chance?(1, #{interval}) do
               announce_room(room, pick(messages))
             end
             continue()
           timeout_ms: 5000
         """}

      _ ->
        {:error, "Unknown template '#{tpl}'. Use 'script templates' to see available."}
    end
  end

  defp parse_config(""), do: %{}

  defp parse_config(config_str) do
    config_str
    |> String.split(" ")
    |> Enum.reduce(%{}, fn pair, acc ->
      case String.split(pair, "=", parts: 2) do
        [k, v] -> Map.put(acc, k, v)
        _ -> acc
      end
    end)
  end
end
