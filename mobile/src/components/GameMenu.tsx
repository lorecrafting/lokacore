/**
 * Game Menu Component
 * Bottom action bar with quick access to inventory, quests, stats, etc.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { gameHaptics } from '../utils/haptics';

interface GameMenuProps {
  onOpenInventory: () => void;
  onOpenQuests: () => void;
  onOpenStats: () => void;
  onOpenEmotes: () => void;
  onOpenGathering: () => void;
  onOpenCrafting: () => void;
  onOpenSocial: () => void;
  questCount?: number;
}

interface MenuButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
  badge?: number;
  accessibilityHint?: string;
}

const MenuButton = React.memo(function MenuButton({
  label,
  icon,
  onPress,
  badge,
  accessibilityHint,
}: MenuButtonProps) {
  const handlePress = useCallback(() => {
    gameHaptics.menuSelect();
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={styles.menuButton}
      onPress={handlePress}
      accessibilityLabel={badge ? `${label}, ${badge} items` : label}
      accessibilityHint={accessibilityHint || `Opens ${label.toLowerCase()} menu`}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon} accessibilityElementsHidden>{icon}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge} accessibilityElementsHidden>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.label} accessibilityElementsHidden>{label}</Text>
    </TouchableOpacity>
  );
});

export function GameMenu({
  onOpenInventory,
  onOpenQuests,
  onOpenStats,
  onOpenEmotes,
  onOpenGathering,
  onOpenCrafting,
  onOpenSocial,
  questCount = 0,
}: GameMenuProps) {
  return (
    <View style={styles.container}>
      {/* Top Row - Main menus */}
      <View style={styles.row}>
        <MenuButton
          label="Inventory"
          icon="Bag"
          onPress={onOpenInventory}
        />
        <MenuButton
          label="Quests"
          icon="Scroll"
          onPress={onOpenQuests}
          badge={questCount}
        />
        <MenuButton
          label="Character"
          icon="Stats"
          onPress={onOpenStats}
        />
      </View>
      {/* Bottom Row - Social/Activity menus */}
      <View style={styles.row}>
        <MenuButton
          label="Emotes"
          icon="Act"
          onPress={onOpenEmotes}
        />
        <MenuButton
          label="Gather"
          icon="Node"
          onPress={onOpenGathering}
        />
        <MenuButton
          label="Craft"
          icon="Tool"
          onPress={onOpenCrafting}
        />
        <MenuButton
          label="Social"
          icon="Mood"
          onPress={onOpenSocial}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  menuButton: {
    alignItems: 'center',
    padding: spacing.sm,
    minWidth: 70,
  },
  iconContainer: {
    position: 'relative',
  },
  icon: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: fonts.serif,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
