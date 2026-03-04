import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { ClickableEntity } from '../ui/ClickableEntity';
import { useGameStore } from '../../store/gameStore';
import { colors } from '../../theme/colors';
import type { EntitySummary } from '../../types/game';

export function RoomPage() {
  const room = useGameStore((s) => s.room);
  const events = useGameStore((s) => s.events);

  if (!room) {
    return (
      <ParchmentPage bottomBarVisible>
        <ParchmentText variant="body" color={colors.secondary}>
          Waiting for room data...
        </ParchmentText>
      </ParchmentPage>
    );
  }

  const recentEvents = events.slice(-5);

  function handleEntityPress(entity: EntitySummary) {
    // TODO: wire to phoenixClient.clickEntity(entity.id)
    console.log('[RoomPage] entity tapped:', entity.id, entity.name);
  }

  const hasNpcs = room.npcs.length > 0;
  const hasItems = room.items.length > 0;
  const hasEvents = recentEvents.length > 0;

  return (
    <ParchmentPage bottomBarVisible>
      {/* Room title */}
      <ParchmentText variant="title" style={styles.title}>
        {room.name}
      </ParchmentText>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Room description */}
      <ParchmentText variant="body" style={styles.description}>
        {room.description}
      </ParchmentText>

      {/* NPCs */}
      {hasNpcs && (
        <View style={styles.section}>
          <ParchmentText variant="italic" style={styles.sectionLabel}>
            You see:
          </ParchmentText>
          <View style={styles.entityList}>
            {room.npcs.map((npc) => (
              <View key={npc.id} style={styles.entityRow}>
                <ClickableEntity entity={npc} onPress={handleEntityPress} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Items */}
      {hasItems && (
        <View style={styles.section}>
          <View style={styles.entityList}>
            {room.items.map((item) => (
              <View key={item.id} style={styles.entityRow}>
                <ClickableEntity entity={item} onPress={handleEntityPress} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Events */}
      {hasEvents && (
        <View style={styles.eventsSection}>
          <View style={styles.eventsSeparator} />
          {recentEvents.map((ev, i) => (
            <ParchmentText
              key={`${ev.timestamp}-${i}`}
              variant="italic"
              color={colors.event}
              style={styles.eventLine}
            >
              {ev.text}
            </ParchmentText>
          ))}
        </View>
      )}
    </ParchmentPage>
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
  description: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 6,
  },
  entityList: {
    gap: 6,
  },
  entityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  eventsSection: {
    marginTop: 8,
  },
  eventsSeparator: {
    height: 1,
    backgroundColor: colors.decorative,
    marginBottom: 12,
  },
  eventLine: {
    marginBottom: 4,
    lineHeight: 24,
  },
});
