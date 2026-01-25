// Tests for health bar system
use loka_book::ui::PlayerStats;

#[test]
fn test_player_stats_initialization() {
    let stats = PlayerStats::default();
    assert_eq!(stats.hp, 100);
    assert_eq!(stats.max_hp, 100);
    assert_eq!(stats.hp_percent(), 1.0);
    println!("✅ PlayerStats initializes correctly");
}

#[test]
fn test_take_damage() {
    let mut stats = PlayerStats::default();

    stats.take_damage(30);
    assert_eq!(stats.hp, 70);
    assert_eq!(stats.hp_percent(), 0.7);

    stats.take_damage(100); // Overkill
    assert_eq!(stats.hp, 0);
    assert_eq!(stats.hp_percent(), 0.0);

    println!("✅ Take damage works correctly");
}

#[test]
fn test_healing() {
    let mut stats = PlayerStats::default();

    stats.take_damage(50);
    assert_eq!(stats.hp, 50);

    stats.heal(20);
    assert_eq!(stats.hp, 70);

    stats.heal(100); // Overheal
    assert_eq!(stats.hp, 100);

    println!("✅ Healing works correctly");
}

#[test]
fn test_resource_percentages() {
    let stats = PlayerStats {
        hp: 75,
        max_hp: 100,
        qi: 25,
        max_qi: 50,
        stamina: 40,
        max_stamina: 80,
    };

    assert_eq!(stats.hp_percent(), 0.75);
    assert_eq!(stats.qi_percent(), 0.5);
    assert_eq!(stats.stamina_percent(), 0.5);

    println!("✅ Resource percentages calculated correctly");
}

#[test]
fn test_bar_formatting() {
    let stats = PlayerStats {
        hp: 75,
        max_hp: 100,
        qi: 25,
        max_qi: 50,
        stamina: 40,
        max_stamina: 80,
    };

    let formatted = stats.format_bars();

    assert!(formatted.contains("HP:"));
    assert!(formatted.contains("Qi:"));
    assert!(formatted.contains("St:"));
    assert!(formatted.contains("75/100"));
    assert!(formatted.contains("25/50"));
    assert!(formatted.contains("40/80"));

    println!("✅ Bar formatting works");
}
