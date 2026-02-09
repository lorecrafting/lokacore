defmodule LokaWeb.Channels.BuilderCommands do
  @moduledoc """
  Admin-only builder command implementations for the MUD terminal.

  Thin dispatcher that routes to focused sub-modules:
  - Navigation: goto, rooms, where
  - Inspection: info, list, find
  - Testing: spawn, purge, give, flags, quests, godmode
  - World: settime, reload, validate
  - Rooms: dig, @desc, @name, create/delete room, link, unlink
  - Entities: create/edit/delete npc/item
  - Content: create/edit quest, quest info, create/info dialogue
  - Projects: project new/load/list/delete, doc write/read/list/delete, guide
  - Help: help, help <topic>

  All commands are gated by `socket.assigns.player.is_admin` at the
  GameChannel dispatch layer. These functions assume the caller is authorized.

  All output is prefixed with [BUILDER] for visual distinction.
  """

  import Phoenix.Channel, only: [push: 3]

  alias LokaWeb.Channels.BuilderCommands.{
    Navigation,
    Inspection,
    Testing,
    World,
    Rooms,
    Entities,
    Content,
    Projects,
    Help,
    Helpers
  }

  # Navigation commands
  @navigation_commands ~w(goto rooms where)a

  # Inspection commands
  @inspection_commands ~w(info list find)a

  # Testing commands
  @testing_commands ~w(spawn purge give setflag clearflag flags
                       startquest completequest resetquest quests godmode)a

  # World state commands
  @world_commands ~w(settime reload validate)a

  # Room CRUD commands
  @room_commands ~w(dig set_desc set_name create_room link unlink delete_room)a

  # Entity CRUD commands
  @entity_commands ~w(create_npc create_item edit_entity delete_npc delete_item)a

  # Content commands
  @content_commands ~w(create_quest edit_quest quest_info create_dialogue dialogue_info)a

  # Project/doc commands
  @project_commands ~w(project_new project_load project_list project_delete
                       doc_write doc_read doc_list doc_delete guide)a

  @doc """
  Execute a builder command. Returns `{:reply, :ok, socket}`.
  """
  def execute(cmd, params, socket) do
    result = dispatch(cmd, params, socket)

    case result do
      {:ok, text, socket} ->
        Helpers.push_builder(socket, text)
        {:reply, :ok, socket}

      {:ok, socket} ->
        {:reply, :ok, socket}

      {:ok_text, text} ->
        push(socket, "output", %{text: text})
        {:reply, :ok, socket}

      {:error, text, socket} ->
        Helpers.push_builder(socket, text)
        {:reply, :ok, socket}
    end
  end

  defp dispatch(cmd, params, socket) when cmd in @navigation_commands do
    Navigation.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @inspection_commands do
    Inspection.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @testing_commands do
    Testing.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @world_commands do
    World.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @room_commands do
    Rooms.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @entity_commands do
    Entities.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @content_commands do
    Content.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @project_commands do
    Projects.execute(cmd, params, socket)
  end

  defp dispatch(:help, params, _socket) do
    Help.execute(:help, params, nil)
  end

  defp dispatch(cmd, _params, socket) do
    {:error, "Unknown builder command: #{cmd}", socket}
  end
end
