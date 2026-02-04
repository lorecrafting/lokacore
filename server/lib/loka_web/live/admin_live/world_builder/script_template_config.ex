defmodule LokaWeb.AdminLive.WorldBuilder.ScriptTemplateConfig do
  @moduledoc """
  Template configuration component for World Builder.

  Provides a form to configure template-specific options and preview generated code.
  """
  use Phoenix.Component

  attr :template, :map, required: true
  attr :config, :map, default: %{}
  attr :preview_code, :string, default: ""
  attr :validation_errors, :list, default: []

  def script_template_config(assigns) do
    ~H"""
    <div class="modal-overlay" phx-click="close_template_config">
      <div
        class="modal-content template-config-modal"
        phx-click-away="close_template_config"
        style="width: 800px; max-width: 95vw;"
      >
        <div class="modal-header">
          <div class="template-config-title">
            <span class="template-id">{@template.id}</span>
            <h3>{@template.name}</h3>
          </div>
          <button phx-click="close_template_config" class="modal-close">&times;</button>
        </div>

        <div class="template-config-content">
          <div class="template-config-form">
            <div class="config-section">
              <h4>Script Details</h4>
              <div class="form-group">
                <label>Script Key</label>
                <input
                  type="text"
                  name="script_key"
                  value={@config["script_key"] || ""}
                  phx-keyup="update_template_config"
                  phx-value-field="script_key"
                  phx-debounce="150"
                  class="input"
                  placeholder="e.g., tavern_entrance_message"
                />
                <small>Unique identifier for this script (snake_case)</small>
              </div>

              <div class="form-group">
                <label>Script Name</label>
                <input
                  type="text"
                  name="script_name"
                  value={@config["script_name"] || ""}
                  phx-keyup="update_template_config"
                  phx-value-field="script_name"
                  phx-debounce="150"
                  class="input"
                  placeholder="e.g., Tavern Entrance Message"
                />
              </div>

              <div class="form-group">
                <label>Entity Key (optional)</label>
                <input
                  type="text"
                  name="entity_key"
                  value={@config["entity_key"] || ""}
                  phx-keyup="update_template_config"
                  phx-value-field="entity_key"
                  phx-debounce="150"
                  class="input"
                  placeholder="e.g., tavern_main"
                />
                <small>Room or NPC this script attaches to</small>
              </div>
            </div>

            <div class="config-section">
              <h4>Template Options</h4>
              <%= for field <- @template.config_schema do %>
                <.config_field field={field} config={@config} />
              <% end %>
            </div>

            <div :if={@validation_errors != []} class="config-validation-errors">
              <h4>Validation Errors</h4>
              <ul>
                <%= for error <- @validation_errors do %>
                  <li>{error}</li>
                <% end %>
              </ul>
            </div>
          </div>

          <div class="template-config-preview">
            <div class="preview-header">
              <h4>Generated Code Preview</h4>
              <span class="preview-hook">Hook: {@template.hook}</span>
            </div>
            <div class="preview-code">
              <pre><code>{@preview_code || "# Configure options to see preview"}</code></pre>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button phx-click="close_template_config" class="btn btn-secondary">Cancel</button>
          <button
            phx-click="back_to_picker"
            class="btn btn-secondary"
            style="margin-left: auto; margin-right: 8px;"
          >
            Back
          </button>
          <button
            phx-click="create_script_from_template"
            class="btn btn-primary"
            disabled={
              length(@validation_errors) > 0 || @config["script_key"] == "" ||
                is_nil(@config["script_key"])
            }
          >
            Create Script
          </button>
        </div>
      </div>
    </div>
    """
  end

  # Dynamic field renderer based on schema type
  attr :field, :map, required: true
  attr :config, :map, required: true

  defp config_field(%{field: %{type: :text}} = assigns) do
    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <textarea
        name={@field.name}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="200"
        class="textarea"
        rows="2"
        placeholder={@field[:label] || ""}
      >{@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || ""}</textarea>
    </div>
    """
  end

  defp config_field(%{field: %{type: :text_list}} = assigns) do
    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <textarea
        name={@field.name}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="200"
        class="textarea"
        rows="4"
        placeholder="One message per line"
      >{format_text_list(@config[Atom.to_string(@field.name)] || @config[@field.name] || [])}</textarea>
      <small>Enter one item per line</small>
    </div>
    """
  end

  defp config_field(%{field: %{type: :string}} = assigns) do
    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <input
        type="text"
        name={@field.name}
        value={@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || ""}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="input"
        placeholder={@field[:label] || ""}
      />
    </div>
    """
  end

  defp config_field(%{field: %{type: :integer}} = assigns) do
    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <input
        type="number"
        name={@field.name}
        value={@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || 0}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="input"
      />
    </div>
    """
  end

  defp config_field(%{field: %{type: :float}} = assigns) do
    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <input
        type="number"
        step="0.1"
        name={@field.name}
        value={
          @config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || 0.0
        }
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="input"
      />
    </div>
    """
  end

  defp config_field(%{field: %{type: :boolean}, config: config} = assigns) do
    field = assigns.field
    value = config[Atom.to_string(field.name)] || config[field.name] || field[:default] || false

    assigns = assign(assigns, :value, value)

    ~H"""
    <div class="form-group form-group-checkbox">
      <label class="checkbox-label">
        <input
          type="checkbox"
          name={@field.name}
          checked={@value}
          phx-click="update_template_config_bool"
          phx-value-field={@field.name}
          phx-value-value={!@value}
        />
        {@field.name |> Atom.to_string() |> format_label()}
      </label>
    </div>
    """
  end

  defp config_field(%{field: %{type: :select}} = assigns) do
    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <select
        name={@field.name}
        phx-change="update_template_config_select"
        phx-value-field={@field.name}
        class="input"
      >
        <%= for option <- @field.options do %>
          <option
            value={option}
            selected={
              (@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default]) ==
                option
            }
          >
            {option |> String.replace("_", " ") |> String.capitalize()}
          </option>
        <% end %>
      </select>
    </div>
    """
  end

  defp config_field(%{field: %{type: :direction}} = assigns) do
    directions = [
      "north",
      "south",
      "east",
      "west",
      "up",
      "down",
      "northeast",
      "northwest",
      "southeast",
      "southwest"
    ]

    assigns = assign(assigns, :directions, directions)

    ~H"""
    <div class="form-group">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="required">*</span>
      </label>
      <select
        name={@field.name}
        phx-change="update_template_config_select"
        phx-value-field={@field.name}
        class="input"
      >
        <%= for dir <- @directions do %>
          <option
            value={dir}
            selected={(@config[Atom.to_string(@field.name)] || @config[@field.name]) == dir}
          >
            {String.capitalize(dir)}
          </option>
        <% end %>
      </select>
    </div>
    """
  end

  # Fallback for unknown types
  defp config_field(assigns) do
    ~H"""
    <div class="form-group">
      <label>{@field.name |> Atom.to_string() |> format_label()}</label>
      <input
        type="text"
        name={@field.name}
        value={@config[Atom.to_string(@field.name)] || @config[@field.name] || ""}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="input"
      />
    </div>
    """
  end

  defp format_label(name) when is_binary(name) do
    name
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp format_text_list(list) when is_list(list), do: Enum.join(list, "\n")
  defp format_text_list(_), do: ""
end
