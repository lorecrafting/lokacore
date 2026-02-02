defmodule LokaWeb.AdminLive.WorldBuilder.DocumentViewer do
  @moduledoc """
  Document viewer component for the World Builder.

  Displays markdown documents with basic formatting.
  Shows project design docs, planning files, and notes.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :document, :map, default: nil
  attr :content, :string, default: nil
  attr :loading, :boolean, default: false
  attr :error, :string, default: nil
  attr :class, :string, default: ""

  def document_viewer(assigns) do
    ~H"""
    <div class={["document-viewer", @class]}>
      <%= if @document do %>
        <div class="document-header">
          <div class="document-info">
            <span class="document-name">{@document.filename}</span>
            <span class="document-meta">
              {@document.doc_type} • v{@document.version}
            </span>
          </div>
          <div class="document-actions">
            <button
              class="btn btn-sm btn-ghost"
              phx-click="refresh_document"
              title="Refresh"
              disabled={@loading}
            >
              <.icon name="hero-arrow-path" class={["size-4", @loading && "animate-spin"]} />
            </button>
            <button
              class="btn btn-sm btn-ghost"
              phx-click="close_document"
              title="Close"
            >
              <.icon name="hero-x-mark" class="size-4" />
            </button>
          </div>
        </div>

        <div class="document-content">
          <%= if @loading do %>
            <div class="document-loading">
              <.icon name="hero-arrow-path" class="size-6 animate-spin text-gray-500" />
              <span class="text-gray-500 mt-2">Loading...</span>
            </div>
          <% end %>

          <%= if @error do %>
            <div class="document-error">
              <.icon name="hero-exclamation-triangle" class="size-6 text-red-500" />
              <p class="text-red-400 mt-2">{@error}</p>
            </div>
          <% end %>

          <%= if @content && !@loading && !@error do %>
            <div class="markdown-content">
              {render_markdown(@content)}
            </div>
          <% end %>
        </div>
      <% else %>
        <div class="empty-state">
          <.icon name="hero-document-text" class="size-12 text-gray-600 mb-4" />
          <p class="text-gray-500">Select a document to view</p>
          <p class="text-gray-600 text-sm mt-2">
            Or ask the AI to create design documents for your project
          </p>
        </div>
      <% end %>
    </div>
    """
  end

  # Simple markdown renderer
  defp render_markdown(nil), do: ""

  defp render_markdown(content) when is_binary(content) do
    content
    |> String.split("\n")
    |> Enum.map(&render_line/1)
    |> Phoenix.HTML.raw()
  end

  defp render_line("# " <> text), do: "<h1>#{escape(text)}</h1>"
  defp render_line("## " <> text), do: "<h2>#{escape(text)}</h2>"
  defp render_line("### " <> text), do: "<h3>#{escape(text)}</h3>"
  defp render_line("#### " <> text), do: "<h4>#{escape(text)}</h4>"
  defp render_line("---"), do: "<hr/>"
  defp render_line("- " <> text), do: "<li>#{render_inline(text)}</li>"
  defp render_line("* " <> text), do: "<li>#{render_inline(text)}</li>"
  defp render_line(""), do: "<br/>"

  defp render_line(line) do
    cond do
      String.match?(line, ~r/^\d+\. /) ->
        text = Regex.replace(~r/^\d+\. /, line, "")
        "<li class=\"numbered\">#{render_inline(text)}</li>"

      String.starts_with?(line, "```") ->
        "<pre><code>"

      true ->
        "<p>#{render_inline(line)}</p>"
    end
  end

  defp render_inline(text) do
    text
    |> escape()
    |> String.replace(~r/\*\*([^*]+)\*\*/, "<strong>\\1</strong>")
    |> String.replace(~r/\*([^*]+)\*/, "<em>\\1</em>")
    |> String.replace(~r/`([^`]+)`/, "<code class=\"inline-code\">\\1</code>")
  end

  defp escape(text) do
    text
    |> Phoenix.HTML.html_escape()
    |> Phoenix.HTML.safe_to_string()
  end
end
