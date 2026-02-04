defmodule LokaWeb.AdminLive.RoomsTab do
  @moduledoc """
  Rooms tab component for the admin interface.
  Displays room list, CRUD form, contents view, and exit connections.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [entity_type_badge_class: 1]

  alias Loka.Engine.Entities

  @impl true
  def update(assigns, socket) do
    socket =
      socket
      |> assign(assigns)
      |> assign_new(:viewing_room, fn -> nil end)
      |> assign_new(:connecting_exit, fn -> nil end)
      |> assign_new(:room_contents, fn -> nil end)

    {:ok, socket}
  end

  @impl true
  def render(%{form: nil, viewing_room: nil, connecting_exit: nil} = assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Rooms ({length(@rooms || [])})</h2>
        <button phx-click="new_room" class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Create Room
        </button>
      </div>

      <div :if={@rooms && length(@rooms) > 0} class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Name</th>
              <th scope="col">Contents</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={room <- @rooms} class="hover">
              <td class="font-mono text-sm">{room.key}</td>
              <td>{room.short_desc || "(unnamed)"}</td>
              <td>
                <span class="badge badge-ghost badge-sm">{count_contents(room.id)} entities</span>
              </td>
              <td class="flex gap-2">
                <button
                  phx-click="view_room"
                  phx-value-id={room.id}
                  phx-target={@myself}
                  class="btn btn-ghost btn-xs"
                  aria-label={"View room #{room.key}"}
                >
                  View
                </button>
                <button
                  phx-click="connect_room"
                  phx-value-id={room.id}
                  phx-target={@myself}
                  class="btn btn-ghost btn-xs text-success"
                  aria-label={"Connect exits for room #{room.key}"}
                >
                  Connect
                </button>
                <button
                  phx-click="edit_room"
                  phx-value-id={room.id}
                  class="btn btn-ghost btn-xs"
                  aria-label={"Edit room #{room.key}"}
                >
                  Edit
                </button>
                <button
                  phx-click="delete_room"
                  phx-value-id={room.id}
                  data-confirm="Are you sure you want to delete this room?"
                  class="btn btn-ghost btn-xs text-error"
                  aria-label={"Delete room #{room.key}"}
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
          <p class="opacity-70">
            No rooms created yet. Click "Create Room" to add your first location.
          </p>
        </div>
      </div>
    </div>
    """
  end

  # Room detail view
  def render(%{viewing_room: room} = assigns) when not is_nil(room) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Room: {@viewing_room.short_desc || @viewing_room.key}</h2>
        <button phx-click="close_view" phx-target={@myself} class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Close
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Room Details -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title text-sm">Details</h3>
            <div class="space-y-2 text-sm">
              <div><span class="opacity-70">Key:</span> <code>{@viewing_room.key}</code></div>
              <div>
                <span class="opacity-70">Name:</span> {@viewing_room.short_desc || "(unnamed)"}
              </div>
              <div>
                <span class="opacity-70">ID:</span> <code class="text-xs">{@viewing_room.id}</code>
              </div>
              <div :if={@viewing_room.extra_desc}>
                <span class="opacity-70">Description:</span>
                <p class="mt-1">{@viewing_room.extra_desc}</p>
              </div>
            </div>
          </div>
        </div>
        
    <!-- Exits -->
        <div class="card bg-base-200">
          <div class="card-body">
            <div class="flex justify-between items-center">
              <h3 class="card-title text-sm">Exits</h3>
              <button
                phx-click="connect_room"
                phx-value-id={@viewing_room.id}
                phx-target={@myself}
                class="btn btn-xs btn-primary"
              >
                <.icon name="hero-plus" class="size-3" /> Add Exit
              </button>
            </div>
            <div :if={get_room_exits(@viewing_room.id) == []} class="text-sm opacity-70">
              No exits defined
            </div>
            <div :if={get_room_exits(@viewing_room.id) != []} class="space-y-2">
              <div
                :for={exit <- get_room_exits(@viewing_room.id)}
                class="flex justify-between items-center p-2 bg-base-300 rounded"
              >
                <div>
                  <span class="badge badge-accent badge-sm mr-2">{exit.key}</span>
                  <span class="text-sm">→ {get_destination_name(exit)}</span>
                </div>
                <button
                  phx-click="delete_exit"
                  phx-value-id={exit.id}
                  phx-target={@myself}
                  class="btn btn-ghost btn-xs text-error"
                >
                  <.icon name="hero-trash" class="size-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
    <!-- Contents -->
        <div class="card bg-base-200 lg:col-span-2">
          <div class="card-body">
            <h3 class="card-title text-sm">Contents</h3>
            <div :if={@room_contents == nil or @room_contents == []} class="text-sm opacity-70">
              Room is empty
            </div>
            <div :if={@room_contents && @room_contents != []} class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Key</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  <tr :for={entity <- @room_contents}>
                    <td>
                      <span class={["badge badge-xs", entity_type_badge_class(entity.type)]}>
                        {entity.type}
                      </span>
                    </td>
                    <td class="font-mono text-xs">{entity.key}</td>
                    <td>{entity.short_desc || "(unnamed)"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end

  # Exit connection form
  def render(%{connecting_exit: room} = assigns) when not is_nil(room) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">
          Connect Exit from: {@connecting_exit.short_desc || @connecting_exit.key}
        </h2>
        <button phx-click="cancel_connect" phx-target={@myself} class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <form phx-submit="create_exit" phx-target={@myself} class="space-y-4">
            <input type="hidden" name="from_room_id" value={@connecting_exit.id} />

            <div class="form-control">
              <label class="label">
                <span class="label-text">Direction / Exit Name</span>
              </label>
              <select name="direction" class="select select-bordered" required>
                <option value="">Select direction...</option>
                <option value="north">North</option>
                <option value="south">South</option>
                <option value="east">East</option>
                <option value="west">West</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Destination Room</span>
              </label>
              <select name="to_room_id" class="select select-bordered" required>
                <option value="">Select destination...</option>
                <%= for room <- @rooms, room.id != @connecting_exit.id do %>
                  <option value={room.id}>{room.short_desc || room.key}</option>
                <% end %>
              </select>
            </div>

            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  name="bidirectional"
                  value="true"
                  checked
                  class="checkbox checkbox-sm"
                />
                <span class="label-text">Create return exit (bidirectional)</span>
              </label>
            </div>

            <div class="flex gap-2 justify-end">
              <button
                type="button"
                phx-click="cancel_connect"
                phx-target={@myself}
                class="btn btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                Create Exit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    """
  end

  # Edit/Create form
  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">{if @editing, do: "Edit Room", else: "Create Room"}</h2>
        <button phx-click="cancel_form" class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <.form for={@form} phx-submit="save_room" class="flex flex-col gap-4">
            <.input field={@form[:key]} type="text" label="Key (unique identifier)" required />
            <.input field={@form[:short_desc]} type="text" label="Name" />
            <.input field={@form[:extra_desc]} type="textarea" label="Description" rows="4" />
            <div class="flex justify-end gap-2 mt-6">
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

  @impl true
  def handle_event("view_room", %{"id" => id}, socket) do
    room = Enum.find(socket.assigns.rooms, &(&1.id == id))
    contents = Entities.list_entities(location_id: id)

    {:noreply,
     socket
     |> assign(:viewing_room, room)
     |> assign(:room_contents, contents)}
  end

  def handle_event("close_view", _, socket) do
    {:noreply,
     socket
     |> assign(:viewing_room, nil)
     |> assign(:room_contents, nil)}
  end

  def handle_event("connect_room", %{"id" => id}, socket) do
    room = Enum.find(socket.assigns.rooms, &(&1.id == id))
    {:noreply, assign(socket, :connecting_exit, room)}
  end

  def handle_event("cancel_connect", _, socket) do
    {:noreply, assign(socket, :connecting_exit, nil)}
  end

  def handle_event("create_exit", params, socket) do
    from_room_id = params["from_room_id"]
    to_room_id = params["to_room_id"]
    direction = params["direction"]
    bidirectional = params["bidirectional"] == "true"

    from_room = Enum.find(socket.assigns.rooms, &(&1.id == from_room_id))
    to_room = Enum.find(socket.assigns.rooms, &(&1.id == to_room_id))

    # Create forward exit
    exit_attrs = %{
      type: :exit,
      key: "#{from_room.key}_to_#{to_room.key}_#{direction}",
      short_desc: direction,
      location_id: from_room_id,
      components: %{"exit" => %{"destination_id" => to_room_id, "direction" => direction}}
    }

    case Entities.create_entity(exit_attrs) do
      {:ok, _exit} ->
        # Create return exit if bidirectional
        if bidirectional do
          reverse_direction = reverse_direction(direction)

          reverse_attrs = %{
            type: :exit,
            key: "#{to_room.key}_to_#{from_room.key}_#{reverse_direction}",
            short_desc: reverse_direction,
            location_id: to_room_id,
            components: %{
              "exit" => %{"destination_id" => from_room_id, "direction" => reverse_direction}
            }
          }

          Entities.create_entity(reverse_attrs)
        end

        send(self(), {:put_flash, :info, "Exit created successfully"})
        {:noreply, assign(socket, :connecting_exit, nil)}

      {:error, _changeset} ->
        send(self(), {:put_flash, :error, "Failed to create exit"})
        {:noreply, socket}
    end
  end

  def handle_event("delete_exit", %{"id" => id}, socket) do
    case Entities.get_entity(id) do
      nil ->
        {:noreply, socket}

      exit ->
        Entities.delete_entity(exit)
        # Refresh contents if viewing a room
        if socket.assigns.viewing_room do
          contents = Entities.list_entities(location_id: socket.assigns.viewing_room.id)
          {:noreply, assign(socket, :room_contents, contents)}
        else
          {:noreply, socket}
        end
    end
  end

  # Helper functions
  defp count_contents(room_id) do
    # Use efficient COUNT aggregate instead of loading all entities
    Entities.count_by_location(room_id)
  end

  defp get_room_exits(room_id) do
    Entities.list_entities(type: :exit, location_id: room_id)
  end

  defp get_destination_name(exit) do
    exit_component = exit.components["exit"] || exit.components[:exit] || %{}
    dest_id = exit_component["destination_id"] || exit_component[:destination_id]

    if dest_id do
      case Entities.get_entity(dest_id) do
        nil -> "(unknown)"
        room -> room.short_desc || room.key
      end
    else
      "(no destination)"
    end
  end

  defp reverse_direction("north"), do: "south"
  defp reverse_direction("south"), do: "north"
  defp reverse_direction("east"), do: "west"
  defp reverse_direction("west"), do: "east"
  defp reverse_direction("up"), do: "down"
  defp reverse_direction("down"), do: "up"
  defp reverse_direction(dir), do: "back_from_#{dir}"
end
