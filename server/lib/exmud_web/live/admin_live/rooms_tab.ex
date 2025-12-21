defmodule ExmudWeb.AdminLive.RoomsTab do
  @moduledoc """
  Rooms tab component for the admin interface.
  Displays room list and CRUD form.
  """
  use ExmudWeb, :live_component

  @impl true
  def render(%{form: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Rooms ({length(@rooms || [])})</h2>
        <button phx-click="new_room" class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Create Room
        </button>
      </div>

      <div :if={@rooms && length(@rooms) > 0} class="admin-table-wrapper">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={room <- @rooms} class="hover">
              <td class="admin-table-cell-mono">{room.key}</td>
              <td>{room.name || "(unnamed)"}</td>
              <td class="admin-table-cell-truncate">{room.description || "(no description)"}</td>
              <td class="admin-table-actions">
                <button phx-click="edit_room" phx-value-id={room.id} class="btn btn-ghost btn-xs">
                  Edit
                </button>
                <button
                  phx-click="delete_room"
                  phx-value-id={room.id}
                  data-confirm="Are you sure you want to delete this room?"
                  class="btn btn-ghost btn-xs text-error"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@rooms == [] or @rooms == nil} class="card bg-base-200">
        <div class="card-body">
          <p class="admin-empty-text">
            No rooms created yet. Click "Create Room" to add your first location.
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
        <h2 class="admin-section-title">{if @editing, do: "Edit Room", else: "Create Room"}</h2>
        <button phx-click="cancel_form" class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <.form for={@form} phx-submit="save_room" class="admin-form">
            <.input field={@form[:key]} type="text" label="Key (unique identifier)" required />
            <.input field={@form[:name]} type="text" label="Name" />
            <.input field={@form[:description]} type="textarea" label="Description" rows="4" />
            <div class="admin-form-actions">
              <button type="button" phx-click="cancel_form" class="btn btn-ghost">Cancel</button>
              <button type="submit" class="btn btn-primary">
                {if @editing, do: "Update Room", else: "Create Room"}
              </button>
            </div>
          </.form>
        </div>
      </div>
    </div>
    """
  end
end
