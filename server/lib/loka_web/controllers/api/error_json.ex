defmodule LokaWeb.Api.ErrorJSON do
  @moduledoc """
  JSON error views for API responses.
  """

  def render("error.json", %{changeset: changeset}) do
    errors =
      Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
        Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
          opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
        end)
      end)

    %{errors: errors}
  end

  def render("error.json", %{message: message}) do
    %{error: message}
  end
end
