import assert from 'node:assert/strict';
import { test } from 'node:test';
import { narrationLines } from './logs.ts';
import type { GameView, NarrationRecord } from '../../packages/game-view/session.ts';

// Breaks: Book drops the saved cue or presents a restored cue as a fresh sound.
test('Book keeps the bell scene and labels restored cue as past', () => {
  const record = {
    command_id: 'aaaaaaaa-0000-4000-8000-000000000101',
    lines: [{ key: 'narration.ring_bell' }],
    cue: { key: 'narration.bell_cue' },
  } as NarrationRecord;
  const words: Record<string, string> = {
    'narration.ring_bell': 'You pull the rope.',
    'narration.bell_cue': 'The bell carries across Ashmere.',
  };
  const text = (key: string) => words[key] ?? key;
  const view = {
    place: { title: { key: 'room.belfry.title' }, description: { key: 'room.belfry.description' } },
  } as GameView;
  assert.deepEqual(narrationLines(record, view, text), [
    'You pull the rope. The bell carries across Ashmere.',
    '',
  ]);
  assert.deepEqual(narrationLines(record, view, text, true), [
    'You pull the rope. Earlier: The bell carries across Ashmere.',
    '',
  ]);
});
