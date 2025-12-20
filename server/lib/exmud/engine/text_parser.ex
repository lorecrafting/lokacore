defmodule Exmud.Engine.TextParser do
  @moduledoc """
  Parses MUD text markup into HTML with clickable commands.

  ## Markup Syntax

  Inspired by Evennia's MXP-style links:

  - Command links: `|lc<command>|lt<display text>|le`
    - Example: `|lclook|ltlook around|le` -> clickable "look around" that sends "look"

  - URL links: `|lu<url>|lt<display text>|le`
    - Example: `|luhttps://example.com|ltvisit site|le` -> opens URL in new tab

  - Short command syntax: `|cmd:<command>|` (display text = command)
    - Example: `|cmd:look|` -> clickable "look" that sends "look"

  ## Security

  By default, only server-generated markup is parsed. User input should NOT be
  passed through this parser to prevent malicious link injection.

  ## Usage

      iex> TextParser.parse("Go |lcnorth|ltnorth|le to continue.")
      {:safe, "Go <span class=\"cmd-link\" data-cmd=\"north\">north</span> to continue."}

  Use with Phoenix.HTML.raw/1 or HEEx {:safe, ...} tuples for rendering.
  """

  @doc """
  Parses text with command/URL markup and returns safe HTML.

  Returns `{:safe, html_string}` tuple compatible with Phoenix templates.
  All text is HTML-escaped except for the generated link elements.
  """
  @spec parse(String.t()) :: {:safe, String.t()}
  def parse(text) when is_binary(text) do
    text
    |> escape_html()
    |> parse_command_links()
    |> parse_url_links()
    |> parse_short_commands()
    |> wrap_safe()
  end

  @doc """
  Parses text and returns raw HTML string (for testing/inspection).
  """
  @spec parse_to_string(String.t()) :: String.t()
  def parse_to_string(text) when is_binary(text) do
    {:safe, html} = parse(text)
    html
  end

  # Escape HTML special characters to prevent XSS
  defp escape_html(text) do
    text
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end

  # Parse |lc<command>|lt<display>|le syntax
  # Must handle escaped pipe characters from escape_html
  defp parse_command_links(text) do
    # Pattern: |lc<command>|lt<text>|le
    # After HTML escaping, pipes remain as |
    regex = ~r/\|lc([^|]+)\|lt([^|]+)\|le/

    Regex.replace(regex, text, fn _, cmd, display ->
      cmd = String.trim(cmd)
      display = String.trim(display)
      ~s(<span class="cmd-link" data-cmd="#{attr_escape(cmd)}">#{display}</span>)
    end)
  end

  # Parse |lu<url>|lt<display>|le syntax
  defp parse_url_links(text) do
    regex = ~r/\|lu([^|]+)\|lt([^|]+)\|le/

    Regex.replace(regex, text, fn _, url, display ->
      url = String.trim(url)
      display = String.trim(display)

      ~s(<a href="#{attr_escape(url)}" target="_blank" rel="noopener noreferrer" class="url-link">#{display}</a>)
    end)
  end

  # Parse short |cmd:<command>| syntax where display = command
  defp parse_short_commands(text) do
    regex = ~r/\|cmd:([^|]+)\|/

    Regex.replace(regex, text, fn _, cmd ->
      cmd = String.trim(cmd)
      ~s(<span class="cmd-link" data-cmd="#{attr_escape(cmd)}">#{cmd}</span>)
    end)
  end

  # Escape for use in HTML attributes
  defp attr_escape(text) do
    text
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end

  defp wrap_safe(html), do: {:safe, html}

  @doc """
  Helper to create command link markup.

  ## Examples

      iex> TextParser.cmd_link("look", "look around")
      "|lclook|ltlook around|le"

      iex> TextParser.cmd_link("north")
      "|cmd:north|"
  """
  @spec cmd_link(String.t(), String.t() | nil) :: String.t()
  def cmd_link(command, display \\ nil)

  def cmd_link(command, nil), do: "|cmd:#{command}|"
  def cmd_link(command, display), do: "|lc#{command}|lt#{display}|le"

  @doc """
  Helper to create URL link markup.

  ## Example

      iex> TextParser.url_link("https://example.com", "Example Site")
      "|luhttps://example.com|ltExample Site|le"
  """
  @spec url_link(String.t(), String.t()) :: String.t()
  def url_link(url, display), do: "|lu#{url}|lt#{display}|le"
end
