defmodule LokaWeb.Api.HealthControllerTest do
  use LokaWeb.ConnCase

  describe "GET /api/health" do
    test "returns health status", %{conn: conn} do
      conn = get(conn, ~p"/api/health")

      assert %{
               "status" => "ok",
               "version" => _version,
               "timestamp" => _timestamp
             } = json_response(conn, 200)
    end
  end
end
