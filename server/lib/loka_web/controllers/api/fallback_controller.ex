defmodule LokaWeb.Api.FallbackController do
  @moduledoc """
  Fallback controller for API error handling.
  """
  use LokaWeb, :controller

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn
    |> put_status(:unprocessable_entity)
    |> put_view(json: LokaWeb.Api.ErrorJSON)
    |> render(:error, changeset: changeset)
  end

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> put_view(json: LokaWeb.Api.ErrorJSON)
    |> render(:error, message: "Not found")
  end

  def call(conn, {:error, :unauthorized}) do
    conn
    |> put_status(:unauthorized)
    |> put_view(json: LokaWeb.Api.ErrorJSON)
    |> render(:error, message: "Unauthorized")
  end
end
