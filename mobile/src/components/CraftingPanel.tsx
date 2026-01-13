/**
 * Crafting Panel Component
 * Slide-up panel for crafting items from known recipes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import type { CraftingRecipe, InventoryItem } from '../types/game';

interface CraftingPanelProps {
  visible: boolean;
  recipes: CraftingRecipe[];
  inventory: InventoryItem[];
  onCraft: (recipeKey: string) => void;
  onClose: () => void;
}

export function CraftingPanel({
  visible,
  recipes,
  inventory,
  onCraft,
  onClose,
}: CraftingPanelProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);

  // Check if player has ingredients for a recipe
  const checkCanCraft = (recipe: CraftingRecipe): boolean => {
    return recipe.ingredients.every((ing) => {
      const inventoryItem = inventory.find((item) => item.key === ing.key);
      const have = inventoryItem?.quantity || 0;
      return have >= ing.quantity;
    });
  };

  const handleCraft = (recipeKey: string) => {
    onCraft(recipeKey);
    setSelectedRecipe(null);
  };

  const handleBack = () => {
    setSelectedRecipe(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            {selectedRecipe ? (
              <>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{selectedRecipe.name}</Text>
              </>
            ) : (
              <Text style={styles.title}>Crafting</Text>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {selectedRecipe ? (
              // Recipe Detail View
              <View style={styles.recipeDetail}>
                {selectedRecipe.description && (
                  <Text style={styles.recipeDescription}>
                    {selectedRecipe.description}
                  </Text>
                )}

                <Text style={styles.sectionTitle}>Ingredients Required</Text>
                <View style={styles.ingredientList}>
                  {selectedRecipe.ingredients.map((ing, index) => {
                    const inventoryItem = inventory.find((item) => item.key === ing.key);
                    const have = inventoryItem?.quantity || 0;
                    const hasEnough = have >= ing.quantity;

                    return (
                      <View key={index} style={styles.ingredientRow}>
                        <Text style={styles.ingredientName}>{ing.name}</Text>
                        <Text
                          style={[
                            styles.ingredientCount,
                            !hasEnough && styles.ingredientMissing,
                          ]}
                        >
                          {have} / {ing.quantity}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[
                    styles.craftButton,
                    !checkCanCraft(selectedRecipe) && styles.craftButtonDisabled,
                  ]}
                  onPress={() => handleCraft(selectedRecipe.key)}
                  disabled={!checkCanCraft(selectedRecipe)}
                >
                  <Text
                    style={[
                      styles.craftButtonText,
                      !checkCanCraft(selectedRecipe) && styles.craftButtonTextDisabled,
                    ]}
                  >
                    {checkCanCraft(selectedRecipe) ? 'Craft' : 'Missing Ingredients'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : recipes.length === 0 ? (
              // Empty state
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  You don't know any crafting recipes yet.
                </Text>
                <Text style={styles.emptyHint}>
                  Learn recipes by reading books, talking to craftsmen, or discovering them through exploration.
                </Text>
              </View>
            ) : (
              // Recipe List
              <View style={styles.recipeList}>
                {recipes.map((recipe) => {
                  const canCraft = checkCanCraft(recipe);
                  return (
                    <TouchableOpacity
                      key={recipe.key}
                      style={styles.recipeRow}
                      onPress={() => setSelectedRecipe(recipe)}
                    >
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeName}>{recipe.name}</Text>
                        {recipe.description && (
                          <Text style={styles.recipeDesc} numberOfLines={1}>
                            {recipe.description}
                          </Text>
                        )}
                      </View>
                      <View style={styles.recipeStatus}>
                        <Text
                          style={[
                            styles.recipeStatusText,
                            canCraft ? styles.canCraft : styles.cannotCraft,
                          ]}
                        >
                          {canCraft ? 'Ready' : 'Missing'}
                        </Text>
                        <Text style={styles.recipeArrow}>→</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  backButton: {
    marginRight: spacing.md,
  },
  backText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
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
  content: {
    padding: spacing.md,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  recipeList: {
    gap: spacing.sm,
  },
  recipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  recipeInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  recipeName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  recipeDesc: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  recipeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recipeStatusText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    fontWeight: '600',
  },
  canCraft: {
    color: colors.success || '#4CAF50',
  },
  cannotCraft: {
    color: colors.textMuted,
  },
  recipeArrow: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
  },
  recipeDetail: {
    gap: spacing.md,
  },
  recipeDescription: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ingredientList: {
    gap: spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.border,
    borderRadius: 6,
  },
  ingredientName: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.text,
  },
  ingredientCount: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  ingredientMissing: {
    color: colors.error,
  },
  craftButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.text,
    borderRadius: 8,
    alignItems: 'center',
  },
  craftButtonDisabled: {
    backgroundColor: colors.border,
  },
  craftButtonText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  craftButtonTextDisabled: {
    color: colors.textMuted,
  },
});
