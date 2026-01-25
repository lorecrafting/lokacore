// Tests for bottom bar UI system
use loka_book::ui::{AvailableExits, GameTime, BottomBarState, ButtonRegion, ButtonRegions};

#[test]
fn test_available_exits_formatting() {
    let mut exits = AvailableExits::none();
    assert!(exits.format_buttons().contains("No exits"));

    exits.north = true;
    exits.south = true;
    let formatted = exits.format_buttons();
    assert!(formatted.contains("↑N"));
    assert!(formatted.contains("↓S"));
    assert!(!formatted.contains("→E"));

    println!("✅ Exit button formatting works");
}

#[test]
fn test_exits_from_directions() {
    let exits = AvailableExits::from_directions(&["north", "east", "up"]);
    assert!(exits.north);
    assert!(exits.east);
    assert!(exits.up);
    assert!(!exits.south);
    assert!(!exits.west);
    assert!(!exits.down);

    println!("✅ Creating exits from direction list works");
}

#[test]
fn test_game_time_formatting() {
    let time = GameTime {
        hour: 14,
        minute: 30,
        day: "Moonday".to_string(),
    };

    let formatted = time.format();
    assert!(formatted.contains("Moonday"));
    assert!(formatted.contains("14:30"));

    println!("✅ Game time formatting works");
}

#[test]
fn test_time_periods() {
    let morning = GameTime { hour: 8, minute: 0, day: "Moonday".to_string() };
    assert_eq!(morning.period(), "Morning");

    let afternoon = GameTime { hour: 15, minute: 0, day: "Moonday".to_string() };
    assert_eq!(afternoon.period(), "Afternoon");

    let night = GameTime { hour: 22, minute: 0, day: "Moonday".to_string() };
    assert_eq!(night.period(), "Night");

    println!("✅ Time period detection works");
}

#[test]
fn test_bottom_bar_formatting() {
    let exits = AvailableExits::from_directions(&["north", "south", "east"]);
    let time = GameTime::default();

    let bar = BottomBarState::format_bottom_bar(&exits, &time);

    // Check for required elements
    assert!(bar.contains("Exits:"));
    assert!(bar.contains("Chat"));
    assert!(bar.contains("Menu"));
    assert!(bar.contains("↑N"));
    assert!(bar.contains("↓S"));
    assert!(bar.contains("→E"));

    println!("✅ Bottom bar formatting includes all elements");
}

#[test]
fn test_button_region_hit_detection() {
    let region = ButtonRegion {
        id: "test_button".to_string(),
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.1,
    };

    // Inside button
    assert!(region.contains(0.6, 0.55));
    assert!(region.contains(0.5, 0.5)); // Top-left corner
    assert!(region.contains(0.7, 0.6)); // Bottom-right corner

    // Outside button
    assert!(!region.contains(0.4, 0.55)); // Left
    assert!(!region.contains(0.8, 0.55)); // Right
    assert!(!region.contains(0.6, 0.4)); // Above
    assert!(!region.contains(0.6, 0.7)); // Below

    println!("✅ Button hit detection works correctly");
}

#[test]
fn test_button_regions_find() {
    let mut regions = ButtonRegions::default();
    regions.setup_bottom_bar_regions();

    // Should find menu button in its region
    let result = regions.find_button(0.75, 0.9);
    assert!(result.is_some());
    assert_eq!(result.unwrap(), "menu");

    // Should return None for empty areas
    let result = regions.find_button(0.0, 0.0);
    assert!(result.is_none());

    println!("✅ Button region lookup works");
}

#[test]
fn test_all_exits() {
    let exits = AvailableExits::all();
    assert!(exits.north);
    assert!(exits.south);
    assert!(exits.east);
    assert!(exits.west);
    assert!(exits.up);
    assert!(exits.down);

    let formatted = exits.format_buttons();
    assert!(formatted.contains("↑N"));
    assert!(formatted.contains("↓S"));
    assert!(formatted.contains("→E"));
    assert!(formatted.contains("←W"));
    assert!(formatted.contains("⬆U"));
    assert!(formatted.contains("⬇D"));

    println!("✅ All exits display works");
}
