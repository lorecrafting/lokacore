// The phone app shell (R6 SM, SM2): the book view over the real local authority and
// expo-sqlite, or the screen for a save that does not open. The logic is in
// authority/local-story/smoke.ts, the drawing in book/ and SaveError.tsx.
import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { playSmoke } from '../authority/local-story/smoke';
import Book from './book/Book.tsx';
import items from '../../protocol/fixtures/cartridge_items_hash.json';
import { SaveError } from './SaveError';

// Opened once per process, kept on globalThis so a Fast Refresh does not open a second handle
// (mobile lessons: a second handle on the same file crashes). A new file name: a save from before
// R6 S3a has no identity row, so it would open as corrupt. Start over closes the handle before it
// deletes the file (expo refuses to delete an open database).
// deleteDatabaseSync removes the main file only; SQLite discards a -journal left beside the new,
// empty file rather than replaying it, so nothing else needs deleting.
const NAME = 'loka-save.db';
let db: SQLiteDatabase | undefined;
const g = globalThis as { loka_smoke?: ReturnType<typeof playSmoke> };
const smoke = (g.loka_smoke ??= playSmoke(
  () => (db = openDatabaseSync(NAME)),
  () => {
    db?.closeSync();
    db = undefined;
    deleteDatabaseSync(NAME);
  },
  items,
  randomUUID,
));

export default function App() {
  const [starts, setStarts] = useState(0); // a start over opens a fresh book (its log, its pages)
  const [, redraw] = useState({});
  const startOver = () => {
    const before = smoke.game();
    smoke.startOver();
    // Only a start over that replaced the game opens a fresh book; a failed one keeps this book
    // and its log (which says why), so the log must not restart.
    if (smoke.game() !== before) setStarts((n) => n + 1);
    else redraw({});
  };
  const game = smoke.game();
  if (!game) return <SaveError failed={smoke.failed()!} startOver={startOver} />;
  return <Book key={starts} smoke={game} startOver={startOver} />;
}
