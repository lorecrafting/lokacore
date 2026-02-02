defmodule LokaWeb.AdminLive.WorldBuilder.ProjectsPanel do
  @moduledoc """
  Projects panel component for the World Builder.

  Shows list of projects and their documents.
  Supports viewing and selecting project documents.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :projects, :list, default: []
  attr :current_project, :map, default: nil
  attr :project_docs, :map, default: %{}
  attr :expanded_projects, :map, default: %{}
  attr :selected_document, :map, default: nil
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def projects_panel(assigns) do
    ~H"""
    <div class={[
      "world-builder-panel world-builder-projects",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="panel-tabs">
        <button class="panel-tab active">
          <.icon name="hero-folder" class="size-4" />
          <span :if={!@collapsed}>Projects</span>
        </button>
        <div style="flex: 1;"></div>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="projects"
          title={if @collapsed, do: "Expand", else: "Collapse"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-right", else: "hero-chevron-left"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content" style={if @collapsed, do: "display: none;"}>
        <div class="projects-header">
          <button
            class="btn btn-sm btn-ghost"
            phx-click="new_project_modal"
            title="New Project"
          >
            <.icon name="hero-plus" class="size-4" />
            <span>New</span>
          </button>
          <button
            class="btn btn-sm btn-ghost"
            phx-click="refresh_projects"
            title="Refresh"
          >
            <.icon name="hero-arrow-path" class="size-4" />
          </button>
        </div>

        <div class="projects-list">
          <%= if @projects == [] do %>
            <div class="empty-state">
              <p class="text-sm text-gray-500">No projects yet</p>
              <p class="text-xs text-gray-600 mt-2">
                Ask the AI to create a project, or click New above
              </p>
            </div>
          <% else %>
            <%= for project_key <- @projects do %>
              <.project_item
                project_key={project_key}
                is_current={@current_project && @current_project.key == project_key}
                is_expanded={Map.get(@expanded_projects, project_key, false)}
                docs={Map.get(@project_docs, project_key, [])}
                selected_doc={@selected_document}
              />
            <% end %>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  attr :project_key, :string, required: true
  attr :is_current, :boolean, default: false
  attr :is_expanded, :boolean, default: false
  attr :docs, :list, default: []
  attr :selected_doc, :map, default: nil

  defp project_item(assigns) do
    ~H"""
    <div class={["project-item", @is_current && "active"]}>
      <div
        class="project-header"
        phx-click="select_project"
        phx-value-key={@project_key}
      >
        <span class="project-expand">
          {if @is_expanded, do: "▼", else: "▶"}
        </span>
        <.icon name="hero-folder" class="size-4 text-yellow-500" />
        <span class="project-name">{@project_key}</span>
      </div>

      <div :if={@is_expanded} class="project-documents">
        <%= if @docs == [] do %>
          <div class="docs-empty text-xs text-gray-500 pl-6">No documents</div>
        <% else %>
          <%= for doc <- @docs do %>
            <div
              class={[
                "document-item",
                @selected_doc && @selected_doc.filename == doc.filename &&
                  @selected_doc.project_key == @project_key && "active"
              ]}
              phx-click="select_document"
              phx-value-project={@project_key}
              phx-value-filename={doc.filename}
            >
              <span class="doc-icon">{doc_icon(doc.doc_type)}</span>
              <span class="doc-name">{doc.filename}</span>
              <span class="doc-version">v{doc.version}</span>
            </div>
          <% end %>
        <% end %>
      </div>
    </div>
    """
  end

  defp doc_icon("design"), do: "📄"
  defp doc_icon("planning"), do: "📋"
  defp doc_icon("notes"), do: "📝"
  defp doc_icon(_), do: "📄"
end
