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
  attr :chat_mode, :atom, default: :design
  attr :selected_room, :any, default: nil
  attr :selected_entity, :any, default: nil
  attr :class, :string, default: ""

  def chat_panel(assigns) do
    ~H"""
    <div class={[
      "world-builder-panel world-builder-chat",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="flex items-center px-2.5 bg-linear-to-b from-wb-panel-gradient-from to-wb-panel-gradient-to border-b border-wb-border-dark min-h-[34px] gap-0.5">
        <button
          class="panel-tab active flex items-center gap-1.5 px-2.5 py-[5px] bg-white/[0.05] border-none text-wb-text-bright cursor-pointer text-wb-sm font-medium rounded-t-wb-md transition-all duration-150 relative"
          aria-label="AI Assistant"
        >
          <.icon name="hero-chat-bubble-left-right" class="size-4" />
          <span :if={!@collapsed}>AI Assistant</span>
        </button>
        <div class="flex-1"></div>
        <button
          :if={!@collapsed}
          class={[
            "flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium border rounded-wb-sm cursor-pointer transition-all duration-150 mr-1",
            if(@chat_mode == :assist,
              do: "bg-wb-warning/15 border-wb-warning/30 text-wb-warning hover:bg-wb-warning/25",
              else:
                "bg-transparent border-wb-border text-wb-text-dim hover:bg-wb-border hover:text-wb-text"
            )
          ]}
          phx-click="toggle_chat_mode"
          title={
            if @chat_mode == :design,
              do: "Switch to Assist mode (structural only, no prose)",
              else: "Switch to Design mode (full creative generation)"
          }
        >
          <.icon
            name={if @chat_mode == :assist, do: "hero-wrench-screwdriver", else: "hero-paint-brush"}
            class="size-3"
          />
          <span>{if @chat_mode == :design, do: "Design", else: "Assist"}</span>
        </button>
        <button
          :if={!@collapsed}
          class="flex items-center justify-center w-6 h-6 bg-transparent border-none text-wb-text-dim cursor-pointer rounded-wb-sm mr-1 hover:bg-wb-border hover:text-wb-text"
          phx-click="show_audit_log"
          title="View audit log"
        >
          <.icon name="hero-clock" class="size-4" />
        </button>
        <button
          class="flex items-center justify-center w-6 h-6 bg-transparent border-none text-wb-text-dim cursor-pointer rounded-wb-sm transition-all duration-150 hover:bg-wb-border hover:text-wb-text"
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

      <div
        class="panel-content flex-1 overflow-auto p-2 bg-wb-panel-alt"
        style={if @collapsed, do: "display: none;"}
      >
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-wb-surface border-b border-wb-border shrink-0">
          <form phx-change="select_project" class="contents">
            <.icon name="hero-folder" class="size-3 text-wb-warning flex-shrink-0" />
            <select
              name="project_key"
              class="flex-1 px-1.5 py-0.5 text-[11px] bg-wb-panel border border-wb-border rounded cursor-pointer text-wb-text"
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
            class="bg-transparent border-0 text-wb-text-muted cursor-pointer p-1 rounded-wb-sm transition-all flex items-center justify-center shrink-0 hover:bg-wb-border hover:text-wb-accent"
            phx-click="create_project_ui"
            title="New project"
          >
            <.icon name="hero-plus" class="size-3" />
          </button>
        </div>

        <div
          class="chat-messages flex-1 overflow-y-auto p-4 scroll-smooth bg-linear-to-b from-wb-chat-msg-gradient-from to-wb-chat-msg-gradient-to"
          id="chat-messages"
          phx-hook="ScrollBottom"
        >
          <div
            :if={@messages == [] and !@streaming}
            class="flex flex-col items-center justify-center py-8 px-5 h-full text-center"
          >
            <div class="w-12 h-12 rounded-xl bg-linear-to-br from-wb-chat-welcome-gradient-from to-wb-chat-welcome-gradient-to flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(78,84,200,0.2)]">
              <.icon name="hero-sparkles" class="size-6 text-wb-chat-welcome-icon" />
            </div>
            <div class="text-base font-semibold text-wb-text-bright mb-1.5">World Builder AI</div>
            <div class="text-[0.8rem] text-wb-text-dim mb-5 leading-normal max-w-[260px]">
              Your creative partner for building immersive worlds. Describe what you want to create.
            </div>
            <div class="flex flex-col gap-1.5 w-full max-w-[280px]">
              <%= for action <- quick_actions(assigns) do %>
                <button
                  type="button"
                  class="flex items-center gap-2.5 py-2.5 px-3.5 bg-wb-panel-alt border border-wb-chat-border rounded-wb-lg cursor-pointer transition-all duration-150 text-left text-wb-text text-[0.8rem] hover:bg-wb-input hover:border-wb-border-light hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  phx-click="quick_chat"
                  phx-value-prompt={action.prompt}
                >
                  <div class={"shrink-0 w-7 h-7 rounded-wb-md flex items-center justify-center text-[0.75rem] #{action.bg_class}"}>
                    <.icon name={action.icon} class="size-4" />
                  </div>
                  <div class="flex-1 leading-tight">
                    <span class="font-medium text-wb-text-bright block text-[0.8rem]">
                      {action.title}
                    </span>
                    <span class="text-wb-chat-text-dim text-[0.7rem] block mt-px">
                      {action.description}
                    </span>
                  </div>
                </button>
              <% end %>
            </div>
            <div class="text-[0.7rem] text-wb-chat-text-faint mt-4 leading-relaxed">
              <kbd class="inline-block px-1.5 py-px bg-wb-input border border-wb-border rounded-wb-sm text-[0.65rem] text-wb-text-muted font-[inherit]">
                Enter
              </kbd>
              to send &middot;
              <kbd class="inline-block px-1.5 py-px bg-wb-input border border-wb-border rounded-wb-sm text-[0.65rem] text-wb-text-muted font-[inherit]">
                Shift+Enter
              </kbd>
              for new line
            </div>
          </div>

          <%= for message <- @messages do %>
            <.chat_message message={message} />
          <% end %>

          <div
            :if={@streaming}
            class="chat-message assistant streaming mb-1.5 py-1.5 px-3 rounded-lg relative bg-wb-panel-alt mr-[4%] border border-wb-chat-border"
          >
            <div class="message-content text-[0.85rem] text-wb-text-bright leading-snug whitespace-normal">
              <div
                :if={@current_tool}
                class="current-tool-indicator flex items-center gap-2 py-1.5 px-3 rounded-lg mb-1.5 text-wb-tool-text text-[0.83rem] font-wb-mono bg-linear-to-br from-wb-tool-bg-from to-wb-tool-bg-to border border-wb-tool-border"
              >
                <.icon name="hero-wrench-screwdriver" class="size-4 animate-pulse" />
                <span>{format_tool_name(@current_tool)}</span>
                <span
                  :if={@total_steps > 0}
                  class="ml-auto py-0.5 px-2.5 bg-[rgba(99,102,241,0.15)] rounded-[10px] text-[0.68rem] text-wb-indigo-text font-medium tracking-wide"
                >
                  Step {@tool_step}/{@total_steps}
                </span>
              </div>
              <div class="message-text">
                {Phoenix.HTML.raw(format_markdown(@current_response))}
                <span class="typing-indicator">▊</span>
              </div>
            </div>
          </div>

          <div
            :if={@error}
            class="flex items-start gap-2.5 py-2.5 px-3.5 bg-linear-to-br from-wb-danger-surface to-wb-danger-surface border border-wb-danger-surface-hover rounded-[10px] my-2 text-wb-danger-text text-[0.83rem] leading-normal"
          >
            <.icon name="hero-exclamation-triangle" class="size-4 shrink-0 mt-0.5" />
            <span>{@error}</span>
          </div>
        </div>

        <%!-- Queued messages indicator --%>
        <div
          :if={@queued_messages != []}
          class="flex items-center gap-2 py-1.5 px-3.5 bg-wb-tool-queue-bg border border-wb-tool-queue-border rounded-wb-lg mx-0 mb-2 text-wb-tool-queue-text text-[0.78rem]"
        >
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

        <form
          class="flex gap-2 py-3 px-3.5 bg-wb-toolbar border-t border-wb-chat-border"
          phx-submit="send_or_queue_message"
          id="chat-input-form"
        >
          <textarea
            id="chat-textarea"
            name="message"
            class="flex-1 py-2.5 px-3.5 bg-wb-surface border border-wb-chat-border rounded-[10px] text-wb-text-bright text-[0.85rem] font-[inherit] resize-none transition-all duration-200 leading-normal focus:outline-none focus:border-wb-accent focus:shadow-[0_0_0_2px_rgba(85,112,204,0.15)] placeholder:text-wb-text-faint"
            placeholder={chat_placeholder(@current_project, @streaming, @queued_messages)}
            rows="1"
            phx-hook="ChatTextarea"
            data-streaming={@streaming}
          ></textarea>
          <button
            type="submit"
            class="btn btn-primary py-2 px-3.5 border-none rounded-[10px] cursor-pointer transition-all duration-150 flex items-center justify-center bg-linear-to-br from-wb-accent-gradient-from to-wb-accent-gradient-to text-white shadow-[0_2px_6px_rgba(74,108,247,0.25)] hover:not-disabled:bg-linear-to-br hover:not-disabled:from-wb-accent-hover-gradient-from hover:not-disabled:to-wb-accent-hover-gradient-to hover:not-disabled:shadow-[0_3px_10px_rgba(74,108,247,0.35)] hover:not-disabled:-translate-y-px disabled:bg-wb-border disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            title={if @streaming, do: "Queue message", else: "Send"}
          >
            <.icon :if={@streaming} name="hero-queue-list" class="size-4" />
            <.icon :if={!@streaming} name="hero-paper-airplane" class="size-4" />
          </button>
          <button
            :if={@streaming}
            type="button"
            class="btn btn-danger py-2 px-3.5 bg-wb-danger-surface text-wb-danger-text border border-wb-danger-border rounded-[10px] cursor-pointer transition-all duration-150 flex items-center justify-center hover:bg-wb-danger-surface-hover"
            phx-click="cancel_streaming"
            title="Cancel (Esc)"
          >
            <.icon name="hero-stop" class="size-4" />
          </button>
        </form>
      </div>
    </div>
    """
  end

  attr :message, :map, required: true

  defp chat_message(assigns) do
    ~H"""
    <div class={[
      "chat-message mb-1.5 py-1.5 px-3 rounded-lg relative",
      @message.role,
      @message.role == "user" &&
        "bg-linear-to-br from-wb-chat-user-bg-from to-wb-chat-user-bg-to ml-[12%] border border-wb-chat-user-border shadow-[0_1px_4px_rgba(0,0,0,0.2)]",
      @message.role == "assistant" && "bg-wb-panel-alt mr-[4%] border border-wb-chat-border",
      @message.role == "tool_result" && "!bg-transparent !border-none !p-0 ml-2"
    ]}>
      <div class={[
        "message-content text-[0.85rem] text-wb-text-bright leading-snug",
        @message.role == "user" && "!text-wb-chat-user-text whitespace-pre-wrap",
        @message.role != "user" && "whitespace-normal"
      ]}>
        <%= case @message.role do %>
          <% "user" -> %>
            <div class="message-text">{@message.content}</div>
          <% "assistant" -> %>
            <div class="message-text">
              {Phoenix.HTML.raw(format_markdown(@message.content))}
            </div>
            <div
              :if={@message[:tool_uses] && @message.tool_uses != []}
              class="message-tools whitespace-normal mt-2"
            >
              <%= for tool <- @message.tool_uses do %>
                <.tool_use_display tool={tool} />
              <% end %>
            </div>
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
    input_json = Jason.encode!(assigns.tool.input)
    has_input = input_json != "{}"
    assigns = assign(assigns, :input_json, input_json) |> assign(:has_input, has_input)

    ~H"""
    <details class="tool-use whitespace-normal mt-0.5 group">
      <summary class="flex items-center gap-1.5 text-[0.75rem] text-wb-text-muted cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <.icon name="hero-wrench-screwdriver" class="size-3 text-wb-tool-header-icon shrink-0" />
        <span class="font-medium text-wb-tool-name">{format_tool_name(@tool.name)}</span>
        <span :if={@has_input} class="text-wb-text-faint text-[0.7rem] truncate max-w-[200px]">
          {@input_json}
        </span>
        <span class="text-[0.65rem] text-wb-text-faint ml-auto group-open:hidden">Show</span>
        <span class="text-[0.65rem] text-wb-text-faint ml-auto hidden group-open:inline">Hide</span>
      </summary>
      <pre class="text-[0.68rem] text-wb-text-muted mt-1 ml-[18px] p-1.5 bg-wb-surface rounded overflow-x-auto"><code>{Jason.encode!(@tool.input, pretty: true)}</code></pre>
    </details>
    """
  end

  attr :result, :map, required: true

  defp tool_result_display(assigns) do
    content = assigns.result.content
    summary = extract_result_summary(content)
    has_detail = is_binary(content) and String.length(content) > String.length(summary)
    assigns = assign(assigns, summary: summary, has_detail: has_detail)

    ~H"""
    <details class={["tool-result whitespace-normal group", @result[:is_error] && "error"]}>
      <summary class="flex items-center gap-1.5 text-[0.75rem] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <.icon
          :if={@result[:is_error]}
          name="hero-x-circle-mini"
          class="size-3 text-red-400 shrink-0"
        />
        <.icon
          :if={!@result[:is_error]}
          name="hero-check-circle-mini"
          class="size-3 text-green-400 shrink-0"
        />
        <span class="font-medium">{format_tool_name(@result.tool_name)}</span>
        <span class="text-wb-text-muted text-[0.7rem] truncate">{@summary}</span>
        <span
          :if={@has_detail}
          class="text-[0.65rem] text-wb-text-faint ml-auto shrink-0 group-open:hidden"
        >
          Show
        </span>
        <span
          :if={@has_detail}
          class="text-[0.65rem] text-wb-text-faint ml-auto shrink-0 hidden group-open:inline"
        >
          Hide
        </span>
      </summary>
      <pre
        :if={@has_detail}
        class="text-[0.68rem] text-wb-text-muted mt-1 ml-[18px] p-1.5 bg-wb-surface rounded overflow-x-auto max-h-[300px] overflow-y-auto"
      ><code>{@result.content}</code></pre>
    </details>
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

  defp extract_result_summary(content) when is_binary(content) do
    case Jason.decode(content) do
      {:ok, %{"message" => msg}} when is_binary(msg) -> msg
      {:ok, %{"error" => err}} when is_binary(err) -> err
      _ -> String.slice(content, 0, 80)
    end
  end

  defp extract_result_summary(content), do: inspect(content, limit: 5)

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

  defp quick_actions(assigns) do
    cond do
      assigns[:selected_room] ->
        room_actions(assigns[:chat_mode])

      assigns[:selected_entity] ->
        entity_actions(assigns[:selected_entity], assigns[:chat_mode])

      true ->
        default_actions(assigns[:chat_mode])
    end
  end

  defp room_actions(:assist) do
    [
      %{
        title: "Add exits",
        description: "Connect this room to nearby rooms",
        prompt: "Add exits connecting this room to nearby rooms",
        icon: "hero-arrows-right-left",
        bg_class: "bg-[rgba(59,130,246,0.15)] text-wb-info"
      },
      %{
        title: "Add NPC spawns",
        description: "Scaffold NPC placeholders here",
        prompt: "Scaffold NPC spawns for this room with placeholder details",
        icon: "hero-user-plus",
        bg_class: "bg-[rgba(168,85,247,0.15)] text-wb-chat-icon-npcs"
      },
      %{
        title: "Add placeholder fields",
        description: "Scaffold ambient, spawns, tags",
        prompt: "Add placeholder fields to this room (ambient messages, spawns, tags)",
        icon: "hero-document-plus",
        bg_class: "bg-[rgba(234,179,8,0.15)] text-wb-chat-icon-quests"
      },
      %{
        title: "Validate this room",
        description: "Check for issues",
        prompt: "Validate this room and report any issues",
        icon: "hero-check-circle",
        bg_class: "bg-[rgba(34,197,94,0.15)] text-wb-success"
      }
    ]
  end

  defp room_actions(_design) do
    [
      %{
        title: "Describe this room",
        description: "Write a vivid description",
        prompt: "Write a vivid, sensory description for this room",
        icon: "hero-pencil",
        bg_class: "bg-[rgba(59,130,246,0.15)] text-wb-info"
      },
      %{
        title: "Add NPCs here",
        description: "Create NPCs for this room",
        prompt: "Create interesting NPCs for this room with dialogue",
        icon: "hero-user-plus",
        bg_class: "bg-[rgba(168,85,247,0.15)] text-wb-chat-icon-npcs"
      },
      %{
        title: "Add exits",
        description: "Connect to nearby rooms",
        prompt: "Connect this room to nearby rooms with exits",
        icon: "hero-arrows-right-left",
        bg_class: "bg-[rgba(234,179,8,0.15)] text-wb-chat-icon-quests"
      },
      %{
        title: "Add ambience",
        description: "Ambient messages and detail",
        prompt: "Add ambient messages and sensory details to this room",
        icon: "hero-sparkles",
        bg_class: "bg-[rgba(34,197,94,0.15)] text-wb-success"
      }
    ]
  end

  defp entity_actions(entity, :assist) do
    type_label = entity.type |> to_string() |> String.capitalize()

    [
      %{
        title: "Create dialogue scaffold",
        description: "Empty dialogue tree",
        prompt:
          "Create an empty dialogue tree scaffold for this #{type_label} with placeholder nodes",
        icon: "hero-chat-bubble-left-right",
        bg_class: "bg-[rgba(59,130,246,0.15)] text-wb-info"
      },
      %{
        title: "Wire to quest",
        description: "Connect to a quest",
        prompt:
          "Connect this #{type_label} to an existing quest or scaffold a new quest structure",
        icon: "hero-link",
        bg_class: "bg-[rgba(168,85,247,0.15)] text-wb-chat-icon-npcs"
      },
      %{
        title: "Show required fields",
        description: "What's missing",
        prompt: "What fields does this #{type_label} need? Show me what's missing or incomplete",
        icon: "hero-clipboard-document-list",
        bg_class: "bg-[rgba(234,179,8,0.15)] text-wb-chat-icon-quests"
      },
      %{
        title: "Add behavior scaffold",
        description: "Script skeleton",
        prompt: "Scaffold a behavior script for this #{type_label} with placeholder logic",
        icon: "hero-code-bracket",
        bg_class: "bg-[rgba(34,197,94,0.15)] text-wb-success"
      }
    ]
  end

  defp entity_actions(entity, _design) do
    type_label = entity.type |> to_string() |> String.capitalize()

    [
      %{
        title: "Write dialogue",
        description: "Create a dialogue tree",
        prompt: "Create a dialogue tree for this #{type_label} with branching conversations",
        icon: "hero-chat-bubble-left-right",
        bg_class: "bg-[rgba(59,130,246,0.15)] text-wb-info"
      },
      %{
        title: "Add behaviors",
        description: "Scripts, emotes, schedules",
        prompt: "Add behavior scripts and emotes to this #{type_label}",
        icon: "hero-code-bracket",
        bg_class: "bg-[rgba(168,85,247,0.15)] text-wb-chat-icon-npcs"
      },
      %{
        title: "Create a quest",
        description: "Quest involving this #{type_label}",
        prompt: "Design a quest involving this #{type_label}",
        icon: "hero-map",
        bg_class: "bg-[rgba(234,179,8,0.15)] text-wb-chat-icon-quests"
      },
      %{
        title: "Flesh out details",
        description: "Add depth and backstory",
        prompt: "Add more detail, backstory, and depth to this #{type_label}",
        icon: "hero-sparkles",
        bg_class: "bg-[rgba(34,197,94,0.15)] text-wb-success"
      }
    ]
  end

  defp default_actions(:assist) do
    [
      %{
        title: "Scaffold an area",
        description: "Empty rooms with placeholders",
        prompt:
          "Scaffold a new area with interconnected rooms and placeholder descriptions for me to fill in",
        icon: "hero-home",
        bg_class: "bg-[rgba(59,130,246,0.15)] text-wb-info"
      },
      %{
        title: "Check for issues",
        description: "Validate world content",
        prompt: "Run validation on the world and report any issues",
        icon: "hero-check-circle",
        bg_class: "bg-[rgba(234,179,8,0.15)] text-wb-chat-icon-quests"
      },
      %{
        title: "Show placeholders",
        description: "Find unfilled content",
        prompt: "Search for any rooms or entities that still have [TODO] or empty descriptions",
        icon: "hero-magnifying-glass",
        bg_class: "bg-[rgba(168,85,247,0.15)] text-wb-chat-icon-npcs"
      },
      %{
        title: "Format my notes",
        description: "Convert notes to YAML",
        prompt: "Help me convert my design notes into proper YAML format for the game engine",
        icon: "hero-document-text",
        bg_class: "bg-[rgba(34,197,94,0.15)] text-wb-success"
      }
    ]
  end

  defp default_actions(_design) do
    [
      %{
        title: "Design a new area",
        description: "Rooms, NPCs, and quests",
        prompt: "I want to create a new area with rooms, NPCs, and quests. Help me design it.",
        icon: "hero-home",
        bg_class: "bg-[rgba(59,130,246,0.15)] text-wb-info"
      },
      %{
        title: "Design an NPC",
        description: "Character with personality",
        prompt:
          "Design a memorable NPC with a branching dialogue tree, backstory, and quest hooks",
        icon: "hero-user",
        bg_class: "bg-[rgba(168,85,247,0.15)] text-wb-chat-icon-npcs"
      },
      %{
        title: "Write a quest",
        description: "Objectives and rewards",
        prompt: "Design a multi-part quest with branching objectives and meaningful rewards",
        icon: "hero-map",
        bg_class: "bg-[rgba(234,179,8,0.15)] text-wb-chat-icon-quests"
      },
      %{
        title: "Audit the world",
        description: "Find issues and gaps",
        prompt:
          "Run validation on the world and analyze the content for issues, gaps, or improvements",
        icon: "hero-magnifying-glass",
        bg_class: "bg-[rgba(34,197,94,0.15)] text-wb-success"
      }
    ]
  end
end
