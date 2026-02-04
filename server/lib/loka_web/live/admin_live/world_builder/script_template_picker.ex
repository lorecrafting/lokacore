defmodule LokaWeb.AdminLive.WorldBuilder.ScriptTemplatePicker do
  @moduledoc """
  Template picker component for selecting script templates.

  Displays a searchable grid of template cards organized by category.
  """
  use Phoenix.Component

  alias Loka.WorldBuilder.ScriptTemplates

  attr :search, :string, default: ""
  attr :selected_category, :atom, default: nil

  def script_template_picker(assigns) do
    templates = ScriptTemplates.list_templates()
    categories = ScriptTemplates.categories()

    # Filter by search and category
    filtered_templates =
      templates
      |> filter_by_search(assigns.search)
      |> filter_by_category(assigns.selected_category)

    # Group by category for display
    grouped_templates = Enum.group_by(filtered_templates, & &1.category)

    assigns =
      assigns
      |> assign(:templates, templates)
      |> assign(:categories, categories)
      |> assign(:grouped_templates, grouped_templates)
      |> assign(:filtered_templates, filtered_templates)

    ~H"""
    <div class="modal-overlay" phx-click="close_template_picker">
      <div class="modal-content template-picker-modal" phx-click-away="close_template_picker">
        <div class="modal-header">
          <h3>Choose a Script Template</h3>
          <button phx-click="close_template_picker" class="modal-close">&times;</button>
        </div>

        <div class="template-picker-content">
          <div class="template-picker-filters">
            <div class="search-box">
              <input
                type="text"
                placeholder="Search templates..."
                value={@search}
                phx-keyup="template_search"
                phx-debounce="150"
                class="input"
              />
            </div>

            <div class="category-filters">
              <button
                class={"category-btn #{if is_nil(@selected_category), do: "active"}"}
                phx-click="filter_category"
                phx-value-category=""
              >
                All
              </button>
              <%= for category <- @categories do %>
                <button
                  class={"category-btn #{if @selected_category == category, do: "active"}"}
                  phx-click="filter_category"
                  phx-value-category={category}
                >
                  {format_category(category)}
                </button>
              <% end %>
            </div>
          </div>

          <div class="template-grid">
            <div :if={Enum.empty?(@filtered_templates)} class="template-empty">
              <p>No templates match your search.</p>
            </div>
            <%= for {category, templates} <- @grouped_templates do %>
              <div class="template-category-section">
                <h4 class="category-header">{format_category(category)}</h4>
                <div class="template-cards">
                  <%= for template <- templates do %>
                    <div
                      class="template-card"
                      phx-click="select_template"
                      phx-value-id={template.id}
                      style={"border-left-color: #{category_color(category)}"}
                    >
                      <div class="template-card-header">
                        <span class="template-id">{template.id}</span>
                        <span
                          class="template-hook"
                          style={"background-color: #{category_color(category)}"}
                        >
                          {format_hook(template.hook)}
                        </span>
                      </div>
                      <h5 class="template-name">{template.name}</h5>
                      <p class="template-description">{template.description}</p>
                    </div>
                  <% end %>
                </div>
              </div>
            <% end %>
          </div>
        </div>
      </div>
    </div>
    """
  end

  defp filter_by_search(templates, nil), do: templates
  defp filter_by_search(templates, ""), do: templates

  defp filter_by_search(templates, search) do
    search_lower = String.downcase(search)

    Enum.filter(templates, fn t ->
      String.contains?(String.downcase(t.name), search_lower) ||
        String.contains?(String.downcase(t.description), search_lower) ||
        String.contains?(String.downcase(t.id), search_lower)
    end)
  end

  defp filter_by_category(templates, nil), do: templates

  defp filter_by_category(templates, category) do
    Enum.filter(templates, &(&1.category == category))
  end

  defp format_category(category) do
    category
    |> Atom.to_string()
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp format_hook(hook) when is_atom(hook) do
    hook
    |> Atom.to_string()
    |> String.replace("_", " ")
  end

  defp format_hook(hook), do: hook

  defp category_color(:messages), do: "var(--wb-accent)"
  defp category_color(:navigation), do: "var(--wb-quest-pass)"
  defp category_color(:spawning), do: "var(--wb-quest-pass-alt)"
  defp category_color(:rewards), do: "var(--wb-quest-objective)"
  defp category_color(:dialogue), do: "var(--wb-quest-fail)"
  defp category_color(:traps), do: "var(--wb-error)"
  defp category_color(:atmosphere), do: "var(--wb-quest-special)"
  defp category_color(:quests), do: "var(--wb-info)"
  defp category_color(:npcs), do: "var(--wb-warning)"
  defp category_color(:death), do: "var(--wb-text-muted)"
  defp category_color(_), do: "var(--wb-accent)"
end
