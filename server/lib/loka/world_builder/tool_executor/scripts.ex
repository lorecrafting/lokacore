defmodule Loka.WorldBuilder.ToolExecutor.Scripts do
  @moduledoc false

  alias Loka.Content.Script
  alias Loka.Engine.{Entity, Entities}

  def execute_create_script(input) do
    key = input["key"]
    hook = input["hook"]
    source = input["source"]
    name = input["name"] || "Script: #{key}"

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
        {:ok, %{success: true, message: "Created script '#{key}' (hook: #{hook})"}}

      {:error, reason} ->
        {:error, "Failed to create script: #{inspect(reason)}"}
    end
  end

  def execute_update_script(input) do
    key = input["key"]

    case Script.get(key) do
      {:ok, script} ->
        hook = input["hook"] || Script.hook(script) || "on_enter"
        source = input["source"] || Script.source(script) || "continue.()"
        name = input["name"] || script.short_desc || "Script: #{key}"

        updated_data = %{
          "hook" => hook,
          "source" => source,
          "timeout_ms" => Script.timeout_ms(script) || 5000
        }

        updated_components = Map.put(script.components || %{}, "data", updated_data)

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{
                   short_desc: name,
                   components: updated_components
                 }) do
              {:ok, _} ->
                {:ok, %{success: true, message: "Updated script '#{key}'"}}

              {:error, reason} ->
                {:error, "Failed to update script: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Script not found in DB: #{key}"}
        end

      {:error, :not_found} ->
        {:error, "Script not found: #{key}"}
    end
  end

  def execute_delete_script(input) do
    key = input["key"]

    case Entities.get_entity_by_key(key) do
      %{type: :script} = schema ->
        Entities.delete_entity(schema)
        {:ok, %{success: true, message: "Deleted script '#{key}'"}}

      _ ->
        {:error, "Script not found: #{key}"}
    end
  end

  def execute_get_script(input) do
    key = input["key"]

    case Script.get(key) do
      {:ok, script} ->
        {:ok,
         %{
           success: true,
           script: %{
             key: script.key,
             name: script.short_desc,
             hook: Script.hook(script),
             source: Script.source(script),
             timeout_ms: Script.timeout_ms(script)
           }
         }}

      {:error, :not_found} ->
        {:error, "Script not found: #{key}"}
    end
  end

  def execute_list_scripts(input) do
    scripts =
      if hook = input["hook"] do
        Script.for_hook(String.to_atom(hook))
      else
        Script.all()
      end

    list =
      Enum.map(scripts, fn s ->
        %{key: s.key, name: s.short_desc || s.key, hook: to_string(Script.hook(s) || "")}
      end)

    {:ok, %{success: true, message: "Found #{length(list)} scripts", scripts: list}}
  end

  def execute_validate_script(input) do
    key = input["key"]

    case Script.get(key) do
      {:ok, script} ->
        case Script.validate(script) do
          :ok ->
            {:ok, %{success: true, message: "Script '#{key}' is valid"}}

          {:error, errors} ->
            {:ok, %{success: false, message: "Validation errors", errors: errors}}
        end

      {:error, :not_found} ->
        {:error, "Script not found: #{key}"}
    end
  end

  def execute_create_script_from_template(input) do
    key = input["key"]
    template_id = input["template_id"]
    config = input["config"] || %{}

    config_str =
      config
      |> Enum.map(fn {k, v} -> "#{k}=#{v}" end)
      |> Enum.join(" ")

    case LokaWeb.Channels.BuilderCommands.Scripts.generate_template_data(
           key,
           template_id,
           config_str
         ) do
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
                "timeout_ms" => 5000,
                "template_id" => template_id
              }
            },
            metadata: %{"draft" => true}
          )

        case Entities.save(entity) do
          {:ok, _} ->
            {:ok,
             %{success: true, message: "Created script '#{key}' from template '#{template_id}'"}}

          {:error, reason} ->
            {:error, "Failed to create script: #{inspect(reason)}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def execute_attach_script(input) do
    script_key = input["script_key"]
    entity_key = input["entity_key"]

    case Script.get(script_key) do
      {:ok, _} ->
        case Entities.find_one(key: entity_key) do
          {:ok, entity} ->
            data = (entity.components || %{})["data"] || %{}
            scripts = data["scripts"] || []

            if script_key in scripts do
              {:ok, %{success: true, message: "Script already attached"}}
            else
              updated_data = Map.put(data, "scripts", scripts ++ [script_key])
              updated_components = Map.put(entity.components || %{}, "data", updated_data)

              case Entities.get_entity_by_key(entity_key) do
                %{} = schema ->
                  Entities.update_entity(schema, %{components: updated_components})

                  {:ok,
                   %{
                     success: true,
                     message: "Attached script '#{script_key}' to '#{entity_key}'"
                   }}

                nil ->
                  {:error, "Entity not found in DB: #{entity_key}"}
              end
            end

          _ ->
            {:error, "Entity not found: #{entity_key}"}
        end

      {:error, :not_found} ->
        {:error, "Script not found: #{script_key}"}
    end
  end

  def execute_detach_script(input) do
    script_key = input["script_key"]
    entity_key = input["entity_key"]

    case Entities.find_one(key: entity_key) do
      {:ok, entity} ->
        data = (entity.components || %{})["data"] || %{}
        scripts = data["scripts"] || []

        if script_key in scripts do
          updated_data = Map.put(data, "scripts", List.delete(scripts, script_key))
          updated_components = Map.put(entity.components || %{}, "data", updated_data)

          case Entities.get_entity_by_key(entity_key) do
            %{} = schema ->
              Entities.update_entity(schema, %{components: updated_components})

              {:ok,
               %{
                 success: true,
                 message: "Detached script '#{script_key}' from '#{entity_key}'"
               }}

            nil ->
              {:error, "Entity not found in DB: #{entity_key}"}
          end
        else
          {:error, "Script '#{script_key}' not attached to '#{entity_key}'"}
        end

      _ ->
        {:error, "Entity not found: #{entity_key}"}
    end
  end
end
