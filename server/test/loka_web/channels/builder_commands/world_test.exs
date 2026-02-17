defmodule LokaWeb.Channels.BuilderCommands.WorldTest do
  use Loka.DataCase, async: false

  alias LokaWeb.Channels.BuilderCommands.World

  @socket %{}

  describe "execute(:settime, ...)" do
    test "accepts valid time periods" do
      for time <- ~w(dawn noon dusk midnight) do
        {:ok, text, _socket} = World.execute(:settime, %{time: time}, @socket)
        assert text =~ "settime #{time}"
      end
    end

    test "rejects invalid time period" do
      {:error, text, _socket} = World.execute(:settime, %{time: "teatime"}, @socket)
      assert text =~ "Invalid time"
      assert text =~ "dawn"
    end
  end

  describe "execute(:reload, ...)" do
    test "returns V2 info message" do
      {:ok, text, _socket} = World.execute(:reload, %{}, @socket)
      assert text =~ "No reload needed"
      assert text =~ "V2"
    end
  end

  describe "execute(:validate, ...)" do
    test "returns validation summary" do
      {:ok, text, _socket} = World.execute(:validate, %{}, @socket)
      assert text =~ "Validation"
    end
  end
end
