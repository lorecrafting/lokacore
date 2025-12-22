defmodule Exmud.Tui.ProtocolTest do
  use ExUnit.Case, async: true

  alias Exmud.Tui.Protocol

  describe "decode_request/1" do
    test "decodes valid request with id and params" do
      json =
        ~s({"jsonrpc": "2.0", "id": 1, "method": "entities.list", "params": {"type": "room"}})

      assert {:ok, request} = Protocol.decode_request(json)
      assert request.method == "entities.list"
      assert request.id == 1
      assert request.params == %{"type" => "room"}
    end

    test "decodes valid request without params" do
      json = ~s({"jsonrpc": "2.0", "id": 42, "method": "system.info"})

      assert {:ok, request} = Protocol.decode_request(json)
      assert request.method == "system.info"
      assert request.id == 42
      assert request.params == %{}
    end

    test "decodes notification (no id)" do
      json = ~s({"jsonrpc": "2.0", "method": "ping", "params": {"time": 123}})

      assert {:ok, request} = Protocol.decode_request(json)
      assert request.method == "ping"
      assert request.id == nil
      assert request.params == %{"time" => 123}
    end

    test "decodes notification without params" do
      json = ~s({"jsonrpc": "2.0", "method": "ping"})

      assert {:ok, request} = Protocol.decode_request(json)
      assert request.method == "ping"
      assert request.id == nil
      assert request.params == %{}
    end

    test "returns parse_error for invalid JSON" do
      assert {:error, :parse_error} = Protocol.decode_request("not json")
      assert {:error, :parse_error} = Protocol.decode_request("{broken")
      assert {:error, :parse_error} = Protocol.decode_request("")
    end

    test "returns invalid_request for missing jsonrpc version" do
      json = ~s({"id": 1, "method": "test"})
      assert {:error, :invalid_request} = Protocol.decode_request(json)
    end

    test "returns invalid_request for wrong jsonrpc version" do
      json = ~s({"jsonrpc": "1.0", "id": 1, "method": "test"})
      assert {:error, :invalid_request} = Protocol.decode_request(json)
    end

    test "returns invalid_request for missing method" do
      json = ~s({"jsonrpc": "2.0", "id": 1})
      assert {:error, :invalid_request} = Protocol.decode_request(json)
    end

    test "handles string id" do
      json = ~s({"jsonrpc": "2.0", "id": "req-123", "method": "test"})

      assert {:ok, request} = Protocol.decode_request(json)
      assert request.id == "req-123"
    end
  end

  describe "encode_response/2" do
    test "encodes success response with map result" do
      json = Protocol.encode_response(1, %{status: "ok", count: 5})

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["jsonrpc"] == "2.0"
      assert decoded["id"] == 1
      assert decoded["result"] == %{"status" => "ok", "count" => 5}
      refute Map.has_key?(decoded, "error")
    end

    test "encodes success response with list result" do
      json = Protocol.encode_response(2, [1, 2, 3])

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["result"] == [1, 2, 3]
    end

    test "encodes success response with nil id" do
      json = Protocol.encode_response(nil, %{ok: true})

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["id"] == nil
    end

    test "encodes success response with string id" do
      json = Protocol.encode_response("abc-123", %{done: true})

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["id"] == "abc-123"
    end
  end

  describe "encode_error/3" do
    test "encodes error response" do
      json = Protocol.encode_error(1, -32600, "Invalid Request")

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["jsonrpc"] == "2.0"
      assert decoded["id"] == 1
      assert decoded["error"]["code"] == -32600
      assert decoded["error"]["message"] == "Invalid Request"
      refute Map.has_key?(decoded, "result")
    end

    test "encodes error response with nil id" do
      json = Protocol.encode_error(nil, -32700, "Parse error")

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["id"] == nil
      assert decoded["error"]["code"] == -32700
    end
  end

  describe "encode_notification/2" do
    test "encodes notification without id" do
      json = Protocol.encode_notification("entity.changed", %{id: "abc123", action: "updated"})

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["jsonrpc"] == "2.0"
      assert decoded["method"] == "entity.changed"
      assert decoded["params"] == %{"id" => "abc123", "action" => "updated"}
      refute Map.has_key?(decoded, "id")
    end

    test "encodes notification with empty params" do
      json = Protocol.encode_notification("heartbeat", %{})

      assert {:ok, decoded} = Jason.decode(json)
      assert decoded["method"] == "heartbeat"
      assert decoded["params"] == %{}
    end
  end

  describe "error_code/1" do
    test "returns correct codes for standard errors" do
      assert Protocol.error_code(:parse_error) == -32700
      assert Protocol.error_code(:invalid_request) == -32600
      assert Protocol.error_code(:method_not_found) == -32601
      assert Protocol.error_code(:invalid_params) == -32602
      assert Protocol.error_code(:internal_error) == -32603
    end
  end

  describe "roundtrip encoding/decoding" do
    test "request can be decoded and response encoded" do
      request_json =
        ~s({"jsonrpc": "2.0", "id": 99, "method": "test.echo", "params": {"msg": "hello"}})

      {:ok, request} = Protocol.decode_request(request_json)

      # Simulate processing
      result = %{echoed: request.params["msg"]}
      response_json = Protocol.encode_response(request.id, result)

      {:ok, response} = Jason.decode(response_json)
      assert response["id"] == 99
      assert response["result"]["echoed"] == "hello"
    end
  end
end
