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
      <div
        class="modal-content flex flex-col w-[900px] max-w-[95vw] max-h-[85vh]"
        phx-click-away="close_template_picker"
      >
        <div class="flex items-center justify-between p-4 border-b border-wb-border">
          <h3 class="m-0 text-wb-text-bright text-base font-semibold">Choose a Script Template</h3>
          <button
            phx-click="close_template_picker"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
          >
            &times;
          </button>
        </div>

        <div class="flex-1 overflow-hidden flex flex-col">
          <div class="px-4 py-3 bg-wb-input border-b border-wb-border">
            <div class="mb-3">
              <input
                type="text"
                placeholder="Search templates..."
                value={@search}
                phx-keyup="template_search"
                phx-debounce="150"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
              />
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button
                class={[
                  "px-2.5 py-1 text-[0.75rem] border-none rounded-xl cursor-pointer transition-all duration-150",
                  if(is_nil(@selected_category),
                    do: "bg-wb-accent text-white",
                    else:
                      "bg-wb-border text-wb-text-muted hover:bg-wb-border-light hover:text-wb-text"
                  )
                ]}
                phx-click="filter_category"
                phx-value-category=""
              >
                All
              </button>
              <%= for category <- @categories do %>
                <button
                  class={[
                    "px-2.5 py-1 text-[0.75rem] border-none rounded-xl cursor-pointer transition-all duration-150",
                    if(@selected_category == category,
                      do: "bg-wb-accent text-white",
                      else:
                        "bg-wb-border text-wb-text-muted hover:bg-wb-border-light hover:text-wb-text"
                    )
                  ]}
                  phx-click="filter_category"
                  phx-value-category={category}
                >
                  {format_category(category)}
                </button>
              <% end %>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div :if={Enum.empty?(@filtered_templates)} class="text-center text-wb-text-dim p-8">
              <p>No templates match your search.</p>
            </div>
            <%= for {category, templates} <- @grouped_templates do %>
              <div class="mb-6">
                <h4 class="text-[0.85rem] text-wb-text-muted uppercase tracking-[0.5px] m-0 mb-3 pb-2 border-b border-wb-border">
                  {format_category(category)}
                </h4>
                <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                  <%= for template <- templates do %>
                    <div
                      class="bg-wb-input border border-wb-border border-l-4 border-l-wb-accent rounded-wb-md p-3 cursor-pointer transition-all duration-150 hover:bg-wb-panel-header hover:border-wb-border-light hover:-translate-y-0.5"
                      phx-click="select_template"
                      phx-value-id={template.id}
                      style={"border-left-color: #{category_color(category)}"}
                    >
                      <div class="flex justify-between items-center mb-2">
                        <span class="text-[0.7rem] font-mono text-wb-text-faint">{template.id}</span>
                        <span
                          class="text-[0.65rem] px-1.5 py-0.5 rounded-wb-lg text-white font-semibold uppercase"
                          style={"background-color: #{category_color(category)}"}
                        >
                          {format_hook(template.hook)}
                        </span>
                      </div>
                      <h5 class="text-[0.85rem] font-semibold text-wb-text m-0 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        {template.name}
                      </h5>
                      <p class="text-[0.75rem] text-wb-text-dim m-0 leading-[1.4]">
                        {template.description}
                      </p>
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
