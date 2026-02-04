defmodule LokaWeb.AdminLive.WorldBuilder.KeyboardHelpModal do
  @moduledoc """
  Modal displaying keyboard shortcuts for World Builder.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  @shortcuts [
    {"General",
     [
       {"Ctrl/Cmd+Z", "Undo"},
       {"Ctrl/Cmd+Shift+Z", "Redo"},
       {"Ctrl/Cmd+S", "Validate All"},
       {"Ctrl/Cmd+G", "Git Commit Modal"},
       {"Escape", "Deselect All"},
       {"?", "Show This Help"}
     ]},
    {"Selection",
     [
       {"Ctrl/Cmd+A", "Select All Rooms"},
       {"Ctrl/Cmd+D", "Duplicate Selected"},
       {"Delete/Backspace", "Delete Selected"},
       {"Click", "Select Room/Entity"},
       {"Shift+Click", "Multi-select"}
     ]},
    {"Navigation",
     [
       {"F", "Fit Viewport to Rooms"},
       {"R", "Reset Camera"},
       {"Z", "Toggle Zone Colors"},
       {"P", "Toggle NPC Patrol Paths"},
       {"Ctrl+Arrow Up/Down", "Change Z-Level"},
       {"/", "Focus Search"}
     ]},
    {"Panels",
     [
       {"1", "Toggle Hierarchy Panel"},
       {"2", "Toggle Inspector Panel"},
       {"3", "Toggle Console Panel"},
       {"4", "Toggle Chat Panel"},
       {"`", "Toggle Console (alternate)"}
     ]},
    {"Creation",
     [
       {"N", "New Room"}
     ]}
  ]

  attr :show, :boolean, default: false

  def keyboard_help_modal(assigns) do
    assigns = assign(assigns, :shortcuts, @shortcuts)

    ~H"""
    <div
      :if={@show}
      class="modal-overlay"
      phx-click="close_keyboard_help"
      style="z-index: 1000;"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
    >
      <div
        class="modal-content"
        phx-click-away="close_keyboard_help"
        style="max-width: 650px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;"
      >
        <div
          class="modal-header"
          style="border-bottom: 1px solid var(--wb-border); padding-bottom: 12px;"
        >
          <h3
            id="keyboard-help-title"
            style="display: flex; align-items: center; gap: 8px; margin: 0;"
          >
            <.icon name="hero-command-line" class="size-5" /> Keyboard Shortcuts
          </h3>
          <button
            phx-click="close_keyboard_help"
            class="modal-close"
            style="position: absolute; right: 16px; top: 16px; background: none; border: none; color: var(--wb-text-muted); font-size: 24px; cursor: pointer;"
          >
            &times;
          </button>
        </div>

        <div
          class="modal-body"
          style="flex: 1; overflow-y: auto; padding: 16px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"
        >
          <%= for {category, shortcuts} <- @shortcuts do %>
            <div class="shortcut-category" style="margin-bottom: 8px;">
              <h4 style="color: var(--wb-accent); font-size: 13px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                {category}
              </h4>
              <div class="shortcut-list" style="display: flex; flex-direction: column; gap: 6px;">
                <%= for {key, description} <- shortcuts do %>
                  <div
                    class="shortcut-row"
                    style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;"
                  >
                    <kbd style="background: var(--wb-surface); border: 1px solid var(--wb-border); border-radius: 4px; padding: 2px 8px; font-family: monospace; font-size: 12px; color: var(--wb-text-bright); min-width: 80px; text-align: center;">
                      {key}
                    </kbd>
                    <span style="color: var(--wb-text); font-size: 13px; flex: 1; text-align: right;">
                      {description}
                    </span>
                  </div>
                <% end %>
              </div>
            </div>
          <% end %>
        </div>

        <div
          class="modal-footer"
          style="border-top: 1px solid var(--wb-border); padding-top: 12px; display: flex; justify-content: flex-end;"
        >
          <button
            phx-click="close_keyboard_help"
            class="btn btn-primary"
            style="background: var(--wb-accent); color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer;"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
    """
  end
end
