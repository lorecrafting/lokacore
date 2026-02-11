defmodule Loka.Engine.Script.CreateRoomTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.Script.ActionQueue
  alias Loka.Engine.{Entities, Spawner}

  setup do
    ActionQueue.init()
    on_exit(fn -> ActionQueue.clear() end)
    :ok
  end

  describe "create_room action queuing" do
    test "queues a create_room action" do
      action =
        {:create_room,
         %{
           attrs: %{name: "A dark tunnel", description: "Rough-hewn stone walls."},
           source_room_id: "room_1",
           creator_id: "entity_1"
         }}

      assert :ok = ActionQueue.queue(action)

      [{:create_room, params}] = ActionQueue.get()
      assert params.attrs.name == "A dark tunnel"
      assert params.source_room_id == "room_1"
      assert params.creator_id == "entity_1"
    end

    test "queues create_room with exit_to" do
      action =
        {:create_room,
         %{
           attrs: %{
             name: "Hidden Chamber",
             exit_to: %{direction: "north", room_id: "room_1"}
           },
           source_room_id: "room_1",
           creator_id: "entity_1"
         }}

      assert :ok = ActionQueue.queue(action)

      [{:create_room, params}] = ActionQueue.get()
      assert params.attrs.exit_to.direction == "north"
    end
  end

  describe "create_room rate limiting" do
    test "enforces room creation limit of 3" do
      for i <- 1..3 do
        assert :ok =
                 ActionQueue.queue(
                   {:create_room,
                    %{
                      attrs: %{name: "Room #{i}"},
                      source_room_id: "r1",
                      creator_id: "e1"
                    }}
                 )
      end

      # 4th should be rate limited
      assert {:error, :rate_limited} =
               ActionQueue.queue(
                 {:create_room,
                  %{
                    attrs: %{name: "Room 4"},
                    source_room_id: "r1",
                    creator_id: "e1"
                  }}
               )
    end

    test "room_creates appears in counts" do
      ActionQueue.queue(
        {:create_room, %{attrs: %{name: "Test"}, source_room_id: "r1", creator_id: "e1"}}
      )

      counts = ActionQueue.get_counts()
      assert counts.room_creates == 1
    end
  end

  describe "create_room execution" do
    test "creates a room in the database" do
      action =
        {:create_room,
         %{
           attrs: %{name: "A dark tunnel", description: "Rough-hewn stone walls."},
           source_room_id: nil,
           creator_id: "script_entity_1"
         }}

      ActionQueue.queue(action)
      actions = ActionQueue.get()
      {:ok, results} = ActionQueue.execute_all(actions)

      assert results.success == 1
      assert results.failed == 0
    end

    test "created room has script_created and dynamic tags" do
      action =
        {:create_room,
         %{
           attrs: %{name: "Mine Shaft", tags: ["underground"]},
           source_room_id: nil,
           creator_id: "miner_1"
         }}

      ActionQueue.queue(action)
      actions = ActionQueue.get()
      ActionQueue.execute_all(actions)

      # Find the created room by searching entities
      rooms = Entities.list_by_type(:room)

      room =
        Enum.find(rooms, fn r ->
          entity = Entities.to_entity(r)
          entity.short_desc == "Mine Shaft"
        end)

      assert room
      entity = Entities.to_entity(room)
      assert "script_created" in entity.tags
      assert "dynamic" in entity.tags
      assert "underground" in entity.tags
    end

    test "creates bidirectional exits when exit_to specified" do
      # First create a source room
      {:ok, source_room} = Spawner.create_room(short_desc: "Starting Room")

      action =
        {:create_room,
         %{
           attrs: %{
             name: "Connected Room",
             exit_to: %{direction: "north", room_id: source_room.id}
           },
           source_room_id: source_room.id,
           creator_id: "builder_1"
         }}

      ActionQueue.queue(action)
      actions = ActionQueue.get()
      ActionQueue.execute_all(actions)

      # Find exits connecting the rooms
      exits = Entities.list_by_type(:exit)

      related_exits =
        exits
        |> Enum.map(&Entities.to_entity/1)
        |> Enum.filter(fn e ->
          exit_comp = get_in(e.components, ["exit"]) || %{}
          dest_id = Map.get(exit_comp, "destination_id")
          # Exit is from source_room or points to source_room
          e.location_id == source_room.id || dest_id == source_room.id
        end)

      # Should have at least 2 exits (north from source + south to source)
      assert length(related_exits) >= 2
    end

    test "create_room without name fails gracefully" do
      action =
        {:create_room,
         %{
           attrs: %{description: "No name room"},
           source_room_id: nil,
           creator_id: "e1"
         }}

      ActionQueue.queue(action)
      actions = ActionQueue.get()
      {:ok, results} = ActionQueue.execute_all(actions)

      assert results.failed == 1
    end
  end

  describe "limits config" do
    test "limits include room_creates" do
      limits = ActionQueue.limits()
      assert limits.room_creates == 3
    end
  end
end
