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

    /// Get content for the current tab
    pub fn get_tab_content(&self) -> String {
        match self.current_tab {
            MenuTab::Character => self.format_character_tab(),
            MenuTab::Inventory => self.format_inventory_tab(),
            MenuTab::Quests => "Quests (Coming Soon)".to_string(),
            MenuTab::Craft => "Crafting (Coming Soon)".to_string(),
            MenuTab::Spark => "Spark Companion (Coming Soon)".to_string(),
            MenuTab::Social => "Social & Emotes (Coming Soon)".to_string(),
            MenuTab::Settings => "Settings (Coming Soon)".to_string(),
        }
    }

    /// Format Character tab content
    fn format_character_tab(&self) -> String {
        // Placeholder character data (will be from PlayerStats in future)
        let mut content = String::new();
        content.push_str("Name: Wanderer             Level: 5\n");
        content.push_str("\n");
        content.push_str("XP: [██████████░░░░░░░░░░] 500/1000\n");
        content.push_str("\n");
        content.push_str("Health:  100 / 100\n");
        content.push_str("Qi:       50 /  50\n");
        content.push_str("Stamina:  80 /  80\n");
        content.push_str("\n");
        content.push_str("─── Attributes ───\n");
        content.push_str("STR: 12    DEX: 14\n");
        content.push_str("CON: 13    INT: 16\n");
        content.push_str("WIS: 15    CHA: 10\n");
        content.push_str("\n");
        content.push_str("Gold: 150\n");
        content
    }

    /// Format Inventory tab content
    fn format_inventory_tab(&self) -> String {
        // Placeholder inventory data (will be from game state in future)
        // TODO: Integrate scrolling for lists >20 items using TextRenderState system
        // TODO: Add tap detection for items to show context menu (Use, Equip, Drop)
        // TODO: Context menu actions will queue actions for execution via uniffi (Phase 7)
        let mut content = String::new();

        // Weight/capacity indicator
        content.push_str("Capacity: 125 / 200 lbs\n");
        content.push_str("\n");

        // Equipped items section
        content.push_str("─── Equipped ───\n");
        content.push_str("[Weapon] Iron Sword (+5 dmg)\n");
        content.push_str("[Armor]  Leather Vest (+3 def)\n");
        content.push_str("[Ring]   Silver Band (+1 CHA)\n");
        content.push_str("\n");

        // Inventory items
        content.push_str("─── Inventory ───\n");
        content.push_str("Health Potion (x3)\n");
        content.push_str("  Restores 50 HP\n");
        content.push_str("\n");
        content.push_str("Qi Elixir (x2)\n");
        content.push_str("  Restores 30 Qi\n");
        content.push_str("\n");
        content.push_str("Ancient Scroll (x1)\n");
        content.push_str("  Mysterious writings\n");
        content.push_str("\n");
        content.push_str("Copper Coins (x50)\n");
        content.push_str("  Currency for trade\n");
        content.push_str("\n");
        content.push_str("Dried Rations (x5)\n");
        content.push_str("  Food for long journeys\n");

        content
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
