//! Menu page with tabs (Character, Inventory, Quests, Craft, Spark, Social, Settings)

use bevy::prelude::*;

/// Menu tab types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MenuTab {
    #[default]
    Character,
    Inventory,
    Quests,
    Craft,
    Spark,
    Social,
    Settings,
}

impl MenuTab {
    /// Get all tabs in order
    pub fn all() -> [MenuTab; 7] {
        [
            MenuTab::Character,
            MenuTab::Inventory,
            MenuTab::Quests,
            MenuTab::Craft,
            MenuTab::Spark,
            MenuTab::Social,
            MenuTab::Settings,
        ]
    }

    /// Get display name for this tab
    pub fn name(&self) -> &'static str {
        match self {
            MenuTab::Character => "Character",
            MenuTab::Inventory => "Inventory",
            MenuTab::Quests => "Quests",
            MenuTab::Craft => "Craft",
            MenuTab::Spark => "Spark",
            MenuTab::Social => "Social",
            MenuTab::Settings => "Settings",
        }
    }

    /// Get the next tab (wraps around)
    pub fn next(&self) -> MenuTab {
        match self {
            MenuTab::Character => MenuTab::Inventory,
            MenuTab::Inventory => MenuTab::Quests,
            MenuTab::Quests => MenuTab::Craft,
            MenuTab::Craft => MenuTab::Spark,
            MenuTab::Spark => MenuTab::Social,
            MenuTab::Social => MenuTab::Settings,
            MenuTab::Settings => MenuTab::Character,
        }
    }

    /// Get the previous tab (wraps around)
    pub fn prev(&self) -> MenuTab {
        match self {
            MenuTab::Character => MenuTab::Settings,
            MenuTab::Inventory => MenuTab::Character,
            MenuTab::Quests => MenuTab::Inventory,
            MenuTab::Craft => MenuTab::Quests,
            MenuTab::Spark => MenuTab::Craft,
            MenuTab::Social => MenuTab::Spark,
            MenuTab::Settings => MenuTab::Social,
        }
    }
}

/// Resource tracking current menu state
#[derive(Resource, Default)]
pub struct MenuState {
    /// Currently active tab
    pub current_tab: MenuTab,
    /// Whether the menu page needs re-rendering
    pub needs_update: bool,
}

impl MenuState {
    /// Switch to a different tab
    pub fn switch_to(&mut self, tab: MenuTab) {
        if self.current_tab != tab {
            self.current_tab = tab;
            self.needs_update = true;
            info!("Switched to {} tab", tab.name());
        }
    }

    /// Switch to next tab
    pub fn next_tab(&mut self) {
        self.switch_to(self.current_tab.next());
    }

    /// Switch to previous tab
    pub fn prev_tab(&mut self) {
        self.switch_to(self.current_tab.prev());
    }

    /// Format menu content for rendering (to be expanded in future)
    pub fn format_content(&self) -> String {
        let mut content = String::new();

        // Tab bar
        content.push_str(&format!("╔════════════════════════════════════════╗\n"));
        content.push_str("║             ~ MENU ~                  ║\n");
        content.push_str("╠════════════════════════════════════════╣\n");
        content.push_str("║ ");

        // Tab buttons - show active tab with [brackets]
        for tab in MenuTab::all() {
            if tab == self.current_tab {
                content.push_str(&format!("[{}] ", tab.name()));
            } else {
                content.push_str(&format!(" {}  ", tab.name()));
            }
        }

        content.push_str("   ║\n");
        content.push_str("╠════════════════════════════════════════╣\n");
        content.push_str("║                                        ║\n");

        // Tab content area
        content.push_str(&format!("║  {:<36}  ║\n", self.get_tab_content()));

        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║                                        ║\n");
        content.push_str("║  [×] Close                             ║\n");
        content.push_str("╚════════════════════════════════════════╝\n");

        content
    }

    /// Get content for the current tab (placeholder for now)
    fn get_tab_content(&self) -> String {
        match self.current_tab {
            MenuTab::Character => "Character Stats (Coming Soon)".to_string(),
            MenuTab::Inventory => "Inventory (Coming Soon)".to_string(),
            MenuTab::Quests => "Quests (Coming Soon)".to_string(),
            MenuTab::Craft => "Crafting (Coming Soon)".to_string(),
            MenuTab::Spark => "Spark Companion (Coming Soon)".to_string(),
            MenuTab::Social => "Social & Emotes (Coming Soon)".to_string(),
            MenuTab::Settings => "Settings (Coming Soon)".to_string(),
        }
    }
}

/// Plugin for menu system
pub struct MenuPlugin;

impl Plugin for MenuPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MenuState>();
        info!("MenuPlugin initialized");
    }
}
