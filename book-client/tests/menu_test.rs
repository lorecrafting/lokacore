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

#[test]
fn test_quest_tab_content() {
    let mut menu = MenuState::default();
    menu.switch_to(MenuTab::Quests);
    let quest_content = menu.get_tab_content();

    // Verify active quests section
    assert!(quest_content.contains("Active Quests"));

    // Verify quest names are displayed
    assert!(quest_content.contains("Monastery Trial"));
    assert!(quest_content.contains("Gather Herbs"));

    // Verify objectives with checkboxes (both complete ✓ and incomplete ○)
    assert!(quest_content.contains("✓"));  // Completed objective
    assert!(quest_content.contains("○"));  // Incomplete objective

    // Verify rewards section
    assert!(quest_content.contains("Reward:"));

    // Verify completed quests section
    assert!(quest_content.contains("Completed"));

    println!("✅ Quest tab displays active quests, objectives, and completed section");
}

#[test]
fn test_craft_tab_content() {
    let mut menu = MenuState::default();
    menu.switch_to(MenuTab::Craft);
    let craft_content = menu.get_tab_content();

    // Verify recipes section
    assert!(craft_content.contains("Available Recipes"));
    assert!(craft_content.contains("Health Potion"));
    assert!(craft_content.contains("Iron Sword"));

    // Verify requirement display
    assert!(craft_content.contains("Req:"));

    // Verify crafting status indicators
    assert!(craft_content.contains("✓")); // Can craft
    assert!(craft_content.contains("○")); // Missing materials

    // Verify tools section
    assert!(craft_content.contains("Crafting Tools"));

    println!("✅ Craft tab displays recipes, requirements, and tools");
}

#[test]
fn test_spark_tab_content() {
    let mut menu = MenuState::default();
    menu.switch_to(MenuTab::Spark);
    let spark_content = menu.get_tab_content();

    // Verify Spark companion presence
    assert!(spark_content.contains("Spark Companion"));
    assert!(spark_content.contains("Spark:"));

    // Verify chat history
    assert!(spark_content.contains("You:"));

    // Verify input prompt
    assert!(spark_content.contains("Ask Spark"));

    println!("✅ Spark tab displays companion chat and input");
}

#[test]
fn test_social_tab_content() {
    let mut menu = MenuState::default();
    menu.switch_to(MenuTab::Social);
    let social_content = menu.get_tab_content();

    // Verify emotes section
    assert!(social_content.contains("Emotes"));
    assert!(social_content.contains("Happy"));
    assert!(social_content.contains("Sad"));

    // Verify poses section
    assert!(social_content.contains("Poses"));
    assert!(social_content.contains("Standing"));
    assert!(social_content.contains("Sitting"));

    // Verify current state display
    assert!(social_content.contains("Current:"));

    println!("✅ Social tab displays emotes, poses, and current state");
}

#[test]
fn test_settings_tab_content() {
    let mut menu = MenuState::default();
    menu.switch_to(MenuTab::Settings);
    let settings_content = menu.get_tab_content();

    // Verify settings sections
    assert!(settings_content.contains("Game Settings"));
    assert!(settings_content.contains("Design Variant"));

    // Verify toggles
    assert!(settings_content.contains("ON"));

    // Verify account section
    assert!(settings_content.contains("Account"));
    assert!(settings_content.contains("Logout"));

    // Verify version info
    assert!(settings_content.contains("Version:"));

    println!("✅ Settings tab displays settings, account, and version info");
}
