/**
 * Shop Modal Component
 * Modal for browsing and purchasing items from merchants
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useEnvironment } from './EnvironmentContext';
import { colors, fonts, spacing } from '../theme';
import type { ShopState, InventoryItem } from '../types/game';

interface ShopModalProps {
  shop: ShopState;
  inventory: InventoryItem[];
  playerGold: number;
  onBuy: (itemKey: string) => void;
  onSell: (itemId: string) => void;
  onClose: () => void;
}

export function ShopModal({
  shop,
  inventory,
  playerGold,
  onBuy,
  onSell,
  onClose,
}: ShopModalProps) {
  const [tab, setTab] = React.useState<'buy' | 'sell'>('buy');

  // Get environment context for dynamic theming
  const { colors: envColors } = useEnvironment();

  // Create dynamic styles based on environment
  const dynamicStyles = useMemo(() => ({
    panel: { backgroundColor: envColors.background },
    border: { borderBottomColor: envColors.border },
    title: { color: envColors.text },
    goldText: { color: envColors.textMuted },
    closeText: { color: envColors.textMuted },
    tabText: { color: envColors.textMuted },
    tabTextActive: { color: envColors.text },
    tabActive: { borderBottomColor: envColors.text },
    emptyText: { color: envColors.textMuted },
    itemName: { color: envColors.text },
    itemDesc: { color: envColors.textMuted },
    itemBorder: { borderColor: envColors.border },
    actionButton: { borderColor: envColors.text },
    actionButtonText: { color: envColors.text },
    actionButtonDisabled: { borderColor: envColors.textFaint },
    actionButtonTextDisabled: { color: envColors.textFaint },
  }), [envColors]);

  // Filter inventory to only show items the shop will buy
  const sellableItems = inventory.filter((item) =>
    shop.buys.includes(item.key || '')
  );

  // Estimate sell price (50% of buy price if we can find it)
  const getSellPrice = (item: InventoryItem): number => {
    const shopItem = shop.items.find((si) => si.key === item.key);
    if (shopItem) {
      return Math.floor(shopItem.price / 2);
    }
    return 5; // Default fallback price
  };

  return (
    <Modal
      visible={shop.open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.panel, dynamicStyles.panel]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={[styles.header, dynamicStyles.border]}>
            <View>
              <Text style={[styles.title, dynamicStyles.title]}>{shop.npcName}'s Shop</Text>
              <Text style={[styles.goldText, dynamicStyles.goldText]}>Your Gold: {playerGold}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, dynamicStyles.closeText]}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[styles.tabs, dynamicStyles.border]}>
            <TouchableOpacity
              style={[styles.tab, tab === 'buy' && styles.tabActive, tab === 'buy' && dynamicStyles.tabActive]}
              onPress={() => setTab('buy')}
            >
              <Text style={[styles.tabText, dynamicStyles.tabText, tab === 'buy' && dynamicStyles.tabTextActive]}>
                Buy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'sell' && styles.tabActive, tab === 'sell' && dynamicStyles.tabActive]}
              onPress={() => setTab('sell')}
            >
              <Text style={[styles.tabText, dynamicStyles.tabText, tab === 'sell' && dynamicStyles.tabTextActive]}>
                Sell
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {tab === 'buy' ? (
              // Buy Tab
              shop.items.length === 0 ? (
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No items for sale.</Text>
              ) : (
                <View style={styles.itemList}>
                  {shop.items.map((item) => {
                    const canAfford = playerGold >= item.price;
                    return (
                      <View key={item.key} style={[styles.itemRow, dynamicStyles.itemBorder]}>
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemName, dynamicStyles.itemName]}>{item.name}</Text>
                          {item.description && (
                            <Text style={[styles.itemDesc, dynamicStyles.itemDesc]} numberOfLines={2}>
                              {item.description}
                            </Text>
                          )}
                        </View>
                        <View style={styles.itemAction}>
                          <Text style={[
                            styles.priceText,
                            !canAfford && styles.priceTextExpensive,
                          ]}>
                            {item.price}g
                          </Text>
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              dynamicStyles.actionButton,
                              !canAfford && dynamicStyles.actionButtonDisabled,
                            ]}
                            onPress={() => onBuy(item.key)}
                            disabled={!canAfford}
                          >
                            <Text style={[
                              styles.actionButtonText,
                              dynamicStyles.actionButtonText,
                              !canAfford && dynamicStyles.actionButtonTextDisabled,
                            ]}>
                              Buy
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            ) : (
              // Sell Tab
              sellableItems.length === 0 ? (
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                  You don't have any items this merchant wants to buy.
                </Text>
              ) : (
                <View style={styles.itemList}>
                  {sellableItems.map((item) => {
                    const sellPrice = getSellPrice(item);
                    return (
                      <View key={item.id} style={[styles.itemRow, dynamicStyles.itemBorder]}>
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemName, dynamicStyles.itemName]}>{item.name}</Text>
                          {item.description && (
                            <Text style={[styles.itemDesc, dynamicStyles.itemDesc]} numberOfLines={2}>
                              {item.description}
                            </Text>
                          )}
                        </View>
                        <View style={styles.itemAction}>
                          <Text style={styles.priceText}>{sellPrice}g</Text>
                          <TouchableOpacity
                            style={[styles.actionButton, dynamicStyles.actionButton]}
                            onPress={() => onSell(item.id)}
                          >
                            <Text style={[styles.actionButtonText, dynamicStyles.actionButtonText]}>Sell</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  goldText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  tabText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },
  itemList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
  itemDesc: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemAction: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  priceTextExpensive: {
    color: colors.error,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 4,
  },
  actionButtonDisabled: {
    borderColor: colors.textFaint,
  },
  actionButtonText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
  },
  actionButtonTextDisabled: {
    color: colors.textFaint,
  },
});
