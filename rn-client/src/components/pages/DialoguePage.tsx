import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ParchmentPage } from '../ParchmentPage';
import { ParchmentText } from '../ui/ParchmentText';
import { useGameStore } from '../../store/gameStore';
import { colors } from '../../theme/colors';
import type { DialogueChoice, DialogueEntry } from '../../types/game';

export function DialoguePage() {
  const dialogue = useGameStore((s) => s.dialogue);
  const endDialogue = useGameStore((s) => s.endDialogue);

  if (!dialogue) {
    return (
      <ParchmentPage>
        <ParchmentText variant="body" color={colors.secondary}>
          No active dialogue.
        </ParchmentText>
      </ParchmentPage>
    );
  }

  function handleChoicePress(choice: DialogueChoice) {
    // TODO: wire to phoenixClient.dialogueSelect(choice.index)
    console.log('[DialoguePage] choice selected:', choice.index, choice.text);
  }

  function getSpeakerLabel(entry: DialogueEntry): string {
    if (entry.type === 'player') return 'You';
    if (entry.type === 'narration') return '';
    return entry.speaker ?? dialogue!.speaker;
  }

  return (
    <ParchmentPage bottomBarVisible>
      {/* Speaker name */}
      <ParchmentText variant="title" style={styles.speakerTitle}>
        {dialogue.speaker}
      </ParchmentText>

      <View style={styles.separator} />

      {/* History */}
      {dialogue.history.length > 0 && (
        <View style={styles.historySection}>
          {dialogue.history.map((entry, i) => (
            <HistoryEntry key={i} entry={entry} speakerLabel={getSpeakerLabel(entry)} />
          ))}
          <View style={styles.historySeparator} />
        </View>
      )}

      {/* Current NPC text */}
      {dialogue.text.length > 0 && (
        <View style={styles.currentTextSection}>
          <ParchmentText variant="bold" style={styles.currentSpeakerPrefix}>
            {dialogue.speaker}:
          </ParchmentText>
          <ParchmentText variant="body" style={styles.currentText}>
            {dialogue.text}
          </ParchmentText>
        </View>
      )}

      {/* Choices */}
      {dialogue.choices.length > 0 && (
        <View style={styles.choicesSection}>
          {dialogue.choices.map((choice) => (
            <TouchableOpacity
              key={choice.index}
              onPress={() => handleChoicePress(choice)}
              activeOpacity={0.6}
              style={styles.choiceRow}
            >
              <ParchmentText variant="body" color={colors.choice} style={styles.choiceText}>
                {'> '}{choice.text}
              </ParchmentText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity
        onPress={endDialogue}
        activeOpacity={0.6}
        style={styles.backButton}
      >
        <ParchmentText variant="small" color={colors.secondary} style={styles.backButtonText}>
          [Leave]
        </ParchmentText>
      </TouchableOpacity>
    </ParchmentPage>
  );
}

interface HistoryEntryProps {
  entry: DialogueEntry;
  speakerLabel: string;
}

function HistoryEntry({ entry, speakerLabel }: HistoryEntryProps) {
  const isPlayer = entry.type === 'player';
  const isNarration = entry.type === 'narration';

  if (isNarration) {
    return (
      <ParchmentText variant="italic" color={colors.dialogueEvent} style={styles.historyLine}>
        {entry.text}
      </ParchmentText>
    );
  }

  return (
    <View style={styles.historyLine}>
      <ParchmentText
        variant="bold"
        color={isPlayer ? colors.player : colors.entityTitle}
        style={styles.historyPrefix}
      >
        {speakerLabel}:{' '}
      </ParchmentText>
      <ParchmentText
        variant="body"
        color={isPlayer ? colors.player : colors.body}
        style={styles.historyText}
      >
        {entry.text}
      </ParchmentText>
    </View>
  );
}

const styles = StyleSheet.create({
  speakerTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.separator,
    marginBottom: 16,
  },
  historySection: {
    marginBottom: 12,
  },
  historyLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  historyPrefix: {
    lineHeight: 26,
  },
  historyText: {
    flex: 1,
    lineHeight: 26,
    color: colors.secondary,
  },
  historySeparator: {
    height: 1,
    backgroundColor: colors.decorative,
    marginTop: 8,
    marginBottom: 16,
  },
  currentTextSection: {
    marginBottom: 20,
  },
  currentSpeakerPrefix: {
    marginBottom: 4,
  },
  currentText: {
    lineHeight: 30,
  },
  choicesSection: {
    gap: 10,
    marginBottom: 24,
  },
  choiceRow: {
    paddingVertical: 4,
  },
  choiceText: {
    lineHeight: 28,
  },
  backButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    letterSpacing: 0.5,
  },
});
