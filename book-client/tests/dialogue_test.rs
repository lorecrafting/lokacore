// Tests for dialogue system
use loka_book::dialogue::{DialogueNode, DialogueChoice, DialogueState, DialogueLine};

#[test]
fn test_dialogue_node_creation() {
    let node = DialogueNode::placeholder_greeting();
    assert_eq!(node.id, "greeting");
    assert!(!node.npc_text.is_empty());
    assert!(!node.choices.is_empty());
    assert!(!node.is_end);

    println!("✅ Dialogue node creation works");
}

#[test]
fn test_dialogue_choices() {
    let node = DialogueNode::placeholder_greeting();
    assert_eq!(node.choices.len(), 3);

    let quest_choice = &node.choices[0];
    assert_eq!(quest_choice.id, "quest");
    assert!(quest_choice.next_node.is_some());

    let leave_choice = &node.choices[2];
    assert_eq!(leave_choice.id, "leave");
    assert!(leave_choice.next_node.is_none()); // Ends dialogue

    println!("✅ Dialogue choices work correctly");
}

#[test]
fn test_start_dialogue() {
    let mut state = DialogueState::default();
    assert!(!state.active);
    assert!(state.current_node.is_none());

    let node = DialogueNode::placeholder_greeting();
    state.start_dialogue("elder_ming".to_string(), node.clone());

    assert!(state.active);
    assert!(state.current_node.is_some());
    assert_eq!(state.entity_key.as_ref().unwrap(), "elder_ming");

    // History should contain NPC lines
    assert_eq!(state.history.len(), node.npc_text.len());

    println!("✅ Starting dialogue works");
}

#[test]
fn test_select_choice() {
    let mut state = DialogueState::default();
    let node = DialogueNode::placeholder_greeting();
    state.start_dialogue("elder_ming".to_string(), node);

    let initial_history_len = state.history.len();

    // Select first choice (leads to another node)
    let next_node = DialogueNode::placeholder_response();
    state.select_choice("quest", Some(next_node.clone()));

    // History should now include player's choice + NPC response
    assert!(state.history.len() > initial_history_len);

    // Should be in new node
    assert!(state.current_node.is_some());
    assert_eq!(state.current_node.as_ref().unwrap().id, "trial_info");

    println!("✅ Selecting dialogue choice advances conversation");
}

#[test]
fn test_end_dialogue_on_none() {
    let mut state = DialogueState::default();
    let node = DialogueNode::placeholder_greeting();
    state.start_dialogue("elder_ming".to_string(), node);

    // Select choice that ends dialogue (next_node = None)
    state.select_choice("leave", None);

    assert!(!state.active);
    assert!(state.current_node.is_none());
    // History preserved for review
    assert!(!state.history.is_empty());

    println!("✅ Dialogue ends when choice leads to None");
}

#[test]
fn test_dialogue_history() {
    let mut state = DialogueState::default();

    state.history.push(DialogueLine {
        speaker: "elder_ming".to_string(),
        text: "Hello traveler.".to_string(),
    });

    state.history.push(DialogueLine {
        speaker: "You".to_string(),
        text: "Greetings, Elder.".to_string(),
    });

    assert_eq!(state.history.len(), 2);
    assert_eq!(state.history[0].speaker, "elder_ming");
    assert_eq!(state.history[1].speaker, "You");

    println!("✅ Dialogue history tracking works");
}

#[test]
fn test_format_dialogue_ui() {
    let mut state = DialogueState::default();
    let node = DialogueNode::placeholder_greeting();
    state.start_dialogue("Elder Ming".to_string(), node);

    let ui = state.format_dialogue_ui("Elder Ming");

    assert!(ui.contains("Conversation with Elder Ming"));
    assert!(ui.contains("Your Responses:"));
    assert!(ui.contains("1."));
    assert!(ui.contains("End Conversation"));

    println!("✅ Dialogue UI formatting works");
}

#[test]
fn test_clear_dialogue() {
    let mut state = DialogueState::default();
    let node = DialogueNode::placeholder_greeting();
    state.start_dialogue("elder_ming".to_string(), node);

    state.clear();

    assert!(!state.active);
    assert!(state.current_node.is_none());
    assert!(state.entity_key.is_none());
    assert!(state.history.is_empty());

    println!("✅ Clearing dialogue state works");
}

#[test]
fn test_end_node() {
    let node = DialogueNode::placeholder_response();
    assert!(node.is_end);
    assert_eq!(node.choices.len(), 1);
    assert!(node.choices[0].next_node.is_none());

    println!("✅ End nodes correctly configured");
}
