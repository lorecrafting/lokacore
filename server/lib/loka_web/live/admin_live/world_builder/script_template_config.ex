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
        class="modal-content flex flex-col max-h-[90vh]"
        phx-click-away="close_template_config"
        class="w-[800px] max-w-[95vw]"
      >
        <div class="flex items-center justify-between p-4 border-b border-wb-border">
          <div class="flex items-center gap-2.5">
            <span class="text-[0.8rem] text-wb-text-dim font-mono">{@template.id}</span>
            <h3 class="m-0 text-wb-text-bright text-base font-semibold">{@template.name}</h3>
          </div>
          <button
            phx-click="close_template_config"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
          >
            &times;
          </button>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <div class="flex-1 p-4 overflow-y-auto">
            <div class="mb-6">
              <h4 class="text-[0.85rem] text-wb-text-muted uppercase tracking-[0.5px] m-0 mb-3 pb-2 border-b border-wb-border">
                Script Details
              </h4>
              <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                <label>Script Key</label>
                <input
                  type="text"
                  name="script_key"
                  value={@config["script_key"] || ""}
                  phx-keyup="update_template_config"
                  phx-value-field="script_key"
                  phx-debounce="150"
                  class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                  placeholder="e.g., tavern_entrance_message"
                />
                <small>Unique identifier for this script (snake_case)</small>
              </div>

              <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                <label>Script Name</label>
                <input
                  type="text"
                  name="script_name"
                  value={@config["script_name"] || ""}
                  phx-keyup="update_template_config"
                  phx-value-field="script_name"
                  phx-debounce="150"
                  class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                  placeholder="e.g., Tavern Entrance Message"
                />
              </div>

              <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                <label>Entity Key (optional)</label>
                <input
                  type="text"
                  name="entity_key"
                  value={@config["entity_key"] || ""}
                  phx-keyup="update_template_config"
                  phx-value-field="entity_key"
                  phx-debounce="150"
                  class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                  placeholder="e.g., tavern_main"
                />
                <small>Room or NPC this script attaches to</small>
              </div>
            </div>

            <div class="mb-6">
              <h4 class="text-[0.85rem] text-wb-text-muted uppercase tracking-[0.5px] m-0 mb-3 pb-2 border-b border-wb-border">
                Template Options
              </h4>
              <%= for field <- @template.config_schema do %>
                <.config_field field={field} config={@config} />
              <% end %>
            </div>

            <div
              :if={@validation_errors != []}
              class="bg-wb-danger-surface border border-wb-danger-border rounded-wb-md p-3 mt-4"
            >
              <h4 class="text-wb-error text-[0.85rem] m-0 mb-2 border-none p-0">
                Validation Errors
              </h4>
              <ul class="m-0 pl-4 text-wb-error text-[0.8rem]">
                <%= for error <- @validation_errors do %>
                  <li>{error}</li>
                <% end %>
              </ul>
            </div>
          </div>

          <div class="w-[350px] bg-wb-panel border-l border-wb-border flex flex-col">
            <div class="p-3 bg-wb-input border-b border-wb-border flex justify-between items-center">
              <h4 class="text-[0.85rem] text-wb-text-muted m-0">Generated Code Preview</h4>
              <span class="text-[0.7rem] text-wb-accent font-mono">Hook: {@template.hook}</span>
            </div>
            <div class="flex-1 overflow-auto p-3">
              <pre class="m-0 text-[0.75rem] leading-[1.5] text-wb-text whitespace-pre-wrap break-words"><code class="font-[Monaco,Menlo,Consolas,monospace]">{@preview_code || "# Configure options to see preview"}</code></pre>
            </div>
          </div>
        </div>

        <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
          <button
            phx-click="close_template_config"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
          >
            Cancel
          </button>
          <button
            phx-click="back_to_picker"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright ml-auto mr-2"
          >
            Back
          </button>
          <button
            phx-click="create_script_from_template"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
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
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
      </label>
      <textarea
        name={@field.name}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="200"
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
        rows="2"
        placeholder={@field[:label] || ""}
      >{@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || ""}</textarea>
    </div>
    """
  end

  defp config_field(%{field: %{type: :text_list}} = assigns) do
    ~H"""
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
      </label>
      <textarea
        name={@field.name}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="200"
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
        rows="4"
        placeholder="One message per line"
      >{format_text_list(@config[Atom.to_string(@field.name)] || @config[@field.name] || [])}</textarea>
      <small>Enter one item per line</small>
    </div>
    """
  end

  defp config_field(%{field: %{type: :string}} = assigns) do
    ~H"""
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
      </label>
      <input
        type="text"
        name={@field.name}
        value={@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || ""}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
        placeholder={@field[:label] || ""}
      />
    </div>
    """
  end

  defp config_field(%{field: %{type: :integer}} = assigns) do
    ~H"""
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
      </label>
      <input
        type="number"
        name={@field.name}
        value={@config[Atom.to_string(@field.name)] || @config[@field.name] || @field[:default] || 0}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
      />
    </div>
    """
  end

  defp config_field(%{field: %{type: :float}} = assigns) do
    ~H"""
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
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
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
      />
    </div>
    """
  end

  defp config_field(%{field: %{type: :boolean}, config: config} = assigns) do
    field = assigns.field
    value = config[Atom.to_string(field.name)] || config[field.name] || field[:default] || false

    assigns = assign(assigns, :value, value)

    ~H"""
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name={@field.name}
          checked={@value}
          phx-click="update_template_config_bool"
          phx-value-field={@field.name}
          phx-value-value={!@value}
          class="size-4 cursor-pointer"
        />
        {@field.name |> Atom.to_string() |> format_label()}
      </label>
    </div>
    """
  end

  defp config_field(%{field: %{type: :select}} = assigns) do
    ~H"""
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
      </label>
      <select
        name={@field.name}
        phx-change="update_template_config_select"
        phx-value-field={@field.name}
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
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
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>
        {@field.name |> Atom.to_string() |> format_label()}
        <span :if={@field[:required]} class="text-wb-error ml-0.5">*</span>
      </label>
      <select
        name={@field.name}
        phx-change="update_template_config_select"
        phx-value-field={@field.name}
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
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
    <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
      <label>{@field.name |> Atom.to_string() |> format_label()}</label>
      <input
        type="text"
        name={@field.name}
        value={@config[Atom.to_string(@field.name)] || @config[@field.name] || ""}
        phx-keyup="update_template_config"
        phx-value-field={@field.name}
        phx-debounce="150"
        class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
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
