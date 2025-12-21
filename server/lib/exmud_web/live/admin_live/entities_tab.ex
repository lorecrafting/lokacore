defmodule ExmudWeb.AdminLive.EntitiesTab do
  @moduledoc """
  Entities tab component for the admin interface.
  Displays entity list and CRUD form.
  """
  use ExmudWeb, :live_component

  @impl true
  def render(%{form: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Entities ({length(@entities || [])})</h2>
        <button phx-click="new_entity" class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Create Entity
        </button>
      </div>

      <div :if={@entities && length(@entities) > 0} class="admin-table-wrapper">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Type</th>
              <th>Key</th>
              <th>Name</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={entity <- @entities} class="hover">
              <td>
                <span class={["badge", entity_type_badge(entity.type)]}>
                  {entity.type}
                </span>
              </td>
              <td class="admin-table-cell-mono">{entity.key}</td>
              <td>{entity.name || "(unnamed)"}</td>
              <td class="admin-table-cell-mono-xs">{entity.location_id || "(none)"}</td>
              <td class="admin-table-actions">
                <button phx-click="edit_entity" phx-value-id={entity.id} class="btn btn-ghost btn-xs">
                  Edit
                </button>
                <button
                  phx-click="delete_entity"
                  phx-value-id={entity.id}
                  data-confirm="Are you sure you want to delete this entity?"
                  class="btn btn-ghost btn-xs text-error"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@entities == [] or @entities == nil} class="card bg-base-200">
        <div class="card-body">
          <p class="admin-empty-text">
            No entities created yet. Entities include NPCs, items, and other game objects.
          </p>
        </div>
      </div>
    </div>
    """
  end

  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">{if @editing, do: "Edit Entity", else: "Create Entity"}</h2>
        <button phx-click="cancel_form" class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <.form for={@form} phx-submit="save_entity" class="admin-form">
            <.input
              field={@form[:type]}
              type="select"
              label="Type"
              options={[{"NPC", :npc}, {"Item", :item}, {"Exit", :exit}]}
              required
            />
            <.input field={@form[:key]} type="text" label="Key (unique identifier)" required />
            <.input field={@form[:name]} type="text" label="Name" />
            <.input field={@form[:description]} type="textarea" label="Description" rows="3" />
            <.input field={@form[:location_id]} type="text" label="Location ID (room UUID)" />
            <div class="admin-form-actions">
              <button type="button" phx-click="cancel_form" class="btn btn-ghost">Cancel</button>
              <button type="submit" class="btn btn-primary">
                {if @editing, do: "Update Entity", else: "Create Entity"}
              </button>
            </div>
          </.form>
        </div>
      </div>
    </div>
    """
  end

  defp entity_type_badge(:npc), do: "badge-primary"
  defp entity_type_badge(:item), do: "badge-secondary"
  defp entity_type_badge(:exit), do: "badge-accent"
  defp entity_type_badge(_), do: "badge-ghost"
end
