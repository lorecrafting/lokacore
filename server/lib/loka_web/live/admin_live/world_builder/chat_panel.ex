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
  attr :error, :string, default: nil
  attr :collapsed, :boolean, default: false
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
        <%= if @current_project do %>
          <div class="chat-project-context">
            <.icon name="hero-folder" class="size-4 text-yellow-500" />
            <span>{@current_project.key}</span>
          </div>
        <% end %>

        <div class="chat-messages" id="chat-messages" phx-hook="ScrollBottom">
          <%= for message <- @messages do %>
            <.chat_message message={message} />
          <% end %>

          <%= if @streaming do %>
            <div class="chat-message assistant streaming">
              <div class="message-content">
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

        <form class="chat-input-form" phx-submit="send_message">
          <textarea
            name="message"
            placeholder={
              if @current_project,
                do: "Ask about #{@current_project.key}...",
                else: "Start by creating or loading a project..."
            }
            rows="3"
            disabled={@streaming}
            phx-keydown="textarea_keydown"
          ></textarea>
          <button type="submit" class="btn btn-primary" disabled={@streaming}>
            <%= if @streaming do %>
              <.icon name="hero-arrow-path" class="size-4 animate-spin" />
            <% else %>
              <.icon name="hero-paper-airplane" class="size-4" />
            <% end %>
          </button>
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
      <div class="tool-result-content">
        <code>{truncate_result(@result.content)}</code>
      </div>
    </div>
    """
  end

  # Helpers

  defp format_tool_name(name) do
    name
    |> String.replace("wb_", "")
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp truncate_result(content) when is_binary(content) do
    if String.length(content) > 500 do
      String.slice(content, 0, 500) <> "..."
    else
      content
    end
  end

  defp truncate_result(content), do: inspect(content, limit: 10)

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
