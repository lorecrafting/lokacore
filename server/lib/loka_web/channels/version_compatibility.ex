defmodule LokaWeb.Channels.VersionCompatibility do
  @moduledoc """
  Client version compatibility checking for Phoenix channels.

  This module provides version validation to ensure mobile clients are compatible
  with the server's API. It uses semantic versioning to determine compatibility.

  ## Version Policy

  - **Major version**: Breaking changes - client MUST update
  - **Minor version**: New features - client SHOULD update (backwards compatible)
  - **Patch version**: Bug fixes - no action needed

  ## Usage

  In your channel join:

      def join("game:lobby", params, socket) do
        case VersionCompatibility.validate_client(params) do
          {:ok, version_info} ->
            socket = assign(socket, :client_version, version_info)
            {:ok, socket}

          {:error, :update_required, info} ->
            {:error, %{reason: "update_required", min_version: info.min_version}}

          {:error, :version_missing} ->
            # Allow legacy clients or require version
            {:ok, socket}
        end
      end

  ## Configuration

  Set in config:

      config :loka, LokaWeb.Channels.VersionCompatibility,
        min_version: "1.0.0",
        current_version: "1.0.0"
  """

  require Logger

  # Current API version - bump this when making changes
  @current_api_version "1.0.0"

  # Minimum supported client version - bump this for breaking changes
  @min_client_version "1.0.0"

  # Features available at each version (for capability negotiation)
  @version_features %{
    "1.0.0" => [
      :navigation,
      :combat,
      :inventory,
      :equipment,
      :dialogue,
      :shop,
      :container,
      :gathering,
      :crafting,
      :emotes,
      :social,
      :ghost_death,
      :quests,
      :timers
    ]
  }

  @type version_info :: %{
          client_version: Version.t(),
          api_version: String.t(),
          features: [atom()],
          update_available: boolean()
        }

  @doc """
  Validates client version from channel join params.

  Returns:
  - `{:ok, version_info}` - Client is compatible
  - `{:error, :update_required, %{min_version: String.t()}}` - Client too old
  - `{:error, :version_missing}` - No version provided
  """
  @spec validate_client(map()) ::
          {:ok, version_info()}
          | {:error, :update_required, %{min_version: String.t()}}
          | {:error, :version_missing}
  def validate_client(params) do
    case Map.get(params, "client_version") do
      nil ->
        {:error, :version_missing}

      version_string when is_binary(version_string) ->
        validate_version(version_string)

      _ ->
        {:error, :version_missing}
    end
  end

  @doc """
  Validates a version string against minimum requirements.
  """
  @spec validate_version(String.t()) ::
          {:ok, version_info()}
          | {:error, :update_required, %{min_version: String.t()}}
  def validate_version(version_string) do
    case parse_version(version_string) do
      {:ok, client_version} ->
        {:ok, min_version} = parse_version(min_client_version())

        case Version.compare(client_version, min_version) do
          :lt ->
            Logger.warning(
              "Client version #{version_string} below minimum #{min_client_version()}"
            )

            {:error, :update_required, %{min_version: min_client_version()}}

          _ ->
            {:ok, current_version} = parse_version(current_api_version())

            {:ok,
             %{
               client_version: client_version,
               api_version: current_api_version(),
               features: features_for_version(version_string),
               update_available: Version.compare(client_version, current_version) == :lt
             }}
        end

      :error ->
        Logger.warning("Invalid client version format: #{version_string}")
        # Reject malformed versions - safer than allowing unknown clients
        {:error, :update_required, %{min_version: min_client_version()}}
    end
  end

  @doc """
  Returns features available for a given client version.
  Used for capability negotiation - server can adapt responses based on client capabilities.
  """
  @spec features_for_version(String.t()) :: [atom()]
  def features_for_version(version_string) do
    # Find the highest version <= client version
    @version_features
    |> Enum.filter(fn {v, _features} ->
      case {parse_version(v), parse_version(version_string)} do
        {{:ok, feature_v}, {:ok, client_v}} ->
          Version.compare(feature_v, client_v) != :gt

        _ ->
          false
      end
    end)
    |> Enum.sort_by(fn {v, _} -> v end, {:desc, Version})
    |> List.first()
    |> case do
      {_, features} -> features
      nil -> []
    end
  end

  @doc """
  Checks if a client supports a specific feature.
  """
  @spec client_supports?(version_info() | nil, atom()) :: boolean()
  def client_supports?(nil, _feature), do: true
  def client_supports?(%{features: features}, feature), do: feature in features

  @doc """
  Returns the current API version.
  """
  @spec current_api_version() :: String.t()
  def current_api_version do
    Application.get_env(:loka, __MODULE__)[:current_version] || @current_api_version
  end

  @doc """
  Returns the minimum supported client version.
  """
  @spec min_client_version() :: String.t()
  def min_client_version do
    Application.get_env(:loka, __MODULE__)[:min_version] || @min_client_version
  end

  @doc """
  Returns server capabilities for client introspection.
  Sent to client on successful join so they know what features are available.
  """
  @spec server_capabilities() :: map()
  def server_capabilities do
    %{
      api_version: current_api_version(),
      min_client_version: min_client_version(),
      features: features_for_version(current_api_version()),
      protocol: "phoenix_channel_v2"
    }
  end

  # Parse version string, handling common formats
  defp parse_version(version_string) do
    # Trim whitespace and strip 'v' prefix if present
    cleaned =
      version_string
      |> String.trim()
      |> String.trim_leading("v")

    # Add .0 suffixes if needed (e.g., "1" -> "1.0.0", "1.2" -> "1.2.0")
    # Only consider the main version part (before any - or +)
    # Capture the separator to preserve it correctly
    {main_version, suffix} =
      case Regex.run(~r/^([^-+]+)([-+].+)?$/, cleaned) do
        [_, main] -> {main, ""}
        [_, main, rest] -> {main, rest}
        _ -> {cleaned, ""}
      end

    parts = String.split(main_version, ".")

    normalized_main =
      case length(parts) do
        1 -> "#{main_version}.0.0"
        2 -> "#{main_version}.0"
        _ -> main_version
      end

    # Reattach suffix for pre-release/build metadata
    normalized = normalized_main <> suffix

    Version.parse(normalized)
  end
end
