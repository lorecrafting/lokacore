// Tests for menu page system
use loka_book::ui::{MenuTab, MenuState};

#[test]
fn test_menu_state_initialization() {
    let menu = MenuState::default();
    assert_eq!(menu.current_tab, MenuTab::Character);
    assert!(!menu.needs_update);
    println!("✅ MenuState initializes to Character tab");
}

#[test]
fn test_tab_switching() {
    let mut menu = MenuState::default();

    menu.switch_to(MenuTab::Inventory);
    assert_eq!(menu.current_tab, MenuTab::Inventory);
    assert!(menu.needs_update);

    menu.needs_update = false;
    menu.switch_to(MenuTab::Inventory); // Same tab
    assert!(!menu.needs_update); // Should not mark as needing update

    println!("✅ Tab switching works correctly");
}

#[test]
fn test_all_tabs() {
    let tabs = MenuTab::all();
    assert_eq!(tabs.len(), 7);
    assert_eq!(tabs[0], MenuTab::Character);
    assert_eq!(tabs[1], MenuTab::Inventory);
    assert_eq!(tabs[6], MenuTab::Settings);
    println!("✅ All 7 tabs present");
}

#[test]
fn test_tab_names() {
    assert_eq!(MenuTab::Character.name(), "Character");
    assert_eq!(MenuTab::Inventory.name(), "Inventory");
    assert_eq!(MenuTab::Quests.name(), "Quests");
    assert_eq!(MenuTab::Craft.name(), "Craft");
    assert_eq!(MenuTab::Spark.name(), "Spark");
    assert_eq!(MenuTab::Social.name(), "Social");
    assert_eq!(MenuTab::Settings.name(), "Settings");
    println!("✅ Tab names correct");
}

#[test]
fn test_tab_navigation() {
    let mut menu = MenuState::default();

    // Next navigation
    menu.next_tab();
    assert_eq!(menu.current_tab, MenuTab::Inventory);

    menu.next_tab();
    assert_eq!(menu.current_tab, MenuTab::Quests);

    // Prev navigation
    menu.prev_tab();
    assert_eq!(menu.current_tab, MenuTab::Inventory);

    menu.prev_tab();
    assert_eq!(menu.current_tab, MenuTab::Character);

    // Wrap around
    menu.prev_tab();
    assert_eq!(menu.current_tab, MenuTab::Settings);

    println!("✅ Tab navigation with next/prev works");
}

#[test]
fn test_menu_content_formatting() {
    let menu = MenuState::default();
    let content = menu.format_content();

    assert!(content.contains("~ MENU ~"));
    assert!(content.contains("[Character]")); // Active tab in brackets
    assert!(content.contains(" Inventory  ")); // Inactive tab
    assert!(content.contains("[×] Close"));

    println!("✅ Menu content formatting works");
}

#[test]
fn test_character_tab_content() {
    let menu = MenuState::default();
    let character_content = menu.get_tab_content();

    // Verify all required elements are present
    assert!(character_content.contains("Name:"));
    assert!(character_content.contains("Level:"));
    assert!(character_content.contains("XP:"));
    assert!(character_content.contains("Health:"));
    assert!(character_content.contains("Qi:"));
    assert!(character_content.contains("Stamina:"));

    // Verify all 6 attributes
    assert!(character_content.contains("STR:"));
    assert!(character_content.contains("DEX:"));
    assert!(character_content.contains("CON:"));
    assert!(character_content.contains("INT:"));
    assert!(character_content.contains("WIS:"));
    assert!(character_content.contains("CHA:"));

    // Verify gold display
    assert!(character_content.contains("Gold:"));

    // Verify XP progress bar format (contains both current and max XP)
    assert!(character_content.contains("/"));

    println!("✅ Character tab displays all required stats");
}

#[test]
fn test_inventory_tab_content() {
    let mut menu = MenuState::default();
    menu.switch_to(MenuTab::Inventory);
    let inventory_content = menu.get_tab_content();

    // Verify weight/capacity indicator
    assert!(inventory_content.contains("Capacity:"));
    assert!(inventory_content.contains("lbs"));

    // Verify equipped items section
    assert!(inventory_content.contains("Equipped"));
    assert!(inventory_content.contains("[Weapon]"));
    assert!(inventory_content.contains("[Armor]"));

    // Verify inventory section
    assert!(inventory_content.contains("Inventory"));

    // Verify items with quantities
    assert!(inventory_content.contains("(x"));

    // Verify item descriptions are included
    assert!(inventory_content.contains("Restores"));

    println!("✅ Inventory tab displays equipped items, inventory list, and capacity");
}
