defmodule ExmudWeb.GameLive.Components do
  @moduledoc """
  UI function components for the GameLive "Living Ebook" game client.

  These are extracted from GameLive for better organization and maintainability.
  All components follow the "Living Ebook" aesthetic - literary, book-like interface.
  """
  use Phoenix.Component

  alias Exmud.Framework.Progression
  alias Exmud.Utils.MapHelpers

  # ============================================================================
  # Room View Components
  # ============================================================================

  @doc "Main room view showing room title, description, entities, and events"
  attr :room, :map, required: true
  attr :events, :list, required: true
  attr :compass_open, :boolean, required: true
  attr :other_players, :list, required: true

  def room_view(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">{@room.title}</h1>

      <p class="ebook-prose">{@room.description}</p>

      <.entities_section entities={@room.entities} items={@room.items} />

      <.players_section other_players={@other_players} />

      <.events_section events={@events} />
    </div>
    """
  end

  @doc "Shows other players in the room (clickable)"
  attr :other_players, :list, required: true

  def players_section(assigns) do
    ~H"""
    <div :if={length(@other_players) > 0} class="mt-4">
      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {player, idx} <- Enum.with_index(@other_players) do %>
          <%= if idx > 0 do %>
            {if idx == length(@other_players) - 1, do: " and ", else: ", "}
          <% end %>
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={player.id}
            phx-value-type="player"
          >
            {player.name}
          </span>
        <% end %>
        <%= if length(@other_players) == 1 do %>
          is here.
        <% else %>
          are here.
        <% end %>
      </p>
    </div>
    """
  end

  @doc "Shows entities (NPCs) and items in the room"
  attr :entities, :list, required: true
  attr :items, :list, required: true

  def entities_section(assigns) do
    ~H"""
    <div class="mt-6">
      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {entity, idx} <- Enum.with_index(@entities) do %>
          <%= if idx > 0 do %>
          <% end %>
          {entity.short_desc}
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={entity.id}
            phx-value-type="npc"
          ><%= entity.name %></span>{if entity[:suffix], do: " #{entity.suffix}", else: ""}.{if idx <
                                                                                                  length(
                                                                                                    @entities
                                                                                                  ) -
                                                                                                    1,
                                                                                                do: ""}
        <% end %>
        <%= if length(@entities) > 3 do %>
          <span class="ebook-more">[...{length(@entities) - 3} more]</span>
        <% end %>
      </p>

      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {item, idx} <- Enum.with_index(@items) do %>
          <%= if idx > 0 do %>
          <% end %>
          {item.desc}
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={item.id}
            phx-value-type="item"
          ><%= item.name %></span>{if item[:suffix], do: " #{item.suffix}", else: ""}.
        <% end %>
      </p>
    </div>
    """
  end

  @doc "Shows recent events/messages"
  attr :events, :list, required: true

  def events_section(assigns) do
    ~H"""
    <div :if={length(@events) > 0} class="ebook-events">
      <div :for={event <- @events} class="ebook-event">
        {event.text}
      </div>
    </div>
    """
  end

  # ============================================================================
  # Context Panel (when entity is clicked)
  # ============================================================================

  @doc "Shows entity context menu with available actions"
  attr :entity, :map, required: true
  attr :room_title, :string, required: true
  attr :compass_open, :boolean, required: true
  attr :exits, :list, required: true

  def context_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title ebook-title--muted">{@room_title}</h1>

      <p class="ebook-prose" style="text-indent: 0;">{@entity.description}</p>

      <ul class="ebook-menu">
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="inspect">
          Inspect
        </li>
        <%= if @entity.type == :item do %>
          <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="get">
            Get
          </li>
        <% else %>
          <%= if @entity.type == :player do %>
            <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="attack_player">
              Attack
            </li>
          <% else %>
            <%= if has_component?(@entity, "conversant") do %>
              <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="talk">
                Talk
              </li>
            <% end %>
            <%= if has_component?(@entity, "trader") do %>
              <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="trade">
                Trade
              </li>
            <% end %>
            <%= if has_component?(@entity, "quest_giver") do %>
              <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="quest">
                Quest
              </li>
            <% end %>
            <%= if has_component?(@entity, "combatant") do %>
              <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="attack">
                Attack
              </li>
            <% end %>
          <% end %>
        <% end %>
        <li class="ebook-menu-item" phx-click="leave_context">
          Leave
        </li>
      </ul>
    </div>
    """
  end

  # ============================================================================
  # Inventory Panel
  # ============================================================================

  @doc "Shows player inventory and equipment"
  attr :inventory_items, :list, required: true
  attr :equipped_items, :map, required: true
  attr :stats, :map, required: true
  attr :health, :map, required: true

  def inventory_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">Inventory</h1>

      <div class="mt-4">
        <p class="ebook-prose" style="text-indent: 0; font-style: italic; opacity: 0.7;">
          Health: {@health["current"] || @health[:current] || 100} / {@health["max"] || @health[:max] ||
            100}
        </p>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Equipment</h2>
        <ul class="ebook-menu">
          <.equipment_slot slot="weapon" item={@equipped_items[:weapon] || @equipped_items["weapon"]} />
          <.equipment_slot slot="armor" item={@equipped_items[:armor] || @equipped_items["armor"]} />
          <.equipment_slot
            slot="accessory"
            item={@equipped_items[:accessory] || @equipped_items["accessory"]}
          />
        </ul>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Carried Items</h2>
        <%= if length(@inventory_items) > 0 do %>
          <ul class="ebook-menu">
            <li :for={item <- @inventory_items} class="ebook-menu-item--row">
              <span class="ebook-item-name">{item.name}</span>
              <span class="ebook-item-actions">
                <%= if is_equipable?(item) do %>
                  <span class="ebook-link" phx-click="equip_item" phx-value-id={item.id}>equip</span>
                <% end %>
                <span class="ebook-link" phx-click="drop_item" phx-value-id={item.id}>drop</span>
              </span>
            </li>
          </ul>
        <% else %>
          <p class="ebook-prose" style="text-indent: 0; font-style: italic; opacity: 0.7;">
            Your inventory is empty.
          </p>
        <% end %>
      </div>

      <div class="mt-6">
        <span class="ebook-link" phx-click="toggle_inventory">Close</span>
      </div>
    </div>
    """
  end

  attr :slot, :string, required: true
  attr :item, :map, default: nil

  def equipment_slot(assigns) do
    ~H"""
    <li class="ebook-menu-item--row">
      <span class="ebook-item-name">{String.capitalize(@slot)}:</span>
      <%= if @item do %>
        <span class="ebook-item-actions">
          <span class="ebook-item-equipped">{@item.name}</span>
          <span class="ebook-link" phx-click="unequip_item" phx-value-slot={@slot}>unequip</span>
        </span>
      <% else %>
        <span class="ebook-link--muted">empty</span>
      <% end %>
    </li>
    """
  end

  # ============================================================================
  # Quest Panel
  # ============================================================================

  @doc "Shows active and completed quests"
  attr :active_quests, :list, required: true
  attr :completed_quests, :list, required: true

  def quest_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">Quest Log</h1>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Active Quests</h2>
        <%= if length(@active_quests) > 0 do %>
          <div :for={quest <- @active_quests} class="ebook-quest">
            <p class="ebook-quest-title">
              {quest.name || quest.id}
              <%= if quest.is_complete do %>
                <span class="ebook-tag">[complete]</span>
              <% end %>
            </p>
            <p class="ebook-prose" style="text-indent: 0; font-size: 0.9em; opacity: 0.8;">
              {quest.description}
            </p>
            <ul class="ebook-objectives">
              <li
                :for={obj <- quest.objectives || []}
                class={"ebook-objective #{if obj.completed, do: "ebook-objective--done", else: ""}"}
              >
                <%= if obj.completed do %>
                  ✓
                <% else %>
                  ○
                <% end %>
                {obj.description}
                <%= if obj.target_count > 1 do %>
                  ({obj.progress}/{obj.target_count})
                <% end %>
              </li>
            </ul>
            <%= if quest.is_complete do %>
              <div class="mt-2">
                <span class="ebook-link" phx-click="turn_in_quest" phx-value-id={quest.id}>
                  Turn in quest
                </span>
              </div>
            <% end %>
          </div>
        <% else %>
          <p class="ebook-prose" style="text-indent: 0; font-style: italic; opacity: 0.7;">
            No active quests. Speak with villagers to find adventure.
          </p>
        <% end %>
      </div>

      <%= if length(@completed_quests) > 0 do %>
        <div class="mt-4">
          <h2 class="ebook-subtitle">Completed</h2>
          <p class="ebook-prose" style="text-indent: 0; opacity: 0.7;">
            {length(@completed_quests)} quest(s) completed
          </p>
        </div>
      <% end %>

      <div class="mt-6">
        <span class="ebook-link" phx-click="toggle_quest">Close</span>
      </div>
    </div>
    """
  end

  # ============================================================================
  # Stats Panel
  # ============================================================================

  @doc "Shows player stats, XP, level, skill points"
  attr :game_state, :map, required: true
  attr :health, :map, required: true

  def stats_panel(assigns) do
    progression = Progression.get_progression_stats(assigns.game_state)
    stats = assigns.game_state.stats || %{}
    assigns = assign(assigns, :progression, progression)
    assigns = assign(assigns, :stats, stats)

    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">Character</h1>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Vitals</h2>
        <p class="ebook-prose" style="text-indent: 0;">
          Health: {get_health_current(@health)} / {get_health_max(@health)}
        </p>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Progression</h2>
        <p class="ebook-prose" style="text-indent: 0;">
          Level: {@progression.level}
        </p>
        <p class="ebook-prose" style="text-indent: 0;">
          Experience: {@progression.xp_into_level} / {@progression.xp_needed_for_next} ({@progression.xp_progress_percent}%)
        </p>
        <p class="ebook-prose" style="text-indent: 0;">
          Total XP: {@progression.total_xp}
        </p>
        <p class="ebook-prose" style="text-indent: 0; font-weight: bold;">
          Skill Points: {@progression.skill_points}
        </p>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Attributes</h2>
        <p class="ebook-prose" style="text-indent: 0;">
          Strength: {get_stat(@stats, "str", 10)}
        </p>
        <p class="ebook-prose" style="text-indent: 0;">
          Dexterity: {get_stat(@stats, "dex", 10)}
        </p>
        <p class="ebook-prose" style="text-indent: 0;">
          Stamina: {get_stat(@stats, "sta", 10)}
        </p>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Wealth</h2>
        <p class="ebook-prose" style="text-indent: 0;">
          Gold: {get_stat(@stats, "gold", 0)}
        </p>
      </div>

      <%= if length(@progression.learned_skills) > 0 do %>
        <div class="mt-4">
          <h2 class="ebook-subtitle">Skills</h2>
          <ul class="ebook-menu">
            <li :for={skill <- @progression.learned_skills} class="ebook-menu-item--row">
              {format_skill_name(skill)}
            </li>
          </ul>
        </div>
      <% end %>

      <div class="mt-6">
        <span class="ebook-link" phx-click="toggle_stats">Close</span>
      </div>
    </div>
    """
  end

  # ============================================================================
  # Dialogue Panel
  # ============================================================================

  @doc "Shows NPC dialogue with choices"
  attr :dialogue, :map, required: true
  attr :npc, :map, required: true
  attr :room_title, :string, required: true

  def dialogue_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title ebook-title--muted">{@room_title}</h1>

      <div class="ebook-dialogue">
        <p class="ebook-dialogue-speaker">
          The <span class="ebook-link--static">{@npc.name}</span> says:
        </p>
        <p class="ebook-prose ebook-dialogue-text">
          "{@dialogue.text}"
        </p>
      </div>

      <%= if length(@dialogue.choices) > 0 do %>
        <ul class="ebook-menu">
          <li
            :for={choice <- @dialogue.choices}
            class="ebook-menu-item"
            phx-click="dialogue_choice"
            phx-value-index={choice.index}
          >
            {choice.text}
          </li>
        </ul>
      <% else %>
        <div class="mt-4">
          <span class="ebook-link" phx-click="end_dialogue">Continue</span>
        </div>
      <% end %>
    </div>
    """
  end

  # ============================================================================
  # Combat Panel
  # ============================================================================

  @doc "Shows combat log and actions"
  attr :combat, :map, required: true
  attr :health, :map, required: true
  attr :stats, :map, required: true
  attr :room_title, :string, required: true

  def combat_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">Combat</h1>

      <div
        class="ebook-combat-log"
        style="max-height: 300px; overflow-y: auto; padding: 1rem; border: 1px solid #333; margin-bottom: 1rem; font-family: 'Crimson Text', Georgia, serif;"
      >
        <p
          class="ebook-prose"
          style="text-indent: 0; margin-bottom: 0.75rem; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem;"
        >
          You face the {String.capitalize(@combat.enemy.name)}. [HP: {get_enemy_health_current(
            @combat
          )}/{get_enemy_health_max(@combat)}]
        </p>
        <p class="ebook-prose" style="text-indent: 0; margin-bottom: 0.75rem; opacity: 0.8;">
          Your health: {get_health_current(@health)}/{get_health_max(@health)}
        </p>
        <%= for entry <- @combat.log do %>
          <p class="ebook-prose" style="text-indent: 0; margin-bottom: 0.5rem;">
            {entry.text}
          </p>
        <% end %>
      </div>

      <%= if @combat.player_turn do %>
        <p class="ebook-prose" style="text-indent: 0; font-style: italic; margin-bottom: 1rem;">
          Your turn. Choose your action:
        </p>
        <ul class="ebook-menu">
          <li class="ebook-menu-item" phx-click="combat_action" phx-value-action="attack">
            Attack
          </li>
          <li class="ebook-menu-item" phx-click="combat_action" phx-value-action="defend">
            Defend
          </li>
          <li class="ebook-menu-item" phx-click="combat_action" phx-value-action="flee">
            Flee
          </li>
        </ul>
      <% else %>
        <p class="ebook-prose" style="text-indent: 0; font-style: italic;">
          Enemy's turn...
        </p>
      <% end %>
    </div>
    """
  end

  # ============================================================================
  # Cutscene Panel
  # ============================================================================

  @doc "Shows cutscene with pages of narrative text"
  attr :cutscene, :map, required: true

  def cutscene_panel(assigns) do
    ~H"""
    <div
      class="ebook-context"
      style="min-height: 60vh; display: flex; flex-direction: column; justify-content: center;"
    >
      <div class="ebook-cutscene" style="text-align: center; padding: 2rem;">
        <%= if @cutscene.title do %>
          <h1 class="ebook-title" style="font-size: 2rem; margin-bottom: 2rem; letter-spacing: 0.1em;">
            {@cutscene.title}
          </h1>
        <% end %>

        <div class="ebook-cutscene-text" style="max-width: 500px; margin: 0 auto;">
          <%= for {line, idx} <- Enum.with_index(@cutscene.pages |> Enum.at(@cutscene.current_page, []) |> List.wrap()) do %>
            <p
              class="ebook-prose"
              style={"text-indent: 0; margin-bottom: 1rem; opacity: #{if idx == 0, do: 1, else: 0.9}; font-size: 1.1rem; line-height: 1.8;"}
            >
              {line}
            </p>
          <% end %>
        </div>

        <div class="ebook-cutscene-nav" style="margin-top: 2rem;">
          <%= if @cutscene.current_page < length(@cutscene.pages) - 1 do %>
            <span class="ebook-link" phx-click="cutscene_next" style="font-size: 1.1rem;">
              Continue →
            </span>
          <% else %>
            <span class="ebook-link" phx-click="cutscene_end" style="font-size: 1.1rem;">
              Begin your journey...
            </span>
          <% end %>
        </div>

        <div class="ebook-cutscene-pages" style="margin-top: 1rem; opacity: 0.5; font-size: 0.9rem;">
          {page_indicator(@cutscene.current_page, length(@cutscene.pages))}
        </div>
      </div>
    </div>
    """
  end

  # ============================================================================
  # Bottom Bar
  # ============================================================================

  @doc "Shows bottom navigation bar with compass, inventory, quest log, and chat"
  attr :compass_open, :boolean, required: true
  attr :exits, :list, required: true
  attr :inventory_open, :boolean, required: true
  attr :quest_open, :boolean, required: true
  attr :stats_open, :boolean, required: true
  attr :chat_open, :boolean, required: true

  def bottom_bar(assigns) do
    ~H"""
    <div class="ebook-bottombar">
      <div class="ebook-bottombar-left">
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

      <div class="ebook-bottombar-right">
        <span
          class={"ebook-bottombar-btn #{if @chat_open, do: "ebook-bottombar-btn--active", else: ""}"}
          phx-click="toggle_chat"
          title="Say"
        >
          💬
        </span>
        <span
          class={"ebook-bottombar-btn #{if @stats_open, do: "ebook-bottombar-btn--active", else: ""}"}
          phx-click="toggle_stats"
          title="Character Stats"
        >
          ♦
        </span>
        <span
          class={"ebook-bottombar-btn #{if @quest_open, do: "ebook-bottombar-btn--active", else: ""}"}
          phx-click="toggle_quest"
          title="Quest Log"
        >
          ⚑
        </span>
        <span
          class={"ebook-bottombar-btn #{if @inventory_open, do: "ebook-bottombar-btn--active", else: ""}"}
          phx-click="toggle_inventory"
          title="Inventory"
        >
          ☰
        </span>
      </div>
    </div>
    """
  end

  # ============================================================================
  # Chat Panel
  # ============================================================================

  @doc "Shows chat input for room communication"
  attr :room_title, :string, required: true

  def chat_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title ebook-title--muted">{@room_title}</h1>

      <div class="ebook-chat">
        <p class="ebook-prose" style="text-indent: 0; margin-bottom: 1rem;">
          Say something to others in this room:
        </p>
        <form phx-submit="say" class="ebook-chat-form">
          <input
            type="text"
            name="message"
            placeholder="Type your message..."
            class="ebook-chat-input"
            autocomplete="off"
          />
          <button type="submit" class="ebook-link" style="margin-left: 0.5rem;">Say</button>
        </form>
      </div>

      <div class="mt-4">
        <span class="ebook-link" phx-click="toggle_chat">Close</span>
      </div>
    </div>
    """
  end

  # ============================================================================
  # Helper Functions
  # ============================================================================

  defp get_stat(stats, key, default) do
    MapHelpers.get_flexible(stats, key, default)
  end

  defp format_skill_name(skill_id) do
    skill_id
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp get_health_current(health) do
    MapHelpers.get_flexible(health, :current, 100)
  end

  defp get_health_max(health) do
    MapHelpers.get_flexible(health, :max, 100)
  end

  defp get_enemy_health_current(combat) do
    MapHelpers.get_flexible(combat.enemy.health, :current, 0)
  end

  defp get_enemy_health_max(combat) do
    MapHelpers.get_flexible(combat.enemy.health, :max, 50)
  end

  defp page_indicator(current, total) do
    Enum.map(0..(total - 1), fn i ->
      if i == current, do: "●", else: "○"
    end)
    |> Enum.join(" ")
  end

  @doc "Checks if an item is equipable"
  def is_equipable?(item) do
    components = item[:components] || item.components || %{}
    Map.has_key?(components, "equipable")
  end

  @doc "Checks if an entity has a specific component"
  def has_component?(entity, component_name) do
    components = entity[:components] || %{}
    Map.has_key?(components, component_name)
  end
end
