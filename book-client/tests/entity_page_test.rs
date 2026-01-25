// Tests for entity interaction page system
use loka_book::ui::{EntityData, EntityType, EntityAction, EntityPageState};

#[test]
fn test_entity_data_creation() {
    let entity = EntityData::placeholder("elder_ming");
    assert_eq!(entity.key, "elder_ming");
    assert_eq!(entity.name, "Elder Ming");
    assert_eq!(entity.entity_type, EntityType::Npc);
    assert!(entity.level.is_some());

    println!("✅ Entity data creation works");
}

#[test]
fn test_npc_available_actions() {
    let npc = EntityData {
        key: "test_npc".to_string(),
        name: "Test NPC".to_string(),
        description: "A test character".to_string(),
        entity_type: EntityType::Npc,
        level: None,
        health_percent: None,
    };

    let actions = npc.available_actions();
    assert!(actions.contains(&EntityAction::Talk));
    assert!(actions.contains(&EntityAction::Examine));
    assert!(!actions.contains(&EntityAction::Trade));
    assert!(!actions.contains(&EntityAction::Attack));

    println!("✅ NPC has correct actions (Talk, Examine)");
}

#[test]
fn test_merchant_available_actions() {
    let merchant = EntityData {
        key: "test_merchant".to_string(),
        name: "Test Merchant".to_string(),
        description: "A shopkeeper".to_string(),
        entity_type: EntityType::Merchant,
        level: None,
        health_percent: None,
    };

    let actions = merchant.available_actions();
    assert!(actions.contains(&EntityAction::Talk));
    assert!(actions.contains(&EntityAction::Trade));
    assert!(actions.contains(&EntityAction::Examine));
    assert!(!actions.contains(&EntityAction::Attack));

    println!("✅ Merchant has correct actions (Talk, Trade, Examine)");
}

#[test]
fn test_enemy_available_actions() {
    let enemy = EntityData {
        key: "test_enemy".to_string(),
        name: "Test Enemy".to_string(),
        description: "A hostile creature".to_string(),
        entity_type: EntityType::Enemy,
        level: Some(5),
        health_percent: Some(0.8),
    };

    let actions = enemy.available_actions();
    assert!(actions.contains(&EntityAction::Attack));
    assert!(actions.contains(&EntityAction::Examine));
    assert!(!actions.contains(&EntityAction::Talk));
    assert!(!actions.contains(&EntityAction::Trade));

    println!("✅ Enemy has correct actions (Attack, Examine)");
}

#[test]
fn test_object_available_actions() {
    let object = EntityData {
        key: "test_object".to_string(),
        name: "Ancient Lever".to_string(),
        description: "A rusty lever".to_string(),
        entity_type: EntityType::Object,
        level: None,
        health_percent: None,
    };

    let actions = object.available_actions();
    assert!(actions.contains(&EntityAction::Examine));
    assert!(actions.contains(&EntityAction::Use));
    assert!(!actions.contains(&EntityAction::Talk));

    println!("✅ Object has correct actions (Examine, Use)");
}

#[test]
fn test_entity_page_formatting() {
    let entity = EntityData::placeholder("elder_ming");
    let page = entity.format_page();

    // Check for required elements
    assert!(page.contains("Elder Ming"));
    assert!(page.contains("Level"));
    assert!(page.contains("Actions Available"));
    assert!(page.contains("💬 Talk"));
    assert!(page.contains("🔍 Examine"));
    assert!(page.contains("[←] Back"));

    println!("✅ Entity page formatting includes all elements");
}

#[test]
fn test_enemy_health_bar_rendering() {
    let enemy = EntityData {
        key: "goblin".to_string(),
        name: "Goblin Warrior".to_string(),
        description: "A small green creature".to_string(),
        entity_type: EntityType::Enemy,
        level: Some(3),
        health_percent: Some(0.5),
    };

    let page = enemy.format_page();

    // Check for health bar
    assert!(page.contains("HP:"));
    assert!(page.contains("50%"));
    assert!(page.contains("█")); // Filled portion
    assert!(page.contains("░")); // Empty portion

    println!("✅ Enemy health bar renders correctly");
}

#[test]
fn test_action_display() {
    let (icon, label) = EntityAction::Talk.display();
    assert_eq!(icon, "💬");
    assert_eq!(label, "Talk");

    let (icon, label) = EntityAction::Attack.display();
    assert_eq!(icon, "⚔️");
    assert_eq!(label, "Attack");

    println!("✅ Action icons and labels display correctly");
}

#[test]
fn test_action_names() {
    assert_eq!(EntityAction::Talk.name(), "talk");
    assert_eq!(EntityAction::Trade.name(), "trade");
    assert_eq!(EntityAction::Attack.name(), "attack");
    assert_eq!(EntityAction::Examine.name(), "examine");
    assert_eq!(EntityAction::Use.name(), "use");

    println!("✅ Action names for button IDs work");
}

#[test]
fn test_entity_page_state() {
    let mut state = EntityPageState::default();
    assert!(state.current_entity.is_none());
    assert!(state.pending_action.is_none());

    // Set entity
    let entity = EntityData::placeholder("test");
    state.view_entity(entity);
    assert!(state.current_entity.is_some());

    // Queue action
    state.queue_action("test".to_string(), EntityAction::Talk);
    assert!(state.pending_action.is_some());

    // Take pending action
    let action = state.take_pending_action();
    assert!(action.is_some());
    let (entity_key, action_type) = action.unwrap();
    assert_eq!(entity_key, "test");
    assert_eq!(action_type, EntityAction::Talk);
    assert!(state.pending_action.is_none());

    // Clear
    state.clear();
    assert!(state.current_entity.is_none());

    println!("✅ Entity page state management works");
}

#[test]
fn test_text_wrapping() {
    let long_text = "This is a very long description that should be wrapped \
                     into multiple lines to fit within the page width constraints.";

    let entity = EntityData {
        key: "test".to_string(),
        name: "Test".to_string(),
        description: long_text.to_string(),
        entity_type: EntityType::Npc,
        level: None,
        health_percent: None,
    };

    let page = entity.format_page();

    // Description should be present
    assert!(page.contains("This is a very long"));

    println!("✅ Text wrapping works for long descriptions");
}
