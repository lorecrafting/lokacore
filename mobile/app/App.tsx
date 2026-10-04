// The phone app shell (R6 SM, SM2): the book view over the real local authority and
// expo-sqlite, or the screen for a save that does not open. The shell owns every phone-only API
// (SQLite, fonts, Alert, the key-value store) and injects them; the logic is in
// authority/local-story/session.ts, the drawing in book/ and SaveError.tsx.
import { useState } from 'react';
import { Alert } from 'react-native';
import { getRandomValues, randomUUID } from 'expo-crypto';
import { useFonts } from 'expo-font';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { KERNEL_ID, localSession } from '../authority/local-story/session';
import Book, { type Shell } from './book/Book.tsx';
import { hint } from './book/model.ts';
import sampler from '../../protocol/fixtures/cartridge_sampler_hash.json';
import { SaveError } from './SaveError';

// The bundled fonts (OFL, book/fonts/OFL-*.txt); the shell loads them, the renderer only names them.
const fonts = {
  IMFellEnglish: require('./book/fonts/IMFellEnglish.ttf'),
  EBGaramond: require('./book/fonts/EBGaramond.ttf'),
};

// Opened once per process, kept on globalThis so a Fast Refresh does not open a second handle
// (mobile lessons: a second handle on the same file crashes). A new file name: a save from before
// R6 S3a has no identity row, so it would open as corrupt. Start over closes the handle before it
// deletes the file (expo refuses to delete an open database).
// deleteDatabaseSync removes the main file only; SQLite discards a -journal left beside the new,
// empty file rather than replaying it, so nothing else needs deleting.
// The sampler has its own save; the Lantern and items files stay on the phone untouched.
// ponytail: no story picker until the approved release needs one.
const NAME = 'loka-ashmere-sampler.db';
// The build's kernel version (ADR-075 §3): the commit metro.config.js stamped, always -dirty in a
// development bundle (it can change after the stamp); no stamp: the zero commit, -dirty.
const commit = process.env.EXPO_PUBLIC_KERNEL_COMMIT ?? `${'0'.repeat(40)}-dirty`;
const kernel_version = `${KERNEL_ID}@${commit}${__DEV__ && !commit.endsWith('-dirty') ? '-dirty' : ''}`;
let db: SQLiteDatabase | undefined;
const g = globalThis as { loka_session?: ReturnType<typeof localSession> };
const session = (g.loka_session ??= localSession(
  () => (db = openDatabaseSync(NAME)),
  () => {
    db?.closeSync();
    db = undefined;
    deleteDatabaseSync(NAME);
  },
  sampler,
  // Each NEW decision's kernel.decision_latency (11 §13), on the iPhone (Android descoped): select
  // the actual platform before Android evidence resumes.
  {
    newId: randomUUID,
    latency: { host: 'hermes_ios', now: () => performance.now() },
    kernel_version,
    random: getRandomValues,
  },
));

// Start over destroys the save, so the player confirms it first (10 §31). The hints live here, not
// in the book, so a fresh book keeps what the player has already seen.
const shell: Shell = {
  confirm: (go) =>
    Alert.alert('Start over?', 'Your saved game will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start over', style: 'destructive', onPress: go },
    ]),
  learned: hint(Storage, 'hint.learned'),
};

export default function App() {
  const [loaded, fontError] = useFonts(fonts);
  const [starts, setStarts] = useState(0); // a start over opens a fresh book (its log, its pages)
  const [, redraw] = useState({});
  if (!loaded && !fontError) return null;
  const startOver = () => {
    const before = session.game();
    const why = session.startOver();
    // Only a start over that replaced the game opens a fresh book; a failed one keeps this book
    // and its log (which says why), so the log must not restart.
    if (session.game() !== before) setStarts((n) => n + 1);
    else redraw({});
    return why;
  };
  const game = session.game();
  if (!game)
    return <SaveError failed={session.failed()!} startOver={() => shell.confirm(startOver)} />;
  return <Book key={starts} game={game} shell={shell} startOver={startOver} />;
}
