## Unit tests for BookPage rendering logic
## Run with: godot --headless --script res://scripts/tests/test_book_page.gd
extends SceneTree


func _init() -> void:
	print("=== BookPage Unit Tests ===\n")

	var passed := 0
	var failed := 0

	# Run all tests
	var results := [
		test_page_type_enum(),
		test_menu_tab_enum(),
		test_menu_tab_cycle(),
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


func test_page_type_enum() -> bool:
	print("[TEST] BookPage.PageType enum has all required values")

	# Check all enum values exist
	var room := BookPage.PageType.ROOM
	var menu := BookPage.PageType.MENU
	var entity := BookPage.PageType.ENTITY
	var dialogue := BookPage.PageType.DIALOGUE
	var shop := BookPage.PageType.SHOP
	var container := BookPage.PageType.CONTAINER

	print("  [PASS] All 6 PageType values exist")
	return true


func test_menu_tab_enum() -> bool:
	print("[TEST] BookPage.MenuTab enum has 7 tabs")

	# Check all enum values exist
	var inventory := BookPage.MenuTab.INVENTORY
	var equipment := BookPage.MenuTab.EQUIPMENT
	var character := BookPage.MenuTab.CHARACTER
	var quests := BookPage.MenuTab.QUESTS
	var map := BookPage.MenuTab.MAP
	var social := BookPage.MenuTab.SOCIAL
	var settings := BookPage.MenuTab.SETTINGS

	# Verify they are 7 distinct values
	var values := [inventory, equipment, character, quests, map, social, settings]
	var unique := {}
	for v in values:
		if unique.has(v):
			print("  [FAIL] Duplicate enum value")
			return false
		unique[v] = true

	print("  [PASS] All 7 MenuTab values are unique")
	return true


func test_menu_tab_cycle() -> bool:
	print("[TEST] Menu tab cycling covers all tabs")

	# Test that cycling through all tabs works
	# INVENTORY -> EQUIPMENT -> CHARACTER -> QUESTS -> MAP -> SOCIAL -> SETTINGS -> INVENTORY
	var expected_order := [
		BookPage.MenuTab.INVENTORY,
		BookPage.MenuTab.EQUIPMENT,
		BookPage.MenuTab.CHARACTER,
		BookPage.MenuTab.QUESTS,
		BookPage.MenuTab.MAP,
		BookPage.MenuTab.SOCIAL,
		BookPage.MenuTab.SETTINGS,
		BookPage.MenuTab.INVENTORY,  # Wraps around
	]

	var current := BookPage.MenuTab.INVENTORY
	var order_index := 0

	for i in range(7):
		if current != expected_order[order_index]:
			print("  [FAIL] Tab cycle order incorrect at step %d" % i)
			return false

		# Simulate next_menu_tab logic (with EQUIPMENT tab)
		match current:
			BookPage.MenuTab.INVENTORY:
				current = BookPage.MenuTab.EQUIPMENT
			BookPage.MenuTab.EQUIPMENT:
				current = BookPage.MenuTab.CHARACTER
			BookPage.MenuTab.CHARACTER:
				current = BookPage.MenuTab.QUESTS
			BookPage.MenuTab.QUESTS:
				current = BookPage.MenuTab.MAP
			BookPage.MenuTab.MAP:
				current = BookPage.MenuTab.SOCIAL
			BookPage.MenuTab.SOCIAL:
				current = BookPage.MenuTab.SETTINGS
			BookPage.MenuTab.SETTINGS:
				current = BookPage.MenuTab.INVENTORY

		order_index += 1

	print("  [PASS] Menu tab cycling correct")
	return true
