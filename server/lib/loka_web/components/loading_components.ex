defmodule LokaWeb.LoadingComponents do
  @moduledoc """
  Loading, progress, and empty state components for better UX feedback.

  Uses DaisyUI classes for consistent styling with the rest of the admin UI.

  ## Components

  - `spinner/1` - Inline loading spinner
  - `loading_overlay/1` - Full overlay for panels/modals
  - `progress_bar/1` - Progress indicator for batch operations
  - `empty_state/1` - Empty state with icon, title, description, and action slot
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents, only: [icon: 1]

  @doc """
  Inline spinner for buttons and small areas.

  ## Attributes

  - `:size` - Spinner size: "xs", "sm", "md", "lg" (default: "sm")
  - `:class` - Additional CSS classes

  ## Examples

      <.spinner />
      <.spinner size="lg" />
      <.spinner size="xs" class="mr-2" />
  """
  attr :size, :string, default: "sm"
  attr :class, :string, default: ""

  def spinner(assigns) do
    ~H"""
    <span class={["loading loading-spinner", "loading-#{@size}", @class]} />
    """
  end

  @doc """
  Loading overlay for panels and modals.

  Covers the parent container with a semi-transparent backdrop and centered spinner.

  ## Attributes

  - `:message` - Loading message to display (default: "Loading...")
  - `:class` - Additional CSS classes

  ## Examples

      <.loading_overlay />
      <.loading_overlay message="Saving changes..." />

  Note: Parent container should have `position: relative` for proper positioning.
  """
  attr :message, :string, default: "Loading..."
  attr :class, :string, default: ""

  def loading_overlay(assigns) do
    ~H"""
    <div class={[
      "absolute inset-0 bg-base-300/80 flex items-center justify-center z-50 rounded",
      @class
    ]}>
      <div class="flex flex-col items-center gap-2">
        <span class="loading loading-spinner loading-lg text-primary" />
        <span class="text-sm text-base-content/70">{@message}</span>
      </div>
    </div>
    """
  end

  @doc """
  Progress bar for batch operations.

  Shows current progress with optional label and count.

  ## Attributes

  - `:current` - Current progress value (required)
  - `:total` - Total value (required)
  - `:label` - Optional label text
  - `:class` - Additional CSS classes
  - `:show_percentage` - Show percentage instead of count (default: false)

  ## Examples

      <.progress_bar current={5} total={10} />
      <.progress_bar current={5} total={10} label="Processing files" />
      <.progress_bar current={50} total={100} show_percentage />
  """
  attr :current, :integer, required: true
  attr :total, :integer, required: true
  attr :label, :string, default: nil
  attr :class, :string, default: ""
  attr :show_percentage, :boolean, default: false

  def progress_bar(assigns) do
    percent = if assigns.total > 0, do: round(assigns.current / assigns.total * 100), else: 0
    assigns = assign(assigns, :percent, percent)

    ~H"""
    <div class={["w-full", @class]}>
      <%= if @label do %>
        <div class="flex justify-between mb-1 text-sm">
          <span class="text-base-content/70">{@label}</span>
          <span class="text-base-content/50">
            <%= if @show_percentage do %>
              {@percent}%
            <% else %>
              {@current}/{@total}
            <% end %>
          </span>
        </div>
      <% end %>
      <progress class="progress progress-primary w-full" value={@percent} max="100" />
    </div>
    """
  end

  @doc """
  Empty state component with icon, title, description, and optional action.

  ## Attributes

  - `:icon` - Hero icon name (required), e.g., "hero-user-group"
  - `:title` - Main title text (required)
  - `:description` - Optional description text
  - `:class` - Additional CSS classes

  ## Slots

  - `:action` - Optional action button slot

  ## Examples

      <.empty_state icon="hero-user-group" title="No NPCs" />

      <.empty_state
        icon="hero-document-text"
        title="No quests"
        description="Create your first quest to get started"
      >
        <:action>
          <button class="btn btn-sm btn-primary">Create Quest</button>
        </:action>
      </.empty_state>
  """
  attr :icon, :string, required: true
  attr :title, :string, required: true
  attr :description, :string, default: nil
  attr :class, :string, default: ""
  slot :action

  def empty_state(assigns) do
    ~H"""
    <div class={["flex flex-col items-center justify-center py-8 text-center", @class]}>
      <.icon name={@icon} class="size-12 text-base-content/30 mb-3" />
      <h3 class="text-base font-medium text-base-content/70">{@title}</h3>
      <%= if @description do %>
        <p class="text-sm text-base-content/50 mt-1 max-w-xs">{@description}</p>
      <% end %>
      <%= if @action != [] do %>
        <div class="mt-4">
          {render_slot(@action)}
        </div>
      <% end %>
    </div>
    """
  end

  @doc """
  Button with loading state.

  Automatically shows spinner and disables button when loading.

  ## Attributes

  - `:loading` - Whether button is in loading state (default: false)
  - `:loading_text` - Text to show when loading (default: same as content)
  - `:disabled` - Additional disabled condition (default: false)
  - `:class` - Button classes
  - `:type` - Button type (default: "button")

  All other attributes are passed to the button element.

  ## Examples

      <.loading_button loading={@is_saving}>Save</.loading_button>
      <.loading_button loading={@is_saving} loading_text="Saving...">Save</.loading_button>
  """
  attr :loading, :boolean, default: false
  attr :loading_text, :string, default: nil
  attr :disabled, :boolean, default: false
  attr :class, :string, default: "btn"
  attr :type, :string, default: "button"
  attr :rest, :global
  slot :inner_block, required: true

  def loading_button(assigns) do
    ~H"""
    <button
      type={@type}
      class={@class}
      disabled={@loading || @disabled}
      {@rest}
    >
      <%= if @loading do %>
        <.spinner size="xs" class="mr-2" />
        {if @loading_text, do: @loading_text, else: render_slot(@inner_block)}
      <% else %>
        {render_slot(@inner_block)}
      <% end %>
    </button>
    """
  end
end
