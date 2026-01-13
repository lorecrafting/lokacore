defmodule Loka.Plugins.Guilds.Validators.GuildValidator do
  @moduledoc """
  Content validator for guild-related prototype files.

  Validates guild hall prototypes and other guild content loaded from YAML.
  """

  @behaviour Loka.Engine.ContentValidator.Plugin

  alias Loka.Engine.PrototypeLoader

  @impl true
  def name, do: :guild_validator

  @impl true
  def ready? do
    # Check if PrototypeLoader is available
    Process.whereis(PrototypeLoader) != nil
  end

  @impl true
  def validate do
    prototypes = PrototypeLoader.all()

    guild_halls =
      prototypes
      |> Enum.filter(&is_guild_hall?/1)

    errors =
      guild_halls
      |> Enum.flat_map(&validate_guild_hall/1)

    warnings = []

    %{critical: errors, warnings: warnings}
  end

  # =============================================================================
  # Validation Helpers
  # =============================================================================

  defp is_guild_hall?({_id, proto}) do
    Map.get(proto, :type) == "guild_hall" or
      Map.get(proto, :tags, []) |> Enum.member?("guild_hall")
  end

  defp validate_guild_hall({id, proto}) do
    []
    |> validate_required_fields(id, proto)
    |> validate_capacity(id, proto)
  end

  defp validate_required_fields(errors, id, proto) do
    required = [:name, :description]

    missing =
      Enum.filter(required, fn field ->
        not Map.has_key?(proto, field) or is_nil(Map.get(proto, field))
      end)

    if Enum.empty?(missing) do
      errors
    else
      ["Guild hall '#{id}' missing required fields: #{inspect(missing)}" | errors]
    end
  end

  defp validate_capacity(errors, id, proto) do
    capacity = Map.get(proto, :capacity)

    cond do
      is_nil(capacity) ->
        errors

      not is_integer(capacity) ->
        ["Guild hall '#{id}' capacity must be an integer" | errors]

      capacity < 1 ->
        ["Guild hall '#{id}' capacity must be at least 1" | errors]

      true ->
        errors
    end
  end
end
