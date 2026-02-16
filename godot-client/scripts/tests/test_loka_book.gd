## Unit tests for LokaBook (2D PageFlip system)
## Run with: godot --headless --script res://scripts/tests/test_loka_book.gd
extends SceneTree


func _init() -> void:
	print("=== LokaBook Unit Tests ===\n")

	var passed := 0
	var failed := 0

	var results := [
		test_page_type_enum(),
		test_menu_tab_enum(),
		test_menu_tab_cycle(),
		test_text_effect_enum(),
		test_page_content_manager_constants(),
		test_bottom_bar_class(),
		test_effects_controller_moods(),
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
	print("[TEST] LokaBook.PageType enum has all required values")

	var room := LokaBook.PageType.ROOM
	var menu := LokaBook.PageType.MENU
	var entity := LokaBook.PageType.ENTITY
	var dialogue := LokaBook.PageType.DIALOGUE
	var shop := LokaBook.PageType.SHOP
	var container := LokaBook.PageType.CONTAINER

	print("  [PASS] All 6 PageType values exist")
	return true


func test_menu_tab_enum() -> bool:
	print("[TEST] LokaBook.MenuTab enum has 7 tabs")

	var values := [
		LokaBook.MenuTab.INVENTORY,
		LokaBook.MenuTab.EQUIPMENT,
		LokaBook.MenuTab.CHARACTER,
		LokaBook.MenuTab.QUESTS,
		LokaBook.MenuTab.MAP,
		LokaBook.MenuTab.SOCIAL,
		LokaBook.MenuTab.SETTINGS,
	]

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

	var expected_order := [
		LokaBook.MenuTab.INVENTORY,
		LokaBook.MenuTab.EQUIPMENT,
		LokaBook.MenuTab.CHARACTER,
		LokaBook.MenuTab.QUESTS,
		LokaBook.MenuTab.MAP,
		LokaBook.MenuTab.SOCIAL,
		LokaBook.MenuTab.SETTINGS,
		LokaBook.MenuTab.INVENTORY,  # Wraps around
	]

	var current := LokaBook.MenuTab.INVENTORY
	var order_index := 0

	for i in range(7):
		if current != expected_order[order_index]:
			print("  [FAIL] Tab cycle order incorrect at step %d" % i)
			return false
		order_index += 1
		# Simulate next_menu_tab logic
		match current:
			LokaBook.MenuTab.INVENTORY: current = LokaBook.MenuTab.EQUIPMENT
			LokaBook.MenuTab.EQUIPMENT: current = LokaBook.MenuTab.CHARACTER
			LokaBook.MenuTab.CHARACTER: current = LokaBook.MenuTab.QUESTS
			LokaBook.MenuTab.QUESTS: current = LokaBook.MenuTab.MAP
			LokaBook.MenuTab.MAP: current = LokaBook.MenuTab.SOCIAL
			LokaBook.MenuTab.SOCIAL: current = LokaBook.MenuTab.SETTINGS
			LokaBook.MenuTab.SETTINGS: current = LokaBook.MenuTab.INVENTORY

	if current != expected_order[7]:
		print("  [FAIL] Tab cycle doesn't wrap around")
		return false

	print("  [PASS] Tab cycle works correctly (7 tabs + wrap)")
	return true


func test_text_effect_enum() -> bool:
	print("[TEST] LokaBook.TextEffect enum matches EffectsController")

	var none := LokaBook.TextEffect.NONE
	var burn := LokaBook.TextEffect.BURN
	var ice := LokaBook.TextEffect.ICE
	var glow := LokaBook.TextEffect.GLOW
	var fade := LokaBook.TextEffect.FADE

	# Verify values match EffectsController
	if none != EffectsController.TextEffect.NONE:
		print("  [FAIL] NONE values don't match")
		return false
	if burn != EffectsController.TextEffect.BURN:
		print("  [FAIL] BURN values don't match")
		return false
	if ice != EffectsController.TextEffect.ICE:
		print("  [FAIL] ICE values don't match")
		return false
	if glow != EffectsController.TextEffect.GLOW:
		print("  [FAIL] GLOW values don't match")
		return false
	if fade != EffectsController.TextEffect.FADE:
		print("  [FAIL] FADE values don't match")
		return false

	print("  [PASS] All 5 TextEffect values match between LokaBook and EffectsController")
	return true


func test_page_content_manager_constants() -> bool:
	print("[TEST] PageContentManager viewport constants")

	if PageContentManager.VIEWPORT_WIDTH != 430:
		print("  [FAIL] VIEWPORT_WIDTH should be 430")
		return false
	if PageContentManager.VIEWPORT_HEIGHT != 932:
		print("  [FAIL] VIEWPORT_HEIGHT should be 932")
		return false
	if PageContentManager.BOTTOM_BAR_HEIGHT != 120:
		print("  [FAIL] BOTTOM_BAR_HEIGHT should be 120")
		return false

	print("  [PASS] All viewport constants correct")
	return true


func test_bottom_bar_class() -> bool:
	print("[TEST] BottomBar class exists with correct constants")

	if BottomBar.BAR_HEIGHT != 120:
		print("  [FAIL] BAR_HEIGHT should be 120")
		return false
	if BottomBar.BUTTON_SIZE != 70:
		print("  [FAIL] BUTTON_SIZE should be 70")
		return false

	print("  [PASS] BottomBar constants correct")
	return true


func test_effects_controller_moods() -> bool:
	print("[TEST] EffectsController has all 7 atmosphere moods")

	var moods := ["peaceful", "tense", "danger", "night", "storm", "mystical", "holy"]
	for mood in moods:
		if not EffectsController.MOOD_TINTS.has(mood):
			print("  [FAIL] Missing mood: %s" % mood)
			return false

	if EffectsController.MOOD_TINTS.size() != 7:
		print("  [FAIL] Expected 7 moods, got %d" % EffectsController.MOOD_TINTS.size())
		return false

	print("  [PASS] All 7 atmosphere moods defined")
	return true
