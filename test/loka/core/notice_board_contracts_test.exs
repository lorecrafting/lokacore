defmodule Loka.Core.NoticeBoardContractsTest do
  use ExUnit.Case, async: true
  @cases JSON.decode!(File.read!("protocol/fixtures/notice_board_contracts.json"))

  # Breaks: missing, open or unbounded board/notice metadata enters compiler or wire contracts.
  test "notice metadata contracts accept their bounded valid controls and reject malformed shapes" do
    for c <- @cases do
      assert Loka.Core.Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"],
             c["name"]
    end
  end
end
