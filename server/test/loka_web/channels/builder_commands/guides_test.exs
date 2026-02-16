defmodule LokaWeb.Channels.BuilderCommands.GuidesTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.BuilderCommands.Guides

  @socket %{}

  describe "execute(:guide, ...)" do
    test "returns guide content for valid topic" do
      {:ok, text, _socket} = Guides.execute(:guide, %{topic: "narrative_style"}, @socket)
      assert text =~ "--- Guide: narrative_style ---"
    end

    test "returns error with available list for nonexistent topic" do
      {:error, text, _socket} = Guides.execute(:guide, %{topic: "nonexistent_xyz"}, @socket)
      assert text =~ "not found"
      assert text =~ "Available:"
      assert text =~ "narrative_style"
    end

    test "rejects path traversal with .." do
      {:error, text, _socket} = Guides.execute(:guide, %{topic: "../../../etc/passwd"}, @socket)
      assert text =~ "Invalid topic name"
    end

    test "rejects path traversal with /" do
      {:error, text, _socket} = Guides.execute(:guide, %{topic: "foo/bar"}, @socket)
      assert text =~ "Invalid topic name"
    end
  end
end
