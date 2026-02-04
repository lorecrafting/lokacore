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
    <div class={"card bg-base-200 p-4 #{status_border_class(@status)}"}>
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-lg bg-primary/10">
          <.icon name={@icon} class="size-6 text-primary" />
        </div>
        <div>
          <p class="text-2xl font-bold">{@value}</p>
          <p class="text-sm opacity-70">{@title}</p>
        </div>
      </div>
    </div>
    """
  end

  defp status_border_class(:success), do: "border-l-4 border-success"
  defp status_border_class(:warning), do: "border-l-4 border-warning"
  defp status_border_class(:error), do: "border-l-4 border-error"
  defp status_border_class(_), do: ""

  @doc """
  Renders an inspector section header with title and chevron icon.

  Used in the World Builder inspector panel for collapsible section headers.
  Provides consistent styling across all inspector sections.

  ## Attributes

  - `title` (required) - The section title text
  - `count` (optional) - An optional count to display next to the title

  ## Examples

      <.inspector_section title="Identity" />
      <.inspector_section title="Exits" count={3} />
  """
  attr :title, :string, required: true
  attr :count, :integer, default: nil

  def inspector_section(assigns) do
    ~H"""
    <div class="flex items-center justify-between px-3 py-2.5 bg-wb-panel-alt cursor-pointer transition-[background] duration-100 hover:bg-wb-input">
      <span class="text-xs font-semibold text-wb-text">
        {@title}
        <span :if={@count} class="text-wb-text-dim font-normal ml-1">({@count})</span>
      </span>
      <.icon name="hero-chevron-down" class="size-3" />
    </div>
    """
  end

  @doc """
  Renders an entity header bar with icon and name.

  Used at the top of inspector panels to show the selected entity.

  ## Attributes

  - `icon` (required) - Heroicon name (e.g., "hero-cube")
  - `name` (required) - Entity display name

  ## Examples

      <.entity_header icon="hero-cube" name="Town Square" />
      <.entity_header icon="hero-user" name="Guard Captain" />
  """
  attr :icon, :string, required: true
  attr :name, :string, required: true

  def entity_header(assigns) do
    ~H"""
    <div class="flex items-center gap-2 p-3 bg-wb-panel-alt border-b border-wb-panel">
      <.icon name={@icon} class="size-5 text-wb-text-muted" />
      <span class="text-wb-base font-semibold text-wb-text">{@name}</span>
    </div>
    """
  end

  @doc """
  Returns the daisyUI badge class for a given entity type atom.

  Used across admin tabs (Rooms, Entities, Prototypes) for consistent
  color-coding of entity type badges.

  ## Examples

      entity_type_badge_class(:npc)   #=> "badge-primary"
      entity_type_badge_class(:item)  #=> "badge-secondary"
      entity_type_badge_class(:room)  #=> "badge-info"
      entity_type_badge_class(:exit)  #=> "badge-accent"
      entity_type_badge_class(:other) #=> "badge-ghost"
  """
  def entity_type_badge_class(:room), do: "badge-info"
  def entity_type_badge_class(:npc), do: "badge-primary"
  def entity_type_badge_class(:item), do: "badge-secondary"
  def entity_type_badge_class(:exit), do: "badge-accent"
  def entity_type_badge_class(_), do: "badge-ghost"
end
