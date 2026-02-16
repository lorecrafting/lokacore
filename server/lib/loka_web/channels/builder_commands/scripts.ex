defmodule LokaWeb.Channels.BuilderCommands.Scripts do
  @moduledoc """
  Script CRUD commands: create, delete, info, list, validate, test,
  templates, from-template, attach, detach.
  """

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Content.Script
  alias LokaWeb.Channels.BuilderCommands.{Helpers, Formatter}

  def execute(:script_create, %{key: key, hook: hook}, socket) do
    case Script.get(key) do
      {:ok, _} ->
        {:error, "Script '#{key}' already exists.", socket}

      {:error, :not_found} ->
        entity =
          Entity.new(
            type: :script,
            key: key,
            short_desc: "Script: #{key}",
            is_prototype: true,
            components: %{
              "data" => %{
                "hook" => hook,
                "source" => "# Script: #{key}\n# Hook: #{hook}\ncontinue.()",
                "timeout_ms" => 5000
              }
            },
            metadata: %{"draft" => true}
          )

        case Entities.save(entity) do
          {:ok, _} ->
            {:ok,
             "Script '#{key}' created (hook: #{hook}).\n" <>
               "  Use /ai to add logic: /ai add patrol behavior to #{key}", socket}

          {:error, reason} ->
            {:error, "Failed to create script: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:delete_script, %{key: key}, socket) do
    case Entities.get_entity_by_key(key) do
      %{type: :script} = schema ->
        case Entities.delete_entity(schema) do
          {:ok, _} ->
            {:ok, "Script '#{key}' deleted.", socket}

          {:error, reason} ->
            {:error, "Failed to delete script: #{inspect(reason)}", socket}
        end

      _ ->
        {:error, "Script '#{key}' not found.", socket}
    end
  end

  def execute(:script_info, %{key: key}, socket) do
    case Script.get(key) do
      {:ok, script} ->
        yaml_text = Helpers.format_entity(script)
        {:ok, "Script '#{key}'#{Helpers.draft_tag(script)}:\n#{yaml_text}", socket}

      {:error, :not_found} ->
        {:error, "Script '#{key}' not found.", socket}
    end
  end

  def execute(:script_list, %{hook: nil}, socket) do
    scripts = Script.all()

    rows =
      Enum.map(scripts, fn s ->
        hook = Script.hook(s) || ""
        [s.key, s.short_desc || s.key, to_string(hook)]
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
        [s.key, s.short_desc || s.key, to_string(Script.hook(s) || "")]
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
        case generate_template_data(key, tpl, config_str) do
          {:ok, name, hook, source} ->
            entity =
              Entity.new(
                type: :script,
                key: key,
                short_desc: name,
                is_prototype: true,
                components: %{
                  "data" => %{
                    "hook" => hook,
                    "source" => source,
                    "timeout_ms" => 5000
                  }
                },
                metadata: %{"draft" => true}
              )

            case Entities.save(entity) do
              {:ok, _} ->
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
        case Entities.find_one(key: entity_key) do
          {:ok, entity} ->
            data = (entity.components || %{})["data"] || %{}
            scripts = data["scripts"] || []

            if script_key in scripts do
              {:error, "Script '#{script_key}' already attached to '#{entity_key}'.", socket}
            else
              updated_data = Map.put(data, "scripts", scripts ++ [script_key])
              updated_components = Map.put(entity.components || %{}, "data", updated_data)
              Entities.update(entity.id, %{components: updated_components})
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
    case Entities.find_one(key: entity_key) do
      {:ok, entity} ->
        data = (entity.components || %{})["data"] || %{}
        scripts = data["scripts"] || []

        if script_key in scripts do
          updated_data = Map.put(data, "scripts", List.delete(scripts, script_key))
          updated_components = Map.put(entity.components || %{}, "data", updated_data)
          Entities.update(entity.id, %{components: updated_components})
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

  @doc """
  Generates structured template data for a script.
  Returns {:ok, name, hook, source} or {:error, reason}.
  Public for use by ToolExecutor.
  """
  def generate_template_data(key, tpl, config_str) do
    config = parse_config(config_str)

    case tpl do
      "patrol" ->
        route = config["route"] || "room1,room2"
        interval = config["interval"] || "300"

        source = """
        route = #{inspect(String.split(route, ","))}
        interval = #{interval}
        current = get_flag.(entity, "patrol_index") || 0
        next = rem(current + 1, length(route))
        target_room = Enum.at(route, next)
        move_entity.(entity, target_room)
        set_flag.(entity, "patrol_index", next)
        continue.()
        """

        {:ok, "Patrol: #{key}", "at_tick", String.trim(source)}

      "greeting" ->
        message = config["message"] || "Welcome, traveler!"

        source = """
        message.("#{escape_yaml_string(message)}")
        continue.()
        """

        {:ok, "Greeting: #{key}", "at_enter_room", String.trim(source)}

      "guard" ->
        flag = config["flag"] || "has_pass"
        direction = config["direction"] || "north"

        source = """
        if context.direction == "#{direction}" and not has_flag?.("#{flag}") do
          message.("The guard blocks your path.")
          deny.()
        else
          continue.()
        end
        """

        {:ok, "Guard: #{key}", "at_exit_room", String.trim(source)}

      "ambient" ->
        messages = config["messages"] || "Wind whispers,Leaves rustle"
        interval = config["interval"] || "60"

        source = """
        messages = #{inspect(String.split(messages, ","))}
        if chance?.(1, #{interval}) do
          announce_room.(room, pick.(messages))
        end
        continue.()
        """

        {:ok, "Ambient: #{key}", "at_tick", String.trim(source)}

      _ ->
        {:error, "Unknown template '#{tpl}'. Use 'script templates' to see available."}
    end
  end

  defp escape_yaml_string(str), do: String.replace(str, "\"", "\\\"")

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
