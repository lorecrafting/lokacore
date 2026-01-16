defmodule LokaWeb.AdminLive.WorldBuilder.ChatPanel do
  @moduledoc """
  Chat panel component for LLM interaction in World Builder.

  Provides a React-based chat interface for AI assistance with:
  - Context summary (zone, selection, errors)
  - Message history
  - Tool call display
  - Model selector
  - Token/cost tracking
  """
  use Phoenix.Component

  attr :rooms, :list, default: []
  attr :selected_room, :any, default: nil
  attr :validation, :map, default: %{}
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def chat_panel(assigns) do
    ~H"""
    <div class={[
      "world-builder-panel world-builder-chat",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="chat-panel-tabs">
        <button class="console-tab active">AI Chat</button>
        <div style="flex: 1;"></div>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="chat"
          title={if @collapsed, do: "Expand", else: "Collapse"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-up", else: "hero-chevron-down"}
            class="size-4"
          />
        </button>
      </div>

      <div
        id="chat-panel-root"
        class="panel-content chat-panel-content"
        style={if @collapsed, do: "display: none;"}
        phx-hook="ChatPanel"
        data-rooms={Jason.encode!(@rooms)}
        data-selected-room={Jason.encode!(@selected_room)}
        data-validation={Jason.encode!(@validation)}
      >
        <!-- React ChatPanel mounts here -->
      </div>
    </div>
    """
  end

  defp icon(assigns) do
    LokaWeb.CoreComponents.icon(assigns)
  end
end
