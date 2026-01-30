## Unit tests for GameState singleton
## Run with: godot --headless --script res://scripts/tests/test_game_state.gd
extends SceneTree

# Load the GameState script directly for testing
const GameStateScript = preload("res://scripts/game_state.gd")
var game_state: Node = null

# Access PageType enum from the script class
var PageType = GameStateScript.PageType


func _init() -> void:
	print("=== GameState Unit Tests ===\n")

	# Create a local instance of GameState for testing
	game_state = GameStateScript.new()

	var passed := 0
	var failed := 0

	# Run all tests
	var results := [
		test_page_type_enum(),
		test_set_page(),
		test_add_event(),
		test_event_max_limit(),
		test_clear_events(),
		test_dialogue_start_end(),
		test_shop_open_close(),
		test_container_open_close(),
	]

	for result in results:
		if result:
			passed += 1
		else:
			failed += 1

	# Cleanup
	game_state.free()

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


func test_page_type_enum() -> bool:
	print("[TEST] PageType enum exists with correct values")

	# Verify enum values exist (use = instead of := for enum values)
	var room = PageType.ROOM
	var menu = PageType.MENU
	var entity = PageType.ENTITY
	var dialogue = PageType.DIALOGUE
	var shop = PageType.SHOP
	var container = PageType.CONTAINER

	# Verify they are distinct
	var values := [room, menu, entity, dialogue, shop, container]
	var unique := {}
	for v in values:
		if unique.has(v):
			print("  [FAIL] Duplicate enum value: %s" % v)
			return false
		unique[v] = true

	print("  [PASS] All 6 PageType values are unique")
	return true


func test_set_page() -> bool:
	print("[TEST] set_page() changes current_page and emits signal")

	# Reset state
	game_state.current_page = PageType.ROOM
	game_state.previous_page = PageType.ROOM

	# Track signal emission
	var signal_received := false
	var received_page = null
	var callback := func(new_page):
		signal_received = true
		received_page = new_page

	game_state.page_changed.connect(callback)

	# Set to a new page
	game_state.set_page(PageType.MENU)

	game_state.page_changed.disconnect(callback)

	if not signal_received:
		print("  [FAIL] page_changed signal was not emitted")
		return false

	if game_state.current_page != PageType.MENU:
		print("  [FAIL] current_page not updated")
		return false

	if game_state.previous_page != PageType.ROOM:
		print("  [FAIL] previous_page not tracked")
		return false

	if received_page != PageType.MENU:
		print("  [FAIL] Signal received wrong page type")
		return false

	print("  [PASS] Page changed correctly and signal emitted")
	return true


func test_add_event() -> bool:
	print("[TEST] add_event() adds to events array and emits signal")

	# Clear events first
	game_state.events.clear()

	# Track signal emission
	var signal_received := false
	var callback := func():
		signal_received = true

	game_state.events_changed.connect(callback)

	# Add an event
	game_state.add_event("Test event message")

	game_state.events_changed.disconnect(callback)

	if not signal_received:
		print("  [FAIL] events_changed signal was not emitted")
		return false

	if game_state.events.size() != 1:
		print("  [FAIL] Event was not added to array")
		return false

	var event: Dictionary = game_state.events[0]
	if event.get("text") != "Test event message":
		print("  [FAIL] Event text incorrect")
		return false

	if not event.has("timestamp"):
		print("  [FAIL] Event missing timestamp")
		return false

	print("  [PASS] Event added correctly with timestamp")
	return true


func test_event_max_limit() -> bool:
	print("[TEST] Events array respects MAX_EVENTS limit")

	# Clear events
	game_state.events.clear()

	# Add more than MAX_EVENTS
	for i in range(game_state.MAX_EVENTS + 5):
		game_state.add_event("Event %d" % i)

	if game_state.events.size() != game_state.MAX_EVENTS:
		print("  [FAIL] Events array exceeded MAX_EVENTS (%d vs %d)" % [game_state.events.size(), game_state.MAX_EVENTS])
		return false

	# Verify oldest events were removed (FIFO)
	var first_event: Dictionary = game_state.events[0]
	if first_event.get("text") != "Event 5":
		print("  [FAIL] Oldest events were not removed correctly")
		return false

	print("  [PASS] Events array limited to %d entries" % game_state.MAX_EVENTS)
	return true


func test_clear_events() -> bool:
	print("[TEST] clear_events() empties array and emits signal")

	# Add some events first
	game_state.events.clear()
	game_state.add_event("Event 1")
	game_state.add_event("Event 2")

	# Track signal emission
	var signal_received := false
	var callback := func():
		signal_received = true

	game_state.events_changed.connect(callback)

	game_state.clear_events()

	game_state.events_changed.disconnect(callback)

	if not signal_received:
		print("  [FAIL] events_changed signal was not emitted")
		return false

	if game_state.events.size() != 0:
		print("  [FAIL] Events array not cleared")
		return false

	print("  [PASS] Events cleared successfully")
	return true


func test_dialogue_start_end() -> bool:
	print("[TEST] start_dialogue() and end_dialogue() manage state correctly")

	# Reset state
	game_state.current_page = PageType.ROOM
	game_state.dialogue_data = {}
	game_state.dialogue_history = []

	# Start dialogue
	var test_data := {
		"speaker": "Test NPC",
		"text": "Hello traveler!",
		"choices": [{"text": "Hi"}]
	}

	game_state.start_dialogue(test_data)

	if game_state.current_page != PageType.DIALOGUE:
		print("  [FAIL] Page not set to DIALOGUE")
		return false

	if game_state.dialogue_data.is_empty():
		print("  [FAIL] dialogue_data not set")
		return false

	if game_state.previous_page != PageType.ROOM:
		print("  [FAIL] previous_page not tracked")
		return false

	# End dialogue
	game_state.end_dialogue()

	if game_state.current_page != PageType.ROOM:
		print("  [FAIL] Did not return to previous page")
		return false

	if not game_state.dialogue_data.is_empty():
		print("  [FAIL] dialogue_data not cleared")
		return false

	print("  [PASS] Dialogue lifecycle managed correctly")
	return true


func test_shop_open_close() -> bool:
	print("[TEST] open_shop() and close_shop() manage state correctly")

	# Reset state
	game_state.current_page = PageType.ROOM
	game_state.shop_data = {}

	# Open shop
	var test_data := {
		"npc_name": "Merchant",
		"items": [{"name": "Sword", "price": 50}]
	}

	game_state.open_shop(test_data)

	if game_state.current_page != PageType.SHOP:
		print("  [FAIL] Page not set to SHOP")
		return false

	if game_state.shop_data.is_empty():
		print("  [FAIL] shop_data not set")
		return false

	# Close shop
	game_state.close_shop()

	if game_state.current_page != PageType.ROOM:
		print("  [FAIL] Did not return to previous page")
		return false

	if not game_state.shop_data.is_empty():
		print("  [FAIL] shop_data not cleared")
		return false

	print("  [PASS] Shop lifecycle managed correctly")
	return true


func test_container_open_close() -> bool:
	print("[TEST] open_container() and close_container() manage state correctly")

	# Reset state
	game_state.current_page = PageType.ROOM
	game_state.container_data = {}

	# Open container
	var test_data := {
		"entity_name": "Treasure Chest",
		"items": [{"name": "Gold Coin", "quantity": 10}]
	}

	game_state.open_container(test_data)

	if game_state.current_page != PageType.CONTAINER:
		print("  [FAIL] Page not set to CONTAINER")
		return false

	if game_state.container_data.is_empty():
		print("  [FAIL] container_data not set")
		return false

	# Close container
	game_state.close_container()

	if game_state.current_page != PageType.ROOM:
		print("  [FAIL] Did not return to previous page")
		return false

	if not game_state.container_data.is_empty():
		print("  [FAIL] container_data not cleared")
		return false

	print("  [PASS] Container lifecycle managed correctly")
	return true
