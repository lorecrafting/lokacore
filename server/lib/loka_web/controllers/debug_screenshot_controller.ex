defmodule LokaWeb.DebugScreenshotController do
  @moduledoc """
  Handles remote screenshot capture from mobile devices.

  Flow:
  1. POST /api/debug/screenshot/request - broadcasts capture request to player's channel
  2. Mobile receives event, captures screen, uploads via POST /api/debug/screenshot
  3. Screenshot saved to priv/debug_screenshots/latest.png
  """
  use LokaWeb, :controller

  require Logger

  @screenshot_dir "priv/debug_screenshots"

  @doc """
  Request a screenshot from a connected mobile device.
  Broadcasts to all connected game channels to capture.
  """
  def request(conn, _params) do
    # Broadcast to all game channels to capture screenshot
    Phoenix.PubSub.broadcast(Loka.PubSub, "debug:screenshot", :capture_screenshot)

    Logger.info("[Screenshot] Capture request broadcast")

    conn
    |> json(%{status: "requested", message: "Screenshot capture request sent to mobile devices"})
  end

  @doc """
  Receive uploaded screenshot from mobile device.
  Saves as latest.png and also keeps timestamped history.
  """
  def upload(conn, %{"image" => image_data} = params) do
    ensure_screenshot_dir()

    # Decode base64 image
    case Base.decode64(image_data) do
      {:ok, binary} ->
        timestamp = System.system_time(:second)

        # Save as latest (overwrites)
        latest_path = Path.join(@screenshot_dir, "latest.png")
        File.write!(latest_path, binary)

        # Also save timestamped version
        timestamped_path = Path.join(@screenshot_dir, "screenshot_#{timestamp}.png")
        File.write!(timestamped_path, binary)

        # Save metadata
        metadata = %{
          timestamp: timestamp,
          player_name: params["player_name"],
          room: params["room"],
          device: params["device"],
          captured_at: DateTime.utc_now() |> DateTime.to_iso8601()
        }

        metadata_path = Path.join(@screenshot_dir, "latest.json")
        File.write!(metadata_path, Jason.encode!(metadata, pretty: true))

        Logger.info(
          "[Screenshot] Received from #{params["player_name"] || "unknown"} - saved to #{latest_path}"
        )

        # Clean up old screenshots (keep last 20)
        cleanup_old_screenshots()

        conn
        |> json(%{status: "ok", path: latest_path})

      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid base64 image data"})
    end
  end

  def upload(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing 'image' field with base64 encoded PNG"})
  end

  @doc """
  Get the latest screenshot metadata.
  """
  def latest(conn, _params) do
    metadata_path = Path.join(@screenshot_dir, "latest.json")
    latest_path = Path.join(@screenshot_dir, "latest.png")

    cond do
      not File.exists?(latest_path) ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "No screenshot available"})

      File.exists?(metadata_path) ->
        metadata = File.read!(metadata_path) |> Jason.decode!()
        conn |> json(Map.put(metadata, :path, latest_path))

      true ->
        conn |> json(%{path: latest_path, timestamp: nil})
    end
  end

  @doc """
  Serve the latest screenshot image directly.
  """
  def serve_latest(conn, _params) do
    latest_path = Path.join(@screenshot_dir, "latest.png")

    if File.exists?(latest_path) do
      conn
      |> put_resp_content_type("image/png")
      |> send_file(200, latest_path)
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "No screenshot available"})
    end
  end

  # Private functions

  defp ensure_screenshot_dir do
    File.mkdir_p!(@screenshot_dir)
  end

  defp cleanup_old_screenshots do
    @screenshot_dir
    |> Path.join("screenshot_*.png")
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.reverse()
    |> Enum.drop(20)
    |> Enum.each(&File.rm/1)
  end
end
