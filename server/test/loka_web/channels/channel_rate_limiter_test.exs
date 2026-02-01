defmodule LokaWeb.Channels.ChannelRateLimiterTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.ChannelRateLimiter

  # Create a mock socket for testing
  defp mock_socket(assigns \\ %{}) do
    %Phoenix.Socket{
      assigns: Map.merge(%{player_id: "test-player-123"}, assigns)
    }
  end

  describe "check/1" do
    setup do
      # Store original config and reset after test
      original_config = Application.get_env(:loka, ChannelRateLimiter, [])

      on_exit(fn ->
        Application.put_env(:loka, ChannelRateLimiter, original_config)
      end)

      :ok
    end

    test "returns :ok when no previous messages" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true)
      socket = mock_socket()

      assert :ok = ChannelRateLimiter.check(socket)
    end

    test "returns :ok when under limit" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 10,
        burst_allowance: 5,
        window_ms: 1000
      )

      now = System.monotonic_time(:millisecond)
      # 5 messages in window (under 10 + 5 = 15 limit)
      timestamps = for i <- 0..4, do: now - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      assert :ok = ChannelRateLimiter.check(socket)
    end

    test "returns {:error, :rate_limited} when at limit" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 5,
        burst_allowance: 2,
        window_ms: 1000
      )

      now = System.monotonic_time(:millisecond)
      # 7 messages = exactly at limit (5 + 2)
      timestamps = for i <- 0..6, do: now - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      assert {:error, :rate_limited} = ChannelRateLimiter.check(socket)
    end

    test "returns {:error, :rate_limited} when over limit" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 5,
        burst_allowance: 2,
        window_ms: 1000
      )

      now = System.monotonic_time(:millisecond)
      # 10 messages = over limit
      timestamps = for i <- 0..9, do: now - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      assert {:error, :rate_limited} = ChannelRateLimiter.check(socket)
    end

    test "returns :ok when disabled" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: false)

      now = System.monotonic_time(:millisecond)
      # 100 messages but disabled
      timestamps = for i <- 0..99, do: now - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      assert :ok = ChannelRateLimiter.check(socket)
    end

    test "ignores timestamps outside window" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 5,
        burst_allowance: 2,
        window_ms: 100
      )

      now = System.monotonic_time(:millisecond)
      # 3 recent + 10 old (outside 100ms window)
      recent = for i <- 0..2, do: now - i * 10
      old = for i <- 0..9, do: now - 200 - i * 10
      timestamps = recent ++ old
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      # Only 3 recent, under limit of 7
      assert :ok = ChannelRateLimiter.check(socket)
    end
  end

  describe "track/1" do
    setup do
      original_config = Application.get_env(:loka, ChannelRateLimiter, [])

      on_exit(fn ->
        Application.put_env(:loka, ChannelRateLimiter, original_config)
      end)

      :ok
    end

    test "adds timestamp to empty assigns" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true, window_ms: 1000)
      socket = mock_socket()

      updated_socket = ChannelRateLimiter.track(socket)

      assert [timestamp] = updated_socket.assigns.rate_limit_timestamps
      assert is_integer(timestamp)
    end

    test "adds timestamp to existing timestamps" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true, window_ms: 1000)
      now = System.monotonic_time(:millisecond)
      existing = [now - 100, now - 200]
      socket = mock_socket(%{rate_limit_timestamps: existing})

      updated_socket = ChannelRateLimiter.track(socket)

      timestamps = updated_socket.assigns.rate_limit_timestamps
      assert length(timestamps) == 3
      # New timestamp should be first (most recent)
      assert hd(timestamps) >= now
    end

    test "cleans up old timestamps during track" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true, window_ms: 100)
      now = System.monotonic_time(:millisecond)
      # Mix of recent and old timestamps
      existing = [now - 50, now - 200, now - 300]
      socket = mock_socket(%{rate_limit_timestamps: existing})

      updated_socket = ChannelRateLimiter.track(socket)

      timestamps = updated_socket.assigns.rate_limit_timestamps
      # Should have new timestamp + 1 recent (now - 50), old ones filtered out
      assert length(timestamps) == 2
    end

    test "returns socket unchanged when disabled" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: false)
      socket = mock_socket()

      updated_socket = ChannelRateLimiter.track(socket)

      assert updated_socket == socket
      refute Map.has_key?(updated_socket.assigns, :rate_limit_timestamps)
    end
  end

  describe "with_rate_limit/2" do
    setup do
      original_config = Application.get_env(:loka, ChannelRateLimiter, [])

      on_exit(fn ->
        Application.put_env(:loka, ChannelRateLimiter, original_config)
      end)

      :ok
    end

    test "calls handler and tracks when under limit" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 30,
        burst_allowance: 10,
        window_ms: 1000
      )

      socket = mock_socket()

      result =
        ChannelRateLimiter.with_rate_limit(socket, fn s ->
          {:reply, {:ok, %{data: "test"}}, s}
        end)

      assert {:reply, {:ok, %{data: "test"}}, updated_socket} = result
      assert Map.has_key?(updated_socket.assigns, :rate_limit_timestamps)
    end

    test "tracks noreply responses" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true, window_ms: 1000)
      socket = mock_socket()

      result =
        ChannelRateLimiter.with_rate_limit(socket, fn s ->
          {:noreply, s}
        end)

      assert {:noreply, updated_socket} = result
      assert Map.has_key?(updated_socket.assigns, :rate_limit_timestamps)
    end

    test "returns rate_limited error when over limit" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 2,
        burst_allowance: 1,
        window_ms: 1000
      )

      now = System.monotonic_time(:millisecond)
      timestamps = for i <- 0..4, do: now - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      handler_called = :atomics.new(1, [])

      result =
        ChannelRateLimiter.with_rate_limit(socket, fn s ->
          :atomics.add(handler_called, 1, 1)
          {:reply, :ok, s}
        end)

      assert {:reply, {:error, %{reason: "rate_limited", message: _}}, ^socket} = result
      # Handler should NOT be called
      assert :atomics.get(handler_called, 1) == 0
    end

    test "passes through non-standard return values" do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true, window_ms: 1000)
      socket = mock_socket()

      result =
        ChannelRateLimiter.with_rate_limit(socket, fn _s ->
          {:stop, :normal, %{}}
        end)

      # Non-standard returns pass through unchanged
      assert {:stop, :normal, %{}} = result
    end
  end

  describe "configuration" do
    setup do
      original_config = Application.get_env(:loka, ChannelRateLimiter, [])

      on_exit(fn ->
        Application.put_env(:loka, ChannelRateLimiter, original_config)
      end)

      :ok
    end

    test "uses default values when not configured" do
      Application.delete_env(:loka, ChannelRateLimiter)
      socket = mock_socket()

      # Should use defaults: 30 max, 10 burst, 1000ms window
      # With no timestamps, should be under limit
      assert :ok = ChannelRateLimiter.check(socket)
    end

    test "respects custom max_messages" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 3,
        burst_allowance: 0,
        window_ms: 1000
      )

      now = System.monotonic_time(:millisecond)
      timestamps = for i <- 0..2, do: now - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      # 3 messages = at limit of 3
      assert {:error, :rate_limited} = ChannelRateLimiter.check(socket)
    end

    test "respects custom window_ms" do
      Application.put_env(:loka, ChannelRateLimiter,
        enabled: true,
        max_messages: 5,
        burst_allowance: 0,
        window_ms: 50
      )

      now = System.monotonic_time(:millisecond)
      # All timestamps outside 50ms window
      timestamps = for i <- 0..9, do: now - 100 - i * 10
      socket = mock_socket(%{rate_limit_timestamps: timestamps})

      # All old, effectively 0 in window
      assert :ok = ChannelRateLimiter.check(socket)
    end
  end

  describe "player identification" do
    setup do
      Application.put_env(:loka, ChannelRateLimiter, enabled: true, window_ms: 1000)

      on_exit(fn ->
        Application.delete_env(:loka, ChannelRateLimiter)
      end)

      :ok
    end

    test "works with player struct in assigns" do
      socket = %Phoenix.Socket{
        assigns: %{player: %{id: "player-struct-id"}}
      }

      assert :ok = ChannelRateLimiter.check(socket)
    end

    test "works with player_id in assigns" do
      socket = %Phoenix.Socket{
        assigns: %{player_id: "direct-player-id"}
      }

      assert :ok = ChannelRateLimiter.check(socket)
    end

    test "works with unknown player" do
      socket = %Phoenix.Socket{
        assigns: %{}
      }

      assert :ok = ChannelRateLimiter.check(socket)
    end
  end
end
