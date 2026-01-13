defmodule LokaWeb.AdminLive.PlayersTab do
  @moduledoc """
  Players tab component for the admin interface.
  Displays player list with admin controls.
  """
  use LokaWeb, :live_component

  @impl true
  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Players ({length(@players || [])})</h2>
      </div>

      <div :if={@players && length(@players) > 0} class="admin-table-wrapper">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Admin</th>
              <th scope="col">Confirmed</th>
              <th scope="col">Created</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={player <- @players} class="hover">
              <td>{player.email}</td>
              <td>
                <span class={[
                  "badge",
                  if(player.is_admin, do: "badge-primary", else: "badge-ghost")
                ]}>
                  {if player.is_admin, do: "Admin", else: "Player"}
                </span>
              </td>
              <td>
                <span class={[
                  "badge",
                  if(player.confirmed_at, do: "badge-success", else: "badge-warning")
                ]}>
                  {if player.confirmed_at, do: "Yes", else: "No"}
                </span>
              </td>
              <td>{Calendar.strftime(player.inserted_at, "%Y-%m-%d")}</td>
              <td class="admin-table-actions">
                <button
                  phx-click="toggle_admin"
                  phx-value-id={player.id}
                  class="btn btn-ghost btn-xs"
                  aria-label={
                    if player.is_admin,
                      do: "Revoke admin access for #{player.email}",
                      else: "Grant admin access to #{player.email}"
                  }
                >
                  {if player.is_admin, do: "Revoke Admin", else: "Make Admin"}
                </button>
                <button
                  phx-click="delete_player"
                  phx-value-id={player.id}
                  data-confirm="Are you sure you want to delete this player?"
                  class="btn btn-ghost btn-xs text-error"
                  aria-label={"Delete player #{player.email}"}
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@players == [] or @players == nil} class="card bg-base-200">
        <div class="card-body">
          <p class="admin-empty-text">No players registered yet.</p>
        </div>
      </div>
    </div>
    """
  end
end
