// The Expo app shell (R6 SM, SM2): the book view over the real local authority and
// expo-sqlite, or the screen for a save that does not open. The shell owns every phone-only API
// (SQLite, fonts, Alert, the key-value store) and injects them; the logic is in
// authority/local-story/session.ts, the drawing in book/ and SaveError.tsx.
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { getRandomValues, randomUUID } from 'expo-crypto';
import { useFonts } from 'expo-font';
import {
  deleteDatabaseSync,
  openDatabaseAsync,
  openDatabaseSync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { KERNEL_ID, localSession } from '../authority/local-story/session';
import type { Db } from '../authority/local-story/store.ts';
import { webDb } from './sqlite-web.ts';
import Book, { type Shell } from './book/Book.tsx';
import { hint } from './book/model.ts';
import chapter from '../../protocol/fixtures/missing_child_v041_hash.json';
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
// The chapter has its own save; earlier development story saves stay on the phone untouched.
// ponytail: no story picker until the approved release needs one.
const NAME = 'loka-ashmere-missing-child.db';
// The build's kernel version (ADR-075 §3): the commit metro.config.js stamped, always -dirty in a
// development bundle (it can change after the stamp); no stamp: the zero commit, -dirty.
const commit = process.env.EXPO_PUBLIC_KERNEL_COMMIT ?? `${'0'.repeat(40)}-dirty`;
const kernel_version = `${KERNEL_ID}@${commit}${__DEV__ && !commit.endsWith('-dirty') ? '-dirty' : ''}`;
let db: SQLiteDatabase | undefined;
const g = globalThis as {
  loka_session?: ReturnType<typeof localSession>;
  loka_web_opening?: Promise<ReturnType<typeof localSession>>;
  loka_clock_cleanup?: () => void;
};
const createSession = (open: () => Db) =>
  (g.loka_session ??= localSession(
    open,
    () => {
      db?.closeSync();
      db = undefined;
      deleteDatabaseSync(NAME);
    },
    chapter,
    // Each NEW decision's kernel.decision_latency (11 §13), on the iPhone (Android descoped): select
    // the actual platform before Android evidence resumes.
    {
      newId: randomUUID,
      latency:
        Platform.OS === 'web' ? undefined : { host: 'hermes_ios', now: () => performance.now() },
      kernel_version,
      random: getRandomValues,
      time: { wall: () => Date.now(), monotonic: () => performance.now() },
    },
  ));
let session = g.loka_session;
if (Platform.OS !== 'web') session ??= createSession(() => (db = openDatabaseSync(NAME)));

// Start over destroys the save, so the player confirms it first (10 §31). The hints live here, not
// in the book, so a fresh book keeps what the player has already seen.
const shell: Shell = {
  confirm: (go) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Start over? Your saved game will be lost.')) go();
    } else
      Alert.alert('Start over?', 'Your saved game will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start over', style: 'destructive', onPress: go },
      ]);
  },
  learned: hint(Storage, 'hint.learned'),
};

type Clock = {
  game: NonNullable<ReturnType<ReturnType<typeof localSession>['game']>>;
  active: boolean;
  draining: boolean;
  timer?: ReturnType<typeof setTimeout>;
  cleanup: () => void;
};
const current = (c: Clock) => session?.game() === c.game && g.loka_clock_cleanup === c.cleanup;
function cancel(c: Clock) {
  if (c.timer !== undefined) clearTimeout(c.timer);
  c.timer = undefined;
}
function schedule(c: Clock, delay = 0) {
  if (!current(c) || !c.active || c.timer !== undefined) return;
  c.timer = setTimeout(() => tick(c), delay);
}
function tick(c: Clock) {
  c.timer = undefined;
  if (!current(c) || !c.active) return;
  const held = c.game.pendingInvocation(),
    draining = c.draining;
  const status = c.game.pulse(draining ? 'drain' : 'active');
  if (!current(c) || !c.active) return;
  if (status.kind !== 'ready' && status.kind !== 'catching_up') return cancel(c);
  c.draining = status.kind === 'catching_up';
  schedule(c, c.draining || draining || held ? 0 : 250);
}
function resume(c: Clock) {
  if (!current(c) || !c.active) return;
  const status = c.game.pulse('resume');
  if (!current(c) || !c.active) return;
  c.draining = status.kind === 'catching_up';
  if (status.kind === 'ready' || c.draining) schedule(c);
  else cancel(c);
}
function transition(c: Clock, active: boolean) {
  if (!current(c) || c.active === active) return;
  c.active = active;
  c.draining = false;
  cancel(c);
  if (active) resume(c);
  else c.game.pulse('pause');
}

type Recovery = { notify?: (healthy: boolean) => void };
function useElapsed(
  game: ReturnType<ReturnType<typeof localSession>['game']>,
  recovered: { current: Recovery },
) {
  useEffect(() => {
    g.loka_clock_cleanup?.();
    if (!game) return;
    const c: Clock = {
      game,
      active: AppState.currentState === 'active',
      draining: false,
      cleanup: () => {},
    };
    const listener = AppState.addEventListener('change', (state) =>
      transition(c, state === 'active'),
    );
    c.cleanup = () => {
      cancel(c);
      listener.remove();
      if (g.loka_clock_cleanup === c.cleanup) g.loka_clock_cleanup = undefined;
      recovered.current.notify = undefined;
    };
    g.loka_clock_cleanup = c.cleanup;
    recovered.current.notify = (healthy) => {
      if (healthy) schedule(c);
      else cancel(c);
    };
    resume(c);
    return c.cleanup;
  }, [game]);
}

function useWebSession() {
  const [, redrawBoot] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || session) return;
    // The worker must finish its first WASM/OPFS open before any synchronous save calls.
    g.loka_web_opening ??= openDatabaseAsync(NAME)
      .then((opened) => {
        db = opened;
        return createSession(() => webDb((db ??= openDatabaseSync(NAME))));
      })
      .catch((error) =>
        createSession(() => {
          throw error;
        }),
      );
    let live = true;
    g.loka_web_opening.then((opened) => {
      session = opened;
      if (live) redrawBoot((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);
  return session;
}

export default function App() {
  const activeSession = useWebSession();
  const [loaded, fontError] = useFonts(fonts);
  const [starts, setStarts] = useState(0); // a start over opens a fresh book (its log, its pages)
  const [, redraw] = useState({});
  const game = activeSession?.game();
  const recovered = useRef<Recovery>({});
  const [bookShell] = useState<Shell>(() => ({
    ...shell,
    recovered: (healthy) => {
      recovered.current.notify?.(healthy);
    },
  }));
  useElapsed(game, recovered);
  if (!activeSession) return null;
  if (!loaded && !fontError) return null;
  const startOver = () => {
    const before = activeSession.game();
    const why = activeSession.startOver();
    // Only a start over that replaced the game opens a fresh book; a failed one keeps this book
    // and its log (which says why), so the log must not restart.
    if (activeSession.game() !== before) setStarts((n) => n + 1);
    else redraw({});
    return why;
  };
  if (!game)
    return (
      <SaveError failed={activeSession.failed()!} startOver={() => shell.confirm(startOver)} />
    );
  return <Book key={starts} game={game} shell={bookShell} startOver={startOver} />;
}
