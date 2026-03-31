import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { ClickableEntity } from '../ui/ClickableEntity';
import { useGameStore } from '../../store/gameStore';
import { colors } from '../../theme/colors';
import type { EntitySummary, EntityDetail } from '../../types/game';

export function RoomPage() {
  const room = useGameStore((s) => s.room);
  const events = useGameStore((s) => s.events);
  const setCurrentEntity = useGameStore((s) => s.setCurrentEntity);

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
    // In the real game, tapping an entity sends a look/examine command to the server
    // and the server responds with EntityDetail including the authoritative actions list.
    // For mock mode we use minimal sensible defaults.
    const detail: EntityDetail = {
      id: entity.id,
      key: entity.key,
      name: entity.name,
      description: entity.description || entity.long_desc || entity.name,
      type: entity.type === 'player' ? 'npc' : entity.type,
      actions: entity.type === 'npc' ? ['Talk'] : ['Take'],
    };
    setCurrentEntity(detail);
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

      {/* Room description */}
      <ParchmentText variant="body" style={styles.description}>
        {room.description}
      </ParchmentText>

      {/* NPCs */}
      {hasNpcs && (
        <View style={styles.section}>
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
  description: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
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
  eventLine: {
    marginBottom: 4,
    lineHeight: 24,
  },
});
