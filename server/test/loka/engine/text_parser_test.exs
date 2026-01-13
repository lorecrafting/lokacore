defmodule Loka.Engine.TextParserTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.TextParser

  describe "parse/1" do
    test "returns safe HTML tuple" do
      result = TextParser.parse("Hello world")
      assert {:safe, _} = result
    end

    test "escapes HTML in plain text" do
      {:safe, html} = TextParser.parse("<script>alert('xss')</script>")
      assert html =~ "&lt;script&gt;"
      refute html =~ "<script>"
    end

    test "parses command links with |lc|lt|le syntax" do
      {:safe, html} = TextParser.parse("Go |lcnorth|ltto the north|le now")
      assert html =~ ~s(<span class="cmd-link" data-cmd="north">to the north</span>)
      assert html =~ "Go "
      assert html =~ " now"
    end

    test "parses short command syntax |cmd:X|" do
      {:safe, html} = TextParser.parse("Type |cmd:look| to look")
      assert html =~ ~s(<span class="cmd-link" data-cmd="look">look</span>)
    end

    test "parses URL links with |lu|lt|le syntax" do
      {:safe, html} = TextParser.parse("Visit |luhttps://example.com|ltour site|le")
      assert html =~ ~s(<a href="https://example.com")
      assert html =~ ~s(target="_blank")
      assert html =~ ~s(rel="noopener noreferrer")
      assert html =~ ">our site</a>"
    end

    test "handles multiple command links" do
      {:safe, html} = TextParser.parse("|cmd:look| and |cmd:help|")
      assert html =~ ~s(data-cmd="look">look</span>)
      assert html =~ ~s(data-cmd="help">help</span>)
    end

    test "escapes quotes in commands" do
      {:safe, html} = TextParser.parse(~s(|lcsay "hello"|lttalk|le))
      assert html =~ ~s(data-cmd="say &quot;hello&quot;")
    end

    test "preserves whitespace and newlines" do
      {:safe, html} = TextParser.parse("Line 1\nLine 2")
      assert html =~ "Line 1\nLine 2"
    end
  end

  describe "parse_to_string/1" do
    test "returns raw HTML string" do
      html = TextParser.parse_to_string("|cmd:test|")
      assert is_binary(html)
      assert html =~ "cmd-link"
    end
  end

  describe "cmd_link/2" do
    test "creates short command link markup" do
      assert TextParser.cmd_link("look") == "|cmd:look|"
    end

    test "creates full command link markup with display" do
      assert TextParser.cmd_link("go north", "north") == "|lcgo north|ltnorth|le"
    end
  end

  describe "url_link/2" do
    test "creates URL link markup" do
      assert TextParser.url_link("https://example.com", "Example") ==
               "|luhttps://example.com|ltExample|le"
    end
  end
end
