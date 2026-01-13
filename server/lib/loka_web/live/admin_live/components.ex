defmodule LokaWeb.AdminLive.Components do
  @moduledoc """
  Shared UI components for AdminLive tabs.

  This module provides reusable components used across multiple admin tabs
  to ensure consistent styling and reduce duplication.

  ## Usage

      defmodule LokaWeb.AdminLive.MyTab do
        use LokaWeb, :live_component

        import LokaWeb.AdminLive.Components

        def render(assigns) do
          ~H\"\"\"
          <.stat_card title="Count" value={42} icon="hero-chart-bar" />
          <.stat_card title="Status" value="OK" icon="hero-check" status={:success} />
          \"\"\"
        end
      end
  """

  use Phoenix.Component

  import LokaWeb.CoreComponents, only: [icon: 1]

  @doc """
  Renders a statistics card with title, value, and icon.

  ## Attributes

  - `title` (required) - The label for the statistic
  - `value` (required) - The value to display
  - `icon` (required) - Heroicon name (e.g., "hero-users")
  - `status` (optional) - Status indicator (:neutral, :success, :warning, :error)
    Defaults to :neutral which shows no border.

  ## Examples

      <.stat_card title="Total Users" value={1234} icon="hero-users" />
      <.stat_card title="Status" value="Healthy" icon="hero-check" status={:success} />
      <.stat_card title="Errors" value={5} icon="hero-exclamation" status={:error} />
  """
  attr :title, :string, required: true
  attr :value, :any, required: true
  attr :icon, :string, required: true
  attr :status, :atom, default: :neutral

  def stat_card(assigns) do
    ~H"""
    <div class={"admin-stat-card #{status_border_class(@status)}"}>
      <div class="admin-stat-content">
        <div class="admin-stat-icon-wrapper">
          <div class="admin-stat-icon">
            <.icon name={@icon} class="size-6 text-primary" />
          </div>
          <div>
            <p class="admin-stat-value">{@value}</p>
            <p class="admin-stat-label">{@title}</p>
          </div>
        </div>
      </div>
    </div>
    """
  end

  defp status_border_class(:success), do: "border-l-4 border-success"
  defp status_border_class(:warning), do: "border-l-4 border-warning"
  defp status_border_class(:error), do: "border-l-4 border-error"
  defp status_border_class(_), do: ""
end
