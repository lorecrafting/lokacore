defmodule LokaWeb.Api.ValidateController do
  @moduledoc """
  Content validation API for content creators.

  Validates YAML content against game rules before committing.
  Returns specific errors with context to help fix issues.

  Uses `Loka.Content.Validator` for shared validation logic that can also
  be used by LiveView components and mix tasks.

  ## Endpoints

  - `POST /api/validate/quest` - Validate quest YAML
  - `POST /api/validate/npc` - Validate NPC YAML
  - `POST /api/validate/room` - Validate room YAML
  - `POST /api/validate/storyline` - Validate storyline YAML

  ## Request Format

  ```json
  {
    "content": "id: my_quest\\nname: My Quest\\n..."
  }
  ```

  ## Response Format

  Success:
  ```json
  {
    "valid": true,
    "warnings": []
  }
  ```

  Failure:
  ```json
  {
    "valid": false,
    "errors": [
      {
        "field": "objectives",
        "message": "At least one objective is required",
        "suggestion": "Add an objectives list with at least one objective"
      }
    ],
    "warnings": []
  }
  ```
  """

  use LokaWeb, :controller

  alias Loka.Content.Validator

  @doc """
  Validates quest YAML content.
  """
  def quest(conn, %{"content" => content}) do
    validate_and_respond(conn, :quest, content)
  end

  def quest(conn, _params), do: missing_content(conn)

  @doc """
  Validates NPC YAML content.
  """
  def npc(conn, %{"content" => content}) do
    validate_and_respond(conn, :npc, content)
  end

  def npc(conn, _params), do: missing_content(conn)

  @doc """
  Validates room YAML content.
  """
  def room(conn, %{"content" => content}) do
    validate_and_respond(conn, :room, content)
  end

  def room(conn, _params), do: missing_content(conn)

  @doc """
  Validates storyline YAML content.
  """
  def storyline(conn, %{"content" => content}) do
    validate_and_respond(conn, :storyline, content)
  end

  def storyline(conn, _params), do: missing_content(conn)

  # Validate content and return JSON response
  defp validate_and_respond(conn, type, content) do
    result = Validator.validate_yaml(type, content)

    if result.valid do
      conn
      |> put_status(:ok)
      |> json(%{
        valid: true,
        warnings: result.warnings
      })
    else
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{
        valid: false,
        errors: result.errors,
        warnings: result.warnings
      })
    end
  end

  defp missing_content(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{
      valid: false,
      errors: [
        %{
          field: nil,
          message: "Missing 'content' field in request body",
          suggestion: "Send JSON with {\"content\": \"your yaml here\"}"
        }
      ],
      warnings: []
    })
  end
end
