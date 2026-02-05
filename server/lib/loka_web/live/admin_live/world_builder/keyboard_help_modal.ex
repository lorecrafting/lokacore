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
      class="modal-overlay z-[1000]"
      phx-click="close_keyboard_help"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
    >
      <div
        class="modal-content max-w-[650px] max-h-[80vh] overflow-hidden flex flex-col"
        phx-click-away="close_keyboard_help"
      >
        <div class="flex items-center justify-between p-4 pb-3 border-b border-wb-border">
          <h3
            id="keyboard-help-title"
            class="m-0 text-wb-text-bright text-base font-semibold flex items-center gap-2"
          >
            <.icon name="hero-command-line" class="size-5" /> Keyboard Shortcuts
          </h3>
          <button
            phx-click="close_keyboard_help"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright absolute right-4 top-4"
          >
            &times;
          </button>
        </div>

        <div class="modal-body flex-1 overflow-y-auto py-4 grid grid-cols-2 gap-5">
          <%= for {category, shortcuts} <- @shortcuts do %>
            <div class="shortcut-category mb-2">
              <h4 class="text-wb-accent text-[13px] font-semibold mb-2 uppercase tracking-wide">
                {category}
              </h4>
              <div class="shortcut-list flex flex-col gap-1.5">
                <%= for {key, description} <- shortcuts do %>
                  <div class="shortcut-row flex justify-between items-center py-1">
                    <kbd class="bg-wb-surface border border-wb-border rounded py-0.5 px-2 font-mono text-xs text-wb-text-bright min-w-[80px] text-center">
                      {key}
                    </kbd>
                    <span class="text-wb-text text-[13px] flex-1 text-right">
                      {description}
                    </span>
                  </div>
                <% end %>
              </div>
            </div>
          <% end %>
        </div>

        <div class="flex gap-2 justify-end pt-3 border-t border-wb-border mt-4">
          <button
            phx-click="close_keyboard_help"
            class="px-5 py-2 border-none rounded cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
    """
  end
end
