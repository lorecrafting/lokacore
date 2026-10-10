// variety@1 (toolbox row W7; mechanics.md narration variety): a committed narration line whose key
// has alternates shows one of the key and its alternates, chosen by SHA-256 of
// "<command id>:<key>" (its first four bytes, big-endian, modulo the count), never the authority
// RNG (toolbox trap 5), so replaying the same command ids replays the same lines.
import type { CommandId, Text, TextKey } from '../contracts.gen.ts';
import { sha256, utf8 } from '../foundation/sha256.ts';
import type { Cartridge } from '../runtime/decision.ts';

export function vary(cartridge: Cartridge, command: CommandId, lines: readonly Text[]): Text[] {
  const table = cartridge.alternates;
  return lines.map((line) => {
    const more = table && Object.hasOwn(table, line.key) ? table[line.key]! : [];
    if (!more.length) return line;
    const h = sha256(utf8(`${command}:${line.key}`));
    const pick = (((h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!) >>> 0) % (more.length + 1);
    return pick === 0 ? line : { ...line, key: more[pick - 1] as TextKey };
  });
}
