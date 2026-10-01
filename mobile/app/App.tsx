// The phone app shell (R6 SM, SM2): the book view over the real local authority and
// expo-sqlite. The logic is in authority/local-story/smoke.ts, the drawing in book/.
import { Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';
import { openSmoke } from '../authority/local-story/smoke';
import Book from './book/Book.tsx';
import items from '../../protocol/fixtures/cartridge_items_hash.json';

// Opened once per process, kept on globalThis so a Fast Refresh does not open a second handle
// (mobile lessons: a second handle on the same file crashes). A new file name: a save from before
// R6 S3a has no identity row, so it would open as corrupt.
const g = globalThis as { loka_smoke?: ReturnType<typeof openSmoke> };
// A save that does not open (save_corrupt, OFF-07) is shown as one line, not thrown at load.
// ponytail: any open error is shown, typed or not; the new-game recovery screen is SM2's.
let smoke: ReturnType<typeof openSmoke> | undefined;
let failed = '';
try {
  smoke = g.loka_smoke ??= openSmoke(openDatabaseSync('loka-save.db'), items, randomUUID);
} catch (e) {
  failed = `Save could not be opened: ${(e as Error).message}`;
}

export default function App() {
  return smoke ? <Book smoke={smoke} /> : <Text>{failed}</Text>;
}
