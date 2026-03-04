import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { useGameStore } from '../../store/gameStore';
import { colors } from '../../theme/colors';

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

      {/* Separator */}
      <View style={styles.separator} />

      {/* Description */}
      <ParchmentText variant="body" style={styles.description}>
        {currentEntity.description}
      </ParchmentText>

      {/* Actions */}
      {currentEntity.actions.length > 0 && (
        <View style={styles.actionsSection}>
          {currentEntity.actions.map((action) => (
            <TouchableOpacity
              key={action}
              onPress={() => handleAction(action)}
              activeOpacity={0.6}
              style={styles.actionButton}
            >
              <ParchmentText variant="body" color={colors.action} style={styles.actionText}>
                {action}
              </ParchmentText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Back button */}
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
  separator: {
    height: 1,
    backgroundColor: colors.separator,
    marginBottom: 16,
  },
  description: {
    marginBottom: 24,
  },
  actionsSection: {
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(138, 122, 106, 0.08)',
  },
  actionText: {
    letterSpacing: 0.3,
  },
  backButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
