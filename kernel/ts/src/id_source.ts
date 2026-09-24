// Deterministic gameplay ids (spec 01 A8; owner decision
// docs/decisions/owner-decisions-r3-2026-09-24.md): a UUIDv8 from the first 16 bytes of
// SHA-256 over the canonical JSON ["loka-id-v1", worldContextId, commandId, ordinal].
import { encode } from './canonical.ts';
import { KernelError } from './error.ts';
import { sha256, utf8 } from './sha256.ts';

export function id(worldContextId: string, commandId: string, ordinal: number): string {
  if (typeof worldContextId !== 'string' || typeof commandId !== 'string')
    throw new KernelError('invalid_id');
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) throw new KernelError('invalid_ordinal');
  const b = sha256(utf8(encode(['loka-id-v1', worldContextId, commandId, ordinal]))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80; // version 8
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 9562 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
