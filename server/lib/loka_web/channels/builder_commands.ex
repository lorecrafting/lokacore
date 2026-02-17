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
  - Content: create/edit/delete quest, create/delete/info dialogue
  - Zones: create/edit/delete zone, zone info
  - Cutscenes: create/delete cutscene, cutscene info
  - Storylines: create/delete storyline, storyline info
  - Scripts: create/delete/info/list/validate/test/templates/attach/detach
  - Guides: guide <topic>
  - Help: help, help <topic>

  All commands are gated by `socket.assigns.player.is_admin` at the
  GameChannel dispatch layer. These functions assume the caller is authorized.

  All output is prefixed with [BUILDER] for visual distinction.
  """

  require Logger

  import Phoenix.Channel, only: [push: 3]

  alias LokaWeb.Channels.BuilderCommands.{
    Navigation,
    Inspection,
    Testing,
    World,
    Rooms,
    Entities,
    Content,
    Zones,
    Cutscenes,
    Storylines,
    Scripts,
    Publishing,
    Guides,
    Economy,
    Map,
    Help,
    Helpers
  }

  # Navigation commands
  @navigation_commands ~w(goto rooms where)a

  # Map commands
  @map_commands ~w(map)a

  # Inspection commands
  @inspection_commands ~w(info list find preview)a

  # Testing commands
  @testing_commands ~w(spawn purge give setflag clearflag flags
                       startquest completequest resetquest quests godmode)a

  # World state commands
  @world_commands ~w(settime reload validate)a

  # Room CRUD commands
  @room_commands ~w(dig set_desc set_name create_room link unlink delete_room)a

  # Entity CRUD commands
  @entity_commands ~w(create_npc create_item edit_entity delete_npc delete_item respawn)a

  # Content commands
  @content_commands ~w(create_quest edit_quest quest_info delete_quest
                       create_dialogue dialogue_info delete_dialogue)a

  # Zone commands
  @zone_commands ~w(create_zone edit_zone delete_zone zone_info)a

  # Cutscene commands
  @cutscene_commands ~w(create_cutscene delete_cutscene cutscene_info)a

  # Storyline commands
  @storyline_commands ~w(create_storyline delete_storyline storyline_info)a

  # Script commands
  @script_commands ~w(script_create delete_script script_info script_list
                      script_validate script_test script_templates
                      script_template_info script_from_template
                      script_attach script_detach)a

  # Publishing commands
  @publishing_commands ~w(publish unpublish)a

  # Economy commands
  @economy_commands ~w(economy)a

  # Guide commands
  @guide_commands ~w(guide)a

  @doc """
  Execute a builder command. Returns `{:reply, :ok, socket}`.
  """
  def execute(cmd, params, socket) do
    result =
      try do
        dispatch(cmd, params, socket)
      rescue
        e ->
          Logger.error(
            "[BUILDER] Command #{cmd} crashed: #{Exception.message(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}"
          )

          {:error, "Command failed. Check server logs for details.", socket}
      end

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

  defp dispatch(cmd, params, socket) when cmd in @map_commands do
    Map.execute(cmd, params, socket)
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

  defp dispatch(cmd, params, socket) when cmd in @zone_commands do
    Zones.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @cutscene_commands do
    Cutscenes.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @storyline_commands do
    Storylines.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @script_commands do
    Scripts.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @publishing_commands do
    Publishing.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @economy_commands do
    Economy.execute(cmd, params, socket)
  end

  defp dispatch(cmd, params, socket) when cmd in @guide_commands do
    Guides.execute(cmd, params, socket)
  end

  defp dispatch(:help, params, _socket) do
    Help.execute(:help, params, nil)
  end

  defp dispatch(cmd, _params, socket) do
    {:error, "Unknown builder command: #{cmd}", socket}
  end
end
