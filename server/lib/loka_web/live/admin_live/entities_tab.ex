defmodule LokaWeb.AdminLive.EntitiesTab do
  @moduledoc """
  Entities tab component for the admin interface.
  Displays entity list and CRUD form.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [entity_type_badge_class: 1]

  @impl true
  def render(%{form: nil} = assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Entities ({length(@entities || [])})</h2>
        <button phx-click="new_entity" class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Create Entity
        </button>
      </div>

      <div :if={@entities && length(@entities) > 0} class="overflow-x-auto">
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
                <span class={["badge", entity_type_badge_class(entity.type)]}>
                  {entity.type}
                </span>
              </td>
              <td class="font-mono text-sm">{entity.key}</td>
              <td>{entity.short_desc || "(unnamed)"}</td>
              <td class="font-mono text-xs">{entity.location_id || "(none)"}</td>
              <td class="flex gap-2">
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
          <p class="opacity-70">
            No entities created yet. Entities include NPCs, items, and other game objects.
          </p>
        </div>
      </div>
    </div>
    """
  end

  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">{if @editing, do: "Edit Entity", else: "Create Entity"}</h2>
        <button phx-click="cancel_form" class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <.form for={@form} phx-submit="save_entity" class="flex flex-col gap-4">
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
            <div class="flex justify-end gap-2 mt-6">
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
end
