defmodule LokaWeb.AdminLive.WorldBuilder.ViewportContainer do
  @moduledoc """
  Center panel 3D viewport component.

  Wraps React Three Fiber canvas with viewport controls.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :rooms, :list, required: true
  attr :selected_room, :string, default: nil
  attr :class, :string, default: ""

  def viewport_container(assigns) do
    ~H"""
    <div class={"world-builder-panel world-builder-viewport #{@class}"}>
      <div class="panel-content" style="padding: 0;">
        <!-- React Three Fiber mounts here via hook -->
        <div
          id="world-builder-canvas"
          phx-hook="WorldBuilder"
          phx-update="ignore"
          class="world-builder-canvas"
          data-rooms={Jason.encode!(@rooms)}
        >
        </div>
        
    <!-- Viewport overlay controls -->
        <div class="viewport-overlay">
          <div class="viewport-mode-buttons">
            <button class="viewport-mode-btn active">Perspective</button>
            <button class="viewport-mode-btn">Top</button>
            <button class="viewport-mode-btn">Front</button>
            <button class="viewport-mode-btn">Side</button>
          </div>

          <div class="viewport-info">
            <span>Rooms: {length(@rooms)}</span>
            <span>Selected: {@selected_room || "None"}</span>
          </div>
        </div>
      </div>
    </div>
    """
  end
end
