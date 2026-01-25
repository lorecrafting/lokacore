// Tests for multi-page book architecture
use loka_book::book::{BookState, PageType, TurnAction};

#[test]
fn test_book_state_initialization() {
    let book = BookState::default();

    // Should start with one Game page
    assert_eq!(book.current_index(), 0);
    assert_eq!(book.current_page().page_type, PageType::Game);
    assert!(!book.can_go_back());

    println!("✅ BookState initializes with Game page");
}

#[test]
fn test_turn_to_new_page() {
    let mut book = BookState::default();

    // Turn to menu page
    let action = book.turn_to_page(PageType::Menu);

    // Should be on menu page now
    assert_eq!(book.current_page().page_type, PageType::Menu);
    assert!(book.can_go_back());

    // Verify turn action
    match action {
        TurnAction::Forward { from, to } => {
            assert_eq!(from, 0);
            assert_eq!(to, 1);
        }
        _ => panic!("Expected Forward action"),
    }

    println!("✅ Turning to new page works");
}

#[test]
fn test_go_back() {
    let mut book = BookState::default();

    // Turn to menu
    book.turn_to_page(PageType::Menu);
    assert_eq!(book.current_index(), 1);

    // Go back to game
    let action = book.go_back();
    assert!(action.is_some());
    assert_eq!(book.current_index(), 0);
    assert_eq!(book.current_page().page_type, PageType::Game);
    assert!(!book.can_go_back());

    println!("✅ Go back navigation works");
}

#[test]
fn test_page_reuse() {
    let mut book = BookState::default();

    // Turn to menu twice
    book.turn_to_page(PageType::Menu);
    let first_index = book.current_index();

    book.go_back();
    book.turn_to_page(PageType::Menu);
    let second_index = book.current_index();

    // Should reuse the same menu page
    assert_eq!(first_index, second_index);

    println!("✅ Pages are reused correctly");
}

#[test]
fn test_page_history() {
    let mut book = BookState::default();

    // Navigate through multiple pages
    book.turn_to_page(PageType::Menu);
    book.turn_to_page(PageType::EntityInteraction {
        entity_key: "elder_ming".to_string(),
    });
    book.turn_to_page(PageType::Shop {
        shop_key: "blacksmith".to_string(),
    });

    assert_eq!(book.current_index(), 3);

    // Go back through history
    book.go_back(); // Back to entity
    assert_eq!(book.current_index(), 2);

    book.go_back(); // Back to menu
    assert_eq!(book.current_index(), 1);

    book.go_back(); // Back to game
    assert_eq!(book.current_index(), 0);

    assert!(!book.can_go_back());

    println!("✅ Page history navigation works");
}

#[test]
fn test_entity_interaction_pages() {
    let mut book = BookState::default();

    // Create two different entity pages
    book.turn_to_page(PageType::EntityInteraction {
        entity_key: "elder_ming".to_string(),
    });
    let elder_index = book.current_index();

    book.turn_to_page(PageType::EntityInteraction {
        entity_key: "guard".to_string(),
    });
    let guard_index = book.current_index();

    // Should be different pages (different entity keys)
    assert_ne!(elder_index, guard_index);

    println!("✅ Different entity pages are distinct");
}
