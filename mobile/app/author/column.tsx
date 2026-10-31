// The author column (docs/system/cartridge.md#author-preview): what the kernel holds now (facts,
// quests), the rule explainer for an action or dialogue, and each Book line's source. Reads only;
// the explainer and the source lookup run in `bin/loka dev --watch` (kernel/ts/play/live.ts).
import { useEffect, useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import type { localSession } from '../../authority/local-story/session';

export type Opened = NonNullable<ReturnType<ReturnType<typeof localSession>['game']>>;
/** words -> text key, filled as the Book resolves text, so a clicked line names its source. */
export const seen = new Map<string, string>();
const ask = (path: string, sent: object) =>
  fetch(`/__author/${path}`, { method: 'POST', body: JSON.stringify(sent) }).then(async (r) => ({
    ok: r.ok,
    told: (await r.json()) as unknown,
  }));

// Alt-click (Option-click) on a Book line: the watcher opens its source in the owner's editor.
function useOpenSource(note: (line: string) => void) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const words = (e.target as HTMLElement).textContent ?? '';
      ask('open', { key: seen.get(words), words }).then(
        ({ ok, told }) => note(ok ? `Opened ${told}` : `Not opened: ${told}`),
        (err: Error) => note(`Not opened: ${err.message}`),
      );
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [note]);
}

function Why({ game, note }: { game: Opened; note: (line: string) => void }) {
  const [key, setKey] = useState('');
  const [told, setTold] = useState('');
  // the explainer reads the world before the last recorded step, so it answers for that step
  const why = (on: 'action' | 'dialogue') =>
    ask('why', { trace: game.trace(), [on]: key }).then(
      ({ told }) => setTold(JSON.stringify(told, null, 1)),
      (err: Error) => note(`Why failed: ${err.message}`),
    );
  return (
    <View style={{ gap: 4 }}>
      <TextInput
        aria-label="Action or dialogue key"
        placeholder="action or dialogue key"
        value={key}
        onChangeText={setKey}
        style={{ borderWidth: 1 }}
      />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Button title="Why action" onPress={() => why('action')} disabled={!key} />
        <Button title="Why dialogue" onPress={() => why('dialogue')} disabled={!key} />
      </View>
      {told ? <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{told}</Text> : null}
    </View>
  );
}

/** Facts, quests and the explainer for `game`, redrawn on every session update. */
export function Column({ game }: { game: Opened }) {
  const [, bump] = useState({});
  const [opened, setOpened] = useState('');
  useEffect(() => game.subscribe(() => bump({})), [game]);
  useOpenSource(setOpened);
  const facts = Object.entries(game.facts());
  const quests = game.view().view.journal;
  return (
    <View style={{ gap: 8 }}>
      <Text selectable>Alt-click a Book line to open its source. {opened}</Text>
      <Text style={{ fontWeight: 'bold' }}>Facts ({facts.length})</Text>
      {facts.map(([k, v]) => (
        <Text key={k} selectable>{`${k}: ${JSON.stringify(v)}`}</Text>
      ))}
      <Text style={{ fontWeight: 'bold' }}>Quests ({quests.length})</Text>
      {quests.map((q) => (
        <Text key={String(q.quest)} selectable>{`${q.quest} ${q.state}`}</Text>
      ))}
      <Text style={{ fontWeight: 'bold' }}>Why</Text>
      <Why game={game} note={setOpened} />
    </View>
  );
}
