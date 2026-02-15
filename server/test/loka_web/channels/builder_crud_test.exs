defmodule LokaWeb.Channels.BuilderCRUDTest do
  @moduledoc """
  Channel-based integration tests for builder content CRUD commands.

  Tests the full lifecycle (create → info → delete) for each content type
  through the game channel, verifying commands produce expected output.
  """
  use Loka.ChannelCase, async: false

  alias Loka.Auth.Guardian

  @timeout 2000

  setup do
    {_, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
    # Seed the world from YAML via EntitySeeder
    Loka.Engine.EntitySeeder.seed()

    admin = create_test_player(name: "CRUDTester")

    admin =
      admin
      |> Ecto.Changeset.change(%{is_admin: true})
      |> Loka.Repo.update!()

    on_exit(fn ->
      {_, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
    end)

    %{admin: admin}
  end

  describe "zone lifecycle" do
    test "create, info, edit, delete", %{admin: player} do
      {:ok, socket} = connect_player(player)

      # Create
      ref = push(socket, "command", %{"input" => "create zone test_crud_zone"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_zone"
      assert text =~ "created"

      # Info
      ref = push(socket, "command", %{"input" => "zone info test_crud_zone"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_zone"

      # Edit (shows zone details)
      ref = push(socket, "command", %{"input" => "edit zone test_crud_zone"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_zone"

      # Delete
      ref = push(socket, "command", %{"input" => "delete zone test_crud_zone"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "deleted"
    end

    test "create duplicate zone returns error", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "create zone test_crud_zone_dup"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: _text}, @timeout

      ref = push(socket, "command", %{"input" => "create zone test_crud_zone_dup"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "already exists"
    end

    test "delete nonexistent zone returns error", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "delete zone test_crud_nonexistent"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "not found"
    end
  end

  describe "cutscene lifecycle" do
    test "create, info, delete", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "create cutscene test_crud_cs"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_cs"
      assert text =~ "created"

      ref = push(socket, "command", %{"input" => "cutscene info test_crud_cs"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_cs"

      ref = push(socket, "command", %{"input" => "delete cutscene test_crud_cs"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "deleted"
    end
  end

  describe "storyline lifecycle" do
    test "create, info, delete", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "create storyline test_crud_sl"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_sl"
      assert text =~ "created"

      ref = push(socket, "command", %{"input" => "storyline info test_crud_sl"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_sl"

      ref = push(socket, "command", %{"input" => "delete storyline test_crud_sl"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "deleted"
    end
  end

  describe "script lifecycle" do
    test "create, info, list, validate, test, templates, delete", %{admin: player} do
      {:ok, socket} = connect_player(player)

      ref = push(socket, "command", %{"input" => "script create test_crud_script"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_script"
      assert text =~ "created"

      ref = push(socket, "command", %{"input" => "script info test_crud_script"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_script"

      ref = push(socket, "command", %{"input" => "script list"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "script"

      ref = push(socket, "command", %{"input" => "script validate test_crud_script"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_script"

      ref = push(socket, "command", %{"input" => "script test test_crud_script"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "test_crud_script"

      ref = push(socket, "command", %{"input" => "script templates"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "Template"

      ref = push(socket, "command", %{"input" => "script delete test_crud_script"})
      assert_reply ref, :ok, %{}, @timeout
      assert_push "output", %{text: text}, @timeout
      assert text =~ "deleted"
    end
  end

  defp connect_player(player) do
    {:ok, token, _claims} = Guardian.encode_and_sign(player, %{})
    {:ok, socket} = connect(LokaWeb.UserSocket, %{"token" => token})
    {:ok, _reply, socket} = subscribe_and_join(socket, LokaWeb.GameChannel, "game:lobby", %{})

    assert_push "game_state", _state, @timeout

    {:ok, socket}
  end
end
