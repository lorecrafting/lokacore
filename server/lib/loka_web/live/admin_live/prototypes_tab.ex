defmodule LokaWeb.AdminLive.PrototypesTab do
  @moduledoc """
  Prototypes tab component for the admin interface.
  Displays YAML prototype definitions loaded from priv/world/prototypes/.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [entity_type_badge_class: 1]

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Prototypes ({length(@prototypes || [])})</h2>
        <div class="flex gap-2">
          <select
            phx-change="filter_prototypes"
            phx-target={@myself}
            class="select select-bordered select-sm"
          >
            <option value="all" selected={@filter == :all}>All Types</option>
            <option value="room" selected={@filter == :room}>Rooms</option>
            <option value="npc" selected={@filter == :npc}>NPCs</option>
            <option value="item" selected={@filter == :item}>Items</option>
            <option value="exit" selected={@filter == :exit}>Exits</option>
          </select>
          <label class="label cursor-pointer gap-2">
            <span class="label-text text-sm">Templates only</span>
            <input
              type="checkbox"
              phx-click="toggle_templates_only"
              phx-target={@myself}
              checked={@templates_only}
              class="checkbox checkbox-sm"
            />
          </label>
        </div>
      </div>

      <div :if={@prototypes && length(@prototypes) > 0} class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Key</th>
              <th>Type</th>
              <th>Name</th>
              <th>Parent</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={proto <- @prototypes} class="hover">
              <td class="font-mono text-sm">{proto.key}</td>
              <td>
                <span class={["badge", entity_type_badge_class(proto.type)]}>
                  {proto.type}
                </span>
              </td>
              <td>{proto.name || "(unnamed)"}</td>
              <td class="font-mono text-xs">{proto.parent || "(none)"}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <span :for={tag <- proto.tags || []} class="badge badge-outline badge-xs">
                    {tag}
                  </span>
                </div>
              </td>
              <td class="flex gap-2">
                <button
                  phx-click="view_prototype"
                  phx-value-key={proto.key}
                  phx-target={@myself}
                  class="btn btn-ghost btn-xs"
                >
                  View
                </button>
                <button
                  phx-click="spawn_prototype"
                  phx-value-key={proto.key}
                  class="btn btn-ghost btn-xs text-success"
                >
                  Spawn
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@prototypes == [] or @prototypes == nil} class="card bg-base-200">
        <div class="card-body">
          <p class="opacity-70">
            No prototypes found. Prototypes are defined in priv/world/prototypes/.
          </p>
        </div>
      </div>

      <.prototype_detail_modal :if={@viewing} prototype={@viewing} myself={@myself} />
    </div>
    """
  end

  defp prototype_detail_modal(assigns) do
    ~H"""
    <div class="modal modal-open">
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4">Prototype: {@prototype.key}</h3>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-sm opacity-70">Type:</span>
              <span class={["badge ml-2", entity_type_badge_class(@prototype.type)]}>
                {@prototype.type}
              </span>
            </div>
            <div>
              <span class="text-sm opacity-70">Parent:</span>
              <span class="ml-2 font-mono text-sm">{@prototype.parent || "(none)"}</span>
            </div>
          </div>

          <div>
            <span class="text-sm opacity-70">Name:</span>
            <p class="mt-1">{@prototype.name || "(unnamed)"}</p>
          </div>

          <div :if={@prototype.description}>
            <span class="text-sm opacity-70">Description:</span>
            <p class="mt-1">{@prototype.description}</p>
          </div>

          <div :if={@prototype.tags && length(@prototype.tags) > 0}>
            <span class="text-sm opacity-70">Tags:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span :for={tag <- @prototype.tags} class="badge badge-outline">
                {tag}
              </span>
            </div>
          </div>

          <div :if={@prototype.components && map_size(@prototype.components) > 0}>
            <span class="text-sm opacity-70">Components:</span>
            <div class="mt-2 bg-base-300 rounded-lg p-3">
              <pre class="text-xs overflow-auto"><%= Jason.encode!(@prototype.components, pretty: true) %></pre>
            </div>
          </div>

          <div :if={@prototype.exits && map_size(@prototype.exits) > 0}>
            <span class="text-sm opacity-70">Exits:</span>
            <div class="mt-2 bg-base-300 rounded-lg p-3">
              <pre class="text-xs overflow-auto"><%= Jason.encode!(@prototype.exits, pretty: true) %></pre>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button phx-click="close_prototype_modal" phx-target={@myself} class="btn">
            Close
          </button>
          <button phx-click="spawn_prototype" phx-value-key={@prototype.key} class="btn btn-primary">
            Spawn Entity
          </button>
        </div>
      </div>
      <div class="modal-backdrop" phx-click="close_prototype_modal" phx-target={@myself}></div>
    </div>
    """
  end

  @impl true
  def update(assigns, socket) do
    socket =
      socket
      |> assign(assigns)
      |> assign_new(:filter, fn -> :all end)
      |> assign_new(:templates_only, fn -> false end)
      |> assign_new(:viewing, fn -> nil end)

    {:ok, socket}
  end

  @impl true
  def handle_event("filter_prototypes", %{"value" => type}, socket) do
    filter = if type == "all", do: :all, else: String.to_existing_atom(type)
    {:noreply, assign(socket, :filter, filter)}
  end

  def handle_event("toggle_templates_only", _, socket) do
    {:noreply, assign(socket, :templates_only, !socket.assigns.templates_only)}
  end

  def handle_event("view_prototype", %{"key" => key}, socket) do
    prototype = Enum.find(socket.assigns.prototypes, &(&1.key == key))
    {:noreply, assign(socket, :viewing, prototype)}
  end

  def handle_event("close_prototype_modal", _, socket) do
    {:noreply, assign(socket, :viewing, nil)}
  end
end
