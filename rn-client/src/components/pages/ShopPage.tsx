import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { useGameStore } from '../../store/gameStore';
import { colors, spacing } from '../../theme/colors';
import type { ShopItem } from '../../types/game';

export function ShopPage() {
  const shop = useGameStore((s) => s.shop);
  const closeShop = useGameStore((s) => s.closeShop);

  if (!shop) {
    return (
      <ParchmentPage>
        <ParchmentText variant="body" color={colors.secondary}>
          No shop open.
        </ParchmentText>
      </ParchmentPage>
    );
  }

  function handleBuy(item: ShopItem) {
    console.log('[ShopPage] buy item:', item.index, item.name, item.price);
  }

  return (
    <ParchmentPage>
      {/* Shop name */}
      <ParchmentText variant="title" style={styles.title}>
        {shop.name}
      </ParchmentText>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Gold display */}
      <ParchmentText variant="bold" style={styles.goldLine}>
        Gold: {shop.gold}
      </ParchmentText>

      {/* Item list */}
      {shop.items.length === 0 ? (
        <ParchmentText variant="italic" color={colors.secondary} style={styles.emptyText}>
          Nothing for sale.
        </ParchmentText>
      ) : (
        <View style={styles.itemList}>
          {shop.items.map((item) => (
            <ShopItemRow key={item.index} item={item} onBuy={handleBuy} />
          ))}
        </View>
      )}

      {/* Close button */}
      <TouchableOpacity
        onPress={closeShop}
        activeOpacity={0.6}
        style={styles.closeButton}
      >
        <ParchmentText variant="small" color={colors.barActive} style={styles.closeButtonText}>
          [Close]
        </ParchmentText>
      </TouchableOpacity>
    </ParchmentPage>
  );
}

interface ShopItemRowProps {
  item: ShopItem;
  onBuy: (item: ShopItem) => void;
}

function ShopItemRow({ item, onBuy }: ShopItemRowProps) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <ParchmentText variant="body" style={styles.itemName}>
          {item.name}
        </ParchmentText>
        {item.description ? (
          <ParchmentText variant="small" color={colors.secondary} style={styles.itemDescription}>
            {item.description}
          </ParchmentText>
        ) : null}
        <ParchmentText variant="italic" color={colors.action} style={styles.itemPrice}>
          {item.price} gold
        </ParchmentText>
      </View>
      <TouchableOpacity
        onPress={() => onBuy(item)}
        activeOpacity={0.6}
        style={styles.buyButton}
      >
        <ParchmentText variant="small" color={colors.barActive} style={styles.buyButtonText}>
          [Buy]
        </ParchmentText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.separator,
    marginBottom: 16,
  },
  goldLine: {
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    marginBottom: 24,
  },
  itemList: {
    gap: 12,
    marginBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.decorative,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    marginBottom: 2,
  },
  itemDescription: {
    marginBottom: 4,
    lineHeight: 22,
  },
  itemPrice: {
    lineHeight: 22,
  },
  buyButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.barActive,
    alignSelf: 'center',
  },
  buyButtonText: {
    letterSpacing: 0.5,
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.barActive,
    marginTop: 8,
  },
  closeButtonText: {
    letterSpacing: 0.5,
  },
});
