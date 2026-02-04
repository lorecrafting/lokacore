defmodule LokaWeb.AdminLive.WorldBuilder.ChatPanel do
  @moduledoc """
  LiveView chat panel component for the World Builder.

  Provides a pure LiveView chat interface to Claude for world building tasks.
  Streams responses and executes tools server-side.

  ## Usage

  In your LiveView, add these assigns:
  - :chat_messages - list of message maps
  - :chat_streaming - boolean for streaming state
  - :chat_current_response - string accumulating streaming text
  - :current_project - map with :key for project context
  - :chat_error - error string or nil

  And handle these events:
  - send_message - when user submits a message
  - textarea_keydown - for Ctrl+Enter submission

  Handle these info messages:
  - {:anthropic_text_delta, text}
  - {:anthropic_tool_use, name, id, input}
  - {:anthropic_done, response}
  - {:anthropic_error, error}
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :messages, :list, default: []
  attr :streaming, :boolean, default: false
  attr :current_response, :string, default: ""
  attr :current_project, :map, default: nil
  attr :projects, :list, default: []
  attr :error, :string, default: nil
  attr :collapsed, :boolean, default: false
  attr :queued_messages, :list, default: []
  attr :current_tool, :string, default: nil
  attr :tool_step, :integer, default: 0
  attr :total_steps, :integer, default: 0
  attr :class, :string, default: ""

  def chat_panel(assigns) do
    ~H"""
    <div class={[
      "world-builder-panel world-builder-chat",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="panel-tabs">
        <button class="panel-tab active">
          <.icon name="hero-chat-bubble-left-right" class="size-4" />
          <span :if={!@collapsed}>AI Assistant</span>
        </button>
        <div style="flex: 1;"></div>
        <button
          :if={!@collapsed}
          class="panel-header-btn"
          phx-click="show_audit_log"
          title="View audit log"
        >
          <.icon name="hero-clock" class="size-4" />
        </button>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="chat"
          title={if @collapsed, do: "Expand", else: "Collapse"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-left", else: "hero-chevron-right"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content" style={if @collapsed, do: "display: none;"}>
        <div class="chat-project-selector">
          <form phx-change="select_project" style="display: contents;">
            <.icon name="hero-folder" class="size-3" style="color: #e8a838; flex-shrink: 0;" />
            <select
              name="project_key"
              style="flex: 1; padding: 3px 6px; font-size: 11px; background: #1a1a2e; border: 1px solid #333; border-radius: 3px; color: #ccc; cursor: pointer;"
            >
              <option value="" selected={@current_project == nil}>No project</option>
              <%= for project_key <- @projects do %>
                <option
                  value={project_key}
                  selected={@current_project && @current_project.key == project_key}
                >
                  {project_key}
                </option>
              <% end %>
            </select>
          </form>
          <button
            type="button"
            class="btn-icon-small"
            phx-click="create_project_ui"
            title="New project"
            style="flex-shrink: 0;"
          >
            <.icon name="hero-plus" class="size-3" />
          </button>
        </div>

        <div class="chat-messages" id="chat-messages" phx-hook="ScrollBottom">
          <%= if @messages == [] and !@streaming do %>
            <div class="chat-welcome">
              <div class="chat-welcome-icon">
                <.icon name="hero-sparkles" class="size-6 hero-icon" />
              </div>
              <div class="chat-welcome-title">World Builder AI</div>
              <div class="chat-welcome-subtitle">
                Your creative partner for building immersive worlds. Describe what you want to create.
              </div>
              <div class="chat-quick-actions">
                <button
                  type="button"
                  class="chat-quick-action"
                  phx-click="quick_chat"
                  phx-value-prompt="Create a tavern district with 5 interconnected rooms: a main hall, kitchen, cellar, upstairs rooms, and a back alley"
                >
                  <div class="chat-quick-action-icon rooms">
                    <.icon name="hero-home" class="size-4" />
                  </div>
                  <div class="chat-quick-action-text">
                    <span class="chat-quick-action-label">Build rooms</span>
                    <span class="chat-quick-action-desc">
                      Generate connected rooms with descriptions
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  class="chat-quick-action"
                  phx-click="quick_chat"
                  phx-value-prompt="Design a mysterious merchant NPC with a branching dialogue tree, backstory, and a hidden quest hook"
                >
                  <div class="chat-quick-action-icon npcs">
                    <.icon name="hero-user" class="size-4" />
                  </div>
                  <div class="chat-quick-action-text">
                    <span class="chat-quick-action-label">Design an NPC</span>
                    <span class="chat-quick-action-desc">
                      Create NPCs with personality and dialogue
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  class="chat-quick-action"
                  phx-click="quick_chat"
                  phx-value-prompt="Design a multi-part quest where the player investigates a series of disappearances in a village, with branching outcomes"
                >
                  <div class="chat-quick-action-icon quests">
                    <.icon name="hero-map" class="size-4" />
                  </div>
                  <div class="chat-quick-action-text">
                    <span class="chat-quick-action-label">Write a quest</span>
                    <span class="chat-quick-action-desc">
                      Craft quests with objectives and rewards
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  class="chat-quick-action"
                  phx-click="quick_chat"
                  phx-value-prompt="Help me brainstorm a world design concept. I want to create a world that feels unique and memorable. What themes and aesthetics should I explore?"
                >
                  <div class="chat-quick-action-icon design">
                    <.icon name="hero-light-bulb" class="size-4" />
                  </div>
                  <div class="chat-quick-action-text">
                    <span class="chat-quick-action-label">Brainstorm</span>
                    <span class="chat-quick-action-desc">Explore ideas and creative direction</span>
                  </div>
                </button>
              </div>
              <div class="chat-hints">
                <kbd>Ctrl+Enter</kbd> to send &middot; <kbd>Esc</kbd> to cancel
              </div>
            </div>
          <% end %>

          <%= for message <- @messages do %>
            <.chat_message message={message} />
          <% end %>

          <%= if @streaming do %>
            <div class="chat-message assistant streaming">
              <div class="message-content">
                <%= if @current_tool do %>
                  <div class="current-tool-indicator">
                    <.icon name="hero-wrench-screwdriver" class="size-4 animate-pulse" />
                    <span>{format_tool_name(@current_tool)}</span>
                    <%= if @total_steps > 0 do %>
                      <span class="tool-progress">Step {@tool_step}/{@total_steps}</span>
                    <% end %>
                  </div>
                <% end %>
                <div class="message-text">
                  {Phoenix.HTML.raw(format_markdown(@current_response))}
                  <span class="typing-indicator">▊</span>
                </div>
              </div>
            </div>
          <% end %>

          <%= if @error do %>
            <div class="chat-error">
              <.icon name="hero-exclamation-triangle" class="size-4" />
              <span>{@error}</span>
            </div>
          <% end %>
        </div>

        <%!-- Queued messages indicator --%>
        <%= if @queued_messages != [] do %>
          <div class="chat-queue-indicator">
            <.icon name="hero-queue-list" class="size-4" />
            <span>{length(@queued_messages)} queued</span>
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              phx-click="clear_queue"
              title="Clear queue"
            >
              <.icon name="hero-x-mark" class="size-3" />
            </button>
          </div>
        <% end %>

        <form class="chat-input-form" phx-submit="send_or_queue_message" id="chat-input-form">
          <textarea
            id="chat-textarea"
            name="message"
            placeholder={chat_placeholder(@current_project, @streaming, @queued_messages)}
            rows="3"
            phx-hook="ChatTextarea"
            data-streaming={@streaming}
          ></textarea>
          <button
            type="submit"
            class="btn btn-primary"
            title={if @streaming, do: "Queue message", else: "Send"}
          >
            <%= if @streaming do %>
              <.icon name="hero-queue-list" class="size-4" />
            <% else %>
              <.icon name="hero-paper-airplane" class="size-4" />
            <% end %>
          </button>
          <%= if @streaming do %>
            <button
              type="button"
              class="btn btn-danger"
              phx-click="cancel_streaming"
              title="Cancel (Esc)"
            >
              <.icon name="hero-stop" class="size-4" />
            </button>
          <% end %>
        </form>
      </div>
    </div>
    """
  end

  attr :message, :map, required: true

  defp chat_message(assigns) do
    ~H"""
    <div class={["chat-message", @message.role]}>
      <div class="message-content">
        <%= case @message.role do %>
          <% "user" -> %>
            <div class="message-text">{@message.content}</div>
          <% "assistant" -> %>
            <div class="message-text">
              {Phoenix.HTML.raw(format_markdown(@message.content))}
            </div>
            <%= if @message[:tool_uses] && @message.tool_uses != [] do %>
              <div class="message-tools">
                <%= for tool <- @message.tool_uses do %>
                  <.tool_use_display tool={tool} />
                <% end %>
              </div>
            <% end %>
          <% "tool_result" -> %>
            <.tool_result_display result={@message} />
          <% _ -> %>
            <div class="message-text">{@message.content}</div>
        <% end %>
      </div>
    </div>
    """
  end

  attr :tool, :map, required: true

  defp tool_use_display(assigns) do
    ~H"""
    <div class="tool-use">
      <div class="tool-header">
        <.icon name="hero-wrench-screwdriver" class="size-4" />
        <span class="tool-name">{format_tool_name(@tool.name)}</span>
      </div>
      <div class="tool-input">
        <code>{Jason.encode!(@tool.input, pretty: true)}</code>
      </div>
    </div>
    """
  end

  attr :result, :map, required: true

  defp tool_result_display(assigns) do
    content = assigns.result.content
    is_long = is_binary(content) and String.length(content) > 200
    assigns = assign(assigns, :is_long, is_long)

    ~H"""
    <div class={["tool-result", @result[:is_error] && "error"]}>
      <div class="tool-result-header">
        <%= if @result[:is_error] do %>
          <.icon name="hero-x-circle" class="size-4 text-red-500" />
        <% else %>
          <.icon name="hero-check-circle" class="size-4 text-green-500" />
        <% end %>
        <span>{format_tool_name(@result.tool_name)}</span>
      </div>
      <%= if @is_long do %>
        <details class="tool-result-details">
          <summary class="tool-result-summary">
            <code>{truncate_result(@result.content, 100)}</code>
            <span class="show-more-hint">Show more</span>
          </summary>
          <div class="tool-result-content">
            <code>{@result.content}</code>
          </div>
        </details>
      <% else %>
        <div class="tool-result-content">
          <code>{@result.content}</code>
        </div>
      <% end %>
    </div>
    """
  end

  # Helpers

  defp chat_placeholder(nil, _streaming, _queued), do: "Start by creating or loading a project..."

  defp chat_placeholder(_project, true, queued) when length(queued) > 0,
    do: "Type to queue another message... (#{length(queued)} waiting)"

  defp chat_placeholder(project, true, _queued),
    do: "Type to queue a follow-up for #{project.key}..."

  defp chat_placeholder(project, false, _queued), do: "Ask about #{project.key}..."

  defp format_tool_name(name) do
    name
    |> String.replace("wb_", "")
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp truncate_result(content, max_length) when is_binary(content) do
    if String.length(content) > max_length do
      String.slice(content, 0, max_length) <> "..."
    else
      content
    end
  end

  defp truncate_result(content, _max_length), do: inspect(content, limit: 10)

  defp format_markdown(nil), do: ""

  defp format_markdown(text) when is_binary(text) do
    text
    |> String.split("\n")
    |> Enum.map(&format_line/1)
    |> Enum.join("\n")
  end

  defp format_line("# " <> text), do: "<h1>#{escape(text)}</h1>"
  defp format_line("## " <> text), do: "<h2>#{escape(text)}</h2>"
  defp format_line("### " <> text), do: "<h3>#{escape(text)}</h3>"
  defp format_line("- " <> text), do: "<li>#{format_inline(text)}</li>"
  defp format_line("* " <> text), do: "<li>#{format_inline(text)}</li>"
  defp format_line(""), do: "<br/>"
  defp format_line(line), do: "<p>#{format_inline(line)}</p>"

  defp format_inline(text) do
    text
    |> escape()
    |> String.replace(~r/\*\*([^*]+)\*\*/, "<strong>\\1</strong>")
    |> String.replace(~r/\*([^*]+)\*/, "<em>\\1</em>")
    |> String.replace(~r/`([^`]+)`/, "<code>\\1</code>")
  end

  defp escape(text) do
    text
    |> Phoenix.HTML.html_escape()
    |> Phoenix.HTML.safe_to_string()
  end
end
