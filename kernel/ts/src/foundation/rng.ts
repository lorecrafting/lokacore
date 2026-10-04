// The xoshiro128ss-1.1 gameplay RNG and bounded uniform draws
// (docs/spec/conformance/numeric-profile.md). Not for keys, tokens or signatures.
// Adapted from xoshiro128** 1.1 by David Blackman and Sebastiano Vigna
// (https://prng.di.unimi.it/xoshiro128starstar.c), dedicated to the public domain.
// State is four unsigned 32-bit words, not all zero; functions return the next state and
// never mutate their input.
import { KernelError } from './error.ts';

export type RngState = readonly number[];

const TWO32 = 0x100000000;

function checked(state: unknown): RngState {
  if (
    !Array.isArray(state) ||
    state.length !== 4 ||
    !state.every((w) => Number.isInteger(w) && w >= 0 && w < TWO32) ||
    state.every((w) => w === 0)
  )
    throw new KernelError('invalid_rng_state');
  return state;
}

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

function step([s0, s1, s2, s3]: RngState): [number, RngState] {
  const raw = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  s2 = (s2 ^ s0) >>> 0;
  s3 = (s3 ^ s1) >>> 0;
  s1 = (s1 ^ s2) >>> 0;
  s0 = (s0 ^ s3) >>> 0;
  return [raw, [s0, s1, (s2 ^ t) >>> 0, rotl(s3, 11)]];
}

export const next = (state: RngState): [number, RngState] => step(checked(state));

/**
 * Uniform integer in [0, bound), 1 <= bound <= 2^32, by rejection sampling. Rejected draws
 * advance the state. A maxDraws that is not a non-negative integer throws 'invalid_rng_budget';
 * more than maxDraws draws throws 'rng_budget_exhausted', and the caller
 * discards the whole decision.
 */
export function uniform(state: RngState, bound: number, maxDraws: number): [number, RngState] {
  if (!Number.isInteger(bound) || bound < 1 || bound > TWO32)
    throw new KernelError('invalid_bound');
  if (!Number.isInteger(maxDraws) || maxDraws < 0) throw new KernelError('invalid_rng_budget');
  let s = checked(state);
  const limit = TWO32 - (TWO32 % bound);
  for (let n = 0; n < maxDraws; n++) {
    const [raw, after] = step(s);
    s = after;
    if (raw < limit) return [raw % bound, s];
  }
  throw new KernelError('rng_budget_exhausted');
}
