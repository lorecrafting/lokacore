defmodule ExmudWeb.GameLive do
  @moduledoc """
  LiveView game client for ExMUD - "Living Ebook" aesthetic.

  A literary, book-like interface with touch/click-based interactions.
  No text input - all interactions via underlined links and menus.
  """
  use ExmudWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      # Subscribe to player-specific events when we have player sessions
      # Phoenix.PubSub.subscribe(Exmud.PubSub, "player:#{player_id}")
    end

    # Sample room data for development
    room = %{
      title: "Under a Giant Oak Tree",
      description: "A serene and rustic space nestled beneath the sprawling branches of a majestic oak. The air is fragrant with the earthy scent of moss and wildflowers, providing a tranquil retreat from the world. Above, the oak's massive limbs cradle a dense canopy, filtering sunlight into dappled patterns that dance across the ground.",
      entities: [
        %{id: "druid-1", name: "druid", short_desc: "in dark green robes hobbles over an altar preparing a ceremony"},
        %{id: "explorer-1", name: "explorer", short_desc: "A grizzled", suffix: "latches onto his canteen full of rum sits here"},
        %{id: "adventurer-1", name: "adventurer", short_desc: "A dark eyed", suffix: "waits here patiently"}
      ],
      items: [
        %{id: "leaf-1", name: "leaf", desc: "has meandered its way to the ground"},
        %{id: "chalice-1", name: "chalice", desc: "A golden", suffix: "sits here on the floor"},
        %{id: "sword-1", name: "sword", desc: "A dusty wooden practice", suffix: "sits here on the ground"}
      ],
      exits: [
        %{direction: "north", destination: "Deep Forest"},
        %{direction: "east", destination: "Village Path"},
        %{direction: "west", destination: "River Bank"}
      ]
    }

    {:ok,
     socket
     |> assign(:room, room)
     |> assign(:context_entity, nil)
     |> assign(:compass_open, false)
     |> assign(:events, sample_events())}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="ebook-page" style="padding-bottom: 5rem;">
      <%= if @context_entity do %>
        <.context_panel
          entity={@context_entity}
          room_title={@room.title}
          compass_open={@compass_open}
          exits={@room.exits}
        />
      <% else %>
        <.room_view
          room={@room}
          events={@events}
          compass_open={@compass_open}
        />
      <% end %>

      <.bottom_bar compass_open={@compass_open} exits={@room.exits} />
    </div>
    """
  end

  # Room View Component
  attr :room, :map, required: true
  attr :events, :list, required: true
  attr :compass_open, :boolean, required: true

  defp room_view(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">{@room.title}</h1>

      <p class="ebook-prose">{@room.description}</p>

      <.entities_section entities={@room.entities} items={@room.items} />

      <.events_section events={@events} />
    </div>
    """
  end

  # Entities Section
  attr :entities, :list, required: true
  attr :items, :list, required: true

  defp entities_section(assigns) do
    ~H"""
    <div class="mt-6">
      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {entity, idx} <- Enum.with_index(@entities) do %>
          <%= if idx > 0 do %> <% end %>
          <%= entity.short_desc %>
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={entity.id}
            phx-value-type="npc"
          ><%= entity.name %></span><%= if entity[:suffix], do: " #{entity.suffix}", else: "" %>.<%= if idx < length(@entities) - 1, do: "" %>
        <% end %>
        <%= if length(@entities) > 3 do %>
          <span class="ebook-more">[...{length(@entities) - 3} more]</span>
        <% end %>
      </p>

      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {item, idx} <- Enum.with_index(@items) do %>
          <%= if idx > 0 do %> <% end %>
          <%= item.desc %>
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={item.id}
            phx-value-type="item"
          ><%= item.name %></span><%= if item[:suffix], do: " #{item.suffix}", else: "" %>.
        <% end %>
      </p>
    </div>
    """
  end

  # Events Section
  attr :events, :list, required: true

  defp events_section(assigns) do
    ~H"""
    <div :if={length(@events) > 0} class="ebook-events">
      <div :for={event <- @events} class="ebook-event">
        {event.text}
      </div>
    </div>
    """
  end

  # Context Panel Component (when entity is clicked)
  attr :entity, :map, required: true
  attr :room_title, :string, required: true
  attr :compass_open, :boolean, required: true
  attr :exits, :list, required: true

  defp context_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title ebook-title--muted">{@room_title}</h1>

      <p class="ebook-prose" style="text-indent: 0;">{@entity.description}</p>

      <ul class="ebook-menu">
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="inspect">
          Inspect
        </li>
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="talk">
          Talk
        </li>
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="trade">
          Trade
        </li>
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="quest">
          Quest
        </li>
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="attack">
          Attack
        </li>
        <li class="ebook-menu-item" phx-click="leave_context">
          Leave
        </li>
      </ul>
    </div>
    """
  end

  # Bottom Bar with Compass
  attr :compass_open, :boolean, required: true
  attr :exits, :list, required: true

  defp bottom_bar(assigns) do
    ~H"""
    <div class="ebook-bottombar">
      <div class="ebook-compass" phx-click="toggle_compass">
        <span class="ebook-compass-icon">⊕</span>

        <div class={"ebook-compass-popup #{if @compass_open, do: "ebook-compass-popup--open", else: ""}"}>
          <%= if length(@exits) > 0 do %>
            <div :for={exit <- @exits}>
              <span
                class="ebook-compass-direction"
                phx-click="navigate"
                phx-value-direction={exit.direction}
              >
                {String.capitalize(exit.direction)} — {exit.destination}
              </span>
            </div>
          <% else %>
            <div class="ebook-compass-direction--disabled">No exits</div>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  # Event Handlers

  @impl true
  def handle_event("click_entity", %{"id" => id, "type" => type}, socket) do
    # Find the entity and show context panel
    entity = find_entity(socket.assigns.room, id, type)

    {:noreply,
     socket
     |> assign(:context_entity, entity)
     |> assign(:compass_open, false)}
  end

  def handle_event("leave_context", _params, socket) do
    {:noreply, assign(socket, :context_entity, nil)}
  end

  def handle_event("menu_action", %{"action" => action}, socket) do
    entity = socket.assigns.context_entity

    # Add event for the action
    event = %{
      text: action_text(action, entity),
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:context_entity, nil)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  def handle_event("toggle_compass", _params, socket) do
    {:noreply, update(socket, :compass_open, &(!&1))}
  end

  def handle_event("navigate", %{"direction" => direction}, socket) do
    # TODO: Integrate with engine for actual room navigation
    event = %{
      text: "You head #{direction}...",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:compass_open, false)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  # Helper Functions

  defp find_entity(room, id, "npc") do
    entity = Enum.find(room.entities, fn e -> e.id == id end)
    if entity do
      %{
        id: entity.id,
        name: entity.name,
        type: :npc,
        description: "A #{entity.name} #{entity.short_desc}, whispering various incantations and mumbling verses of the ancients."
      }
    end
  end

  defp find_entity(room, id, "item") do
    item = Enum.find(room.items, fn i -> i.id == id end)
    if item do
      %{
        id: item.id,
        name: item.name,
        type: :item,
        description: "#{item.desc} #{item.name}. It looks well-worn but still functional."
      }
    end
  end

  defp action_text("inspect", entity), do: "You carefully inspect the #{entity.name}."
  defp action_text("talk", entity), do: "The #{entity.name} nods in acknowledgment."
  defp action_text("trade", entity), do: "The #{entity.name} has nothing to trade."
  defp action_text("quest", entity), do: "The #{entity.name} has no quests for you."
  defp action_text("attack", entity), do: "You ready yourself against the #{entity.name}."
  defp action_text(_, _), do: "Nothing happens."

  defp sample_events do
    [
      %{text: "A druid in dark green robes has arrived from the west.", timestamp: DateTime.utc_now()},
      %{text: "A druid in dark green robes says to you, \"Greetings fellow traveler. How may I assist you?\"", timestamp: DateTime.utc_now()},
      %{text: "A flock of birds take flight with the eastern winds.", timestamp: DateTime.utc_now()}
    ]
  end
end
