defmodule LokaWeb.Channels.BuilderCommands.Help do
  @moduledoc """
  Help system: help, help <category>, help <command>.
  """

  def execute(:help, %{topic: topic}, _socket) do
    text = help_for_topic(topic)
    {:ok_text, text}
  end

  def execute(:help, _params, _socket) do
    {:ok_text, full_help()}
  end

  def full_help do
    """
    Available Commands:
      Movement:   north, south, east, west, up, down (or n,s,e,w,u,d)
      Look:       look, look <target>
      Talk:       talk <npc>
      Inventory:  inventory (or i), get <item>, drop <item>, equip, unequip
      Chat:       say <message>
      Combat:     attack <target>, flee
      Other:      who, help, clear

    Builder Commands:
      Navigation: goto <room_key>, rooms, where, find <search>
      Inspect:    info <entity>, list npcs|items|quests
      Spawn:      spawn <npc_key>, purge, give <item_key>
      Flags:      setflag <flag>, clearflag <flag>, flags
      Quests:     startquest <key>, completequest <key>, resetquest <key>, quests
      World:      settime dawn|noon|dusk|midnight, reload, validate
      Mode:       godmode

      Room CRUD:  dig <dir> <key> <name>, @desc <text>, @name <text>
                  create room <key> <name>, link <dir> <key>, unlink <dir>
                  delete room <key>

      Entity:     create npc <key> <name>, create item <key> <name>
                  edit npc|item <key> <field> <value>
                  delete npc|item <key>

      Content:    create quest <key> <name>, edit quest <key> [field] [value]
                  quest info <key>, create dialogue <npc_key>
                  dialogue info <key>

      Projects:   project new <key> <name>, project load <key>
                  project list, project delete <key>

      Documents:  doc write <filename> <content>, doc read <filename>
                  doc list, doc delete <filename>
                  guide <topic>

      AI:         /ai <prompt>     - One-shot AI prompt
                  chat             - Enter chat mode (freeform AI)
                  exit             - Leave chat mode
                  /ai clear        - Clear AI history

    Type 'help <category>' for details. Categories: rooms, entities,
    quests, projects, ai\
    """
  end

  defp help_for_topic("rooms") do
    """
    Room Commands:
      dig <dir> <key> <name>  - Create room + exits, teleport there
      @desc <text>            - Set current room description
      @name <text>            - Set current room name
      create room <key> <name> - Create room (no exits)
      link <dir> <key>        - Create exit from here to <key>
      unlink <dir>            - Remove exit in <dir>
      delete room <key>       - Delete a room

    Examples:
      dig north tavern The Rusty Tavern
      @desc A cozy tavern with a crackling fireplace.
      link east market_square
    """
  end

  defp help_for_topic("entities") do
    """
    Entity Commands:
      create npc <key> <name>            - Create NPC prototype
      create item <key> <name>           - Create item prototype
      edit npc <key> <field> <value>     - Update NPC field
      edit item <key> <field> <value>    - Update item field
      delete npc <key>                   - Delete NPC
      delete item <key>                  - Delete item

    Examples:
      create npc merchant_bob Bob the Merchant
      edit npc merchant_bob description A jolly fellow
      delete item old_sword
    """
  end

  defp help_for_topic("quests") do
    """
    Quest & Dialogue Commands:
      create quest <key> <name>    - Create quest skeleton
      edit quest <key> [field val]  - Edit quest or show details
      quest info <key>             - Show quest details
      create dialogue <npc_key>    - Create NPC dialogue
      dialogue info <key>          - Show dialogue structure

    Examples:
      create quest fetch_herbs Herb Gathering
      quest info fetch_herbs
      dialogue info novice_pema
    """
  end

  defp help_for_topic("projects") do
    """
    Project & Document Commands:
      project new <key> <name>     - Create project
      project load <key>           - Switch to project
      project list                 - List all projects
      project delete <key>         - Delete project
      doc write <file> <content>   - Save document
      doc read <file>              - Read document
      doc list                     - List documents
      doc delete <file>            - Delete document
      guide <topic>                - Read builder guide

    Examples:
      project new demo Demo World
      doc write design.md Initial world concept
      guide rooms
    """
  end

  defp help_for_topic("ai") do
    """
    AI Commands:
      /ai <prompt>    - Send prompt to AI (one-shot)
      chat            - Enter chat mode (freeform conversation)
      exit            - Leave chat mode
      /ai clear       - Clear conversation history

    In chat mode, everything you type goes to the AI.
    Use 'exit' or '/exit' to return to normal mode.

    Examples:
      /ai create a forest zone with 5 rooms
      /ai list all NPCs and suggest improvements
      chat
      > Create a tavern with a mysterious bartender
      > Now add a quest where the bartender asks for help
      exit
    """
  end

  defp help_for_topic(_) do
    "Unknown help topic. Try: help rooms, help entities, help quests, help projects, help ai"
  end
end
