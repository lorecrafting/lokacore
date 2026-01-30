## Unit tests for MockWorld data structures
## Run with: godot --headless --script res://scripts/tests/test_mock_world.gd
extends SceneTree

const MockWorldScript = preload("res://scripts/mock_world.gd")


func _init() -> void:
	print("=== MockWorld Unit Tests ===\n")

	var passed := 0
	var failed := 0

	var results := [
		test_room_class_exists(),
		test_npc_class_exists(),
		test_item_class_exists(),
		test_start_room_defined(),
	]

	for result in results:
		if result:
			passed += 1
		else:
			failed += 1

	print("\n=== Results ===")
	print("Passed: %d" % passed)
	print("Failed: %d" % failed)
	print("Total: %d" % (passed + failed))

	if failed > 0:
		print("\n[FAIL] Some tests failed!")
		quit(1)
	else:
		print("\n[PASS] All tests passed!")
		quit(0)


func test_room_class_exists() -> bool:
	print("[TEST] Room class exists with required properties")

	# Create a room
	var room = MockWorldScript.Room.new(
		"test_room",
		"Test Room",
		"A test room description",
		{"north": "other_room"},
		[],
		[]
	)

	if room.key != "test_room":
		print("  [FAIL] Room key not set correctly")
		return false

	if room.name != "Test Room":
		print("  [FAIL] Room name not set correctly")
		return false

	if room.description != "A test room description":
		print("  [FAIL] Room description not set correctly")
		return false

	if not room.exits.has("north"):
		print("  [FAIL] Room exits not set correctly")
		return false

	print("  [PASS] Room class works correctly")
	return true


func test_npc_class_exists() -> bool:
	print("[TEST] NPC class exists with required properties")

	var npc = MockWorldScript.NPC.new(
		"npc_123",
		"test_npc",
		"Test NPC",
		"npc",
		"A test NPC stands here.",
		"A detailed description of the test NPC."
	)

	if npc.id != "npc_123":
		print("  [FAIL] NPC id not set correctly")
		return false

	if npc.key != "test_npc":
		print("  [FAIL] NPC key not set correctly")
		return false

	if npc.name != "Test NPC":
		print("  [FAIL] NPC name not set correctly")
		return false

	print("  [PASS] NPC class works correctly")
	return true


func test_item_class_exists() -> bool:
	print("[TEST] Item class exists with required properties")

	var item = MockWorldScript.Item.new(
		"item_456",
		"test_item",
		"Test Item",
		"item",
		"A test item lies here.",
		"A detailed description of the test item."
	)

	if item.id != "item_456":
		print("  [FAIL] Item id not set correctly")
		return false

	if item.key != "test_item":
		print("  [FAIL] Item key not set correctly")
		return false

	if item.name != "Test Item":
		print("  [FAIL] Item name not set correctly")
		return false

	print("  [PASS] Item class works correctly")
	return true


func test_start_room_defined() -> bool:
	print("[TEST] Start room is defined")

	# MockWorld is a singleton, so we need to create an instance to access start_room
	var mock_world = MockWorldScript.new()
	var start_room_value = mock_world.start_room

	if start_room_value == null or start_room_value == "":
		print("  [FAIL] start_room not defined")
		mock_world.free()
		return false

	print("  [PASS] start_room is defined: %s" % start_room_value)
	mock_world.free()
	return true
