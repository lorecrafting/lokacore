defmodule LokaWeb.AdminLive.WorldBuilder.ScriptTemplateEventHandler do
  @moduledoc """
  Event handlers for script template picker and configuration in World Builder.

  Extracted from WorldBuilderLive to reduce file size and improve maintainability.
  Handles template browsing, selection, configuration, preview, and script creation.
  """

  import Phoenix.Component, only: [assign: 3]

  alias Loka.WorldBuilder.{ScriptManager, ScriptTemplates}

  def handle_event("show_template_picker", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_picker, true)
     |> assign(:template_search, "")
     |> assign(:template_category, nil)}
  end

  def handle_event("close_template_picker", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_picker, false)
     |> assign(:template_search, "")
     |> assign(:template_category, nil)}
  end

  def handle_event("template_search", %{"value" => search}, socket) do
    {:noreply, assign(socket, :template_search, search)}
  end

  def handle_event("filter_category", %{"category" => ""}, socket) do
    {:noreply, assign(socket, :template_category, nil)}
  end

  def handle_event("filter_category", %{"category" => category}, socket) do
    category_atom = String.to_existing_atom(category)
    {:noreply, assign(socket, :template_category, category_atom)}
  rescue
    ArgumentError -> {:noreply, socket}
  end

  def handle_event("select_template", %{"id" => template_id}, socket) do
    case ScriptTemplates.get_template(template_id) do
      {:ok, template} ->
        initial_config =
          template.config_schema
          |> Enum.map(fn field ->
            {Atom.to_string(field.name), Map.get(field, :default)}
          end)
          |> Map.new()

        preview_code =
          case ScriptTemplates.generate_code(template_id, initial_config) do
            {:ok, code} -> code
            {:error, _} -> "# Configure required fields to see preview"
          end

        {:noreply,
         socket
         |> assign(:show_template_picker, false)
         |> assign(:show_template_config, true)
         |> assign(:selected_template, template)
         |> assign(:template_config, initial_config)
         |> assign(:template_preview_code, preview_code)
         |> assign(:template_validation_errors, [])}

      {:error, _} ->
        {:noreply, log_console(socket, :error, "Template not found: #{template_id}")}
    end
  end

  def handle_event("close_template_config", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_config, false)
     |> assign(:selected_template, nil)
     |> assign(:template_config, %{})
     |> assign(:template_preview_code, "")
     |> assign(:template_validation_errors, [])}
  end

  def handle_event("back_to_picker", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_config, false)
     |> assign(:show_template_picker, true)
     |> assign(:selected_template, nil)
     |> assign(:template_config, %{})
     |> assign(:template_preview_code, "")
     |> assign(:template_validation_errors, [])}
  end

  def handle_event("update_template_config", %{"field" => field, "value" => value}, socket) do
    update_template_config(socket, field, value)
  end

  def handle_event("update_template_config_bool", %{"field" => field, "value" => value}, socket) do
    bool_value = value == "true"
    update_template_config(socket, field, bool_value)
  end

  def handle_event("update_template_config_select", %{"field" => field, "value" => value}, socket) do
    update_template_config(socket, field, value)
  end

  def handle_event("create_script_from_template", _params, socket) do
    template = socket.assigns.selected_template
    config = socket.assigns.template_config

    script_key = config["script_key"]
    script_name = config["script_name"] || script_key
    entity_key = config["entity_key"]

    case ScriptTemplates.generate_code(template.id, config) do
      {:ok, source_code} ->
        attrs = %{
          key: script_key,
          name: script_name,
          description: "Generated from template #{template.id}: #{template.name}",
          hook: template.hook,
          source: source_code,
          tags: [Atom.to_string(template.category), "template:#{template.id}"],
          entity_key: entity_key
        }

        case ScriptManager.create_script(attrs) do
          {:ok, script} ->
            {:noreply,
             socket
             |> assign(:show_template_config, false)
             |> assign(:selected_template, nil)
             |> assign(:template_config, %{})
             |> assign(:template_preview_code, "")
             |> assign(:template_validation_errors, [])
             |> log_console(:info, "Created script '#{script.key}' from template #{template.id}")}

          {:error, :already_exists} ->
            {:noreply,
             assign(socket, :template_validation_errors, [
               "Script key '#{script_key}' already exists"
             ])}

          {:error, errors} when is_list(errors) ->
            {:noreply, assign(socket, :template_validation_errors, errors)}

          {:error, reason} ->
            {:noreply,
             assign(socket, :template_validation_errors, [
               "Failed to create script: #{inspect(reason)}"
             ])}
        end

      {:error, {:validation_failed, errors}} ->
        {:noreply, assign(socket, :template_validation_errors, errors)}

      {:error, reason} ->
        {:noreply,
         assign(socket, :template_validation_errors, [
           "Failed to generate code: #{inspect(reason)}"
         ])}
    end
  end

  defp update_template_config(socket, field, value) do
    template = socket.assigns.selected_template
    config = Map.put(socket.assigns.template_config, field, value)

    {preview_code, validation_errors} =
      case ScriptTemplates.generate_code(template.id, config) do
        {:ok, code} ->
          {code, []}

        {:error, {:validation_failed, errors}} ->
          {"# Fix validation errors to see preview", errors}

        {:error, _} ->
          {"# Configure required fields to see preview", []}
      end

    {:noreply,
     socket
     |> assign(:template_config, config)
     |> assign(:template_preview_code, preview_code)
     |> assign(:template_validation_errors, validation_errors)}
  end

  defp log_console(socket, level, text) do
    message = %{timestamp: DateTime.utc_now(), level: level, text: text}
    assign(socket, :console_messages, socket.assigns.console_messages ++ [message])
  end
end
