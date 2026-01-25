//! Multi-page book system
//!
//! Enables the book to have multiple pages (game, menu, entity interactions, etc.)
//! that the user can navigate between using page-turn animations.

use bevy::prelude::*;

/// Type of page in the book
#[derive(Debug, Clone, PartialEq)]
pub enum PageType {
    /// Main game page showing room, NPCs, items, exits
    Game,
    /// Menu page with tabs (Character, Inventory, Quests, etc.)
    Menu,
    /// Entity interaction page (talk, trade, attack)
    EntityInteraction { entity_key: String },
    /// Shop interface page
    Shop { shop_key: String },
    /// Container/chest interface page
    Container { container_key: String },
    /// Combat page with enemy health, abilities
    Combat { enemy_key: String },
    /// Death/resurrection page
    Bardo,
}

/// Content for a page (will be expanded in future)
#[derive(Debug, Clone)]
pub struct PageContent {
    /// Text content to render on this page
    pub text: String,
    /// Whether this page has been rendered yet
    pub rendered: bool,
}

impl Default for PageContent {
    fn default() -> Self {
        Self {
            text: String::new(),
            rendered: false,
        }
    }
}

/// A single page in the book
#[derive(Debug, Clone)]
pub struct Page {
    /// Type/purpose of this page
    pub page_type: PageType,
    /// Content to display on this page
    pub content: PageContent,
}

impl Page {
    /// Create a new page of the given type
    pub fn new(page_type: PageType) -> Self {
        Self {
            page_type,
            content: PageContent::default(),
        }
    }
}

/// Resource managing the book's pages and navigation
#[derive(Resource)]
pub struct BookState {
    /// All pages in the book
    pages: Vec<Page>,
    /// Index of the currently visible page
    current_page_index: usize,
    /// History of page indices for back navigation
    page_history: Vec<usize>,
}

impl Default for BookState {
    fn default() -> Self {
        // Start with just a game page
        let game_page = Page::new(PageType::Game);

        Self {
            pages: vec![game_page],
            current_page_index: 0,
            page_history: Vec::new(),
        }
    }
}

impl BookState {
    /// Get the current page
    pub fn current_page(&self) -> &Page {
        &self.pages[self.current_page_index]
    }

    /// Get the current page mutably
    pub fn current_page_mut(&mut self) -> &mut Page {
        &mut self.pages[self.current_page_index]
    }

    /// Get current page index
    pub fn current_index(&self) -> usize {
        self.current_page_index
    }

    /// Find a page by type, or create it if it doesn't exist
    fn find_or_create_page(&mut self, page_type: PageType) -> usize {
        // Try to find existing page of this type
        for (i, page) in self.pages.iter().enumerate() {
            if page.page_type == page_type {
                return i;
            }
        }

        // Create new page
        let new_page = Page::new(page_type);
        self.pages.push(new_page);
        self.pages.len() - 1
    }

    /// Turn to a page of the given type (creates if doesn't exist)
    pub fn turn_to_page(&mut self, page_type: PageType) -> TurnAction {
        // Push current page to history
        self.page_history.push(self.current_page_index);

        // Find or create the target page
        let target_index = self.find_or_create_page(page_type.clone());

        // Update current page
        let old_index = self.current_page_index;
        self.current_page_index = target_index;

        info!("Turning from page {} to page {} (type: {:?})",
              old_index, target_index, page_type);

        TurnAction::Forward {
            from: old_index,
            to: target_index,
        }
    }

    /// Go back to the previous page in history
    pub fn go_back(&mut self) -> Option<TurnAction> {
        if let Some(prev_index) = self.page_history.pop() {
            let old_index = self.current_page_index;
            self.current_page_index = prev_index;

            info!("Going back from page {} to page {}", old_index, prev_index);

            Some(TurnAction::Backward {
                from: old_index,
                to: prev_index,
            })
        } else {
            info!("Cannot go back - no page history");
            None
        }
    }

    /// Check if we can go back
    pub fn can_go_back(&self) -> bool {
        !self.page_history.is_empty()
    }

    /// Clear page history (useful when returning to game page)
    pub fn clear_history(&mut self) {
        self.page_history.clear();
    }
}

/// Result of a page turn action
#[derive(Debug, Clone)]
pub enum TurnAction {
    /// Turning forward to a new page
    Forward { from: usize, to: usize },
    /// Turning backward to a previous page
    Backward { from: usize, to: usize },
}
