import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { useGameStore } from '../../store/gameStore';
import { colors, fonts, fontSizes } from '../../theme/colors';

export function EntityPage() {
  const currentEntity = useGameStore((s) => s.currentEntity);
  const setPage = useGameStore((s) => s.setPage);
  const previousPage = useGameStore((s) => s.previousPage);

  function handleBack() {
    setPage(previousPage ?? 'ROOM');
  }

  function handleAction(action: string) {
    // TODO: wire to phoenixClient
    console.log('[EntityPage] action tapped:', action, 'on entity:', currentEntity?.id);
  }

  if (!currentEntity) {
    return (
      <ParchmentPage>
        <ParchmentText variant="body" color={colors.secondary}>
          No entity selected.
        </ParchmentText>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.6} style={styles.backButton}>
          <ParchmentText variant="small" color={colors.secondary}>
            [Back]
          </ParchmentText>
        </TouchableOpacity>
      </ParchmentPage>
    );
  }

  return (
    <ParchmentPage bottomBarVisible>
      {/* Entity name */}
      <ParchmentText variant="entityTitle" style={styles.entityName}>
        {currentEntity.name}
      </ParchmentText>

      {/* Description */}
      <ParchmentText variant="body" style={styles.description}>
        {currentEntity.description}
      </ParchmentText>

      {/* Actions — authoritative list from server; underlined inline links */}
      {currentEntity.actions.length > 0 && (
        <View style={styles.actionsSection}>
          {currentEntity.actions.map((action) => (
            <TouchableOpacity
              key={action}
              onPress={() => handleAction(action)}
              activeOpacity={0.6}
            >
              <Text style={styles.actionText}>{action}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Back */}
      <TouchableOpacity onPress={handleBack} activeOpacity={0.6} style={styles.backButton}>
        <ParchmentText variant="small" color={colors.secondary}>
          [Back]
        </ParchmentText>
      </TouchableOpacity>
    </ParchmentPage>
  );
}

const styles = StyleSheet.create({
  entityName: {
    marginBottom: 12,
  },
  description: {
    marginBottom: 20,
  },
  actionsSection: {
    gap: 8,
    marginBottom: 20,
  },
  actionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    color: colors.action,
    textDecorationLine: 'underline',
    textDecorationColor: colors.action,
  },
  backButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
